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
  - L'anti-pattern « tautologique » a imposé une source à chaque attendu : l'oracle, un fait mathématique ou le texte du contrat. D'où l'identité de Cassini et les périodes de Pisano au lieu de termes recalculés.
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
  - L'audit a mis huit auditeurs en lecture seule : un par langage, le contrat, la cohérence entre langages, un test différentiel et la documentation. Un vérificateur sceptique suivait chacun d'eux. Sur 233 constats, 36 ont été réfutés. L'audit n'a trouvé aucune erreur de calcul et un seul écart au contrat : Python laissait `PYTHONIOENCODING` changer l'encodage (F10). Il est corrigé, avec le cas CLI-V03.
  - Le test différentiel a joué 121 vecteurs hors catalogue sur les quatre CLI, sans un seul écart de stdout ni de code de sortie.
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

## 2026-10-11 — Borne d'un terme à 1 000 000, puis `/code-review`

- **A aidé** :
  - Les faits attendus (208 988 chiffres, et les congruences mod 2048 et mod 1000 tirées des périodes de Pisano) ont été vérifiés avant d'écrire le cas CLI-T13. Le contrat est passé au rouge, puis les quatre langages au vert.
  - Le banc d'essai a dit où optimiser, et où ne pas le faire. Go, Rust et TypeScript convertissent déjà en temps sous-quadratique, et aucune piste maison n'y a passé le seuil des 3 %. En Python, deux seuils mesurés font passer F(1 000 000) de 288 à 38 ms.
  - `/code-review` : l'axe Spec a joué 152 sondes, sans un seul écart, jusqu'à F(1 000 000) par `iterative`. L'axe Standards a vu que le chemin `Decimal` contournait la seam, et que deux gardes avaient un attendu tautologique ou pris d'un autre algorithme.
- **Friction** :
  - Un brief a supposé que `num-bigint` convertissait en temps quadratique, ce qui était faux. L'agent l'a vérifié dans la source avant d'écrire du code.
  - Les gains restants passent tous par le parallélisme, que le PRD § 8 exclut.
- **À changer** : mesurer la bibliothèque à la nouvelle taille avant de rédiger les pistes du brief.

## 2026-10-11 — Exécution et épreuve des cas de test, en workflow `ultracode` (hors skill)

- **Résultats** :
  - `npm run check:<id>` est vert dans les quatre langages. Le contrat passe 96 sur 96 partout (ORA-01 à 06 et les 90 cas CLI, tous joués). Tests unitaires : Go 11 (6 028 sous-tests), Rust 20, TypeScript 28, Python 30. BIB-01 à 14 sont portés partout, sauf BIB-14 en Rust, exclu comme prévu.
  - L'oracle a été recalculé par addition, sans la formule de Binet du générateur. Ses 52 vérifications concordent : la table à l'octet, les valeurs et restes du § 2, les périodes de Pisano, les nombres de chiffres et Cassini.
  - Différentiel : `100000`, `1000000`, `--list 10000`, `--algo all 1000000` et `--algo iterative 1000000` ont la même empreinte SHA-256 dans les quatre langages. Cela couvre les chiffres du milieu, que T12, T13 et L06 ne vérifient pas.
  - Mutation, avec 16 mutants par langage dans des worktrees jetables : 57 tués sur 64. Le code d'origine est correct partout; deux survivants montrent des cas absents du contrat :
    - en Go, un mutant qui rend `--algo` insensible à la casse passe, parce que la bibliothèque refuse encore `FAST`. `--algo FAST --algo fast 5`, par exemple, le distingue;
    - en TypeScript, un mutant qui ne cite en ASCII que le premier caractère non ASCII passe. `--bögüs 5` le tuerait.

    Vérifié sur les quatre CLI d'origine : `--algo FAST --algo fast 5` sort en erreur, et `--bögüs 5` est cité en ASCII. Les autres survivants : l'écriture tamponnée, sans garde en Go comme en Rust; la retenue Go à exactement 10^18, inatteignable par la CLI, et testable seulement une fois l'additionneur extrait de `FibList` (fait par #8 pour PERF-GO-5, pendant de PERF-RS-4); un limbe de marge inutile dans le tampon TypeScript; le mutant M-py-5, qui fait accepter `bool` par la bibliothèque Python. Le code d'origine le refuse (`TypeError`), mais BIB-14 ne nommait pas `True` : le catalogue n'arbitrait pas ce cas, ajouté par #14. (Corrigé le 2026-10-12 : cette ligne prêtait au vrai code le comportement du mutant.)
  - Fidélité au catalogue : sur 100 constats bruts, 61 ont été maintenus par au moins deux vérificateurs sur trois (1 majeur, 35 mineurs, 25 cosmétiques).
    - Le majeur, rejoué en mutant : PERF-PY-14 ne garde pas le passage à `str()` au-delà de 200 000 bits. Sans cette branche, les 30 tests Python restent verts.
    - Mineurs récurrents : des tests PERF qui ne gardent pas ce qu'ils annoncent (écriture par tranches, absence d'allocation en Rust, seuils Python lus dans les constantes, démarrage Go), des balayages BIB-05 à 07 non paramétrés, une notation des espaces ambiguë (I15, U02), une traçabilité périmée (T12 encore sous F8), et V02 et V03 neutralisés par `python -I`.
  - Banc d'essai sur 15 exécutions, machine au repos : les médianes tombent à 1 ms près des valeurs finales du README, donc aucune régression.
