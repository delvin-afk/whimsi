import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata = {
  title: "Stickermap",
  description: "Turn your travels into stickers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <div className="pb-20">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
