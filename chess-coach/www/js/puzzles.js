/* Puzzle logic: the bundled puzzle list, judging a move, rating changes, and which puzzle comes next.
   No DOM here, so the tests can run it in Node. The screen itself lives in puzzle-screen.js. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  let list = null, byIdMap = null;

  /* All puzzles as {id, fen, moves:[uci], rating, themes:[theme number]}, easiest first. */
  function all() {
    if (!list) {
      list = String(RW.PUZZLES || '').split('\n').filter(Boolean).map((line) => {
        const f = line.split('|');
        return { id: f[0], fen: f[1], moves: f[2].split(' '), rating: +f[3], themes: f[4] ? f[4].split(',').map(Number) : [] };
      });
      byIdMap = new Map(list.map((p) => [p.id, p]));
    }
    return list;
  }
  const byId = (id) => (all(), byIdMap.get(id) || null);
  const byTheme = (t) => all().filter((p) => p.themes.includes(t));
  const themeName = (t) => (RW.PUZZLE_THEMES[t] || ['', ''])[1];
  const themeKey = (t) => (RW.PUZZLE_THEMES[t] || ['', ''])[0];
  /* The puzzle's FEN is the position before the opponent's move, so the solver is the other side. */
  const solverColor = (p) => (p.fen.split(' ')[1] === 'w' ? 'b' : 'w');
  const solverMoves = (p) => p.moves.length / 2;

  /* Is `u` (UCI) right at step k (an index into p.moves) from position fen? The listed move is right,
     and so is any other move that mates on the spot, as on Lichess. */
  function check(p, k, fen, u) {
    if (u === p.moves[k]) return 'correct';
    const c = new g.Chess(fen);
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    return m && c.in_checkmate() ? 'correct' : 'wrong';
  }

  /* Rating change for one rated puzzle. Elo with a K that starts large so a new player finds their level
     within a few dozen puzzles, then settles. n: rated puzzles played before this one. */
  function rate(mine, theirs, won, n) {
    const k = Math.max(14, 44 - 0.3 * (n || 0));
    const expect = 1 / (1 + Math.pow(10, (theirs - mine) / 400));
    const d = Math.round(k * ((won ? 1 : 0) - expect));
    return d === 0 ? (won ? 1 : -1) : d;
  }

  /* A puzzle near `rating` the player has not seen, widening the window until one turns up.
     o: {rating, seen:Set, theme?, spread?} */
  function pick(o) {
    const pool = o.theme != null ? byTheme(o.theme) : all();
    const seen = o.seen || new Set();
    for (let w = o.spread || 90; w < 4000; w += 90) {
      const c = pool.filter((p) => !seen.has(p.id) && Math.abs(p.rating - o.rating) <= w);
      if (c.length >= 3 || (w > 600 && c.length)) return c[Math.floor(Math.random() * c.length)];
    }
    // everything seen: start over with the closest ones
    const near = pool.slice().sort((a, b) => Math.abs(a.rating - o.rating) - Math.abs(b.rating - o.rating)).slice(0, 12);
    return near[Math.floor(Math.random() * near.length)] || null;
  }

  /* Puzzle Rush: the n-th puzzle of a run (from 0) aims at this rating. Easy to start, then steeper. */
  const rushTarget = (n) => Math.round(520 + n * 48 + Math.max(0, n - 18) * 34);
  const pickRush = (n, seen) => pick({ rating: rushTarget(n), seen, spread: 60 });

  /* The puzzle of the day: the same for everyone on a given date, picked from mid-strength puzzles. */
  function daily(date) {
    const pool = all().filter((p) => p.rating >= 1250 && p.rating <= 2100 && p.moves.length >= 4);
    return pool[RW.U.hash('rookwise-daily-' + date) % pool.length];
  }

  /* Local calendar date as YYYY-MM-DD. */
  function today(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function yesterday(date) {
    const [y, m, dd] = date.split('-').map(Number);
    return today(new Date(y, m - 1, dd - 1));
  }

  RW.Puzzles = { all, byId, byTheme, themeName, themeKey, solverColor, solverMoves, check, rate, pick, rushTarget, pickRush, daily, today, yesterday };
})(typeof window !== 'undefined' ? window : globalThis);
