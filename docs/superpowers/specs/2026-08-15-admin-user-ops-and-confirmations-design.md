# Admin User Operations + Submit Confirmation — Design

**Date:** 2026-08-15
**Branch:** `feat/admin-user-ops-and-confirmations` (off `master` @ `c63cdfd`)
**Scope:** 4 tasks — 1 frontend, 3 backend-and-frontend.

---

## Summary

Four independent changes to i-SMARTLUPUS MEDI:

| # | Task | Surface | Migration |
|---|------|---------|-----------|
| 1 | Login contact line becomes plain text with the real number | FE only | no |
| 2 | Admin can hard-delete a user | API + FE + DB | **yes — 008** |
| 3 | Admin can reset a user's password | API + FE | no |
| 4 | Submit confirmation shows the 3-working-day SLA | FE only | no |

Tasks 1, 3 and 4 are additive and low-risk. **Task 2 is the one with teeth** — it changes two
foreign-key constraints that the original schema deliberately set to `RESTRICT`.

---

## Audit — what already exists

Established by reading `origin/master` @ `c63cdfd`, not from memory.

**Login contact line** — `app/login/page.tsx:144-148`:

```tsx
<p className="text-center text-footnote text-[var(--fg-muted)]">
  Masalah log masuk?{" "}
  <a href="tel:+60312345678" className="text-[var(--primary)] font-medium hover:underline">
    Hubungi Unit Aset
  </a>
</p>
```

The number is a placeholder — `+60312345678` is a Kuala Lumpur landline, not Hospital Besut.

**User management** — `app/(protected)/pengguna/page.tsx` is one page handling both create and
edit. `app/api/register/route.ts` creates; `app/api/users/[id]/route.ts` exposes `PATCH` only.
There is **no `DELETE` handler** anywhere in the app. Deactivation already exists and is
thorough: `is_active` on the profile gates RLS, and the auth account is banned with
`ban_duration` so a live session cannot refresh its token.

**Password reset** — **does not exist.** No reset, recovery, or forgot-password flow in the
repo. A password is settable only at creation, gated behind `!editingId` in the form. The
building blocks are all present and already used on this exact page:
`isValidPassword` / `PASSWORD_ERROR` / `PASSWORD_MIN_LENGTH` (`lib/password.ts`),
`<PasswordChecklist>` (`components/ui/password-checklist.tsx`), and
`supabaseAdmin.auth.admin.updateUserById` — already called at `app/api/users/[id]/route.ts:146`
to set `ban_duration`. A password reset is that same call with a different argument.

**Submit confirmation** — **it already exists**, as a toast. `app/(protected)/mohon/page.tsx:188`:

```ts
toast.success(`Permohonan ${ticket.ticket_no} berjaya dihantar!`);
router.push("/status");
```

The toast fires and the route changes in the same tick.

---

## Task 1 — Login contact line

Replace the anchor with plain text carrying the real number and extension:

> Masalah log masuk? Hubungi Unit Aset 09-6971200 (sambungan 1118)

"All make it text" is read as: no `<a>`, no `tel:` link, no link styling — one uniform muted
line. This also removes the placeholder KL number, which would otherwise dial a stranger.

**Files:** `app/login/page.tsx`.

---

## Task 2 — Hard delete a user

### The constraint that makes this non-trivial

`supabase/migrations/001_initial_schema.sql`:

| FK | Current behaviour |
|---|---|
| `profiles.id` → `auth.users(id)` | `ON DELETE CASCADE` |
| `disposal_tickets.created_by` → `profiles(id)` | `NOT NULL` **`ON DELETE RESTRICT`** |
| `disposal_tickets.reviewed_by` → `profiles(id)` | `ON DELETE SET NULL` |
| `disposal_tickets.completed_by` → `profiles(id)` | `ON DELETE SET NULL` |
| `audit_logs.performed_by` → `profiles(id)` | `NOT NULL` **`ON DELETE RESTRICT`** |

Deleting the auth user cascades into `profiles`, and that cascade is then **blocked** by the two
`RESTRICT`s. So today a hard delete succeeds only for a user who has never submitted a ticket
and never performed an audited action — which is to say, almost nobody.

