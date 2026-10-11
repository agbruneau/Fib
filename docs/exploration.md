# Journal d'exploration des skills

Une entrée par usage de skill (PRD § 9, objectif O2).

## 2026-10-10 — `/setup-matt-pocock-skills` (étape 0)

- **A aidé** : en quatre fichiers, le tracker GitHub, les étiquettes de triage et la disposition des docs du domaine étaient réglés, et toutes les skills d'ingénierie y trouvent leur configuration.
- **Friction** : les gabarits sont en anglais. La skill ne crée pas les étiquettes sur GitHub, alors que `/to-spec` en a besoin, d'où une création manuelle de quatre étiquettes. Elle pose une question par section, même quand l'exploration a déjà tranché.
- **À changer** : créer les étiquettes manquantes dans le même passage.

## 2026-10-10 — `/grill-with-docs` (`grilling` + `domain-modeling`, étape 1)

- **A aidé** :
  - Quatre sous-agents ont établi les faits en parallèle : sondes Node, sondes Python/Go/Rust, sources primaires et lecture de FibCalc.
  - Ils ont trouvé de vrais obstacles :
    - Rust ne lie pas avec MSVC sur cette machine;
    - Python écrit `\r\n` sous Windows;
    - argparse peut colorer ses erreurs;
    - tsc 7 exige `"type": "module"`;
    - `node --test` ne prend pas un dossier;
    - les conversions de `N` sont trop permissives dans les quatre langages.
  - Le grilling a forcé des trous à se combler :
    - une grammaire des arguments commune;
    - un texte d'usage identique;
    - le périmètre de `--time`;
    - les codes de sortie, alignés sur FibCalc;
    - une vérification indépendante de F(100 000) par les périodes de Pisano;
    - un découpage en un ticket par langage, puisque le contrat ne se découpe pas en tranches.
  - Le glossaire a fixé indice, terme, liste et comparaison.
- **Friction** : la skill attend un humain qui tranche à chaque ronde. Ici, l'utilisateur a délégué les décisions, donc l'agent a éprouvé et validé son propre PRD, et le regard extérieur que la skill doit apporter a manqué. Les sous-agents ont coûté environ 380 000 jetons.
- **À changer** : lancer la collecte de faits avant la première ronde, et garder au moins une ronde de décisions pour l'humain.

## 2026-10-10 — Audit après `/grill-with-docs` (sans skill)

- **Angle mort** : le grilling a éprouvé le contrat sur papier et par des sondes de bibliothèques, mais n'a jamais exécuté la commande de lancement du PRD. L'audit a mesuré que `go run` remplace le code de sortie par 1 et ajoute `exit status 2` sur stderr, ce qui aurait cassé le contrat dès le premier ticket Go. Il a aussi trouvé que les worktrees de sous-agents partent par défaut de `origin/main`, donc sans le travail fusionné localement.
- **À changer** : exécuter une tranche minimale par langage (skill `prototype`) avant de figer un PRD, plutôt que de sonder des bibliothèques isolées.

## 2026-10-10 — `/to-spec` (étape 4)

- **A aidé** : la synthèse sans entretien a été rapide, puisque le PRD, le glossaire et les ADR existaient. Le gabarit exige des récits utilisateur exhaustifs (46 ici), ce qui a forcé une relecture complète du contrat. La confirmation des seams a été la seule décision humaine.
- **Friction** : la spec reprend presque tout le PRD, ce qui fait deux sources à garder alignées. Le gabarit interdit les chemins de fichiers, alors que le contrat dépend de commandes de lancement précises.
- **À changer** : quand un PRD détaillé existe, faire de la spec un résumé qui renvoie au PRD plutôt qu'une copie.

## 2026-10-10 — `/to-tickets` (étape 5)

- **A aidé** : la règle du tracer bullet a révélé un défaut du découpage prévu par le PRD. Un ticket « contrat » seul livrait un harnais qu'aucune implémentation n'exerçait avant la mise en parallèle. Le premier ticket joint donc le contrat et l'implémentation TypeScript, dans le même langage que le test. Les dépendances natives de GitHub rendent la frontière visible : #2 bloque #3, #4 et #5.
- **Friction** : la réponse de l'API de dépendances renvoie l'issue bloquée, d'où une vérification à part pour confirmer le sens des arêtes. Le gabarit proscrit les chemins de fichiers, alors que les critères d'acceptation reposent sur des commandes précises (`npm run check:<id>`).
- **À changer** : prévoir dans le gabarit une ligne sur les fichiers partagés qu'un ticket peut toucher. Ici, chaque langage ne peut modifier que sa propre commande de lancement dans le test de contrat.

