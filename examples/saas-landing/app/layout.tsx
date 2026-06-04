import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["600", "700", "800"],
  preload: true,
});

export const metadata: Metadata = {
  title: "Platform — High-performance SaaS landing",
  description: "Launch, convert, and scale with a performance-first SaaS platform.",
  metadataBase: new URL("https://example.com"),
  openGraph: {
    title: "Platform — High-performance SaaS landing",
    description: "Launch, convert, and scale with a performance-first SaaS platform.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