### Decision

**Anas's call, 2026-08-15: force it — migration to break the RESTRICTs.** The concern that this
weakens an audit trail was raised and overruled. Recorded here so the reasoning is not
re-litigated later.

### `SET NULL`, not `CASCADE`

Within "force it" there are two ways to break a `RESTRICT`, and they are not close:

- **`CASCADE`** — deleting a user also deletes every disposal ticket they created, and (via
  `audit_logs.ticket_id ON DELETE CASCADE`) every audit row attached to those tickets. Deleting
  one pemohon would erase the hospital's record of the assets they disposed of.
- **`SET NULL`** — the ticket and audit rows survive; only the actor's identity is dropped.

This design takes **`SET NULL`**. "Hard delete the user" is not the same instruction as "delete
the hospital's disposal records", and nothing in the request asked for the latter. Both columns
are `NOT NULL` today, so the migration must drop `NOT NULL` before it can set null on delete.

### The guards that `SET NULL` silently breaks

**Three** PL/pgSQL functions gate on the ticket owner, and once `created_by` can be `NULL` all
three **fail open**. A comparison against `NULL` yields `NULL`; `NULL` is not `TRUE`; so the
`RAISE` never executes and the operation is permitted.

| Function | Current definition | Guard as written | Effect on an orphaned ticket |
|---|---|---|---|
| `resubmit_disposal_ticket` | `007:208` | `IF created_by <> v_actor THEN RAISE` | `NULL <> actor` → `NULL` → no raise. **Anyone can resubmit it.** |
| `attach_disposal_photo` | `003:248` | `IF NOT (staff OR (created_by = v_actor AND …)) THEN RAISE` | `NULL = actor` → `NULL`; `FALSE OR NULL` → `NULL`; `NOT NULL` → `NULL` → no raise. **Any non-staff user can attach a photo.** |
| `attach_disposal_borang_ca` | `005:290` | same shape as above | same. **Any non-staff user can attach a Borang CA.** |

This is a privilege escalation created by the migration, not by the delete feature. It must land
in the same migration, not as a follow-up.

The fix uses **two different operators**, because the guards have opposite polarity:

```sql
-- resubmit_disposal_ticket — a <> deny-guard
IF v_ticket.created_by IS DISTINCT FROM v_actor THEN

-- attach_disposal_photo and attach_disposal_borang_ca — an = allow-clause inside NOT(...)
            v_ticket.created_by IS NOT DISTINCT FROM v_actor
```

Both forms treat `NULL` as a value, so an orphaned ticket fails the ownership test for everyone —
the correct answer once its owner is gone. Applying the same operator to all three inverts one of
them and would either lock the real owner out or leave the hole open.

`attach_disposal_certificate` (current definition in `003`) is **not** affected: it gates on
`current_user_is_asset_staff()` alone and never reads `created_by`.

**RLS policies are safe and need no change.** The eight `created_by = auth.uid()` comparisons in
policy `USING` / `WITH CHECK` clauses (`001`, `003`, `005`) evaluate to `NULL` for an orphaned row,
and a policy that does not evaluate to `TRUE` denies. Those fail closed. Only the PL/pgSQL
functions above, which raise on the negative case, fail open.

### Migration 008

`supabase/migrations/008_hard_delete_users.sql`:

1. `ALTER TABLE disposal_tickets ALTER COLUMN created_by DROP NOT NULL;`
2. Drop and recreate the `created_by` FK with `ON DELETE SET NULL`.
3. `ALTER TABLE audit_logs ALTER COLUMN performed_by DROP NOT NULL;`
4. Drop and recreate the `performed_by` FK with `ON DELETE SET NULL`.
5. `CREATE OR REPLACE FUNCTION` for all three guard functions, each copied verbatim from its
   current definition with only the one comparison changed.

Applied by Anas in the Supabase SQL Editor — this environment has no DDL access (no DB password,
no Supabase CLI). Same as migrations 001–007.

### API — `DELETE /api/users/[id]`

