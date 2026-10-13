"""Seam 1 : la bibliothèque. Les attendus viennent de l'oracle (contracts/b000045.txt) ou de faits mathématiques.
Les gardes PERF-PY-n, hors seams (ADR-0004), protègent les optimisations que les cas BIB et CLI ne visent pas
(PERF-PY-20, 23 et 29 protègent les correctifs F10 et CLI-V04). Chaque test porte son identifiant en tête de sa
docstring : grep BIB-05 python/."""
import decimal
import math
import os
import subprocess
import sys
import unittest
from functools import cache
from pathlib import Path
from unittest import mock

from fib import (
    _ALGOS,
    COMPARISON,
    DECIMAL_FROM,
    MAX_LIST,
    MAX_TERM,
    STR_FROM_BITS,
    _fib_decimal,
    _text,
    compute,
    fib,
    fib_list,
    main,
)

ALGOS = ("iterative", "matrix", "fast")
HERE = Path(__file__).resolve().parent
ORACLE = HERE.parent / "contracts" / "b000045.txt"
FIB = HERE / "fib.py"
# True : bool hérite d'int, donc le type de l'indice l'admet, et `isinstance(n, int)` le laisserait passer.
REFUSED = ((-1, ValueError), (1.5, TypeError), (float("nan"), TypeError), (0.0, TypeError), (True, TypeError))
# Les chemins qui calculent en Decimal, chacun appelé avec un indice de 50.
DECIMAL_PATHS = (
    ("fib_list", lambda: fib_list(50)),
    ("fast", lambda: _fib_decimal(50, "fast")),
    ("matrix", lambda: _fib_decimal(50, "matrix")),
)
# PERF-PY-27 : (arguments après --time, algorithmes exécutés dans l'ordre). 10 et DECIMAL_FROM tiennent de part et d'autre
# du seuil : en int, puis en Decimal, où seuls fast et matrix calculent (avec iterative, int : PERF-PY-13).
EXECUTED = (
    (["10"], ["fast"]),
    (["--algo", "iterative", "10"], ["iterative"]),
    (["--algo", "matrix", "10"], ["matrix"]),
    (["--algo", "all", "10"], ["fast", "iterative", "matrix"]),
    ([str(DECIMAL_FROM)], ["fast"]),
    (["--algo", "matrix", str(DECIMAL_FROM)], ["matrix"]),
)


@cache
def oracle_text():
    """F(0) … F(2000) en texte, lus à l'exécution dans l'oracle.
    Toute anomalie lève une exception : le test échoue au lieu de passer."""
    terms = []
    for line in ORACLE.read_text(encoding="ascii").splitlines():
        if line.strip():
            index, term = line.split()
            if int(index) != len(terms):
                raise AssertionError(f"oracle invalide : indice {index} à la place de {len(terms)}")
            terms.append(term)
    if len(terms) != 2001:
        raise AssertionError(f"oracle invalide : 2 001 termes attendus, {len(terms)} lus")
    return terms


@cache
def oracle():
    """Les mêmes termes, en entiers."""
    return [int(term) for term in oracle_text()]


@cache
def big_terms():
    """(n, algo, chemin, texte) aux abords de DECIMAL_FROM et à 1 000 000, par _fib_decimal seul, puis par compute."""
    paths = {
        "_fib_decimal": lambda n, algo: str(_fib_decimal(n, algo)),
        "compute": lambda n, algo: compute([algo], False, n)[0][0],
    }
    return [
        (n, algo, path, text(n, algo))
        for n in (DECIMAL_FROM - 1, DECIMAL_FROM, 1_000_000)
        for algo in ("fast", "matrix")
        for path, text in paths.items()
    ]


def digit_count(n):
    """⌊n·log₁₀φ − log₁₀√5⌋ + 1 : F(n) vaut φⁿ/√5 à moins de 1 près."""
    return math.floor(n * math.log10((1 + math.sqrt(5)) / 2) - math.log10(math.sqrt(5))) + 1


class WriteCounter:
    """Un faux sys.stdout : compte ses appels à write et garde les textes reçus."""

    def __init__(self):
        self.calls = 0
        self.chunks = []

    def write(self, text):
        self.calls += 1
        self.chunks.append(text)
        return len(text)

    def flush(self):
        pass


def algorithms(wrap):
    """Un with qui substitue chaque entrée de _ALGOS par wrap(nom, calcul) : fib() et le chemin Decimal lisent la table à
    chaque appel, donc la substitution vaut en int comme en Decimal. Elle suppose que _ALGOS reste le seul aiguillage
    des algorithmes (PERF-PY-26 et 27)."""
    return mock.patch.dict(_ALGOS, {name: wrap(name, calc) for name, calc in _ALGOS.items()})


def main_captured(args):
    """main(args) avec deux WriteCounter à la place de sys.stdout et de sys.stderr; rend le code, puis ces deux flux."""
    out, err = WriteCounter(), WriteCounter()
    with mock.patch("sys.stdout", out), mock.patch("sys.stderr", err):
        return main(args), out, err


def one_more(bad):
    """Le wrap de PERF-PY-26 : l'algorithme bad rend le vrai terme plus 1, les deux autres le vrai terme."""
    return lambda name, calc: lambda n, *kind: calc(n, *kind) + int(name == bad)


def spying(noted):
    """Le wrap de PERF-PY-27 : chaque entrée note son nom dans noted, puis délègue au vrai calcul."""

    def wrap(name, calc):
        def call(n, *kind):
            noted.append(name)
            return calc(n, *kind)

        return call

    return wrap


