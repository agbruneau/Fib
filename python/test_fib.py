"""Seam 1 : la bibliothèque. Les attendus viennent de l'oracle (contracts/b000045.txt) ou de faits mathématiques."""
import unittest
from functools import cache
from pathlib import Path

from fib import fib, fib_list

ALGOS = ("iterative", "matrix", "fast")
ORACLE = Path(__file__).resolve().parent.parent / "contracts" / "b000045.txt"
REFUSED = ((-1, ValueError), (1.5, TypeError), (float("nan"), TypeError), (0.0, TypeError))


@cache
def oracle():
    """F(0) … F(2000), lus à l'exécution dans l'oracle.
    Toute anomalie lève une exception : le test échoue au lieu de passer."""
    terms = []
    for line in ORACLE.read_text(encoding="ascii").splitlines():
        if line.strip():
            index, term = line.split()
            if int(index) != len(terms):
                raise AssertionError(f"oracle invalide : indice {index} à la place de {len(terms)}")
            terms.append(int(term))
    if len(terms) != 2001:
        raise AssertionError(f"oracle invalide : 2 001 termes attendus, {len(terms)} lus")
    return terms


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
        self.assertEqual(fib_list(0), oracle()[:1])

    def test_BIB_11_fib_list_1_contient_f0_et_f1(self):
        self.assertEqual(fib_list(1), oracle()[:2])

    def test_BIB_12_fib_list_2000_suit_l_oracle(self):
        self.assertEqual(fib_list(2000), oracle())

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


if __name__ == "__main__":
    unittest.main()