Added to the existing `app/api/users/[id]/route.ts`, mirroring `PATCH`'s structure exactly:

1. Service-role key present, else 500.
2. Caller authenticated, else 401.
3. Caller is an **active admin**, else 403.
4. **Refuse self-deletion** — an admin deleting their own account mid-session is never intended.
5. **Refuse deleting the last active admin** — reuses `blockOnDeactivate` from `lib/users.ts`.
   Deleting an admin is strictly more destructive than deactivating one, so any state that
   blocks a deactivation must also block a delete.
6. `supabaseAdmin.auth.admin.deleteUser(id)` — cascades into `profiles`; with migration 008 the
   ticket and audit references null out instead of blocking.
7. On failure, return the Supabase message rather than a generic one, so a surviving FK shows up
   as itself instead of as "something went wrong".

`lib/users.ts` gains `blockOnDelete(targetId, currentUserId, profiles)`. It reuses the same two
rules as `blockOnDeactivate` but carries its own Malay messages, because "you cannot delete your
own account" and "you cannot deactivate your own account" are different sentences.

### UI

A **Padam** button inside the edit form in `app/(protected)/pengguna/page.tsx`, visible only when
`editingId` is set, styled `--destructive`, placed apart from Simpan/Batal.

It opens a confirmation step — **not** `window.confirm`, which is unstyled, untranslatable, and
blocks the event loop. Reuses `components/ui/modal.tsx`. The modal states that the action is
permanent, names the user being deleted, and requires a second click. Both guard rules are
checked client-side first for instant feedback, exactly as the deactivate path already does.

**Files:** `supabase/migrations/008_hard_delete_users.sql`, `app/api/users/[id]/route.ts`,
`lib/users.ts`, `lib/users.test.ts`, `app/(protected)/pengguna/page.tsx`, `lib/supabase/types.ts`
(`created_by` and `performed_by` become `string | null`).

### Knock-on effects of nullable columns

- **RLS** — `USING (created_by = auth.uid())` never matches `NULL`, so an orphaned ticket becomes
  invisible to the pemohon role. Correct: its owner no longer exists. `unit_aset` and `admin`
  policies are role-based and unaffected.
- **Dashboards** — `lib/dashboard/unit-aset.ts:296` and `pemohon.ts:362` already resolve names as
  `nameById.get(...) ?? "—"`, so a null actor renders as `—` with no change.
- **Types** — `lib/supabase/types.ts:45,60` declare both as `string`. They must widen to
  `string | null`; `tsc` will point at every consumer that needs a fallback.

---

## Task 3 — Admin resets a user's password

Extends the existing `PATCH /api/users/[id]`; no new route.

The handler accepts an **optional** `password` field. Absent or empty means "not changing it" —
so the existing edit flow is untouched. Present means:

1. Validate with the existing `isValidPassword`; reject with `PASSWORD_ERROR` on failure. The
   same policy that governs creation governs a reset — a reset must not be a way to set a weaker
   password than registration allows.
2. `supabaseAdmin.auth.admin.updateUserById(targetId, { password })`.

Ordering matters. The password update runs **after** the profile update and **before** the
ban/unban call, and a failure returns a message saying plainly what did and did not happen —
following the precedent already set at `route.ts:146-160`, where a partial success is reported
as a partial success rather than as "saved".

**UI:** in the edit form, the password field currently renders only for creation
(`{!editingId && ...}`). For editing it becomes a collapsed **"Tetapkan Semula Kata Laluan"**
control that reveals the same `<Input>` + `<PasswordChecklist>` pair when clicked. Collapsed by
default so a routine name-or-role edit never looks like it is about to change a password.

The admin reads the new password out to the user out-of-band. **No email is sent** — the project
has no SMTP and sits on the free Supabase email cap; that constraint is why onboarding is
admin-provisioned with `email_confirm: true` in the first place.

**Files:** `app/api/users/[id]/route.ts`, `app/(protected)/pengguna/page.tsx`.

**Explicitly out of scope:** self-service forgot-password. That needs SMTP and a public reset
route, and was not asked for.

---

