-- AgapePlay Tandem: private foundation for the first authenticated slice.
-- Apply this migration from the Supabase SQL editor before enabling sync.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  locale text not null default 'fr' check (locale in ('fr', 'en')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.session_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  journey_id text not null,
  session_id text not null,
  completed_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, journey_id, session_id)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 10000),
  mood text not null default 'Présent',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists journal_entries_user_created_idx
  on public.journal_entries (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.session_progress enable row level security;
alter table public.journal_entries enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "progress_select_own" on public.session_progress;
create policy "progress_select_own"
  on public.session_progress for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "progress_insert_own" on public.session_progress;
create policy "progress_insert_own"
  on public.session_progress for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "progress_delete_own" on public.session_progress;
create policy "progress_delete_own"
  on public.session_progress for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "journal_select_own" on public.journal_entries;
create policy "journal_select_own"
  on public.journal_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "journal_insert_own" on public.journal_entries;
create policy "journal_insert_own"
  on public.journal_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "journal_update_own" on public.journal_entries;
create policy "journal_update_own"
  on public.journal_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "journal_delete_own" on public.journal_entries;
create policy "journal_delete_own"
  on public.journal_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.session_progress to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;
