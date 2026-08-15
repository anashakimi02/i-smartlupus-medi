# Admin User Operations + Submit Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hard user deletion and admin password reset to the user-management page, correct the login contact line, and replace the submit toast with a confirmation modal carrying the 3-working-day SLA.

**Architecture:** Four independent changes on one branch. Three are additive frontend/API work reusing components that already exist. The fourth — hard delete — requires migration 008 to relax two `ON DELETE RESTRICT` foreign keys to `SET NULL`, plus a correctness fix to two ownership guards that would otherwise open up once the columns become nullable.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (`@supabase/ssr` + service-role admin client) · Tailwind · Radix UI Dialog · Vitest + @testing-library/react · sonner

**Spec:** `docs/superpowers/specs/2026-08-15-admin-user-ops-and-confirmations-design.md`

## Global Constraints

- **Branch:** `feat/admin-user-ops-and-confirmations`, off `master` @ `c63cdfd`. Do not commit the 8 pre-existing `.omx/` deletions in the working tree.
- **Language:** all user-facing copy is Malay. Spelling is **"Permohonan"**, never "Permohanan".
- **Password policy:** reuse `isValidPassword` / `PASSWORD_ERROR` from `lib/password.ts`. Never define a second policy. `PASSWORD_MIN_LENGTH` is 12.
- **DDL:** this environment has no DB password and no Supabase CLI. Migration files are written here and applied by Anas in the Supabase SQL Editor. Never claim a migration is applied.
- **Admin auth pattern:** every privileged route follows the order already used in `app/api/users/[id]/route.ts` — service-role key check (500) → `getUser()` (401) → profile `role === "admin" && is_active` (403) → validate body (400) → act.
- **Partial failures are reported as partial**, following `app/api/users/[id]/route.ts:146-160`. Never report a half-completed multi-step write as success.
- **Contact number:** `09-6971200 (sambungan 1118)`.
- **Test commands:** `npx vitest run <path>` for one file, `npx tsc --noEmit` for types, `npm run build` for the build gate. Never run `next build` while `next dev` is alive — it corrupts `.next/`.

---

### Task 1: Login contact line

Standalone, touches nothing else. Ship it first.

**Files:**
- Modify: `app/login/page.tsx:144-148`

**Interfaces:**
- Consumes: nothing
- Produces: nothing

- [ ] **Step 1: Replace the anchor with plain text**

Current:

```tsx
        <p className="text-center text-footnote text-[var(--fg-muted)]">
          Masalah log masuk?{" "}
          <a href="tel:+60312345678" className="text-[var(--primary)] font-medium hover:underline">
            Hubungi Unit Aset
          </a>
        </p>
```

Replace with:

```tsx
        <p className="text-center text-footnote text-[var(--fg-muted)]">
          Masalah log masuk? Hubungi Unit Aset 09-6971200 (sambungan 1118)
        </p>
```

The `tel:` link and its accent styling both go — the whole line is one uniform muted string. This also removes the placeholder `+60312345678`, which is a Kuala Lumpur number that would have dialled a stranger.

- [ ] **Step 2: Verify types and build**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

No unit test. This is static copy with no branch or logic in it; a render assertion here would only restate the string.

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "fix(login): show Unit Aset phone number as plain text

The tel: link pointed at +60312345678 — a placeholder KL landline, not
Hospital Besut. Replaced the anchor with the real number and extension
as plain text."
```

---

### Task 2: Controlled mode for Modal

`Modal` is trigger-only today: `Dialog.Root` is uncontrolled and `trigger` is required. Task 3 needs a modal that opens after a network call, when there is no trigger to click. Add optional controlled props; leave the trigger path exactly as it is.

**Files:**
- Modify: `components/ui/modal.tsx`
- Test: `components/ui/modal.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `Modal` accepting `trigger?: ReactNode`, `open?: boolean`, `onOpenChange?: (open: boolean) => void`. Passing `open` puts it in controlled mode. Existing call sites that pass only `trigger` are unaffected.

- [ ] **Step 1: Write the failing test**

Append to `components/ui/modal.test.tsx`:

```tsx
  it("opens without a trigger when controlled open is true", () => {
    render(
      <Modal open title="Berjaya">
        <p>Kandungan</p>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Berjaya")).toBeInTheDocument();
  });

  it("stays closed when controlled open is false", () => {
    render(
      <Modal open={false} title="Berjaya">
        <p>Kandungan</p>
      </Modal>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onOpenChange(false) when the close button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <Modal open onOpenChange={onOpenChange} title="Berjaya">
        <p>Kandungan</p>
      </Modal>
    );
    fireEvent.click(screen.getByRole("button", { name: /tutup/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
```

