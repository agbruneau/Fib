# Cas de test de Fib

Ce catalogue est la source unique des cas qui valident les quatre implémentations. Il découle du contrat (PRD § 4) et des deux seams convenues (PRD § 7). Pour chaque cas, il donne un identifiant, l'entrée, l'attendu et la source de l'attendu. Le PRD, la spec (#1) et les tickets (#2 à #5) y renvoient.

## 1. Mode d'emploi TDD

- **Un catalogue n'est pas une suite de tests écrite d'avance.** Chaque cas devient un test au moment de son cycle : le test d'abord (rouge), puis juste assez de code pour le faire passer (vert), puis le cas suivant. Écrire tous les tests puis tout le code, c'est l'anti-pattern du découpage horizontal de la skill `tdd`.
- **Deux boucles** :
  - **Boucle interne, la bibliothèque (seam 1)** : les cas BIB, écrits un à un dans le cadre de test du langage, chacun avant le code qu'il exige.
  - **Boucle externe, la CLI (seam 2)** : les cas CLI, écrits une seule fois dans le test de contrat commun. Le ticket #2 les ajoute un à un, au rythme de la CLI TypeScript. Pour Go, Rust et Python (#3 à #5), ils existent déjà et sont tous rouges au départ. Ils servent alors de tests d'acceptation, qu'on fait passer au vert groupe par groupe, dans l'ordre du catalogue.
- **L'ordre des sections est l'ordre conseillé des cycles.** Chaque cas est un tracer bullet qui s'appuie sur le précédent.
- **Un cas manquant se signale.** Si un cycle révèle un cas absent, on l'ajoute au catalogue dans le même commit, avec un nouvel identifiant. On ne renumérote jamais.
- **Le refactoring sort de la boucle** : il revient à la revue (`/code-review`).
- **Nommage** : chaque test porte l'identifiant de son cas et décrit un comportement, par exemple `CLI-I06 : un indice avec un soulignement est refusé`.
- **Une assertion logique par test.** Un cas qui porte sur plusieurs entrées du même comportement, comme BIB-05 sur n = 0..2000, se paramètre.

## 2. D'où viennent les attendus

| Code | Source | Exemples |
|---|---|---|
| **O** | l'oracle, soit le b-file OEIS A000045, F(0) à F(2000) | tout terme d'indice ≤ 2000 |
| **M** | un fait mathématique indépendant des algorithmes | nombre de chiffres, périodes de Pisano, identité de Cassini, récurrence vérifiée sur une sortie |
| **C** | le texte du contrat | texte d'usage, préfixe `fib: `, codes de sortie, format des durées |

Faits mathématiques utilisés :

- F(n) compte ⌊n·log₁₀ φ − log₁₀ √5⌋ + 1 chiffres : 418 pour n = 2 000, 2 090 pour n = 10 000, 20 899 pour n = 100 000.
- Les périodes de Pisano valent π(2¹¹) = 3 072 et π(10³) = 1 500. Donc F(100 000) ≡ F(1696) (mod 2048) et F(100 000) ≡ F(1000) (mod 1000).
- Identité de Cassini : F(n−1)·F(n+1) − F(n)² = (−1)ⁿ.
- La récurrence F(n) = F(n−1) + F(n−2) sert à vérifier une sortie produite, jamais à produire un attendu.

**Interdit** : recalculer un attendu avec l'algorithme testé, ou avec une copie de cet algorithme (anti-pattern « tautologique »).

Valeurs de référence, vérifiées le 2026-10-10. En cas de doute, l'oracle et les formules font foi.

| Terme | Valeur |
|---|---|
| F(7) | 13 |
| F(10) | 55 |
| F(50) | 12586269025 |
| F(92) | 7540113804746346429, dernier terme qui tient dans un int64 |
| F(93) | 12200160415121876738, dernier terme qui tient dans un uint64 |
| F(94) | 19740274219868223167 |
| F(100 000) mod 2048 | 635 |
| F(100 000) mod 1000 | 875 |

## 3. Oracle — ORA

