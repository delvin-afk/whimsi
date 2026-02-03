import PostCard from "@/components/PostCard";
import type { PostRow } from "@/types";

export default async function FeedPage() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL ? "" : ""}/api/posts`,
    {
      // In Next App Router, relative fetch works server-side too
      cache: "no-store",
    },
  );

  const json = await res.json();
  const posts: PostRow[] = json.posts ?? [];

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Feed</h1>

      {posts.length === 0 ? (
        <p className="opacity-70">No posts yet. Go to Capture and save one.</p>
      ) : (
        <div className="grid gap-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </main>
  );
}
