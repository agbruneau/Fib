// Tests de garde de la CLI (ADR-0004) : hors seams, hors catalogue. Ils visent run et ce que le binaire embarque.
package main

import (
	"errors"
	"fmt"
	"io"
	"math/big"
	"os"
	"os/exec"
	"slices"
	"strings"
	"testing"

	"fib"
)

// writeCounter n'implémente que Write : il compte les appels et les octets reçus, ce qu'un appel système coûterait.
type writeCounter struct{ calls, bytes int }

func (w *writeCounter) Write(p []byte) (int, error) {
	w.calls++
	w.bytes += len(p)
	return len(p), nil
}

// recordWriter n'implémente que Write : il garde le contenu de chaque appel, dans l'ordre.
type recordWriter struct{ calls []string }

func (w *recordWriter) Write(p []byte) (int, error) {
	w.calls = append(w.calls, string(p))
	return len(p), nil
}

// minBlock : la moitié du tampon de 64 Kio de run, soit un facteur 2 de marge sur ses appels à Write.
const minBlock = 32 << 10

// PERF-GO-6, hors catalogue : garde de l'optimisation de run (écriture tamponnée) : aucun appel à Write par terme.
func TestPERFGO6_ListeEcriteParBlocs(t *testing.T) {
	var w writeCounter
	if code := run([]string{"--list", "10000"}, &w, io.Discard, fib.Fib); code != 0 {
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
	// L'instrumentation de couverture ajoute un init à fib/cmd/fib (et à fib sous -coverpkg) : la garde les prendrait pour les nôtres.
	if testing.CoverMode() != "" {
		t.Skip("PERF-GO-7 saute sous couverture : l'instrumentation ajoute un init à fib/cmd/fib (et à fib sous -coverpkg)")
	}
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

// PERF-GO-9, hors catalogue : garde de F3 (catalogue § 6). Aucun cas du contrat ne peut provoquer une discordance : seul un
// calcul substitué, le vrai terme plus 1 pour un algorithme, tour à tour à chacune des trois places, la provoque. run rend
// alors 3, stdout ne reçoit aucun appel à Write, et stderr un seul : une ligne « fib: », sans durée, même avec --time. Le
// test ne recalcule aucun terme. Rouge sous : un prédicat aveugle (t.Cmp(t)) ou partiel (terms[1:2]), `return 2` pour le 3,
// des durées ajoutées au message (une par ligne, ou sur sa ligne), le terme écrit sur le stdout de run avant l'erreur, ou
// fib.Fib en dur dans compute.
// Survivants connus, laissés à la revue de code : une écriture directe sur os.Stderr ou os.Stdout depuis compute (G9 et
// G10, que le Writer d'essai ne voit pas); main qui borne le code à 2 (GM); main qui passe un calcul qui fait tout par
// fast (GW).
func TestPERFGO9_UneDiscordanceRend3SansStdoutNiDuree(t *testing.T) {
	for _, bad := range comparison {
		t.Run(fmt.Sprintf("PERF-GO-9 : si %s diffère des deux autres, --time --algo all 10 rend 3, sans stdout et sans durée", bad), func(t *testing.T) {
			term := func(n int, algo string) (*big.Int, error) {
				v, err := fib.Fib(n, algo)
				if err != nil || algo != bad {
					return v, err
				}
				return new(big.Int).Add(v, big.NewInt(1)), nil
			}
			var stdout, stderr recordWriter
			if code := run([]string{"--time", "--algo", "all", "10"}, &stdout, &stderr, term); code != 3 {
				t.Errorf("run --time --algo all 10 rend le code %d, attendu 3", code)
			}
			if len(stdout.calls) != 0 {
				t.Errorf("stdout reçoit %d appels à Write, attendu aucun : %q", len(stdout.calls), stdout.calls)
			}
			if len(stderr.calls) != 1 {
				t.Fatalf("stderr reçoit %d appels à Write, attendu un seul : %q", len(stderr.calls), stderr.calls)
			}
			line := stderr.calls[0]
			if !strings.HasPrefix(line, "fib: ") {
				t.Errorf("stderr ne commence pas par « fib: » : %q", line)
			}
			if strings.Count(line, "\n") != 1 || !strings.HasSuffix(line, "\n") {
				t.Errorf("stderr n'est pas une seule ligne, terminée par son seul \\n : %q", line)
			}
			if strings.Contains(line, " ms") {
				t.Errorf("stderr contient une durée : %q", line)
			}
		})
	}
}

// PERF-GO-10, hors catalogue : garde de F2 et de F6 (catalogue § 6), pendant de PERF-TS-8 : l'algorithme que nomme une ligne
// de durée est celui qui a calculé. Le calcul espion note l'algorithme qu'on lui demande, puis délègue à fib.Fib : les
// algorithmes appelés doivent être ceux que nomment les lignes de durée, dans l'ordre, un appel chacun. Rouge sous : un
// algorithme calculé par un autre (fast pour iterative, par exemple) que la ligne nomme quand même.
func TestPERFGO10_LAlgorithmeNommeEstCeluiQuiCalcule(t *testing.T) {
	for _, c := range []struct {
		args  []string
		algos []string
	}{
		{[]string{"10"}, []string{"fast"}},
		{[]string{"--algo", "iterative", "10"}, []string{"iterative"}},
		{[]string{"--algo", "matrix", "10"}, []string{"matrix"}},
		{[]string{"--algo", "all", "10"}, []string{"fast", "iterative", "matrix"}},
	} {
		args := append([]string{"--time"}, c.args...)
		t.Run(fmt.Sprintf("PERF-GO-10 : %s exécute %s", strings.Join(args, " "), strings.Join(c.algos, " puis ")), func(t *testing.T) {
			var called []string
			term := func(n int, algo string) (*big.Int, error) {
				called = append(called, algo)
				return fib.Fib(n, algo)
			}
			var stdout, stderr recordWriter
			if code := run(args, &stdout, &stderr, term); code != 0 {
				t.Fatalf("run %s rend le code %d, attendu 0", strings.Join(args, " "), code)
			}
			var named []string
			for _, call := range stderr.calls {
				for line := range strings.Lines(call) {
					algo, _, _ := strings.Cut(line, " ")
					named = append(named, algo)
				}
			}
			if !slices.Equal(named, c.algos) {
				t.Errorf("les lignes de durée nomment %q, attendu %q", named, c.algos)
			}
			if !slices.Equal(called, named) {
				t.Errorf("les algorithmes appelés sont %q, les lignes de durée nomment %q", called, named)
			}
		})
	}
}
