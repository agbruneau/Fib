"""Fibonacci académique : bibliothèque (fib, fib_list), puis CLI."""
import re
import sys
import time

# Sans cela, int() d'un indice de plus de 4 300 chiffres (zéros de tête) et str() d'un terme de plus de 4 300 chiffres
# lèvent ValueError.
sys.set_int_max_str_digits(0)


def _iterative(n):
    """Applique la définition indice par indice, avec deux termes consécutifs en mémoire."""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


def _mul(x, y):
    """Matrice 2x2 à plat : (a, b, c, d)."""
    a, b, c, d = x
    e, f, g, h = y
    return (a * e + b * g, a * f + b * h,
            c * e + d * g, c * f + d * h)


def _matrix(n):
    """[[1,1],[1,0]]^n = [[F(n+1), F(n)], [F(n), F(n-1)]], par carrés successifs."""
    result, base = (1, 0, 0, 1), (1, 1, 1, 0)
    while n > 0:
        if n & 1:
            result = _mul(result, base)
        base = _mul(base, base)
        n >>= 1
    return result[1]


def _fast(n):
    """Doublement rapide : (F(k), F(k+1)) devient (F(2k), F(2k+1)) à chaque bit de n, du poids fort au poids faible;
    un bit à 1 avance encore d'un cran."""
    a, b = 0, 1
    for bit in format(n, "b"):
        # F(2k) = F(k)·(2F(k+1) − F(k)) et F(2k+1) = F(k)² + F(k+1)²
        even = a * (2 * b - a)
        odd = a * a + b * b
        a, b = (odd, even + odd) if bit == "1" else (even, odd)
    return a


_ALGOS = {"iterative": _iterative, "matrix": _matrix, "fast": _fast}


def _check_index(n):
    # ni float ni bool : sans lui, matrix rendrait 0 pour 0.0
    if type(n) is not int:
        raise TypeError(f"indice invalide : {n!r}")
    # Avant tout calcul : sur n < 0, les algorithmes rendraient un terme faux au lieu d'une erreur.
    if n < 0:
        raise ValueError(f"indice invalide : {n}")


def fib(n, algo):
    """Rend F(n) par l'algorithme algo.
    Lève ValueError pour un algorithme inconnu ou un indice négatif, TypeError pour un indice qui n'est pas un int."""
    if algo not in _ALGOS:
        raise ValueError(f"algorithme inconnu : {algo!r}")
    _check_index(n)
    return _ALGOS[algo](n)


def fib_list(n):
    """F(0) … F(n), toujours par l'algorithme iterative."""
    _check_index(n)
    terms = [0]
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
        terms.append(a)
    return terms


# --- CLI : adaptateur mince (PRD § 4, ADR-0002) ---

USAGE = """usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
"""

MAX_TERM, MAX_LIST = 100_000, 10_000

COMPARISON = ("fast", "iterative", "matrix")


class CliError(Exception):
    """Code 2 : erreur d'usage. Code 3 : discordance entre algorithmes."""

    def __init__(self, message, code=2):
        super().__init__(message)
        self.code = code


def parse(args):
    """Applique la grammaire du PRD § 4."""
    algos = None
    as_list = show_time = False
    positional = []
    # le for et next() avancent le même itérateur
    rest = iter(args)
    for a in rest:
        # --algo X : X est l'argument suivant, quel qu'il soit; chaque occurrence doit être valide, la dernière gagne.
        if a == "--algo" or a.startswith("--algo="):
            if a == "--algo":
                value = next(rest, None)
            else:
                value = a.removeprefix("--algo=")
            if value is None:
                raise CliError("--algo demande une valeur")
            if value == "all":
                algos = list(COMPARISON)
            elif value in COMPARISON:
                algos = [value]
            else:
                # l'argument fautif est cité, en ASCII
                raise CliError(f"algorithme inconnu : {ascii(value)}")
        elif a == "--list":
            as_list = True
        elif a == "--time":
            show_time = True
        elif a.startswith("-"):
            raise CliError(f"option inconnue : {ascii(a)}")
        else:
            positional.append(a)
    if as_list and algos:
        raise CliError("--list et --algo s'excluent")
    if len(positional) != 1:
        raise CliError("exactement un indice attendu")
    # avant int() : il accepte +5, 1_000, ' 5 ' et des chiffres non ASCII
    if not re.fullmatch("[0-9]+", positional[0]):
        raise CliError("indice invalide : chiffres ASCII seulement")
    n = int(positional[0])
    bound = MAX_LIST if as_list else MAX_TERM
    if n > bound:
        raise CliError(f"indice hors borne ({bound} au plus)")
    return algos or ["fast"], as_list, show_time, n


def compute(algos, as_list, n):
    """Rend les termes à écrire et les lignes de durée; avec all, les trois algorithmes doivent concorder.
    Rien n'est écrit ici : une discordance (F3) laisse stdout vide et sans durée."""
    durations = []

    def timed(name, calc):
        """Une ligne « <algo> <durée> ms » par calcul : le chronomètre ne couvre que le calcul,
        et le format ignore la locale."""
        start = time.perf_counter()
        result = calc()
        durations.append(f"{name} {(time.perf_counter() - start) * 1000:.3f} ms\n")
        return result

    if as_list:
        return timed("iterative", lambda: fib_list(n)), durations
    terms = [timed(a, lambda: fib(n, a)) for a in algos]
    if any(t != terms[0] for t in terms):
        raise CliError(f"discordance entre les algorithmes pour l'indice {n}", 3)
    return [terms[0]], durations


def main(args):
    # L'aide l'emporte sur tout le reste, y compris à la place de la valeur de --algo.
    if "--help" in args or "-h" in args:
        sys.stdout.write(USAGE)
        return 0
    try:
        algos, as_list, show_time, n = parse(args)
        terms, durations = compute(algos, as_list, n)
    except CliError as e:
        sys.stderr.write(f"fib: {e}\n")
        return e.code
    sys.stdout.write("".join(f"{t}\n" for t in terms))
    # Les termes avant les durées, même sur un pipe qui fusionne stdout et stderr.
    sys.stdout.flush()
    if show_time:
        sys.stderr.write("".join(durations))
    return 0


if __name__ == "__main__":
    # F10 : ASCII et \n quel que soit l'environnement (PYTHONIOENCODING, Windows).
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="ascii", newline="\n")
    sys.exit(main(sys.argv[1:]))
