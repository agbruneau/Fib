# PRD — Fib : calculateur Fibonacci académique en quatre langages

Version 1.5 · 2026-10-10 · André-Guy Bruneau. Révisée par `/grill-with-docs`, par un audit, par le catalogue de cas de test, puis par l'implémentation des tickets #2 à #5 : le vocabulaire est dans `CONTEXT.md`, les décisions durables dans `docs/adr/`.

## 1. Contexte et objectifs

Fib sert de banc d'essai pour explorer les skills de Matt Pocock (plugin `mattpocock-skills` v1.2.3) en Go, Rust, TypeScript et Python. Le calcul de Fibonacci est un prétexte : chaque implémentation reste académique, courte et lisible. La référence fonctionnelle est [agbruneau/Fibonacci](https://github.com/agbruneau/Fibonacci) (FibCalc, en Go); Fib n'en garde qu'un sous-ensemble.

- **O1** — Une même CLI dans les quatre langages, avec un contrat respecté à l'octet près.
- **O2** — Chaque skill du flux de Matt Pocock (§ 9) sert au moins une fois sur du vrai travail, et son constat est consigné.
- **O3** — Un code qu'un étudiant lit d'un trait : l'algorithme, sans optimisation au-delà.

La performance n'est pas un objectif. `--time` sert à comparer les langages et les algorithmes, pas à les optimiser.

## 2. Ce que Fib retient de FibCalc

| FibCalc | Fib | Raison |
|---|---|---|
| `-algo fast` (fast doubling) | `fast` (doublement rapide) | cœur académique en O(log n) |
| `-algo matrix` (avec Strassen) | `matrix`, sans Strassen | exponentiation matricielle simple |
| — | `iterative` | base de comparaison en O(n) |
| `-algo all`, par défaut, en concurrence | `all` (comparaison), séquentielle, sur demande | des durées mesurées sans concurrence; un seul calcul par défaut |
| `-n`, qui accepte `0x…` et `_` | indice `N` positionnel, en décimal ASCII seulement | la même règle dans les quatre langages |
| code 3 sur discordance | code 3 | repris tel quel |
| code 4 sur erreur de configuration | code 2 | convention Unix des erreurs d'usage |
| usage sur stderr | `--help` sur stdout | l'aide demandée est une sortie normale |
| `-details` : durée du calcul seul | `--time` : même périmètre | mesures comparables |
| golden généré par le code | oracle OEIS | ADR-0001 |
| `fft`, `gmp`, TUI, calibration, seuils, `-memory-limit`, `-gc-control`, `-timeout`, `-last-digits`, `-output`, variables `FIBCALC_*`, profilage, complétion, Docker, CI | exclus | voir § 8 |

Fib ajoute `--list`, qui produit la liste F(0) … F(N).

## 3. Domaine

Le vocabulaire (indice, terme, liste, borne, algorithme, comparaison, discordance, oracle, contrat) est défini dans `CONTEXT.md`.

- F(0) = 0, F(1) = 1, F(n) = F(n−1) + F(n−2) pour n ≥ 2. Les termes sont des entiers exacts, jamais en virgule flottante ni tronqués.
- `iterative` : deux termes consécutifs en mémoire, O(n) additions.
- `matrix` : [[1,1],[1,0]]ⁿ = [[F(n+1), F(n)], [F(n), F(n−1)]], par carrés successifs.
- `fast` : doublement rapide, avec F(2k) = F(k)·(2F(k+1) − F(k)) et F(2k+1) = F(k)² + F(k+1)².

## 4. Contrat de la CLI

### Grammaire

Chaque implémentation analyse ses arguments à la main selon cette grammaire (ADR-0002). Options et indice peuvent venir dans n'importe quel ordre.

