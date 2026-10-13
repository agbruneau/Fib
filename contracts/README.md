# Contrat commun

- `b000045.txt` : l'oracle, soit F(0) à F(2000), une ligne `n F(n)` par indice, au format du b-file OEIS A000045.
- `generer_oracle.py` : génère l'oracle par la formule de Binet (`python contracts/generer_oracle.py`).
- `oracle.ts` : lecture et vérification de l'oracle (ORA-01 à ORA-06), partagée par les tests.
- `lancement.ts` : le seul lieu des commandes de build et de lancement des quatre CLI (PRD § 5), que le test de contrat et le banc d'essai appellent tous deux.
  - `IDS` rend tous les identifiants du PRD § 5, `present()` ceux dont le dossier existe, dans cet ordre.
  - `command(id)` rend la commande de lancement de l'implémentation, sans argument : HAR-1 y compare l'appel du banc.
  - `build(id)` compile Go, Rust ou TypeScript, et ne fait rien pour Python; un échec lève une erreur qui porte la sortie du compilateur.
  - `launch(id, args, { env, stderrClosed })` lance la CLI construite, depuis la racine, et rend `{ code, out, err, ms }` : les deux flux en latin1, `ms` pour le seul `spawnSync`, un délai de 300 s, et une erreur de lancement qui lève. `env` s'ajoute à l'environnement du processus, et une valeur `undefined` retire la variable. Sans `stderrClosed`, la commande part sans `/bin/sh`; avec, `closeStderr` ferme le fd 2 (CLI-V04, POSIX seulement).
- `cli.test.ts` : le test de contrat. `node contracts/cli.test.ts [go|rust|ts|py …]` joue les cas CLI de `docs/cas-de-test.md` sur les implémentations nommées, ou sur celles dont le dossier existe. Il compile d'abord Go, Rust et TypeScript, puis lance les binaires et le JavaScript émis, par `lancement.ts` (PRD § 5). Son groupe `harnais` porte les contrôles du harnais (HAR-1 à HAR-4, `docs/cas-de-test.md` § 6) et la sonde du fd 2 de CLI-V04 : ils éprouvent le test de contrat lui-même, et HAR-1 à HAR-4 ne lancent aucune implémentation.
- `bench.ts` : le banc d'essai (ADR-0004). `node contracts/bench.ts [go|rust|ts|py …] [--runs N]`, ou `npm run bench`, compile et lance par `lancement.ts`, comme le test de contrat, puis donne pour sept scénarios la médiane du temps total du processus et de la durée rapportée par `--time` (11 exécutions par défaut). Sans argument, il mesure les implémentations présentes. `--runs` demande un entier d'au moins 1; sinon le banc écrit une erreur d'usage sur stderr et sort avec le code 2, avant tout build. Sous un Node sans `import.meta.main` (< 22.18, 23.x, 24.0 et 24.1), il échoue en nommant la version au lieu de sortir en 0 sans rien faire. `measure(id, args)` fait une exécution avec `--time`, et `parseArgs(args)` lit les arguments; le test de contrat les importe (HAR-1, HAR-4).

## Provenance de l'oracle

Le PRD prévoyait une copie du b-file « The first 2000 Fibonacci numbers » de l'OEIS (<https://oeis.org/A000045/b000045.txt>). Le 2026-10-10, son téléchargement a été bloqué par les permissions de la session. L'oracle est donc généré par `generer_oracle.py`.

- **Méthode** : la formule de Binet, F(n) = round(φⁿ / √5), en arithmétique décimale à 600 chiffres. Elle est indépendante des trois algorithmes testés (`iterative`, `matrix`, `fast`).
- **Vérification** : ORA-04 et ORA-05 contrôlent la table par la définition seule, F(0) = 0, F(1) = 1 et la récurrence. Toute table qui passe ce contrôle est la suite de Fibonacci, quelle que soit sa provenance.
- **Contrôle croisé** : F(2000) coïncide avec la page OEIS A000045 (418 chiffres, début `4224696333`, fin `2516817125`).
- **Format** : 2 001 lignes, 429 382 octets, ASCII, fins de ligne LF.

Les valeurs d'une suite mathématique ne sont pas une œuvre protégée : aucune attribution n'est requise. La séquence [A000045 de l'OEIS](https://oeis.org/A000045) reste la référence publique.
