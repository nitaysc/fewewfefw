/* Game review: evaluate every position, grade every move, score accuracy, estimate rating. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  const U = RW.U;

  const CLS = {
    brilliant: { label: 'Brilliant', sym: '!!', phrase: 'brilliant' },
    great: { label: 'Great', sym: '!', phrase: 'a great move' },
    best: { label: 'Best', sym: '★', phrase: 'the best move' },
    excellent: { label: 'Excellent', sym: '✓', phrase: 'excellent' },
    good: { label: 'Good', sym: '+', phrase: 'good' },
    book: { label: 'Book', sym: '≡', phrase: 'a book move' },
    forced: { label: 'Forced', sym: '→', phrase: 'forced' },
    inaccuracy: { label: 'Inaccuracy', sym: '?!', phrase: 'an inaccuracy' },
    mistake: { label: 'Mistake', sym: '?', phrase: 'a mistake' },
    miss: { label: 'Miss', sym: '×', phrase: 'a missed chance' },
    blunder: { label: 'Blunder', sym: '??', phrase: 'a blunder' }
  };
  const ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  const BAD = ['inaccuracy', 'mistake', 'miss', 'blunder'];

  /* Evaluate one position. Scores come back from White's point of view. */
  async function evalPosition(engine, fen, o) {
    const c = new g.Chess(fen);
    if (c.in_checkmate()) return { mate: 0, won: U.other(c.turn()), lines: [], terminal: true };
    if (c.game_over()) return { cp: 0, lines: [], terminal: true };
    const r = await engine.analyse(fen, o);
    if (!r || !r.lines.length) return null;
    const s = c.turn() === 'w' ? 1 : -1;
    const lines = r.lines.map((l) => (l.mate != null ? { mate: l.mate * s, pv: l.pv } : { cp: l.cp * s, pv: l.pv }));
    const top = lines[0];
    return { cp: top.cp, mate: top.mate, best: top.pv[0], pv: top.pv, lines, depth: r.lines[0].depth };
  }

  const moveAccuracy = (loss) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));

  /* Grade a single move from the evaluations before and after it. */
  function judgeMove(a) {
    const { fenBefore, move, evBefore, evAfter, sans, prev } = a;
    const me = move.color;
    const before = new g.Chess(fenBefore);
    const board = U.flat(before);
    const legal = before.moves().length;
    const wpB = U.povPct(evBefore, me);
    const wpA = U.povPct(evAfter, me);
    const isBest = !!evBefore.best && U.uci(move) === evBefore.best;
    let loss = isBest ? 0 : Math.max(0, wpB - wpA);

    let bestSan = null;
    if (evBefore.best) bestSan = U.pvToSan(fenBefore, [evBefore.best], 1)[0] || null;

    const out = { loss, acc: moveAccuracy(loss), isBest, bestSan, best: evBefore.best, wpB, wpA, opening: null };
    const bookHit = RW.Openings.lookup(sans);
    if (bookHit) out.opening = bookHit.name;

    let cls;
    if (legal === 1) cls = 'forced';
    else if (bookHit && loss < 10) cls = 'book';
    else if (isBest) cls = 'best';
    else if (loss < 2) cls = 'excellent';
    else if (loss < 5) cls = 'good';
    else if (loss < 10) cls = 'inaccuracy';
    else if (loss < 20) cls = 'mistake';
    else cls = 'blunder';

    const from = U.idx(move.from), to = U.idx(move.to);
    const exchange = U.see(board, from, to);
    out.see = exchange;
    const recapture = !!(prev && prev.captured && prev.to === move.to);

    if (cls === 'best' || cls === 'excellent') {
      // a sound sacrifice of real material
      if (move.piece !== 'p' && move.piece !== 'k' && exchange <= -2 && wpA >= 50 && wpB <= 97 && !move.san.includes('#')) {
        cls = 'brilliant';
      } else if (cls === 'best' && evBefore.lines && evBefore.lines.length > 1 && !recapture) {
        // the only move that holds the evaluation
        const second = U.povPct(evBefore.lines[1], me);
        const obviousCapture = move.captured && exchange >= 2;
        if (wpB - second >= 20 && wpB >= 35 && second < 90 && !obviousCapture) cls = 'great';
      }
    }
    if ((cls === 'inaccuracy' || cls === 'mistake' || cls === 'blunder') && loss >= 10) {
      const hadMate = evBefore.mate != null && evBefore.mate !== 0 && (evBefore.mate > 0) === (me === 'w');
      const gift = prev && BAD.includes(prev.cls);
      if (wpB >= 70 && wpA >= 35 && (gift || hadMate)) cls = 'miss';
    }
    out.cls = cls;
    return out;
  }

  function gameAccuracy(accs) {
    if (!accs.length) return null;
    const mean = accs.reduce((s, x) => s + x, 0) / accs.length;
    const harm = accs.length / accs.reduce((s, x) => s + 1 / Math.max(x, 1), 0);
    return (mean + harm) / 2;
  }

  /* Rating a player would need to play at this accuracy over a game. An estimate only. */
  function estimateElo(acc) {
    if (acc == null) return null;
    let e;
    if (acc < 45) e = 100 + (acc / 45) * 300;
    else e = 400 + 2700 * Math.pow((acc - 45) / 55, 2.2);
    return Math.max(100, Math.min(3200, Math.round(e / 50) * 50));
  }

  function gradeFor(acc) {
    if (acc == null) return null;
    return acc >= 92 ? 'best' : acc >= 84 ? 'excellent' : acc >= 74 ? 'good' : acc >= 62 ? 'inaccuracy' : acc >= 48 ? 'mistake' : 'blunder';
  }

  function summarize(moves, fens) {
    const sides = {};
    for (const c of ['w', 'b']) {
      const mine = moves.filter((m) => m.color === c);
      const counts = {};
      ORDER.forEach((k) => (counts[k] = 0));
      mine.forEach((m) => { if (counts[m.cls] != null) counts[m.cls]++; });
      const acc = gameAccuracy(mine.map((m) => m.acc));
      const phases = {};
      for (const ph of ['opening', 'middlegame', 'endgame']) {
        const a = gameAccuracy(mine.filter((m) => m.phase === ph).map((m) => m.acc));
        phases[ph] = { acc: a, grade: gradeFor(a) };
      }
      sides[c] = { acc, counts, elo: mine.length >= 10 ? estimateElo(acc) : null, phases, n: mine.length };
    }
    return sides;
  }

  /* Review a whole game. moves: chess.js verbose history. */
  async function analyzeGame(o) {
    const { engine, moves, startFen, movetime, onProgress, alive } = o;
    const c = startFen ? new g.Chess(startFen) : new g.Chess();
    const fens = [c.fen()];
    for (const m of moves) {
      c.move({ from: m.from, to: m.to, promotion: m.promotion });
      fens.push(c.fen());
    }
    const evals = [];
    for (let i = 0; i < fens.length; i++) {
      if (alive && !alive()) return null;
      const ev = await evalPosition(engine, fens[i], { movetime: movetime || 450, depth: 18, multipv: 2 });
      if (!ev) return null;
      evals.push(ev);
      if (onProgress) onProgress((i + 1) / fens.length);
    }
    const out = [];
    const sans = [];
    let inBook = true;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      sans.push(m.san);
      const j = judgeMove({ fenBefore: fens[i], move: m, evBefore: evals[i], evAfter: evals[i + 1], sans: inBook ? sans.slice() : [], prev: out[i - 1] });
      if (j.cls !== 'book') inBook = false;
      const pos = new g.Chess(fens[i]);
      const phase = i < 16 && (inBook || i < 12) ? 'opening' : U.pieceCount(pos) <= 6 ? 'endgame' : 'middlegame';
      out.push(Object.assign({}, m, j, { ply: i, phase, fenBefore: fens[i], fenAfter: fens[i + 1], evBefore: evals[i], evAfter: evals[i + 1], prev: out[i - 1] }));
    }
    return { fens, evals, moves: out, sides: summarize(out, fens), opening: RW.Openings.nameFor(moves.map((m) => m.san)) };
  }

  RW.Review = { CLS, ORDER, BAD, evalPosition, judgeMove, analyzeGame, moveAccuracy, gameAccuracy, estimateElo, gradeFor };
})(typeof window !== 'undefined' ? window : globalThis);