Add `vi` to the vitest import at the top of the file:

```tsx
import { describe, it, expect, vi } from "vitest";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/ui/modal.test.tsx`
Expected: FAIL — the three new tests error because `Modal` does not accept `open`, so `Dialog.Root` stays uncontrolled and renders no dialog.

- [ ] **Step 3: Implement controlled mode**

In `components/ui/modal.tsx`, change the props interface and the two lines that use them:

```tsx
interface ModalProps {
  /** Omit when using controlled `open` — a programmatic modal has nothing to click. */
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Modal({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
```

The rest of the component is unchanged. Radix treats `open={undefined}` as uncontrolled, so the existing trigger-only call sites keep working with no edit.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/ui/modal.test.tsx`
Expected: PASS — all six tests, the three original ones included.

- [ ] **Step 5: Commit**

```bash
git add components/ui/modal.tsx components/ui/modal.test.tsx
git commit -m "feat(ui): let Modal be controlled without a trigger

Needed for modals opened by code after a network call, where there is
no element to click. Uncontrolled trigger usage is unchanged."
```

---

### Task 3: Submit confirmation modal

Replaces the success toast at `app/(protected)/mohon/page.tsx:188`. The toast fires in the same tick as `router.push("/status")`, so a two-sentence SLA message would flash and vanish.

**Files:**
- Modify: `app/(protected)/mohon/page.tsx`

**Interfaces:**
- Consumes: `Modal` with `open` / `onOpenChange` from Task 2
- Produces: nothing

- [ ] **Step 1: Add the confirmation state**

Near the other `useState` declarations at the top of the component:

```tsx
  // Set when submission succeeds. Holds the ticket number so the modal can
  // show it; null means the modal is closed.
  const [submittedTicketNo, setSubmittedTicketNo] = useState<string | null>(null);
```

- [ ] **Step 2: Replace the toast and move the redirect**

At `app/(protected)/mohon/page.tsx:188-190`, currently **three** lines:

```tsx
      toast.success(`Permohonan ${ticket.ticket_no} berjaya dihantar!`);
      router.push("/status");
      router.refresh();
```

Replace all three with:

```tsx
      setSubmittedTicketNo(ticket.ticket_no);
```

`router.refresh()` must move too, not just `push` — leaving it behind would refetch the current page's server components while the modal is open. Both calls now run on dismissal, so the applicant cannot navigate past the SLA without acknowledging it.

Leave the two partial-failure toasts at `:166` and `:184` alone. The ticket did submit; those warn about an attachment and are not the confirmation.

- [ ] **Step 3: Render the modal**

The component's JSX root is `<div className="space-y-6 animate-in">`, wrapping a `<header>` and the form card. Add the modal as the **last child of that root div**, immediately before its closing `</div>`. Radix portals the content to `document.body` and `Dialog.Root` renders nothing itself while closed, so it contributes no layout to the `space-y-6` stack.

First add a single dismissal handler beside the other functions, so OK, the X and Escape cannot drift apart:

```tsx
  // Any dismissal — OK, the X, or Escape — means the applicant has seen it.
  // Only ever go forward. Mirrors the push+refresh pair the submit path used
  // to run inline.
  function leaveToStatus() {
    router.push("/status");
    router.refresh();
  }
```

Then the modal:

```tsx
      <Modal
        open={submittedTicketNo !== null}
        onOpenChange={(next) => {
          if (!next) leaveToStatus();
        }}
        title="Permohonan Berjaya Dihantar"
      >
        <div className="space-y-4">
          <p className="text-subhead text-[var(--fg)]">
            Permohonan anda telah berjaya dihantar.
          </p>
          <p className="text-subhead text-[var(--fg)]">
            Semakan permohonan akan dibuat dalam tiga (3) hari bekerja.
          </p>
          <p className="text-footnote text-[var(--fg-muted)]">
            No. Rujukan: <span className="font-semibold text-[var(--fg)]">{submittedTicketNo}</span>
          </p>
          <Button className="w-full" onClick={leaveToStatus}>
            OK
          </Button>
        </div>
      </Modal>
```

Add the import — `Modal` is **not** currently imported in this file (`useState`, `useRouter`, `Button` and `toast` all are):

```tsx
import { Modal } from "@/components/ui/modal";
```

- [ ] **Step 4: Verify types and build**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run`
Expected: PASS, no regressions. `mohon/page.tsx` has no test file of its own; this step is guarding the rest of the suite.

- [ ] **Step 5: Manual check**

