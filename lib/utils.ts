// ponytail: minimal email shape check — has one @, non-empty local + domain with a dot.
// Supabase's createUser is the real validator; this just blocks obvious typos client/server-side.
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** The only email domain allowed to hold an account in this system. */
export const MOH_DOMAIN = "moh.gov.my";

// ponytail: compare the domain part exactly — endsWith() would accept
// "attacker@notmoh.gov.my" and "ahmad@hkl.moh.gov.my" as MOH addresses.
export function isMohEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  if (!isValidEmail(clean)) return false;
  return clean.slice(clean.indexOf("@") + 1) === MOH_DOMAIN;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("ms-MY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("ms-MY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ms-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
