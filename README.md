# whimsi

Turn your photos into stickers and pin them on a map.

## Tech Stack

- **Frontend & API:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **Database & Storage:** Supabase (Postgres + Storage)
- **AI / Sticker extraction:** Google Gemini, Replicate (SAM2), Sharp
- **Maps:** Mapbox GL JS
- **Language:** TypeScript

## Features

- Onboarding flow for new users (name, birthday, interests, permissions)
- Upload a photo → AI extracts the subject as a transparent sticker
- Pin stickers on an interactive map with location tagging
- Feed showing all shared stickers with captions and timestamps
- Delete or edit captions on your own stickers

## Getting Started (Local Setup)

**1. Clone the repository**
```
git clone https://github.com/delvin-afk/whimsi.git
cd whimsi
```

**2. Install dependencies** (requires Node.js 18+)
```
npm install
```

**3. Set up environment variables**

Create `.env.local` in the project root:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Gemini
GEMINI_API_KEY=your_google_ai_studio_key

# Replicate (SAM2 sticker extraction)
REPLICATE_API_TOKEN=your_replicate_token

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token
```

> `.env.local` is git-ignored — never commit it.
> `SUPABASE_SERVICE_ROLE_KEY` is server-only (used in API routes only).

**4. Supabase setup (one-time)**

In your Supabase project, create:

- Storage bucket: `Stickers`
- Tables: `profiles`, `stickers`
- Enable Google OAuth under Authentication → Providers
- Add your local and production URLs to Authentication → URL Configuration

**5. Run the development server**
```
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Key Routes

| Route | Description |
|---|---|
| `/` | Landing / auth check |
| `/auth` | Sign up |
| `/auth/login` | Sign in |
| `/auth/onboard` | Post-OAuth onboarding |
| `/capture` | Upload photo and make a sticker |
| `/feed` | View all shared stickers |
| `/map` | Interactive sticker map |
| `/scrapbook` | Personal scrapbook |

## Deployment

Deployed on Vercel. Add all env vars under **Settings → Environment Variables** in the Vercel dashboard.
