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
- **Nommage** : chaque test porte l'identifiant de son cas et décrit un comportement, par exemple `CLI-I06 : un soulignement est refusé`. Un test de garde porte un identifiant `PERF` (§ 6).
- **Une assertion logique par test.** Un cas qui porte sur plusieurs entrées du même comportement, comme BIB-05 sur n = 0..2000, se paramètre.

## 2. D'où viennent les attendus

| Code | Source | Exemples |
|---|---|---|
| **O** | l'oracle : la table F(0) à F(2000) au format du b-file OEIS A000045, générée par la formule de Binet et vérifiée par la définition (ORA) | tout terme d'indice ≤ 2000 |
| **M** | un fait mathématique indépendant des algorithmes | nombre de chiffres, périodes de Pisano, F(k) divise F(mk), identité de Cassini, récurrence vérifiée sur une sortie |
| **C** | le texte du contrat | texte d'usage, préfixe `fib: `, codes de sortie, format des durées |

Faits mathématiques utilisés :

- Pour n ≥ 2, F(n) compte ⌊n·log₁₀ φ − log₁₀ √5⌋ + 1 chiffres. La formule donne 0 pour n = 0 et pour n = 1, et elle est exacte de 2 à 2 000 face à l'oracle. Elle donne 418 pour n = 2 000, 2 090 pour n = 10 000, 20 899 pour n = 100 000, 208 988 pour n = 1 000 000.
- Les périodes de Pisano valent π(2¹¹) = 3 072 et π(10³) = 1 500. Donc F(100 000) ≡ F(1696) (mod 2048) et F(100 000) ≡ F(1000) (mod 1000), puisque 100 000 mod 3 072 = 1 696 et 100 000 mod 1 500 = 1 000. De même F(1 000 000) ≡ F(1600) (mod 2048) et F(1 000 000) ≡ F(1000) (mod 1000), puisque 1 000 000 mod 3 072 = 1 600 et 1 000 000 mod 1 500 = 1 000.
- F(k) divise F(mk) pour tous k, m ≥ 1. De l'identité d'addition F(a+b) = F(a)·F(b+1) + F(a−1)·F(b), on tire F((j+1)k) = F(k)·F(jk+1) + F(k−1)·F(jk) : si F(k) divise F(jk), il divise F((j+1)k), et F(k) divise F(k). Comme 2 000 divise 100 000 et 1 000 000, F(2000), lu dans l'oracle, divise F(100 000) et F(1 000 000). Aucune constante de plus : même démarche que les périodes de Pisano.
  - Ce que le fait détecte : F(2000) est impair et 5³ est la plus grande puissance de 5 qui le divise (vérifié sur l'oracle), donc F(2000) = 5³·q, où q est premier avec 10 et compte 416 chiffres. Altérer un bloc de moins de 416 chiffres ajoute au terme D·10ᵏ avec 0 < |D| < 10⁴¹⁵ ≤ q, qui n'est jamais multiple de q : la sortie cesse d'être divisible par F(2000). La longueur, le premier chiffre et les restes mod 2048 et mod 1000 ne voient pas un chiffre de poids 10¹¹ ou plus, hors le premier. Un bloc de 416 chiffres ou plus peut échapper à la divisibilité.
- Identité de Cassini : F(n−1)·F(n+1) − F(n)² = (−1)ⁿ.
- La récurrence F(n) = F(n−1) + F(n−2) sert à vérifier une sortie produite, jamais à produire un attendu.

**Interdit** : recalculer un attendu avec l'algorithme testé, ou avec une copie de cet algorithme (anti-pattern « tautologique »).

Valeurs de référence, vérifiées le 2026-10-11. En cas de doute, l'oracle et les formules font foi.

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
| F(1 000 000) mod 2048 | 1211 |
| F(1 000 000) mod 1000 | 875 |

## 3. Oracle — ORA

Le test de contrat vérifie l'oracle avant tout cas CLI. Si l'oracle manque ou échoue, les cas CLI sont joués quand même : ceux dont l'attendu vient de l'oracle échouent avec le motif de l'oracle, les autres restent valables.

| ID | Vérification | Source |
|---|---|---|
| ORA-01 | Le fichier existe et contient exactement 2 001 lignes non vides. Les lignes vides sont ignorées. | O |
| ORA-02 | Chaque ligne a la forme `<n> <F(n)>` : deux suites de chiffres ASCII séparées par une seule espace, F(n) sans zéro de tête (`0` seul est permis) et sans `\r`. | O |
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
| BIB-10 | `fibList(0)` | `["0"]` | O |
| BIB-11 | `fibList(1)` | `["0", "1"]` | O |
| BIB-12 | `fibList(2000)` | les 2 001 termes de l'oracle, en chaînes décimales, dans l'ordre (ADR-0004) | O |
| BIB-13 | `fib(5, X)` pour X parmi `all`, `bogus`, chaîne vide et `FAST` | refus, sous la forme d'erreur idiomatique du langage | C |
| BIB-14 | `fib(-1, A)` et `fibList(-1)`; `fib(1.5, A)`, `fib(NaN, A)`, `fibList(1.5)` et `fibList(NaN)`; pour Python, aussi `fib(0.0, A)`, `fib(True, A)`, `fibList(0.0)` et `fibList(True)`; si le type de l'indice admet ces valeurs | refus | C |

Notes par langage :

- **BIB-13** : si le système de types rend un algorithme inconnu impossible à passer (enum Rust, par exemple), le cas porte sur la conversion du nom vers l'algorithme, que la bibliothèque expose.
- **BIB-13, TypeScript** : X comprend aussi `toString`, une clé héritée du prototype.
- **BIB-14** : Rust est exclu (indice `u64`). Go (`int`), Python et TypeScript testent -1. Seuls Python et TypeScript testent 1.5 et NaN, et seul Python teste 0.0 et `True`, puisque son type distingue flottant et entier, et que `bool` hérite d'`int` : le type de l'indice admet `True`, que `isinstance(n, int)` laisserait passer.

## 5. Contrat CLI — CLI (seam 2, joué sur chaque implémentation)

Les arguments sont passés tels quels au processus, sans shell : `""` désigne un argument vide. Une espace sépare deux arguments, et une espace interne à un argument s'écrit en toutes lettres.

**Assertions communes**, vérifiées sur chaque cas :

- **X-1** : le code de sortie est celui du tableau. Un cas sans code indiqué attend 0.
- **X-2** : stdout égale l'attendu, octet pour octet. En cas d'erreur, stdout est vide.
- **X-3** : stderr dépend du cas :
  - un succès sans `--time` laisse stderr vide;
  - avec `--time`, stderr contient exactement les lignes de durée indiquées, chacune de la forme `^(fast|iterative|matrix) [0-9]+\.[0-9]{3} ms$`;
  - une erreur écrit exactement une ligne qui commence par `fib: ` et se termine par `\n`.
- **X-4** : stdout et stderr ne contiennent que de l'ASCII imprimable (0x20 à 0x7E) et `\n`.

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
| CLI-T12 | `100000` | 20 899 chiffres, le premier non nul, puis `\n`; terme ≡ F(1696) (mod 2048) et ≡ F(1000) (mod 1000); terme divisible par F(2000) | O, M |
| CLI-T13 | `1000000` | 208 988 chiffres, le premier non nul, puis `\n`; terme ≡ F(1600) (mod 2048) et ≡ F(1000) (mod 1000); terme divisible par F(2000). La borne d'un terme, atteinte. | O, M |
| CLI-T14 | `0` répété 5 000 fois, puis `5`, dans le même argument | `5\n`. L'indice compte 5 001 chiffres, au-delà de la limite de conversion de Python (4 300) : la CLI doit l'accepter. | O |

### 5.2 Indice invalide — I (F8, F9, règles 4 et 5)

Chacun de ces cas attend une erreur (source C).

| ID | Arguments | Ce qu'il éprouve |
|---|---|---|
| CLI-I01 | aucun argument | indice absent |
| CLI-I02 | `""` | argument vide (`Number("")` vaut 0) |
| CLI-I03 | `abc` | pas un nombre |
| CLI-I04 | `1.5` | décimal |
| CLI-I05 | `+5` | signe accepté par `int()`, `Number`, `parse::<u64>()` et `Atoi` |
| CLI-I06 | `1_000` | soulignement accepté par `int()` |
| CLI-I07 | `0x10` | hexadécimal accepté par `Number` et `BigInt` |
| CLI-I08 | une espace, puis `5`, dans le même argument | espace de tête, acceptée par `int()` et `Number` |
| CLI-I09 | `5`, puis une espace, dans le même argument | espace de queue, acceptée par `int()` et `Number` |
| CLI-I10 | `٣` | chiffre non ASCII, accepté par `int()` |
| CLI-I11 | `-1` | option inconnue (règle 4), pas un indice négatif |
| CLI-I12 | `1000001` | borne d'un terme + 1 |
| CLI-I13 | `000000000000000000000000001000001` | borne dépassée malgré les zéros de tête |
| CLI-I14 | `99999999999999999999` | trop grand pour un uint64 : erreur, pas une panique |
| CLI-I15 | `5 6` | deux indices |
| CLI-I16 | `5` suivi d'un saut de ligne, dans le même argument | le `$` d'une expression régulière Python accepte un `\n` final |
| CLI-I17 | `5`, une espace et `6`, dans le même argument | espace interne à un seul argument, à ne pas confondre avec I15, qui passe deux arguments |

### 5.3 Algorithmes — A (F2, F3, règle 2)

| ID | Arguments | Attendu | Source |
|---|---|---|---|
| CLI-A01 | `--algo iterative 2000` | F(2000) de l'oracle, puis `\n` | O |
| CLI-A02 | `--algo matrix 2000` | F(2000) de l'oracle, puis `\n` | O |
| CLI-A03 | `--algo fast 2000` | F(2000) de l'oracle, puis `\n` | O |
| CLI-A04 | `--algo all 2000` | F(2000) de l'oracle, puis `\n`, sur une seule ligne | O |
| CLI-A05 | `--algo all 0` | `0\n` | O |
| CLI-A06 | `--algo=matrix 2000` | F(2000) de l'oracle, puis `\n` | O |
| CLI-A07 | `2000 --algo matrix` | F(2000) de l'oracle, puis `\n` (option après l'indice) | O |
| CLI-A08 | `--algo fast --algo matrix 2000` | F(2000) de l'oracle, puis `\n` (répétition acceptée; D04 montre laquelle gagne) | O |
| CLI-A09 | `--algo` | erreur : valeur absente | C |
| CLI-A10 | `--algo= 5` | erreur : valeur vide | C |
| CLI-A11 | `--algo bogus 5` | erreur : algorithme inconnu | C |
| CLI-A12 | `--algo FAST 5` | erreur : le nom est sensible à la casse | C |
| CLI-A13 | `--algo 5` | erreur : `5` devient la valeur de `--algo`, et l'indice manque | C |
| CLI-A14 | `--Algo fast 5` | erreur : le nom de l'option est sensible à la casse | C |
| CLI-A15 | `--algo --list 5` | erreur : `--list` devient la valeur de `--algo` | C |
| CLI-A16 | `--algo bogus --algo fast 5` | erreur : chaque occurrence doit être valide, même si une occurrence valide suit | C |
| CLI-A17 | `--algo "" 5` | erreur : valeur vide dans la forme séparée (A10 ne couvre que `--algo=`) | C |
| CLI-A18 | `--algo`, puis `x`, un saut de ligne et `y` dans un même argument, puis `5` | erreur : un saut de ligne dans un argument ne produit pas deux lignes (F9, F10) | C |
| CLI-A19 | `--algo FAST --algo fast 5` | erreur : la casse compte à chaque occurrence | C |
| CLI-A20 | `--algo fäst 5` | erreur; stderr reste en ASCII (X-4) | C |

