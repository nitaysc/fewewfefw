// Move generator check against known perft counts, plus the duel-specific rules.
import assert from 'node:assert/strict';
import { fromFEN, newGame, perft, legalMoves, applyMove, applyFailedCapture, status, parseSq, toFEN, START } from '../www/js/chess.js';
import { chooseMove } from '../www/js/ai.js';

const cases = [
  [START, [20, 400, 8902, 197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];
for (const [fen, counts] of cases) {
  const s = fromFEN(fen);
  counts.forEach((n, i) => assert.equal(perft(s, i + 1), n, `perft ${i + 1} of ${fen}`));
}
assert.equal(toFEN(fromFEN(START)), START);

// a failed capture removes the attacker and keeps the defender
let s = fromFEN('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
const cap = legalMoves(s, parseSq('e4')).find((m) => m.captured);
const after = applyFailedCapture(s, cap);
assert.equal(after.board[parseSq('e4')], '');
assert.equal(after.board[parseSq('d5')], 'p');
assert.equal(after.turn, 'b');

// a pinned piece that loses its duel exposes its own king: that side loses
s = fromFEN('4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1');
const pinCap = legalMoves(s, parseSq('e2')).find((m) => m.captured);
assert.equal(status(applyFailedCapture(s, pinCap)), 'exposed');
// a king that loses its duel is gone
s = fromFEN('4k3/8/8/8/8/8/3p4/4K3 w - - 0 1');
const kCap = legalMoves(s, parseSq('e1')).find((m) => m.captured);
assert.equal(status(applyFailedCapture(s, kCap)), 'kingless');

// mate detection
assert.equal(status(fromFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')), 'checkmate');

// the bot finds mate in one and plays legal moves for a while
s = fromFEN('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
const mv = chooseMove(s, 2, () => 0.5);
assert.equal(status(applyMove(s, mv)), 'checkmate');
s = newGame();
const t0 = Date.now();
for (let i = 0; i < 20 && ['play', 'check'].includes(status(s)); i++) s = applyMove(s, chooseMove(s, 2));
console.log(`hard bot: 20 plies in ${Date.now() - t0} ms`);
console.log('chess tests passed');