1. Avant toute autre analyse : si un argument vaut exactement `--help` ou `-h`, y compris à la place de la valeur de `--algo`, le texte d'usage va sur stdout, code 0, quels que soient les autres arguments.
2. `--algo X` ou `--algo=X`, avec X exactement l'un de `iterative`, `matrix`, `fast` ou `all`, casse comprise. Dans la forme `--algo X`, X est l'argument suivant, quel qu'il soit : `--algo --list 5` est une erreur. Chaque occurrence doit être valide : `--algo bogus --algo fast 5` est une erreur. Parmi des occurrences valides, la dernière gagne. Sans valeur, ou avec une valeur vide, c'est une erreur d'usage.
3. `--list` et `--time` sont des drapeaux; les répéter ne change rien.
4. Tout autre argument qui commence par `-` est une option inconnue, `-1` compris.
5. Il reste exactement un argument, l'indice `N`. Il doit correspondre à `^[0-9]+$` (chiffres ASCII) **avant toute conversion**. Les zéros de tête sont permis : `007` vaut 7.
6. `--list` combiné à `--algo`, même `--algo fast`, est une erreur d'usage.

Texte d'usage, identique à l'octet près dans les quatre langages :

```
usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
```

### Exigences

| ID | Exigence |
|---|---|
| F1 | `fib N` écrit le terme F(N) en décimal, suivi de `\n`, sur stdout. Code 0. Algorithme par défaut : `fast`. |
| F2 | `--algo X` choisit l'algorithme. La sortie est la même pour tout X. |
| F3 | `--algo all` lance la comparaison : `fast`, `iterative` puis `matrix`, l'un après l'autre (ordre alphabétique, comme FibCalc). S'ils concordent, le terme est écrit une seule fois. En cas de discordance, stdout reste vide, une seule ligne qui commence par `fib: ` va sur stderr, sans durée même avec `--time`, et le code est 3. |
| F4 | `--list N` écrit la liste F(0) … F(N), un terme par ligne (N + 1 lignes, chacune terminée par `\n`, la dernière comprise), générée par l'algorithme `iterative`. |
| F5 | `--list` et `--algo` s'excluent (grammaire, règle 6). |
| F6 | `--time` écrit sur stderr une ligne par algorithme exécuté, dans l'ordre d'exécution : `<algo> <durée> ms`, la durée à 3 décimales avec un point décimal, quelle que soit la locale. La durée ne couvre que le calcul : ni l'analyse des arguments, ni la conversion décimale, ni l'écriture. `--list` compte comme `iterative`. stdout ne change pas. |
| F7 | `--help` et `-h` écrivent le texte d'usage ci-dessus sur stdout. Code 0. |
| F8 | Bornes : N ≤ 100 000 pour un terme; N ≤ 10 000 pour une liste, soit environ 10,5 Mo de sortie. |
| F9 | Erreur d'usage (tout écart à la grammaire, ou N hors borne, y compris trop grand pour un entier natif) : stdout vide, exactement une ligne sur stderr qui commence par `fib: `, code 2. Le texte qui suit le préfixe est libre. Pas de panique, de trace de pile ni de texte d'usage ajouté. |
| F10 | stdout et stderr sont en ASCII, sans séquence ANSI, avec des fins de ligne `\n` sur toutes les plateformes, Windows compris. |

Codes de sortie : 0 succès, 2 erreur d'usage, 3 discordance. Tout autre code signale une défaillance hors contrat.

**Hors contrat** (comportement non spécifié, non testé) : un stdout fermé avant la fin (`fib --list 10000 | head`) et un argument qui n'est pas de l'Unicode valide.

## 5. Exigences par langage

Chaque langage expose une seule seam de bibliothèque, nommée selon ses conventions :

- `fib(n, algo)` → le terme F(n), pour l'un des trois algorithmes. Elle rejette un algorithme inconnu, et n < 0 quand le type l'admet.
- `fibList(n)` → la liste F(0) … F(n).

La CLI est un adaptateur mince : grammaire, bornes, comparaison, durées, formatage, codes de sortie.

