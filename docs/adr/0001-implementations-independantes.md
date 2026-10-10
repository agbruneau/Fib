# Quatre implémentations indépendantes, reliées seulement par le contrat

Fib réalise le même calcul en Go, Rust, TypeScript et Python sans aucun code partagé : pas de noyau commun appelé par FFI, WASM ou cgo, pas de génération de code. Les implémentations ne se rejoignent que par le contrat de la CLI, que vérifie un test commun, et par l'oracle tiré de l'OEIS. Le but est d'exercer les skills d'agent une fois par langage. Un noyau partagé réduirait trois implémentations à des adaptateurs et cacherait justement ce qu'on veut observer.

## Considered Options

- **Noyau Rust appelé par les trois autres** : moins de code dupliqué, mais trois implémentations deviennent des enveloppes et le dépôt exige une chaîne de build FFI et WASM.
- **Valeurs attendues générées par l'une des implémentations**, comme le golden de FibCalc : un oracle qui partage les défauts du code qu'il vérifie. L'OEIS est une source indépendante.

## Consequences

Une divergence entre langages ne se voit qu'à l'exécution du test de contrat. Celui-ci est donc le critère de fin de chaque ticket de langage.