Start dev (`npm run dev`), submit a request as a pemohon. Expected: the modal blocks the page, shows both sentences and the ticket number, and only reaches `/status` after OK, the X, or Escape.

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/mohon/page.tsx"
git commit -m "feat(mohon): confirm submission in a modal with the review SLA

The success toast fired in the same tick as the redirect, so a two-line
message would not have been read. The modal holds the page until the
applicant acknowledges it, and carries the three-working-day SLA."
```

---

### Task 4: `blockOnDelete` guard

Pure logic, no I/O. Mirrors the existing `blockOnDeactivate` but with its own messages — "you cannot delete your own account" and "you cannot deactivate your own account" are different sentences and both get shown to admins.

**Files:**
- Modify: `lib/users.ts`
- Test: `lib/users.test.ts`

**Interfaces:**
- Consumes: `Profile` from `lib/supabase/types`
- Produces:
  - `type DeleteBlock = "self" | "last_admin"`
  - `const DELETE_BLOCK_MESSAGE: Record<DeleteBlock, string>`
  - `function blockOnDelete(targetId: string, currentUserId: string, profiles: Profile[]): DeleteBlock | null`

- [ ] **Step 1: Write the failing test**

Append to `lib/users.test.ts` (the `profile()` helper and the `ADMIN_A` / `ADMIN_B` / `STAFF` / `USER` fixtures already exist at the top of that file — reuse them, do not redefine them):

```ts
describe("blockOnDelete", () => {
  it("allows deleting an ordinary user", () => {
    expect(blockOnDelete("u", "a", [ADMIN_A, USER])).toBeNull();
  });

  it("allows deleting asset staff", () => {
    expect(blockOnDelete("s", "a", [ADMIN_A, STAFF])).toBeNull();
  });

  it("refuses self-deletion", () => {
    expect(blockOnDelete("a", "a", [ADMIN_A, ADMIN_B])).toBe("self");
  });

  it("refuses deleting the last active admin", () => {
    expect(blockOnDelete("b", "a", [ADMIN_A, ADMIN_B])).toBeNull();
    expect(blockOnDelete("b", "u", [ADMIN_B, USER])).toBe("last_admin");
  });

  it("does not count an inactive admin as cover", () => {
    const inactiveAdmin = profile({ id: "c", role: "admin", is_active: false });
    expect(blockOnDelete("b", "u", [ADMIN_B, inactiveAdmin, USER])).toBe("last_admin");
  });

  it("allows deleting an already-inactive admin when another active admin exists", () => {
    const inactiveAdmin = profile({ id: "c", role: "admin", is_active: false });
    expect(blockOnDelete("c", "a", [ADMIN_A, inactiveAdmin])).toBeNull();
  });

  it("has a distinct message for each block reason", () => {
    expect(DELETE_BLOCK_MESSAGE.self).not.toBe(DELETE_BLOCK_MESSAGE.last_admin);
    expect(DELETE_BLOCK_MESSAGE.self).toMatch(/padam/i);
  });
});
```

Extend the import at the top of the file:

```ts
import {
  blockOnDeactivate,
  DEACTIVATE_BLOCK_MESSAGE,
  blockOnDelete,
  DELETE_BLOCK_MESSAGE,
} from "./users";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/users.test.ts`
Expected: FAIL — `blockOnDelete is not a function`.

- [ ] **Step 3: Implement**

Append to `lib/users.ts`:

```ts
export type DeleteBlock = "self" | "last_admin";

export const DELETE_BLOCK_MESSAGE: Record<DeleteBlock, string> = {
  self: "Anda tidak boleh memadam akaun sendiri.",
  last_admin: "Sekurang-kurangnya seorang pentadbir aktif diperlukan.",
};

/**
 * Why this deletion must be refused, or null if it is allowed.
 *
 * Deleting is strictly more destructive than deactivating, so anything that
 * blocks a deactivation blocks a delete too. Kept as its own function rather
 * than an alias because the messages differ and the rules may diverge.
 */
