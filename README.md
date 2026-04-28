# whimsi

Turn your photos into stickers, build journey stories, and pin them on a shared map.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Database | Supabase Postgres |
| Storage | Supabase Storage (`stickers` bucket) |
| AI — sticker extraction | Replicate SAM2 + Sharp (background removal, transparent PNG) |
| AI — vision / detection | Google Gemini 2.0 Flash or Google Vision API (configurable) |
| AI — lesson generation | Google Gemini |
| Maps | Mapbox GL JS + Mapbox Directions API + Mapbox Static Images API |
| Share card image | `next/og` ImageResponse (Edge runtime) |
| Deployment | Vercel |

## Features

### Sticker Creation
- Upload a photo → AI (SAM2) extracts the main subject as a transparent sticker PNG
- Customize the sticker style before saving (outline, shadow, etc.)
- Add a voice note and caption to each sticker

### Journey Stories
- Group multiple stickers into a single Journey with a title/caption
- Two-phase creation flow: customize all stickers first, then caption each one
- Driving-directions route line connecting all stops (Mapbox Directions API fallback to straight line)
- Public or private visibility per journey

### Interactive Map (`/map`)
- All stickers and journeys plotted on a Mapbox GL map
- Tap a journey route line to highlight it and dim others
- Tap any sticker marker to open a detail sheet — swipe left/right to navigate through all stops in that journey
- Search by city/place name; locate-me button

### Feed (`/feed`)
- Dark-themed card feed of all journeys (public + your own private ones)
- Embedded mini-map per card showing the route and sticker positions
- Localized greeting (reverse-geocodes your position → greets you in the local language)
- Share to Feed, View journey, Share Card actions per journey
- Owner can delete their journey via a bottom sheet menu

### Journey Share Page (`/journey/[id]`)
- Full-screen Mapbox map for a single journey
- Tap any sticker → bottom sheet with photo, caption, voice note, location
- Swipe left/right (or use arrow buttons) to navigate between stops; map flies to each one
- Back button returns to wherever you came from; bottom nav present on all screens
- "Join whimsi" CTA shown only to unauthenticated viewers

### Share Card (`/api/share/journey/[id]`)
- Server-generated 1080×1080 OG image (Edge runtime) with:
  - Mapbox Static map with the route polyline
  - Sticker images overlaid at their exact GPS pixel positions (Mercator math)
  - Journey stats: stop count, date range, route locations

### Scrapbook (`/scrapbook`)
- Personal collage board of all your stickers

## Key Routes

| Route | Description |
|---|---|
| `/` | Landing / auth redirect |
| `/auth` | Sign up |
| `/auth/login` | Sign in |
| `/auth/onboard` | Post-signup onboarding (username, birthday, interests) |
| `/capture` | Create sticker or start a new journey |
| `/feed` | Journey feed (dark theme, embedded maps) |
| `/map` | Full interactive sticker + journey map |
| `/journey/[id]` | Single journey view with swipe navigation |
| `/s/[id]` | Public sticker share page |
| `/scrapbook` | Personal sticker collage |

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/vision` | POST | Detect objects in an image (Gemini or Google Vision) |
| `/api/sticker` | POST | Extract sticker via SAM2 + Sharp |
| `/api/sticker/save` | POST | Save sticker record to Supabase |
| `/api/stickers` | GET | Fetch stickers (optionally excluding journey stickers) |
| `/api/stickers/[id]` | DELETE | Delete a sticker |
| `/api/journey/save` | POST | Save a full journey with ordered stickers |
| `/api/journeys` | GET | Fetch journeys for a user (public + private) |
| `/api/journeys/[id]` | PATCH / DELETE | Update visibility or delete a journey |
| `/api/lesson` | POST | Generate a Gemini micro-lesson for a detected object |
| `/api/share/journey/[id]` | GET | Generate the 1080×1080 share card image (Edge) |

## Getting Started (Local Setup)

**1. Clone the repository**
```bash
git clone https://github.com/delvin-afk/whimsi.git
cd whimsi
```

**2. Install dependencies** (requires Node.js 18+)
```bash
npm install
```

**3. Set up environment variables**

Create `.env.local` in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Gemini (sticker detection + lesson generation)
GEMINI_API_KEY=your_google_ai_studio_key

# Replicate (SAM2 sticker extraction)
REPLICATE_API_TOKEN=your_replicate_token

# Mapbox (maps, directions, geocoding, share card)
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_public_token

# Optional: switch vision provider (default: google_vision)
DETECTOR_PROVIDER=gemini
```

> `.env.local` is git-ignored — never commit it.  
> `SUPABASE_SERVICE_ROLE_KEY` is server-only (API routes only).

**4. Supabase setup (one-time)**

Tables needed: `profiles`, `stickers`, `journeys`  
Storage bucket: `stickers` (public read)  
Enable Google OAuth under Authentication → Providers  
Add your local and production URLs to Authentication → URL Configuration

**5. Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deployed on Vercel. Add all env vars under **Settings → Environment Variables**.  
The share card route (`/api/share/journey/[id]`) runs on the Edge runtime — no additional config needed.
