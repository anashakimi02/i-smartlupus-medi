"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (emailError) setEmailError(undefined);
  }

  function handleEmailBlur() {
    if (email.length === 0) {
      setEmailError(undefined);
      return;
    }
    if (!isValidEmail(email)) {
      setEmailError("Alamat e-mel tidak sah.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidEmail(email)) {
      toast.error("Sila masukkan alamat e-mel yang sah.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      toast.error("E-mel atau kata laluan tidak sah.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative min-h-dvh flex items-center justify-center px-6 py-12">
      {/* Decorative only — the page is fully usable if the image never loads. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />
      {/* Wash: the photo is light and busy, and the card is near-white.
          Without this the card edges disappear into the hexagons. */}
      <div aria-hidden className="absolute inset-0 bg-[rgba(255,255,255,0.72)]" />

      <div className="relative w-full max-w-lg space-y-6 rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-[var(--shadow-premium)]">
        <header className="flex flex-col items-center">
          <img
            src="/logo.png"
            alt="i-SMARTLUPUS"
            className="w-72 h-auto object-contain"
          />
        </header>

        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-title-2 font-bold text-[#0a2540] tracking-tight">
              Selamat Datang
            </h2>
            <p className="mt-1 text-footnote text-[var(--fg-muted)]">
              Log masuk dengan e-mel rasmi anda untuk akses ke sistem.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              label="E-mel"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="email@moh.gov.my"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              error={emailError}
              required
              leading={<Mail className="h-4 w-4 text-[#1b7543]" />}
              className="border-[#1b7543]/20 focus:border-[#1b7543] focus:ring-[#1b7543]/30"
            />
            <Input
              id="password"
              label="Kata Laluan"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Masukkan kata laluan"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              leading={<Lock className="h-4 w-4 text-[#1b7543]" />}
              className="border-[#1b7543]/20 focus:border-[#1b7543] focus:ring-[#1b7543]/30"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan kata laluan" : "Tunjukkan kata laluan"}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-md text-[var(--fg-muted)] hover:text-[#1b7543] hover:bg-[#1b7543]/10 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <Button
              type="submit"
              size="lg"
              loading={loading}
              disabled={loading || email.length === 0 || password.length === 0}
              className="w-full mt-4 bg-[#1b7543] hover:bg-[#155430] active:scale-[0.98] transition-all duration-200 border-none rounded-xl h-12 text-white font-bold flex items-center justify-center gap-2"
            >
              {!loading && <LogIn className="h-5 w-5" />}
              <span>Log Masuk</span>
            </Button>
          </form>
        </div>

        <p className="text-center text-footnote text-[var(--fg-muted)]">
          Masalah log masuk?{" "}
          <a href="tel:+60312345678" className="text-[var(--primary)] font-medium hover:underline">
            Hubungi Unit Aset
          </a>
        </p>
      </div>
    </main>
  );
}
