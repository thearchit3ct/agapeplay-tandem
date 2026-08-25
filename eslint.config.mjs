/**
 * Le lint du dépôt — posé le 25/08/2026 pour l'issue #15, et borné exprès.
 *
 * Ce dépôt a un style : des commentaires français denses qui expliquent
 * *pourquoi*, des noms de fonctions en français, des lignes qui dépassent
 * quand la phrase le demande. Un lint qui viendrait discuter de ça ferait deux
 * dégâts : un diff de reformatage qui noierait l'histoire du fichier, et
 * l'habitude de passer les avertissements sans les lire. Il n'y a donc ici
 * **aucune règle de mise en forme** — pas de guillemets, pas de points-virgules,
 * pas de largeur de ligne, pas de Prettier.
 *
 * Ce qui reste est ce qu'un compilateur ne dit pas et qu'un relecteur rate :
 * du code mort (`no-unused-vars`), des fautes de logique franches (`no-dupe-keys`,
 * `no-unreachable`, `no-fallthrough`, héritées de la base recommandée), et les
 * règles des hooks React.
 *
 * Mesuré sur l'existant au moment de la pose : **six erreurs**, toutes du code
 * mort réel — cinq imports jamais utilisés et une constante orpheline. Elles ont
 * été retirées dans la même PR. Zéro `no-explicit-any`, zéro violation des
 * règles des hooks : le dépôt était déjà propre, et c'est ce qui rend ce lint
 * tenable en CI au niveau « erreur ».
 *
 * Deux réglages demandent leur justification :
 *
 * - `react-hooks/exhaustive-deps` est en **avertissement**, pas en erreur. Onze
 *   effets omettent délibérément des dépendances (`App.tsx` surtout : y ajouter
 *   `authSession` relancerait des lectures réseau à chaque rafraîchissement de
 *   session). Les corriger changerait le comportement de l'application, ce que
 *   ce chantier d'infrastructure s'interdit ; les taire par onze commentaires
 *   `eslint-disable` serait du bruit posé pour faire plaisir à l'outil. Ils
 *   restent donc visibles et ne bloquent pas — et le jour où quelqu'un reprend
 *   ces effets, la liste est déjà écrite.
 * - Les fichiers générés et les dossiers de build sont ignorés : ils ne sont
 *   pas versionnés, personne ne les corrige.
 */
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      // Base Supabase jetable montée par `npm run test:rls`.
      '.rls-stack/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Les outils du dépôt tournent dans Node (harnais RLS, test de fumée) :
    // sans ça, `no-undef` prendrait `process` et `fetch` pour des inconnus.
    // Les fichiers TypeScript n'en ont pas besoin — `tseslint` y coupe
    // `no-undef`, le compilateur faisant ce travail bien mieux.
    files: ['**/*.{mjs,js}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{ts,tsx,mts,mjs,js}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
)