| | Go | Rust | TypeScript | Python |
|---|---|---|---|---|
| Dossier | `go/` | `rust/` | `ts/` | `python/` |
| Identifiant (scripts, test de contrat) | `go` | `rust` | `ts` | `py` |
| Version minimale | Go 1.26 | stable, édition 2024 | Node 24, TypeScript 7 | Python 3.12 |
| Grand entier | `math/big` | crate `num-bigint` 0.5 | `bigint` natif | `int` natif |
| Arguments | analyse manuelle (ADR-0002) | idem, depuis `std::env::args_os` | idem | idem |
| Tests | `go test`, tests table-driven | `cargo test` | `node --test` | `unittest` |
| Analyse statique | `go vet` | `cargo clippy -- -D warnings` | `tsc` (sans émission) | — |
| Exécutable du contrat, depuis la racine | `go -C go build -o ../.build/fib ./cmd/fib`, puis `.build/fib` (`fib.exe` sous Windows, suffixe donné à `-o`) | `cargo run -q --release --manifest-path rust/Cargo.toml --` | `node ts/src/cli.ts` | `python python/fib.py` |

Dépendances autorisées : `num-bigint`, avec ses dépendances transitives `num-integer`, `num-traits` et `autocfg`, pour Rust; `typescript` et `@types/node` en `devDependencies` pour TypeScript. Aucune autre.

Durée indicative du calcul itératif de F(100 000) sur la machine de développement : Go 17 ms, Rust 26 ms, Node 43 ms, Python 53 ms.

### Pièges vérifiés le 2026-10-10

- **Tous les langages** : valider `N` par l'expression régulière avant de le convertir. `int()` de Python accepte `+5`, `1_000`, ` 5 ` et des chiffres non ASCII; `Number` et `BigInt` acceptent `+5`, ` 5` et `0x10`, et valent 0 pour la chaîne vide; `parse::<u64>()` de Rust accepte `+5`, tout comme `strconv.Atoi` de Go (mais pas `ParseUint`). Vérifié le 2026-10-10. En Python, valider avec `re.fullmatch` : le `$` de `^[0-9]+$` accepte un saut de ligne final (cas CLI-I16).
- **Python** : sous Windows, stdout et stderr écrivent `\r\n`. Appeler `sys.stdout.reconfigure(newline="\n")`, et de même pour stderr. `str()` d'un terme de plus de 4 300 chiffres lève `ValueError` : appeler `sys.set_int_max_str_digits(0)` au chargement du module.
- **TypeScript** :
  - Le `package.json` racine doit déclarer `"type": "module"`, sans quoi tsc 7 refuse les imports ES.
  - N'utiliser que de la syntaxe effaçable (`erasableSyntaxOnly` : ni `enum` ni `namespace`) et des imports relatifs avec l'extension `.ts` (`allowImportingTsExtensions`).
  - Terminer en posant `process.exitCode`, jamais par `process.exit()` : sur un pipe POSIX, les écritures sont asynchrones et `exit()` peut tronquer la sortie. Ce n'est pas reproduit sous Windows, où elles sont synchrones.
  - `node --test` prend un glob (`"ts/**/*.test.ts"`), pas un dossier.
- **Go** : `go run` remplace le code de sortie du programme par 1 et ajoute `exit status N` sur stderr (vérifié le 2026-10-10) : le contrat s'exécute donc sur un binaire compilé par `go build`. `cargo run -q` conserve le code et le stderr (vérifié). Un premier build à froid prend environ 17 s, les suivants moins d'une seconde. Sous Windows, l'horloge peut afficher `0.000 ms` pour un petit N, ce qui est accepté.
- **Rust** : `std::env::args` panique sur un argument qui n'est pas de l'Unicode valide, d'où `args_os`. Sous Windows, la toolchain MSVC exige le composant C++ de Visual Studio Build Tools, absent de la machine de développement. Le dossier du dépôt y utilise donc une override rustup locale (`rustup override set stable-x86_64-pc-windows-gnu`), qui ne fait pas partie du dépôt mais couvre ses sous-dossiers, donc les worktrees de `fib-dev` sous `.claude/worktrees/` (vérifié). Ailleurs, la toolchain par défaut convient.

## 6. Dépôt

