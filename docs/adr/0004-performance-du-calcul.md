# La performance du calcul devient un objectif

Le 2026-10-11, le propriétaire demande de minimiser le temps de réponse de la CLI dans les quatre langages. La décision renverse O3 et la phrase du PRD § 1 « La performance n'est pas un objectif ». Désormais, le temps de réponse prime : le temps total du processus, et le temps de calcul que rapporte `--time`. Le code reste lisible : chaque écart à la forme d'école porte un commentaire d'une ligne qui dit pourquoi.

Un banc d'essai (`npm run bench`, six scénarios, médianes) montre où va le temps. Le démarrage du processus domine le terme seul, la conversion binaire → décimal domine `--list`, et le calcul ne domine que `iterative` et `all`. D'où les décisions :

- **Commandes de lancement** :
  - TypeScript est compilé en JavaScript par tsc dans `.build/ts/`, car retirer les types d'un `.ts` coûtait 21 ms par lancement.
  - Python est lancé avec `-I -S`, donc sans `site`.
  - Rust est lancé par son binaire, et non par `cargo run`.
- **La liste en décimal** : `fibList` rend des chaînes décimales calculées directement en base 10, par un additionneur écrit à la main en Go, Rust et TypeScript, et par `decimal.Decimal` en Python. La liste ne passe plus par le grand entier du langage.
- **Les algorithmes** gardent chacun leur identité, pour que `--algo all` compare toujours trois méthodes :
  - `iterative` additionne sur place, sans allouer;
  - `matrix` élève au carré, de gauche à droite, une matrice symétrique à trois coefficients, et multiplie par Q en additions;
  - `fast` fait deux carrés par bit (formules de GMP), ou un produit et un carré (nombres de Lucas, en TypeScript).

  La dernière étape de `matrix` et de `fast` ne calcule que F(n).
- **Démarrage** :
  - aucun import ni initialisation coûteuse : ni `re` en Python, ni regex compilée au chargement en Go;
  - en Python, le terme s'écrit par tranches, pour éviter l'import de `_pylong` au-delà de 9 000 chiffres.
- **Aucune dépendance nouvelle** : GMP reste exclu (PRD § 8).

## Considered Options

- **Garder O3** : refusé par le propriétaire.
- **GMP (gmpy2, rug)** : à N = 100 000, `fast` calcule déjà en moins d'une milliseconde. Le temps vient du démarrage et de la conversion, que GMP ne supprime pas, et il faudrait une dépendance native de plus.
- **`NODE_COMPILE_CACHE`** : il supprime aussi le coût du `.ts`, mais il exige une variable d'environnement à chaque lancement.

## Consequences

- A3 et l'ADR-0003 ne s'appliquent plus. Mesuré le 2026-10-11 : TypeScript 232, Python 228, Rust 359, Go 376.
- F6 : pour `--list`, la durée couvre la production du texte décimal, qui est désormais le calcul lui-même.
- BIB-10 à BIB-12 comparent `fibList` aux chaînes de l'oracle. Des tests de garde `PERF-<ID>-<n>` protègent les optimisations, au besoin par des fonctions privées. Ils sont hors seams (catalogue § 6).
- Temps total, en millisecondes, médianes sur le même banc. « Avant » est mesuré le 2026-10-11 avec les anciennes commandes, mais Rust par son binaire, sans `cargo run`.

| Scénario | Go | Rust | TypeScript | Python |
|---|---|---|---|---|
| petit (`10`) | 6,1 → 6,8 | 5,8 → 5,7 | 63,8 → 40,7 | 29,3 → 19,9 |
| terme `100000` (`fast`) | 6,7 → 6,7 | 7,0 → 5,8 | 69,2 → 38,1 | 33,9 → 22,5 |
| `--algo matrix 100000` | 7,9 → 6,6 | 8,5 → 5,6 | 67,6 → 38,3 | 40,9 → 21,7 |
| `--algo iterative 100000` | 88,1 → 22,9 | 42,2 → 31,6 | 109,6 → 82,6 | 88,2 → 75,8 |
| `--algo all 100000` | 73,5 → 23,4 | 45,4 → 32,3 | 110,1 → 84,0 | 95,3 → 76,8 |
| `--list 10000` | 78,6 → 23,4 | 107,2 → 24,7 | 206,3 → 70,2 | 229,2 → 66,9 |
