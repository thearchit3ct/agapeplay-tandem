-- Persist user reports while keeping moderation data separate from spiritual content.

create table if not exists public.tandem_reports (
  id uuid primary key default gen_random_uuid(),
  tandem_id uuid not null references public.tandems(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.tandem_messages(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz
);

create index if not exists tandem_reports_tandem_idx
  on public.tandem_reports (tandem_id, created_at desc);

create index if not exists tandem_reports_reporter_idx
  on public.tandem_reports (reporter_id, created_at desc);

alter table public.tandem_reports enable row level security;

drop policy if exists "reports_insert_member" on public.tandem_reports;
create policy "reports_insert_member"
  on public.tandem_reports for insert
  to authenticated
  with check (
    (select auth.uid()) = reporter_id
    and exists (
      select 1 from public.tandems t
      where t.id = tandem_id
        and (select auth.uid()) in (t.participant_a_id, t.participant_b_id)
    )
  );

drop policy if exists "reports_select_reporter" on public.tandem_reports;
create policy "reports_select_reporter"
  on public.tandem_reports for select
  to authenticated
  using ((select auth.uid()) = reporter_id);

grant select, insert on public.tandem_reports to authenticated;
