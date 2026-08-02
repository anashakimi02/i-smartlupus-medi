/**
 * Creates one admin account (auth user + profile) via the service role.
 *
 * Deliberately CREATE-ONLY: it never deletes or modifies an existing admin.
 * Removing the old admin is a separate, manual step to be taken only after
 * the new one has been proven to log in.
 *
 * Run:
 *   node --env-file=.env.local scripts/create-admin.mjs <email> <password> "<full name>"
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
      "Run with: node --env-file=.env.local scripts/create-admin.mjs <email> <password> \"<full name>\"",
  );
  process.exit(1);
}

const [email, password, fullName] = process.argv.slice(2);

if (!email || !password || !fullName) {
  console.error('Usage: create-admin.mjs <email> <password> "<full name>"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`→ Creating auth user ${email}…`);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    console.error("✗ Auth creation failed:", error.message);
    process.exit(1);
  }

  const userId = data.user?.id;
  if (!userId) {
    console.error("✗ Auth user created but no id returned.");
    process.exit(1);
  }
  console.log(`✓ Auth user created: ${userId}`);

  console.log("→ Inserting profile…");
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    email,
    full_name: fullName,
    role: "admin",
    unit_name: null,
    is_active: true,
  });

  if (profileError) {
    // Same rollback contract as /api/register: never leave an auth user
    // without a profile, or the account exists but can do nothing.
    console.error("✗ Profile insert failed, rolling back auth user:", profileError.message);
    await supabase.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  console.log("✓ Profile created (role=admin, is_active=true)");

  console.log("→ Verifying…");
  const { data: check, error: checkError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", userId)
    .single();

  if (checkError || !check) {
    console.error("✗ Verification read failed:", checkError?.message);
    process.exit(1);
  }

  console.log("✓ Verified:", JSON.stringify(check));

  const { data: all } = await supabase
    .from("profiles")
    .select("email, role, is_active")
    .order("created_at");
  console.log(`\nAll profiles now (${all?.length ?? 0}):`);
  for (const p of all ?? []) {
    console.log(`  ${p.is_active ? "●" : "○"} ${p.email}  [${p.role}]`);
  }
}

main().catch((e) => {
  console.error("✗ Unexpected error:", e);
  process.exit(1);
});
