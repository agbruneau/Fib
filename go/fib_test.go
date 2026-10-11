// Seam 1 : la bibliothèque. Les attendus viennent de l'oracle (contracts/b000045.txt) ou de faits mathématiques.
package fib_test

import (
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"fib"
)

var (
	cached     []*big.Int // l'oracle, lu une fois (les tests ne sont pas parallèles)
	cachedText []string   // les mêmes termes, tels qu'écrits dans le fichier
)

var algos = []string{"iterative", "matrix", "fast"}

// oracle rend F(0) … F(2000) lus dans contracts/b000045.txt, en entiers puis en texte décimal.
// Les attendus ne sont jamais recalculés ici.
// Un oracle absent, mal formé ou sans exactement 2 001 termes fait échouer le test qui l'utilise.
func oracle(t *testing.T) ([]*big.Int, []string) {
	t.Helper()
	if cached != nil {
		return cached, cachedText
	}
	data, err := os.ReadFile(filepath.Join("..", "contracts", "b000045.txt"))
	if err != nil {
		t.Fatalf("oracle illisible : %v", err)
	}
	var terms []*big.Int
	var texts []string
	for line := range strings.SplitSeq(string(data), "\n") {
		if line == "" {
			continue
		}
		index, digits, _ := strings.Cut(line, " ")
		term, ok := new(big.Int).SetString(digits, 10)
		if index != strconv.Itoa(len(terms)) || !ok {
			t.Fatalf("oracle mal formé à la ligne %q", line)
		}
		terms = append(terms, term)
		texts = append(texts, digits)
	}
	if len(terms) != 2001 {
		t.Fatalf("oracle : %d termes, attendu 2001", len(terms))
	}
	cached, cachedText = terms, texts
	return terms, texts
}

// mustFib rend Fib(n, algo), ou arrête le test.
func mustFib(t *testing.T, n int, algo string) *big.Int {
	t.Helper()
	got, err := fib.Fib(n, algo)
	if err != nil {
		t.Fatal(err)
	}
	return got
}

// check compare Fib(n, algo) au terme n de l'oracle.
func check(t *testing.T, n int, algo string) {
	t.Helper()
	terms, _ := oracle(t)
	want := terms[n]
	got := mustFib(t, n, algo)
	if got.Cmp(want) != 0 {
		t.Errorf("Fib(%d, %s) = %v, attendu %v", n, algo, got, want)
	}
}

// BIB-01 à BIB-04 : les premiers termes par l'itératif.
func TestBIB01a04_IterativePremiersTermes(t *testing.T) {
	for _, c := range []struct {
		id string
		n  int
	}{{"BIB-01", 0}, {"BIB-02", 1}, {"BIB-03", 2}, {"BIB-04", 10}} {
		t.Run(fmt.Sprintf("%s : Fib(%d, iterative) vaut le terme de l'oracle", c.id, c.n), func(t *testing.T) {
			check(t, c.n, "iterative")
		})
	}
}

// BIB-05 à BIB-07 : chaque algorithme égale l'oracle de 0 à 2000. Le balayage franchit int64 et uint64 (92 à 94).
func TestBIB05a07_BalayageContreOracle(t *testing.T) {
	oracle(t) // un oracle absent arrête le balayage ici, au lieu de produire 6 000 échecs identiques
	for _, c := range []struct{ id, algo string }{{"BIB-05", "iterative"}, {"BIB-06", "fast"}, {"BIB-07", "matrix"}} {
		for n := 0; n <= 2000; n++ {
			t.Run(fmt.Sprintf("%s : Fib(%d, %s) vaut le terme de l'oracle", c.id, n, c.algo), func(t *testing.T) {
				check(t, n, c.algo)
			})
		}
	}
}

// BIB-08 : les trois algorithmes rendent le même terme pour n = 100 000, qui compte 20 899 chiffres.
func TestBIB08_LesAlgorithmesConcordentA100000(t *testing.T) {
	reference := mustFib(t, 100000, "iterative")
	t.Run("BIB-08 : Fib(100000, iterative) compte 20899 chiffres", func(t *testing.T) {
		if got := len(reference.String()); got != 20899 {
			t.Errorf("Fib(100000, iterative) compte %d chiffres, attendu 20899", got)
		}
	})
	for _, algo := range []string{"matrix", "fast"} {
		t.Run(fmt.Sprintf("BIB-08 : Fib(100000, %s) égale Fib(100000, iterative)", algo), func(t *testing.T) {
			if got := mustFib(t, 100000, algo); got.Cmp(reference) != 0 {
				t.Errorf("Fib(100000, %s) diffère de Fib(100000, iterative)", algo)
			}
		})
	}
}

// BIB-09 : identité de Cassini, F(n-1)·F(n+1) - F(n)² = (-1)^n, pour n = 100 000.
func TestBIB09_CassiniAutourDe100000(t *testing.T) {
	for _, algo := range algos {
		t.Run(fmt.Sprintf("BIB-09 : Cassini avec %s", algo), func(t *testing.T) {
			before, at, after := mustFib(t, 99999, algo), mustFib(t, 100000, algo), mustFib(t, 100001, algo)
			cassini := new(big.Int).Mul(before, after)
			cassini.Sub(cassini, new(big.Int).Mul(at, at))
			if cassini.Cmp(big.NewInt(1)) != 0 {
				t.Errorf("F(99999)·F(100001) - F(100000)² = %v, attendu 1", cassini)
			}
		})
	}
}

