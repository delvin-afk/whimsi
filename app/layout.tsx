import "./globals.css";
import { Righteous } from "next/font/google";
import type { Viewport } from "next";
import BottomNav from "@/components/BottomNav";

const righteous = Righteous({ subsets: ["latin"], weight: "400", variable: "--font-righteous" });

export const metadata = {
  title: "whimsi",
  description: "Turn your travels into stickers",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f0f0f" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="whimsi" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
      </head>
      <body className={`min-h-screen bg-neutral-50 text-neutral-900 ${righteous.variable}`}>
        <div style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom) + 16px)" }}>{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
