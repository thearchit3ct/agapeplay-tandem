-- Editorial content, notification preferences and community foundations.

create table if not exists public.content_journeys (
  id text primary key,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  title_fr text not null,
  title_en text not null,
  eyebrow_fr text not null,
  eyebrow_en text not null,
  description_fr text not null,
  description_en text not null,
  duration_fr text not null,
  duration_en text not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.content_sessions (
  id text primary key,
  journey_id text not null references public.content_journeys(id) on delete cascade,
  day integer not null check (day > 0),
  title_fr text not null,
  title_en text not null,
  theme_fr text not null,
  theme_en text not null,
  duration integer not null check (duration between 1 and 120),
  verse_fr text not null,
  verse_en text not null,
  prompt_fr text not null,
  prompt_en text not null,
  action_fr text not null,
  action_en text not null,
  unique (journey_id, day)
);

create index if not exists content_sessions_journey_day_idx on public.content_sessions (journey_id, day);
alter table public.content_journeys enable row level security;
alter table public.content_sessions enable row level security;

drop policy if exists "published_journeys_read" on public.content_journeys;
create policy "published_journeys_read" on public.content_journeys for select to anon, authenticated using (status = 'published');
drop policy if exists "published_sessions_read" on public.content_sessions;
create policy "published_sessions_read" on public.content_sessions for select to anon, authenticated using (exists (select 1 from public.content_journeys j where j.id = journey_id and j.status = 'published'));
grant select on public.content_journeys, public.content_sessions to anon, authenticated;

insert into public.content_journeys (id, status, title_fr, title_en, eyebrow_fr, eyebrow_en, description_fr, description_en, duration_fr, duration_en)
values ('repartir-avec-jesus', 'published', 'Repartir avec Jésus', 'Starting again with Jesus', 'Parcours AgapePlay', 'AgapePlay journey', 'Six semaines pour retrouver un rythme simple, concret et accompagné.', 'Six weeks to find a simple, practical rhythm with someone beside you.', '6 semaines · 10 min par jour', '6 weeks · 10 min a day')
on conflict (id) do update set status = excluded.status, title_fr = excluded.title_fr, title_en = excluded.title_en, eyebrow_fr = excluded.eyebrow_fr, eyebrow_en = excluded.eyebrow_en, description_fr = excluded.description_fr, description_en = excluded.description_en, duration_fr = excluded.duration_fr, duration_en = excluded.duration_en, updated_at = timezone('utc', now());

insert into public.content_sessions (id, journey_id, day, title_fr, title_en, theme_fr, theme_en, duration, verse_fr, verse_en, prompt_fr, prompt_en, action_fr, action_en)
values
('repartir-01', 'repartir-avec-jesus', 1, 'Revenir à l’essentiel', 'Come back to what matters', 'Une foi qui respire', 'A breathing faith', 8, '« Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos. » — Matthieu 11:28', '“Come to me, all you who are weary and burdened, and I will give you rest.” — Matthew 11:28', 'Qu’aimerais-tu déposer aujourd’hui avant de commencer ?', 'What would you like to lay down before you begin today?', 'Prends deux minutes de silence, puis écris une phrase de prière honnête.', 'Take two quiet minutes, then write one honest sentence of prayer.'),
('repartir-02', 'repartir-avec-jesus', 2, 'Recevoir plutôt que réussir', 'Receive instead of achieving', 'La grâce au quotidien', 'Grace in everyday life', 9, '« Ma grâce te suffit, car ma puissance s’accomplit dans la faiblesse. » — 2 Corinthiens 12:9', '“My grace is sufficient for you, for my power is made perfect in weakness.” — 2 Corinthians 12:9', 'Dans quel domaine te mets-tu le plus de pression ?', 'Where do you put the most pressure on yourself?', 'Partage une phrase simple avec ton tandem : « Aujourd’hui, je peux recevoir… »', 'Share one sentence with your tandem: “Today, I can receive…”'),
('repartir-03', 'repartir-avec-jesus', 3, 'Faire un pas vers quelqu’un', 'Take one step toward someone', 'Une foi incarnée', 'A faith you can live', 7, '« Portez les fardeaux les uns des autres. » — Galates 6:2', '“Carry each other’s burdens.” — Galatians 6:2', 'Qui pourrait avoir besoin d’une présence attentive cette semaine ?', 'Who might need a listening presence this week?', 'Envoie un message d’encouragement sans attendre de réponse.', 'Send an encouraging message without expecting a reply.')
on conflict (id) do update set title_fr = excluded.title_fr, title_en = excluded.title_en, theme_fr = excluded.theme_fr, theme_en = excluded.theme_en, duration = excluded.duration, verse_fr = excluded.verse_fr, verse_en = excluded.verse_en, prompt_fr = excluded.prompt_fr, prompt_en = excluded.prompt_en, action_fr = excluded.action_fr, action_en = excluded.action_en;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sessions boolean not null default true,
  messages boolean not null default true,
  church boolean not null default false,
  absence boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);
