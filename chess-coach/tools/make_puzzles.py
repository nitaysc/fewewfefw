"""Builds www/js/puzzles-data.js: a few thousand tactics puzzles taken from the Lichess puzzle database.

Source: https://database.lichess.org/#puzzles (lichess_db_puzzle.csv.zst), released into the public
domain under CC0 by lichess.org. Each puzzle comes from a real game. Only the first part of the file is
downloaded (the rows are in random order by puzzle id, so that part is already a fair sample), into
tools/.cache. Needs python3 with `zstandard` (pip install zstandard).

Run: python3 tools/make_puzzles.py

Picked puzzles are well liked (Popularity), played often enough that their rating has settled
(NbPlays, RatingDeviation), and no longer than five moves for the solver. They are spread evenly over
ratings 400 to 2900, then topped up so every theme in THEMES has enough puzzles for its own practice
list. The test in test/puzzles.test.js plays every solution through with chess.js.

Row format in RW.PUZZLES (one string, rows split by "\n", fields by "|"):
  lichess id | FEN before the opponent's first move | moves in UCI, space separated | rating | theme numbers
Moves[0] is the opponent's move that sets the puzzle; the solver plays Moves[1], Moves[3], ...
"""
import csv, io, os, random, sys, urllib.request
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
SRC = os.path.join(CACHE, 'lichess_db_puzzle.head.csv.zst')
URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'
OUT = os.path.join(HERE, '..', 'www', 'js', 'puzzles-data.js')
HEAD_BYTES = 45 * 1024 * 1024

# Themes the app lists, in display order, with the name shown. Other Lichess tags are dropped.
THEMES = [
    ('mateIn1', 'Mate in 1'), ('mateIn2', 'Mate in 2'), ('mateIn3', 'Mate in 3'),
    ('fork', 'Fork'), ('pin', 'Pin'), ('skewer', 'Skewer'), ('hangingPiece', 'Hanging piece'),
    ('discoveredAttack', 'Discovered attack'), ('doubleCheck', 'Double check'), ('backRankMate', 'Back rank mate'),
    ('smotheredMate', 'Smothered mate'), ('sacrifice', 'Sacrifice'), ('deflection', 'Deflection'),
    ('attraction', 'Attraction'), ('trappedPiece', 'Trapped piece'), ('intermezzo', 'In-between move'),
    ('quietMove', 'Quiet move'), ('defensiveMove', 'Defense'), ('promotion', 'Promotion'),
    ('kingsideAttack', 'Kingside attack'), ('opening', 'Opening'), ('middlegame', 'Middlegame'),
    ('endgame', 'Endgame'), ('rookEndgame', 'Rook endgame'), ('pawnEndgame', 'Pawn endgame'),
    ('crushing', 'Big advantage'), ('equality', 'Equalize'),
]
THEME_INDEX = {k: i for i, (k, _) in enumerate(THEMES)}

MIN_RATING, MAX_RATING, BUCKET = 400, 2900, 100
PER_BUCKET = 115
PER_THEME = 70
SEED = 20261110


def fetch():
    if os.path.exists(SRC) and os.path.getsize(SRC) >= HEAD_BYTES:
        return
    os.makedirs(CACHE, exist_ok=True)
    print('downloading the first %d MB of %s' % (HEAD_BYTES >> 20, URL))
    req = urllib.request.Request(URL, headers={'Range': 'bytes=0-%d' % (HEAD_BYTES - 1), 'User-Agent': 'puzzle-builder'})
    with urllib.request.urlopen(req) as r, open(SRC + '.part', 'wb') as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    os.replace(SRC + '.part', SRC)


def rows():
    import zstandard
    with open(SRC, 'rb') as f:
        reader = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(f), encoding='utf8', errors='replace')
        it = csv.reader(reader)
        header = next(it)
        col = {k: i for i, k in enumerate(header)}
        try:
            for r in it:
                yield r, col
        except zstandard.ZstdError:
            pass  # the download stops part-way through a frame; the rows before it are complete
        except csv.Error:
            pass


def main():
    fetch()
    pool = []
    last_id = None
    for r, col in rows():
        try:
            pid, fen, moves = r[col['PuzzleId']], r[col['FEN']], r[col['Moves']].split()
            rating, dev, pop, plays = int(r[col['Rating']]), int(r[col['RatingDeviation']]), int(r[col['Popularity']]), int(r[col['NbPlays']])
            tags = r[col['Themes']].split()
        except (IndexError, ValueError, KeyError):
            continue
        last_id = pid
        if not (MIN_RATING <= rating < MAX_RATING + BUCKET):
            continue
        if pop < 85 or plays < 250 or dev > 90:
            continue
        if len(moves) < 2 or len(moves) > 10 or len(moves) % 2:
            continue
        keep = [THEME_INDEX[t] for t in tags if t in THEME_INDEX]
        pool.append((pid, fen, ' '.join(moves), rating, sorted(keep)))
    # the last row read may have been cut off mid-line
    pool = [p for p in pool if p[0] != last_id]
    print('pool:', len(pool), 'puzzles after filtering')

    rnd = random.Random(SEED)
    rnd.shuffle(pool)
    chosen = {}
    by_bucket = defaultdict(list)
    for p in pool:
        by_bucket[min(MAX_RATING, p[3]) // BUCKET].append(p)
    for b in range(MIN_RATING // BUCKET, MAX_RATING // BUCKET + 1):
        for p in by_bucket[b][:PER_BUCKET]:
            chosen[p[0]] = p
    count = defaultdict(int)
    for p in chosen.values():
        for t in p[4]:
            count[t] += 1
    for t, (key, _) in enumerate(THEMES):
        need = PER_THEME - count[t]
        if need <= 0:
            continue
        # top up evenly across ratings so a theme's list is not all easy or all hard
        extra = [p for p in pool if t in p[4] and p[0] not in chosen]
        extra.sort(key=lambda p: p[3])
        if not extra:
            continue
        step = max(1, len(extra) // need)
        for p in extra[::step][:need]:
            chosen[p[0]] = p
            for tt in p[4]:
                count[tt] += 1

    out = sorted(chosen.values(), key=lambda p: (p[3], p[0]))
    lines = ['|'.join([p[0], p[1], p[2], str(p[3]), ','.join(map(str, p[4]))]) for p in out]
    with open(OUT, 'w', encoding='utf8') as f:
        f.write('/* Generated by tools/make_puzzles.py from the Lichess puzzle database (lichess.org, CC0).\n')
        f.write('   Rows: lichess id|FEN|UCI moves (first one is the opponent\'s)|rating|theme numbers. */\n')
        f.write('(function (g) {\n  const RW = (g.RW = g.RW || {});\n')
        f.write('  RW.PUZZLE_THEMES = [' + ', '.join("['%s', '%s']" % (k, n) for k, n in THEMES) + '];\n')
        f.write('  RW.PUZZLES = `' + '\n'.join(lines) + '`;\n')
        f.write("})(typeof window !== 'undefined' ? window : globalThis);\n")
    print('wrote', len(out), 'puzzles to', os.path.relpath(OUT))
    for t, (key, name) in enumerate(THEMES):
        print('  %-18s %d' % (name, count[t]))
    hist = defaultdict(int)
    for p in out:
        hist[p[3] // 500 * 500] += 1
    print('  by rating:', dict(sorted(hist.items())))


if __name__ == '__main__':
    main()
