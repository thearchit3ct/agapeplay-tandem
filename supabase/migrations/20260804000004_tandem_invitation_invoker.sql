-- Keep invitation acceptance under normal authenticated RLS evaluation.

alter function public.accept_tandem_invitation(text) security invoker;

drop policy if exists "tandems_insert_member" on public.tandems;
create policy "tandems_insert_member"
  on public.tandems for insert
  to authenticated
  with check ((select auth.uid()) in (participant_a_id, participant_b_id));
