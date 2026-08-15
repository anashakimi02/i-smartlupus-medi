"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
    // Radix reads open={undefined} as uncontrolled, so trigger-only callers
    // keep working with no edit.
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-sm animate-fade-in"
        />
        <Dialog.Content
          className={cn(
            "fixed z-50 bg-[var(--surface)] shadow-lg text-[var(--fg)]",
            // Top-centred at every width, like a browser alert. No bottom
            // sheet: one position everywhere is one thing to reason about.
            // Centred with auto margins, NOT -translate-x-1/2: animate-in
            // animates `transform`, and an animated property outranks a
            // normal declaration, so a translate-based centre gets wiped the
            // moment the animation applies.
            "top-8 left-0 right-0 mx-auto",
            "w-[calc(100%-2rem)] max-w-[480px] rounded-2xl p-6 animate-in",
            // A tall body must not push OK past the fold, where nothing could
            // reach it — the dialog scrolls instead of the page.
            "max-h-[calc(100vh-4rem)] overflow-y-auto",
            "focus:outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-title-3 font-semibold text-[var(--fg)]">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-footnote text-[var(--fg-muted)] mt-1">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              {/* The glyph is small, the hit area is not: 20px icon + p-3 = a
                  44px target, the WCAG 2.5.5 / iOS HIG floor. The 2026-07-19
                  pass enlarged these because older staff could not SEE them;
                  shrinking the drawing while keeping the target honours that
                  without the X dominating the header. */}
              <button
                type="button"
                aria-label="Tutup"
                className="-mr-1.5 p-3 rounded-md text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--primary-tint)] transition-colors"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
