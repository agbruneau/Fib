# La performance du calcul devient un objectif

Le 2026-10-11, le propriétaire demande de minimiser le temps de réponse de la CLI dans les quatre langages. La décision renverse O3 et la phrase du PRD § 1 « La performance n'est pas un objectif ». Désormais, le temps de réponse prime : le temps total du processus, et le temps de calcul que rapporte `--time`. Le code reste lisible : chaque optimisation porte un commentaire d'une ligne qui dit pourquoi.

Un banc d'essai (`npm run bench`, sept scénarios depuis la borne à 1 000 000, médianes) montre où va le temps. Le démarrage du processus domine le terme seul, la conversion binaire → décimal domine `--list`, et le calcul ne domine que `iterative` et `all`. D'où les décisions :

- **Commandes de lancement** :
  - TypeScript est compilé en JavaScript par tsc dans `.build/ts/`, car le retrait des types d'un `.ts` se payait à chaque lancement (mesure au PRD § 5).
  - Python est lancé avec `-I -S`, donc sans `site`.
  - Rust est lancé par son binaire, et non par `cargo run`.
- **La liste en décimal** : `fibList` rend des chaînes décimales calculées directement en base 10, par un additionneur écrit à la main en Go, Rust et TypeScript, et par `decimal.Decimal` en Python. La liste ne passe plus par le grand entier du langage.
- **Les algorithmes** gardent chacun leur identité, pour que `--algo all` compare toujours trois algorithmes :
  - `iterative` additionne sur place, sans allouer, en Go et en Rust;
  - `matrix` élève au carré, de gauche à droite, une matrice symétrique à trois coefficients, et multiplie par Q en additions;
  - `fast` fait deux carrés par bit (formules de GMP), ou un produit et un carré (nombres de Lucas, en TypeScript).

  La dernière étape de `matrix` et de `fast` ne calcule que F(n).
- **Démarrage** :
  - aucun import ni initialisation coûteuse : ni `re` en Python, ni regex compilée au chargement en Go;
  - en Python, le terme s'écrit par tranches, pour éviter l'import de `_pylong` au-delà de 9 000 chiffres (voir l'amendement pour les grands termes).
- **Aucune dépendance nouvelle** : GMP reste exclu (PRD § 8).

## Considered Options

- **Garder O3** : refusé par le propriétaire.
- **GMP (gmpy2, rug)** : à N = 100 000, `fast` calcule déjà en moins d'une milliseconde. Le temps vient du démarrage et de la conversion, que GMP ne supprime pas, et il faudrait une dépendance native de plus.
- **`NODE_COMPILE_CACHE`** : il supprime aussi le coût du `.ts`, mais il exige une variable d'environnement à chaque lancement.

## Consequences

- A3 et l'ADR-0003 ne s'appliquent plus. À la décision : TypeScript 232, Python 228, Rust 359, Go 376 lignes; la taille actuelle est au PRD (A3).
- F6 : pour `--list`, la durée couvre la production du texte décimal, qui est désormais le calcul lui-même.
- BIB-10 à BIB-12 comparent `fibList` aux chaînes de l'oracle. Des tests de garde `PERF-<ID>-<n>` protègent les optimisations, au besoin par des fonctions privées. Ils sont hors seams (catalogue § 6).
- Temps total au moment de la décision, en millisecondes, médianes sur le même banc. « Avant » est mesuré le 2026-10-11 avec les anciennes commandes, mais Rust par son binaire, sans `cargo run`. L'état final est au [README](../../README.md), § Résultats.

| Scénario | Go | Rust | TypeScript | Python |
|---|---|---|---|---|
| petit (`10`) | 6,1 → 6,8 | 5,8 → 5,7 | 63,8 → 40,7 | 29,3 → 19,9 |
| terme `100000` (`fast`) | 6,7 → 6,7 | 7,0 → 5,8 | 69,2 → 38,1 | 33,9 → 22,5 |
| `--algo matrix 100000` | 7,9 → 6,6 | 8,5 → 5,6 | 67,6 → 38,3 | 40,9 → 21,7 |
| `--algo iterative 100000` | 88,1 → 22,9 | 42,2 → 31,6 | 109,6 → 82,6 | 88,2 → 75,8 |
| `--algo all 100000` | 73,5 → 23,4 | 45,4 → 32,3 | 110,1 → 84,0 | 95,3 → 76,8 |
| `--list 10000` | 78,6 → 23,4 | 107,2 → 24,7 | 206,3 → 70,2 | 229,2 → 66,9 |

## Amendement du 2026-10-11 : borne d'un terme à 1 000 000

Le propriétaire relève la borne d'un terme de 100 000 à 1 000 000 (F8). Celle d'une liste reste à 10 000. À 1 000 000, F(n) compte 208 988 chiffres, et sa conversion en décimal devient la plus grosse part du temps.

- **Go, Rust, TypeScript** : seule la borne change. `math/big`, `num-bigint` 0.5.1 et V8 convertissent déjà par diviser pour régner. Aucune conversion écrite à la main ne les bat de plus de 3 % de façon répétable. Seul le parallélisme gagnerait vraiment, et le PRD § 8 l'exclut.
- **Python** : l'écriture par tranches est quadratique et prenait 240 ms à 1 000 000. Deux seuils, mesurés sous Python 3.14 (3.12 et 3.13 non vérifiés), la remplacent :
  - dès `DECIMAL_FROM` (170 000), `fast` et `matrix` calculent en `decimal.Decimal` exact, dont `str()` est linéaire. La CLI passe pour cela par une aide privée de la bibliothèque, et la seam `fib()` rend toujours un `int`;
  - au-delà de `STR_FROM_BITS` (200 000 bits), un `int` passe par `str()`, sous-quadratique par `_pylong`. Ce seuil ne sert qu'avec `iterative` et `all`.
- **`--time`** : sur le chemin `Decimal`, le calcul de `fast` est un peu plus lent qu'en `int` (environ 3 ms contre 1 ms à 170 000), mais le temps total baisse. C'est le temps de réponse qui prime.
- **GMP** reste exclu. À 1 000 000, le temps de réponse va de 22 à 60 ms selon le langage, dont environ 5 à 36 ms de démarrage ([README](../../README.md), § Résultats). GMP gagnerait quelques millisecondes de calcul et de conversion, au prix d'une dépendance native.

## Mesures finales du 2026-10-11

Après la borne à 1 000 000 et les trois revues de code (`npm run bench -- --runs 15`, Windows 11) : voir le [README](../../README.md), § Résultats.
