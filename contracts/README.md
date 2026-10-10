# Contrat commun

- `b000045.txt` : l'oracle, soit F(0) à F(2000), une ligne `n F(n)` par indice, au format du b-file OEIS A000045.
- `generer_oracle.py` : génère l'oracle par la formule de Binet (`python contracts/generer_oracle.py`).
- `oracle.ts` : lecture et vérification de l'oracle (ORA-01 à ORA-06), partagée par les tests.
- `cli.test.ts` : le test de contrat. `node contracts/cli.test.ts [go|rust|ts|py …]` joue les cas CLI de `docs/cas-de-test.md` sur les implémentations nommées, ou sur celles dont le dossier existe.

## Provenance de l'oracle

Le PRD prévoyait une copie du b-file « The first 2000 Fibonacci numbers » de l'OEIS (<https://oeis.org/A000045/b000045.txt>). Le 2026-10-10, son téléchargement a été bloqué par les permissions de la session. L'oracle est donc généré par `generer_oracle.py`.

- **Méthode** : la formule de Binet, F(n) = round(φⁿ / √5), en arithmétique décimale à 600 chiffres. Elle est indépendante des trois algorithmes testés (`iterative`, `matrix`, `fast`).
- **Vérification** : ORA-04 et ORA-05 contrôlent la table par la définition seule, F(0) = 0, F(1) = 1 et la récurrence. Toute table qui passe ce contrôle est la suite de Fibonacci, quelle que soit sa provenance.
- **Contrôle croisé** : F(2000) coïncide avec la page OEIS A000045 (418 chiffres, début `4224696333`, fin `2516817125`).
- **Format** : 2 001 lignes, 429 382 octets, ASCII, fins de ligne LF.

Les valeurs d'une suite mathématique ne sont pas une œuvre protégée : aucune attribution n'est requise. La séquence [A000045 de l'OEIS](https://oeis.org/A000045) reste la référence publique.
