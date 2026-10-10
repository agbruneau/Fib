"""Fibonacci académique : bibliothèque (fib, fib_list) et CLI (python/fib.py)."""
import re
import sys
import time

# Sans cela, str() d'un terme de plus de 4 300 chiffres lève ValueError.
sys.set_int_max_str_digits(0)


def _iterative(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


# Doublement rapide : à chaque bit de n, (F(k), F(k+1)) devient (F(2k), F(2k+1)); un bit à 1 avance encore d'un cran.
def _fast(n):
    a, b = 0, 1
    for bit in bin(n)[2:]:
        c = a * (2 * b - a)
        d = a * a + b * b
        a, b = (d, c + d) if bit == "1" else (c, d)
    return a


# [[1,1],[1,0]]^n = [[F(n+1), F(n)], [F(n), F(n-1)]], par carrés successifs. Matrice 2x2 à plat : (a, b, c, d).
def _mul(x, y):
    return (x[0] * y[0] + x[1] * y[2], x[0] * y[1] + x[1] * y[3],
            x[2] * y[0] + x[3] * y[2], x[2] * y[1] + x[3] * y[3])


def _matrix(n):
    result, base = (1, 0, 0, 1), (1, 1, 1, 0)
    while n:
        if n & 1:
            result = _mul(result, base)
        base = _mul(base, base)
        n >>= 1
    return result[1]


_ALGOS = {"iterative": _iterative, "matrix": _matrix, "fast": _fast}


def _check_index(n):
    # Avant tout calcul : matrix boucle sans fin sur n < 0 (-1 >> 1 vaut -1).
    if type(n) is not int:  # ni float (1.5, nan) ni bool
        raise TypeError(f"indice invalide : {n!r}")
    if n < 0:
        raise ValueError(f"indice invalide : {n}")


def fib(n, algo):
    if algo not in _ALGOS:
        raise ValueError(f"algorithme inconnu : {algo!r}")
    _check_index(n)
    return _ALGOS[algo](n)


def fib_list(n):
    """F(0) … F(n), toujours par l'algorithme iterative."""
    _check_index(n)
    terms, (a, b) = [0], (0, 1)
    for _ in range(n):
        a, b = b, a + b
        terms.append(a)
    return terms


class CliError(Exception):
    """Code 2 : erreur d'usage. Code 3 : discordance entre algorithmes."""

    def __init__(self, message, code=2):
        super().__init__(message)
        self.code = code


MAX_TERM, MAX_LIST = 100_000, 10_000

USAGE = """usage: fib [--algo iterative|matrix|fast|all] [--time] N
       fib --list [--time] N
       fib --help
"""


def _ascii(s):  # les messages restent en ASCII : l'argument fautif est assaini avant d'être cité
    return re.sub(r"[^\x20-\x7e]", "?", s)


def parse(args):
    algo, flags, positional, rest = None, set(), [], iter(args)
    for a in rest:
        if a == "--algo" or a.startswith("--algo="):
            value = next(rest, None) if a == "--algo" else a[len("--algo="):]  # --algo X : X est l'argument suivant, quel qu'il soit
            if value not in (*_ALGOS, "all"):  # chaque occurrence doit être valide; la dernière gagne
                raise CliError("--algo demande une valeur" if value is None else f"algorithme inconnu : {_ascii(value)}")
            algo = value
        elif a in ("--list", "--time"):
            flags.add(a)
        elif a.startswith("-"):
            raise CliError(f"option inconnue : {_ascii(a)}")
        else:
            positional.append(a)
    as_list = "--list" in flags
    if as_list and algo is not None:
        raise CliError("--list et --algo s'excluent")
    if len(positional) != 1:
        raise CliError("un seul indice attendu" if positional else "indice manquant")
    if not re.fullmatch("[0-9]+", positional[0]):  # avant int() : il accepte +5, 1_000, ' 5 ' et des chiffres non ASCII
        raise CliError("indice invalide : chiffres ASCII seulement")
    n = int(positional[0])
    limit = MAX_LIST if as_list else MAX_TERM
    if n > limit:
        raise CliError(f"indice hors borne ({limit} au plus)")
    return algo or "fast", as_list, "--time" in flags, n


# Les termes à écrire : la liste, un terme, ou, pour `all`, un terme sur lequel fast, iterative puis matrix concordent.
# Une ligne « <algo> <durée> ms » par calcul exécuté : le chronomètre ne couvre que le calcul.
def compute(algo, as_list, n, durations):
    def timed(name, calc, *args):
        start = time.perf_counter()
        result = calc(*args)
        durations.append(f"{name} {(time.perf_counter() - start) * 1000:.3f} ms\n")
        return result

    if as_list:
        return timed("iterative", fib_list, n)
    if algo != "all":
        return [timed(algo, fib, n, algo)]
    first, *others = (timed(a, fib, n, a) for a in ("fast", "iterative", "matrix"))
    if any(t != first for t in others):
        raise CliError(f"discordance entre les algorithmes pour l'indice {n}", 3)
    return [first]


def main(args):
    for stream in (sys.stdout, sys.stderr):  # Windows écrirait \r\n (F10)
        stream.reconfigure(newline="\n")
    if "--help" in args or "-h" in args:  # l'aide l'emporte sur tout, y compris à la place de la valeur de --algo
        sys.stdout.write(USAGE)
        return 0
    durations = []
    try:
        algo, as_list, show_time, n = parse(args)
        text = "".join(f"{t}\n" for t in compute(algo, as_list, n, durations))
    except CliError as e:
        sys.stderr.write(f"fib: {e}\n")
        return e.code
    sys.stdout.write(text)
    if show_time:
        sys.stderr.write("".join(durations))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
