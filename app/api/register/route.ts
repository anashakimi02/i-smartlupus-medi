import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isMohEmail, MOH_DOMAIN } from "@/lib/utils";
import { isValidPassword, PASSWORD_ERROR } from "@/lib/password";
import type { UserRole } from "@/lib/supabase/types";

const VALID_ROLES: UserRole[] = ["user", "unit_aset", "admin"];

export async function POST(request: Request) {
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
    .select("role")
    .eq("id", caller.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Hanya pentadbir boleh mendaftar pengguna baharu." },
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

  const { email: rawEmail, password, full_name, role, unit_name } = body;

  // Strict validation
  if (!rawEmail || !password || !full_name || !role) {
    return NextResponse.json({ error: "Maklumat tidak lengkap." }, { status: 400 });
  }

  const email = String(rawEmail).trim().toLowerCase();
  if (!isMohEmail(email)) {
    return NextResponse.json(
      { error: `Hanya alamat e-mel @${MOH_DOMAIN} dibenarkan.` },
      { status: 400 },
    );
  }

  if (!isValidPassword(String(password))) {
    return NextResponse.json({ error: PASSWORD_ERROR }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Peranan tidak sah." }, { status: 400 });
  }

  // 3. Create user via Admin API
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() }
    });

  if (authError) {
    console.error("Auth creation error:", authError.message);
    // Handle specific common errors
    if (authError.message.includes("already registered")) {
      return NextResponse.json({ error: "E-mel ini sudah berdaftar." }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal mencipta akaun pengguna." }, { status: 400 });
  }

  const userId = authData.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Pendaftaran gagal secara teknikal." }, { status: 400 });
  }

  // 4. Create profile with Atomic Rollback
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: userId,
    email,
    full_name: full_name.trim(),
    role,
    unit_name: unit_name?.trim() || null,
  });

  if (profileError) {
    console.error("Profile creation error, rolling back auth user:", profileError.message);
    
    // ROLLBACK: Delete the Auth user we just created because the profile failed
    await supabaseAdmin.auth.admin.deleteUser(userId);

    if (profileError.code === "23505") { // Unique constraint
      return NextResponse.json({ error: "Profil dengan e-mel ini sudah wujud." }, { status: 400 });
    }
    
    return NextResponse.json({ error: "Gagal menyimpan profil pengguna." }, { status: 400 });
  }

  return NextResponse.json({ success: true, userId });
}
