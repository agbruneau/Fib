# Fib

Une même CLI de calcul de la suite de Fibonacci, écrite quatre fois, en Go, Rust, TypeScript et Python, sous un contrat commun vérifié à l'octet près.

Fib est un banc d'essai académique. Il sert à explorer, avec Claude Code, les [skills d'ingénierie de Matt Pocock](https://github.com/mattpocock/skills), du PRD jusqu'à la revue de code. Le calcul de Fibonacci n'est qu'un prétexte : chaque implémentation reste courte et lisible. Fib reprend un sous-ensemble de [FibCalc](https://github.com/agbruneau/Fibonacci).

## État

| Étape | État |
|---|---|
| PRD, glossaire, décisions (ADR) | fait |
| Spec ([agbruneau/Fib#1](https://github.com/agbruneau/Fib/issues/1)) et tickets | fait |
| Catalogue de cas de test (102 cas) | fait |
| Contrat commun et implémentation TypeScript ([agbruneau/Fib#2](https://github.com/agbruneau/Fib/issues/2)) | à faire, aucun prérequis |
| Go ([agbruneau/Fib#3](https://github.com/agbruneau/Fib/issues/3)), Rust ([agbruneau/Fib#4](https://github.com/agbruneau/Fib/issues/4)), Python ([agbruneau/Fib#5](https://github.com/agbruneau/Fib/issues/5)) | à faire, en parallèle après #2 |

Aucune implémentation n'existe encore : les commandes ci-dessous fonctionneront à mesure que les tickets seront livrés.

## Utilisation

```
usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
```

```console
$ fib 10
55
$ fib --list 5
0
1
1
2
3
5
$ fib --time --algo all 50
12586269025
fast 0.012 ms
iterative 0.004 ms
matrix 0.015 ms
```

Les durées affichées sont illustratives.

| Algorithme | Principe | Coût |
|---|---|---|
| `iterative` | deux termes consécutifs en mémoire | O(n) additions |
| `matrix` | [[1,1],[1,0]]ⁿ par carrés successifs | O(log n) multiplications |
| `fast` (par défaut) | doublement rapide : F(2k) = F(k)·(2F(k+1) − F(k)), F(2k+1) = F(k)² + F(k+1)² | O(log n) multiplications |

`--algo all` compare les trois algorithmes et vérifie qu'ils concordent. `--time` écrit la durée du calcul sur stderr.

- **Bornes** : N ≤ 100 000 pour un terme, N ≤ 10 000 pour une liste.
- **Codes de sortie** : 0 succès, 2 erreur d'usage, 3 discordance entre algorithmes.

Le contrat complet est au § 4 du [PRD](PRD.md) : grammaire, formats, erreurs.

## Lancer une implémentation

Depuis la racine du dépôt :

| Langage | Commande |
|---|---|
| TypeScript | `node ts/src/cli.ts 10` |
| Go | `go -C go build -o ../.build/fib ./cmd/fib`, puis `.build/fib 10` |
| Rust | `cargo run -q --release --manifest-path rust/Cargo.toml -- 10` |
| Python | `python python/fib.py 10` |

Go se lance par un binaire compilé, parce que `go run` remplace le code de sortie du programme.

## Vérifier

```bash
npm install
```

```bash
npm run check:ts
```

```bash
npm run contract
```

```bash
npm run check
```

- `check:<id>` vérifie un langage (`go`, `rust`, `ts` ou `py`) : analyse statique, tests du langage, puis contrat.
- `contract` joue le contrat sur les implémentations présentes.
- `check` vérifie les quatre langages.

## Prérequis

- Go 1.26 ou plus
- Rust stable, édition 2024
- Node 24 ou plus, avec npm
- Python 3.12 ou plus

Sous Windows, la toolchain Rust MSVC exige le composant C++ de Visual Studio Build Tools. Sans lui, utilisez la toolchain GNU pour ce dossier seulement, depuis la racine du dépôt :

```bash
rustup override set stable-x86_64-pc-windows-gnu
```

Le fichier `.gitattributes` force les fins de ligne LF, dont le contrat a besoin.

## Organisation

```
Fib/
├── README.md, PRD.md, CLAUDE.md, CONTEXT.md
├── docs/
│   ├── adr/             décisions durables
│   ├── agents/          configuration des skills de Matt Pocock
│   ├── cas-de-test.md   catalogue des cas de test (TDD)
│   └── exploration.md   journal des skills utilisées
├── contracts/           oracle OEIS et test de contrat commun
├── go/  rust/  ts/  python/
└── package.json         point d'entrée des vérifications
```

Les quatre implémentations ne partagent aucun code ([ADR-0001](docs/adr/0001-implementations-independantes.md)). Elles ne se rejoignent que par le contrat de la CLI et par l'oracle.

## Documentation

- [PRD.md](PRD.md) : exigences, contrat de la CLI, pièges vérifiés par langage, démarche.
- [CONTEXT.md](CONTEXT.md) : glossaire du domaine (indice, terme, liste, comparaison, discordance, écart, oracle…).
- [docs/cas-de-test.md](docs/cas-de-test.md) : les 102 cas de test, leurs attendus, leurs sources et l'ordre des cycles TDD.
- [docs/adr/](docs/adr/) : [implémentations indépendantes](docs/adr/0001-implementations-independantes.md) et [analyse manuelle des arguments](docs/adr/0002-analyse-manuelle-des-arguments.md).
- [docs/exploration.md](docs/exploration.md) : ce que chaque skill a apporté et ce qu'elle a coûté.

## Démarche

Le travail suit le flux des skills de Matt Pocock :

`/setup-matt-pocock-skills` → `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/implement` avec `tdd` → `/code-review`

- **Orchestration** : une session Claude Code (Opus 5.5, en mode `ultracode`) découpe le travail, intègre et vérifie.
- **Implémentation** : chaque ticket part chez un sous-agent `fib-dev` (Sonnet 5.5), dans son propre worktree, test d'abord.

La répartition des rôles est décrite dans [CLAUDE.md](CLAUDE.md).

## Licence et attributions

Aucune licence n'est encore déclarée pour le code de ce dépôt.

L'oracle des tests reprend la table « The first 2000 Fibonacci numbers » de N. J. A. Sloane. Elle provient de [The On-Line Encyclopedia of Integer Sequences](https://oeis.org/A000045), sous licence CC BY-SA 4.0.