```
Fib/
├── README.md, PRD.md, CLAUDE.md, CONTEXT.md, .gitignore
├── docs/adr/, docs/agents/, docs/cas-de-test.md, docs/exploration.md
├── contracts/
│   ├── b000045.txt      oracle : F(0) … F(2000), au format du b-file OEIS A000045
│   ├── generer_oracle.py  génère l'oracle par la formule de Binet
│   ├── README.md        provenance de l'oracle
│   ├── oracle.ts        lecture et vérification de l'oracle (ORA), en TypeScript
│   └── cli.test.ts      test de contrat
├── go/  rust/  ts/  python/
├── package.json         "type": "module", point d'entrée unique
└── tsconfig.json        couvre ts/ et contracts/
```

Les quatre implémentations sont indépendantes (ADR-0001) : la seule frontière est la CLI, et la seule source de vérité partagée est `contracts/`.

| Script de `package.json` | Rôle |
|---|---|
| `check:go`, `check:rust`, `check:ts`, `check:py` | analyse statique, tests du langage, puis test de contrat pour ce seul langage |
| `contract` | test de contrat pour les implémentations présentes |
| `check` | les quatre `check:*` |

`node contracts/cli.test.ts [id…]` vérifie les implémentations nommées par leur identifiant. Un identifiant dont le dossier manque fait échouer le test. Sans argument, le test vérifie les implémentations dont le dossier existe; s'il n'y en a aucune, il ne vérifie que l'oracle. Pour Go, il compile d'abord le binaire (§ 5).

## 7. Tests et critères d'acceptation

**Seams convenues** (celles que `tdd` utilisera, aucune autre) :

1. la bibliothèque `fib` / `fibList` de chaque langage;
2. la CLI, par le test de contrat commun.

**Oracle**