export function blockOnDelete(
  targetId: string,
  currentUserId: string,
  profiles: Profile[],
): DeleteBlock | null {
  if (targetId === currentUserId) return "self";

  const target = profiles.find((p) => p.id === targetId);
  if (!target) return null;

  if (target.role === "admin" && target.is_active) {
    const otherActiveAdmins = profiles.filter(
      (p) => p.id !== targetId && p.role === "admin" && p.is_active,
    );
    if (otherActiveAdmins.length === 0) return "last_admin";
  }

  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/users.test.ts`
Expected: PASS — the new `blockOnDelete` block and the existing `blockOnDeactivate` block.

- [ ] **Step 5: Commit**

```bash
git add lib/users.ts lib/users.test.ts
git commit -m "feat(users): add blockOnDelete guard

Same two rules as blockOnDeactivate — no self-delete, never remove the
last active admin — with its own messages, since both are shown to
admins and 'padam' and 'nyahaktif' are different actions."
```

---

### Task 5: Migration 008 — relax the delete constraints

**This task writes a file. It does not apply it.** Anas applies migrations in the Supabase SQL Editor; this environment has no DDL access.

Read the spec's "Task 2" section before starting — the `IS DISTINCT FROM` change in step 3 is not cosmetic, and skipping it opens a privilege escalation.

**Files:**
- Create: `supabase/migrations/008_hard_delete_users.sql`

**Interfaces:**
- Consumes: schema from `001_initial_schema.sql`, functions from `002_security_boundary.sql` and `007_user_active_status.sql`
- Produces: `disposal_tickets.created_by` and `audit_logs.performed_by` become nullable with `ON DELETE SET NULL`

- [ ] **Step 1: Read the three affected functions in full**

**Three** functions gate on the ticket owner, not one. Each is defined in several migrations; only the **latest definition of each** is live, and that is the one to copy:

| Function | Current definition | Guard | Line |
|---|---|---|---|
| `public.resubmit_disposal_ticket` | **007** (also in 002, 004, 005) | `v_ticket.created_by <> v_actor` | `007:208` |
| `public.attach_disposal_photo` | **003** (only there) | `v_ticket.created_by = v_actor` | `003:248` |
| `public.attach_disposal_borang_ca` | **005** (only there) | `v_ticket.created_by = v_actor` | `005:290` |

Run:

```bash
sed -n '171,260p' supabase/migrations/007_user_active_status.sql   # resubmit_disposal_ticket
sed -n '204,300p' supabase/migrations/003_storage_authorization.sql # attach_disposal_photo
sed -n '250,340p' supabase/migrations/005_form_field_changes.sql    # attach_disposal_borang_ca
```

You are about to re-declare all three with `CREATE OR REPLACE`. Copy each body **verbatim** and change only the one comparison named in step 3. Do not merge definitions, and do not copy from an older migration that happens to define the same name.

`public.attach_disposal_certificate` (current definition in 003) is **not** affected — it gates on `current_user_is_asset_staff()` only and never compares `created_by`. Leave it alone.

- [ ] **Step 2: Write the constraint changes**

Create `supabase/migrations/008_hard_delete_users.sql`:

```sql
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
-- hospital's disposal records. The rows survive; only the actor identity
-- is dropped, and the UI already renders a missing actor as "—".

BEGIN;

-- disposal_tickets.created_by
ALTER TABLE public.disposal_tickets
    ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.disposal_tickets
    DROP CONSTRAINT IF EXISTS disposal_tickets_created_by_fkey;

ALTER TABLE public.disposal_tickets
    ADD CONSTRAINT disposal_tickets_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id) ON DELETE SET NULL;

-- audit_logs.performed_by
ALTER TABLE public.audit_logs
    ALTER COLUMN performed_by DROP NOT NULL;

ALTER TABLE public.audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_performed_by_fkey;

ALTER TABLE public.audit_logs
    ADD CONSTRAINT audit_logs_performed_by_fkey
    FOREIGN KEY (performed_by) REFERENCES public.profiles (id) ON DELETE SET NULL;

COMMIT;
```

Verify the two constraint names against the live schema before relying on `DROP CONSTRAINT IF EXISTS` — PostgreSQL's default is `<table>_<column>_fkey`, which is what 001 will have produced since it declared them inline without names. If a name differs, `IF EXISTS` will silently skip the drop and the `ADD` will fail on a duplicate, which is a loud failure rather than a silent one.

- [ ] **Step 3: Fix the three ownership guards in the same migration**

Append to the same file, as a second `BEGIN/COMMIT` block below the constraint changes, starting with this comment:

```sql
-- Once created_by is nullable, every comparison against it can evaluate to
-- NULL for an orphaned ticket — and NULL is not TRUE, so guards written to
-- RAISE stop raising. All three of these fail OPEN, not closed:
--
--   resubmit_disposal_ticket   IF created_by <> v_actor THEN RAISE
--       NULL <> actor -> NULL -> no raise -> anyone resubmits the ticket.
--
--   attach_disposal_photo      IF NOT (staff OR (created_by = v_actor AND ...))
--   attach_disposal_borang_ca  IF NOT (staff OR (created_by = v_actor AND ...))
--       NULL = actor -> NULL; FALSE OR NULL -> NULL; NOT NULL -> NULL
--       -> no raise -> any authenticated non-staff user attaches files.
--
-- The IS [NOT] DISTINCT FROM forms treat NULL as a value, so an orphaned
-- ticket fails the ownership test for everyone. That is the correct answer
-- once its owner is gone.
```

**Change 1** — in `public.resubmit_disposal_ticket` (body copied from `007`):

```sql
    IF v_ticket.created_by IS DISTINCT FROM v_actor THEN
