"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { MobileDrawer } from "@/components/MobileDrawer";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { getBreadcrumbs } from "@/lib/breadcrumbs";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "sidebar-collapsed";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(COLLAPSE_KEY) : null;
    if (stored === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!data) {
        router.push("/login");
        return;
      }

      setProfile(data as Profile);
      setLoading(false);
    }

    loadProfile();
  }, [router]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, String(next));
  }

  async function handleLogOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <p className="text-sm text-[var(--fg-muted)]">Memuatkan...</p>
      </div>
    );
  }

  if (!profile) return null;

  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <AppHeader
        sidebarCollapsed={collapsed}
        onToggleSidebar={toggleCollapsed}
        onOpenDrawer={() => setDrawerOpen(true)}
        name={profile.full_name}
        role={profile.role}
        onLogOut={handleLogOut}
      />
      <Sidebar
        role={profile.role}
        collapsed={collapsed}
      />
      <main
        className={cn(
          "transition-[margin-left] duration-base ease-ios-out pt-16",
          collapsed ? "md:ml-16" : "md:ml-60",
          "pb-20 md:pb-0",
        )}
      >
        <div className="max-w-screen-2xl mx-auto px-4 py-6">
          {breadcrumbs.length > 1 && (
            <div className="mb-4 md:mb-5">
              <Breadcrumbs segments={breadcrumbs} />
            </div>
          )}
          {children}
        </div>
      </main>
      <BottomNav role={profile.role} />
      <MobileDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        role={profile.role}
      />
    </div>
  );
}