### 5.4 Liste — L (F4, F5, F8, règles 3 et 6)

| ID | Arguments | Attendu | Source |
|---|---|---|---|
| CLI-L01 | `--list 0` | `0\n` | O |
| CLI-L02 | `--list 1` | `0\n1\n` | O |
| CLI-L03 | `--list 2` | `0\n1\n1\n` | O |
| CLI-L04 | `--list 20` | les 21 premiers termes de l'oracle, un par ligne | O |
| CLI-L05 | `--list 2000` | les 2 001 termes de l'oracle, un par ligne | O |
| CLI-L06 | `--list 10000` | 10 001 lignes. Les 2 001 premières égalent l'oracle; chaque ligne d'indice ≥ 2 est la somme des deux précédentes; chaque ligne est en décimal, sans zéro de tête; la dernière compte 2 090 chiffres; la sortie se termine par `\n`. | O, M |
| CLI-L07 | `5 --list` | les 6 premiers termes (option après l'indice) | O |
| CLI-L08 | `--list --list 3` | les 4 premiers termes (drapeau répété) | O |
| CLI-L09 | `--list 10001` | erreur : borne d'une liste + 1 | C |
| CLI-L10 | `--list --algo fast 5` | erreur : `--list` et `--algo` s'excluent | C |
| CLI-L11 | `--algo fast --list 5` | erreur : même règle, ordre inverse | C |
| CLI-L12 | `--list --algo all 5` | erreur : même règle avec la comparaison | C |
| CLI-L13 | `--list` | erreur : indice absent | C |
| CLI-L14 | `--list=5` | erreur : un drapeau ne prend pas de valeur (règle 4) | C |
| CLI-L15 | `--list 00010001` | erreur : la borne d'une liste s'applique malgré les zéros de tête | C |
| CLI-L16 | `--list 010000` | comme L06 (même vérification) : les zéros de tête sont permis | O, M |

### 5.5 Durées — D (F6, règles 2 et 3)

Source des attendus de stdout : O (F(50) et les 6 premiers termes). Les littéraux ci-dessous sont des valeurs de référence (§ 2); le test les lit dans l'oracle.

| ID | Arguments | stdout | stderr (lignes de durée, dans l'ordre) |
|---|---|---|---|
| CLI-D01 | `--time 50` | `12586269025\n` | `fast` |
| CLI-D02 | `--time --algo all 50` | `12586269025\n`, une seule fois | `fast`, `iterative`, `matrix` |
| CLI-D03 | `--time --algo matrix 50` | `12586269025\n` | `matrix` |
| CLI-D04 | `--time --algo fast --algo matrix 50` | `12586269025\n` | `matrix` (la dernière occurrence gagne) |
| CLI-D05 | `--algo all --algo iterative --time 50` | `12586269025\n` | `iterative` (la dernière occurrence gagne aussi sur `all`) |
| CLI-D06 | `--time --list 5` | les 6 premiers termes | `iterative` |
| CLI-D07 | `50 --time` | `12586269025\n` | `fast` |
| CLI-D08 | `--time --time 50` | `12586269025\n` | `fast`, une seule ligne |
| CLI-D09 | `--time` | erreur : indice absent | — |
| CLI-D10 | `--time=1 5` | erreur : un drapeau ne prend pas de valeur | — |
| CLI-D11 | `--time abc` | erreur, sans aucune ligne de durée | — |

### 5.6 Aide — H (F7, règle 1)

Source des attendus : C, le texte d'usage et la règle 1 du contrat.

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
| CLI-H09 | `--HELP` | erreur : le nom de l'option est sensible à la casse |
| CLI-H10 | `--algo=--help 5` | erreur : l'argument ne vaut pas exactement `--help`, et la valeur n'est pas un algorithme |
| CLI-H11 | `abc --help` | usage : l'aide l'emporte sur un indice invalide |

### 5.7 Options inconnues — U (règle 4)

Chacun de ces cas attend une erreur (source C).

| ID | Arguments | Ce qu'il éprouve |
|---|---|---|
| CLI-U01 | `--bogus 5` | option longue inconnue |
| CLI-U02 | `- 5` | tiret seul |
| CLI-U03 | `-- 5` | double tiret, sans le sens « fin des options » |
| CLI-U04 | `--bogüs 5` | option non ASCII : la ligne d'erreur reste en ASCII (F9, F10, règle 4) |
| CLI-U05 | `--bögüs 5` | option avec plusieurs caractères non ASCII : la ligne d'erreur reste en ASCII (X-4) |
| CLI-U06 | `--bogus abc` | deux fautes, l'option inconnue et l'indice invalide : une seule ligne `fib:` |

### 5.8 Environnement — V (F6, F10)

| ID | Arguments et environnement | Attendu |
|---|---|---|
| CLI-V01 | `--time 50`, avec `LANG`, `LC_ALL` et `LC_NUMERIC` à `fr_CA.UTF-8` | comme D01 : la durée garde un point décimal. Sous Windows, les variables de locale sont sans effet : V01 n'y éprouve que la locale de la session. |
| CLI-V02 | `--bogus 5`, puis `--help`, puis `10`, avec `FORCE_COLOR=1`, `CLICOLOR_FORCE=1` et `PYTHON_COLORS=1`, sans `NO_COLOR` | les mêmes sorties que U01, H01 et T01, sans aucun octet ESC. L'exécution qui lit l'oracle vient en dernier, pour chercher l'ESC même sans oracle. `NO_COLOR` est retiré de l'environnement du fils, non vidé. Hérité du parent, il l'emporterait sur `FORCE_COLOR` sous Python 3.14 et viderait le cas de son sens. Vidé, il fait écrire à Node 22 `Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set` sur stderr dès qu'un `console.*` tourne (vérifié), et X-3 rougirait pour une raison du harnais. Les premiers CPython 3.13 (3.13.0 et 3.13.1) testent probablement la présence de `NO_COLOR`, non sa valeur, alors que 3.13.3 et Python 3.13.16 testent la valeur : seul le retrait vaut pour toutes les versions. `python -I -S`, commande de lancement du contrat, ignore `PYTHON_COLORS` (vérifié) : pour Python, seul `FORCE_COLOR` force la couleur. |
| CLI-V03 | `--time 50`, avec `PYTHONIOENCODING=utf-16` | comme D01 : stdout et stderr restent en ASCII, sans BOM. Seul Python lit cette variable. Sous `python -I -S`, commande de lancement du contrat, la variable est ignorée : le cas reste joué, et `reconfigure(encoding="ascii")` garde la protection si Python est lancé autrement. |
| CLI-V04 | `--bogus 5`, puis `--time 50`, puis `10`, avec le descripteur 2 fermé au lancement (`2>&-`) | stderr fermé : stdout et code inchangés, comme U01, D01 et T01. `--bogus 5` donne un stdout vide et le code 2; `--time 50` donne `12586269025\n` et le code 0; `10` donne `55\n` et le code 0. X-3 ne s'applique pas, puisque stderr n'existe pas : le cas exige à la place un stderr vide pour chaque exécution, ce qui prouve que le contrat a fermé le fd 2 pour la CLI elle-même. X-4 n'a pas d'assertion à part : l'égalité exacte de stdout, dont les attendus sont en ASCII, le couvre. Avant le correctif, Go, Rust et TypeScript tenaient le cas; Python sortait en code 1, stdout vide, sur toute entrée : CPython met alors `sys.stderr` à `None`, et `reconfigure` plante avant `main`. Sous POSIX, le contrat ferme le fd 2 par `/bin/sh -c 'exec "$0" "$@" 2>&-'`, qui passe les arguments tels quels, sans les réinterpréter. `spawnSync` n'offre rien de plus direct : `stdio: 'ignore'` ouvre `/dev/null`, ce qui n'est pas un fd fermé (vérifié). Un test à part, `CLI-V04 : le harnais ferme le fd 2`, joué une seule fois pour les quatre CLI, vérifie le harnais : une redirection vers le fd 2 doit échouer, sans quoi le cas passerait à vide. Sous Windows, ni Node ni le contrat ne savent lancer un processus sans stderr : le cas et ce test se sautent, avec leur raison écrite dans le test, et `PERF-PY-23` garde alors le correctif de Python (§ 6). |

## 6. Hors catalogue

- **Tests de garde des optimisations** (ADR-0004) : `PERF-GO-<n>`, `PERF-RS-<n>`, `PERF-TS-<n>` et `PERF-PY-<n>`, propres à chaque langage et hors seams, numérotés à la suite dans chaque langage. Ils protègent ce que les cas BIB et CLI ne visent pas directement : la retenue de l'additionneur décimal, la dernière étape de `matrix` et de `fast`, l'écriture par tranches (Go, Rust, Python; TypeScript écrit en un seul appel), les seuils de Python (`Decimal` dès 170 000, `str()` au-delà de 200 000 bits), l'absence d'allocation ou d'import. Un test de garde peut aussi protéger un correctif que le contrat ne peut pas éprouver, comme `encoding="ascii"` de Python, que `-I` neutralise sous CLI-V03 (`PERF-PY-20`), ou le puits donné à un flux standard absent, que CLI-V04 ne joue pas sous Windows (`PERF-PY-23`). Leur liste est dans les fichiers de test.
- **Hors contrat, donc non testé** : un stdout fermé avant la fin (`fib --list 10000 | head`) et un argument qui n'est pas de l'Unicode valide.
- **Lacune connue** : aucun cas CLI ne peut provoquer une discordance, donc le chemin du code 3 dans la CLI n'a pas de test automatique, et pas davantage la règle qui le restreint à une seule ligne `fib:` sans durée, même avec `--time`. BIB-08 vérifie que les algorithmes concordent; la revue de code vérifie ce chemin.
- **Lacune connue** : le contrat vérifie le nom et le format des lignes de durée, mais ni que l'algorithme nommé s'exécute vraiment, ni que la durée est mesurée (`0.000 ms` passe). La revue de code couvre ce point.

## 7. Traçabilité

Le § 7 fait foi : les titres du § 5 ne nomment que les exigences principales de chaque groupe.

| Exigence | Cas |
|---|---|
| F1 — terme | T01–T14, D01, D07, D08, V04 |
| F2 — choix de l'algorithme | A01–A03, A06–A08, D03–D05 |
| F3 — comparaison | A04, A05, D02; code 3 : voir § 6 |
| F4 — liste | L01–L08, L16 |
| F5 — exclusion `--list` / `--algo` | L10–L12 |
| F6 — durées | D01–D08, X-3 sur chaque succès sans `--time`, V01, V04 |
| F7 — aide | H01–H07, H11 |
| F8 — bornes | T13, I12–I14, L06, L09, L15, L16 |
| F9 — erreurs d'usage | I01–I17, A09–A20, L09–L15, D09–D11, H08–H10, U01–U06, V04 |
| F10 — format des sorties | X-4 sur chaque cas, A18, A20, U04, U05, V02, V03 |
| Règle 1 — aide d'abord | H01–H11 |
| Règle 2 — `--algo` | A06–A20, D04, D05, H10 |
| Règle 3 — drapeaux | L08, L14, D08, D10 |
| Règle 4 — options inconnues | I11, A14, L14, D10, H08, H09, U01–U06 |
| Règle 5 — indice | T10, T11, T14, I01–I17, L15, L16 |
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
