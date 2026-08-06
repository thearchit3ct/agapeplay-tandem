-- AgapePlay Tandem: trust, invitations and private tandem messaging.
-- Apply after 20260804_000001_tandem_foundation.sql.

alter table public.profiles
  add column if not exists age_confirmed_at timestamptz,
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists terms_consent_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists account_status text not null default 'active';

alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles
  add constraint profiles_account_status_check
  check (account_status in ('active', 'deletion_requested', 'deleted'));

create table if not exists public.tandem_invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null check (position('@' in invitee_email) > 1),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default timezone('utc', now()) + interval '7 days',
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists tandem_invitations_inviter_idx
  on public.tandem_invitations (inviter_id, created_at desc);

create index if not exists tandem_invitations_email_idx
  on public.tandem_invitations (lower(invitee_email), status);

create table if not exists public.tandems (
  id uuid primary key default gen_random_uuid(),
  participant_a_id uuid not null references auth.users(id) on delete cascade,
  participant_b_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'blocked', 'ended')),
  created_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  check (participant_a_id <> participant_b_id)
);

create unique index if not exists tandems_active_pair_idx
  on public.tandems (least(participant_a_id, participant_b_id), greatest(participant_a_id, participant_b_id))
  where status in ('active', 'paused');

create table if not exists public.tandem_messages (
  id uuid primary key default gen_random_uuid(),
  tandem_id uuid not null references public.tandems(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists tandem_messages_thread_idx
  on public.tandem_messages (tandem_id, created_at asc);

alter table public.tandem_invitations enable row level security;
alter table public.tandems enable row level security;
alter table public.tandem_messages enable row level security;

drop policy if exists "invitations_select_participant" on public.tandem_invitations;
create policy "invitations_select_participant"
  on public.tandem_invitations for select
  to authenticated
  using (
    (select auth.uid()) = inviter_id
    or lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

drop policy if exists "invitations_insert_inviter" on public.tandem_invitations;
create policy "invitations_insert_inviter"
  on public.tandem_invitations for insert
  to authenticated
  with check ((select auth.uid()) = inviter_id);

drop policy if exists "invitations_update_participant" on public.tandem_invitations;
create policy "invitations_update_participant"
  on public.tandem_invitations for update
  to authenticated
  using (
    (select auth.uid()) = inviter_id
    or lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
  with check (
    (select auth.uid()) = inviter_id
    or lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

drop policy if exists "tandems_select_member" on public.tandems;
create policy "tandems_select_member"
  on public.tandems for select
  to authenticated
  using ((select auth.uid()) in (participant_a_id, participant_b_id));

drop policy if exists "tandems_update_member" on public.tandems;
create policy "tandems_update_member"
  on public.tandems for update
  to authenticated
  using ((select auth.uid()) in (participant_a_id, participant_b_id))
  with check ((select auth.uid()) in (participant_a_id, participant_b_id));

drop policy if exists "messages_select_member" on public.tandem_messages;
create policy "messages_select_member"
  on public.tandem_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.tandems t
      where t.id = tandem_id
        and (select auth.uid()) in (t.participant_a_id, t.participant_b_id)
    )
  );

drop policy if exists "messages_insert_member" on public.tandem_messages;
create policy "messages_insert_member"
  on public.tandem_messages for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (
      select 1 from public.tandems t
      where t.id = tandem_id
        and t.status in ('active', 'paused')
        and (select auth.uid()) in (t.participant_a_id, t.participant_b_id)
    )
  );

create or replace function public.accept_tandem_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.tandem_invitations;
  tandem_id uuid;
  current_email text;
begin
  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  select * into invitation
  from public.tandem_invitations
  where token = p_token
    and status = 'pending'
    and expires_at > timezone('utc', now())
  for update;

  if not found then raise exception 'invitation_not_found'; end if;
  if lower(invitation.invitee_email) <> current_email then raise exception 'invitation_email_mismatch'; end if;
  if invitation.inviter_id = auth.uid() then raise exception 'invitation_self_acceptance'; end if;

  insert into public.tandems (participant_a_id, participant_b_id)
  values (invitation.inviter_id, auth.uid())
  on conflict do nothing
  returning id into tandem_id;

  if tandem_id is null then
    select id into tandem_id
    from public.tandems
    where least(participant_a_id, participant_b_id) = least(invitation.inviter_id, auth.uid())
      and greatest(participant_a_id, participant_b_id) = greatest(invitation.inviter_id, auth.uid())
      and status in ('active', 'paused')
    limit 1;
  end if;

  update public.tandem_invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = timezone('utc', now())
  where id = invitation.id;
  return tandem_id;
end;
$$;

revoke all on function public.accept_tandem_invitation(text) from public;
grant execute on function public.accept_tandem_invitation(text) to authenticated;

grant select, insert, update on public.tandem_invitations to authenticated;
grant select, update on public.tandems to authenticated;
grant select, insert on public.tandem_messages to authenticated;
