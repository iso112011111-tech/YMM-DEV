import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk, DM_Mono } from "next/font/google";
import { SITE_CONFIG } from "@/data/siteData";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#07111f",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: SITE_CONFIG.title,
  description: SITE_CONFIG.description,
  keywords: [
    "Discord Bot",
    "YMM-DEV",
    "YMM-MUSIC",
    "บอทเพลง",
    "บอทดิสคอร์ด",
    "Discord Bot Marketplace",
    "Music Bot",
  ],
  authors: [{ name: "YMM-DEV" }],
  creator: "YMM-DEV",
  publisher: "YMM-DEV",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://ymm-dev.com"),
  openGraph: {
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
    siteName: SITE_CONFIG.name,
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${manrope.variable} ${spaceGrotesk.variable} ${dmMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
