# PRD — Fib : calculateur Fibonacci académique en quatre langages

Version 1.0 · 2026-10-10 · André-Guy Bruneau

## 1. Contexte et objectifs

Fib sert de banc d'essai pour explorer les skills de Matt Pocock (plugin `mattpocock-skills` v1.2.3) en Go, Rust, TypeScript et Python. Le calcul de Fibonacci est un prétexte : chaque implémentation reste académique, courte et lisible. La référence fonctionnelle est [agbruneau/Fibonacci](https://github.com/agbruneau/Fibonacci) (FibCalc, en Go); Fib n'en garde qu'un sous-ensemble.

- **O1** — Une même CLI dans les quatre langages, avec une sortie stdout identique à l'octet près.
- **O2** — Chaque skill du flux de Matt Pocock (§ 9) sert au moins une fois sur du vrai travail, et son constat est consigné.
- **O3** — Un code qu'un étudiant lit d'un trait : l'algorithme, sans optimisation au-delà.

La performance n'est pas un objectif. `--time` sert à comparer les langages et les algorithmes, pas à les optimiser.

## 2. Ce que Fib retient de FibCalc

| FibCalc | Fib | Raison |
|---|---|---|
| `-algo fast` (fast doubling) | `fast` | cœur académique en O(log n) |
| `-algo matrix` (avec Strassen) | `matrix`, sans Strassen | exponentiation matricielle simple |
| — | `iterative` | base de comparaison en O(n) |
| `-algo all` | `all` | compare les algorithmes et vérifie qu'ils concordent |
| `-n` | argument positionnel `N` | |
| `-details` | `--time` | diagnostic sur stderr |
| golden tests | `contracts/` | un oracle partagé par les quatre langages |
| `fft`, `gmp`, TUI, calibration, seuils, `-memory-limit`, `-gc-control`, `-timeout`, `-last-digits`, `-output`, variables `FIBCALC_*`, profilage, complétion, Docker, CI | exclus | voir § 8 |

Fib ajoute `--list`, qui produit la suite F(0) … F(N).

## 3. Domaine

- F(0) = 0, F(1) = 1, F(n) = F(n−1) + F(n−2) pour n ≥ 2.
- Entiers exacts en précision arbitraire : aucun résultat en virgule flottante ni tronqué.
- Trois algorithmes, avec les mêmes identifiants dans les quatre langages :
  - `iterative` : deux accumulateurs, O(n) additions.
  - `matrix` : [[1,1],[1,0]]ⁿ = [[F(n+1), F(n)], [F(n), F(n−1)]], par exponentiation rapide (carrés successifs).
  - `fast` : fast doubling, avec F(2k) = F(k)·(2F(k+1) − F(k)) et F(2k+1) = F(k)² + F(k+1)².

Le glossaire complet vivra dans `CONTEXT.md`, produit par `/grill-with-docs`.

## 4. Contrat de la CLI

Synopsis (les options précèdent `N`; seule la forme `--algo X`, avec une espace, est exigée) :

```
fib [--algo iterative|matrix|fast|all] [--time] N
fib --list [--time] N
fib --help
```

| ID | Exigence |
|---|---|
| F1 | `fib N` écrit F(N) en décimal, suivi d'un saut de ligne, sur stdout. Code 0. Algorithme par défaut : `fast`. |
| F2 | `--algo X` choisit l'algorithme. La sortie est la même pour tout X. |
| F3 | `--algo all` calcule F(N) avec les trois algorithmes. S'ils concordent, la valeur est écrite une seule fois. Sinon, un message sur stderr et le code 1. |
| F4 | `--list N` écrit F(0) à F(N), une valeur par ligne (N + 1 lignes), générées par la méthode itérative. |
| F5 | `--list` et `--algo` s'excluent : les combiner est une erreur d'usage. |
| F6 | `--time` écrit sur stderr une ligne par algorithme exécuté, `<algo> <durée> ms`, la durée à 3 décimales (`--list` compte comme `iterative`). stdout ne change pas. |
| F7 | `--help` écrit l'usage sur stdout. Code 0. |
| F8 | Bornes : 0 ≤ N ≤ 100 000; avec `--list`, 0 ≤ N ≤ 10 000. |
| F9 | Erreur d'usage (N absent, non décimal, négatif ou hors borne, y compris un nombre trop grand pour le type natif; option ou algorithme inconnu; combinaison interdite) : une seule ligne sur stderr qui commence par `fib: `, rien sur stdout, code 2. Aucune panique ni trace de pile. |
| F10 | Sortie en ASCII, fins de ligne `\n` sur toutes les plateformes, Windows compris. |