## 2026-10-10 — `tdd` (catalogue de cas de test)

- **A aidé** :
  - L'anti-pattern « tautologique » a imposé une source à chaque attendu : l'oracle, un fait mathématique ou le texte du contrat. D'où l'identité de Cassini et les périodes de Pisano au lieu de valeurs recalculées.
  - Les seams déjà convenues ont gardé tous les cas sur la bibliothèque ou la CLI.
  - Rédiger le catalogue a fait surgir des cas encore non couverts : la casse de `--algo FAST`, `-help` avec un seul tiret, `--list=5`, `--algo 5`, `--time abc`, la répétition de `--algo` (visible seulement avec `--time`), la locale et le forçage des couleurs. Il a aussi révélé une ambiguïté de la grammaire (`--algo --list 5`), tranchée dans le PRD 1.3.
- **Friction** : la demande d'un catalogue exhaustif écrit d'avance heurte l'anti-pattern du découpage horizontal. Je l'ai résolu en traitant le catalogue comme un carnet de cycles ordonnés, chaque test n'étant écrit qu'à son cycle. Pour Go, Rust et Python, en revanche, le test de contrat existe d'avance : c'est une boucle externe d'acceptation, choisie en connaissance de cause.
- **À changer** : rédiger le catalogue en même temps que le PRD. Ces trous seraient apparus pendant le grilling.

## 2026-10-10 — Implémentation par `fib-dev` (`tdd`, étape 6)

- **A aidé** :
  - Le catalogue et le contrat commun ont fait converger les quatre implémentations : 54 cas verts dans chacune, avec le harnais du ticket #2, réutilisé tel quel par Go, Rust et Python.
  - Les agents ont trouvé de vrais trous :
    - la répétition de `--algo` avec une valeur invalide (cas CLI-A16);
    - la discordance combinée à `--time`;
    - le `$` de Python, qui accepte un saut de ligne final (cas CLI-I16);
    - des indices négatifs qui font boucler `fast` en Go et `matrix` en Python.
  - `worktree.baseRef: "head"` fonctionne : les worktrees sont partis du `main` local fusionné.
- **Friction** :
  - Le téléchargement de l'oracle a été refusé par les permissions, même après accord dans le chat. Aucun ticket n'a donc pu être vérifié en entier, et les cycles qui dépendaient de l'oracle ont été guidés par des sondes jetables.
  - Les agents ne peuvent pas supprimer de fichiers : des sondes sont restées dans les worktrees Go et Rust.
  - Un agent a été interrompu, puis repris à partir de son travail partiel.
  - Le coût : environ un million de jetons et 40 minutes pour les trois langages en parallèle.
