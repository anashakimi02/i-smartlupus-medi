import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "i-SMARTLUPUS MEDI",
  description: "Sistem Pengurusan Pelupusan Aset Perubatan",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms" className={inter.variable}>
      <body className="antialiased font-sans" style={{ background: "var(--bg)", color: "var(--fg)" }}>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
