<div align="center">
  <img src="public/logo.jpeg" alt="10th Anniversary Reunion" width="120" />

  # 十周年校友聚会 Bingo

  A mobile-first photo-bingo game built for a Class of 2016 10th anniversary
  reunion. Alumni and teachers register, get a shuffled 3×3 board of photo
  tasks, snap pictures to complete tiles, and race for Bingo lines — all
  reviewed live from an admin dashboard.

  🔗 **[c2-reunion-bingo.vercel.app](https://c2-reunion-bingo.vercel.app)**
</div>

---

## How it works

1. **Register** — a guest enters their name and identity (alumni + graduation
   year, or teacher). Returning names are matched and resumed automatically.
2. **Play** — each participant gets a randomly shuffled 3×3 board (8 photo
   tasks + 1 free center tile). Tapping an empty tile opens the camera/file
   picker; the photo is compressed client-side and uploaded to Supabase
   Storage as a `draft` submission.
3. **Submit** — once ready, the player submits their board, flipping all
   drafts to `pending` for review.
4. **Review** — an admin approves or rejects each pending photo. Rejected
   tiles reopen for the player to retry.
5. **Bingo** — a tile counts toward a line once its submission is anything
   but `rejected`. Completing all 8 possible lines (3 rows, 3 columns, 2
   diagonals) finishes the board. Boards can be downloaded as a shareable
   PNG card at any time.

> [!NOTE]
> There is no real backend server or user auth — Supabase (Postgres +
> Storage) is called directly from the client via `@supabase/supabase-js`,
> and RLS policies are left open. The "admin" and "per-participant" access
> models are enforced client-side only (see `supabase-schema.sql` for the
> reasoning). This is a fine trade-off for a single-event, trusted-audience
> app, but do not reuse this pattern for anything sensitive.

## Tech stack

- **React 19** + **TypeScript**, bundled with **Vite** and **Tailwind CSS 4**
- **react-router-dom** for client-side routing
- **Supabase** (Postgres + Storage) as the only backend
- **framer-motion** for transitions, **react-confetti** for celebrations,
  **html2canvas-pro** for exporting shareable board images
- Deployed on **Vercel** (`vercel.json` rewrites all routes to `index.html`
  for the SPA)

If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are not set, the app falls
back to a single-user `localStorage`-backed mode — handy for local UI work
without a Supabase project.

## Project structure

```
src/
  pages/        LandingPage, RegisterPage, WelcomePage, BingoPage,
                ProfilePage, AdminPage
  components/   BingoTile, BottomNav, ...
  lib/
    supabase.ts   Supabase client + isSupabaseConfigured()
    db.ts         All data access: participants, tasks, submissions,
                  image upload/compression, and the Bingo line-checking logic
    shareImage.ts Canvas → downloadable PNG helper
  types.ts      Participant / Task / Submission / Identity / BoardSize
supabase-schema.sql   Tables, RLS policies, storage bucket policies, seed tasks
load-test/            k6 scripts load-testing the Supabase backend directly
```

## Getting started

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
VITE_ADMIN_PASSWORD=choose-your-own-admin-password
```

Then set up Supabase:

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase-schema.sql` in the SQL editor — it creates the
   `participants`, `tasks`, and `submissions` tables, opens RLS policies, and
   seeds the default 8 photo tasks.
3. In **Storage**, create a **public** bucket named `bingo-images`. Public
   only grants read access — the schema file also adds the insert/update/
   delete storage policies uploads need.

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Admin access

Tap the gear icon on the landing page (or navigate to `/admin`) and enter
`VITE_ADMIN_PASSWORD`. The dashboard covers:

- **参与者 (Participants)** — search/filter, manual add/edit/delete, CSV export
- **任务管理 (Tasks)** — manage the pool of photo tasks per board size (3×3,
  4×4, 5×5 supported at the schema level; the app currently plays 3×3)
- **提交审核 (Submissions)** — review photos grouped by participant, approve
  or reject in one pass
- **排行榜 (Leaderboard)** — ranked by completed Bingo lines

## Load testing

`load-test/` contains k6 scripts that exercise the real Supabase backend
(registration bursts, the full upload → submit journey, board polling, and
the admin dashboard's unpaginated reads) at up to ~500 concurrent users. See
`load-test/README.md` for setup and running instructions — **always point
these at a throwaway test project**, never at the production Supabase
project.
