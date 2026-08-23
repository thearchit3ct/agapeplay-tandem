-- Le nom du partenaire n'était lisible nulle part. L'écran l'inventait.
--
-- « Élodie Martin » est codée en dur dans l'interface web comme mobile depuis
-- la maquette d'origine, et le vrai nom du partenaire n'est jamais affiché —
-- même connecté, même avec un tandem réel en base. Ce n'est pas un simple
-- oubli d'écran : **aucun chemin de lecture n'existait**. La politique
-- `profiles_select_own` (migration `…_000001`, et c'est une bonne politique)
-- borne la lecture de `public.profiles` à sa propre ligne ; le profil du
-- partenaire est donc invisible par construction, et l'interface n'avait
-- littéralement rien à afficher d'autre qu'un nom inventé.
--
-- On n'élargit PAS `profiles_select_own`. Deux raisons, la seconde compte
-- double ici :
--
--   - une politique élargie « aux partenaires de tandem » devrait consulter
--     `public.tandems` depuis une politique de `public.profiles` — sous les
--     droits de l'appelant et sous la RLS de `tandems` (deux pièges déjà
--     documentés dans ce dépôt), pour finir par exposer la ligne ENTIÈRE du
--     profil : locale, statuts de compte, dates de consentement. Le besoin,
--     c'est un nom.
--   - le public a 16-17 ans. Le réflexe de ce dépôt est de refermer, pas
--     d'élargir : la plus petite surface qui répond au besoin est une fonction
--     qui rend le nom, et rien d'autre.
--
-- D'où une fonction `security definer`, comme `tandem_est_moderateur` et pour
-- les mêmes raisons de forme : `search_path` figé, `auth.uid()` comme seul
-- signal d'identité (dans une fonction `security definer`, `current_user`
-- désigne le propriétaire — une garde fondée dessus serait morte), et **sans
-- paramètre**. Avec un `p_user_id`, la fonction deviendrait un annuaire
-- inversé : n'importe quel compte authentifié pourrait résoudre l'identifiant
-- de n'importe qui en nom. Sans paramètre, elle ne sait répondre que sur les
-- tandems où l'appelant figure.

create or replace function public.tandem_partenaire()
returns table (tandem_id uuid, display_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id,
         p.display_name
  from public.tandems t
  left join public.profiles p
    on p.id = case
      when t.participant_a_id = auth.uid() then t.participant_b_id
      else t.participant_a_id
    end
  where auth.uid() is not null
    and (t.participant_a_id = auth.uid() or t.participant_b_id = auth.uid());
$$;

-- Deux choix de comportement, assumés et à ne pas « corriger » sans décision :
--
--   - **Le statut du tandem n'est pas filtré.** C'est le miroir exact de
--     `tandems_select_member`, qui laisse les deux participants lire la ligne
--     même bloquée : l'écran de blocage nomme la relation qu'il gèle, et le
--     nom de la personne avec qui l'on est — ou a été — apparié n'est pas un
--     secret pour soi. Filtrer ici créerait un écran « bloqué avec ??? » que
--     rien ne motive.
--   - **`left join`, pas `join`.** Un compte né d'une acceptation d'invitation
--     peut ne pas avoir encore de ligne dans `profiles` (c'est l'application
--     qui la crée au premier chargement). Un `join` strict ferait disparaître
--     le tandem entier de la réponse, et l'écran conclurait à tort « pas de
--     tandem ». Le `left join` rend la ligne avec un nom NULL : « tandem réel,
--     nom pas encore posé », ce qui est la vérité.

comment on function public.tandem_partenaire() is
  'Le nom du partenaire, pour chaque tandem où figure l''appelant. Sans paramètre — elle lit auth.uid() — pour ne pas devenir un annuaire inversé des profils. Seul chemin de lecture du profil d''autrui : profiles_select_own reste own-only. Nom NULL = partenaire sans ligne profiles encore. Rend zéro ligne sans identité.';

revoke all on function public.tandem_partenaire() from public;
revoke all on function public.tandem_partenaire() from anon;
grant execute on function public.tandem_partenaire() to authenticated;
