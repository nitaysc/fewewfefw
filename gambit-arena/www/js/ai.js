// Chess bot: small alpha-beta search with material and piece-square tables.
// Captures are not free in this game (the attacker has to win a duel), so the bot discounts
// what it expects to gain from a capture by its chance of winning the fight.
import { legalMoves, applyMove, inCheck, typeOf, colorOf, rankOf, fileOf } from './chess.js';
import { duelOdds } from './pieces.js';

const VAL = { p: 100, n: 300, b: 320, r: 500, q: 900, k: 0 };

// Bonus tables from White's point of view, index = rank * 8 + file
const CENTER = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 2, 4, 6, 6, 4, 2, 0,
  0, 4, 10, 14, 14, 10, 4, 0,
  0, 6, 14, 22, 22, 14, 6, 0,
  0, 6, 14, 22, 22, 14, 6, 0,
  0, 4, 10, 14, 14, 10, 4, 0,
  0, 2, 4, 6, 6, 4, 2, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
];

function pieceBonus(p, s) {
  const t = typeOf(p);
  const white = colorOf(p) === 'w';
  const r = white ? rankOf(s) : 7 - rankOf(s);
  const idx = r * 8 + fileOf(s);
  switch (t) {
    case 'p': return r * 8 + (fileOf(s) >= 2 && fileOf(s) <= 5 ? CENTER[idx] / 2 : 0);
    case 'n': return CENTER[idx] - (r === 0 ? 10 : 0);
    case 'b': return CENTER[idx] / 2 - (r === 0 ? 8 : 0);
    case 'r': return r === 6 ? 15 : 0;
    case 'q': return CENTER[idx] / 4;
    case 'k': return r === 0 && (fileOf(s) <= 2 || fileOf(s) >= 6) ? 20 : -r * 6;
  }
  return 0;
}

export function evaluate(s) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.board[i];
    if (!p) continue;
    const v = VAL[typeOf(p)] + pieceBonus(p, i);
    score += colorOf(p) === 'w' ? v : -v;
  }
  return s.turn === 'w' ? score : -score;
}

function order(moves) {
  return moves.sort((a, b) => (b.captured ? 10 * VAL[typeOf(b.captured)] - VAL[typeOf(b.piece)] : 0) -
    (a.captured ? 10 * VAL[typeOf(a.captured)] - VAL[typeOf(a.piece)] : 0));
}

function search(s, depth, alpha, beta) {
  if (depth === 0) return evaluate(s);
  const moves = order(legalMoves(s));
  if (!moves.length) return inCheck(s) ? -100000 - depth : 0;
  for (const m of moves) {
    const v = -search(applyMove(s, m), depth - 1, -beta, -alpha);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

// Picks a move. level: 0 easy, 1 normal, 2 hard. rnd lets tests make it deterministic.
export function chooseMove(s, level = 1, rnd = Math.random) {
  const moves = order(legalMoves(s));
  if (!moves.length) return null;
  const depth = level === 0 ? 1 : level === 1 ? 2 : 3;
  const noise = level === 0 ? 120 : level === 1 ? 30 : 8;
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    let v = -search(applyMove(s, m), depth - 1, -Infinity, Infinity);
    if (m.captured) {
      // a lost duel costs the attacker; scale the plan by the odds of winning it
      const p = duelOdds(typeOf(m.piece), typeOf(m.captured));
      v = p * v + (1 - p) * (evaluate(s) - VAL[typeOf(m.piece)] - 40);
    }
    v += (rnd() - 0.5) * noise;
    if (v > bestScore) { bestScore = v; best = m; }
  }
  return best;
}