- `contracts/b000045.txt` est la table F(0) … F(2000) au format du b-file OEIS A000045 : une ligne `n F(n)`, avec une espace, fins de ligne LF, sans en-tête. Les lecteurs ignorent les lignes vides.
- Le téléchargement du b-file ayant été bloqué par les permissions de la session, la table est générée par `contracts/generer_oracle.py`. Ce script applique la formule de Binet en arithmétique décimale à 600 chiffres, une méthode indépendante des trois algorithmes testés (amendement de l'ADR-0001).
- Son exactitude ne dépend pas du générateur : ORA-04 et ORA-05 la vérifient par la définition seule, et toute table qui les passe est la suite de Fibonacci. Elle coïncide avec la page OEIS pour F(2000).
- Les termes attendus viennent de l'oracle ou de faits mathématiques indépendants du code. Ils ne sont jamais recalculés comme le fait le code (anti-pattern « tautologique » de `tdd`).

**Cas de test** : `docs/cas-de-test.md` est la source unique des cas. Il donne, pour chacun, l'attendu et sa source, ainsi que l'ordre des cycles TDD.

- ORA-01 à ORA-06 : vérification de l'oracle par le test de contrat, avant tout cas CLI.
- BIB-01 à BIB-14 : la bibliothèque, dans chaque langage (seam 1).
- les cas CLI : le contrat de la CLI, joué sur chaque implémentation (seam 2). Des assertions communes s'appliquent à chaque cas : code de sortie, stdout octet pour octet, stderr, format ASCII.

Le chemin de la discordance (code 3) dans la CLI n'a pas de test automatique, puisque aucun cas ne peut la provoquer. BIB-08 vérifie que les algorithmes concordent.

**Acceptation globale**

- **A1** — Chaque ticket de langage : les cas ORA, les cas BIB de son langage et tous les cas CLI de son identifiant passent, donc `npm run check:<id>` et `npm run contract` sont verts sur `main`. Le projet : `npm run check` passe sous Windows 11 une fois les quatre implémentations livrées.
- **A2** — Aucune dépendance hors de celles du § 5.
- **A3** — Environ 200 lignes de code par langage, tests exclus. Un dépassement se justifie dans un ADR.
- **A4** — `docs/exploration.md` contient une entrée pour chaque skill du § 9 réellement utilisée.

## 8. Hors périmètre

FFT, GMP, Strassen, parallélisme, TUI, mode serveur, calibration et seuils, limites de mémoire, de GC et de temps, `-last-digits`, `-output`, variables d'environnement, profilage, complétion de shell, Docker, négafibonacci (n < 0), Mojo, ponts entre langages (FFI, WASM). La CI GitHub Actions est candidate pour une phase 2; elle vérifierait aussi le piège `process.exit()` sous Linux.

## 9. Démarche d'exploration des skills

L'orchestrateur est la session principale (Opus 5.5 en `ultracode`); le code revient au sous-agent `fib-dev` (Sonnet 5.5). Voir `CLAUDE.md`. Les étapes 0, 1, 4, 5 et 6 sont faites : les quatre implémentations passent `npm run check`.

| # | Étape | Skill | Livrable |
|---|---|---|---|
| 0 | Configurer le dépôt | `/setup-matt-pocock-skills` | `docs/agents/`, bloc `## Agent skills` dans `CLAUDE.md`, étiquettes de triage sur GitHub |
| 1 | Éprouver ce PRD | `/grill-with-docs` | `CONTEXT.md`, ADR-0001 et ADR-0002, PRD 1.1 |
| 2 | Lever un doute technique (au besoin) | `research` | note citée dans le dépôt |
| 3 | Trancher une question de forme (au besoin) | `prototype` | prototype jetable |
| 4 | Publier la spec | `/to-spec` | issue GitHub `ready-for-agent` |
| 5 | Découper | `/to-tickets` | tickets tracer bullet, avec leurs bloqueurs |
| 6 | Implémenter | `/implement`, qui applique `tdd` | une branche de worktree par ticket |
| 7 | Intégrer | `resolving-merge-conflicts` (au besoin) | `main` vert |
| 8 | Réviser | `/code-review` | rapports Standards et Spec |
| 9 | Corriger un écart entre langages | `diagnosing-bugs` | test de non-régression |
| 10 | Revoir l'architecture | `/improve-codebase-architecture`, `codebase-design` | rapport |
| 11 | Passer le relais entre sessions | `/handoff` | document de reprise |

Découpage suggéré pour `/to-tickets` :

1. Un ticket « contrat » : l'oracle et son `README.md`, le test de contrat avec la vérification de l'oracle, `package.json` et `tsconfig.json`. Il bloque les quatre autres.
2. Un ticket par langage, qui livre tout le contrat d'un coup : environ 200 lignes, assez pour une seule session. Les quatre avancent en parallèle.

Chaque entrée de `docs/exploration.md` donne : la skill, l'étape ou le ticket, ce qui a aidé, la friction, ce qu'on changerait.

## 10. Risques

| Risque | Parade |
|---|---|
| Fins de ligne CRLF sous Windows (Python, checkout Git) | F10, `reconfigure`, `.gitattributes` en `eol=lf`, contrat comparé à l'octet |
| Conversions trop permissives de `N` | validation par l'expression régulière avant conversion; cas `+5`, `1_000`, `0x10`, `٣`, `""` |
| Limite de conversion entier → texte de Python | `set_int_max_str_digits(0)`, cas `100000` |
| Débordement à l'analyse de `N` | cas `99999999999999999999` |
| Sortie tronquée par `process.exit()` (Node, POSIX) | `process.exitCode`; à vérifier en CI Linux |
| Rust ne lie pas sous Windows sans le composant C++ MSVC | override rustup GNU locale au dossier |
| Termes attendus recopiés dans chaque test, qui finissent par différer | un seul oracle, vérifié par le test lui-même et lu par tous les tests |
| `go run` remplace le code de sortie et pollue stderr | binaire compilé par `go build` (§ 5) |
| Le worktree d'un `fib-dev` part de `origin/main` et ignore le travail fusionné localement | `worktree.baseRef: "head"` dans `.claude/settings.json` |
| Coût en jetons d'`ultracode` | `/effort ultracode off` pour les petites tâches |
