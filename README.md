# OFFICE BARDAGULAN 2100

**Walang personalan, bardagulan lang!**
**2,100+ tanong. 21 pangalan. Walang ligtas sa tawanan!**

A Filipino office party "who's most likely to…" voting game. Everyone joins a room with a code,
votes anonymously on 21 coworker names, and the host reveals the results for confetti-powered chaos.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS v4, Supabase (Postgres) and Zod. Vercel-ready.

## How it works

- **Rooms**: the host creates a room, shares the 6-character code or link, players join with an anonymous nickname.
- **Modes**: Quick (10 mixed), Full (Round 1 to 3 in order), Category, Random Mix, Host-Led (host picks every question from the library).
- **Voting**: one vote per player per question, optional timer (host can pause/resume), results hidden until the host taps **Reveal**.
- **Finish**: final leaderboard with podium and a recap of every question.
- **Library**: `/library` lets anyone browse and search all 2,100 questions (800 Office Kalokohan, 650 Lovelife Edition, 650 Walang Takas).

### Security model

All database access goes through Next.js API routes using the Supabase **service-role key** (server only).
The browser never talks to the tables directly (migration `002` removes every anon policy), so:

- host-only actions are checked on the server on every request,
- nobody can read votes before the host reveals them,
- session tokens are random 256-bit values and only their SHA-256 hash is stored.

Clients stay in sync by polling `/api/rooms/[code]/state` every 1.5 s. `localStorage` only remembers your
session token so a refresh doesn't kick you out.

## Setup

### 1. Supabase

1. Create a project at supabase.com.
2. In **SQL Editor**, run these files **in order**:
   1. `supabase/migrations/001_initial_schema.sql`
   2. `supabase/migrations/002_lock_down_rls.sql`
3. In **Project Settings, API**, copy the project URL, the `anon` key and the `service_role` key.

### 2. Environment variables

Copy `.env.example` to `.env.local` for local dev, and add the same three variables in
**Vercel, Project, Settings, Environment Variables**:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server only, never expose
```

Redeploy after adding them.

### 3. Run locally

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

Push to GitHub, import the repo in Vercel, add the env vars, deploy.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Standard Next.js |
| `npm run validate:questions` | Checks the question bank is exactly 2,100 (800/650/650), unique IDs, no placeholders |
| `npm test` | Unit tests (modes, tally, vote rules, tokens) and API integration tests against an in-memory fake DB |
| `npm run seed` | Optional: copies questions into the Supabase `questions` table (the game reads `data/questions.json` directly) |
| `npm run generate:questions` | Regenerates `data/questions.json` |

## Privacy notice

Participants use anonymous nicknames only. No email, real name or phone is required. Nicknames do not guarantee
complete infrastructure-level anonymity (e.g. hosting logs). Votes stay hidden until the host reveals results. Who voted
for whom is never shown, only the totals. Rooms are active for 24 hours, then marked expired and deleted after 7 days
(call `select cleanup_expired_rooms();` on a schedule, e.g. Supabase cron, to enforce this).

## Known limitations

- Polling (not websockets) means up to ~1.5 s delay between devices. Fine for a party of up to 60.
- No rate limiting on join/vote beyond the one-vote-per-question database constraint. Fine for a private office game.
- The question similarity warnings printed by `validate:questions` are informational.
