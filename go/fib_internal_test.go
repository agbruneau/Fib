// Tests de garde qui visent une fonction non exportée (ADR-0004) : hors seams, hors catalogue.
package fib

import (
	"fmt"
	"math/big"
	"slices"
	"testing"
)

// PERF-GO-5, hors catalogue : garde de l'optimisation de FibList (additionneur en base 10^18), pendant de PERF-RS-4.
func TestPERFGO5_UneSommeDeLimbesEgaleA10Puissance18PropageSaRetenue(t *testing.T) {
	t.Run("PERF-GO-5 : [base/2, 3, 0] + [base/2, 4] vaut [0, 8, 0], sans retenue finale", func(t *testing.T) {
		a := []uint64{base / 2, 3, 0}
		carry := addLimbs(a, []uint64{base / 2, 4})
		if want := []uint64{0, 8, 0}; !slices.Equal(a, want) || carry != 0 {
			t.Errorf("[base/2, 3, 0] + [base/2, 4] = %v avec la retenue %d, attendu %v avec la retenue 0", a, carry, want)
		}
	})
}

// identityRuns : le nombre d'exécutions que moyenne testing.AllocsPerRun. Le résultat est une division entière, donc une
// allocation parasite isolée (le ramasse-miettes, le démarrage d'une goroutine) y disparaît, comme sous PERF-GO-3 et 4.
const identityRuns = 20

// identitySink reçoit chaque résultat que mesure PERF-GO-11 : sans lui, un résultat inutilisé pourrait être alloué sur la
// pile, ou le calcul éliminé, et le compte ne serait plus celui de la fonction.
var identitySink *big.Int

// PERF-GO-11, hors catalogue : garde de F2 et de F6 (catalogue § 6, lacune « l'aiguillage de la bibliothèque »), pendant de
// PERF-GO-10, qui espionne le nom demandé et non la fonction qui calcule derrière ce nom. Les trois algorithmes rendent les
// mêmes valeurs : sous `case "matrix": return fast(n), nil`, les valeurs restent justes. La garde ne compare donc ni valeur
// ni durée : elle compare le nombre exact d'allocations de Fib(n, nom) à celui de l'appel direct de la fonction de ce nom,
// car chaque algorithme alloue à sa façon (iterative réserve ses tampons d'emblée; matrix et fast créent des entiers à
// chaque bit, en nombres différents). Elle rougit sous chacun des six échanges d'aiguillage du `switch algo` de Fib, un nom
// vers l'une des deux autres fonctions : iterative → matrix, iterative → fast, matrix → iterative, matrix → fast,
// fast → iterative et fast → matrix. Le code de production ne change pas : le `switch` reste tel quel, et la garde passe
// par Fib elle-même, pas par un détour qui ne servirait qu'à elle.
//
// n = 1023 : tous ses bits valent 1, donc matrix ajoute à chaque bit son produit par Q, que fast n'a pas; les trois comptes
// valent 4, 67 et 52 sous Go 1.26. La garde vérifie d'abord qu'ils diffèrent deux à deux : si une évolution de math/big ou
// d'un algorithme les confondait, elle échouerait sur ce constat au lieu de ne plus rien garder.
func TestPERFGO11_ChaqueNomAiguilleVersSaFonction(t *testing.T) {
	const n = 1023
	algos := []struct {
		name   string
		direct func(int) *big.Int
	}{{"iterative", iterative}, {"matrix", matrix}, {"fast", fast}}
	own := make([]float64, len(algos)) // le compte de chaque fonction, appelée directement
	for i, a := range algos {
		own[i] = testing.AllocsPerRun(identityRuns, func() { identitySink = a.direct(n) })
	}
	for i := range algos {
		for j := i + 1; j < len(algos); j++ {
			if own[i] == own[j] {
				t.Fatalf("%s(%d) et %s(%d) allouent tous deux %v fois : la garde ne les distingue plus, choisir un autre n",
					algos[i].name, n, algos[j].name, n, own[i])
			}
		}
	}
	for i, a := range algos {
		t.Run(fmt.Sprintf("PERF-GO-11 : Fib(%d, %q) exécute %s", n, a.name, a.name), func(t *testing.T) {
			got := testing.AllocsPerRun(identityRuns, func() {
				var err error
				if identitySink, err = Fib(n, a.name); err != nil {
					t.Fatalf("Fib(%d, %q) : %v", n, a.name, err)
				}
			})
			if got == own[i] {
				return
			}
			who := "le compte d'aucune des trois fonctions"
			for j, b := range algos {
				if got == own[j] {
					who = "le compte de " + b.name
				}
			}
			t.Errorf("Fib(%d, %q) alloue %v fois, soit %s; %s en alloue %v", n, a.name, got, who, a.name, own[i])
		})
	}
}
