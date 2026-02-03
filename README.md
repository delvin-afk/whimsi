# AI Langauage Immersion


## Tech Stack

- Frontend & API: Next.js 15 (App Router)

- Styling: Tailwind CSS v4

- AI: Google Gemini (Vision + Text) 

- Backend services: Supabase (Database + Storage)

- Language: TypeScript


## Project Structure High Level

<img width="527" height="430" alt="image" src="https://github.com/user-attachments/assets/4617c182-752a-47a7-a63e-1312fb1f56ce" />


## Getting Started (Local Setup)

1️⃣ Clone the repository
- git clone https://github.com/<your-org-or-username>/ai-lang-immersion.git
- cd ai-lang-immersion

2️⃣ Install dependencies

- Requires Node.js 18 or newer

- npm install

3️⃣ Set up environment variables

Create a file called .env.local in the project root:

# Google Gemini
GEMINI_API_KEY=your_google_ai_studio_key

# Supabase
- NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
- SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

⚠️ Important

.env.local is ignored by git — do not commit it

SUPABASE_SERVICE_ROLE_KEY is server-only (used in API routes)

4️⃣ Supabase setup (one-time)

In your Supabase project:

Create a storage bucket called moments

Create tables:

-  posts

-  detections

-  lessons

(For MVP) Allow server inserts using the service role key

Table schemas are documented in code comments and API routes.

5️⃣ Run the development server
- npm run dev


Open:

http://localhost:3000
 → Home

http://localhost:3000/capture
 → Upload & detect objects

http://localhost:3000/feed
 → View saved posts
