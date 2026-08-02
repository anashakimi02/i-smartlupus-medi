-- ============================================================
-- i-SMARTLUPUS - User active/inactive status
-- Migration: 007_user_active_status.sql
--   * add profiles.is_active (existing rows default to active)
--   * protect is_active from self-service edits
--   * make the role helpers active-aware, so deactivation revokes
--     privileges at the RLS layer and not only at the login screen
-- ============================================================

-- ------------------------------------------------------------
-- 1. The column. NOT NULL DEFAULT TRUE backfills every existing
--    row as active, so nobody is locked out by the migration.
-- ------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ------------------------------------------------------------
-- 2. Close the self-reactivation hole.
--    "profiles_update_own" (001) lets any user UPDATE their own row.
--    Without this, a deactivated user could simply set is_active
--    back to TRUE on themselves.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF COALESCE(auth.role(), '') = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Profile id cannot be changed.'
            USING ERRCODE = '42501';
    END IF;

    IF (
        NEW.role IS DISTINCT FROM OLD.role
        OR NEW.email IS DISTINCT FROM OLD.email
        OR NEW.is_active IS DISTINCT FROM OLD.is_active
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
    ) AND NOT public.current_user_is_admin() THEN
        RAISE EXCEPTION 'Only admins can change protected profile fields.'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 3. Deactivation must revoke privileges, not just block login.
--    A user holding an unexpired JWT keeps calling the API until
--    it refreshes; these helpers gate RLS and every workflow
--    function, so the revocation is immediate regardless of token.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND is_active
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
          AND is_active
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_asset_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('unit_aset', 'admin')
          AND is_active
    );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO authenticated;

-- ------------------------------------------------------------
-- 4. Ticket submission is the one workflow function that checks
--    only "is someone logged in", so a deactivated pemohon could
--    still file with a live token. Close it.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_disposal_ticket(
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

    INSERT INTO public.disposal_tickets (
        asset_name,
        inventory_id,
        asset_condition,
        location,
        created_by
    )
    VALUES (
        BTRIM(p_asset_name),
        NULLIF(BTRIM(p_inventory_id), ''),
        p_asset_condition,
        NULLIF(BTRIM(p_location), ''),
        v_actor
    )
    RETURNING * INTO v_ticket;

    INSERT INTO public.audit_logs (
        ticket_id,
        action,
        new_value,
        performed_by
    )
    VALUES (
        v_ticket.id,
        'permohonan_dibuat',
        'menunggu_semakan',
        v_actor
    );

    RETURN v_ticket;
END;
$$;

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

    IF v_ticket.created_by <> v_actor THEN
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