- **À changer** : obtenir les données externes (l'oracle) avant de lancer les agents, idéalement à l'étape de la spec, et dire d'emblée aux agents de garder leurs sondes hors du dépôt. C'est maintenant une règle de `fib-dev`.

## 2026-10-10 — Oracle généré et vérification finale

- **A aidé** :
  - La vérification ORA par la seule définition rend l'oracle contrôlable quelle que soit sa provenance. Une génération par la formule de Binet, indépendante des trois algorithmes, a donc suffi à débloquer le projet.
  - Avec l'oracle, les quatre implémentations sont passées au vert dès le premier lancement de `npm run check`. Les sondes jetables des agents avaient fait leur travail, et l'oracle réel n'a révélé aucun écart.
- **Friction** : exiger une copie conforme de l'OEIS était plus fort que nécessaire. Quand le téléchargement a été refusé, cette contrainte a bloqué les quatre tickets.
- **À changer** : exiger de l'oracle une propriété vérifiable (la définition de la suite) plutôt qu'une provenance.

## 2026-10-11 — Audit en workflow, refactorisation, puis `/code-review` (étape 8)

- **A aidé** :
  - L'audit a mis huit auditeurs en lecture seule : un par langage, le contrat, la cohérence entre langages, un test différentiel et la documentation. Un vérificateur sceptique suivait chacun d'eux. Sur 233 constats, 36 ont été réfutés. L'audit n'a trouvé aucun bogue fonctionnel et un seul écart au contrat : Python laissait `PYTHONIOENCODING` changer l'encodage (F10). Il est corrigé, avec le cas CLI-V03.
  - Le test différentiel a joué plus de 120 vecteurs hors catalogue sur les quatre CLI, sans un seul écart de stdout ni de code de sortie.
  - Durcir le contrat avant de refactoriser a protégé la réécriture des messages d'erreur (CLI-A17, A18, H11, U04).
  - `/code-review`, sur ses deux axes, a trouvé ce que l'audit et les `fib-dev` avaient laissé passer :
    - le lecteur d'oracle Rust n'ignorait plus les lignes vides (PRD § 7);
    - un commentaire Python était faux;
    - des commentaires dépassaient 200 caractères.
- **Friction** :
  - L'audit a proposé 38 changements, et la synthèse mêlait l'essentiel et le cosmétique. Le tri s'est fait à la main; trois items et une partie des docs sont reportés.
  - Les briefs imposaient des phrases mot pour mot, ce qui a fait grossir le code de 15 à 33 lignes par langage, surtout en commentaires. Go et Rust dépassent la cible d'A3 (ADR-0003 amendé).
  - Les tickets #2 à #5 avaient été fermés sans `/code-review`, que prévoit pourtant l'étape 4 de la boucle de `CLAUDE.md`. Ce travail-ci n'avait pas de ticket : les briefs en tenaient lieu.
  - Coût : environ 2,5 millions de jetons pour l'audit, et 1,25 million pour la refactorisation, la revue et les corrections.
- **À changer** :
  - Demander à la synthèse un plan court, classé par gain de lecture.
  - Fixer un plafond de lignes dans les briefs de refactorisation.
  - Lancer `/code-review` à chaque ticket.

## 2026-10-11 — Optimisation des performances (hors skill), puis `/code-review`

- **A aidé** :
  - Le banc d'essai commun, mesuré avant tout changement, a montré où partait le temps : le démarrage (TypeScript, Python) et la conversion décimale de la liste. Le calcul ne dominait que pour `iterative`. Sans lui, on aurait optimisé `fast`, qui prenait moins d'une milliseconde.
  - Deux décisions sont revenues au propriétaire, chiffres à l'appui : la liste calculée en décimal, et les commandes de lancement.
  - Une session antérieure avait laissé des pistes Python mesurées (branche `perf/py`); elles ont été reprises.
  - `/code-review` a trouvé que `matrix` en TypeScript refaisait pas à pas l'ancien `fast` : l'algorithme avait perdu son identité.
  - Gains, en temps total : liste 10 000 de ×2,9 à ×4,3, terme seul de −34 % à −45 % en TypeScript et en Python, iterative ×3,8 en Go.
- **Friction** :
  - Quatre agents qui mesurent en même temps se gênent. Leurs chiffres sont bruités, et une mesure seule après la fusion fait foi.
  - Un sous-agent a écrasé le banc d'essai de l'orchestrateur, qui se trouvait dans un dossier temporaire partagé. Il vit maintenant dans le dépôt (`npm run bench`).
  - Le code grossit nettement (TypeScript 232, Python 228, Rust 359, Go 376).
  - Le sandbox refuse la suppression des dossiers de worktrees.
- **À changer** :
  - Fixer dès le brief le nom des tests de garde.
  - Lancer les mesures en série, pas en parallèle.

## Bilan au 2026-10-11

| Skill | Usage |
|---|---|
| `/setup-matt-pocock-skills` | utilisée : tracker GitHub, étiquettes, docs du domaine |
| `/grill-with-docs` (`grilling`, `domain-modeling`) | utilisée : glossaire, ADR-0001 et ADR-0002, PRD éprouvé |
| `/to-spec` | utilisée : spec #1 |
| `/to-tickets` | utilisée : tickets #2 à #5, avec dépendances natives |
| `tdd` | utilisée : catalogue de cas, puis cycles des quatre `fib-dev` |
| `/implement` | remplacée par l'agent `fib-dev`, qui applique `tdd` directement |
| `resolving-merge-conflicts` | non nécessaire : aucune fusion n'a conflicté |
| `research`, `prototype` | non utilisées; un `prototype` aurait détecté plus tôt le piège de `go run` |
| `/code-review` | utilisée : revue Standards et Spec de la refactorisation du 2026-10-11 |
| `diagnosing-bugs`, `/improve-codebase-architecture`, `/handoff` | à venir (étapes 9 à 11 du PRD) |

Trois leçons :

1. **Un catalogue de cas avant le code** a fait converger quatre implémentations indépendantes. Elles sont passées au vert d'un seul coup quand l'oracle est arrivé.
2. **Les sondes par sous-agents valent le coût quand elles exécutent**, plus que quand elles lisent de la doc. Le piège de `go run`, la toolchain MSVC et les fins de ligne CRLF ne sont apparus qu'à l'exécution.
3. **Les données externes sont un prérequis à traiter avant les agents.** L'oracle bloqué a immobilisé les quatre tickets.