`N` doit correspondre à `^[0-9]+$` : `+5`, `5.0`, `0x10` et ` 5` sont rejetés; `007` vaut 7.

Codes de sortie : 0 succès, 1 discordance entre algorithmes (F3), 2 erreur d'usage.

## 5. Exigences par langage

Chaque langage expose une seule seam de bibliothèque, nommée selon ses conventions :

- `fib(n, algo)` → F(n), qui rejette n < 0 quand le type le permet;
- `fibList(n)` → la suite F(0) … F(n).

La CLI est un adaptateur mince : analyse des arguments, bornes, formatage, codes de sortie.

| | Go | Rust | TypeScript | Python |
|---|---|---|---|---|
| Dossier | `go/` | `rust/` | `ts/` | `python/` |
| Version minimale | 1.26 | stable, édition 2024 | Node 24 | 3.12 |
| Grand entier | `math/big` | crate `num-bigint` | `bigint` natif | `int` natif |
| Arguments | `flag` | `std::env::args` | `node:util` `parseArgs` | `argparse` |
| Tests | `go test`, tests table-driven | `cargo test` | `node --test` | `unittest` |
| Analyse statique | `go vet` | `cargo clippy -D warnings` | `tsc --noEmit` | — |
| Lancement depuis la racine | `go -C go run ./cmd/fib` | `cargo run -q --release --manifest-path rust/Cargo.toml --` | `node ts/src/cli.ts` | `python python/fib.py` |

Dépendances autorisées : `num-bigint` pour Rust; `typescript` et `@types/node` en `devDependencies` pour TypeScript. Aucune autre.

Pièges connus :

- **Python** : appeler `sys.set_int_max_str_digits(0)`, car F(100 000) compte 20 899 chiffres, au-delà de la limite de conversion par défaut (4 300 depuis Python 3.11). Sous Windows, stdout traduit `\n` en `\r\n` : appeler `sys.stdout.reconfigure(newline="\n")`.
- **TypeScript** : Node exécute le `.ts` en effaçant les types; n'utiliser que de la syntaxe effaçable (`erasableSyntaxOnly`, donc ni `enum` ni `namespace`) et des imports relatifs avec l'extension `.ts`.
- **Go** : `flag` accepte `-algo` comme `--algo`; il s'arrête au premier argument positionnel, d'où la règle « options avant `N` ».
- **Rust** : l'analyse manuelle de `N` doit renvoyer le code 2, pas paniquer, sur un débordement de `u64`.

## 6. Dépôt

```
Fib/
├── PRD.md, CLAUDE.md
├── CONTEXT.md, docs/adr/, docs/agents/   produits par les skills
├── docs/exploration.md                   journal des skills (O2)
├── contracts/
│   ├── b000045.txt                       oracle : OEIS A000045, n = 0..2000
│   └── cli.test.ts                       test de contrat des quatre CLI
├── go/  rust/  ts/  python/
├── package.json                          point d'entrée unique
└── tsconfig.json
```

Les quatre implémentations sont indépendantes : la seule frontière est la CLI (stdin/stdout), et la seule source de vérité partagée est `contracts/`.

Scripts de `package.json` :

| Script | Rôle |
|---|---|
| `check:go`, `check:rust`, `check:ts`, `check:py` | analyse statique, tests du langage, puis test de contrat pour ce seul langage |
| `contract` | test de contrat sur les quatre langages |
| `check` | tout ce qui précède |

Le test de contrat accepte en argument la liste des langages à vérifier (par défaut, les quatre), pour qu'un ticket de langage le lance seul : `node contracts/cli.test.ts go`.

## 7. Tests et critères d'acceptation

**Seams convenues** (celles que `tdd` utilisera, aucune autre) :

1. la bibliothèque `fib` / `fibList` de chaque langage;
2. la CLI, par le test de contrat commun.