- **A aidé** :
  - La mutation mesure le pouvoir des tests, ce qu'un « tout vert » ne dit pas : elle a trouvé deux cas qui manquent au contrat, malgré 384 cas verts.
  - La vérification adverse a écarté 39 constats sur 100.
  - Le critique de complétude a relevé qu'une douzaine de constats maintenus n'étaient que des déductions. Le majeur a été exécuté avant d'être consigné.
- **Friction** :
  - Coût : 26 millions de jetons pour l'épreuve (327 agents, dont 300 vérificateurs), contre 0,35 million pour la simple exécution des quatre suites.
  - Un vérificateur maintient une déduction aussi volontiers qu'un fait exécuté. Le vote ne remplace pas l'exécution.
  - Les agents actifs faussent le banc d'essai : un premier passage dépassait le README de 5 à 20 %.
  - Pour quatre survivants sur sept, les deux juges ont rendu des classes différentes, ou une classe que le critique conteste.
  - L'orchestrateur a d'abord décrit le comportement de deux mutants comme celui du vrai code, et l'a consigné ainsi. Il a corrigé après exécution sur les CLI d'origine.
- **À changer** :
  - Trancher par l'exécution, mutant ou commande, plutôt que par le vote, et réserver les trois voix aux constats majeurs.
  - Lancer le banc seul, sur une machine au repos.
  - Décider des suites : les cas `--algo FAST --algo fast 5` et `--bögüs 5`; des gardes pour PERF-PY-14, pour l'écriture tamponnée et pour l'absence d'allocation en Rust; la notation des espaces et la traçabilité du catalogue.

## 2026-10-12 — Tickets #6 à #10 et #12 à #14 par `fib-dev`, puis `/code-review` (session infonuagique)

- **Contexte** : la session locale avait pris #6 à #10, puis s'était arrêtée parce que OneDrive avait passé des fichiers de `.git` en « nuage seulement ». Rien n'était poussé. Une session infonuagique (Linux, 4 cœurs) a tout repris depuis `bf684e5`. La branche `claude/determined-fermi-8r5kmg` a tenu lieu de `main` pour l'intégration, avec la PR agbruneau/Fib#15 vers `main`.
- **Résultats** :
  - Huit `fib-dev` ont livré les huit tickets en trois vagues, selon les bloqueurs : #6 à #10 en parallèle, puis #12 et #14, puis #13. Trois autres ont appliqué les corrections de revue. Les onze fusions se sont faites sans conflit.
  - `npm run check` est vert sur les quatre langages, et `npm run contract` passe 398 sur 398 (6 ORA + 4 × 98 cas CLI). Chaque garde nouvelle a été vue rouge sur le mutant de son ticket, puis verte sur le code d'origine.
  - Banc A/B au repos, binaires de `bf684e5` et de la branche lancés en alternance, 61 exécutions chacun. Les écarts restent sous le seuil de 3 % de #8 et #9 : Go `--list 10000` à +0,0 % au total (+1,5 % au calcul), Rust `--list 10000` à −1,0 %, Rust `iterative 100000` à +0,5 %.
