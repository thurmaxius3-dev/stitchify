-- Stitchify — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists public.projects (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  width           integer not null,
  height          integer not null,
  color_system    text not null default 'DMC',
  color_count     integer not null default 0,
  progress        double precision not null default 0,
  stitched        integer not null default 0,
  total           integer not null default 0,
  matrix          integer[] not null,
  done_matrix     integer[] not null,
  active_dmc_indices integer[],
  origin_x        integer not null default 0,
  origin_y        integer not null default 0,
  updated_at      timestamptz not null default now()
);

-- Index for fast per-user queries
create index if not exists projects_user_id_updated_at
  on public.projects (user_id, updated_at desc);

-- Row-level security: users can only see/edit their own projects
alter table public.projects enable row level security;

create policy "Users can read own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);
