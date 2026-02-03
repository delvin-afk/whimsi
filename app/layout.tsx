import "./globals.css";

export const metadata = {
  title: "AI Language Immersion",
  description: "Turn daily moments into language lessons",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black">
        <div className="max-w-5xl mx-auto p-6">
          <header className="flex items-center justify-between mb-6">
            <a href="/" className="font-semibold text-lg">
              AI Lang Immersion
            </a>
            <nav className="flex gap-4 text-sm">
              <a className="underline" href="/capture">
                Capture
              </a>
              <a className="underline" href="/feed">
                Feed
              </a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
