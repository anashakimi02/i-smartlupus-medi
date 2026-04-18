# Plan B-1: Login Page Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `app/login/page.tsx` to match the iOS-classic "Apple ID sign-in" feel from `design-system/i-smartlupus-medi/pages/login.md`, using Plan A primitives (Input, Button) and emerald brand palette. Existing auth flow (Supabase signInWithPassword with IC→email mapping) must keep working.

**Architecture:** Form replaces the whole page — no card wrapper. Form uses Input + Button primitives with emerald focus/submit. IC field auto-hyphens on the fly for readability, but the underlying state stays as 12 raw digits. Password gets a show/hide toggle via a new `trailing` slot on Input. Inline validation fires on blur, announced via `aria-live`.

**Tech Stack:** Next.js 14 App Router (client component), Supabase auth, Sonner for failure toasts, Lucide for Eye/EyeOff icons, Vitest for logic + primitive tests.

**Out of scope:**
- Dashboard, mohon, semakan, semua, status, pengguna, profil pages (Plan B-2 through B-8)
- Password reset flow
- New auth methods (email+password was never the plan here — IC is the login credential)
- Changing the `lib/utils.ts::formatIc` function (used by pengguna and profil) — we add a separate progressive formatter

---

## File Structure

**New files (created in this plan):**
- `lib/format-ic-progressive.ts` — progressive IC formatter for live-typing display
- `lib/format-ic-progressive.test.ts` — tests for the formatter

**Modified files:**
- `components/ui/input.tsx` — add optional `trailing` slot for password toggle (additive, non-breaking)
- `components/ui/input.test.tsx` — add test for trailing slot
- `app/login/page.tsx` — full rewrite using Input + Button primitives, flush layout

**Untouched (still uses old patterns until their own Plan B-N):**
- `app/(protected)/**` — all protected pages
- Existing components: `BottomNav.tsx` (v1), `StatCard.tsx`, `StatusBadge.tsx`, etc.
- `middleware.ts` — auth flow unchanged

---

## Task 1: Verify baseline before touching code

**Files:** (git state only)

- [ ] **Step 1: Confirm clean working tree**

Run: `cd "D:/project/i-smartlupus-medi" && git status --short`
Expected: Clean or only `memory/` untracked (gitignored already).

- [ ] **Step 2: Confirm on foundation branch**

Run: `git branch --show-current`
Expected: `feat/ios-redesign-foundation`

- [ ] **Step 3: Baseline test count**

Run: `node -e "require('child_process').execSync('npm test -- --run', {stdio:'inherit', shell:process.env.COMSPEC})"`
Expected: `49 passed (49)` — this is our known baseline from Plan A completion.

---

## Task 2: Progressive IC formatter utility

**Files:**
- Create: `lib/format-ic-progressive.ts`
- Create: `lib/format-ic-progressive.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/format-ic-progressive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatIcProgressive } from "./format-ic-progressive";

describe("formatIcProgressive", () => {
  it("returns empty string for empty input", () => {
    expect(formatIcProgressive("")).toBe("");
  });

  it("returns raw digits with no hyphen when below 7 digits", () => {
    expect(formatIcProgressive("12345")).toBe("12345");
    expect(formatIcProgressive("123456")).toBe("123456");
  });

  it("inserts first hyphen after 6 digits", () => {
    expect(formatIcProgressive("1234567")).toBe("123456-7");
    expect(formatIcProgressive("12345678")).toBe("123456-78");
  });

  it("inserts second hyphen after 8 digits", () => {
    expect(formatIcProgressive("123456789")).toBe("123456-78-9");
    expect(formatIcProgressive("123456789012")).toBe("123456-78-9012");
  });

  it("strips non-digits before formatting", () => {
    expect(formatIcProgressive("123-456-78-9012")).toBe("123456-78-9012");
    expect(formatIcProgressive("abc12345def")).toBe("12345");
  });

  it("truncates at 12 digits", () => {
    expect(formatIcProgressive("12345678901234567")).toBe("123456-78-9012");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `node -e "require('child_process').execSync('npm test -- --run lib/format-ic-progressive.test.ts', {stdio:'inherit', shell:process.env.COMSPEC})"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatter**

Create `lib/format-ic-progressive.ts`:

```ts
/**
 * Format a Malaysian IC number as the user types.
 * Input: any string (will strip non-digits, cap at 12).
 * Output: "XXXXXX-XX-XXXX" with partial hyphens as digits accumulate.
 *
 * Why separate from lib/utils.ts::formatIc — that version only formats
 * complete 12-digit strings. This one formats partial input live during
 * typing without disturbing callers of the strict version.
 */
export function formatIcProgressive(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `node -e "require('child_process').execSync('npm test -- --run lib/format-ic-progressive.test.ts', {stdio:'inherit', shell:process.env.COMSPEC})"`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/format-ic-progressive.ts lib/format-ic-progressive.test.ts
git commit -m "feat(login): add progressive IC formatter for live-typing display"
```

