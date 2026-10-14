// Tests de garde qui visent une fonction non exportée (ADR-0004) : hors seams, hors catalogue.
package fib

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"math/big"
	"slices"
	"strconv"
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
//
// Limite : l'empreinte ne vérifie l'aiguillage qu'à n = 1023, et un corps qui en imite une autre la trompe : un `matrix` qui
// calcule par fast puis alloue 15 entiers de plus retrouve les 67 allocations de matrix. Le volet statique ci-dessous lit
// donc le texte de fib.go, et ferme ce que n = 1023 laisse passer : un aiguillage ou un corps qui dépend de n. Ce qui reste
// aux deux volets, laissé à la revue de code : une délégation que le texte ne montre pas, par une variable de fonction
// (`var delegate = fast`, puis `return delegate(n)`) ou par une fonction auxiliaire (`return help(n)`, où help appelle
// fast), pour certains n seulement; et un aiguillage qui dépend de n posé dans Fib hors du `switch algo`.
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
				t.Fatalf("%s(%d) et %s(%d) allouent tous deux %v fois : l'un délègue-t-il à l'autre (identité perdue, ADR-0004) ? "+
					"Sinon, choisir un autre n ou une autre empreinte", algos[i].name, n, algos[j].name, n, own[i])
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

// PERF-GO-11, volet statique, hors catalogue : garde de F2, qui veut que chaque nom calcule par son propre algorithme, à
// tout n. L'empreinte d'allocations ne le voit qu'à n = 1023, et un corps qui l'imite passe. Ce volet lit fib.go par
// go/parser et go/ast (la bibliothèque standard) et vérifie deux choses. (a) Dans Fib, le `switch algo` a exactement les trois
// cas "iterative", "matrix" et "fast", et le corps de chacun est la seule instruction `return <f>(n), nil`, où <f> est la
// fonction du même nom. (b) Les corps de iterative, matrix et fast ne nomment (aucun *ast.Ident) ni l'une des deux autres
// fonctions, ni Fib, ni FibList. Le code de production ne change pas, et les imports de ce fichier n'entrent ni dans
// `go list -deps .` ni dans l'inittrace de cmd/fib (PERF-GO-7 et 8 y restent verts).
//
// Rouge sous : `case "matrix": if n > 10_000 { return fast(n), nil }; return matrix(n), nil` (a), ou la même condition
// `if n%2 == 0` (a); `return fast(n)` en tête de matrix (b, et l'empreinte); un matrix qui calcule par fast puis alloue
// 15 entiers (une variable de paquet que `new(int)` remplit) pour retrouver les 67 allocations de matrix (b); et
// `if n < 64 { return iterative(n) }` en tête de fast (b), rouge par intention : même juste et plus rapide, il fait calculer
// fast par iterative, et F2 veut un calcul par son propre algorithme à tout n.
// Survivants connus, laissés à la revue de code : voir la limite de PERF-GO-11 ci-dessus.
func TestPERFGO11_LAiguillageEtLesCorpsSeLisentDansLeTexte(t *testing.T) {
	algos := []string{"iterative", "matrix", "fast"}
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "fib.go", nil, 0) // go test s'exécute dans le dossier du paquet
	if err != nil {
		t.Fatal(err)
	}
	funcs := map[string]*ast.FuncDecl{}
	for _, decl := range file.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok && fn.Recv == nil {
			funcs[fn.Name.Name] = fn
		}
	}
	for _, name := range append([]string{"Fib", "FibList"}, algos...) {
		if funcs[name] == nil {
			t.Fatalf("fib.go ne déclare pas la fonction %s : renommée ? Alors adapter PERF-GO-11", name)
		}
	}

	t.Run("PERF-GO-11 : le switch algo de Fib a les cas iterative, matrix et fast, chacun réduit à return <nom>(n), nil", func(t *testing.T) {
		var switches []*ast.SwitchStmt
		ast.Inspect(funcs["Fib"].Body, func(node ast.Node) bool {
			if sw, ok := node.(*ast.SwitchStmt); ok && isIdent(sw.Tag, "algo") {
				switches = append(switches, sw)
			}
			return true
		})
		if len(switches) != 1 {
			t.Fatalf("Fib compte %d switch algo, attendu un seul", len(switches))
		}
		var cases []string
		for _, stmt := range switches[0].Body.List {
			clause := stmt.(*ast.CaseClause) // le corps d'un switch ne compte que des clauses
			where := fset.Position(clause.Pos())
			lit, ok := clauseLiteral(clause)
			if !ok {
				t.Errorf("%s : une clause n'est pas un seul nom d'algorithme entre guillemets (default, ou plusieurs valeurs)", where)
				continue
			}
			name, _ := strconv.Unquote(lit.Value)
			cases = append(cases, name)
			if !returnsOwnCall(clause.Body, name) {
				t.Errorf("%s : le cas %q n'est pas la seule instruction `return %s(n), nil`", where, name, name)
			}
		}
		slices.Sort(cases)
		if want := []string{"fast", "iterative", "matrix"}; !slices.Equal(cases, want) {
			t.Errorf("le switch algo de Fib a les cas %q, attendu exactement %q", cases, want)
		}
	})

	for _, name := range algos {
		t.Run(fmt.Sprintf("PERF-GO-11 : le corps de %s ne nomme ni les deux autres algorithmes, ni Fib, ni FibList", name), func(t *testing.T) {
			var forbidden []string
			for _, other := range append([]string{"Fib", "FibList"}, algos...) {
				if other != name {
					forbidden = append(forbidden, other)
				}
			}
			ast.Inspect(funcs[name].Body, func(node ast.Node) bool {
				if id, ok := node.(*ast.Ident); ok && slices.Contains(forbidden, id.Name) {
					t.Errorf("%s : %s nomme %s", fset.Position(id.Pos()), name, id.Name)
				}
				return true
			})
		})
	}
}

// isIdent dit si e est l'identifiant name.
func isIdent(e ast.Expr, name string) bool {
	id, ok := e.(*ast.Ident)
	return ok && id.Name == name
}

// clauseLiteral rend la chaîne que nomme un cas à une seule valeur littérale; ok est faux pour default ou plusieurs valeurs.
func clauseLiteral(clause *ast.CaseClause) (lit *ast.BasicLit, ok bool) {
	if len(clause.List) != 1 {
		return nil, false
	}
	lit, ok = clause.List[0].(*ast.BasicLit)
	return lit, ok && lit.Kind == token.STRING
}

// returnsOwnCall dit si body est l'unique instruction `return <name>(n), nil`.
func returnsOwnCall(body []ast.Stmt, name string) bool {
	if len(body) != 1 {
		return false
	}
	ret, ok := body[0].(*ast.ReturnStmt)
	if !ok || len(ret.Results) != 2 || !isIdent(ret.Results[1], "nil") {
		return false
	}
	call, ok := ret.Results[0].(*ast.CallExpr)
	return ok && isIdent(call.Fun, name) && len(call.Args) == 1 && isIdent(call.Args[0], "n") && !call.Ellipsis.IsValid()
}
