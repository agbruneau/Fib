package fib_test

import (
	"errors"
	"fmt"
	"io/fs"
	"math/big"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"fib"
)

// oracle rend F(0) … F(2000) lus dans contracts/b000045.txt. Les attendus ne sont jamais recalculés ici.
// Un oracle absent ou mal formé fait échouer le test qui l'utilise, jamais passer.
func oracle(t *testing.T) []*big.Int {
	t.Helper()
	if cached != nil {
		return cached
	}
	data, err := os.ReadFile(filepath.Join("..", "contracts", "b000045.txt"))
	if errors.Is(err, fs.ErrNotExist) {
		t.Fatal("oracle absent : contracts/b000045.txt")
	}
	if err != nil {
		t.Fatal(err)
	}
	var terms []*big.Int
	for _, line := range strings.Split(string(data), "\n") {
		if line == "" {
			continue
		}
		index, digits, _ := strings.Cut(line, " ")
		term, ok := new(big.Int).SetString(digits, 10)
		if index != strconv.Itoa(len(terms)) || !ok {
			t.Fatalf("oracle mal formé à la ligne %q", line)
		}
		terms = append(terms, term)
	}
	cached = terms
	return terms
}

var cached []*big.Int // l'oracle, lu une fois (les tests ne sont pas parallèles)

// check compare fib(n, algo) au terme n de l'oracle.
func check(t *testing.T, n int, algo string) {
	t.Helper()
	want := oracle(t)[n]
	got, err := fib.Fib(n, algo)
	if err != nil {
		t.Fatal(err)
	}
	if got.Cmp(want) != 0 {
		t.Errorf("fib(%d, %s) = %v, attendu %v", n, algo, got, want)
	}
}

// BIB-01 à BIB-04 : les premiers termes par l'itératif.
func TestBIB01a04_IterativePremiersTermes(t *testing.T) {
	for _, c := range []struct {
		id string
		n  int
	}{{"BIB-01", 0}, {"BIB-02", 1}, {"BIB-03", 2}, {"BIB-04", 10}} {
		t.Run(fmt.Sprintf("%s : fib(%d, iterative) vaut le terme de l'oracle", c.id, c.n), func(t *testing.T) {
			check(t, c.n, "iterative")
		})
	}
}

// BIB-05 à BIB-07 : chaque algorithme égale l'oracle de 0 à 2000. Le balayage franchit int64 et uint64 (92 à 94).
func TestBIB05a07_BalayageContreOracle(t *testing.T) {
	oracle(t) // un oracle absent arrête le balayage ici, au lieu de produire 6 000 échecs identiques
	for _, c := range []struct{ id, algo string }{{"BIB-05", "iterative"}, {"BIB-06", "fast"}, {"BIB-07", "matrix"}} {
		for n := 0; n <= 2000; n++ {
			t.Run(fmt.Sprintf("%s : fib(%d, %s) vaut le terme de l'oracle", c.id, n, c.algo), func(t *testing.T) {
				check(t, n, c.algo)
			})
		}
	}
}

var algos = []string{"iterative", "matrix", "fast"}

// mustFib rend fib(n, algo), ou arrête le test.
func mustFib(t *testing.T, n int, algo string) *big.Int {
	t.Helper()
	got, err := fib.Fib(n, algo)
	if err != nil {
		t.Fatal(err)
	}
	return got
}

// BIB-08 : les trois algorithmes rendent le même terme pour n = 100 000, qui compte 20 899 chiffres.
func TestBIB08_LesAlgorithmesConcordentA100000(t *testing.T) {
	reference := mustFib(t, 100000, "iterative")
	if got := len(reference.String()); got != 20899 {
		t.Errorf("fib(100000, iterative) compte %d chiffres, attendu 20899", got)
	}
	for _, algo := range algos {
		t.Run(fmt.Sprintf("BIB-08 : fib(100000, %s) égale l'itératif", algo), func(t *testing.T) {
			if got := mustFib(t, 100000, algo); got.Cmp(reference) != 0 {
				t.Errorf("fib(100000, %s) diffère de fib(100000, iterative)", algo)
			}
		})
	}
}

// BIB-10 à BIB-12 : fibList(n) égale les n + 1 premiers termes de l'oracle, dans l'ordre.
func TestBIB10a12_FibListEgaleLOracle(t *testing.T) {
	for _, c := range []struct {
		id string
		n  int
	}{{"BIB-10", 0}, {"BIB-11", 1}, {"BIB-12", 2000}} {
		t.Run(fmt.Sprintf("%s : fibList(%d) vaut les %d premiers termes de l'oracle", c.id, c.n, c.n+1), func(t *testing.T) {
			want := oracle(t)[:c.n+1]
			got, err := fib.FibList(c.n)
			if err != nil {
				t.Fatal(err)
			}
			if len(got) != len(want) {
				t.Fatalf("fibList(%d) a %d termes, attendu %d", c.n, len(got), len(want))
			}
			for i := range want {
				if got[i].Cmp(want[i]) != 0 {
					t.Fatalf("fibList(%d)[%d] = %v, attendu %v", c.n, i, got[i], want[i])
				}
			}
		})
	}
}

// BIB-13 : fib refuse tout nom qui n'est pas exactement iterative, matrix ou fast. `all` est la comparaison de la CLI, pas un algorithme.
func TestBIB13_AlgorithmeInconnuEstRefuse(t *testing.T) {
	for _, algo := range []string{"all", "bogus", "", "FAST"} {
		t.Run(fmt.Sprintf("BIB-13 : fib(5, %q) est refusé", algo), func(t *testing.T) {
			if got, err := fib.Fib(5, algo); err == nil {
				t.Errorf("fib(5, %q) = %v, attendu une erreur", algo, got)
			}
		})
	}
}

// BIB-14 : un indice négatif est refusé (l'indice est un int signé, donc 1.5 et NaN ne peuvent pas être passés).
func TestBIB14_IndiceNegatifEstRefuse(t *testing.T) {
	for _, algo := range algos {
		t.Run(fmt.Sprintf("BIB-14 : fib(-1, %s) est refusé", algo), func(t *testing.T) {
			if got, err := fib.Fib(-1, algo); err == nil {
				t.Errorf("fib(-1, %s) = %v, attendu une erreur", algo, got)
			}
		})
	}
	t.Run("BIB-14 : fibList(-1) est refusé", func(t *testing.T) {
		if got, err := fib.FibList(-1); err == nil {
			t.Errorf("fibList(-1) = %v, attendu une erreur", got)
		}
	})
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
