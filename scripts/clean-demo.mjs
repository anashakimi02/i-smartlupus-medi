/**
 * Removes all [DEMO]-prefixed tickets seeded by seed-demo.mjs.
 *
 * Run:
 *   node --env-file=.env.local scripts/clean-demo.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
      "Run with: node --env-file=.env.local scripts/clean-demo.mjs",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("→ Counting demo tickets…");
  const { count: pre } = await supabase
    .from("disposal_tickets")
    .select("*", { count: "exact", head: true })
    .like("asset_name", "[DEMO]%");

  if (!pre) {
    console.log("  No demo tickets found. Nothing to clean.");
    return;
  }
  console.log(`  Found ${pre} demo tickets.`);

  // Also clean up matching audit_logs first (FK to disposal_tickets)
  console.log("→ Deleting related audit_logs…");
  const { data: ticketIds } = await supabase
    .from("disposal_tickets")
    .select("id")
    .like("asset_name", "[DEMO]%");

  if (ticketIds && ticketIds.length > 0) {
    const ids = ticketIds.map((t) => t.id);
    const { error: auditErr } = await supabase
      .from("audit_logs")
      .delete()
      .in("ticket_id", ids);
    if (auditErr) console.warn("  audit_logs cleanup warning:", auditErr.message);
  }

  console.log("→ Deleting demo tickets…");
  const { error, count } = await supabase
    .from("disposal_tickets")
    .delete({ count: "exact" })
    .like("asset_name", "[DEMO]%");

  if (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
  console.log(`\n✓ Done. Removed ${count ?? pre} demo tickets.`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