// BIB-10 à BIB-12 : FibList(n) égale, en chaînes décimales, les n + 1 premiers termes de l'oracle, dans l'ordre.
func TestBIB10a12_FibListEgaleLOracle(t *testing.T) {
	for _, c := range []struct {
		id string
		n  int
	}{{"BIB-10", 0}, {"BIB-11", 1}, {"BIB-12", 2000}} {
		t.Run(fmt.Sprintf("%s : FibList(%d) vaut les %d premiers termes de l'oracle", c.id, c.n, c.n+1), func(t *testing.T) {
			_, texts := oracle(t)
			want := texts[:c.n+1]
			got, err := fib.FibList(c.n)
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != len(want) {
				t.Fatalf("FibList(%d) a %d termes, attendu %d", c.n, len(got), len(want))
			}
			for i := range want {
				if got[i] != want[i] {
					t.Fatalf("FibList(%d)[%d] = %s, attendu %s", c.n, i, got[i], want[i])
				}
			}
		})
	}
}

// PERF-1, hors catalogue : garde de l'optimisation de FibList, l'additionneur décimal en base 10^18 (retenue aux
// frontières de limbe, zéros de remplissage, formatage par quadruplets), au-delà des 2 001 termes de l'oracle et jusqu'à
// la borne (10 000). L'attendu vient d'un autre chemin : le doublement rapide, puis la conversion décimale de math/big.
func TestPERF1_FibListAuDelaDeLOracle(t *testing.T) {
	list, err := fib.FibList(10000)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 10001 {
		t.Fatalf("FibList(10000) a %d termes, attendu 10001", len(list))
	}
	for k, got := range list {
		if want := mustFib(t, k, "fast").String(); got != want {
			t.Fatalf("FibList(10000)[%d] = %s, attendu %s", k, got, want)
		}
	}
}

// PERF-2, hors catalogue : garde de l'optimisation de FibList qui réserve les limbes d'avance, pour chaque n. De 0 à 300,
// les termes franchissent plusieurs fois la frontière d'un limbe : une réserve trop juste ferait paniquer, une retenue
// perdue changerait le dernier terme.
func TestPERF2_FibListReserveDeLimbes(t *testing.T) {
	_, texts := oracle(t)
	for n := 0; n <= 300; n++ {
		list, err := fib.FibList(n)
		if err != nil {
			t.Fatal(err)
		}
		if len(list) != n+1 || list[n] != texts[n] {
			t.Fatalf("FibList(%d) a %d termes, dernier %q, attendu %q", n, len(list), list[len(list)-1], texts[n])
		}
	}
}

// PERF-3, hors catalogue : garde de l'optimisation d'iterative et de FibList, l'addition sur place dans des tampons
// réservés d'emblée. Quelques allocations suffisent; une par pas, le défaut de la forme (a, b) ← (b, a + b) avec un
// entier neuf, en ferait des milliers. Un chronomètre serait instable; ce compte est exact.
func TestPERF3_IterativeNAllouePasParPas(t *testing.T) {
	const most = 12 // observé : 6 ou moins; la marge absorbe les changements d'allocation de la chaîne d'outils
	if got := testing.AllocsPerRun(3, func() { mustFib(t, 20000, "iterative") }); got > most {
		t.Errorf("Fib(20000, iterative) alloue %v fois, attendu %d au plus", got, most)
	}
	if got := testing.AllocsPerRun(3, func() { fib.FibList(5000) }); got > most {
		t.Errorf("FibList(5000) alloue %v fois, attendu %d au plus", got, most)
	}
}

// BIB-13 : Fib refuse tout nom qui n'est pas exactement iterative, matrix ou fast.
// `all` est la comparaison de la CLI, pas un algorithme.
func TestBIB13_AlgorithmeInconnuEstRefuse(t *testing.T) {
	for _, algo := range []string{"all", "bogus", "", "FAST"} {
		t.Run(fmt.Sprintf("BIB-13 : Fib(5, %q) est refusé", algo), func(t *testing.T) {
			if got, err := fib.Fib(5, algo); err == nil {
				t.Errorf("Fib(5, %q) = %v, attendu une erreur", algo, got)
			}
		})
	}
}

// BIB-14 : un indice négatif est refusé (l'indice est un int signé, donc 1.5 et NaN ne peuvent pas être passés).
func TestBIB14_IndiceNegatifEstRefuse(t *testing.T) {
	for _, algo := range algos {
		t.Run(fmt.Sprintf("BIB-14 : Fib(-1, %s) est refusé", algo), func(t *testing.T) {
			if got, err := fib.Fib(-1, algo); err == nil {
				t.Errorf("Fib(-1, %s) = %v, attendu une erreur", algo, got)
			}
		})
	}
	t.Run("BIB-14 : FibList(-1) est refusé", func(t *testing.T) {
		if got, err := fib.FibList(-1); err == nil {
			t.Errorf("FibList(-1) = %v, attendu une erreur", got)
		}
	})
}
