import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

// Display: characterful grotesque for headings (kills the templated feel).
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-display",
});

// Body: Public Sans — a government-commissioned typeface, maximum legibility for Malay form/data text.
const body = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "i-SMARTLUPUS",
  description: "Sistem Pelupusan Aset Hospital Besut",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms" className={`${display.variable} ${body.variable}`}>
      <body className="antialiased font-sans" style={{ background: "var(--bg)", color: "var(--fg)" }}>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
