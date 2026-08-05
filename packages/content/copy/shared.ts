/**
 * Les libellés que le web et le mobile disent déjà mot pour mot.
 *
 * Cinq, sur 133 côté web et 21 côté mobile : les repères de navigation et les
 * deux états de connexion. Ce sont les seuls textes où les deux applications
 * étaient strictement d'accord — le reste relève de deux besoins distincts,
 * pas d'une divergence à corriger (voir web.ts et mobile-home.ts).
 *
 * Volontairement absent : `today`. Les deux applications disent « Today » en
 * anglais, mais le web écrit "Aujourd'hui" avec une apostrophe droite là où le
 * mobile utilise l'apostrophe typographique. Le mobile a raison ; aligner le
 * web change un texte affiché, ce qui n'est pas de ce lot.
 */
export const sharedLabels = {
  fr: {
    journey: 'Parcours',
    tandem: 'Tandem',
    language: 'Langue',
    signIn: 'Se connecter',
    signedIn: 'Connecté',
  },
  en: {
    journey: 'Journey',
    tandem: 'Tandem',
    language: 'Language',
    signIn: 'Sign in',
    signedIn: 'Signed in',
  },
} as const
