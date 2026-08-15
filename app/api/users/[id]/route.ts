import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  blockOnDeactivate,
  DEACTIVATE_BLOCK_MESSAGE,
  blockOnDelete,
  DELETE_BLOCK_MESSAGE,
} from "@/lib/users";
import type { Profile, UserRole } from "@/lib/supabase/types";

const VALID_ROLES: UserRole[] = ["user", "unit_aset", "admin"];

// Supabase treats a ban as a duration, not a flag. This is the "indefinite"
// end of it; "none" is the documented way to lift one.
const BAN_FOREVER = "876000h";
const BAN_NONE = "none";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetId } = await params;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json(
      { error: "Ralat konfigurasi pelayan." },
      { status: 500 },
    );
  }

  // 1. Verify the caller is an authenticated admin
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user: caller },
  } = await supabaseAuth.auth.getUser();

  if (!caller) {
    return NextResponse.json({ error: "Sesi tamat." }, { status: 401 });
  }

  const { data: callerProfile } = await supabaseAuth
    .from("profiles")
    .select("role, is_active")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
    return NextResponse.json(
      { error: "Hanya pentadbir boleh mengemaskini pengguna." },
      { status: 403 },
    );
  }

  // 2. Validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format data tidak sah." }, { status: 400 });
  }

  const { full_name, role, unit_name, is_active } = body;

  if (!full_name || !String(full_name).trim()) {
    return NextResponse.json({ error: "Nama penuh diperlukan." }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Peranan tidak sah." }, { status: 400 });
  }

  if (typeof is_active !== "boolean") {
    return NextResponse.json({ error: "Status akaun tidak sah." }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 3. Re-run the deactivation guards against CURRENT rows. The browser's
  //    copy of the list can be minutes old, and this is the only check that
  //    can actually keep the last admin alive.
  if (!is_active) {
    const { data: allProfiles, error: listError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, is_active");

    if (listError || !allProfiles) {
      return NextResponse.json(
        { error: "Gagal mengesahkan status pentadbir." },
        { status: 500 },
      );
    }

    const block = blockOnDeactivate(
      targetId,
      caller.id,
      allProfiles as Profile[],
    );
    if (block) {
      return NextResponse.json(
        { error: DEACTIVATE_BLOCK_MESSAGE[block] },
        { status: 400 },
      );
    }
  }

  // 4. Update the profile
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: String(full_name).trim(),
      role,
      unit_name: unit_name?.trim() || null,
      is_active,
    })
    .eq("id", targetId);

  if (updateError) {
    console.error("Profile update error:", updateError.message);
    return NextResponse.json(
      { error: "Gagal mengemaskini profil pengguna." },
      { status: 400 },
    );
  }

  // 5. Ban or unban the auth account. The profile flag gates RLS; this is
  //    what stops the existing session refreshing its token. If it fails the
  //    profile is already saved, so report it rather than claiming success —
  //    an admin who thinks someone is locked out when they are not is worse
  //    than an admin who knows to retry.
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
    targetId,
    { ban_duration: is_active ? BAN_NONE : BAN_FOREVER },
  );

  if (banError) {
    console.error("Auth ban update error:", banError.message);
    return NextResponse.json(
      {
        error:
          "Profil dikemaskini, tetapi sesi log masuk pengguna gagal dikemaskini. Sila cuba semula.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetId } = await params;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json(
      { error: "Ralat konfigurasi pelayan." },
      { status: 500 },
    );
  }

  // 1. Verify the caller is an authenticated, active admin
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user: caller },
  } = await supabaseAuth.auth.getUser();

  if (!caller) {
    return NextResponse.json({ error: "Sesi tamat." }, { status: 401 });
  }

  const { data: callerProfile } = await supabaseAuth
    .from("profiles")
    .select("role, is_active")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
    return NextResponse.json(
      { error: "Hanya pentadbir boleh memadam pengguna." },
      { status: 403 },
    );
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 2. Re-run the guards against CURRENT rows, exactly as PATCH does. The
  //    browser's copy of the list can be minutes old, and this is the only
  //    check that can actually keep the last admin alive. Deleting is
  //    irreversible, so it gets the same scrutiny as deactivating and then
  //    some.
  const { data: allProfiles, error: listError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, is_active");

  if (listError || !allProfiles) {
    return NextResponse.json(
      { error: "Gagal mengesahkan status pentadbir." },
      { status: 500 },
    );
  }

  const block = blockOnDelete(targetId, caller.id, allProfiles as Profile[]);
  if (block) {
    return NextResponse.json(
      { error: DELETE_BLOCK_MESSAGE[block] },
      { status: 400 },
    );
  }

  // 3. Delete the auth user. This cascades into profiles, and — once
  //    migration 008 is applied — nulls out created_by / performed_by rather
  //    than being blocked by them.
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetId);

  if (deleteError) {
    console.error("User delete error:", deleteError.message);
    // Surface the real reason. A surviving foreign key means 008 has not been
    // applied, and a generic "something went wrong" would send the admin
    // hunting for a bug that is really a missing migration.
    return NextResponse.json(
      { error: `Gagal memadam pengguna: ${deleteError.message}` },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
