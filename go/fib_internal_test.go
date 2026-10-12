// Tests de garde qui visent une fonction non exportée (ADR-0004) : hors seams, hors catalogue.
package fib

import (
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
