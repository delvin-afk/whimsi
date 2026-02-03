export default function HomePage() {
  return (
    <main className="space-y-4">
      <h1 className="text-3xl font-semibold">Turn moments into lessons</h1>
      <p className="opacity-80">
        Upload a photo, detect objects, and generate micro-lessons in your
        target language.
      </p>

      <div className="flex gap-3">
        <a className="px-4 py-2 rounded-xl border" href="/capture">
          Go to Capture
        </a>
        <a className="px-4 py-2 rounded-xl border" href="/feed">
          View Feed
        </a>
      </div>
    </main>
  );
}

// export default function Home() {
//   return (
//     <div className="p-8 bg-red-200 rounded-2xl text-red-900">
//       Tailwind works ✅
//     </div>
//   );
// }
