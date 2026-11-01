// Chess rules: board, legal moves, check, mate. Pure data, no DOM, shared by the game,
// the bot and the tests. Square index = rank * 8 + file; rank 0 is White's back rank.
// Pieces are FEN letters: uppercase White, lowercase Black, '' for empty.

export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const colorOf = (p) => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
export const typeOf = (p) => (p ? p.toLowerCase() : null);
export const other = (c) => (c === 'w' ? 'b' : 'w');
export const sq = (file, rank) => rank * 8 + file;
export const fileOf = (s) => s & 7;
export const rankOf = (s) => s >> 3;
export const sqName = (s) => 'abcdefgh'[fileOf(s)] + (rankOf(s) + 1);
export const parseSq = (n) => sq(n.charCodeAt(0) - 97, +n[1] - 1);

export function fromFEN(fen) {
  const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
  const board = Array(64).fill('');
  placement.split('/').forEach((row, i) => {
    const rank = 7 - i;
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) file += +ch;
      else board[sq(file++, rank)] = ch;
    }
  });
  return {
    board,
    turn: turn || 'w',
    castle: castling && castling !== '-' ? castling : '',
    ep: ep && ep !== '-' ? parseSq(ep) : -1,
    half: +half || 0,
    full: +full || 1,
  };
}

export function toFEN(s) {
  let out = '';
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = s.board[sq(f, r)];
      if (!p) { empty++; continue; }
      if (empty) { out += empty; empty = 0; }
      out += p;
    }
    if (empty) out += empty;
    if (r) out += '/';
  }
  return `${out} ${s.turn} ${s.castle || '-'} ${s.ep >= 0 ? sqName(s.ep) : '-'} ${s.half} ${s.full}`;
}

export const newGame = () => fromFEN(START);
export const clone = (s) => ({ ...s, board: s.board.slice() });

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK_D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function step(s, df, dr) {
  const f = fileOf(s) + df, r = rankOf(s) + dr;
  return f >= 0 && f < 8 && r >= 0 && r < 8 ? sq(f, r) : -1;
}

// Is square `target` attacked by any piece of colour `by`?
export function attacked(board, target, by) {
  const up = by === 'w' ? 1 : -1;
  // pawns attack diagonally forward, so look one rank "behind" the target from their side
  for (const df of [-1, 1]) {
    const s = step(target, df, -up);
    if (s >= 0 && board[s] === (by === 'w' ? 'P' : 'p')) return true;
  }
  const N = by === 'w' ? 'N' : 'n', K = by === 'w' ? 'K' : 'k';
  for (const [df, dr] of KNIGHT) { const s = step(target, df, dr); if (s >= 0 && board[s] === N) return true; }
  for (const [df, dr] of KING) { const s = step(target, df, dr); if (s >= 0 && board[s] === K) return true; }
  const slide = (dirs, kinds) => {
    for (const [df, dr] of dirs) {
      let s = target;
      for (;;) {
        s = step(s, df, dr);
        if (s < 0) break;
        const p = board[s];
        if (!p) continue;
        if (colorOf(p) === by && kinds.includes(typeOf(p))) return true;
        break;
      }
    }
    return false;
  };
  return slide(ROOK_D, 'rq') || slide(BISHOP_D, 'bq');
}

export const kingSquare = (board, c) => board.indexOf(c === 'w' ? 'K' : 'k');
export const inCheck = (s, c = s.turn) => {
  const k = kingSquare(s.board, c);
  return k >= 0 && attacked(s.board, k, other(c));
};

function pseudoMoves(s) {
  const out = [];
  const { board, turn } = s;
  const add = (from, to, extra) => out.push({ from, to, piece: board[from], captured: board[to] || '', ...extra });
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || colorOf(p) !== turn) continue;
    const t = typeOf(p);
    if (t === 'p') {
      const up = turn === 'w' ? 1 : -1;
      const startRank = turn === 'w' ? 1 : 6, lastRank = turn === 'w' ? 7 : 0;
      const pushPawn = (to, extra) => {
        if (rankOf(to) === lastRank) for (const promo of 'qrbn') add(from, to, { ...extra, promo });
        else add(from, to, extra);
      };
      const one = step(from, 0, up);
      if (one >= 0 && !board[one]) {
        pushPawn(one);
        const two = step(from, 0, 2 * up);
        if (rankOf(from) === startRank && !board[two]) add(from, two, { double: true });
      }
      for (const df of [-1, 1]) {
        const to = step(from, df, up);
        if (to < 0) continue;
        if (board[to] && colorOf(board[to]) !== turn) pushPawn(to);
        else if (to === s.ep) add(from, to, { ep: true, captured: turn === 'w' ? 'p' : 'P' });
      }
      continue;
    }
    if (t === 'n' || t === 'k') {
      for (const [df, dr] of t === 'n' ? KNIGHT : KING) {
        const to = step(from, df, dr);
        if (to >= 0 && colorOf(board[to]) !== turn) add(from, to);
      }
      if (t === 'k') {
        const home = turn === 'w' ? 4 : 60;
        const enemy = other(turn);
        const [kSide, qSide] = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
        if (from === home && !attacked(board, home, enemy)) {
          if (s.castle.includes(kSide) && !board[home + 1] && !board[home + 2] &&
              board[home + 3] === (turn === 'w' ? 'R' : 'r') &&
              !attacked(board, home + 1, enemy) && !attacked(board, home + 2, enemy)) add(from, home + 2, { castle: 'k' });
          if (s.castle.includes(qSide) && !board[home - 1] && !board[home - 2] && !board[home - 3] &&
              board[home - 4] === (turn === 'w' ? 'R' : 'r') &&
              !attacked(board, home - 1, enemy) && !attacked(board, home - 2, enemy)) add(from, home - 2, { castle: 'q' });
        }
      }
      continue;
    }
    const dirs = t === 'r' ? ROOK_D : t === 'b' ? BISHOP_D : [...ROOK_D, ...BISHOP_D];
    for (const [df, dr] of dirs) {
      let to = from;
      for (;;) {
        to = step(to, df, dr);
        if (to < 0) break;
        if (!board[to]) { add(from, to); continue; }
        if (colorOf(board[to]) !== turn) add(from, to);
        break;
      }
    }
  }
  return out;
}

