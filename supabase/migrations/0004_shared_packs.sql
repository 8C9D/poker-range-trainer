-- v5.1 shared range packs: a published BUNDLE of ranges reachable by an
-- unguessable id (the pack counterpart of 0003_shared_ranges). This file
-- documents the schema for whoever provisions the Supabase project. It is NOT
-- executed by the app or the test suite.

create table if not exists public.shared_packs (
  id text primary key,                       -- unguessable share id (used in /p/:id)
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,                        -- the shared pack payload (a RangePack envelope)
  is_public boolean not null default false,   -- public: readable by id alone; private: needs token
  token text,                                 -- secret for private links (null for public)
  created_at timestamptz not null default now()
);

-- Row-level security: owners manage their own rows. Reads by visitors go through
-- the SECURITY DEFINER function below (which enforces public-or-correct-token),
-- so no broad SELECT policy is granted to anonymous clients.
alter table public.shared_packs enable row level security;

create policy "Shared packs are selectable by owner"
  on public.shared_packs for select
  using (auth.uid() = owner_id);

create policy "Shared packs are insertable by owner"
  on public.shared_packs for insert
  with check (auth.uid() = owner_id);

create policy "Shared packs are updatable by owner"
  on public.shared_packs for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Shared packs are deletable by owner"
  on public.shared_packs for delete
  using (auth.uid() = owner_id);

-- Token-gated read for visitors: returns the payload when the row is public, or
-- when the supplied token matches a private row. Runs as definer to bypass RLS
-- while still enforcing the public-or-token check itself.
create or replace function public.get_shared_pack(p_id text, p_token text default null)
  returns jsonb
  language sql
  security definer
  set search_path = public
as $$
  select data
  from public.shared_packs
  where id = p_id
    and (is_public or (token is not null and token = p_token))
$$;

grant execute on function public.get_shared_pack(text, text) to anon, authenticated;
