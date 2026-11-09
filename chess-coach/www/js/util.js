/* Shared chess helpers: board arrays, attackers, exchange evaluation, win chances. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  const FILES = 'abcdefgh';

  const idx = (sq) => (8 - +sq[1]) * 8 + FILES.indexOf(sq[0]);
  const sqName = (i) => FILES[i & 7] + (8 - (i >> 3));
  const other = (c) => (c === 'w' ? 'b' : 'w');
  const uci = (m) => m.from + m.to + (m.promotion || '');

  function flat(chess) {
    const b = chess.board();
    const out = new Array(64);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) out[r * 8 + f] = b[r][f] ? { type: b[r][f].type, color: b[r][f].color } : null;
    return out;
  }

  const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  /* Squares holding a piece of `color` that attacks square index t. */
  function attackersOf(b, t, color) {
    const r = t >> 3, f = t & 7, out = [];
    const at = (rr, ff) => (rr < 0 || rr > 7 || ff < 0 || ff > 7 ? null : b[rr * 8 + ff]);
    const pr = r + (color === 'w' ? 1 : -1);
    for (const df of [-1, 1]) {
      const p = at(pr, f + df);
      if (p && p.color === color && p.type === 'p') out.push(pr * 8 + f + df);
    }
    for (const [dr, df] of KN) {
      const p = at(r + dr, f + df);
      if (p && p.color === color && p.type === 'n') out.push((r + dr) * 8 + f + df);
    }
    for (const [dr, df] of KG) {
      const p = at(r + dr, f + df);
      if (p && p.color === color && p.type === 'k') out.push((r + dr) * 8 + f + df);
    }
    const ray = (dirs, types) => {
      for (const [dr, df] of dirs) {
        let rr = r + dr, ff = f + df;
        while (rr >= 0 && rr <= 7 && ff >= 0 && ff <= 7) {
          const p = b[rr * 8 + ff];
          if (p) {
            if (p.color === color && types.includes(p.type)) out.push(rr * 8 + ff);
            break;
          }
          rr += dr; ff += df;
        }
      }
    };
    ray(ORTH, 'rq');
    ray(DIAG, 'bq');
    return out;
  }

  /* Static exchange evaluation: material the mover nets on the target square
     if both sides keep capturing with their cheapest piece. Negative = loses material. */
  function see(board, from, to) {
    const b = board.slice();
    const gain = [];
    let d = 0;
    let side = b[from].color;
    let onSq = VAL[b[from].type];
    gain[0] = b[to] ? VAL[b[to].type] : 0;
    b[to] = b[from];
    b[from] = null;
    side = other(side);
    for (;;) {
      const att = attackersOf(b, to, side);
      if (!att.length) break;
      let best = att[0];
      for (const a of att) if (VAL[b[a].type] < VAL[b[best].type]) best = a;
      d++;
      gain[d] = onSq - gain[d - 1];
      onSq = VAL[b[best].type];
      b[to] = b[best];
      b[best] = null;
      side = other(side);
      if (d > 30) break;
    }
    while (d > 0) {
      gain[d - 1] = -Math.max(-gain[d - 1], gain[d]);
      d--;
    }
    return gain[0];
  }

  /* Material balance from pov's side, in pawns. */
  function balance(chess, pov) {
    let s = 0;
    for (const p of flat(chess)) if (p && p.type !== 'k') s += (p.color === pov ? 1 : -1) * VAL[p.type];
    return s;
  }

  /* Count of knights, bishops, rooks and queens on the board. */
  function pieceCount(chess) {
    let n = 0;
    for (const p of flat(chess)) if (p && p.type !== 'k' && p.type !== 'p') n++;
    return n;
  }

  /* Win chance for White, 0..100, from an evaluation {cp} | {mate} | {mate:0, won}. */
  function winPct(ev) {
    if (!ev) return 50;
    if (ev.mate != null) {
      if (ev.mate === 0) return ev.won === 'w' ? 100 : ev.won === 'b' ? 0 : 50;
      return ev.mate > 0 ? 100 : 0;
    }
    const cp = Math.max(-2000, Math.min(2000, ev.cp || 0));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
  }
  const povPct = (ev, color) => (color === 'w' ? winPct(ev) : 100 - winPct(ev));

  function evalText(ev) {
    if (!ev) return '';
    if (ev.mate != null) {
      if (ev.mate === 0) return ev.won === 'w' ? '1-0' : ev.won === 'b' ? '0-1' : '½';
      return (ev.mate < 0 ? '-M' : 'M') + Math.abs(ev.mate);
    }
    const v = (ev.cp || 0) / 100;
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1);
  }

  /* Turn a list of UCI moves into SAN, starting from fen. */
  function pvToSan(fen, pv, max) {
    const c = new g.Chess(fen);
    const out = [];
    for (const u of (pv || []).slice(0, max || 6)) {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      if (!m) break;
      out.push(m.san);
    }
    return out;
  }

  RW.U = { VAL, NAME, FILES, idx, sqName, other, uci, flat, attackersOf, see, balance, pieceCount, winPct, povPct, evalText, pvToSan };
})(typeof window !== 'undefined' ? window : globalThis);
