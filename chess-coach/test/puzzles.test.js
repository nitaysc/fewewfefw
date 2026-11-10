// Plays every bundled puzzle through with chess.js, and checks the puzzle logic: how a move is judged,
// rating changes, picking a puzzle near the player's rating, Puzzle Rush difficulty and the daily pick.
const assert = require('assert');
const path = require('path');
globalThis.Chess = require(path.join(__dirname, '../www/vendor/chess.js')).Chess;
for (const f of ['util', 'puzzles-data', 'puzzles']) require(path.join(__dirname, '../www/js/' + f + '.js'));
const { Puzzles: P, PUZZLE_THEMES } = globalThis.RW;

const all = P.all();
assert(all.length > 2500, 'enough puzzles: ' + all.length);
const ids = new Set();
const mateThemes = new Set(['mateIn1', 'mateIn2', 'mateIn3', 'backRankMate', 'smotheredMate']);
for (const p of all) {
  assert(!ids.has(p.id), 'duplicate puzzle ' + p.id);
  ids.add(p.id);
  assert(p.rating >= 400 && p.rating < 3100, p.id + ' rating ' + p.rating);
  assert(p.moves.length >= 2 && p.moves.length % 2 === 0, p.id + ' move count');
  const c = new Chess();
  assert(c.load(p.fen), p.id + ' FEN loads');
  for (const u of p.moves) assert(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }), p.id + ' plays ' + u);
  const themes = p.themes.map((t) => PUZZLE_THEMES[t][0]);
  if (themes.some((t) => mateThemes.has(t))) assert(c.in_checkmate(), p.id + ' is a mate puzzle and ends in mate');
  if (themes.includes('mateIn1')) assert.strictEqual(p.moves.length, 2, p.id + ' mate in 1 is one move');
  // the solver's color is the side to move after the opponent's first move
  assert.strictEqual(P.solverColor(p), p.fen.split(' ')[1] === 'w' ? 'b' : 'w');
}
for (let t = 0; t < PUZZLE_THEMES.length; t++) assert(P.byTheme(t).length >= 50, 'theme ' + PUZZLE_THEMES[t][1] + ' has puzzles');

// ---------- judging a move ----------
// Lichess 0000H: after Qh5 the solver mates with Qxg2#
const q = all.find((p) => p.id === '0000H') || all.find((p) => p.moves.length === 2);
const start = new Chess(q.fen);
start.move({ from: q.moves[0].slice(0, 2), to: q.moves[0].slice(2, 4), promotion: q.moves[0][4] });
const sol = q.moves[1];
assert.strictEqual(P.check(q, 1, start.fen(), sol), 'correct');
const legal = start.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ''));
const wrong = legal.find((u) => {
  if (u === sol) return false;
  const c = new Chess(start.fen());
  c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  return !c.in_checkmate();
});
assert.strictEqual(P.check(q, 1, start.fen(), wrong), 'wrong');
// any other move that mates on the spot also solves it (as on Lichess)
const altMate = new Chess('6k1/5ppp/8/8/8/8/5PPP/R2R2K1 w - - 0 1');
const fake = { moves: ['h2h3', 'a1a8'] };
assert.strictEqual(P.check(fake, 1, altMate.fen(), 'd1d8'), 'correct', 'a different mate counts');

// ---------- rating ----------
const up = P.rate(1200, 1200, true, 0), down = P.rate(1200, 1200, false, 0);
assert(up > 0 && down < 0, 'win gains, loss costs');
assert(P.rate(1200, 1600, true, 0) > P.rate(1200, 1000, true, 0), 'a harder puzzle is worth more');
assert(Math.abs(P.rate(1200, 1200, true, 200)) < Math.abs(up), 'rating moves less once settled');
assert(Math.abs(P.rate(1200, 1200, true, 400)) >= 6, 'but never stops moving');

// ---------- picking ----------
const seen = new Set();
for (let i = 0; i < 40; i++) {
  const p = P.pick({ rating: 1500, seen });
  assert(Math.abs(p.rating - 1500) <= 250, 'picked near the rating: ' + p.rating);
  assert(!seen.has(p.id), 'no repeats');
  seen.add(p.id);
}
const mates = P.pick({ rating: 1000, seen: new Set(), theme: 0 });
assert(mates.themes.includes(0), 'theme filter');
// rush: easy first, harder later
assert(P.rushTarget(0) < 800 && P.rushTarget(30) > 1800, 'rush gets harder');
// daily: the same puzzle all day, a different one the next day
assert.strictEqual(P.daily('2026-11-10').id, P.daily('2026-11-10').id);
assert.notStrictEqual(P.daily('2026-11-10').id, P.daily('2026-11-11').id);

console.log('puzzle tests passed (' + all.length + ' puzzles, ' + PUZZLE_THEMES.length + ' themes)');