- **A aidé** :
  - Les `fib-dev` ont corrigé ou nuancé quatre prototypes des tickets, en les exécutant plutôt qu'en les recopiant :
    - PERF-PY-21, tel que prototypé, laissait survivre la fuite d'`Emax`. PERF-PY-10 passe avant lui dans l'ordre alphabétique et laissait déjà `Emax` modifié. La garde tourne maintenant dans un contexte neuf.
    - PERF-TS-1 ne garde que la fin paire de la boucle de `fibList`; PERF-TS-5 garde la fin impaire.
    - `Math.round` à la place de `Math.ceil` est un mutant équivalent tant que le limbe d'assurance reste.
    - Sous M-py-5, quatre des sous-tests rouges sont dans BIB-14 et deux dans PERF-PY-16, qui partagent `REFUSED`.
  - `/code-review` a trouvé quatre défauts que les agents n'avaient pas vus :
    - CLI-U05 et CLI-A20, écrits par #6 en parallèle de #12, promettaient la citation que #12 retirait de U04 et A18;
    - V02 vidait `NO_COLOR` au lieu de le retirer, alors qu'un `NO_COLOR` vide fait avertir Node 22 sur stderr;
    - PERF-RS-8 tirait sa borne de la constante qu'il garde;
    - PERF-GO-7 rougissait sous `go test -cover`.
- **Friction** :
  - La skill `tdd` (plugin `mattpocock-skills`) n'est pas installée dans la session infonuagique : chaque `fib-dev` a suivi son cycle à la main.
  - `gh issue view` échoue, parce que GraphQL est refusé; `gh api repos/…/issues/<n>` passe.
  - Les références du banc de #8 et #9 venaient de la machine Windows du propriétaire : la comparaison ne vaut que sur une même machine, d'où l'A/B en alternance.
  - Deux `fib-dev` ont écrit dans le même dossier temporaire, et l'un a écrasé un fichier de l'autre.
  - `/code-review bf684e5` a revu le seul commit `bf684e5`, et non la plage voulue. Ce passage a quand même trouvé trois erreurs du journal du 2026-10-11, corrigées ci-dessus.
  - Huit constats de la revue sont écartés :
    - six contestent un choix que le ticket imposait : la marge nulle des allocations Go, PERF-PY-18 qui fige les seuils, les 6 003 sous-tests TypeScript, les trois passes de T13, l'environnement sans `PYTHON*` de PERF-PY-20, les commentaires de deux lignes;
    - deux reposent sur un environnement improbable ici : `go` absent du PATH, `PYTHONHOME` requis.
- **À changer** :
  - Donner à chaque `fib-dev` un sous-dossier temporaire à lui.
  - Passer à `/code-review` une cible explicite (la branche), jamais un SHA seul.
  - Installer `mattpocock-skills` dans l'environnement infonuagique, ou dire d'emblée dans le prompt que `tdd` manque.
  - Quand des tickets parallèles touchent la même règle, comme #6 et #12 pour les citations, donner la règle aux deux.

## 2026-10-12 — `diagnosing-bugs` (étape 9, #16)

