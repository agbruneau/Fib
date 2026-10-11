"""Seam 1 : la bibliothèque. Les attendus viennent de l'oracle (contracts/b000045.txt) ou de faits mathématiques."""
import decimal
import subprocess
import sys
import unittest
from functools import cache
from pathlib import Path

from fib import _text, fib, fib_list

ALGOS = ("iterative", "matrix", "fast")
HERE = Path(__file__).resolve().parent
ORACLE = HERE.parent / "contracts" / "b000045.txt"
REFUSED = ((-1, ValueError), (1.5, TypeError), (float("nan"), TypeError), (0.0, TypeError))


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

    def test_PERF_PY_6_fib_list_laisse_l_objet_contexte_decimal_de_l_appelant(self):
        # hors catalogue : garde de l'optimisation de fib_list en decimal (contexte exact local)
        before = decimal.getcontext()
        fib_list(50)
        self.assertIs(decimal.getcontext(), before)

    def test_PERF_PY_7_fib_list_laisse_la_precision_decimale_de_l_appelant(self):
        # hors catalogue : garde de l'optimisation de fib_list en decimal (contexte exact local)
        prec = decimal.getcontext().prec
        fib_list(50)
        self.assertEqual(decimal.getcontext().prec, prec)

    def test_PERF_PY_8_un_terme_n_importe_ni_re_ni_decimal_ni_pylong(self):
        # hors catalogue : garde de l'optimisation du démarrage (CLI lancée comme le contrat : python -I -S);
        # dépend des modules que charge CPython 3.12+ : une version qui en importe un de plus la fait échouer.
        code = (
            "import sys; sys.path.insert(0, sys.argv[1]); import fib\n"
            "assert fib.main(['--algo', 'all', '100000']) == 0\n"
            "assert not {'re', 'decimal', '_pylong'} & set(sys.modules), sorted(sys.modules)"
        )
        run = subprocess.run([sys.executable, "-I", "-S", "-c", code, str(HERE)], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)


if __name__ == "__main__":
    unittest.main()