# Flux hostiles : l'encodage de PYTHONIOENCODING=utf-16 et la fin de ligne de Windows (\r\n), que CPython ne donne pas
# sous Linux. Le bloc __main__ doit les ramener à l'ASCII et à \n (F10). `kept` garde les deux flux vivants quand un
# test met sys.<flux> à None : sinon le finaliseur du flux hostile ferme le BufferedWriter qu'il partage avec
# sys.__<flux>__, et le vrai stderr (la trace d'une exception du bloc) devient inutilisable.
HOSTILE = (
    "import io, sys\n"
    + "".join(
        f"sys.{name} = io.TextIOWrapper(sys.{name}.buffer, 'utf-16', newline='\\r\\n')\n" for name in ("stdout", "stderr")
    )
    + "kept = sys.stdout, sys.stderr\n"
)


def run_main_block(args, absent=()):
    """Exécute le bloc __main__ de fib.py dans python -I -S -c, sur des flux hostiles (HOSTILE), après avoir mis à None
    les flux de `absent` : l'état où CPython laisse sys.stdout ou sys.stderr quand le fd 1 ou 2 est fermé au lancement
    ou, sous Windows, quand son handle est invalide. Pas de runpy : il importe os lui-même. Une exception du bloc
    s'écrit sur le vrai stderr, même si `absent` le contient : HOSTILE garde les flux hostiles référencés."""
    code = "".join(
        [
            HOSTILE,
            *(f"sys.{name} = None\n" for name in absent),
            f"path = {str(FIB)!r}\n",
            "try:\n",
            "    exec(compile(open(path, 'rb').read(), path, 'exec'), {'__name__': '__main__', '__file__': path})\n",
            "except Exception:\n",
            "    import traceback; traceback.print_exc(file=sys.__stderr__); sys.exit(1)\n",
        ]
    )
    return subprocess.run([sys.executable, "-I", "-S", "-c", code, *args], capture_output=True)


def importtime_modules(*argv):
    """Lance python -I -S -X importtime avec argv; rend le processus et les modules de son rapport (dernière colonne,
    sur stderr)."""
    run = subprocess.run([sys.executable, "-I", "-S", "-X", "importtime", *argv], capture_output=True)
    rows = (line for line in run.stderr.splitlines() if line.startswith(b"import time:"))
    return run, {row.rpartition(b"|")[2].strip().decode("ascii") for row in rows}


def run_fib(code, *args):
    """Lance `import fib` puis `code` dans python -I -S -c : les options du contrat, mais fib.main s'appelle depuis
    `code`, donc sans le bloc __main__. sys.argv[2:] vaut args. stdout va au puits (--list 10000 écrit 10 Mo), stderr
    revient en texte, avec un délai maximal."""
    prelude = "import sys; sys.path.insert(0, sys.argv[1]); import fib\n"
    command = [sys.executable, "-I", "-S", "-c", prelude + code, str(HERE), *args]
    return subprocess.run(
        command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, encoding="ascii", errors="replace", timeout=60
    )


# Sondes de PERF-PY-25. spy remplace time.perf_counter, que compute lit pour chronométrer, et note à chaque lecture si
# decimal est dans sys.modules et combien de modules s'y trouvent, sans lire d'attribut du module : un module paresseux
# ne se charge pas à cause d'elle. report() écrit sur stderr « marques/lectures » : une marque par fenêtre (une paire de
# lectures, départ puis arrivée), 1 si decimal est chargé au départ et que sys.modules n'a pas grandi jusqu'à l'arrivée,
# sinon 0, et 0 pour une lecture orpheline; puis le nombre de lectures.
SPY_PRELUDE = (
    "import time\n"
    "clock, seen = time.perf_counter, []\n"
    "def spy():\n"
    "    seen.append(('decimal' in sys.modules, len(sys.modules)))\n"
    "    return clock()\n"
    "def report():\n"
    "    marks = ['1' if d0 and n0 == n1 else '0' for (d0, n0), (_, n1) in zip(seen[::2], seen[1::2])]\n"
    "    sys.stderr.write(''.join(marks) + '0' * (len(seen) % 2) + '/' + str(len(seen)))\n"
    "time.perf_counter = spy\n"
)
# La CLI sur les arguments de la sonde, puis son rapport.
SPY_CLI = "code = fib.main(sys.argv[2:])\nreport()\nsys.exit(code)\n"
# Le témoin joue trois fenêtres, chacune prouvant une moitié du prédicat de report(). (A) decimal absent, rien ne se
# charge : 0. Entre les fenêtres, _fib_decimal charge decimal, ce qu'un contrôle vérifie. (C) decimal chargé, mais
# sys.modules grandit dans la fenêtre, comme sous un module paresseux ou un import en cours : 0. (D) decimal chargé,
# sys.modules stable : 1.
SPY_WITNESS = (
    "spy(); spy()\n"
    "fib._fib_decimal(10, 'fast')\n"
    "assert 'decimal' in sys.modules\n"
    "spy(); sys.modules['probe'] = sys; spy()\n"
    "spy(); spy()\n"
    "report()\n"
)


def clock_reads_with_decimal(body, *args):
    """Lance SPY_PRELUDE puis body par run_fib; rend le processus et son rapport, les caractères qui suivent le dernier
    saut de ligne de stderr (les lignes --time le précèdent)."""
    run = run_fib(SPY_PRELUDE + body, *args)
    return run, run.stderr.rpartition("\n")[2]


