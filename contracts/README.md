# Contrat commun

- `b000045.txt` : l'oracle, soit F(0) à F(2000), une ligne `n F(n)` par indice.
- `oracle.ts` : lecture et vérification de l'oracle (ORA-01 à ORA-06), partagée par les tests.
- `cli.test.ts` : le test de contrat. `node contracts/cli.test.ts [go|rust|ts|py …]` joue les cas CLI de `docs/cas-de-test.md` sur les implémentations nommées, ou sur celles dont le dossier existe.

## Attribution de l'oracle

`b000045.txt` est une copie du b-file « The first 2000 Fibonacci numbers » de la séquence A000045, de N. J. A. Sloane, tiré de « The On-Line Encyclopedia of Integer Sequences » (OEIS) : <https://oeis.org/A000045/b000045.txt>.

Contenu de l'OEIS sous licence [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/). Le fichier est repris sans modification de contenu; seules les fins de ligne sont normalisées en LF par `.gitattributes`.

- Date de téléchargement : à inscrire quand le fichier est déposé.
- Fins de ligne du fichier tel que téléchargé : à relever au dépôt (LF ou CRLF).
