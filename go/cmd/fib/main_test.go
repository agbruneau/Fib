// Tests de garde de la CLI (ADR-0004) : hors seams, hors catalogue. Ils visent run et ce que le binaire embarque.
package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"slices"
	"strings"
	"testing"
)

// writeCounter n'implémente que Write : il compte les appels et les octets reçus, ce qu'un appel système coûterait.
type writeCounter struct{ calls, bytes int }

func (w *writeCounter) Write(p []byte) (int, error) {
	w.calls++
	w.bytes += len(p)
	return len(p), nil
}

// minBlock : la moitié du tampon de 64 Kio de run, soit un facteur 2 de marge sur ses appels à Write.
const minBlock = 32 << 10

// PERF-GO-6, hors catalogue : garde de l'optimisation de run (écriture tamponnée) : aucun appel à Write par terme.
func TestPERFGO6_ListeEcriteParBlocs(t *testing.T) {
	var w writeCounter
	if code := run([]string{"--list", "10000"}, &w, io.Discard); code != 0 {
		t.Fatalf("run --list 10000 rend le code %d, attendu 0", code)
	}
	if w.bytes == 0 {
		t.Fatal("run --list 10000 n'écrit aucun octet sur stdout")
	}
	maxCalls := (w.bytes + minBlock - 1) / minBlock
	t.Run(fmt.Sprintf("PERF-GO-6 : --list 10000 écrit sur stdout par blocs d'au moins %d octets", minBlock), func(t *testing.T) {
		if w.calls > maxCalls {
			t.Errorf("--list 10000 fait %d appels à Write pour %d octets, attendu %d au plus", w.calls, w.bytes, maxCalls)
		}
	})
}

// PERF-GO-7, hors catalogue : garde de l'optimisation de démarrage : aucune initialisation dans fib ni dans la commande
// (le sync.Once de quads, aucune regexp compilée au chargement). Le binaire de test se relance sans test, sous
// GODEBUG=inittrace=1 : le runtime écrit sur stderr une ligne « init <paquet> » pour chaque paquet qui initialise
// quelque chose. La ligne « init main », celle du paquet de test généré, n'est pas la commande.
func TestPERFGO7_LeDemarrageNInitialiseRien(t *testing.T) {
	t.Run("PERF-GO-7 : le chargement de fib et de la commande n'exécute aucune initialisation", func(t *testing.T) {
		cmd := exec.Command(os.Args[0], "-test.run=^$")
		cmd.Env = append(os.Environ(), "GODEBUG=inittrace=1")
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("%v\n%s", err, out)
		}
		traced := false
		for line := range strings.Lines(string(out)) {
			traced = traced || strings.HasPrefix(line, "init ")
			if strings.HasPrefix(line, "init fib ") || strings.HasPrefix(line, "init fib/cmd/fib ") {
				t.Errorf("initialisation au chargement : %s", strings.TrimSpace(line))
			}
		}
		if !traced {
			t.Fatalf("aucune ligne « init » : GODEBUG=inittrace=1 est sans effet\n%s", out)
		}
	})
}

// PERF-GO-8, hors catalogue : garde de l'optimisation de démarrage : aucune regexp, pendant de PERF-PY-8. Un paquet
// importé est dans les dépendances de la commande, qu'il serve à l'initialisation (PERF-GO-7 le voit) ou à chaque
// appel de isDigits (PERF-GO-7 ne le voit pas).
func TestPERFGO8_LaCommandeNImporteAucuneRegexp(t *testing.T) {
	t.Run("PERF-GO-8 : go list -deps ne contient aucun paquet regexp", func(t *testing.T) {
		out, err := exec.Command("go", "list", "-deps", ".").Output()
		if err != nil {
			var exit *exec.ExitError
			if errors.As(err, &exit) {
				err = fmt.Errorf("%w\n%s", err, exit.Stderr)
			}
			t.Fatalf("go list -deps . : %v", err)
		}
		deps := strings.Fields(string(out))
		if !slices.Contains(deps, "fib") {
			t.Fatalf("go list -deps . ne liste pas fib : %q", deps)
		}
		for _, dep := range deps {
			if dep == "regexp" || strings.HasPrefix(dep, "regexp/") {
				t.Errorf("la commande dépend de %s", dep)
			}
		}
	})
}