```

replacing `IF v_ticket.created_by <> v_actor THEN`.

**Change 2** — in `public.attach_disposal_photo` (body copied from `003`):

```sql
            v_ticket.created_by IS NOT DISTINCT FROM v_actor
```

replacing `v_ticket.created_by = v_actor`.

**Change 3** — in `public.attach_disposal_borang_ca` (body copied from `005`):

```sql
            v_ticket.created_by IS NOT DISTINCT FROM v_actor
```

replacing `v_ticket.created_by = v_actor`.

Note the two different operators. `resubmit` uses a `<>` deny-guard, so it needs `IS DISTINCT FROM`. The two attach functions use `=` inside a negated allow-clause, so they need `IS NOT DISTINCT FROM`. Using the same operator in all three places gets one of them backwards and inverts the permission.

Everything else in all three bodies is copied unchanged from step 1.

- [ ] **Step 4: Check the file is self-consistent**

Run:

```bash
grep -c "CREATE OR REPLACE FUNCTION" supabase/migrations/008_hard_delete_users.sql
```

Expected: `3`.

Run:

```bash
grep -c "IS DISTINCT FROM" supabase/migrations/008_hard_delete_users.sql
```

Expected: `3` — one per function. This counts `IS NOT DISTINCT FROM` too, since it contains the substring.

Run:

```bash
grep -c "IS NOT DISTINCT FROM" supabase/migrations/008_hard_delete_users.sql
```

Expected: `2` — the two attach functions only. A `3` means the resubmit guard was inverted and now refuses the legitimate owner; a `1` means one attach function still fails open.

Run:

```bash
grep -nE "created_by *(<>|=) *v_actor" supabase/migrations/008_hard_delete_users.sql
```

Expected: no output. Any match is a guard that was copied but not fixed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/008_hard_delete_users.sql
git commit -m "feat(db): migration 008 — allow hard-deleting users

Relaxes disposal_tickets.created_by and audit_logs.performed_by from
ON DELETE RESTRICT to SET NULL so a user row can be removed while the
disposal records survive.

Also makes three ownership guards null-safe. Once created_by is
nullable they all fail OPEN, because a comparison against NULL yields
NULL and NULL is not TRUE, so the RAISE never fires:

  resubmit_disposal_ticket  -> anyone could resubmit an orphaned ticket
  attach_disposal_photo     -> any non-staff user could attach a photo
  attach_disposal_borang_ca -> same, for Borang CA

NOT APPLIED — Anas runs this in the Supabase SQL Editor."
```

- [ ] **Step 6: Report, do not assume**

State plainly in the handoff that 008 is written and **unapplied**, and that Tasks 6 and 7 cannot be verified end-to-end until it has run. Do not describe hard delete as working before then.

Hand over this post-apply checklist with it. Items 1–3 catch a guard that was missed and still fails open; item 4 catches a guard whose operator was inverted, which locks out the legitimate owner and would otherwise look like an unrelated bug days later.

1. As an ordinary pemohon, resubmit a rejected ticket whose owner was deleted → **refused**.
2. As an ordinary pemohon, attach a photo to an orphaned ticket → **refused**.
3. As an ordinary pemohon, attach a Borang CA to an orphaned ticket → **refused**.
4. As the real owner, resubmit your own rejected ticket and attach a photo and a Borang CA to it → **all still succeed**.

---

### Task 6: `DELETE /api/users/[id]`

**Files:**
- Modify: `app/api/users/[id]/route.ts`
- Modify: `lib/supabase/types.ts:45,60`

**Interfaces:**
- Consumes: `blockOnDelete`, `DELETE_BLOCK_MESSAGE` from Task 4
- Produces: `DELETE /api/users/:id` → `200 {success:true}` · `401 {error}` · `403 {error}` · `400 {error}` · `500 {error}`

- [ ] **Step 1: Widen the nullable column types**

In `lib/supabase/types.ts`, line 45 and line 60:

```ts
  created_by: string | null;
```

```ts
  performed_by: string | null;
```

- [ ] **Step 2: Check what that breaks**

Run: `npx tsc --noEmit`

