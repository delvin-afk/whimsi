import "./globals.css";
import { Righteous } from "next/font/google";
import BottomNav from "@/components/BottomNav";

const righteous = Righteous({ subsets: ["latin"], weight: "400", variable: "--font-righteous" });

export const metadata = {
  title: "whimsi",
  description: "Turn your travels into stickers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`min-h-screen bg-neutral-50 text-neutral-900 ${righteous.variable}`}>
        <div className="pb-24">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
