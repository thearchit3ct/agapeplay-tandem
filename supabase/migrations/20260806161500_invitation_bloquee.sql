-- Un blocage ferme le canal de contact, pas seulement l'appariement.
--
-- `20260806150000_appariement_possible` a fermé le ré-appariement : la paire dont
-- un tandem est bloqué ne peut plus en créer un neuf. Ce qui restait ouvert est
-- en amont, à l'**émission**. `invitations_insert_inviter` (migration
-- `…_000002`, ligne 73) n'exige qu'une chose :
--
--     with check ((select auth.uid()) = inviter_id)
--
-- La personne écartée pouvait donc continuer à envoyer des codes. L'acceptation
-- échouait bien — c'est ce que la migration précédente a réglé — mais la
-- sollicitation, elle, arrivait : un e-mail chez la personne qui a bloqué, et
-- une invitation `pending` visible dans son interface par la branche e-mail de
-- `invitations_select_participant`. Or c'est exactement ce qu'un blocage promet
-- de faire cesser. Le produit met en relation des mineurs de 16-17 ans et des
-- mentors adultes : une sollicitation répétée par quelqu'un qu'on a écarté est
-- le scénario que la règle 3 de l'ADR-002 vise en premier.
--
-- ---------------------------------------------------------------------------
-- L'obstacle : une invitation vise une adresse, pas un compte
-- ---------------------------------------------------------------------------
--
-- `tandem_invitations` ne porte que `invitee_email` (texte) et `inviter_id`.
-- `accepted_by` ne se remplit qu'à l'acceptation, donc jamais sur une invitation
-- vivante. Rien dans la table ne relie le destinataire à un compte : il faut
-- résoudre l'adresse dans `auth.users`, et cette résolution n'est pas exacte.
--
-- `users_email_partial_key` est unique sur `email` **brut** et seulement
-- `where is_sso_user = false` : deux comptes peuvent donc partager un même
-- `lower(email)`. La résolution est écrite en conséquence, en `exists` et non en
-- « le compte correspondant » :
--
--     existe-t-il *un* compte portant cette adresse qui soit en blocage avec moi ?
--
-- Cette forme décide de la façon dont on se trompe, et c'est le seul point qui
-- comptait. Le pire cas est un refus de trop — une invitation à une adresse
-- qu'un homonyme aurait bloquée — jamais une sollicitation qui passe vers
-- quelqu'un qui l'a refusée. Aucun filtre sur `deleted_at` pour la même raison :
-- l'inclure penche du côté fermé, l'exclure rouvrirait une fenêtre au bénéfice
-- de personne.
--
-- Ce que l'on ne fait pas : écrire un `user_id` résolu dans la table. Ce serait
-- figer une correspondance approximative dans les données, et faire porter à
-- toutes les lectures ultérieures une erreur commise une fois.
--
-- ---------------------------------------------------------------------------
-- Pourquoi une fonction, et pourquoi pas `tandem_paire_bloquee`
-- ---------------------------------------------------------------------------
--
-- `tandem_paire_bloquee(uuid, uuid)` ne sert pas ici : elle prend deux
-- identifiants, et nous n'en avons qu'un. Résoudre le second dans la politique
-- elle-même est impossible — mesuré sur cette base :
--
--     select has_table_privilege('authenticated', 'auth.users', 'select');  -- f
--
-- et une expression de politique **est** soumise aux droits de l'appelant, ce
-- qui n'allait pas de soi et a été vérifié sur une table témoin :
--
--     ERROR:  permission denied for table zz_secret
--
-- D'où une fonction `security definer`, `search_path` figé, qui rend un booléen
-- et rien d'autre.
--
-- Elle ne peut pas servir de sonde, et c'est ce qui a dicté sa signature :
-- **un seul paramètre**. Elle ne prend pas l'inviteur en argument, elle le lit
-- dans `auth.uid()` — ajouter ce paramètre l'aurait transformée en oracle sur
-- les blocages de paires dont l'appelant ne fait pas partie. Telle qu'elle est,
-- elle ne répond `true` que sur un blocage qui concerne l'appelant, c'est-à-dire
-- un fait qu'il connaît déjà. Sur une adresse sans compte comme sur une adresse
-- sans blocage avec lui, elle rend `false` : elle ne révèle donc pas non plus
-- l'existence d'un compte.
--
-- Sa polarité de repli est celle de `tandem_paire_bloquee` : sans identité
-- (`auth.uid()` NULL), elle rend `true` — elle referme.
--
-- `current_user` ne serait ici d'aucun secours pour identifier l'appelant : dans
-- une fonction `security definer` il désigne le propriétaire.
--
-- Coût de performance, énoncé : `lower(u.email) = lower($1)` ne peut s'appuyer
-- sur aucun index existant d'`auth.users` (`users_instance_id_email_idx` porte
-- sur `(instance_id, lower(email))`), et le schéma `auth` n'est pas le nôtre à
-- indexer. C'est donc un parcours séquentiel — à l'émission d'une invitation,
-- geste rare et manuel.

