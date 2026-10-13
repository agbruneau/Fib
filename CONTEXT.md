# Fib

Calcul exact des termes de la suite de Fibonacci, réalisé quatre fois (Go, Rust, TypeScript, Python) derrière un même contrat, pour explorer des pratiques d'ingénierie assistée par agents.

## Suite et termes

**Suite de Fibonacci** :
La suite infinie F(0), F(1), F(2), … définie par F(0) = 0, F(1) = 1 et F(n) = F(n−1) + F(n−2).
_Avoid_ : série, séquence

**Indice** :
L'entier n ≥ 0 qui désigne une position dans la suite de Fibonacci.
_Avoid_ : rang, position, N-ième

**Terme** :
Le nombre F(n) à un indice donné, toujours un entier exact.
_Avoid_ : valeur, résultat, nombre

**Liste** :
Les termes F(0) à F(N), dans l'ordre des indices.
_Avoid_ : suite (réservé à la suite infinie), séquence, préfixe

**Borne** :
Le plus grand indice accepté, plus bas pour une liste que pour un terme seul.
_Avoid_ : limite, maximum

## Calcul

**Algorithme** :
Une méthode de calcul d'un terme : `iterative`, `matrix` ou `fast`.
_Avoid_ : méthode, mode, stratégie, calculateur

**Itératif** (`iterative`) :
L'algorithme qui applique la définition indice par indice, avec deux termes consécutifs en mémoire.
_Avoid_ : naïf, linéaire

**Matriciel** (`matrix`) :
L'algorithme qui élève la matrice [[1,1],[1,0]] à la puissance n par carrés successifs.
_Avoid_ : puissance de matrice

**Doublement rapide** (`fast`) :
L'algorithme qui double l'indice à chaque bit de n, du poids fort au poids faible : de F(k) à F(2k), puis F(2k+1) si le bit vaut 1. Il s'appuie sur des termes voisins, F(k−1) ou F(k+1), ou sur le nombre de Lucas L(k).
_Avoid_ : fast doubling, doubling, rapide

**Comparaison** (`all`) :
Le calcul d'un même terme par les trois algorithmes, suivi de la vérification qu'ils concordent. Ce n'est pas un algorithme.
_Avoid_ : benchmark, mode all

**Discordance** :
Le cas où deux algorithmes d'une même implémentation rendent des termes différents pour le même indice.
_Avoid_ : mismatch, incohérence

**Écart** :
Ce qu'une implémentation produit (stdout, stderr ou code de sortie) autrement que le contrat l'exige, ou autrement qu'une autre implémentation pour les mêmes arguments, dans un cas que le contrat couvre.
_Avoid_ : divergence, bug

## Vérification

**Oracle** :
La table de référence des termes F(0) à F(2000), produite hors de toute implémentation et vérifiée par la définition de la suite. Elle coïncide avec la séquence OEIS A000045.
_Avoid_ : golden, fixture, valeurs attendues

**Contrat** :
Le comportement observable que les quatre implémentations doivent partager à l'octet près : sorties, erreurs et codes de sortie.
_Avoid_ : spec CLI, interface

**Implémentation** :
L'une des quatre réalisations de Fib, une par langage.
_Avoid_ : port, version, variante

**Test de garde** :
Un test propre à une implémentation, hors du catalogue de cas, qui protège ce que les cas du catalogue ne peuvent pas éprouver : une optimisation (ADR-0004), un correctif, ou une exigence que le contrat ne sait pas provoquer.
_Avoid_ : test de performance

**Banc d'essai** :
La mesure du temps de réponse de chaque implémentation sur des scénarios fixes : temps total du processus et durée de calcul rapportée par `--time`, en médianes.
_Avoid_ : benchmark
