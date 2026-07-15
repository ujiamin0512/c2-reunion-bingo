-- ============================================================
-- Supabase Schema: 10th Anniversary Reunion Bingo App
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Participants
create table if not exists participants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  identity        text not null check (identity in ('alumni', 'teacher')),
  graduation_year int,
  task_order      jsonb not null default '[]',
  created_at      timestamptz default now(),
  submitted_at    timestamptz
);

-- Tasks
create table if not exists tasks (
  id          serial primary key,
  title       text not null,
  description text,
  icon        text not null default '📷',
  is_active   boolean not null default true,
  board_size  int not null default 3 check (board_size in (3,4,5)),
  created_at  timestamptz default now()
);

-- Submissions (one per participant per task)
create table if not exists submissions (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  task_id        int not null references tasks(id) on delete cascade,
  image_url      text not null,
  status         text not null default 'draft' check (status in ('draft','pending','approved','rejected')),
  created_at     timestamptz default now(),
  unique(participant_id, task_id)
);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table participants enable row level security;
alter table tasks enable row level security;
alter table submissions enable row level security;

-- Tasks: public read, and admin-managed create/update/delete
-- (No server-side auth exists in this app; the admin gate is a client-side
-- password check, so these policies stay open like participants/submissions.)
create policy "tasks_read" on tasks for select using (true);
create policy "tasks_insert" on tasks for insert with check (true);
create policy "tasks_update" on tasks for update using (true) with check (true);
create policy "tasks_delete" on tasks for delete using (true);

-- Participants: full CRUD (no server-side auth exists in this app; the admin
-- gate and per-user "own data" model are both enforced client-side only)
create policy "participants_insert" on participants for insert with check (true);
create policy "participants_select" on participants for select using (true);
create policy "participants_update" on participants for update using (true) with check (true);
create policy "participants_delete" on participants for delete using (true);

-- Submissions: full CRUD
create policy "submissions_insert" on submissions for insert with check (true);
create policy "submissions_select" on submissions for select using (true);
create policy "submissions_update" on submissions for update using (true);
create policy "submissions_delete" on submissions for delete using (true);

-- ── Storage bucket ──────────────────────────────────────────────────────────
-- Create bucket "bingo-images" in Storage > Buckets, set to Public.
-- The "Public" toggle only affects anonymous GET/download access — it does NOT
-- grant INSERT/UPDATE/DELETE. You must also add RLS policies on storage.objects
-- (Storage > Policies, or run the SQL below) or uploads will silently no-op:
create policy "bingo_images_select" on storage.objects for select using (bucket_id = 'bingo-images');
create policy "bingo_images_insert" on storage.objects for insert with check (bucket_id = 'bingo-images');
create policy "bingo_images_update" on storage.objects for update using (bucket_id = 'bingo-images') with check (bucket_id = 'bingo-images');
create policy "bingo_images_delete" on storage.objects for delete using (bucket_id = 'bingo-images');

-- ── Seed default tasks (3×3) ────────────────────────────────────────────────
insert into tasks (title, description, icon, board_size) values
  ('和同学合影',      '与老同学拍一张合照',     '👥', 3),
  ('和班主任合影',    '与班主任拍合照',           '🎓', 3),
  ('参观回忆墙',      '拍下你最喜欢的回忆',       '🖼️', 3),
  ('找到最好的朋友',  '找到你最好的朋友并合影',   '❤️', 3),
  ('拍一张集体自拍',  '与5人以上拍自拍',           '📷', 3),
  ('找到你以前的教室','在你的旧教室前拍照',       '🚪', 3),
  ('在礼堂前拍照',    '在礼堂正门前留影',         '🏛️', 3),
  ('在校门口拍照',    '在校门口来一张',           '⭐', 3)
on conflict do nothing;
