-- Tighten the invitation RPC and the email-based invitation policies.

revoke execute on function public.accept_tandem_invitation(text) from anon;
revoke execute on function public.accept_tandem_invitation(text) from public;
grant execute on function public.accept_tandem_invitation(text) to authenticated;

drop policy if exists "invitations_select_participant" on public.tandem_invitations;
create policy "invitations_select_participant"
  on public.tandem_invitations for select
  to authenticated
  using (
    (select auth.uid()) = inviter_id
    or lower(invitee_email) = (select lower(coalesce(auth.jwt() ->> 'email', '')))
  );

drop policy if exists "invitations_update_participant" on public.tandem_invitations;
create policy "invitations_update_participant"
  on public.tandem_invitations for update
  to authenticated
  using (
    (select auth.uid()) = inviter_id
    or lower(invitee_email) = (select lower(coalesce(auth.jwt() ->> 'email', '')))
  )
  with check (
    (select auth.uid()) = inviter_id
    or lower(invitee_email) = (select lower(coalesce(auth.jwt() ->> 'email', '')))
  );

create index if not exists tandem_invitations_accepted_by_idx
  on public.tandem_invitations (accepted_by);

create index if not exists tandem_messages_sender_idx
  on public.tandem_messages (sender_id);

create index if not exists tandems_participant_a_idx
  on public.tandems (participant_a_id);

create index if not exists tandems_participant_b_idx
  on public.tandems (participant_b_id);
