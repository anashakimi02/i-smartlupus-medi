"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, CreditCard, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { icToEmail, validateIc } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [ic, setIc] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleIcChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
    setIc(digits);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateIc(ic)) {
      toast.error("No. Kad Pengenalan mestilah 12 digit.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: icToEmail(ic),
      password,
    });

    if (error) {
      toast.error("No. KP atau kata laluan tidak sah.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-blue-100 p-8">
        {/* Logo area */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-md mb-4">
            <KeyRound className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-blue-600 tracking-wide">
            i-SMARTLUPUS
          </h1>
          <p className="text-sm text-gray-500 mt-1 text-center">
            Sistem Pelupusan Aset Perubatan
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* IC Number */}
          <div>
            <label
              htmlFor="ic"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              No. Kad Pengenalan
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <CreditCard className="w-5 h-5 text-gray-400" />
              </span>
              <input
                id="ic"
                type="text"
                inputMode="numeric"
                placeholder="Cth: 900101011234"
                value={ic}
                onChange={handleIcChange}
                maxLength={12}
                autoComplete="username"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Kata Laluan
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Masukkan kata laluan"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
                aria-label={showPassword ? "Sembunyikan kata laluan" : "Tunjukkan kata laluan"}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-md transition-colors duration-150 text-base mt-2"
          >
            {loading ? "Memuatkan..." : "Log Masuk"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          &copy; 2026 i-SMARTLUPUS MEDI
        </p>
      </div>
    </main>
  );
}
