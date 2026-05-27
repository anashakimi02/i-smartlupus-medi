/**
 * Seeds ~60 [DEMO]-prefixed disposal tickets across realistic medical assets,
 * dates, statuses, and users — so the analyst dashboard has enough data to
 * look meaningful.
 *
 * Run:
 *   node --env-file=.env.local scripts/seed-demo.mjs
 *
 * Required env vars (Node loads from .env.local with --env-file):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY     (write access, bypasses RLS)
 *
 * Cleanup:
 *   node --env-file=.env.local scripts/clean-demo.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n" +
      "Run with: node --env-file=.env.local scripts/seed-demo.mjs",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Sample data pools ──────────────────────────────────────────────────────

const ASSETS = [
  "Ventilator V4",
  "Monitor Pesakit GE Dash 4000",
  "Defibrillator Philips HeartStart",
  "Mesin EKG 12-Lead",
  "Mesin Ultrasound USG",
  "Kerusi Roda Lipat",
  "Stretcher Bed Manual",
  "Pam Suntik Terumo",
  "Mesin Dialisis Fresenius",
  "Lampu Pemeriksaan LED",
  "Mikroskop Cahaya Olympus",
  "Sentrifus Mikrohematokrit",
  "Stetoskop Elektronik Littmann",
  "Termometer Inframerah",
  "Pulse Oximeter Nellcor",
  "Mesin Anestesia Drager",
  "Inkubator Bayi GE Giraffe",
  "Mesin X-Ray Mudah Alih",
  "Suction Machine 30L",
  "Autoclave 24L",
  "Sphygmomanometer Aneroid",
  "Otoscope Welch Allyn",
  "Patient Hoist Hidraulik",
  "Lampu LED Klinikal",
  "Pediatric Resuscitator",
  "Mesin Suntikan Insulin",
  "Treadmill Pemulihan",
  "Ultrasonic Cleaner",
  "Mesin BP Otomatik",
  "Glukometer Accu-Chek",
];

const LOCATIONS = [
  "Wad 3A", "Wad 4B", "Wad 6C", "ICU", "Makmal Patologi",
  "Bilik X-Ray", "Dewan Bedah", "Bilik Kecemasan", "Jabatan Farmasi",
  "Klinik Pesakit Luar", "Bilik Bersalin", "Bilik Pemulihan",
];

const REJECTION_REASONS = [
  "Maklumat aset tidak lengkap",
  "Tarikh pembelian tidak dinyatakan",
  "Aset masih dalam waranti",
  "Gambar tidak jelas — sila hantar semula dengan gambar berkualiti",
  "Sila lampirkan sijil kerosakan dari juruteknik",
  "Item bukan tergolong dalam pelupusan",
];

const DISPOSAL_METHODS = ["jualan", "lelong", "musnah", "serah_agensi"];
const CATEGORIES = ["harta_modal", "aset_bernilai_rendah"];
const SUB_CATEGORIES = ["alat_perubatan", "bukan_alat_perubatan"];
const CONDITIONS = ["rosak", "usang"];

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randPrice(category) {
  // Harta modal: RM 5k–80k. Aset bernilai rendah: RM 200–5k.
  if (category === "harta_modal") return randInt(5000, 80000);
  return randInt(200, 5000);
}

function dateNDaysAgo(n, withRandomHour = true) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  if (withRandomHour) {
    d.setHours(randInt(8, 17), randInt(0, 59), randInt(0, 59));
  }
  return d.toISOString();
}

function addHours(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 3600 * 1000).toISOString();
}

// ─── Main seed ──────────────────────────────────────────────────────────────

async function main() {
  console.log("→ Fetching existing profiles to use real user IDs…");
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, role, full_name");

  if (profErr) {
    console.error("Failed to fetch profiles:", profErr.message);
    process.exit(1);
  }
  if (!profiles || profiles.length === 0) {
    console.error("No profiles found in database. Create users before seeding.");
    process.exit(1);
  }

  const users = profiles.filter((p) => p.role === "user");
  const unitAsetUsers = profiles.filter((p) => p.role === "unit_aset");

  if (users.length === 0) {
    console.error("No 'user' role profiles. Create at least one pemohon first.");
    process.exit(1);
  }
  if (unitAsetUsers.length === 0) {
    console.error("No 'unit_aset' role profiles. Create at least one reviewer first.");
    process.exit(1);
  }

  console.log(`  ✓ ${users.length} pemohon users, ${unitAsetUsers.length} unit_aset users`);

  // Distribution (totals 60):
  //   menunggu_semakan: 12 (4 fresh, 4 warm, 2 aging, 2 critical)
  //   proses_pelupusan: 10
  //   selesai: 30
  //   ditolak: 8
  const ageMix = [
    ...Array(4).fill("fresh"),     // 0-3 days old
    ...Array(4).fill("warm"),      // 4-7 days
    ...Array(2).fill("aging"),     // 8-14 days
    ...Array(2).fill("critical"),  // 15+ days
  ];

  const tickets = [];
  let ticketCounter = 1;
  const ticketNo = () => `TKT-DEMO-${String(ticketCounter++).padStart(4, "0")}`;

  // — 12 pending tickets, spread by age bucket
  for (const ageKey of ageMix) {
    let daysOld;
    if (ageKey === "fresh") daysOld = randInt(0, 3);
    else if (ageKey === "warm") daysOld = randInt(4, 7);
    else if (ageKey === "aging") daysOld = randInt(8, 14);
    else daysOld = randInt(15, 25);

    const category = pick(CATEGORIES);
    tickets.push({
      ticket_no: ticketNo(),
      asset_name: `[DEMO] ${pick(ASSETS)}`,
      inventory_id: `INV-${randInt(10000, 99999)}`,
      asset_condition: pick(CONDITIONS),
      category,
      sub_category: pick(SUB_CATEGORIES),
      serial_no: `SN-${randInt(100000, 999999)}`,
      asset_type: pick(["Peralatan Perubatan", "Perabot", "Mesin", "Elektronik"]),
      purchase_date: dateNDaysAgo(randInt(365, 1825), false).slice(0, 10),
      purchase_price: randPrice(category),
      location: pick(LOCATIONS),
      status: "menunggu_semakan",
      created_by: pick(users).id,
      created_at: dateNDaysAgo(daysOld),
    });
  }

  // — 10 proses_pelupusan tickets (reviewed but not completed)
  for (let i = 0; i < 10; i++) {
    const createdDaysAgo = randInt(10, 40);
    const createdAt = dateNDaysAgo(createdDaysAgo);
    const reviewAfterHours = randInt(1, 48);
    const reviewedAt = addHours(createdAt, reviewAfterHours);
    const category = pick(CATEGORIES);
    tickets.push({
      ticket_no: ticketNo(),
      asset_name: `[DEMO] ${pick(ASSETS)}`,
      inventory_id: `INV-${randInt(10000, 99999)}`,
      asset_condition: pick(CONDITIONS),
      category,
      sub_category: pick(SUB_CATEGORIES),
      serial_no: `SN-${randInt(100000, 999999)}`,
      asset_type: pick(["Peralatan Perubatan", "Perabot", "Mesin", "Elektronik"]),
      purchase_date: dateNDaysAgo(randInt(365, 1825), false).slice(0, 10),
      purchase_price: randPrice(category),
      location: pick(LOCATIONS),
      status: "proses_pelupusan",
      disposal_method: pick(DISPOSAL_METHODS),
      created_by: pick(users).id,
      reviewed_by: pick(unitAsetUsers).id,
      created_at: createdAt,
      reviewed_at: reviewedAt,
    });
  }

  // — 30 selesai tickets (full lifecycle)
  for (let i = 0; i < 30; i++) {
    const createdDaysAgo = randInt(15, 55);
    const createdAt = dateNDaysAgo(createdDaysAgo);
    const reviewAfterHours = randInt(1, 48);
    const reviewedAt = addHours(createdAt, reviewAfterHours);
    const completedAt = addHours(reviewedAt, randInt(48, 240)); // 2-10 days later
    const category = pick(CATEGORIES);
    const unitAsetUser = pick(unitAsetUsers);
    tickets.push({
      ticket_no: ticketNo(),
      asset_name: `[DEMO] ${pick(ASSETS)}`,
      inventory_id: `INV-${randInt(10000, 99999)}`,
      asset_condition: pick(CONDITIONS),
      category,
      sub_category: pick(SUB_CATEGORIES),
      serial_no: `SN-${randInt(100000, 999999)}`,
      asset_type: pick(["Peralatan Perubatan", "Perabot", "Mesin", "Elektronik"]),
      purchase_date: dateNDaysAgo(randInt(365, 1825), false).slice(0, 10),
      purchase_price: randPrice(category),
      location: pick(LOCATIONS),
      status: "selesai",
      disposal_method: pick(DISPOSAL_METHODS),
      created_by: pick(users).id,
      reviewed_by: unitAsetUser.id,
      completed_by: unitAsetUser.id,
      created_at: createdAt,
      reviewed_at: reviewedAt,
      completed_at: completedAt,
    });
  }

  // — 8 ditolak tickets
  for (let i = 0; i < 8; i++) {
    const createdDaysAgo = randInt(5, 50);
    const createdAt = dateNDaysAgo(createdDaysAgo);
    const reviewAfterHours = randInt(1, 72);
    const reviewedAt = addHours(createdAt, reviewAfterHours);
    const category = pick(CATEGORIES);
    tickets.push({
      ticket_no: ticketNo(),
      asset_name: `[DEMO] ${pick(ASSETS)}`,
      inventory_id: `INV-${randInt(10000, 99999)}`,
      asset_condition: pick(CONDITIONS),
      category,
      sub_category: pick(SUB_CATEGORIES),
      serial_no: `SN-${randInt(100000, 999999)}`,
      asset_type: pick(["Peralatan Perubatan", "Perabot", "Mesin", "Elektronik"]),
      purchase_date: dateNDaysAgo(randInt(365, 1825), false).slice(0, 10),
      purchase_price: randPrice(category),
      location: pick(LOCATIONS),
      status: "ditolak",
      rejection_reason: pick(REJECTION_REASONS),
      created_by: pick(users).id,
      reviewed_by: pick(unitAsetUsers).id,
      created_at: createdAt,
      reviewed_at: reviewedAt,
    });
  }

  console.log(`→ Inserting ${tickets.length} demo tickets…`);

  // Insert in batches to keep payload small
  const BATCH = 20;
  let inserted = 0;
  for (let i = 0; i < tickets.length; i += BATCH) {
    const batch = tickets.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from("disposal_tickets")
      .insert(batch, { count: "exact" });
    if (error) {
      console.error(`  ✗ Batch ${i / BATCH + 1} failed:`, error.message);
      process.exit(1);
    }
    inserted += count ?? batch.length;
    console.log(`  ✓ Batch ${i / BATCH + 1}: ${batch.length} inserted`);
  }

  console.log(`\n✓ Done. Seeded ${inserted} demo tickets.`);
  console.log(`\nDistribution:`);
  console.log(`  menunggu_semakan : 12 (4 fresh, 4 warm, 2 aging, 2 critical)`);
  console.log(`  proses_pelupusan : 10`);
  console.log(`  selesai          : 30`);
  console.log(`  ditolak          :  8`);
  console.log(`\nCleanup: node --env-file=.env.local scripts/clean-demo.mjs`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