// Plays a move (no duel: the mover takes the square). Returns a new state.
export function applyMove(s, m) {
  const n = clone(s);
  const b = n.board;
  const p = b[m.from];
  b[m.to] = m.promo ? (s.turn === 'w' ? m.promo.toUpperCase() : m.promo) : p;
  b[m.from] = '';
  if (m.ep) b[m.to + (s.turn === 'w' ? -8 : 8)] = '';
  if (m.castle) {
    const home = s.turn === 'w' ? 0 : 56;
    if (m.castle === 'k') { b[home + 5] = b[home + 7]; b[home + 7] = ''; }
    else { b[home + 3] = b[home]; b[home] = ''; }
  }
  n.castle = stripCastle(s.castle, m.from, m.to);
  n.ep = m.double ? (m.from + m.to) / 2 : -1;
  n.half = typeOf(p) === 'p' || m.captured ? 0 : s.half + 1;
  if (s.turn === 'b') n.full++;
  n.turn = other(s.turn);
  return n;
}

function stripCastle(castle, from, to) {
  let c = castle;
  const lose = (sqr, flags) => { if (from === sqr || to === sqr) for (const f of flags) c = c.replace(f, ''); };
  lose(4, 'KQ'); lose(60, 'kq'); lose(0, 'Q'); lose(7, 'K'); lose(56, 'q'); lose(63, 'k');
  return c;
}

// The attacker lost the duel: it is removed, the defender keeps its square, turn passes.
export function applyFailedCapture(s, m) {
  const n = clone(s);
  n.board[m.from] = '';
  n.castle = stripCastle(s.castle, m.from, -1);
  n.ep = -1;
  n.half = 0;
  if (s.turn === 'b') n.full++;
  n.turn = other(s.turn);
  return n;
}

export function legalMoves(s, from = -1) {
  return pseudoMoves(s).filter((m) => (from < 0 || m.from === from) && !inCheck(applyMove(s, m), s.turn));
}

function insufficient(board) {
  const rest = board.filter((p) => p && typeOf(p) !== 'k');
  if (rest.length === 0) return true;
  if (rest.length === 1 && 'bn'.includes(typeOf(rest[0]))) return true;
  return false;
}

// 'play' | 'check' | 'checkmate' | 'stalemate' | 'draw'
// | 'kingless' (a king fell in a duel; see loser()) | 'exposed' (the side that just moved
// left its own king in check after losing a duel, so it loses)
export function status(s) {
  if (kingSquare(s.board, 'w') < 0 || kingSquare(s.board, 'b') < 0) return 'kingless';
  if (inCheck(s, other(s.turn))) return 'exposed';
  const moves = legalMoves(s);
  const check = inCheck(s);
  if (!moves.length) return check ? 'checkmate' : 'stalemate';
  if (s.half >= 100 || insufficient(s.board)) return 'draw';
  return check ? 'check' : 'play';
}

// Colour that lost the game for a finished status, or null for a draw / game in progress
export function loser(s, st = status(s)) {
  if (st === 'kingless') return kingSquare(s.board, 'w') < 0 ? 'w' : 'b';
  if (st === 'exposed') return other(s.turn);
  if (st === 'checkmate') return s.turn;
  return null;
}

export function perft(s, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(s);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(applyMove(s, m), depth - 1);
  return n;
}

export const PIECE_NAMES = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };

export function moveText(m) {
  const t = typeOf(m.piece);
  if (m.castle) return m.castle === 'k' ? 'O-O' : 'O-O-O';
  const letter = t === 'p' ? '' : t.toUpperCase();
  const x = m.captured ? 'x' : '-';
  return `${letter}${sqName(m.from)}${x}${sqName(m.to)}${m.promo ? '=' + m.promo.toUpperCase() : ''}`;
}
