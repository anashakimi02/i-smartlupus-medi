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