Le test de contrat vérifie l'oracle avant tout cas CLI. Si l'oracle manque ou échoue, les cas CLI sont joués quand même : ceux dont l'attendu vient de l'oracle échouent avec le motif de l'oracle, les autres restent valables.

| ID | Vérification | Source |
|---|---|---|
| ORA-01 | Le fichier existe et contient exactement 2 001 lignes non vides. Les lignes vides sont ignorées. | O |
| ORA-02 | Chaque ligne a la forme `<n> <F(n)>` : deux suites de chiffres ASCII séparées par une seule espace, sans `\r`. | O |
| ORA-03 | Les indices vont de 0 à 2000, consécutifs et dans l'ordre. | O |
| ORA-04 | F(0) = 0 et F(1) = 1. | M |
| ORA-05 | Pour n ≥ 2, chaque terme est la somme des deux précédents. | M |
| ORA-06 | F(2000) compte 418 chiffres. | M |

## 4. Bibliothèque — BIB (seam 1, dans chaque implémentation)

L'interface est `fib(n, algo)` et `fibList(n)`, nommées selon les conventions du langage. A désigne chacun des trois algorithmes `iterative`, `matrix` et `fast`. La bibliothèque n'a pas de borne : les bornes appartiennent à la CLI.

| ID | Appel | Attendu | Source |
|---|---|---|---|
| BIB-01 | `fib(0, iterative)` | 0 | O |
| BIB-02 | `fib(1, iterative)` | 1 | O |
| BIB-03 | `fib(2, iterative)` | 1 | O |
| BIB-04 | `fib(10, iterative)` | 55 | O |
| BIB-05 | `fib(n, iterative)` pour n = 0..2000 | le terme de l'oracle. Le balayage franchit les limites d'int64 et d'uint64 entre 92 et 94, d'où l'exigence d'entiers en précision arbitraire. | O |
| BIB-06 | `fib(n, fast)` pour n = 0..2000 | le terme de l'oracle. Le cycle peut d'abord viser n ≤ 10. | O |
| BIB-07 | `fib(n, matrix)` pour n = 0..2000 | le terme de l'oracle. Le cycle peut d'abord viser n ≤ 10. | O |
| BIB-08 | `fib(100000, A)` pour chaque A | le même terme pour les trois algorithmes, qui compte 20 899 chiffres | M |
| BIB-09 | `fib(99999, A)`, `fib(100000, A)` et `fib(100001, A)`, pour chaque A | F(99999)·F(100001) − F(100000)² = 1 (Cassini) | M |
| BIB-10 | `fibList(0)` | [0] | O |
| BIB-11 | `fibList(1)` | [0, 1] | O |
| BIB-12 | `fibList(2000)` | les 2 001 termes de l'oracle, dans l'ordre | O |
| BIB-13 | `fib(5, X)` pour X parmi `all`, `bogus`, chaîne vide et `FAST` | refus, sous la forme d'erreur idiomatique du langage | C |
| BIB-14 | `fib(−1, A)` et `fibList(−1)`; `fib(1.5, A)` et `fib(NaN, A)` si le type de l'indice admet ces valeurs | refus | C |

Notes par langage :

- **BIB-13** : si le système de types rend un algorithme inconnu impossible à passer (enum Rust, par exemple), le cas porte sur la conversion du nom vers l'algorithme, que la bibliothèque expose.
- **BIB-14** ne s'applique pas à un indice de type non signé (`u64` en Rust, `uint64` en Go). Il s'applique à Python, à TypeScript, et à Go si l'indice est un `int`.

## 5. Contrat CLI — CLI (seam 2, joué sur chaque implémentation)

Les arguments sont passés tels quels au processus, sans shell : `""` désigne un argument vide, et les espaces visibles font partie de l'argument.

**Assertions communes**, vérifiées sur chaque cas :

- **X-1** : le code de sortie est celui du tableau. Un cas sans code indiqué attend 0.
- **X-2** : stdout égale l'attendu, octet pour octet. En cas d'erreur, stdout est vide.
- **X-3** : stderr dépend du cas :
  - un succès sans `--time` laisse stderr vide;
  - avec `--time`, stderr contient exactement les lignes de durée indiquées, chacune de la forme `^(fast|iterative|matrix) [0-9]+\.[0-9]{3} ms$`;
  - une erreur écrit exactement une ligne qui commence par `fib: ` et se termine par `\n`.