Expected: errors only where a consumer assumes non-null. The two dashboard call sites already end in `?? "—"` (`lib/dashboard/unit-aset.ts:296,305` and `lib/dashboard/pemohon.ts:362`) and should pass. If `Map.get()` complains about a `string | null` key, narrow at the call site rather than casting:

```ts
    actor_name: (a.performed_by && nameById.get(a.performed_by)) ?? "—",
```

Fix every reported error before moving on. A cast that silences `tsc` here reintroduces exactly the crash the migration makes possible.

- [ ] **Step 3: Add the DELETE handler**

Append to `app/api/users/[id]/route.ts`. Extend the existing `lib/users` import:

```ts
import {
  blockOnDeactivate,
  DEACTIVATE_BLOCK_MESSAGE,
  blockOnDelete,
  DELETE_BLOCK_MESSAGE,
} from "@/lib/users";
```

Then:

```ts
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetId } = await params;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json(
      { error: "Ralat konfigurasi pelayan." },
      { status: 500 },
    );
  }

  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user: caller },
  } = await supabaseAuth.auth.getUser();

  if (!caller) {
    return NextResponse.json({ error: "Sesi tamat." }, { status: 401 });
  }

  const { data: callerProfile } = await supabaseAuth
    .from("profiles")
    .select("role, is_active")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
    return NextResponse.json(
      { error: "Hanya pentadbir boleh memadam pengguna." },
      { status: 403 },
    );
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Re-run the guards against CURRENT rows, exactly as PATCH does. The
  // browser's list can be minutes old and this is the only check that can
  // actually keep the last admin alive.
  const { data: allProfiles, error: listError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, is_active");

  if (listError || !allProfiles) {
    return NextResponse.json(
      { error: "Gagal mengesahkan status pentadbir." },
      { status: 500 },
    );
  }

  const block = blockOnDelete(targetId, caller.id, allProfiles as Profile[]);
  if (block) {
    return NextResponse.json(
      { error: DELETE_BLOCK_MESSAGE[block] },
      { status: 400 },
    );
  }

  // Deleting the auth user cascades into profiles, and (with migration 008)
  // nulls out created_by / performed_by instead of being blocked by them.
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);

  if (deleteError) {
    console.error("User delete error:", deleteError.message);
    // Surface the real reason. A surviving foreign key means 008 has not been
    // applied, and "something went wrong" would send the admin hunting.
    return NextResponse.json(
      { error: `Gagal memadam pengguna: ${deleteError.message}` },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run`
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add "app/api/users/[id]/route.ts" lib/supabase/types.ts
git commit -m "feat(api): DELETE /api/users/[id] for hard user deletion

Mirrors PATCH's auth order and re-checks the guards against fresh rows.
Surfaces the Supabase error verbatim on failure so an unapplied
migration 008 shows up as the foreign key it is.

created_by and performed_by widen to string | null, which migration 008
makes possible."
```

---

### Task 7: Delete button and confirmation in the user form

**Files:**
- Modify: `app/(protected)/pengguna/page.tsx`

**Interfaces:**
- Consumes: `Modal` (Task 2), `blockOnDelete` / `DELETE_BLOCK_MESSAGE` (Task 4), `DELETE /api/users/:id` (Task 6)
- Produces: nothing

- [ ] **Step 1: Add imports and state**

Extend the existing imports:

```tsx
import { Users, UserPlus, Building, Mail, X, Eye, EyeOff, Lock, Trash2 } from "lucide-react";
import { blockOnDeactivate, DEACTIVATE_BLOCK_MESSAGE, blockOnDelete, DELETE_BLOCK_MESSAGE } from "@/lib/users";
import { Modal } from "@/components/ui/modal";
```

Add beside the other state:

```tsx
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
```

Reset both in `resetForm()`:

```tsx
    setConfirmingDelete(false);
    setDeleting(false);
