# Quatre implémentations indépendantes, reliées seulement par le contrat

Fib réalise le même calcul en Go, Rust, TypeScript et Python sans aucun code partagé : pas de noyau commun appelé par FFI, WASM ou cgo, pas de génération de code. Les implémentations ne se rejoignent que par le contrat de la CLI, que vérifie un test commun, et par l'oracle tiré de l'OEIS. Le but est d'exercer les skills d'agent une fois par langage. Un noyau partagé réduirait trois implémentations à des adaptateurs et cacherait justement ce qu'on veut observer.

## Considered Options

- **Noyau Rust appelé par les trois autres** : moins de code dupliqué, mais trois implémentations deviennent des enveloppes et le dépôt exige une chaîne de build FFI et WASM.
- **Termes attendus générés par l'une des implémentations**, comme le golden de FibCalc : un oracle qui partage les défauts du code qu'il vérifie. L'OEIS est une source indépendante.

## Consequences

Un écart entre langages ne se voit qu'à l'exécution du test de contrat. Celui-ci est donc le critère de fin de chaque ticket de langage.

## Amendement du 2026-10-10 : oracle généré

Le téléchargement du b-file OEIS a été bloqué par les permissions de la session. L'oracle est donc généré par la formule de Binet (`contracts/generer_oracle.py`), une méthode qui ne partage rien avec les trois algorithmes testés. L'indépendance tient à la vérification : ORA-04 et ORA-05 contrôlent la table par la définition seule, et toute table qui les passe est nécessairement la suite de Fibonacci. La table coïncide avec la page OEIS pour F(2000).
