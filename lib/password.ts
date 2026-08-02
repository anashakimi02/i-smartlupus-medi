export const PASSWORD_MIN_LENGTH = 12;

/** Shown by the API when a password fails the policy. Mirrors the checklist rules. */
export const PASSWORD_ERROR =
  "Kata laluan mesti 12 aksara dengan huruf besar, huruf kecil, nombor dan simbol.";

export interface PasswordRule {
  id: "panjang" | "besar" | "kecil" | "nombor" | "simbol";
  label: string;
  met: boolean;
}

// ponytail: whitespace is deliberately NOT a symbol — "Ada Password12" should
// not tick the simbol box just because it contains a space.
const RULES: { id: PasswordRule["id"]; label: string; test: (pw: string) => boolean }[] = [
  {
    id: "panjang",
    label: "12 aksara atau lebih",
    test: (pw) => pw.length >= PASSWORD_MIN_LENGTH,
  },
  { id: "besar", label: "Satu huruf besar (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { id: "kecil", label: "Satu huruf kecil (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { id: "nombor", label: "Satu nombor (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { id: "simbol", label: "Satu simbol (!@#$...)", test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
];

/** Evaluates every rule so the UI can show which ones are still outstanding. */
export function checkPassword(password: string): PasswordRule[] {
  return RULES.map(({ id, label, test }) => ({ id, label, met: test(password) }));
}

export function isValidPassword(password: string): boolean {
  return RULES.every(({ test }) => test(password));
}
