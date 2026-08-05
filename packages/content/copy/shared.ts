/**
 * Les libellés que le web et le mobile disent déjà mot pour mot.
 *
 * Six, sur 133 côté web et 21 côté mobile : les repères de navigation et les
 * deux états de connexion. Ce sont les seuls textes où les deux applications
 * étaient d'accord — le reste relève de deux besoins distincts, pas d'une
 * divergence à corriger (voir web.ts et mobile-home.ts).
 *
 * `today` les a rejoints : le web écrivait "Aujourd'hui" avec une apostrophe
 * droite là où le mobile utilisait l'apostrophe typographique. L'utilisateur a
 * tranché pour la seconde, le web est corrigé, et la clé se range ici.
 */
export const sharedLabels = {
  fr: {
    today: 'Aujourd’hui',
    journey: 'Parcours',
    tandem: 'Tandem',
    language: 'Langue',
    signIn: 'Se connecter',
    signedIn: 'Connecté',
  },
  en: {
    today: 'Today',
    journey: 'Journey',
    tandem: 'Tandem',
    language: 'Language',
    signIn: 'Sign in',
    signedIn: 'Signed in',
  },
} as const