- **X-4** : stdout et stderr ne contiennent que des octets ASCII, sans `\r` ni ESC (0x1B).

« Usage » désigne le texte d'usage du PRD § 4, octet pour octet, suivi de `\n`. « Erreur » désigne : code 2, stdout vide, une seule ligne `fib: …` sur stderr.

### 5.1 Terme — T (F1, F8, règle 5)

| ID | Arguments | Attendu | Source |
|---|---|---|---|
| CLI-T01 | `10` | `55\n`. Premier tracer bullet de bout en bout. | O |
| CLI-T02 | `0` | `0\n` | O |
| CLI-T03 | `1` | `1\n` | O |
| CLI-T04 | `2` | `1\n` | O |
| CLI-T05 | `92` | F(92) de l'oracle, puis `\n` | O |
| CLI-T06 | `93` | F(93) de l'oracle, puis `\n` | O |
| CLI-T07 | `94` | F(94) de l'oracle, puis `\n` | O |
| CLI-T08 | `1000` | F(1000) de l'oracle, puis `\n` | O |
| CLI-T09 | `2000` | F(2000) de l'oracle, puis `\n` | O |
| CLI-T10 | `007` | `13\n` | O |
| CLI-T11 | `00000000000000000000000000010` | `55\n` | O |
| CLI-T12 | `100000` | 20 899 chiffres puis `\n`; terme ≡ F(1696) (mod 2048) et ≡ F(1000) (mod 1000) | M |

### 5.2 Indice invalide — I (F8, F9, règles 4 et 5)

Chacun de ces cas attend une erreur.

| ID | Arguments | Ce qu'il éprouve |
|---|---|---|
| CLI-I01 | aucun argument | indice absent |
| CLI-I02 | `""` | argument vide (`Number("")` vaut 0) |
| CLI-I03 | `abc` | pas un nombre |
| CLI-I04 | `1.5` | décimal |
| CLI-I05 | `+5` | signe accepté par `int()`, `Number`, `parse::<u64>()` et `Atoi` |
| CLI-I06 | `1_000` | soulignement accepté par `int()` |
| CLI-I07 | `0x10` | hexadécimal accepté par `Number` et `BigInt` |
| CLI-I08 | ` 5` | espace de tête, accepté par `int()` et `Number` |
| CLI-I09 | `5 ` | espace de queue |
| CLI-I10 | `٣` | chiffre non ASCII, accepté par `int()` |
| CLI-I11 | `-1` | option inconnue (règle 4), pas un indice négatif |
| CLI-I12 | `100001` | borne d'un terme + 1 |
| CLI-I13 | `00000000000000000000000000100001` | borne dépassée malgré les zéros de tête |
| CLI-I14 | `99999999999999999999` | trop grand pour un uint64 : erreur, pas une panique |
| CLI-I15 | `5 6` | deux indices |

### 5.3 Algorithmes — A (F2, F3, règle 2)

| ID | Arguments | Attendu | Source |
|---|---|---|---|
| CLI-A01 | `--algo iterative 2000` | F(2000) de l'oracle | O |
| CLI-A02 | `--algo matrix 2000` | F(2000) de l'oracle | O |
| CLI-A03 | `--algo fast 2000` | F(2000) de l'oracle | O |
| CLI-A04 | `--algo all 2000` | F(2000) de l'oracle, sur une seule ligne | O |
| CLI-A05 | `--algo all 0` | `0\n` | O |
| CLI-A06 | `--algo=matrix 2000` | F(2000) de l'oracle | O |
| CLI-A07 | `2000 --algo matrix` | F(2000) de l'oracle (option après l'indice) | O |
| CLI-A08 | `--algo fast --algo matrix 2000` | F(2000) de l'oracle (répétition acceptée; D04 montre laquelle gagne) | O |
| CLI-A09 | `--algo` | erreur : valeur absente | C |
| CLI-A10 | `--algo= 5` | erreur : valeur vide | C |
| CLI-A11 | `--algo bogus 5` | erreur : algorithme inconnu | C |
| CLI-A12 | `--algo FAST 5` | erreur : le nom est sensible à la casse | C |
| CLI-A13 | `--algo 5` | erreur : `5` devient la valeur de `--algo`, et l'indice manque | C |
| CLI-A14 | `--Algo fast 5` | erreur : le nom de l'option est sensible à la casse | C |
| CLI-A15 | `--algo --list 5` | erreur : `--list` devient la valeur de `--algo` | C |
| CLI-A16 | `--algo bogus --algo fast 5` | erreur : chaque occurrence doit être valide, même si une occurrence valide suit | C |