alter table public.notification_preferences enable row level security;
drop policy if exists "notification_preferences_own" on public.notification_preferences;
create policy "notification_preferences_own" on public.notification_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.notification_preferences to authenticated;

create table if not exists public.churches (id uuid primary key default gen_random_uuid(), name text not null, status text not null default 'pending' check (status in ('pending', 'active', 'suspended')), created_at timestamptz not null default timezone('utc', now()));
create table if not exists public.church_groups (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id) on delete cascade, name text not null, status text not null default 'active' check (status in ('active', 'closed')), created_at timestamptz not null default timezone('utc', now()));
create table if not exists public.church_members (church_id uuid not null references public.churches(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null check (role in ('member', 'mentor', 'leader', 'admin')), status text not null default 'active' check (status in ('invited', 'active', 'revoked')), created_at timestamptz not null default timezone('utc', now()), primary key (church_id, user_id));
create table if not exists public.group_members (group_id uuid not null references public.church_groups(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default timezone('utc', now()), primary key (group_id, user_id));
alter table public.churches enable row level security;
alter table public.church_groups enable row level security;
alter table public.church_members enable row level security;
alter table public.group_members enable row level security;
drop policy if exists "churches_member_read" on public.churches;
create policy "churches_member_read" on public.churches for select to authenticated using (exists (select 1 from public.church_members m where m.church_id = id and m.user_id = (select auth.uid()) and m.status = 'active'));
drop policy if exists "groups_member_read" on public.church_groups;
create policy "groups_member_read" on public.church_groups for select to authenticated using (exists (select 1 from public.group_members gm where gm.group_id = id and gm.user_id = (select auth.uid())));
drop policy if exists "church_members_own_read" on public.church_members;
create policy "church_members_own_read" on public.church_members for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "group_members_own_read" on public.group_members;
create policy "group_members_own_read" on public.group_members for select to authenticated using (user_id = (select auth.uid()));
grant select on public.churches, public.church_groups, public.church_members, public.group_members to authenticated;

create table if not exists public.mentor_profiles (user_id uuid primary key references auth.users(id) on delete cascade, verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected', 'revoked')), training_status text not null default 'required' check (training_status in ('required', 'in_progress', 'completed', 'expired')), verified_at timestamptz, training_completed_at timestamptz, updated_at timestamptz not null default timezone('utc', now()));
create table if not exists public.mentor_assignments (id uuid primary key default gen_random_uuid(), church_id uuid not null references public.churches(id) on delete cascade, group_id uuid references public.church_groups(id) on delete set null, mentor_id uuid not null references auth.users(id) on delete cascade, participant_id uuid not null references auth.users(id) on delete cascade, status text not null default 'active' check (status in ('pending', 'active', 'paused', 'ended')), created_at timestamptz not null default timezone('utc', now()), check (mentor_id <> participant_id));
alter table public.mentor_profiles enable row level security;
alter table public.mentor_assignments enable row level security;
drop policy if exists "mentor_profile_own_read" on public.mentor_profiles;
create policy "mentor_profile_own_read" on public.mentor_profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "mentor_assignments_member_read" on public.mentor_assignments;
create policy "mentor_assignments_member_read" on public.mentor_assignments for select to authenticated using (mentor_id = (select auth.uid()) or participant_id = (select auth.uid()));
grant select on public.mentor_profiles, public.mentor_assignments to authenticated;

create table if not exists public.analytics_events (id uuid primary key default gen_random_uuid(), event_name text not null check (char_length(event_name) between 1 and 80), anonymous_id text not null, journey_id text, locale text check (locale in ('fr', 'en')), metadata jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default timezone('utc', now()));
create index if not exists analytics_events_name_date_idx on public.analytics_events (event_name, occurred_at desc);
alter table public.analytics_events enable row level security;
drop policy if exists "analytics_events_insert" on public.analytics_events;
create policy "analytics_events_insert" on public.analytics_events for insert to anon, authenticated with check (true);
grant insert on public.analytics_events to anon, authenticated;

create table if not exists public.community_stats_daily (metric_date date not null, metric_key text not null, value integer not null default 0 check (value >= 0), primary key (metric_date, metric_key));
alter table public.community_stats_daily enable row level security;
drop policy if exists "community_stats_public_read" on public.community_stats_daily;
create policy "community_stats_public_read" on public.community_stats_daily for select to anon, authenticated using (true);
grant select on public.community_stats_daily to anon, authenticated;
