-- Histora Phase 2: Supabase Auth + role-based access
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`) AFTER
-- 0001_chat_history.sql. It introduces:
--   - public.profiles (one row per auth.users user, with a role enum)
--   - public.is_admin() helper that wraps the role lookup
--   - tightened RLS for conversations / conversation_messages so each user
--     can only touch their own rows (admins can read everything)
--   - public-read / admin-write RLS for the catalog tables (events,
--     characters, source_notes) when they exist
--
-- The migration is idempotent: running it again is a no-op.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. profiles table
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- 2. is_admin() helper
--
-- SECURITY DEFINER so it can read profiles without recursing into the RLS
-- policies defined below. STABLE because the role does not change inside a
-- single statement. We pin search_path for safety.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. profiles policies
--
-- Users can read their own profile and update its email; admins can read
-- every profile. Nobody can flip their own role from the client — `role`
-- must be changed manually in the Supabase dashboard or via service-role
-- SQL, which is enforced by the WITH CHECK clause on the update policy.
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
-- 4. conversations + conversation_messages
--
-- The Phase 1 migration opened these to the anon key so the demo could
-- persist without auth. Now that we have auth.users we replace those wide
-- policies with per-owner ones (and let admins read everything).
-- ---------------------------------------------------------------------------
drop policy if exists "histora anon read conversations"   on public.conversations;
drop policy if exists "histora anon insert conversations" on public.conversations;
drop policy if exists "histora anon update conversations" on public.conversations;
drop policy if exists "histora anon delete conversations" on public.conversations;
drop policy if exists "histora anon read messages"        on public.conversation_messages;
drop policy if exists "histora anon insert messages"      on public.conversation_messages;
drop policy if exists "histora anon update messages"      on public.conversation_messages;
drop policy if exists "histora anon delete messages"      on public.conversation_messages;

drop policy if exists "conversations owner select" on public.conversations;
drop policy if exists "conversations owner insert" on public.conversations;
drop policy if exists "conversations owner update" on public.conversations;
drop policy if exists "conversations owner delete" on public.conversations;

create policy "conversations owner select"
  on public.conversations for select
  using (auth.uid() = user_id or public.is_admin());

create policy "conversations owner insert"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "conversations owner update"
  on public.conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "conversations owner delete"
  on public.conversations for delete
  using (auth.uid() = user_id);

drop policy if exists "messages owner select" on public.conversation_messages;
drop policy if exists "messages owner insert" on public.conversation_messages;
drop policy if exists "messages owner update" on public.conversation_messages;
drop policy if exists "messages owner delete" on public.conversation_messages;

create policy "messages owner select"
  on public.conversation_messages for select
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (c.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "messages owner insert"
  on public.conversation_messages for insert
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy "messages owner update"
  on public.conversation_messages for update
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy "messages owner delete"
  on public.conversation_messages for delete
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. catalog tables — events / characters / source_notes
--
-- These tables hold curated content that every visitor should be able to
-- read but only admins should be allowed to mutate. They are not part of
-- the chat-history migration, so we guard each block with to_regclass to
-- stay no-op if the table is not yet created in this project.
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

  if to_regclass('public.source_notes') is not null then
    execute 'alter table public.source_notes enable row level security';
    execute 'drop policy if exists "source_notes public read" on public.source_notes';
    execute 'drop policy if exists "source_notes admin write" on public.source_notes';
    execute $sql$create policy "source_notes public read" on public.source_notes for select using (true)$sql$;
    execute $sql$create policy "source_notes admin write" on public.source_notes for all using (public.is_admin()) with check (public.is_admin())$sql$;
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- HOW TO PROMOTE AN ADMIN
--
-- The signup flow only ever inserts profiles with role='user' (enforced by
-- the WITH CHECK clause on "profiles self insert"). To make someone an
-- admin, run this once in the Supabase SQL editor with service-role access:
--
--   update public.profiles
--     set role = 'admin'
--     where email = 'you@example.com';
-- ---------------------------------------------------------------------------