create or replace function public.tandem_contact_bloque(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when auth.uid() is null then true
    else exists (
      select 1
      from auth.users u
      join public.tandems t
        on least(t.participant_a_id, t.participant_b_id) = least(auth.uid(), u.id)
       and greatest(t.participant_a_id, t.participant_b_id) = greatest(auth.uid(), u.id)
      where lower(u.email) = lower(p_email)
        and t.status = 'blocked'
    )
  end;
$$;

comment on function public.tandem_contact_bloque(text) is
  'Un blocage ferme le canal de contact : l''adresse visée appartient-elle à un compte en blocage avec l''appelant ? Ne prend pas d''identité en paramètre — elle lit auth.uid() — et ne renseigne donc que sur des paires dont l''appelant fait partie. Rend true — donc refuse — sans identité.';

revoke all on function public.tandem_contact_bloque(text) from public;
revoke all on function public.tandem_contact_bloque(text) from anon;
grant execute on function public.tandem_contact_bloque(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Les deux chemins d'émission
-- ---------------------------------------------------------------------------
--
-- L'`insert` est le chemin visible (`apps/web/src/App.tsx:406`). Le second est
-- l'`update` : `grant … update on public.tandem_invitations` (migration
-- `…_000002`, ligne 177) et `invitations_update_participant` laissent l'inviteur
-- réécrire `invitee_email`. On posait une invitation vers une adresse neutre,
-- puis on la faisait pointer sur celle qui nous a écarté. Fermer l'insert seul
-- n'aurait donc rien fermé.

drop policy if exists "invitations_insert_inviter" on public.tandem_invitations;
create policy "invitations_insert_inviter"
  on public.tandem_invitations for insert
  to authenticated
  with check (
    (select auth.uid()) = inviter_id
    and not public.tandem_contact_bloque(invitee_email)
  );

-- Le conjonct va dans le `with check`, **jamais dans le `using`**, et la raison
-- n'est pas cosmétique. Un refus par `with check` lève, et remonte jusqu'à
-- l'utilisateur. Un refus par `using` ne lève pas : il ne touche aucune ligne,
-- en silence. Or cette politique gouverne aussi l'`update … set status =
-- 'accepted'` d'`accept_tandem_invitation`, passée en `security invoker` par
-- `…_000004` : un `using` refermé y laisserait un tandem créé et une invitation
-- restée `pending`, c'est-à-dire un demi-état durable que personne ne verrait.
--
-- L'acceptation ordinaire, elle, n'est pas touchée : la ligne mise à jour porte
-- l'adresse de l'invitée elle-même, la paire résolue est (invitée, invitée), et
-- `check (participant_a_id <> participant_b_id)` (migration `…_000002`, ligne 41)
-- garantit qu'aucun tandem ne la réunit à elle-même. Le conjonct est donc faux
-- pour elle, et le `not` vrai.
--
-- Coût assumé, à énoncer : sur une paire bloquée, l'inviteur ne peut plus
-- **révoquer** son invitation antérieure non plus — la nouvelle ligne porterait
-- toujours l'adresse bloquée et le `with check` lève. L'invitation reste
-- `pending` jusqu'à sa péremption. C'est le côté fermé, cohérent avec le reste :
-- le chemin de retour sanctionné est de lever le blocage sur la ligne du tandem,
-- geste tracé et réservé à `blocked_by`.

drop policy if exists "invitations_update_participant" on public.tandem_invitations;
create policy "invitations_update_participant"
  on public.tandem_invitations for update
  to authenticated
  using (
    (select auth.uid()) = inviter_id
    or lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  )
  with check (
    (
      (select auth.uid()) = inviter_id
      or lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    )
    and not public.tandem_contact_bloque(invitee_email)
  );

-- ---------------------------------------------------------------------------
-- Ce que cette migration ne referme pas
-- ---------------------------------------------------------------------------
--
-- Les invitations `pending` **émises avant le blocage** restent visibles de la
-- personne qui a bloqué : `invitations_select_participant` n'a aucun conjonct de
-- blocage, et on ne lui en ajoute pas ici. Cette politique gouverne le
-- `select … for update` d'`accept_tandem_invitation` ; la resserrer casserait
-- l'acceptation de façon peu visible — la fonction remonterait
-- `invitation_not_found` sur des invitations parfaitement légitimes. L'écart est
-- réel, il se traite ailleurs (péremption, ou masquage côté interface), pas dans
-- la politique qui porte l'acceptation.
