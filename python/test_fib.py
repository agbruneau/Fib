"""Seam 1 : la bibliothèque. Les attendus viennent de l'oracle (contracts/b000045.txt) ou de faits mathématiques.
Les gardes PERF-PY-n, hors seams (ADR-0004), protègent les optimisations que les cas BIB et CLI ne visent pas."""
import decimal
import math
import subprocess
import sys
import unittest
from functools import cache
from pathlib import Path
from unittest import mock

from fib import DECIMAL_FROM, STR_FROM_BITS, _fib_decimal, _text, compute, fib, fib_list

ALGOS = ("iterative", "matrix", "fast")
HERE = Path(__file__).resolve().parent
ORACLE = HERE.parent / "contracts" / "b000045.txt"
REFUSED = ((-1, ValueError), (1.5, TypeError), (float("nan"), TypeError), (0.0, TypeError))
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


class TestFib(unittest.TestCase):
    def test_BIB_01_fib_0_iterative_vaut_0(self):
        self.assertEqual(fib(0, "iterative"), oracle()[0])

    def test_BIB_02_fib_1_iterative_vaut_1(self):
        self.assertEqual(fib(1, "iterative"), oracle()[1])

    def test_BIB_03_fib_2_iterative_vaut_1(self):
        self.assertEqual(fib(2, "iterative"), oracle()[2])

    def test_BIB_04_fib_10_iterative_vaut_55(self):
        self.assertEqual(fib(10, "iterative"), oracle()[10])

    def test_BIB_05_iterative_suit_l_oracle_de_0_a_2000(self):
        self.assertEqual([fib(n, "iterative") for n in range(2001)], oracle())

    def test_BIB_06_fast_suit_l_oracle_de_0_a_2000(self):
        self.assertEqual([fib(n, "fast") for n in range(2001)], oracle())

    def test_BIB_07_matrix_suit_l_oracle_de_0_a_2000(self):
        self.assertEqual([fib(n, "matrix") for n in range(2001)], oracle())

    def test_BIB_08_les_trois_algorithmes_concordent_a_100000(self):
        want = fib(100000, "fast")
        for algo in ("iterative", "matrix"):
            with self.subTest(algo=algo):
                self.assertEqual(fib(100000, algo), want)
        self.assertEqual(len(str(want)), 20899)

    def test_BIB_09_cassini_a_100000(self):
        for algo in ALGOS:
            with self.subTest(algo=algo):
                before, at, after = (fib(n, algo) for n in (99999, 100000, 100001))
                self.assertEqual(before * after - at**2, 1)

    def test_BIB_10_fib_list_0_ne_contient_que_f0(self):
        self.assertEqual(fib_list(0), oracle_text()[:1])

    def test_BIB_11_fib_list_1_contient_f0_et_f1(self):
        self.assertEqual(fib_list(1), oracle_text()[:2])

    def test_BIB_12_fib_list_2000_suit_l_oracle(self):
        self.assertEqual(fib_list(2000), oracle_text())

    def test_BIB_13_un_algorithme_inconnu_est_refuse(self):
        for algo in ("all", "bogus", "", "FAST"):
            with self.subTest(algo=algo), self.assertRaises(ValueError):
                fib(5, algo)

    def test_BIB_14_un_indice_negatif_ou_non_entier_est_refuse(self):
        for n, error in REFUSED:
            for algo in ALGOS:
                with self.subTest(n=n, algo=algo), self.assertRaises(error):
                    fib(n, algo)
            with self.subTest(n=n, algo="fib_list"), self.assertRaises(error):
                fib_list(n)

    def test_PERF_PY_1_le_texte_par_tranches_de_10_puissance_k_garde_les_zeros(self):
        # hors catalogue : garde de l'optimisation du texte décimal par tranches de CHUNK_DIGITS chiffres
        # (les attendus s'écrivent sans conversion : 10**k est un 1 suivi de k zéros)
        for k in (1, 999, 1000, 1001, 2000, 2500):
            with self.subTest(k=k):
                self.assertEqual(_text(10**k), "1" + "0" * k)

    def test_PERF_PY_2_le_texte_par_tranches_de_10_puissance_k_moins_1_garde_les_neuf(self):
        # hors catalogue : garde de l'optimisation du texte décimal par tranches, aux frontières de tranche
        for k in (1, 999, 1000, 1001, 2000, 2500):
            with self.subTest(k=k):
                self.assertEqual(_text(10**k - 1), "9" * k)

    def test_PERF_PY_3_une_tranche_de_zeros_entre_deux_uns_est_conservee(self):
        # hors catalogue : garde de l'optimisation du texte décimal par tranches (une tranche entièrement nulle)
        self.assertEqual(_text(10**2000 + 1), "1" + "0" * 1999 + "1")

    def test_PERF_PY_4_des_zeros_entre_deux_tranches_sont_conserves(self):
        # hors catalogue : garde de l'optimisation du texte décimal par tranches (une tranche aux zéros de tête)
        self.assertEqual(_text(10**2000 + 10**1000), "1" + "0" * 999 + "1" + "0" * 1000)

    def test_PERF_PY_5_le_texte_par_tranches_egale_str_a_100000(self):
        # hors catalogue : garde de l'optimisation du texte décimal par tranches, face à la conversion native
        term = fib(100000, "fast")
        self.assertEqual(_text(term), str(term))

    def test_PERF_PY_6_les_chemins_decimal_laissent_l_objet_contexte_decimal_de_l_appelant(self):
        # hors catalogue : garde de l'optimisation en Decimal de fib_list et du terme (contexte exact local)
        for name, call in DECIMAL_PATHS:
            with self.subTest(path=name):
                before = decimal.getcontext()
                call()
                self.assertIs(decimal.getcontext(), before)

    def test_PERF_PY_7_les_chemins_decimal_laissent_la_precision_decimale_de_l_appelant(self):
        # hors catalogue : garde de l'optimisation en Decimal de fib_list et du terme (contexte exact local)
        for name, call in DECIMAL_PATHS:
            with self.subTest(path=name):
                prec = decimal.getcontext().prec
                call()
                self.assertEqual(decimal.getcontext().prec, prec)

    def test_PERF_PY_8_un_terme_a_100000_n_importe_ni_re_ni_decimal_ni_pylong(self):
        # hors catalogue : garde de l'optimisation du démarrage (CLI lancée comme le contrat : python -I -S);
        # dépend des modules que charge CPython 3.12+ : une version qui en importe un de plus la fait échouer.
        code = (
            "import sys; sys.path.insert(0, sys.argv[1]); import fib\n"
            "assert fib.main(['--algo', 'all', '100000']) == 0\n"
            "assert not {'re', 'decimal', '_pylong'} & set(sys.modules), sorted(sys.modules)"
        )
        run = subprocess.run([sys.executable, "-I", "-S", "-c", code, str(HERE)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)

    def test_PERF_PY_9_un_terme_en_decimal_suit_l_oracle_de_0_a_2000(self):
        # hors catalogue : garde de l'optimisation du terme calculé en Decimal (contexte exact, str() linéaire)
        for algo in ("fast", "matrix"):
            with self.subTest(algo=algo):
                self.assertEqual([str(_fib_decimal(n, algo)) for n in range(2001)], oracle_text())

    def test_PERF_PY_10_un_terme_aux_abords_du_seuil_decimal_a_le_bon_nombre_de_chiffres(self):
        # hors catalogue : garde de l'optimisation du terme en Decimal, face à ⌊n·log₁₀φ − log₁₀√5⌋ + 1 chiffres
        for n, algo, path, text in big_terms():
            with self.subTest(n=n, algo=algo, path=path):
                self.assertEqual(len(text), digit_count(n))

    def test_PERF_PY_11_un_terme_aux_abords_du_seuil_decimal_est_congru_a_f_de_n_mod_3072_modulo_2048(self):
        # hors catalogue : garde de l'optimisation du terme en Decimal, face à l'oracle (2048 divise 10**11 : les onze
        # derniers chiffres suffisent; la période de Pisano de 2048 vaut 3072)
        for n, algo, path, text in big_terms():
            with self.subTest(n=n, algo=algo, path=path):
                self.assertEqual(int(text[-11:]) % 2048, oracle()[n % 3072] % 2048)

    def test_PERF_PY_12_un_terme_aux_abords_du_seuil_decimal_est_congru_a_f_de_n_mod_1500_modulo_1000(self):
        # hors catalogue : garde de l'optimisation du terme en Decimal, face à l'oracle (1000 divise 10**3 : les trois
        # derniers chiffres suffisent; la période de Pisano de 1000 vaut 1500)
        for n, algo, path, text in big_terms():
            with self.subTest(n=n, algo=algo, path=path):
                self.assertEqual(int(text[-3:]) % 1000, oracle()[n % 1500] % 1000)

    def test_PERF_PY_13_compute_passe_par_le_chemin_decimal_des_decimal_from_pour_fast_et_matrix_seuls(self):
        # hors catalogue : garde de l'optimisation du seuil DECIMAL_FROM (int en deçà, Decimal dès le seuil, sauf avec
        # iterative, seul ou parmi all)
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
        # hors catalogue : garde de l'optimisation de STR_FROM_BITS (tranches en deçà, str() au-delà). 10**k compte
        # ⌊k·log₂10⌋ + 1 bits : k = ⌊STR_FROM_BITS·log₁₀2⌋ = 60 205 en compte 199 997, k + 1 = 60 206 en compte 200 001.
        below = int(STR_FROM_BITS * math.log10(2))
        for k in (below, below + 1):
            for x, want in ((10**k - 1, "9" * k), (10**k + 1, "1" + "0" * (k - 1) + "1")):
                with self.subTest(k=k, bits=x.bit_length()):
                    self.assertEqual(_text(x), want)

    def test_PERF_PY_15_un_terme_en_decimal_refuse_iterative_et_un_algorithme_inconnu(self):
        # hors catalogue : garde de l'optimisation du terme en Decimal (_iterative n'accepte pas kind)
        for algo in ("iterative", "all", "bogus", ""):
            with self.subTest(algo=algo), self.assertRaises(ValueError):
                _fib_decimal(5, algo)

    def test_PERF_PY_16_un_terme_en_decimal_refuse_un_indice_negatif_ou_non_entier(self):
        # hors catalogue : garde de l'optimisation du terme en Decimal (même refus que fib())
        for n, error in REFUSED:
            for algo in ("fast", "matrix"):
                with self.subTest(n=n, algo=algo), self.assertRaises(error):
                    _fib_decimal(n, algo)


if __name__ == "__main__":
    unittest.main()