- **Contexte** : aucun écart entre langages n'était connu. Le différentiel de 121 vecteurs du 2026-10-11 n'en avait trouvé aucun, et l'écart `PYTHONIOENCODING` était déjà corrigé. La skill part d'un bug signalé ; il a donc fallu en trouver un d'abord. La skill n'est pas installée dans la session infonuagique : son `SKILL.md` a été lu dans `mattpocock/skills` et suivi à la main.
- **Recherche** : un workflow de cinq chercheurs a construit chacun une boucle différentielle, le n° 9 de la phase 1 de la skill. Les dimensions sont la grammaire, les valeurs, les durées, l'environnement et les arguments extrêmes, soit environ 170 000 entrées sur les quatre CLI. Un vérificateur sceptique par dimension a ensuite reproduit, minimisé et classé chaque candidat face au PRD § 4.
  - La grammaire (83 319 suites, dont toutes celles de 1 à 3 jetons sur 41) et les valeurs (14 793 entrées, autour de chaque seuil d'optimisation) n'ont donné aucun candidat.
  - L'écart retenu a été trouvé trois fois, de façon indépendante : avec le fd 2 fermé, Python sort en code 1, stdout vide.
  - D'autres comportements divergent là où le contrat ne tranche pas. Ils sont listés plus bas.
- **Phases** :
  1. La boucle de rétroaction est un script Python qui lance les quatre CLI avec `os.close(2)`. Elle rougit sur 6 entrées, Python seul, en 0,46 s, de façon déterministe sur 4 passes.
  2. Minimisation : `python python/fib.py 2>&-` suffit. Ni l'argument, ni `-I -S` ne sont nécessaires.
  3. Hypothèses : 5, classées.
  4. Sondes : une par prédiction. H1 est confirmée : avec le fd 2 fermé, CPython met `sys.stderr` à `None`, et `reconfigure` plante avant `main`. Les quatre autres hypothèses sont réfutées. Un prototype jetable a montré que garder le seul `reconfigure` ne suffisait pas : les écritures de `main` tombaient ensuite sur le même `None`.
  5. Correctif et non-régression, test d'abord, par un `fib-dev`. CLI-V04 a été vu rouge pour Python seul, puis vert partout. Le correctif donne un puits `/dev/null` à un flux `None`, avec un `import os` paresseux. Le banc A/B reste à +0,2 à +0,7 % sur `petit (10)`.
  6. Nettoyage : le prototype est supprimé, et le dépôt ne garde aucune instrumentation.
- **`/code-review`** : 9 constats, 7 retenus.
  - V04 ne prouvait pas que le fd 2 était fermé pour la CLI elle-même : un mutant du harnais le laissait vert.
  - Rien ne gardait le correctif sous Windows, où V04 se saute : ajout de PERF-PY-23, portable.
  - L'`import os` paresseux n'avait pas de garde : ajout de PERF-PY-24. Celle-ci compare au démarrage nu de l'interpréteur, pour ne pas rougir à tort sur une plateforme qui charge `os` au démarrage.
  - Le commentaire du correctif était faux pour le fd 1.
  - Le PRD § 4 était muet sur un stderr fermé.
  - Retouches mineures : le contrôle du harnais tournait quatre fois, et les nouveaux cas n'étaient pas comptés au README.
  
  Écarté : un stderr ouvert mais qui refuse l'écriture, qui relève des comportements à arbitrer ci-dessous.
- **A aidé** :
  - La boucle différentielle a trouvé un vrai écart là où 121 vecteurs et 402 cas verts n'en voyaient aucun. Elle a pris la dimension que personne n'avait jouée : l'état des descripteurs au lancement.
  - Le vérificateur sceptique a ramené 15 candidats à 4 bugs et 10 lacunes, chacun avec sa commande minimale.
  - La phase 4 a évité un correctif à moitié : le seul garde de `reconfigure` aurait laissé `--time` et les erreurs d'usage en code 1.
- **Friction** :
  - La skill suppose un bug signalé. Sans écart connu, la recherche a coûté plus que le diagnostic : 1,1 million de jetons et 88 minutes pour le workflow, contre quelques minutes pour les phases 1 à 4.
  - Le contrat ne sait pas fermer un descripteur sous Windows : V04 s'y saute, et une garde Python prend le relais.
  - `/code-review` a dû rattraper deux trous dans un test écrit test d'abord : un harnais qui pouvait passer à vide, et une plateforme non couverte.
- **À arbitrer**, des cas que le contrat ne tranche pas et où les CLI divergent, tous reproduits :
  - stdout en tube non bloquant : Rust tronque en silence avec le code 0, Python plante, Go et TS réessaient.
  - stdout ou stderr qui refuse l'écriture (`/dev/full`, `ulimit -f`, tube sans lecteur) : quatre codes différents, et un succès annoncé à tort par Go et Rust (`/dev/full`) ou par Go et TS (`ulimit -f`).
  - Traces de plantage de TS et de Python : elles contiennent des séquences ANSI quand `FORCE_COLOR=1`.
  - `2>&1` sur un tube : TS place la ligne de durée au milieu d'un terme dès 64 Kio de sortie.
  - `ulimit -v` : Go sort en code 2, le code d'une erreur d'usage.
- **À changer** :
  - Garder la boucle différentielle comme outil de recherche, avant `diagnosing-bugs`, quand aucun bug n'est signalé.
  - Faire écrire au `fib-dev`, dans tout test qui manipule le harnais, le mutant du harnais qui doit le faire rougir.

## Bilan au 2026-10-12

| Skill | Usage |
|---|---|
| `/setup-matt-pocock-skills` | utilisée : tracker GitHub, étiquettes, docs du domaine |
| `/grill-with-docs` (`grilling`, `domain-modeling`) | utilisée : glossaire, ADR-0001 et ADR-0002, PRD éprouvé |
| `/to-spec` | utilisée : spec #1 |
| `/to-tickets` | utilisée : tickets #2 à #5, avec dépendances natives |
| `tdd` | utilisée : catalogue de cas, puis cycles des quatre `fib-dev`; absente de la session infonuagique du 2026-10-12, où les `fib-dev` ont suivi son cycle à la main |
| `/implement` | remplacée par l'agent `fib-dev`, qui applique `tdd` directement |
| `resolving-merge-conflicts` | non nécessaire : aucune des 41 fusions n'a conflicté |
| `research`, `prototype` | non utilisées; un `prototype` aurait détecté plus tôt le piège de `go run` |
| `/code-review` | utilisée trois fois le 2026-10-11, axes Standards et Spec : après la refactorisation, après l'optimisation, après la borne à 1 000 000; puis une fois le 2026-10-12, sur les tickets #6 à #14 |
| `diagnosing-bugs` | utilisée à l'étape 9 (#16), lue dans `mattpocock/skills` faute de plugin; précédée d'une boucle différentielle pour trouver l'écart |
| `/improve-codebase-architecture`, `/handoff` | à venir (étapes 10 et 11 du PRD) |

Hors skill : l'audit du PRD (2026-10-10), l'audit en workflow du 2026-10-11 (auditeurs en lecture seule), puis l'optimisation des performances et la borne à 1 000 000, confiées à des sous-agents `fib-dev`, et enfin l'épreuve des cas de test en workflow.

Cinq leçons :

1. **Un catalogue de cas avant le code** a fait converger quatre implémentations indépendantes. Elles sont passées au vert d'un seul coup quand l'oracle est arrivé.
2. **Les sondes par sous-agents valent le coût quand elles exécutent**, plus que quand elles lisent de la doc. Le piège de `go run`, la toolchain MSVC et les fins de ligne CRLF ne sont apparus qu'à l'exécution.
3. **Les données externes sont un prérequis à traiter avant les agents.** L'oracle bloqué a immobilisé les quatre tickets.
4. **Mesurer avant d'optimiser.** Le banc d'essai a montré que le temps partait au démarrage et dans la conversion décimale, pas dans `fast`, qui calculait F(100 000) en moins d'une milliseconde. À 1 000 000, il a aussi dit où ne rien changer : Go, Rust et TypeScript convertissaient déjà en temps sous-quadratique.
5. **La revue trouve ce que les agents laissent passer.** À chacun de ses trois passages, `/code-review` a trouvé un défaut que les `fib-dev` n'avaient pas vu : le lecteur d'oracle Rust qui n'ignorait plus les lignes vides (PRD § 7), `matrix` en TypeScript qui refaisait l'ancien `fast`, le chemin `Decimal` de Python qui contournait la seam.
