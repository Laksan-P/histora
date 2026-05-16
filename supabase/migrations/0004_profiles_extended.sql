-- Histora Phase 4: Extended user profile fields + storage for avatars
--
-- Run this after 0003_admin_crud.sql. Fully idempotent: every column add,
-- policy drop, function create, and trigger create is guarded so re-running
-- the file is a no-op.
--
-- This migration:
--   1. Adds the extended profile fields the new signup form / Profile page
--      collect (full_name, username, country, usage_type, favorite_history,
--      avatar_url, bio, updated_at).
--   2. Re-applies the profiles RLS policies so:
--        - users can read their own profile,
--        - users can update their own profile but never change `role`,
--        - admins can read every profile.
--   3. Adds a touch trigger that keeps profiles.updated_at fresh on every
--      UPDATE without client-side bookkeeping.
--   4. Creates the public `avatars` storage bucket and per-user RLS so each
--      user can read everyone's avatar (they're public anyway) but only
--      manage their own files. Bucket creation is wrapped in a guard in case
--      Storage is disabled in this project.
--
-- After running, refresh PostgREST:
--   notify pgrst, 'reload schema';

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Extended profile columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists full_name        text,
  add column if not exists username         text,
  add column if not exists country          text,
  add column if not exists usage_type       text,
  add column if not exists favorite_history text,
  add column if not exists avatar_url       text,
  add column if not exists bio              text,
  add column if not exists updated_at       timestamptz not null default now();

-- A short index on lower(username) makes username-uniqueness checks cheap
-- without forcing a hard unique constraint (so two legacy rows with the same
-- handle don't break the migration on existing databases).
create index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- 2. Touch trigger: keep updated_at fresh on every profile UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.profiles_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.profiles_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Re-apply RLS policies (now that there are more updatable columns)
--
-- Users can SELECT their own row. Users can INSERT their own row but only
-- with role='user' (the WITH CHECK enforces that). Users can UPDATE their
-- own row but the WITH CHECK pins `role` to whatever was already in the
-- database for them — so a `role=admin` payload from the client is rejected.
-- Admins can SELECT everything.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles admin read"  on public.profiles;
drop policy if exists "profiles self insert" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;

create policy "profiles self read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles admin read"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles self insert"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'user');

create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Storage bucket: avatars
--
-- The bucket is public-read (so the avatar URL works in <img> tags without
-- a signed URL round-trip) and per-user write. Files MUST live under a
-- top-level folder that matches the user's auth.uid() — the storage
-- policies below enforce that.
--
-- Wrapped in DO blocks so the migration stays no-op if Storage is disabled
-- in the project (`storage.buckets` / `storage.objects` not present).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', true)
    on conflict (id) do update set public = true;
  end if;
end$$;

do $$
begin
  if to_regclass('storage.objects') is not null then
    -- Public read for everyone — avatars are public. (The bucket flag alone
    -- isn't always enough; an explicit policy is the canonical way.)
    execute 'drop policy if exists "avatars public read" on storage.objects';
    execute $sql$
      create policy "avatars public read"
        on storage.objects for select
        using (bucket_id = 'avatars')
    $sql$;

    -- Authenticated users can INSERT into the avatars bucket only under
    -- their own user-id folder (e.g. `<uid>/avatar-1234.png`). The
    -- (storage.foldername(name))[1] expression returns the first folder
    -- segment of the object key.
    execute 'drop policy if exists "avatars self insert" on storage.objects';
    execute $sql$
      create policy "avatars self insert"
        on storage.objects for insert
        to authenticated
        with check (
          bucket_id = 'avatars'
          and auth.uid()::text = (storage.foldername(name))[1]
        )
    $sql$;

    execute 'drop policy if exists "avatars self update" on storage.objects';
    execute $sql$
      create policy "avatars self update"
        on storage.objects for update
        to authenticated
        using (
          bucket_id = 'avatars'
          and auth.uid()::text = (storage.foldername(name))[1]
        )
        with check (
          bucket_id = 'avatars'
          and auth.uid()::text = (storage.foldername(name))[1]
        )
    $sql$;

    execute 'drop policy if exists "avatars self delete" on storage.objects';
    execute $sql$
      create policy "avatars self delete"
        on storage.objects for delete
        to authenticated
        using (
          bucket_id = 'avatars'
          and auth.uid()::text = (storage.foldername(name))[1]
        )
    $sql$;
  end if;
end$$;

-- Force PostgREST to pick up the new columns immediately so the new
-- signup form does not 404 against the schema cache.
notify pgrst, 'reload schema';
