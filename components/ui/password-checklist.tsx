"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { checkPassword } from "@/lib/password";
import { cn } from "@/lib/utils";

/**
 * Live rule checklist for the admin's "Daftar Baru" password field.
 * Shown from the moment the form opens so the rules are known before typing,
 * rather than discovered by failing submit.
 */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul aria-live="polite" className="mt-2 space-y-1.5">
      {checkPassword(password).map((rule) => (
        <li
          key={rule.id}
          className={cn(
            "flex items-center gap-2 text-footnote transition-colors duration-base",
            rule.met
              ? "text-[var(--primary)] font-medium"
              : "text-[var(--fg-muted)]",
          )}
        >
          {/* Icon SHAPE carries the state as well as colour — green-vs-grey alone
              fails for colour-blind users and on low-contrast screens. */}
          {rule.met ? (
            <CheckCircle2 size={16} strokeWidth={2.5} className="shrink-0" aria-hidden />
          ) : (
            <Circle size={16} strokeWidth={2} className="shrink-0" aria-hidden />
          )}
          <span>{rule.label}</span>
          <span className="sr-only">{rule.met ? "dipenuhi" : "belum dipenuhi"}</span>
        </li>
      ))}
    </ul>
  );
}