---

## Task 3: Extend Input primitive with trailing slot

**Files:**
- Modify: `components/ui/input.tsx`
- Modify: `components/ui/input.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test to `components/ui/input.test.tsx` at the bottom of the describe block, after the existing "renders required indicator when required" test:

```tsx
  it("renders trailing slot when provided", () => {
    render(
      <Input
        id="pw"
        label="Kata Laluan"
        trailing={<button type="button" aria-label="Tukar kelihatan">X</button>}
      />
    );
    expect(screen.getByLabelText("Tukar kelihatan")).toBeInTheDocument();
  });

  it("trailing slot does not break label association", () => {
    render(
      <Input
        id="pw"
        label="Kata Laluan"
        trailing={<button aria-label="toggle">T</button>}
      />
    );
    expect(screen.getByLabelText("Kata Laluan")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `node -e "require('child_process').execSync('npm test -- --run components/ui/input.test.tsx', {stdio:'inherit', shell:process.env.COMSPEC})"`
Expected: 2 new tests FAIL because `trailing` prop not supported.

- [ ] **Step 3: Update Input primitive**

Replace `components/ui/input.tsx` with:

```tsx
"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  helper?: string;
  error?: string;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ id, label, helper, error, required, trailing, className, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const helperId = helper ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = errorId ?? helperId;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-subhead font-medium text-[var(--fg)]">
          {label}
          {required && <span className="text-[var(--destructive)] ml-0.5" aria-hidden>*</span>}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={cn(
              "min-h-touch w-full px-4 rounded-md bg-[var(--surface)] text-[var(--fg)] text-body",
              "border border-[var(--border)]",
              "transition-[border-color,box-shadow] duration-base ease-ios-out",
              "focus:outline-none focus:border-[var(--primary)] focus:shadow-ring",
              "placeholder:text-[var(--fg-muted)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-[var(--destructive)]",
              trailing && "pr-12",
              className,
            )}
            {...rest}
          />
          {trailing && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">
              {trailing}
            </div>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-footnote text-[var(--destructive)]">
            {error}
          </p>
        )}
        {!error && helper && (
          <p id={helperId} className="text-footnote text-[var(--fg-muted)]">
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node -e "require('child_process').execSync('npm test -- --run components/ui/input.test.tsx', {stdio:'inherit', shell:process.env.COMSPEC})"`
Expected: all 6 tests pass (4 original + 2 new).

- [ ] **Step 5: Commit**

```bash
git add components/ui/input.tsx components/ui/input.test.tsx
git commit -m "feat(ui): add trailing slot to Input primitive for inline controls"
```

---

## Task 4: Rewrite login page scaffold + layout

> Replaces the card-wrapped form with a flush form-is-the-page layout per login.md spec. No primitives wired yet in this task — this is the scaffold.

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Replace login page with scaffold**

Replace `app/login/page.tsx` entirely with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { icToEmail, validateIc } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [ic, setIc] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateIc(ic)) {
      toast.error("No. Kad Pengenalan mestilah 12 digit.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: icToEmail(ic),
      password,
    });
    if (error) {
      toast.error("No. KP atau kata laluan tidak sah.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--primary)] text-[var(--on-primary)] font-black text-2xl tracking-tight mb-2">
            iS
          </div>
          <h1 className="text-title-2 font-semibold text-[var(--fg)] tracking-tight">
            i-SMARTLUPUS
          </h1>
          <p className="text-footnote text-[var(--fg-muted)]">
            Sistem Pelupusan Aset Perubatan
          </p>
        </header>

        <div className="space-y-6">
          <div>
            <h2 className="text-display font-semibold text-[var(--fg)] tracking-tight">
              Selamat datang
            </h2>
            <p className="mt-1 text-body text-[var(--fg-muted)]">
              Log masuk dengan No. Kad Pengenalan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Inputs + button land in Tasks 5-7 */}
          </form>
        </div>

        <p className="text-center text-footnote text-[var(--fg-muted)]">
          Masalah log masuk?{" "}
          <a href="tel:+60312345678" className="text-[var(--primary)] font-medium hover:underline">
            Hubungi Unit Aset
          </a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify scaffold renders in dev**

Run: `npm run dev` (leave running in another terminal). Open http://localhost:3000/login (log out first if currently authed).

Expected: Emerald iS badge, "i-SMARTLUPUS" title, greeting, empty form area, helper line with tel link. No inputs/button yet — those come in next tasks.

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(login): scaffold new iOS-style login layout (form-is-the-page)"
```

---

## Task 5: Wire IC input with progressive hyphen

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Add IC input using Input primitive**

In `app/login/page.tsx`, update the imports at the top to add:

```tsx
import { Input } from "@/components/ui/input";
import { formatIcProgressive } from "@/lib/format-ic-progressive";
```

Add local state for IC blur validation below the existing useState hooks:

```tsx
  const [icError, setIcError] = useState<string | undefined>(undefined);
```

Add an IC change handler inside the component (before `handleSubmit`):

```tsx
  function handleIcChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Store raw digits; display is formatted separately
    const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
    setIc(digits);
    // Clear error as user edits
    if (icError) setIcError(undefined);
  }

  function handleIcBlur() {
    if (ic.length === 0) {
      setIcError(undefined);
      return;
    }
    if (!validateIc(ic)) {
      setIcError("No. KP mestilah 12 digit.");
    }
  }
```

Replace the empty `{/* Inputs + button land in Tasks 5-7 */}` placeholder inside the `<form>` with just the IC Input:

```tsx
            <Input
              id="ic"
              label="No. Kad Pengenalan"
              inputMode="numeric"
              autoComplete="username"
              placeholder="Cth: 900101011234"
              value={formatIcProgressive(ic)}
              onChange={handleIcChange}
              onBlur={handleIcBlur}
              error={icError}
              required
              maxLength={14}
            />
```

- [ ] **Step 2: Manual verification**

Refresh http://localhost:3000/login.

Checklist:
- [ ] Label "No. Kad Pengenalan" visible above input
- [ ] Typing digits auto-hyphens: `900101` → `900101`, then `9001010` → `900101-0`, then `90010101` → `900101-01`, then `900101012345` → `900101-01-2345`
- [ ] Typing letters is ignored (input stays at digit count)
- [ ] Blurring with empty input shows no error
- [ ] Blurring with partial input (`123456`) shows red error "No. KP mestilah 12 digit." below
- [ ] Blurring with valid 12 digits clears any prior error
- [ ] Editing again clears the error immediately

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(login): wire IC input with progressive hyphen and blur validation"
```

---

## Task 6: Wire password input with show/hide toggle

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Add password input using Input primitive**

In `app/login/page.tsx`, add to the top imports:

```tsx
import { Eye, EyeOff } from "lucide-react";
```

Add password visibility state near the other useState hooks:

```tsx
  const [showPassword, setShowPassword] = useState(false);
```

Below the IC `<Input>` inside the form, add the password Input:

```tsx
            <Input
              id="password"
              label="Kata Laluan"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Masukkan kata laluan"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
```

- [ ] **Step 2: Manual verification**

Refresh login page.

Checklist:
- [ ] Password field appears below IC with label
- [ ] Eye icon visible inside the right edge of the input
- [ ] Clicking eye toggles to EyeOff and reveals characters
- [ ] Clicking EyeOff toggles back to Eye and masks characters
- [ ] Tab order: IC → password → eye toggle → submit (still no submit wired yet, that's Task 7)
- [ ] aria-label on eye button announces state

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(login): wire password input with show/hide toggle via Input trailing slot"
```

---

## Task 7: Wire submit button with loading state

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Add Button primitive for submit**

In `app/login/page.tsx`, add to imports:

```tsx
import { Button } from "@/components/ui/button";
```

Below the password Input inside the form, add the submit button with a small vertical gap:

```tsx
            <Button
              type="submit"
              size="lg"
              loading={loading}
              disabled={loading || ic.length !== 12 || password.length === 0}
              className="w-full mt-2"
            >
              Log Masuk
            </Button>
```

- [ ] **Step 2: Full flow test in dev**

Refresh login page. Log out if already authed (e.g. via /profil log keluar, or clear Supabase cookie in DevTools → Application → Cookies).

Happy-path test:
- [ ] Type a valid 12-digit IC from a known test user (e.g. seeded `900101011234`)
- [ ] Type the correct password
- [ ] Button becomes enabled (solid emerald, size lg = 48px full-width)
- [ ] Click submit → loading spinner replaces "Log Masuk" text
- [ ] Redirects to `/dashboard` on success
- [ ] Refresh dashboard, session persists

Failure-path test:
- [ ] Log out, return to login
- [ ] Type valid IC format but wrong password → red toast "No. KP atau kata laluan tidak sah." appears top-center
- [ ] Button returns to enabled state (not stuck in loading)
- [ ] Type partial IC (6 digits) → button remains disabled (opacity reduced)
- [ ] Clear both fields → button remains disabled

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(login): wire submit Button with loading state and disabled guards"
```

---

## Task 8: Dark mode verification pass

**Files:** (visual verification + CSS fix if needed)

- [ ] **Step 1: Check dark mode rendering**

In dev, navigate to login (logged out). In browser DevTools console, run:

```js
document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark");
```

Refresh. Verify in dark mode:
- [ ] Page background is dark slate (`--bg`), not light
- [ ] Emerald iS logo badge is visible (emerald-400 primary in dark)
- [ ] Title "i-SMARTLUPUS" readable in near-white
- [ ] "Selamat datang" display text readable
- [ ] Input borders visible on dark surface (`--border` has enough contrast)
- [ ] Input focus ring visible (emerald-400 glow)
- [ ] Error message red remains readable on dark
- [ ] Password eye button icon visible, hover state visible
- [ ] Submit button emerald-400 bg with dark emerald-950 text (readable)
- [ ] tel link emerald, underlined on hover

- [ ] **Step 2: If any visual fails above, record and fix**

If any of the above fails, add a fix commit with a clear message (e.g. `fix(login): raise input border contrast in dark mode`). If all pass, skip to Step 3.

- [ ] **Step 3: Reset theme and verify light mode one more time**

In console:

```js
document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light");
```

Refresh login. Verify everything still looks right in light mode.

---

## Task 9: Full smoke test + branch summary

**Files:** (verification only)

- [ ] **Step 1: Full test suite**

Run: `node -e "require('child_process').execSync('npm test -- --run', {stdio:'inherit', shell:process.env.COMSPEC})"`
Expected: All previous tests still pass + 6 new formatter tests + 2 new Input tests. Total should be `57 passed (57)`.

- [ ] **Step 2: Production build**

Run: `node -e "require('child_process').execSync('npm run build', {stdio:'inherit', shell:process.env.COMSPEC})"`
Expected: Build succeeds. `/login` route size should shrink (we removed a chunk of inline styles).

- [ ] **Step 3: Lint**

Run: `node -e "require('child_process').execSync('npm run lint', {stdio:'inherit', shell:process.env.COMSPEC})"`
Expected: Clean or only pre-existing warnings (compare against Plan A baseline).

- [ ] **Step 4: Other pages still render**

With dev server running and logged in, verify each protected route still renders without console errors:
- [ ] `/dashboard`
- [ ] `/mohon`
- [ ] `/semakan`
- [ ] `/semua`
- [ ] `/status` (if it has data)
- [ ] `/pengguna`
- [ ] `/profil`

These pages still use old patterns until their own Plan B-N. We just verify this plan didn't break them.

- [ ] **Step 5: Branch state**

Run:
```bash
git log --oneline master..HEAD
git status
```

Expected: ~7 new commits since the last Plan A commit (`4d26274`), working tree clean.

---

## Self-Review (author ran before handoff)

**Spec coverage** against `design-system/i-smartlupus-medi/pages/login.md`:
- ✅ Minimal Single Column pattern → Task 4 scaffold (max-w-sm centered, no card)
- ✅ `min-h-dvh` not `100vh` → Task 4 (`className="min-h-dvh"`)
- ✅ Brand mark + title + greeting → Task 4 (iS badge + title-2 + display)
- ✅ IC auto-hyphen `XXXXXX-XX-XXXX` → Task 2 formatter + Task 5 wiring
- ✅ `inputMode="numeric"`, `autocomplete="username"`, `maxLength=14` → Task 5
- ✅ Password show/hide Eye/EyeOff → Task 6 via Input `trailing` slot
- ✅ Both fields 48px → Input primitive uses `min-h-touch` (48px)
- ✅ Inline validation on blur → Task 5 (`handleIcBlur`)
- ✅ `aria-live="polite"` error below field → Input primitive sets `role="alert"` on error `<p>`
- ✅ Submit = `Button size="lg"` full-width → Task 7
- ✅ Loading: disable CTA, replace label with spinner → Task 7 (`loading` prop on Button)
- ✅ Helper tel: link at bottom → Task 4
- ✅ No bottom nav on login → (nav lives under (protected) layout, not login, so automatic)
- ✅ Hero typography `display` token → Task 4 (`text-display`)
- ✅ Dark mode parity → Task 8 verification

**Placeholder scan:** Searched for "TBD", "TODO", "implement later", "similar to" — none present. All code blocks complete.

**Type consistency:**
- `Input` primitive `trailing?: ReactNode` defined in Task 3, consumed in Task 6 ✓
- `formatIcProgressive` signature `(input: string) => string` defined in Task 2, called in Task 5 ✓
- `icToEmail` / `validateIc` from `lib/utils.ts` — existing, reused unchanged ✓
- `Button` props `size`, `loading`, `disabled`, `className` all match Plan A Button primitive ✓

**Known gaps (tracked separately):**
- PRD gap field `audit_log` — server-side, unrelated to login
- Password reset flow — out of scope per user framing
- Other pages — Plan B-2 onwards

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-18-plan-b1-login-migration.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
