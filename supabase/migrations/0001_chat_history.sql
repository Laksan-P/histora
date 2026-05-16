-- Histora chat history schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`)
-- to enable conversation persistence + the recent-history sidebar.

create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_id text,
  character_id text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_id_idx
  on public.conversations (user_id);

create index if not exists conversations_updated_at_idx
  on public.conversations (updated_at desc);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  source_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_conversation_id_idx
  on public.conversation_messages (conversation_id, created_at asc);

-- Histora has no auth yet; expose the tables to the anon key so the browser
-- can persist its own session history. Tighten these policies when auth is
-- introduced.
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists "histora anon read conversations" on public.conversations;
drop policy if exists "histora anon insert conversations" on public.conversations;
drop policy if exists "histora anon update conversations" on public.conversations;
drop policy if exists "histora anon delete conversations" on public.conversations;
drop policy if exists "histora anon read messages" on public.conversation_messages;
drop policy if exists "histora anon insert messages" on public.conversation_messages;
drop policy if exists "histora anon update messages" on public.conversation_messages;
drop policy if exists "histora anon delete messages" on public.conversation_messages;

create policy "histora anon read conversations"
  on public.conversations for select using (true);
create policy "histora anon insert conversations"
  on public.conversations for insert with check (true);
create policy "histora anon update conversations"
  on public.conversations for update using (true) with check (true);
create policy "histora anon delete conversations"
  on public.conversations for delete using (true);

create policy "histora anon read messages"
  on public.conversation_messages for select using (true);
create policy "histora anon insert messages"
  on public.conversation_messages for insert with check (true);
create policy "histora anon update messages"
  on public.conversation_messages for update using (true) with check (true);
create policy "histora anon delete messages"
  on public.conversation_messages for delete using (true);