```

- [ ] **Step 2: Add the delete handler**

```tsx
  async function handleDelete() {
    if (!editingId) return;

    // Fail fast on a guard the server will refuse anyway, so the admin gets
    // the reason immediately instead of a round trip. Same pattern as the
    // deactivate path above.
    if (currentUserId) {
      const block = blockOnDelete(editingId, currentUserId, profiles);
      if (block) {
        toast.error(DELETE_BLOCK_MESSAGE[block]);
        setConfirmingDelete(false);
        return;
      }
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${editingId}`, { method: "DELETE" });
      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Gagal memadam pengguna. Cuba semula.");
        return;
      }

      toast.success(`${fullName.trim()} telah dipadam.`);
      setConfirmingDelete(false);
      closeForm();
      await loadProfiles();
    } catch {
      toast.error("Ralat tidak dijangka. Sila cuba semula.");
    } finally {
      setDeleting(false);
    }
  }
```

- [ ] **Step 3: Add the button and confirmation modal**

In the actions row at the bottom of the form — currently Simpan/Batal — add a delete button that only exists while editing. Replace the actions block with:

```tsx
            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-[var(--border)]">
              <Button type="submit" loading={submitting} className="flex-1">
                {editingId ? "Simpan Perubahan" : "Daftar Pengguna"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeForm}>
                Batal
              </Button>
            </div>

            {/* Destructive actions live below the divider, away from Simpan. */}
            {editingId && (
              <div className="pt-4 border-t border-[var(--border)]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(true)}
                  className="gap-2 text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                >
                  <Trash2 size={16} />
                  Padam Pengguna
                </Button>
                <p className="text-footnote text-[var(--fg-muted)] mt-1.5">
                  Tindakan ini kekal. Untuk menyekat log masuk sahaja, tetapkan status kepada Tidak Aktif.
                </p>
              </div>
            )}
```

Then, outside the `<form>` but inside the page wrapper:

```tsx
      <Modal
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Padam Pengguna?"
        description="Tindakan ini tidak boleh dibatalkan."
      >
        <div className="space-y-4">
          <p className="text-subhead text-[var(--fg)]">
            Akaun <span className="font-semibold">{fullName}</span> ({email}) akan dipadam kekal.
            Permohonan dan rekod audit yang pernah dibuat akan kekal, tetapi tanpa nama pemohon.
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              loading={deleting}
              onClick={handleDelete}
              className="flex-1 bg-[var(--destructive)] hover:opacity-90 border-none text-white"
            >
              Ya, Padam
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirmingDelete(false)}>
              Batal
            </Button>
          </div>
        </div>
      </Modal>
```

`window.confirm` is deliberately not used: it is unstyled, cannot be translated, and blocks the event loop.

- [ ] **Step 4: Verify types and suite**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Manual check — requires migration 008 applied**

If 008 has not been applied, stop and say so rather than reporting this task verified.

1. Delete a user with **no** tickets → succeeds.
2. Delete a user **with** tickets → succeeds; their tickets remain in `/semua` with `—` as the requester.
3. Try to delete yourself → refused with "Anda tidak boleh memadam akaun sendiri."
4. Try to delete the only active admin from another admin account → refused.

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/pengguna/page.tsx"
git commit -m "feat(pengguna): admin can hard-delete a user

Delete sits below its own divider, away from Simpan, with a modal
confirmation naming the account. Guards run client-side for instant
feedback and again server-side against fresh rows."
```

---

### Task 8: Password reset — API

Extends `PATCH`; no new route. The field is optional so the existing edit flow is untouched.

**Files:**
- Modify: `app/api/users/[id]/route.ts` (the `PATCH` handler)

**Interfaces:**
- Consumes: `isValidPassword`, `PASSWORD_ERROR` from `lib/password`
- Produces: `PATCH /api/users/:id` accepts optional `password?: string`

- [ ] **Step 1: Import the policy**

```ts
import { isValidPassword, PASSWORD_ERROR } from "@/lib/password";
```

- [ ] **Step 2: Destructure and validate**

Change the destructuring line in `PATCH`:

```ts
  const { full_name, role, unit_name, is_active, password } = body;
```

After the existing `is_active` boolean check, add:

```ts
  // Optional: absent or empty means "not changing it", so the ordinary edit
  // flow is unaffected. Present means it must clear the same bar as
  // registration — a reset must not be a back door to a weaker password.
  const newPassword = typeof password === "string" && password.length > 0 ? password : null;

  if (newPassword && !isValidPassword(newPassword)) {
    return NextResponse.json({ error: PASSWORD_ERROR }, { status: 400 });
  }
```

- [ ] **Step 3: Apply the password between the profile update and the ban call**

Insert after the profile-update block (the one ending in the `updateError` check) and **before** the `ban_duration` call:

```ts
  // Ordering: profile first, password second, ban last. Each step reports its
  // own partial failure rather than letting a later success paper over it.
  if (newPassword) {
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      targetId,
      { password: newPassword },
    );

    if (passwordError) {
      console.error("Password reset error:", passwordError.message);
      return NextResponse.json(
        {
          error:
            "Profil dikemaskini, tetapi kata laluan gagal ditetapkan semula. Sila cuba semula.",
        },
        { status: 502 },
      );
    }
  }
```

- [ ] **Step 4: Verify types and suite**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/users/[id]/route.ts"
git commit -m "feat(api): admins can reset a user password via PATCH

Optional password field, validated against the same isValidPassword
policy as registration. Applied after the profile write and before the
ban call, reporting a partial failure as partial."
```

---

### Task 9: Password reset — UI

**Files:**
- Modify: `app/(protected)/pengguna/page.tsx`

**Interfaces:**
- Consumes: `PATCH /api/users/:id` with `password` (Task 8), `PasswordChecklist`, `isValidPassword` / `PASSWORD_ERROR`
- Produces: nothing

- [ ] **Step 1: Add state for the reveal**

```tsx
  // Collapsed by default so a routine name-or-role edit never looks like it
  // is about to change someone's password.
  const [resettingPassword, setResettingPassword] = useState(false);
```

Reset it in `resetForm()`:

```tsx
    setResettingPassword(false);
```

- [ ] **Step 2: Validate on submit when editing**

In `handleSubmit`, the current block validates password only at creation:

```tsx
    if (!editingId) {
      if (!isMohEmail(cleanEmail)) { ... }
      if (!isValidPassword(password)) {
        toast.error(PASSWORD_ERROR);
        return;
      }
    }
```

Add after it:

```tsx
    if (editingId && resettingPassword && !isValidPassword(password)) {
      toast.error(PASSWORD_ERROR);
      return;
    }
```

- [ ] **Step 3: Send the password on edit**

In the `PATCH` branch of the fetch, extend the body:

```tsx
        ? await fetch(`/api/users/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              full_name: fullName.trim(),
              role,
              unit_name: unitName.trim() || null,
              is_active: isActive,
              // Omitted unless the admin opened the reset control, so an
              // ordinary edit cannot change a password by accident.
              ...(resettingPassword && password ? { password } : {}),
            }),
          })
