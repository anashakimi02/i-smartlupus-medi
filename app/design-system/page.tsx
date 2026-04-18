"use client";

import { Check, Plus, Trash2, CircleDashed, Home, FileText, ClipboardCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { ListItem } from "@/components/ui/list-item";
import { BentoCard } from "@/components/ui/bento-card";
import { Modal } from "@/components/ui/modal";
import { BottomNav } from "@/components/ui/bottom-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function DesignSystemPage() {
  return (
    <div className="min-h-dvh p-6 md:p-10 space-y-10 max-w-5xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-title-1 font-semibold">Design System</h1>
          <p className="text-footnote text-[var(--fg-muted)]">
            QA visual semua primitive dalam tema terang &amp; gelap.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section className="space-y-4">
        <h2 className="text-title-2 font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive"><Trash2 className="h-4 w-4" />Padam</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-title-2 font-semibold">Inputs</h2>
        <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
          <Input label="Nama Penuh" helper="Seperti dalam Kad Pengenalan" required />
          <Input label="No. Telefon" helper="Tanpa sempang" />
          <Input label="Emel" error="Format emel tidak sah" defaultValue="ali@" />
          <Input label="Disabled" disabled placeholder="Tidak boleh diedit" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-title-2 font-semibold">Chips</h2>
        <div className="flex flex-wrap gap-2">
          <Chip tone="pending" icon={<CircleDashed />}>Permohonan</Chip>
          <Chip tone="reviewing">Semakan</Chip>
          <Chip tone="executing">Pelaksanaan</Chip>
          <Chip tone="done" icon={<Check />}>Selesai</Chip>
          <Chip tone="rejected">Ditolak</Chip>
          <Chip tone="neutral">Neutral</Chip>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-title-2 font-semibold">List items (flat iOS)</h2>
        <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
          <ListItem
            title="PC Dell Optiplex 7070"
            subtitle="Ali Bin Ahmad · 2j lepas"
            trailing={<Chip tone="reviewing">Semakan</Chip>}
            onClick={() => {}}
          />
          <ListItem
            title="HP LaserJet M402"
            subtitle="Puan Siti · 4j lepas"
            trailing={<Chip tone="done">Selesai</Chip>}
            onClick={() => {}}
          />
          <ListItem
            title="Read-only row (no chevron, no hover)"
            subtitle="Demonstrates non-interactive variant"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-title-2 font-semibold">Bento grid (dashboard only)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <BentoCard>
            <p className="text-footnote text-[var(--fg-muted)]">Menunggu</p>
            <p className="text-title-1 font-semibold tabular-nums">12</p>
          </BentoCard>
          <BentoCard>
            <p className="text-footnote text-[var(--fg-muted)]">Dalam Pelaksanaan</p>
            <p className="text-title-1 font-semibold tabular-nums">5</p>
          </BentoCard>
          <BentoCard span={2}>
            <p className="text-footnote text-[var(--fg-muted)]">Trend (placeholder)</p>
            <div className="h-24 rounded-md bg-[var(--primary-tint)]" />
          </BentoCard>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-title-2 font-semibold">Modal</h2>
        <Modal
          trigger={<Button variant="destructive"><Trash2 className="h-4 w-4" />Padam Permohonan</Button>}
          title="Padam permohonan?"
          description="Tindakan ini tidak boleh dibatalkan."
        >
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="secondary">Batal</Button>
            <Button variant="destructive">Padam</Button>
          </div>
        </Modal>
      </section>

      <section className="space-y-4 pb-24">
        <h2 className="text-title-2 font-semibold">Bottom nav</h2>
        <p className="text-footnote text-[var(--fg-muted)]">
          Sentiasa tersemat bahagian bawah pada mobile. Skrol ke bawah untuk lihat safe-area padding.
        </p>
      </section>

      <BottomNav
        items={[
          { href: "/dashboard", label: "Utama", Icon: Home },
          { href: "/mohon", label: "Mohon", Icon: Plus },
          { href: "/semakan", label: "Semakan", Icon: ClipboardCheck },
          { href: "/semua", label: "Semua", Icon: FileText },
          { href: "/profil", label: "Profil", Icon: User },
        ]}
      />
    </div>
  );
}
