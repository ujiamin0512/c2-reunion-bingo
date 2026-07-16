# Load testing — 10th Anniversary Reunion Bingo

k6 scripts that load-test the app's actual backend (Supabase PostgREST +
Storage — there's no custom server) at ~500 concurrent users. See
`../supabase-schema.sql` for the schema these scripts exercise.

**Run these against a throwaway test Supabase project, never against the live
`c2-reunion-bingo-2026` project.** They will insert thousands of fake
participants/submissions and upload thousands of fake photos.

## Setup

1. Create a new (free-tier is fine) Supabase project for testing only.
2. Run `../supabase-schema.sql` in its SQL editor to create the tables, RLS
   policies, and seed the 8 default tasks.
3. In Storage, create a **public** bucket named `bingo-images` (the schema
   file's storage.objects policies already cover it).
4. Install k6: https://k6.io/docs/get-started/installation/
5. Set env vars (values from the test project's Settings > API):
   ```
   export K6_SUPABASE_URL=https://your-test-project.supabase.co
   export K6_SUPABASE_ANON_KEY=your-test-project-anon-key
   ```

## Scripts

| Script | Mirrors | Focus |
|---|---|---|
| `register.js` | `createParticipant` + `findExistingParticipant` | Registration burst at check-in; the full-table `getAllParticipants` dedup scan is the specific risk this targets |
| `upload-flow.js` | Full user journey: register → getTasks → 8× photo upload → submit | **The main scenario** — run this at full 500-VU scale first |
| `board-read.js` | `getTasks` + `getSubmissions` | Background "checking my progress" polling |
| `admin-read.js` | `getAllSubmissions` | Admin dashboard's heavy unpaginated join, under concurrent write load |

## Running

Smoke-test each script at low VU count before scaling up, to confirm the
script itself is correct against the real API:

```
SMOKE_TEST=true k6 run load-test/register.js
SMOKE_TEST=true k6 run load-test/upload-flow.js
SMOKE_TEST=true k6 run load-test/board-read.js
SMOKE_TEST=true k6 run load-test/admin-read.js
```

(`SMOKE_VUS` and `SMOKE_DURATION` env vars override the defaults of ~10 VUs /
~30s-1m if you want a different quick check.)

Then run the full scenarios. Each script's ramp/spike stages target 500 VUs
by default — override with `TARGET_VUS=300` (or any count) to scale the
whole shape down:

```
k6 run load-test/register.js
k6 run load-test/upload-flow.js
k6 run load-test/board-read.js

# or, e.g. for a 300-user event:
TARGET_VUS=300 k6 run load-test/upload-flow.js
```

For a realistic "event in progress" picture, run `upload-flow.js` and
`admin-read.js` concurrently (two terminals) so the admin dashboard's read
latency is measured under real write load, and optionally `board-read.js` in
a third terminal to add background polling traffic.

## What to watch

- k6's own summary output: threshold pass/fail per script (see each script's
  `options.thresholds`), and p95/p99 latency per tagged request name.
- The test Supabase project's dashboard **Database → Reports** (connection
  count, query performance) and **Storage → Reports** (bandwidth) while a run
  is in progress.
- In `register.js`, compare `dedup_check_duration` (the `getAllParticipants`
  scan) against `register_duration` (the plain insert) — if the dedup check
  is meaningfully slower and grows over the run, that confirms the client-side
  full-table-scan dedup approach won't hold up at check-in-time concurrency.

## What this suite does NOT cover

k6 generates load from wherever you run it — fast, wired, single machine. It
validates the Supabase backend but can't simulate:

- Client-side canvas image compression time on real (possibly older/slower)
  phones — `compressImage()` in `src/lib/db.ts` runs entirely in-browser.
- Real venue WiFi/cellular conditions with 500 phones on the same network.
- Actual page-load/JS-bundle performance on mobile devices.

Recommend a short manual smoke test with a few real phones on the actual
venue network before the event as a complement to this suite, not a
replacement for it.
