-- v3 cloud sync: per-user saved ranges.
-- This file documents the schema for whoever provisions the Supabase project.
-- It is NOT executed by the app or the test suite.

create table if not exists public.ranges (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists ranges_user_id_idx on public.ranges (user_id);

-- Row-level security: a user may only see and modify their own ranges.
alter table public.ranges enable row level security;

create policy "Ranges are readable by owner"
  on public.ranges for select
  using (auth.uid() = user_id);

create policy "Ranges are insertable by owner"
  on public.ranges for insert
  with check (auth.uid() = user_id);

create policy "Ranges are updatable by owner"
  on public.ranges for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Ranges are deletable by owner"
  on public.ranges for delete
  using (auth.uid() = user_id);
