/**
 * Malay time-of-day greeting. Buckets:
 *   05:00-11:59 → Selamat pagi
 *   12:00-14:59 → Selamat tengah hari
 *   15:00-18:59 → Selamat petang
 *   19:00-04:59 → Selamat malam
 */
export function getGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return "Selamat pagi";
  if (h >= 12 && h < 15) return "Selamat tengah hari";
  if (h >= 15 && h < 19) return "Selamat petang";
  return "Selamat malam";
}
