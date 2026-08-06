-- Depuis quand ce tandem est-il bloqué ? La question n'avait pas de réponse.
--
-- `20260806012728_blocage_effectif.sql` a ajouté `blocked_by` parce que la table
-- ne disait pas *qui* avait bloqué, et que sans cette information « seul celui
-- qui a bloqué peut débloquer » était inexprimable. Le même constat se répète un
-- cran plus loin : la table ne dit pas *quand*.
--
-- Les colonnes existantes ne peuvent pas y suppléer, et il faut le dire
-- nettement parce que la confusion est facile :
--
--   - `created_at` date la **relation**, pas le blocage. Un tandem né en janvier
--     et bloqué hier rendrait « janvier », ce qui n'est pas faux — c'est pire :
--     c'est plausible. Un modérateur lirait une ancienneté et croirait lire une
--     durée de blocage.
--   - `ended_at` date la fin de la relation. Un tandem `blocked` n'est pas un
--     tandem `ended` : ce sont deux statuts distincts du même `check`.
--
-- Or c'est exactement la différence qui pèse sur une décision de modération :
-- un signalement sur une relation bloquée il y a une heure et un signalement sur
-- une relation bloquée depuis trois mois n'appellent pas le même geste.

alter table public.tandems
  add column if not exists blocked_at timestamptz;

comment on column public.tandems.blocked_at is
  'Date de pose du blocage en cours. NULL dès que le tandem n''est plus bloqué, et NULL sur les lignes bloquées avant cette migration — même précédent que blocked_by. Maintenue par trigger, jamais écrite par l''application.';

-- ---------------------------------------------------------------------------
-- Maintenue par trigger, pas par l'appelant
-- ---------------------------------------------------------------------------
--
-- `grant update` sur `tandems` porte sur toute la table : laisser
-- l'application poser `blocked_at` reviendrait à laisser la personne qui bloque
-- antidater son propre blocage. La colonne est donc calculée à l'écriture, et
-- toute valeur proposée est écrasée.
--
-- **`before insert or update`**, et l'`insert` n'est pas du zèle : la table
-- reçoit des lignes déjà `blocked` — les fixtures de `moderation.test.ts` en
-- créent une directement, et rien n'interdit qu'un chemin serveur fasse de
-- même. Un trigger UPDATE seul les laisserait à NULL ; la vue de modération
-- rendrait alors « bloqué, depuis on ne sait quand » sur un cas parfaitement
-- courant, et le test correspondant passerait sur un NULL sans le voir.
--
-- Le déblocage remet à NULL : `blocked_at` répond « depuis quand ce blocage-ci
-- dure », pas « quand a-t-on bloqué la dernière fois ». Garder la vieille date
-- sur un tandem redevenu actif ferait mentir la colonne. L'historique des
-- blocages, s'il devient nécessaire, sera un journal — pas une colonne.

create or replace function public.tandem_blocage_horodater()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'blocked' then
    -- Repose la date à la transition seulement : un modérateur ou un
    -- participant qui touche une autre colonne d'un tandem déjà bloqué ne doit
    -- pas rajeunir le blocage.
    if tg_op = 'INSERT' or old.status is distinct from 'blocked' then
      new.blocked_at := timezone('utc', now());
    else
      new.blocked_at := old.blocked_at;
    end if;
  else
    new.blocked_at := null;
  end if;
  return new;
end;
$$;

comment on function public.tandem_blocage_horodater() is
  'Maintient tandems.blocked_at : posée à l''entrée en blocage, conservée tant qu''il dure, effacée à la sortie. Écrase toute valeur proposée par l''appelant — grant update porte sur toute la table, on n''antidate pas son propre blocage.';

drop trigger if exists tandem_blocage_horodater_trg on public.tandems;
create trigger tandem_blocage_horodater_trg
  before insert or update on public.tandems
  for each row
  execute function public.tandem_blocage_horodater();

-- Les lignes déjà bloquées gardent NULL. Le back-fill est impossible sans
-- inventer une date, et une date inventée dans un dossier de modération vaut
-- moins que pas de date du tout : la seconde se lit comme une inconnue, la
-- première se lit comme un fait. Même arbitrage que `blocked_by`, qui pour la
-- même raison n'a pas de contrainte « status = 'blocked' ⇒ non NULL ».
