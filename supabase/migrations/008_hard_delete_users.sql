-- 008_hard_delete_users.sql
--
-- Lets an admin hard-delete a user account.
--
-- 001 set disposal_tickets.created_by and audit_logs.performed_by to
-- ON DELETE RESTRICT, so deleting anyone who had ever filed a ticket or
-- performed an audited action failed on a foreign key. Anas's call
-- (2026-08-15) is to allow the delete.
--
-- SET NULL, deliberately not CASCADE: deleting a user must not delete the
-- hospital's disposal records. The rows survive; only the actor identity is
-- dropped, and the UI already renders a missing actor as "—".
--
-- Section 2 is not optional. Making these columns nullable silently opens
-- three ownership guards; see the comment there before touching it.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Relax the two RESTRICT foreign keys
-- ---------------------------------------------------------------------------
-- 001 declared both inline and unnamed, so PostgreSQL generated the default
-- <table>_<column>_fkey names used below. If a name ever differed, the
-- DROP ... IF EXISTS would silently skip and the ADD would fail loudly on a
-- duplicate — a visible failure, not a silent one.

ALTER TABLE public.disposal_tickets
    ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.disposal_tickets
    DROP CONSTRAINT IF EXISTS disposal_tickets_created_by_fkey;

ALTER TABLE public.disposal_tickets
    ADD CONSTRAINT disposal_tickets_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs
    ALTER COLUMN performed_by DROP NOT NULL;