class TestFib(unittest.TestCase):
    def assert_no_heavy_import(self, args):
        """Lance fib.main(args) dans un processus à part (run_fib), puis vérifie que ni re, ni decimal, ni _pylong n'ont
        été chargés."""
        code = (
            "assert fib.main(sys.argv[2:]) == 0\n"
            "assert not {'re', 'decimal', '_pylong'} & set(sys.modules), sorted(sys.modules)"
        )
        run = run_fib(code, *args)
        self.assertEqual(run.returncode, 0, run.stderr)

    def test_BIB_01_fib_0_iterative_vaut_0(self):
        """BIB-01 : fib(0, "iterative") vaut 0."""
        self.assertEqual(fib(0, "iterative"), oracle()[0])

    def test_BIB_02_fib_1_iterative_vaut_1(self):
        """BIB-02 : fib(1, "iterative") vaut 1."""
        self.assertEqual(fib(1, "iterative"), oracle()[1])

    def test_BIB_03_fib_2_iterative_vaut_1(self):
        """BIB-03 : fib(2, "iterative") vaut 1."""
        self.assertEqual(fib(2, "iterative"), oracle()[2])

    def test_BIB_04_fib_10_iterative_vaut_55(self):
        """BIB-04 : fib(10, "iterative") vaut 55."""
        self.assertEqual(fib(10, "iterative"), oracle()[10])

    def test_BIB_05_iterative_suit_l_oracle_de_0_a_2000(self):
        """BIB-05 : iterative suit l'oracle de F(0) à F(2000)."""
        for n, want in enumerate(oracle()):
            with self.subTest(n=n):
                self.assertEqual(fib(n, "iterative"), want)

    def test_BIB_06_fast_suit_l_oracle_de_0_a_2000(self):
        """BIB-06 : fast suit l'oracle de F(0) à F(2000)."""
        for n, want in enumerate(oracle()):
            with self.subTest(n=n):
                self.assertEqual(fib(n, "fast"), want)

    def test_BIB_07_matrix_suit_l_oracle_de_0_a_2000(self):
        """BIB-07 : matrix suit l'oracle de F(0) à F(2000)."""
        for n, want in enumerate(oracle()):
            with self.subTest(n=n):
                self.assertEqual(fib(n, "matrix"), want)

    def test_BIB_08_les_trois_algorithmes_concordent_a_100000(self):
        """BIB-08 : les trois algorithmes concordent à 100 000, sur un terme de 20 899 chiffres."""
        want = fib(100000, "fast")
        for algo in ("iterative", "matrix"):
            with self.subTest(algo=algo):
                self.assertEqual(fib(100000, algo), want)
        self.assertEqual(len(str(want)), 20899)

    def test_BIB_09_cassini_a_100000(self):
        """BIB-09 : l'identité de Cassini tient à 100 000 pour les trois algorithmes."""
        for algo in ALGOS:
            with self.subTest(algo=algo):
                before, at, after = (fib(n, algo) for n in (99999, 100000, 100001))
                self.assertEqual(before * after - at**2, 1)

    def test_BIB_10_fib_list_0_ne_contient_que_f0(self):
        """BIB-10 : fib_list(0) ne contient que F(0)."""
        self.assertEqual(fib_list(0), oracle_text()[:1])

    def test_BIB_11_fib_list_1_contient_f0_et_f1(self):
        """BIB-11 : fib_list(1) contient F(0) et F(1)."""
        self.assertEqual(fib_list(1), oracle_text()[:2])

    def test_BIB_12_fib_list_2000_suit_l_oracle(self):
        """BIB-12 : fib_list(2000) suit l'oracle."""
        self.assertEqual(fib_list(2000), oracle_text())

    def test_BIB_13_un_algorithme_inconnu_est_refuse(self):
        """BIB-13 : un algorithme inconnu est refusé."""
        for algo in ("all", "bogus", "", "FAST"):
            with self.subTest(algo=algo), self.assertRaises(ValueError):
                fib(5, algo)

    def test_BIB_14_un_indice_negatif_ou_non_entier_est_refuse(self):
        """BIB-14 : un indice négatif ou non entier est refusé."""
        for n, error in REFUSED:
            for algo in ALGOS:
                with self.subTest(n=n, algo=algo), self.assertRaises(error):
                    fib(n, algo)
            with self.subTest(n=n, algo="fib_list"), self.assertRaises(error):
                fib_list(n)

    def test_PERF_PY_1_le_texte_par_tranches_de_10_puissance_k_garde_les_zeros(self):
        """PERF-PY-1 : hors catalogue, garde de l'optimisation du texte décimal par tranches de CHUNK_DIGITS chiffres
        (les attendus s'écrivent sans conversion : 10**k est un 1 suivi de k zéros)"""
        for k in (1, 999, 1000, 1001, 2000, 2500):
            with self.subTest(k=k):
                self.assertEqual(_text(10**k), "1" + "0" * k)

    def test_PERF_PY_2_le_texte_par_tranches_de_10_puissance_k_moins_1_garde_les_neuf(self):
        """PERF-PY-2 : hors catalogue, garde de l'optimisation du texte décimal par tranches,
        aux frontières de tranche"""
        for k in (1, 999, 1000, 1001, 2000, 2500):
            with self.subTest(k=k):
                self.assertEqual(_text(10**k - 1), "9" * k)

    def test_PERF_PY_3_une_tranche_de_zeros_entre_deux_uns_est_conservee(self):
        """PERF-PY-3 : hors catalogue, garde de l'optimisation du texte décimal par tranches
        (une tranche entièrement nulle)"""
        self.assertEqual(_text(10**2000 + 1), "1" + "0" * 1999 + "1")

    def test_PERF_PY_4_des_zeros_entre_deux_tranches_sont_conserves(self):
        """PERF-PY-4 : hors catalogue, garde de l'optimisation du texte décimal par tranches
        (une tranche aux zéros de tête)"""
        self.assertEqual(_text(10**2000 + 10**1000), "1" + "0" * 999 + "1" + "0" * 1000)

    def test_PERF_PY_5_le_texte_par_tranches_egale_str_a_100000(self):
        """PERF-PY-5 : hors catalogue, garde de l'optimisation du texte décimal par tranches,
        face à la conversion native"""
        term = fib(100000, "fast")
        self.assertEqual(_text(term), str(term))

    def test_PERF_PY_6_les_chemins_decimal_laissent_l_objet_contexte_decimal_de_l_appelant(self):
        """PERF-PY-6 : hors catalogue, garde de l'optimisation en Decimal de fib_list et du terme
        (contexte exact local)"""
        for name, call in DECIMAL_PATHS:
            with self.subTest(path=name):
                before = decimal.getcontext()
                call()
                self.assertIs(decimal.getcontext(), before)

    def test_PERF_PY_7_les_chemins_decimal_laissent_la_precision_decimale_de_l_appelant(self):
        """PERF-PY-7 : hors catalogue, garde de l'optimisation en Decimal de fib_list et du terme
        (contexte exact local)"""
        for name, call in DECIMAL_PATHS:
            with self.subTest(path=name):
                prec = decimal.getcontext().prec
                call()
                self.assertEqual(decimal.getcontext().prec, prec)

    def test_PERF_PY_8_un_terme_a_100000_n_importe_ni_re_ni_decimal_ni_pylong(self):
        """PERF-PY-8 : hors catalogue, garde de l'optimisation du démarrage
        (CLI lancée comme le contrat : python -I -S); dépend des modules que charge CPython 3.12+ :
        une version qui en importe un de plus la fait échouer."""
        self.assert_no_heavy_import(["--algo", "all", "100000"])

    def test_PERF_PY_9_un_terme_en_decimal_suit_l_oracle_de_0_a_2000(self):
        """PERF-PY-9 : hors catalogue, garde de l'optimisation du terme calculé en Decimal
        (contexte exact, str() linéaire)"""
        for algo in ("fast", "matrix"):
            for n, want in enumerate(oracle_text()):
                with self.subTest(algo=algo, n=n):
                    self.assertEqual(str(_fib_decimal(n, algo)), want)

    def test_PERF_PY_10_un_terme_aux_abords_du_seuil_decimal_a_le_bon_nombre_de_chiffres(self):
        """PERF-PY-10 : hors catalogue, garde de l'optimisation du terme en Decimal,
        face à ⌊n·log₁₀φ − log₁₀√5⌋ + 1 chiffres"""
        for n, algo, path, text in big_terms():
            with self.subTest(n=n, algo=algo, path=path):
                self.assertEqual(len(text), digit_count(n))

    def test_PERF_PY_11_un_terme_aux_abords_du_seuil_decimal_est_congru_a_f_de_n_mod_3072_modulo_2048(self):
        """PERF-PY-11 : hors catalogue, garde de l'optimisation du terme en Decimal, face à l'oracle
        (2048 divise 10**11 : les onze derniers chiffres suffisent; la période de Pisano de 2048 vaut 3072)"""
        for n, algo, path, text in big_terms():
            with self.subTest(n=n, algo=algo, path=path):
                self.assertEqual(int(text[-11:]) % 2048, oracle()[n % 3072] % 2048)

    def test_PERF_PY_12_un_terme_aux_abords_du_seuil_decimal_est_congru_a_f_de_n_mod_1500_modulo_1000(self):
        """PERF-PY-12 : hors catalogue, garde de l'optimisation du terme en Decimal, face à l'oracle
        (les trois derniers chiffres donnent le terme modulo 1000; la période de Pisano de 1000 vaut 1500)"""
        for n, algo, path, text in big_terms():
            with self.subTest(n=n, algo=algo, path=path):
                self.assertEqual(int(text[-3:]), oracle()[n % 1500] % 1000)

    def test_PERF_PY_13_compute_passe_par_le_chemin_decimal_des_decimal_from_pour_fast_et_matrix_seuls(self):
        """PERF-PY-13 : hors catalogue, garde de l'optimisation du seuil DECIMAL_FROM
        (int en deçà, Decimal dès le seuil, sauf avec iterative, seul ou parmi all)"""
        for n, algos, taken in (
            (DECIMAL_FROM - 1, ["fast"], False),
            (DECIMAL_FROM - 1, ["matrix"], False),
            (DECIMAL_FROM, ["fast"], True),
            (DECIMAL_FROM, ["matrix"], True),
            (DECIMAL_FROM, ["iterative"], False),
            (DECIMAL_FROM, ["fast", "iterative", "matrix"], False),
        ):
            with self.subTest(n=n, algos=algos), mock.patch("fib._fib_decimal", wraps=_fib_decimal) as spy:
                compute(algos, False, n)
                self.assertEqual(spy.called, taken)

    def test_PERF_PY_14_le_texte_d_un_int_est_connu_de_part_et_d_autre_du_seuil_de_str(self):
        """PERF-PY-14 : hors catalogue, garde de l'optimisation de STR_FROM_BITS (tranches en deçà, str() au-delà).
        10**k compte ⌊k·log₂10⌋ + 1 bits : k = ⌊STR_FROM_BITS·log₁₀2⌋ = 60 205 en compte 199 997,
        k + 1 = 60 206 en compte 200 001."""
        below = int(STR_FROM_BITS * math.log10(2))
        for k in (below, below + 1):
            for x, want in ((10**k - 1, "9" * k), (10**k + 1, "1" + "0" * (k - 1) + "1")):
                with self.subTest(k=k, bits=x.bit_length()):
                    self.assertEqual(_text(x), want)

    def test_PERF_PY_15_un_terme_en_decimal_refuse_iterative_et_un_algorithme_inconnu(self):
        """PERF-PY-15 : hors catalogue, garde de l'optimisation du terme en Decimal (_iterative n'accepte pas kind)"""
        for algo in ("iterative", "all", "bogus", ""):
            with self.subTest(algo=algo), self.assertRaises(ValueError):
                _fib_decimal(5, algo)

    def test_PERF_PY_16_un_terme_en_decimal_refuse_un_indice_negatif_ou_non_entier(self):
        """PERF-PY-16 : hors catalogue, garde de l'optimisation du terme en Decimal (même refus que fib())"""
        for n, error in REFUSED:
            for algo in ("fast", "matrix"):
                with self.subTest(n=n, algo=algo), self.assertRaises(error):
                    _fib_decimal(n, algo)

    def test_PERF_PY_17_un_terme_a_100000_par_fast_seul_n_importe_ni_re_ni_decimal_ni_pylong(self):
        """PERF-PY-17 : hors catalogue, garde de l'optimisation du démarrage, comme PERF-PY-8 mais par le chemin par
        défaut (fast seul) : avec --algo all, iterative ferme toujours le chemin Decimal, que cette garde éprouve."""
        self.assert_no_heavy_import(["100000"])

    def test_PERF_PY_18_les_seuils_valent_les_valeurs_mesurees(self):
        """PERF-PY-18 : hors catalogue, garde des valeurs que le catalogue (§ 6) dit gardées : PERF-PY-10 à 14 se
        placent par rapport aux constantes, et aucun ne fixe celles-ci. Un nouveau seuil se mesure d'abord par
        npm run bench, puis se change ici."""
        self.assertEqual((DECIMAL_FROM, STR_FROM_BITS), (170_000, 200_000))

    def test_PERF_PY_19_le_texte_d_un_int_passe_par_str_au_dela_de_str_from_bits_seulement(self):
        """PERF-PY-19 : hors catalogue, garde de l'optimisation de STR_FROM_BITS : un espion sur divmod, que seules les
        tranches appellent. PERF-PY-14 ne vérifie que le texte, qui est le même par les deux chemins.
        Avec k = ⌊STR_FROM_BITS·log₁₀2⌋ = 60 205, 10**k + 1 compte 199 997 bits et 10**(k + 1) + 1 en compte 200 001."""
        below = int(STR_FROM_BITS * math.log10(2))
        for k, sliced in ((below, True), (below + 1, False)):
            x = 10**k + 1
            with self.subTest(k=k, bits=x.bit_length()), mock.patch("fib.divmod", wraps=divmod, create=True) as spy:
                _text(x)
                self.assertEqual(spy.called, sliced)

    def test_PERF_PY_20_pythonioencoding_ne_change_pas_les_octets_hors_de_python_I(self):
        """PERF-PY-20 : hors catalogue, garde du correctif F10 (ASCII quel que soit l'environnement), et non d'une
        optimisation; le ticket du contrat ajoute ce cas au catalogue (§ 6). CLI-V03 ne peut pas le voir :
        le contrat lance python -I, qui ignore PYTHONIOENCODING. Ici, sans -I, sans les variables PYTHON* du test et
        avec PYTHONIOENCODING=utf-16 : sans reconfigure(encoding="ascii"), la sortie passerait en UTF-16. La fin de
        ligne \\n, que CPython écrit déjà sous Linux, est gardée par PERF-PY-29."""
        env = {name: value for name, value in os.environ.items() if not name.startswith("PYTHON")}
        env["PYTHONIOENCODING"] = "utf-16"
        run = subprocess.run([sys.executable, "-S", str(HERE / "fib.py"), "--time", "50"], capture_output=True, env=env)
        self.assertEqual(run.stdout, b"12586269025\n", run.stderr)
        self.assertRegex(run.stderr, rb"\Afast \d+\.\d{3} ms\n\Z")

    def test_PERF_PY_21_les_chemins_decimal_laissent_tout_le_contexte_de_l_appelant(self):
        """PERF-PY-21 : hors catalogue, garde de l'optimisation en Decimal de fib_list et du terme (contexte exact
        local) : le contexte de l'appelant, tous champs compris (Emax, que PERF-PY-6 et 7 ne voient pas), est le même
        avant et après l'appel. L'appelant est un contexte neuf et local : sans lui, une fuite d'Emax d'un test
        précédent (PERF-PY-10 passe avant) cacherait la fuite de celui-ci."""
        for name, call in DECIMAL_PATHS:
            with self.subTest(path=name), decimal.localcontext(decimal.Context(Emax=999_999)):
                before = repr(decimal.getcontext())
                call()
                self.assertEqual(repr(decimal.getcontext()), before)

    def test_PERF_PY_22_la_liste_s_ecrit_par_tranches(self):
        """PERF-PY-22 : hors catalogue, garde de l'optimisation de LINES_PER_WRITE (un write par tranche de lignes, non
        par ligne). --list 10000 écrit 10 001 lignes : au plus ⌈10 001 / 25⌉ = 401 appels à write, soit la moitié de la
        tranche (50 lignes) en marge. Le texte égale la sortie attendue, comme CLI-L06 la décrit : les 2 001 premières
        lignes de l'oracle, puis la récurrence, et un \\n final."""
        out = WriteCounter()
        with mock.patch("sys.stdout", out):
            self.assertEqual(main(["--list", "10000"]), 0)
        self.assertLessEqual(out.calls, 401)
        lines = "".join(out.chunks).split("\n")
        self.assertEqual(lines[:2001], oracle_text())
        self.assertEqual(lines[-1], "")
        terms = [int(line) for line in lines[:-1]]
        self.assertEqual(len(terms), 10001)
        self.assertEqual([i for i in range(2, len(terms)) if terms[i] != terms[i - 1] + terms[i - 2]], [])

    def test_PERF_PY_23_un_flux_standard_absent_au_lancement_ne_change_pas_le_code(self):
        """PERF-PY-23 : hors catalogue, garde du correctif de CLI-V04 (un flux à None reçoit un puits avant reconfigure),
        et non d'une optimisation; le contrat saute CLI-V04 sous Windows, où CPython met aussi un flux à None quand son
        handle est invalide (catalogue § 6). Sans le puits, reconfigure lève AttributeError avant main : code 1.
        stderr absent : stdout et le code sont ceux de F1 et de F9. stdout absent (hors contrat, effet de bord du
        correctif) : le code reste 2, avec une seule ligne fib: sur stderr, en ASCII. L'autre flux est hostile
        (run_main_block), comme sous Windows. Un flux hostile mis à None reste référencé par HOSTILE : sans cela, son
        finaliseur ferme le BufferedWriter qu'il partage avec sys.__stdout__ ou sys.__stderr__, et la trace d'une
        exception du bloc, écrite sur le vrai stderr, se perd (ValueError) : ce rouge n'aurait plus de diagnostic."""
        for args, out, code in ((["10"], b"55\n", 0), (["--bogus", "5"], b"", 2)):
            with self.subTest(absent="stderr", args=args):
                run = run_main_block(args, ["stderr"])
                self.assertEqual((run.stdout, run.returncode), (out, code), run.stderr)
        with self.subTest(absent="stdout", args=["--bogus", "5"]):
            run = run_main_block(["--bogus", "5"], ["stdout"])
            self.assertEqual(run.returncode, 2, run.stderr)
            self.assertRegex(run.stderr, rb"\Afib: [ -~]*\n\Z")
        with self.subTest(absent="les deux flux, après HOSTILE"):
            probe = HOSTILE + "sys.stdout = sys.stderr = None\n" + "".join(
                f"sys.__{name}__.write('{name}\\n'); sys.__{name}__.flush()\n" for name in ("stdout", "stderr")
            )
            run = subprocess.run([sys.executable, "-I", "-S", "-c", probe], capture_output=True)
            self.assertEqual((run.stdout, run.stderr, run.returncode), (b"stdout\n", b"stderr\n", 0))

    def test_PERF_PY_24_le_lancement_normal_de_la_cli_n_ajoute_pas_os_au_demarrage_nu(self):
        """PERF-PY-24 : hors catalogue, garde de l'optimisation de l'import os paresseux du bloc __main__ (2,5 ms de
        démarrage sous -S, PRD § 5) : seul un flux absent le paie. PERF-PY-8 et 17 passent par fib.main via -c et ne
        voient jamais ce bloc. Lancement du contrat, python -I -S fib.py 10, avec les flux ouverts : os ne doit pas
        figurer parmi les modules que la CLI ajoute à ceux du démarrage nu, python -I -S -c pass. Si une plateforme
        charge os dès ce démarrage (non vérifié hors de Linux, CPython 3.13), l'import paresseux n'y coûte rien et le
        test est sauté, non rouge. Témoin : le même rapport sur `import os` nomme os, sinon un autre format de
        -X importtime rendrait la garde aveugle."""
        _, witness = importtime_modules("-c", "import os")
        self.assertIn("os", witness)
        _, bare = importtime_modules("-c", "pass")
        if "os" in bare:
            self.skipTest("os est chargé au démarrage nu sous -I -S : l'import paresseux n'y coûte rien")
        run, names = importtime_modules(str(FIB), "10")
        self.assertEqual(run.stdout, b"55\n")
        self.assertNotIn("os", names - bare)

    def test_PERF_PY_25_decimal_est_deja_charge_quand_le_chronometre_demarre_par_list_fast_et_matrix(self):
        """PERF-PY-25 : hors catalogue, garde de l'optimisation du préchargement de decimal par compute, hors du
        chronomètre (sans lui, la ligne --time de fast à 170 000 passe de 5,8 à 10,4 ms : médiane de 21 lancements de
        python -I -S, CPython 3.13, 2026-10-13; npm run bench n'a pas ce scénario). Un interpréteur neuf espionne
        time.perf_counter (SPY_PRELUDE) : decimal doit être chargé avant chaque chronomètre, par --list et par un
        terme en Decimal, et rester absent des entrées qui n'en servent pas. Mutants rouges : import retiré, déplacé
        dans la fenêtre, limité à as_list ou à use_decimal, paresseux (LazyLoader); n > 100_000, iterative oublié.
        Dépend de _decimal, l'accélérateur C des CPython officiels : sans lui (repli sur _pydecimal), des conversions
        int et str chargent _pylong dans la fenêtre, et la garde rougit à tort."""
        run, report = clock_reads_with_decimal(SPY_WITNESS)
        self.assertEqual((run.returncode, report), (0, "001/6"), run.stderr)
        cases = (
            # les bornes de chaque chemin, avec --time, la ligne que le préchargement protège
            ["--time", "--list", "0"],
            ["--time", "--list", str(MAX_LIST)],
            ["--time", str(DECIMAL_FROM)],
            ["--time", str(MAX_TERM)],
            ["--time", "--algo", "matrix", str(DECIMAL_FROM)],
            ["--time", "--algo", "matrix", str(MAX_TERM)],
            # des points impairs et intérieurs : les bornes sont toutes paires et multiples de 10
            ["--time", "--list", "1"],
            ["--time", str(DECIMAL_FROM + 1)],
            ["--time", "--algo", "matrix", str(MAX_TERM - 1)],
            # sans --time : compute chronomètre aussi sans lui
            ["--list", "10"],
            [str(DECIMAL_FROM)],
            ["--algo", "matrix", str(DECIMAL_FROM)],
        )
        for args in cases:
            with self.subTest(args=args):
                run, report = clock_reads_with_decimal(SPY_CLI, *args)
                self.assertEqual(run.returncode, 0, run.stderr)
                marks, _, reads = report.partition("/")
                self.assertRegex(marks, r"\A1+\Z", f"rapport brut {report!r} (marques/lectures), {reads} lectures")
        # l'autre côté de la condition : ces entrées calculent en int, decimal ne doit pas se charger pour elles
        for args in (
            ["--algo", "fast", str(DECIMAL_FROM - 1)],
            ["--algo", "matrix", str(DECIMAL_FROM - 1)],
            ["--algo", "iterative", str(DECIMAL_FROM)],
            ["--algo", "all", str(DECIMAL_FROM)],
        ):
            with self.subTest(sans_decimal=args):
                self.assert_no_heavy_import(args)

    def test_PERF_PY_26_si_un_algorithme_discorde_all_rend_3_sans_stdout_ni_duree(self):
        """PERF-PY-26 : hors catalogue, garde de F3 (code 3, stdout vide, une seule ligne fib: sans durée même avec
        --time). Aucun cas CLI ne peut provoquer une discordance (catalogue § 6) : _ALGOS reçoit, tour à tour pour
        chacun des trois algorithmes de COMPARISON, une entrée qui rend le vrai terme plus 1, et le test ne recalcule
        aucun terme. Mutants rouges : prédicat aveugle, any(t != t ...) (P1), ou partiel, terms[:2] (P2); CliError sans
        le code 3 (P3); return 2 en dur dans main (P4); des durées dans le message, une par ligne (P5) ou sur sa ligne
        (P5b); compute qui écrit les durées sur stderr (P6) ou le terme sur stdout (P7) avant l'erreur; un seul
        algorithme calculé par fast (P9). Elle suppose que _ALGOS reste le seul aiguillage des algorithmes : P8n, une
        fib() qui aiguille sans la table, la rougit à tort (bruyant, jamais silencieux)."""
        for bad in COMPARISON:
            with self.subTest(bad=bad), algorithms(one_more(bad)):
                code, out, err = main_captured(["--time", "--algo", "all", "10"])
                self.assertEqual(code, 3)
                self.assertEqual(out.calls, 0, f"stdout a reçu {out.chunks!r}")
                self.assertEqual(err.calls, 1, f"stderr a reçu {err.chunks!r}")
                self.assertRegex(err.chunks[0], r"\Afib: [^\n]*\n\Z")
                self.assertNotRegex(err.chunks[0], r"\d\.\d{3} ms")

    def test_PERF_PY_27_l_algorithme_nomme_s_execute_et_porte_sa_ligne_de_duree_en_int_comme_en_decimal(self):
        """PERF-PY-27 : hors catalogue, garde de F2 et de F6 : l'algorithme nommé s'exécute, et chaque ligne --time
        porte le nom de l'algorithme qu'elle a chronométré, dans l'ordre. Le contrat ne voit pas l'un sans l'autre :
        les trois algorithmes rendent le même terme. Un espion dans _ALGOS note le nom puis délègue; les noms notés
        sont ceux des lignes de durée, qui sont ceux de EXECUTED, en int (10 : défaut, iterative, matrix, all) puis sur
        le chemin Decimal (DECIMAL_FROM : défaut, matrix). Mutants rouges : un seul algorithme calculé par fast (P9);
        sur le chemin Decimal, matrix calculé par fast, dans compute (P10) puis dans _fib_decimal (P11). Elle suppose
        que _ALGOS reste le seul aiguillage des algorithmes : deux refactorisations neutres la rougissent à tort
        (bruyant, jamais silencieux), P8n, fib() qui aiguille sans la table, et P12n, le chemin Decimal sans la
        table."""
        for args, algos in EXECUTED:
            noted = []
            with self.subTest(args=args), algorithms(spying(noted)):
                code, _, err = main_captured(["--time", *args])
                self.assertEqual(code, 0, f"stderr a reçu {err.chunks!r}")
                durations = "".join(err.chunks)
                self.assertRegex(durations, r"\A(?:\w+ \d+\.\d{3} ms\n)+\Z")
                lines = [line.split()[0] for line in durations.splitlines()]
                self.assertEqual(lines, algos, "les lignes de durée")
                self.assertEqual(noted, lines, "les algorithmes exécutés")

    def test_PERF_PY_28_un_terme_en_decimal_s_ecrit_sans_jamais_devenir_un_int(self):
        """PERF-PY-28 : hors catalogue, garde de l'optimisation du terme en Decimal : de DECIMAL_FROM à MAX_TERM, fast ou
        matrix seul se calcule et s'écrit en Decimal, par le str() linéaire, sans qu'un int soit converti ni écrit.
        Trois signaux, dans un interpréteur neuf (PERF-PY-5 a déjà chargé _pylong ici) lancé par run_fib, à des indices
        des deux côtés de F(288 000) : un int s'écrirait par les tranches de _text (divmod, quadratique) jusqu'à
        STR_FROM_BITS bits, puis par str(), qui importe _pylong (10 ms, PRD § 5); un int converti par Decimal(int),
        conversion binaire → décimale quadratique que _fib_decimal dit éviter, ne passe ni par l'un ni par l'autre.
        Le divmod de fib est donc espionné, _pylong ne doit pas se charger, et Decimal espionne tout int de plus de 64
        bits (_exact_decimal importe Decimal à l'appel : kind et tout Decimal(int) de fib passent par l'espion). Le
        texte est le même par les deux chemins, d'où cette garde : PERF-PY-10 à 12 ne voient pas la conversion, et
        PERF-PY-13 n'espionne que l'appel de _fib_decimal à DECIMAL_FROM. Mutants rouges : _fib_decimal qui rend
        int(...) (B-W3), compute qui écrit _text(int(terms[0])) (B-W2), _text qui convertit un Decimal en int puis le découpe
        (B-W1) ou l'écrit par str(int(x)) (B-W5), une bande d'indices sans Decimal, de 200 000 à 900 000 (B-R9) ou de
        170 002 à 288 000 (B-R10), compute qui appelle fib() pour tout terme (B-C1, que PERF-PY-13 rougit déjà),
        _fib_decimal qui calcule en int puis convertit, Decimal(_ALGOS[algo](n)) (X-INT2DEC) ou Decimal(fib(n, algo))
        (X-INT2DEC-FIB, la simplification qui retire kind des algorithmes), fast qui calcule en int et rend kind(...)
        (X-FAST-KIND-END). Témoin : les trois signaux répondent sur un int; sans lui, la garde serait aveugle sous une
        version de CPython qui change l'un d'eux. Il rougit si les tranches cessent d'appeler divmod (G-1,
        x // base, x % base) ou si _exact_decimal lie Decimal avant l'espion (W-BLIND, from decimal import ... en tête
        de module). Comme PERF-PY-25, dépend de _decimal et de _pylong, ceux des CPython officiels 3.12+."""
        # le premier divmod des tranches termine l'interpréteur, code 1, avec ce message sur stderr
        spy = "fib.divmod = lambda a, b: sys.exit('tranches de _text')\n"
        # idem pour Decimal(int) : les constantes 0 et 1 des algorithmes tiennent sous 64 bits, un terme jamais
        convert_spy = (
            "import decimal\n"
            "D = decimal.Decimal\n"
            "class Spy(D):\n"
            "    def __new__(cls, value='0', context=None):\n"
            "        if type(value) is int and value.bit_length() > 64:\n"
            "            sys.exit('int converti en Decimal')\n"
            "        return D(value, context)\n"
            "decimal.Decimal = Spy\n"
        )
        witness = run_fib(
            "assert '_pylong' not in sys.modules\n"
            # signal de str() : un int de plus de STR_FROM_BITS bits charge _pylong
            "fib._text(1 << (fib.STR_FROM_BITS + 1))\n"
            "assert '_pylong' in sys.modules\n"
            # signal des tranches : un int plus court appelle divmod
            + spy
            + "fib._text(10**2000)\n"
        )
        self.assertEqual((witness.returncode, witness.stderr), (1, "tranches de _text\n"))
        # signal de Decimal(int) : le Decimal que rend _exact_decimal est l'espion
        witness = run_fib(convert_spy + "fib._exact_decimal()[0](1 << 100)\n")
        self.assertEqual((witness.returncode, witness.stderr), (1, "int converti en Decimal\n"))
        for args in (
            [str(DECIMAL_FROM)],
            ["--algo", "matrix", str(DECIMAL_FROM)],
            # intérieur de la sous-plage des tranches (F(250 001) compte 173 561 bits), puis juste au-delà de F(288 000)
            # (F(300 001) en compte 208 273)
            ["250001"],
            ["300001"],
            [str(MAX_TERM)],
            ["--algo", "matrix", str(MAX_TERM)],
        ):
            with self.subTest(args=args):
                run = run_fib(
                    convert_spy + spy + "assert fib.main(sys.argv[2:]) == 0\nassert '_pylong' not in sys.modules\n",
                    *args,
                )
                self.assertEqual(run.returncode, 0, run.stderr)

    def test_PERF_PY_29_des_flux_utf_16_en_crlf_sortent_en_ascii_et_en_lf(self):
        """PERF-PY-29 : hors catalogue, garde du correctif F10 (fin de ligne \\n quel que soit l'environnement), et non
        d'une optimisation. Le contrat ne la voit que sous Windows : sous Linux, CPython écrit déjà \\n, donc
        newline="\\n" retiré, ou limité à stdout ou à stderr, y reste vert, y compris sous PERF-PY-20. Le bloc
        __main__ tourne sur deux flux hostiles (run_main_block) : stdout, stderr et le code sont ceux du contrat, en
        ASCII et sans \\r. Témoin : les mêmes flux, sans fib.py, écrivent de l'UTF-16 en \\r\\n, sinon la garde
        serait aveugle; il rougit si HOSTILE n'installe plus ses flux. Mutants rouges : newline="\\n" retiré, limité à
        stdout, limité à stderr (PERF-PY-23 rougit aussi sous chacun, et sous le deuxième par son seul regex [ -~]).
        Le mutant encoding="utf-8" reste vert : il est équivalent, la CLI n'écrit que de l'ASCII."""
        probe = HOSTILE + "sys.stdout.write('a\\n'); sys.stderr.write('b\\n')\n"
        witness = subprocess.run([sys.executable, "-I", "-S", "-c", probe], capture_output=True)
        # sur un tube, l'encodeur n'écrit pas de BOM : l'UTF-16 se reconnaît au décodage
        self.assertEqual((witness.stdout.decode("utf-16"), witness.stderr.decode("utf-16")), ("a\r\n", "b\r\n"))
        for args, out, err, code in (
            (["--list", "3"], "".join(f"{term}\n" for term in oracle_text()[:4]), rb"\A\Z", 0),
            (["--time", "50"], f"{oracle_text()[50]}\n", rb"\Afast \d+\.\d{3} ms\n\Z", 0),
            (["--bogus", "5"], "", rb"\Afib: [ -~]*\n\Z", 2),
        ):
            with self.subTest(args=args):
                run = run_main_block(args)
                self.assertEqual((run.stdout, run.returncode), (out.encode("ascii"), code), run.stderr)
                self.assertRegex(run.stderr, err)


if __name__ == "__main__":
    unittest.main()
