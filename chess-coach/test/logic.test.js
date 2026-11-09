// Checks the pure logic: opening book legality, exchange evaluation, grading, accuracy, coach text.
const assert = require('assert');
const path = require('path');
globalThis.Chess = require(path.join(__dirname, '../www/vendor/chess.js')).Chess;
for (const f of ['util', 'openings', 'review', 'coach']) require(path.join(__dirname, '../www/js/' + f + '.js'));
const { U, Openings, Review, Coach } = globalThis.RW;

// every book line is a legal game
for (const [name, line] of Openings.LINES) {
  const c = new Chess();
  for (const san of line.split(' ')) assert(c.move(san), `illegal move ${san} in "${name}": ${line}`);
}
assert.strictEqual(Openings.nameFor(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']), 'Ruy Lopez');
assert.strictEqual(Openings.lookup(['e4', 'e5', 'Ke2']), null);

// exchange evaluation
let c = new Chess('4k3/8/3p4/4p3/8/5N2/8/4K3 w - - 0 1');
assert.strictEqual(U.see(U.flat(c), U.idx('f3'), U.idx('e5')), -2, 'knight takes defended pawn loses 2');
c = new Chess('4k3/8/8/4p3/8/5N2/8/4K3 w - - 0 1');
assert.strictEqual(U.see(U.flat(c), U.idx('f3'), U.idx('e5')), 1, 'free pawn');

// win chances and accuracy
assert(Math.abs(U.winPct({ cp: 0 }) - 50) < 1e-9);
assert(U.winPct({ cp: 300 }) > 70 && U.winPct({ mate: -2 }) === 0);
assert(Review.moveAccuracy(0) > 99.9 && Review.moveAccuracy(30) < 30);
assert(Review.estimateElo(99) > Review.estimateElo(85) && Review.estimateElo(85) > Review.estimateElo(60));

// grading: hanging the queen is a blunder, and the coach says why
const fenBefore = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
c = new Chess(fenBefore);
const mv = c.move('Qh5'); c.move('Nc6'); const fen2 = c.fen(); const bad = c.move('Qxe5+'); // Qxe5+?? Nxe5
const j = Review.judgeMove({ fenBefore: fen2, move: bad, evBefore: { cp: 20, best: 'g1f3', pv: ['g1f3'], lines: [{ cp: 20, pv: ['g1f3'] }] }, evAfter: { cp: -750, best: 'c6e5', pv: ['c6e5'] }, sans: [], prev: null });
assert.strictEqual(j.cls, 'blunder');
const ex = Coach.explain(Object.assign({}, bad, j, { ply: 4, fenBefore: fen2, fenAfter: c.fen(), evBefore: { cp: 20, best: 'g1f3', pv: ['g1f3'] }, evAfter: { cp: -750, pv: ['c6e5'] } }), 'w');
assert(/hanging/.test(ex.text), ex.text);

// best move in book is a book move; a sound sacrifice is brilliant
const jb = Review.judgeMove({ fenBefore: new Chess().fen(), move: new Chess().move('e4'), evBefore: { cp: 30, best: 'e2e4', pv: ['e2e4'], lines: [] }, evAfter: { cp: 30 }, sans: ['e4'], prev: null });
assert.strictEqual(jb.cls, 'book');
c = new Chess('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5');
const sac = c.move('Bxf7+');
const js = Review.judgeMove({ fenBefore: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5', move: sac, evBefore: { cp: 150, best: 'c4f7', pv: ['c4f7'], lines: [{ cp: 150, pv: ['c4f7'] }] }, evAfter: { cp: 150 }, sans: [], prev: null });
assert.strictEqual(js.cls, 'brilliant');
console.log('logic tests passed (' + Openings.LINES.length + ' opening lines)');
