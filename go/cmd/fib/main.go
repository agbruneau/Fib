// Commande fib : adaptateur mince autour de la bibliothèque fib (contrat du PRD § 4, analyse manuelle selon l'ADR-0002).
package main

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"math/big"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"fib"
)

const (
	maxTerm = 100_000
	maxList = 10_000
)

const usage = `usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
`

type options struct {
	algo string // vide tant que --algo n'est pas donné (une valeur vide est refusée)
	list bool
	time bool
	n    int
}

var errMismatch = errors.New("discordance entre les algorithmes")

var indexPattern = regexp.MustCompile(`^[0-9]+$`)

// parse applique la grammaire du PRD § 4. %+q cite un argument en ASCII pur, sur une seule ligne.
func parse(args []string) (options, error) {
	var o options
	var positional []string
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--algo" || strings.HasPrefix(a, "--algo="):
			value, ok := strings.CutPrefix(a, "--algo=")
			if !ok { // « --algo X » : X est l'argument suivant, quel qu'il soit
				if i++; i == len(args) {
					return o, fmt.Errorf("--algo demande une valeur")
				}
				value = args[i]
			}
			if !slices.Contains([]string{"iterative", "matrix", "fast", "all"}, value) {
				return o, fmt.Errorf("algorithme inconnu : %+q", value)
			}
			o.algo = value
		case a == "--list":
			o.list = true
		case a == "--time":
			o.time = true
		case strings.HasPrefix(a, "-"):
			return o, fmt.Errorf("option inconnue : %+q", a)
		default:
			positional = append(positional, a)
		}
	}
	if o.list && o.algo != "" {
		return o, fmt.Errorf("--list et --algo s'excluent")
	}
	if len(positional) != 1 {
		return o, fmt.Errorf("un seul indice attendu")
	}
	// La regex passe avant toute conversion : Atoi accepte « +5 », et un indice trop grand pour un int est hors borne.
	if !indexPattern.MatchString(positional[0]) {
		return o, fmt.Errorf("indice invalide : chiffres ASCII seulement")
	}
	limit := maxTerm
	if o.list {
		limit = maxList
	}
	n, err := strconv.Atoi(positional[0])
	if err != nil || n > limit {
		return o, fmt.Errorf("indice hors borne (%d au plus)", limit)
	}
	o.n = n
	return o, nil
}

// lap rend « <algo> <durée> ms » : le chronomètre ne couvre que le calcul, et %f ignore la locale.
func lap(algo string, start time.Time) string {
	return fmt.Sprintf("%s %.3f ms\n", algo, float64(time.Since(start).Nanoseconds())/1e6)
}

// compute rend les termes à écrire et une ligne de durée par algorithme exécuté.
// Pour `all`, fast, iterative puis matrix doivent concorder.
func compute(o options) ([]*big.Int, []string, error) {
	if o.list {
		start := time.Now()
		list, err := fib.FibList(o.n)
		return list, []string{lap("iterative", start)}, err
	}
	algos := []string{o.algo}
	switch o.algo {
	case "":
		algos = []string{"fast"}
	case "all":
		algos = []string{"fast", "iterative", "matrix"}
	}
	var first *big.Int
	var durations []string
	for _, algo := range algos {
		start := time.Now()
		term, err := fib.Fib(o.n, algo)
		durations = append(durations, lap(algo, start))
		if err != nil {
			return nil, nil, err
		}
		if first != nil && first.Cmp(term) != 0 {
			return nil, nil, fmt.Errorf("%w pour l'indice %d", errMismatch, o.n)
		}
		first = term
	}
	return []*big.Int{first}, durations, nil
}

func run(args []string, stdout, stderr io.Writer) int {
	// L'aide l'emporte sur tout le reste, y compris à la place de la valeur de --algo.
	if slices.Contains(args, "--help") || slices.Contains(args, "-h") {
		io.WriteString(stdout, usage)
		return 0
	}
	o, err := parse(args)
	var terms []*big.Int
	var durations []string
	if err == nil {
		terms, durations, err = compute(o)
	}
	if err != nil {
		fmt.Fprintf(stderr, "fib: %v\n", err)
		if errors.Is(err, errMismatch) {
			return 3
		}
		return 2
	}
	out := bufio.NewWriter(stdout)
	for _, t := range terms {
		fmt.Fprintln(out, t)
	}
	out.Flush()
	if o.time {
		io.WriteString(stderr, strings.Join(durations, ""))
	}
	return 0
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}