## Task 4 — Submit confirmation

The confirmation exists but is a toast racing a redirect. The new message is two sentences and
carries an SLA the applicant is expected to remember:

> Permohonan anda telah berjaya dihantar.
> Semakan permohonan akan dibuat dalam tiga (3) hari bekerja.

**Anas's call: modal before redirect.** `mohon/page.tsx:188` replaces `toast.success(...)` with
a success modal built on the existing `components/ui/modal.tsx`. It shows the ticket number, both
sentences, and a single **OK** button whose handler runs `router.push("/status")`. The redirect
moves out of the submit path and into the button.

Spelling note: the request wrote *"Permohanan"*. Correct Malay is **"Permohonan"**, which is what
the rest of the app already uses (`mohon/page.tsx:188`, and throughout). The spec uses
"Permohonan".

The three partial-failure toasts at `:166` and `:184` — "Permohonan dihantar, tetapi foto gagal
dimuat naik" and its Borang CA twin — **stay toasts**. The ticket did submit; those are
warnings about an attachment, not the confirmation, and promoting them to a modal would put a
blocking dialog in front of a success.

**Files:** `app/(protected)/mohon/page.tsx`.

---

## Testing

Existing gate is `tsc` + `vitest` + `next build`, 156 tests green at `376502d`. Additions:

| Area | Test |
|---|---|
| `blockOnDelete` | self-delete blocked · last-active-admin blocked · ordinary user allowed · already-inactive admin is not cover for the last active one |
| `Modal` controlled mode | opens with `open` and no trigger · stays closed on `open={false}` · calls `onOpenChange(false)` on close |

Pure logic in `lib/` and presentational components are unit-tested — that is where the existing
suite lives and where `blockOnDeactivate` and `Modal` are already covered.

Not unit-tested, deliberately: the API routes have no existing harness, and `mohon/page.tsx` and
`pengguna/page.tsx` are large client components whose tests would be mostly Supabase mocking. The
confirmation modal's *mechanism* is covered by the `Modal` controlled-mode tests; its content is
static copy. Password-reset validation reuses `isValidPassword`, already covered by
`lib/password.test.ts`.

**Manual verification required (cannot be automated here):**

1. Migration 008 applied in the Supabase SQL Editor.
2. Delete a user **with** tickets — succeeds; their tickets survive with a `—` requester.
3. Delete the last active admin — refused. Delete yourself — refused.
4. **As an ordinary pemohon, try to attach a photo and a Borang CA to a ticket whose owner was
   deleted — both must be refused.** This is the guard that fails open if `attach_disposal_photo`
   or `attach_disposal_borang_ca` was missed in 008.
5. **As an ordinary pemohon, try to resubmit an orphaned rejected ticket — must be refused.**
6. As the real owner, attach a photo and resubmit a rejected ticket of your own — must still
   **succeed**. This is what catches an inverted operator in the fix.
7. Edit a user without opening the reset control — their password must still work.
8. Reset a password, then log in as that user with the new one.
9. Submit a request and confirm the modal blocks until OK is pressed.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Migration 008 weakens the audit trail | **High** | Accepted by Anas 2026-08-15, having been flagged. `SET NULL` over `CASCADE` keeps the records themselves. |
| Three ownership guards fail open on null | **High** | `IS [NOT] DISTINCT FROM` in all three functions, in the same migration. Not optional, not a follow-up. Manual checks 4–6 exist specifically to catch a missed or inverted one. |
| Nullable columns break a consumer | Medium | `tsc` catches it; both dashboard call sites already have `?? "—"`. |
| Hard delete run by mistake | Medium | Modal confirmation, self-delete and last-admin guards, destructive styling. |
| Reset sets a weak password | Low | Same `isValidPassword` as registration, server-side. |
| Admin expects an email on reset | Low | Helper text states the password must be passed on out-of-band. |

---

## Out of scope

Self-service password reset · notification system (`notifications` table does not exist) ·
bulk user operations · compressing the two 1 MB login PNGs · retiring the three merged local
branches · the eight uncommitted `.omx/` deletions in the working tree.