### 5.4 Liste — L (F4, F5, F8, règles 3 et 6)

| ID | Arguments | Attendu | Source |
|---|---|---|---|
| CLI-L01 | `--list 0` | `0\n` | O |
| CLI-L02 | `--list 1` | `0\n1\n` | O |
| CLI-L03 | `--list 2` | `0\n1\n1\n` | O |
| CLI-L04 | `--list 20` | les 21 premiers termes de l'oracle, un par ligne | O |
| CLI-L05 | `--list 2000` | les 2 001 termes de l'oracle, un par ligne | O |
| CLI-L06 | `--list 10000` | 10 001 lignes. Les 2 001 premières égalent l'oracle; chaque ligne d'indice ≥ 2 est la somme des deux précédentes; la dernière compte 2 090 chiffres; la sortie se termine par `\n`. | O, M |
| CLI-L07 | `5 --list` | les 6 premiers termes (option après l'indice) | O |
| CLI-L08 | `--list --list 3` | les 4 premiers termes (drapeau répété) | O |
| CLI-L09 | `--list 10001` | erreur : borne d'une liste + 1 | C |
| CLI-L10 | `--list --algo fast 5` | erreur : `--list` et `--algo` s'excluent | C |
| CLI-L11 | `--algo fast --list 5` | erreur : même règle, ordre inverse | C |
| CLI-L12 | `--list --algo all 5` | erreur : même règle avec la comparaison | C |
| CLI-L13 | `--list` | erreur : indice absent | C |
| CLI-L14 | `--list=5` | erreur : un drapeau ne prend pas de valeur (règle 4) | C |

### 5.5 Durées — D (F6, règles 2 et 3)

| ID | Arguments | stdout | stderr (lignes de durée, dans l'ordre) |
|---|---|---|---|
| CLI-D01 | `--time 50` | `12586269025\n` | `fast` |
| CLI-D02 | `--time --algo all 50` | `12586269025\n`, une seule fois | `fast`, `iterative`, `matrix` |
| CLI-D03 | `--time --algo matrix 50` | `12586269025\n` | `matrix` |
| CLI-D04 | `--time --algo fast --algo matrix 50` | `12586269025\n` | `matrix` (la dernière occurrence gagne) |
| CLI-D05 | `--algo all --algo iterative --time 50` | `12586269025\n` | `iterative` (elle gagne aussi sur `all`) |
| CLI-D06 | `--time --list 5` | les 6 premiers termes | `iterative` |
| CLI-D07 | `50 --time` | `12586269025\n` | `fast` |
| CLI-D08 | `--time --time 50` | `12586269025\n` | `fast`, une seule ligne |
| CLI-D09 | `--time` | erreur : indice absent | — |
| CLI-D10 | `--time=1 5` | erreur : un drapeau ne prend pas de valeur | — |
| CLI-D11 | `--time abc` | erreur, sans aucune ligne de durée | — |

### 5.6 Aide — H (F7, règle 1)

| ID | Arguments | Attendu |
|---|---|---|
| CLI-H01 | `--help` | usage, code 0, stderr vide |
| CLI-H02 | `-h` | usage |
| CLI-H03 | `--help --bogus` | usage : l'aide l'emporte sur une option inconnue |
| CLI-H04 | `5 -h` | usage : l'aide l'emporte, où qu'elle soit |
| CLI-H05 | `--algo --help` | usage : l'aide l'emporte, même à la place de la valeur de `--algo` |
| CLI-H06 | `--list 10001 --help` | usage : l'aide l'emporte sur une borne dépassée |
| CLI-H07 | `--help --help` | usage |
| CLI-H08 | `-help` | erreur : option inconnue, malgré `flag` de Go qui l'accepte |
| CLI-H09 | `--HELP` | erreur : le nom est sensible à la casse |
| CLI-H10 | `--algo=--help 5` | erreur : l'argument ne vaut pas exactement `--help`, et la valeur n'est pas un algorithme |

### 5.7 Options inconnues — U (règle 4)

Chacun de ces cas attend une erreur.

| ID | Arguments | Ce qu'il éprouve |
|---|---|---|
| CLI-U01 | `--bogus 5` | option longue inconnue |
| CLI-U02 | `- 5` | tiret seul |
| CLI-U03 | `-- 5` | double tiret, sans le sens « fin des options » |

### 5.8 Environnement — V (F6, F10)

| ID | Arguments et environnement | Attendu |
|---|---|---|
| CLI-V01 | `--time 50`, avec `LANG`, `LC_ALL` et `LC_NUMERIC` à `fr_CA.UTF-8` | comme D01 : la durée garde un point décimal |
| CLI-V02 | `10`, puis `--bogus 5`, puis `--help`, avec `FORCE_COLOR=1`, `CLICOLOR_FORCE=1` et `PYTHON_COLORS=1` | les mêmes sorties que T01, U01 et H01, sans aucun octet ESC |

## 6. Hors catalogue

- **Hors contrat, donc non testé** : un stdout fermé avant la fin (`fib --list 10000 | head`) et un argument qui n'est pas de l'Unicode valide.
- **Lacune connue** : aucun cas CLI ne peut provoquer une discordance, donc le chemin du code 3 dans la CLI n'a pas de test automatique, et pas davantage la règle qui le restreint à une seule ligne `fib:` sans durée, même avec `--time`. BIB-08 vérifie que les algorithmes concordent; la revue de code vérifie ce chemin.

## 7. Traçabilité

| Exigence | Cas |
|---|---|
| F1 — terme | T01–T12 |
| F2 — choix de l'algorithme | A01–A03, A06–A08 |
| F3 — comparaison | A04, A05, D02; code 3 : voir § 6 |
| F4 — liste | L01–L08 |
| F5 — exclusion `--list` / `--algo` | L10–L12 |
| F6 — durées | D01–D08, L06 (aucune durée sans `--time`), V01 |
| F7 — aide | H01–H07 |
| F8 — bornes | T12, I12–I14, L06, L09 |
| F9 — erreurs d'usage | I01–I15, A09–A16, L09–L14, D09–D11, H08–H10, U01–U03 |
| F10 — format des sorties | X-4 sur chaque cas, V02 |
| Règle 1 — aide d'abord | H01–H10 |
| Règle 2 — `--algo` | A06–A16, D04, D05 |
| Règle 3 — drapeaux | L08, L14, D08, D10 |
| Règle 4 — options inconnues | I11, A14, H08, H09, U01–U03 |
| Règle 5 — indice | T10, T11, I01–I15 |
| Règle 6 — `--list` sans `--algo` | L10–L12 |
| Seam 1 — bibliothèque | BIB-01–BIB-14 |
| Oracle | ORA-01–ORA-06 |

## 8. Par ticket

- **#2, contrat et TypeScript** :
  1. le harnais et les cas ORA-01 à ORA-06;
  2. les cycles BIB en TypeScript;
  3. la CLI TypeScript, en ajoutant chaque cas CLI au test de contrat au moment où elle le fait passer, dans l'ordre T, I, A, L, D, H, U, V.
- **#3 Go, #4 Rust, #5 Python** :
  1. les cycles BIB dans le langage;
  2. les cas CLI, qui existent déjà : `node contracts/cli.test.ts <id>`, groupe par groupe, dans l'ordre du catalogue.
- **Fin d'un ticket** : les cas ORA, les cas BIB du langage et tous les cas CLI de son identifiant passent, ce qui revient à `npm run check:<id>` vert.