```

- [ ] **Step 4: Render the reset control**

The password field currently renders only for creation: `{!editingId && ( ... )}`. Add a sibling block for the edit case:

```tsx
              {editingId && (
                <div>
                  {!resettingPassword ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-subhead font-medium text-[var(--fg)]">
                        Kata Laluan
                      </label>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setResettingPassword(true)}
                        className="gap-2 justify-start"
                      >
                        <Lock size={16} />
                        Tetapkan Semula Kata Laluan
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Input
                        label="Kata Laluan Baharu"
                        required
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Kata laluan sementara"
                        minLength={PASSWORD_MIN_LENGTH}
                        helper="Beritahu pengguna secara peribadi — tiada e-mel dihantar."
                        trailing={
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? "Sembunyikan kata laluan" : "Tunjukkan kata laluan"}
                            className="inline-flex items-center justify-center h-10 w-10 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--primary-tint)] transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        }
                      />
                      <PasswordChecklist password={password} />
                      <button
                        type="button"
                        onClick={() => {
                          setResettingPassword(false);
                          setPassword("");
                        }}
                        className="text-footnote text-[var(--fg-muted)] hover:text-[var(--fg)] mt-1.5 underline"
                      >
                        Batal tetapan semula
                      </button>
                    </>
                  )}
                </div>
              )}
```

The helper text states plainly that no email is sent — the project has no SMTP, which is why onboarding is admin-provisioned in the first place.

- [ ] **Step 5: Verify types and suite**

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Manual check**

1. Edit a user without touching the reset control → save → password still works. This is the regression that matters.
2. Open the reset control, enter a weak password → refused with `PASSWORD_ERROR`, no request sent.
3. Enter a valid password → save → log in as that user with the new password.

- [ ] **Step 7: Commit**

```bash
git add "app/(protected)/pengguna/page.tsx"
git commit -m "feat(pengguna): admin can reset a user's password

Collapsed behind an explicit control so a routine edit cannot change a
password by accident, and the field is only sent when opened. Reuses
the registration checklist and policy."
```

---

## Final gate

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → all pass, count ≥ 156 + the new tests
- [ ] `npm run build` → clean. **Stop `next dev` first** — building while dev is alive corrupts `.next/` and has bitten this repo twice.
- [ ] Migration 008 handed to Anas, and its applied/unapplied status stated explicitly
- [ ] The 8 `.omx/` deletions are still uncommitted and untouched

## Notes for the executor

- **Tasks 1–4 and 8–9 are verifiable here. Tasks 6 and 7 are not**, until migration 008 has been applied by Anas. Report them as written-but-unverified rather than done.
- The spec's risk table records that the audit-trail concern on migration 008 was raised and overruled. It is settled — do not reopen it.
- If `tsc` complains after widening `created_by` / `performed_by` to nullable, fix the consumer. Do not cast the error away; the cast reintroduces exactly the crash the migration makes possible.
