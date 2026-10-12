"""Seam 1 : la bibliothèque. Les attendus viennent de l'oracle (contracts/b000045.txt) ou de faits mathématiques.
Les gardes PERF-PY-n, hors seams (ADR-0004), protègent les optimisations que les cas BIB et CLI ne visent pas
(PERF-PY-20 protège le correctif F10). Chaque test porte son identifiant en tête de sa docstring : grep BIB-05 python/."""
import decimal
import math
import os
import subprocess
import sys
import unittest
from functools import cache
from pathlib import Path
from unittest import mock

from fib import DECIMAL_FROM, STR_FROM_BITS, _fib_decimal, _text, compute, fib, fib_list, main

ALGOS = ("iterative", "matrix", "fast")
HERE = Path(__file__).resolve().parent
ORACLE = HERE.parent / "contracts" / "b000045.txt"
# True : bool hérite d'int, donc le type de l'indice l'admet, et `isinstance(n, int)` le laisserait passer.
REFUSED = ((-1, ValueError), (1.5, TypeError), (float("nan"), TypeError), (0.0, TypeError), (True, TypeError))
# Les chemins qui calculent en Decimal, chacun appelé avec un indice de 50.
DECIMAL_PATHS = (
    ("fib_list", lambda: fib_list(50)),
    ("fast", lambda: _fib_decimal(50, "fast")),
    ("matrix", lambda: _fib_decimal(50, "matrix")),
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


class TestFib(unittest.TestCase):
    def assert_no_heavy_import(self, args):
        """Lance fib.main(args) dans un processus à part, comme le contrat lance la CLI (python -I -S), puis vérifie que
        ni re, ni decimal, ni _pylong n'ont été chargés."""
        code = (
            "import sys; sys.path.insert(0, sys.argv[1]); import fib\n"
            "assert fib.main(sys.argv[2:]) == 0\n"
            "assert not {'re', 'decimal', '_pylong'} & set(sys.modules), sorted(sys.modules)"
        )
        run = subprocess.run([sys.executable, "-I", "-S", "-c", code, str(HERE), *args], capture_output=True, text=True)
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
        """PERF-PY-20 : hors catalogue, garde du correctif F10 (ASCII et fin de ligne \\n quel que soit l'environnement),
        et non d'une optimisation; le ticket du contrat ajoute ce cas au catalogue (§ 6). CLI-V03 ne peut pas le voir :
        le contrat lance python -I, qui ignore PYTHONIOENCODING. Ici, sans -I, sans les variables PYTHON* du test et
        avec PYTHONIOENCODING=utf-16 : sans reconfigure(encoding="ascii"), la sortie passerait en UTF-16."""
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


if __name__ == "__main__":
    unittest.main()