ALTER TABLE public.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_performed_by_fkey;

ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_performed_by_fkey
    FOREIGN KEY (performed_by) REFERENCES public.profiles (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 2. Make the three ownership guards null-safe
-- ---------------------------------------------------------------------------
-- Once created_by is nullable, every comparison against it can evaluate to
-- NULL for an orphaned ticket — and NULL is not TRUE, so guards written to
-- RAISE stop raising. All three below fail OPEN, not closed:
--
--   resubmit_disposal_ticket   IF created_by <> v_actor THEN RAISE
--       NULL <> actor -> NULL -> no raise -> anyone resubmits the ticket.
--
--   attach_disposal_photo      IF NOT (staff OR (created_by = v_actor AND ...))
--   attach_disposal_borang_ca  IF NOT (staff OR (created_by = v_actor AND ...))
--       NULL = actor -> NULL; FALSE OR NULL -> NULL; NOT NULL -> NULL
--       -> no raise -> any authenticated non-staff user attaches files.
--
-- IS DISTINCT FROM / IS NOT DISTINCT FROM treat NULL as a value, so an
-- orphaned ticket fails the ownership test for everyone. That is the correct
-- answer once its owner is gone.
--
-- Note the operators differ. resubmit uses a <> deny-guard, so it needs
-- IS DISTINCT FROM. The two attach functions use = inside a negated
-- allow-clause, so they need IS NOT DISTINCT FROM. Using one form in all
-- three places inverts one of them.
--
-- Bodies are copied verbatim from the current definition of each function
-- (007, 003 and 005 respectively); only the marked comparison changed.
-- CREATE OR REPLACE preserves existing privileges, so the GRANT/REVOKE
-- statements from those migrations do not need repeating.

-- 2a. resubmit_disposal_ticket — current definition in 007
CREATE OR REPLACE FUNCTION public.resubmit_disposal_ticket(
    p_ticket_id UUID,
    p_asset_name TEXT,
    p_asset_condition public.asset_condition,
    p_inventory_id TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL
)
RETURNS public.disposal_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_ticket public.disposal_tickets;
BEGIN
    IF v_actor IS NULL OR NOT public.current_user_is_active() THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '42501';
    END IF;

    IF NULLIF(BTRIM(p_asset_name), '') IS NULL THEN
        RAISE EXCEPTION 'Asset name is required.'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_ticket
    FROM public.disposal_tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket not found.'
            USING ERRCODE = 'P0002';
    END IF;

    -- 008: was `<>`. A deleted owner leaves created_by NULL, and NULL <> actor
    -- is NULL, which would skip this RAISE and let anyone resubmit.
    IF v_ticket.created_by IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION 'Only the ticket creator can resubmit this ticket.'
            USING ERRCODE = '42501';
    END IF;

    IF v_ticket.status <> 'ditolak'::public.ticket_status THEN
        RAISE EXCEPTION 'Only rejected tickets can be resubmitted.'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.disposal_tickets
    SET asset_name = BTRIM(p_asset_name),
        inventory_id = NULLIF(BTRIM(p_inventory_id), ''),
        asset_condition = p_asset_condition,
        location = NULLIF(BTRIM(p_location), ''),
        status = 'menunggu_semakan',
        disposal_method = NULL,
        rejection_reason = NULL,
        reviewed_by = NULL,
        reviewed_at = NULL,
        completed_by = NULL,
        completed_at = NULL
    WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;

    INSERT INTO public.audit_logs (
        ticket_id,
        action,
        old_value,
        new_value,
        performed_by
    )
    VALUES (
        v_ticket.id,
        'permohonan_dihantar_semula',
        'ditolak',
        'menunggu_semakan',
        v_actor
    );

    RETURN v_ticket;
END;
$$;

-- 2b. attach_disposal_photo — current definition in 003
CREATE OR REPLACE FUNCTION public.attach_disposal_photo(
    p_ticket_id UUID,
    p_image_path TEXT
)
RETURNS public.disposal_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_image_path TEXT := NULLIF(BTRIM(p_image_path), '');
    v_ticket public.disposal_tickets;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required.'
            USING ERRCODE = '42501';
    END IF;

    IF v_image_path IS NULL THEN
        RAISE EXCEPTION 'Image path is required.'
            USING ERRCODE = '22023';
    END IF;

    IF public.disposal_file_kind(v_image_path) <> 'photos'
       OR public.disposal_file_ticket_id(v_image_path) <> p_ticket_id THEN
        RAISE EXCEPTION 'Image path does not match ticket.'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_ticket
    FROM public.disposal_tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket not found.'
            USING ERRCODE = 'P0002';
    END IF;

    IF NOT (
        public.current_user_is_asset_staff()
        OR (
            -- 008: was `=`. NULL = actor is NULL, which propagates through the
            -- OR and the NOT, skipping this RAISE for every non-staff caller.
            v_ticket.created_by IS NOT DISTINCT FROM v_actor
            AND v_ticket.status IN (
                'menunggu_semakan'::public.ticket_status,
                'ditolak'::public.ticket_status
            )
        )
    ) THEN
        RAISE EXCEPTION 'Not allowed to attach a photo to this ticket.'
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.disposal_tickets
    SET image_url = v_image_path
    WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;

    INSERT INTO public.audit_logs (
        ticket_id,
        action,
        new_value,
        performed_by
    )
    VALUES (
        v_ticket.id,
        'foto_aset_dilampirkan',
        v_image_path,
        v_actor
    );

    RETURN v_ticket;
END;
$$;

-- 2c. attach_disposal_borang_ca — current definition in 005
CREATE OR REPLACE FUNCTION public.attach_disposal_borang_ca(
    p_ticket_id UUID,
    p_borang_path TEXT
)
RETURNS public.disposal_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_path TEXT := NULLIF(BTRIM(p_borang_path), '');
    v_ticket public.disposal_tickets;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF v_path IS NULL THEN
        RAISE EXCEPTION 'Borang CA path is required.' USING ERRCODE = '22023';
    END IF;

    IF public.disposal_file_kind(v_path) <> 'borang_ca'
       OR public.disposal_file_ticket_id(v_path) <> p_ticket_id THEN
        RAISE EXCEPTION 'Borang CA path does not match ticket.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_ticket FROM public.disposal_tickets
    WHERE id = p_ticket_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket not found.' USING ERRCODE = 'P0002';
    END IF;

    IF NOT (
        public.current_user_is_asset_staff()
        OR (
            -- 008: was `=`. Same NULL-propagation hole as attach_disposal_photo.
            v_ticket.created_by IS NOT DISTINCT FROM v_actor
            AND v_ticket.status IN (
                'menunggu_semakan'::public.ticket_status,
                'ditolak'::public.ticket_status
            )
        )
    ) THEN
        RAISE EXCEPTION 'Not allowed to attach Borang CA to this ticket.'
            USING ERRCODE = '42501';
    END IF;

    UPDATE public.disposal_tickets
    SET borang_ca_url = v_path
    WHERE id = p_ticket_id
    RETURNING * INTO v_ticket;

    INSERT INTO public.audit_logs (ticket_id, action, new_value, performed_by)
    VALUES (v_ticket.id, 'borang_ca_dilampirkan', v_path, v_actor);

    RETURN v_ticket;
END;
$$;

COMMIT;
