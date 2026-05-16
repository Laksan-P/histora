-- Histora Phase 3: admin CRUD schema & RLS
--
-- Run this after 0002_auth_profiles.sql. It is fully idempotent.
--
-- This migration:
--   1. Adds two optional columns the admin UI references:
--        events.image_url
--        characters.voice_style
--      (each guarded with IF NOT EXISTS so it's safe to re-run).
--   2. Creates public.source_notes if it does not already exist, with the
--      shape the admin UI expects (event_id, character_id, content,
--      citation_label, citation_url, tag, timestamps).
--   3. Re-applies public-read / admin-write RLS to events, characters and
--      source_notes so admins can full-CRUD the curated catalog from the
--      client. The previous migration only added these policies for tables
--      that already existed; this re-applies them safely.
--   4. Adds an updated_at trigger so source_notes rows touch themselves on
--      every UPDATE without needing client-side bookkeeping.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. extra columns on the existing catalog tables
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.events') is not null then
    execute 'alter table public.events add column if not exists image_url text';
  end if;

  if to_regclass('public.characters') is not null then
    execute 'alter table public.characters add column if not exists voice_style text';
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 2. source_notes table
-- ---------------------------------------------------------------------------
create table if not exists public.source_notes (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  character_id text,
  content text not null,
  citation_label text,
  citation_url text,
  tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists source_notes_event_idx
  on public.source_notes (event_id);
create index if not exists source_notes_character_idx
  on public.source_notes (character_id);
create index if not exists source_notes_updated_at_idx
  on public.source_notes (updated_at desc);

alter table public.source_notes enable row level security;

drop policy if exists "source_notes public read"  on public.source_notes;
drop policy if exists "source_notes admin write"  on public.source_notes;

create policy "source_notes public read"
  on public.source_notes for select using (true);

create policy "source_notes admin write"
  on public.source_notes for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. re-apply RLS on events / characters
--
-- 0002 already added these policies, but only when each table existed at the
-- time the migration ran. This block re-applies them so any project that
-- created the catalog tables after 0002 still ends up correctly locked down.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.events') is not null then
    execute 'alter table public.events enable row level security';
    execute 'drop policy if exists "events public read"  on public.events';
    execute 'drop policy if exists "events admin write"  on public.events';
    execute $sql$create policy "events public read"  on public.events for select using (true)$sql$;
    execute $sql$create policy "events admin write"  on public.events for all using (public.is_admin()) with check (public.is_admin())$sql$;
  end if;

  if to_regclass('public.characters') is not null then
    execute 'alter table public.characters enable row level security';
    execute 'drop policy if exists "characters public read" on public.characters';
    execute 'drop policy if exists "characters admin write" on public.characters';
    execute $sql$create policy "characters public read" on public.characters for select using (true)$sql$;
    execute $sql$create policy "characters admin write" on public.characters for all using (public.is_admin()) with check (public.is_admin())$sql$;
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 4. updated_at trigger for source_notes
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_source_notes_updated_at on public.source_notes;
create trigger trg_source_notes_updated_at
  before update on public.source_notes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Notes on cascade behaviour
--
-- We intentionally do NOT add ON DELETE CASCADE between events/characters and
-- source_notes. The admin UI surfaces an explicit warning whenever an event
-- or character is deleted so the operator stays in control of what's
-- removed; cascading at the DB level would silently destroy citations that
-- still appear in archived conversations.
-- ---------------------------------------------------------------------------
