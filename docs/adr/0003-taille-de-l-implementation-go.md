# Go dépasse la taille visée d'environ 200 lignes

L'implémentation Go compte 255 lignes hors tests : 94 pour la bibliothèque et 161 pour la CLI. Le PRD (A3) vise environ 200 lignes, et les trois autres langages en comptent de 151 à 205.

L'écart tient surtout au langage :

- `math/big` n'a pas d'opérateurs, si bien qu'on écrit `new(big.Int).Mul(a, b)` là où les autres écrivent `a * b`;
- chaque erreur se propage explicitement.

On accepte l'écart plutôt que de compacter le code au détriment de la lecture, qui est l'objectif O3.

## Consequences

La revue de code (`/code-review`) peut encore retirer du code superflu; le seuil ne justifie pas, à lui seul, une réécriture. En Rust, un `rustfmt.toml` à 120 colonnes garde la CLI près de la cible; il ne change que la mise en forme.