**Oracle** : `contracts/b000045.txt` est le b-file de N. J. A. Sloane, « The first 2000 Fibonacci numbers » (<https://oeis.org/A000045/b000045.txt>, n = 0..2000, licence CC BY-SA 4.0, source citée dans l'en-tête du fichier). C'est une source indépendante du code. Les lecteurs ignorent les lignes vides et celles qui commencent par `#`. Les tests de bibliothèque et le test de contrat lisent ce fichier; aucune valeur attendue n'est recalculée comme le fait le code (anti-pattern « tautologique » de `tdd`).

**Bibliothèque**, dans chaque langage :

- les trois algorithmes égalent l'oracle pour n = 0..2000;
- `fibList(2000)` égale l'oracle;
- F(92), F(93), F(94) sont corrects (passages de int64 et de uint64);
- pour n = 100 000, les trois algorithmes concordent et le résultat compte 20 899 chiffres;
- n < 0 est rejeté là où le type l'admet (TypeScript, Python).

**Contrat CLI**, chaque cas sur les quatre langages, stdout comparé octet par octet :

| Entrée | Attendu |
|---|---|
| `0`, `1`, `2`, `10`, `93`, `94`, `1000`, `2000` | valeur de l'oracle, code 0 |
| `--algo X 2000`, pour chaque X | valeur de l'oracle, code 0 |
| `--list 20` | 21 lignes de l'oracle, code 0 |
| `100000` | 20 899 chiffres, identiques dans les quatre langages |
| `--time --algo all 50` | stdout `12586269025\n`; stderr : 3 lignes `<algo> <x.xxx> ms` |
| aucun argument, `-1`, `abc`, `1.5`, `100001`, `99999999999999999999`, `--list 10001`, `--algo bogus 5`, `--list --algo fast 5`, `--bogus 5` | code 2, stdout vide, stderr commence par `fib: ` |
| `--help` | code 0, usage sur stdout |

**Acceptation globale** :

- **A1** — `npm run check` passe sous Windows 11.
- **A2** — Aucune dépendance hors de celles du § 5.
- **A3** — Environ 200 lignes de code par langage, tests exclus. Un dépassement se justifie dans un ADR.
- **A4** — `docs/exploration.md` contient une entrée pour chaque skill du § 9 réellement utilisée.

## 8. Hors périmètre

FFT, GMP, Strassen, parallélisme, TUI, mode serveur, calibration et seuils, limites de mémoire, de GC et de temps, `-last-digits`, `-output`, variables d'environnement, profilage, complétion de shell, Docker, négafibonacci (n < 0), Mojo, ponts entre langages (FFI, WASM). La CI GitHub Actions est candidate pour une phase 2.

## 9. Démarche d'exploration des skills

L'orchestrateur est la session principale (Opus 5.5 en `ultracode`); le code revient au sous-agent `fib-dev` (Sonnet 5.5). Voir `CLAUDE.md`.

| # | Étape | Skill | Livrable |
|---|---|---|---|
| 0 | Configurer le dépôt | `/setup-matt-pocock-skills` | `docs/agents/`, bloc `## Agent skills` dans `CLAUDE.md`; tracker : GitHub Issues de `agbruneau/Fib` |
| 1 | Éprouver ce PRD | `/grill-with-docs` | `CONTEXT.md`, ADR (choix de `num-bigint`, bornes, règle « options avant N ») |
| 2 | Lever un doute technique (au besoin) | `research` | note citée dans le dépôt |
| 3 | Trancher une question de forme (au besoin) | `prototype` | prototype jetable |
| 4 | Publier la spec | `/to-spec` | issue GitHub `ready-for-agent` |
| 5 | Découper | `/to-tickets` | tickets tracer bullet, avec leurs bloqueurs |
| 6 | Implémenter | `/implement`, qui applique `tdd` | une branche de worktree par ticket |
| 7 | Intégrer | `resolving-merge-conflicts` (au besoin) | `main` vert |
| 8 | Réviser | `/code-review` | rapports Standards et Spec |
| 9 | Corriger une divergence entre langages | `diagnosing-bugs` | test de non-régression |
| 10 | Revoir l'architecture | `/improve-codebase-architecture`, `codebase-design` | rapport |
| 11 | Passer le relais entre sessions | `/handoff` | document de reprise |

Découpage suggéré pour `/to-tickets` : un premier ticket « contrat » (oracle, test de contrat, `package.json`, `tsconfig.json`) qui bloque tous les autres; puis, par langage, un tracer bullet (`fib N` avec `fast` et les erreurs d'usage, contrat vert pour ce langage) suivi d'un ticket pour le reste du contrat (`iterative`, `matrix`, `all`, `--list`, `--time`). Les quatre langages avancent en parallèle.

Chaque entrée de `docs/exploration.md` donne : la skill, l'étape ou le ticket, ce qui a aidé, la friction, ce qu'on changerait.

## 10. Risques

| Risque | Parade |
|---|---|
| Sortie en CRLF sous Windows (Python) | F10, `reconfigure`, contrat comparé à l'octet |
| Limite de conversion entier → texte de Python | `set_int_max_str_digits(0)`, cas `100000` |
| Débordement à l'analyse de `N` (Go, Rust) | cas `99999999999999999999` |
| Valeurs attendues recopiées et divergentes | un seul oracle, lu par tous les tests |
| Coût en jetons d'`ultracode` | `/effort ultracode off` pour les petites tâches |
