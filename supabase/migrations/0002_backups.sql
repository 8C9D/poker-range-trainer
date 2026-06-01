-- v3 cloud sync: full-library backup, one row per user.
-- This file documents the schema for whoever provisions the Supabase project.
-- It is NOT executed by the app or the test suite.

create table if not exists public.backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row-level security: a user may only see and modify their own backup.
alter table public.backups enable row level security;

create policy "Backups are readable by owner"
  on public.backups for select
  using (auth.uid() = user_id);

create policy "Backups are insertable by owner"
  on public.backups for insert
  with check (auth.uid() = user_id);

create policy "Backups are updatable by owner"
  on public.backups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Backups are deletable by owner"
  on public.backups for delete
  using (auth.uid() = user_id);
