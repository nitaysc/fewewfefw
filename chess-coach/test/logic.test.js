// Checks the pure logic: opening book, exchange evaluation, grading, accuracy, and what the coach
// concludes about a move. Coach checks look at its structured findings (motif, mood, kind), not at
// exact wording, because the wording is varied on purpose.
const assert = require('assert');
const path = require('path');
globalThis.Chess = require(path.join(__dirname, '../www/vendor/chess.js')).Chess;
for (const f of ['util', 'openings', 'review', 'coach', 'voice', 'sounds-map']) require(path.join(__dirname, '../www/js/' + f + '.js'));
const { U, Openings, Review, Coach, Voice, SOUND_MAP } = globalThis.RW;

/* Grade a move from a position with hand-written evaluations, the way the app does. */
function judge(fen, san, evB, evA, extra) {
  extra = extra || {};
  const c = new Chess(fen);
  const mv = c.move(san);
  assert(mv, 'illegal test move ' + san);
  const f = fen.split(' ');
  const ply = (parseInt(f[5], 10) - 1) * 2 + (f[1] === 'b' ? 1 : 0);
  const j = Review.judgeMove({ fenBefore: fen, move: mv, evBefore: evB, evAfter: evA, sans: extra.sans || [], prev: extra.prev || null });
  return Object.assign({}, mv, j, { ply, fenBefore: fen, fenAfter: c.fen(), evBefore: evB, evAfter: evA, prev: extra.prev || null, all: extra.all || [] });
}
const ev = (cp, best, pv, second) => ({ cp, best, pv: pv || [best], lines: [{ cp, pv: pv || [best] }].concat(second != null ? [{ cp: second, pv: ['a2a3'] }] : []) });

// ---------- opening book ----------
for (const [name, line] of Openings.LINES) {
  const c = new Chess();
  for (const san of line.split(' ')) assert(c.move(san), `illegal move ${san} in "${name}": ${line}`);
}
assert.strictEqual(Openings.nameFor(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']), 'Ruy Lopez');
assert.strictEqual(Openings.lookup(['e4', 'e5', 'Ke2']), null);
assert(Openings.idea('Sicilian Defense: Najdorf Variation').length > 10, 'variation falls back to its family note');
assert.strictEqual(Openings.idea('No Such Opening'), '');

// ---------- board helpers ----------
let c = new Chess('4k3/8/3p4/4p3/8/5N2/8/4K3 w - - 0 1');
assert.strictEqual(U.see(U.flat(c), U.idx('f3'), U.idx('e5')), -2, 'knight takes defended pawn loses 2');
c = new Chess('4k3/8/8/4p3/8/5N2/8/4K3 w - - 0 1');
assert.strictEqual(U.see(U.flat(c), U.idx('f3'), U.idx('e5')), 1, 'free pawn');
// a loose bishop on b4 attacked by the bishop on c3
c = new Chess('r3k2r/ppp2ppp/8/8/1b6/2B5/PP1Q1PPP/4K2R w Kkq - 0 1');
const hung = U.hanging(U.flat(c), 'b');
assert(hung.some((h) => h.sq === 'b4' && h.type === 'b'), 'finds the undefended bishop');
assert.deepStrictEqual(U.hanging(U.flat(new Chess()), 'w'), [], 'nothing hangs at the start');
// passing the move
const startPass = U.passFen(new Chess().fen());
assert.strictEqual(startPass.split(' ')[1], 'b');
assert.strictEqual(U.passFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'), null, 'cannot pass while in check');
// mate in one
assert.strictEqual(U.mateInOne('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1').san, 'Rd8#');
assert.strictEqual(U.mateInOne(new Chess().fen()), null);
// a bishop on b5 lined up against the knight on c6 with the king behind it
c = new Chess('r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 1 4');
const lu = U.lineUps(U.flat(c), U.idx('b5'));
assert(lu.some((l) => U.sqName(l.front) === 'c6' && U.sqName(l.back) === 'e8'), 'sees the pin line');
assert.strictEqual(U.hash('abc'), U.hash('abc'));
assert.notStrictEqual(U.hash('abc'), U.hash('abd'));

// ---------- win chances, accuracy, rating ----------
assert(Math.abs(U.winPct({ cp: 0 }) - 50) < 1e-9);
assert(U.winPct({ cp: 300 }) > 70 && U.winPct({ mate: -2 }) === 0);
assert(Review.moveAccuracy(0) > 99.9 && Review.moveAccuracy(30) < 30);
assert(Review.estimateElo(99) > Review.estimateElo(85) && Review.estimateElo(85) > Review.estimateElo(60));

// ---------- grading ----------
const START = new Chess().fen();
assert.strictEqual(judge(START, 'e4', ev(30, 'e2e4'), { cp: 30 }, { sans: ['e4'] }).cls, 'book');
const sacFen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5';
assert.strictEqual(judge(sacFen, 'Bxf7+', ev(150, 'c4f7'), { cp: 150 }).cls, 'brilliant', 'a sound piece sacrifice');
const forkFen = 'r3k2r/ppp2ppp/8/3N4/8/8/PPP2PPP/R3K2R w KQkq - 0 1';
const forkPv = ['d5c7', 'e8d7', 'c7a8'];
assert.strictEqual(judge(forkFen, 'Nxc7+', ev(400, 'd5c7', forkPv, 20), { cp: 400, best: 'e8d7', pv: ['e8d7', 'c7a8'] }).cls, 'great', 'the only winning move');

// ---------- what the coach concludes ----------
const explain = (j, user) => Coach.explain(j, user === undefined ? 'w' : user);

// leaves the queen where a knight takes it
let j = judge('r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3', 'Qxe5+', ev(20, 'g1f3'), { cp: -750, best: 'c6e5', pv: ['c6e5'] });
let ex = explain(j);
assert.strictEqual(j.cls, 'blunder');
assert.strictEqual(ex.motif, 'hung-piece');
assert.strictEqual(ex.mood, 'shocked');
assert(ex.text.includes('Nxe5'), 'names the move that punishes it');
assert(ex.text.includes('Nf3'), 'names the better move');
assert(ex.tip, 'gives a tip on a serious mistake');

// misses a knight fork that wins a rook
j = judge(forkFen, 'a3', ev(400, 'd5c7', forkPv), { cp: 20, best: 'c7c6', pv: ['c7c6'] });
ex = explain(j);
assert.strictEqual(ex.motif, 'missed-tactic');
assert(/fork/.test(ex.text) && ex.text.includes('Nxc7+'), ex.text);
// and the fork itself is described as a fork, not as winning a pawn
assert.strictEqual(Coach.idea(forkFen, new Chess(forkFen).move('Nxc7+'), 30, null).key, 'fork');

// walks into mate in one
j = judge('rnbqkbnr/pppp1ppp/8/4p3/5P2/8/PPPPP1PP/RNBQKBNR w KQkq - 0 2', 'g4', ev(-30, 'g1f3'), { mate: -1, best: 'd8h4', pv: ['d8h4'] });
ex = explain(j);
assert.strictEqual(ex.motif, 'allowed-mate');
assert(ex.text.includes('Qh4#'));

// misses mate in one
const mateFen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
const mateEv = { mate: 1, best: 'd1d8', pv: ['d1d8'], lines: [{ mate: 1, pv: ['d1d8'] }] };
j = judge(mateFen, 'h3', mateEv, { cp: 500, best: 'g7g6', pv: ['g7g6'] });
ex = explain(j);
assert.strictEqual(ex.motif, 'missed-mate');
assert(ex.text.includes('Rd8#'));
// plays it
j = judge(mateFen, 'Rd8#', mateEv, { mate: 0, won: 'w' });
ex = explain(j);
assert.strictEqual(j.cls, 'best');
assert.strictEqual(ex.mood, 'excited');
assert(/checkmate/i.test(ex.title));

// a mate in one is "best", not "great", even when every other move is far worse
const mateOnly = { mate: 1, best: 'd1d8', pv: ['d1d8'], lines: [{ mate: 1, pv: ['d1d8'] }, { cp: 20, pv: ['h2h3'] }] };
assert.strictEqual(judge(mateFen, 'Rd8#', mateOnly, { mate: 0, won: 'w' }).cls, 'best');
// while a quiet only-move in the same spot of the rules still earns "great"
assert.strictEqual(judge(forkFen, 'Nxc7+', ev(400, 'd5c7', forkPv, 20), { cp: 400, best: 'e8d7', pv: ['e8d7', 'c7a8'] }).cls, 'great');

// a dropped pawn is named as a dropped pawn, rather than blamed on a general principle
j = judge('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', 'Qh5', ev(40, 'e4d5', ['e4d5', 'd8d5']), { cp: -80, best: 'd5e4', pv: ['d5e4'] });
ex = explain(j);
assert.strictEqual(ex.motif, 'hung-pawn', ex.text);
assert(ex.text.includes('dxe4'), ex.text);

// opening principles explain a quiet inaccuracy
const e4e5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
assert.strictEqual(explain(judge(e4e5, 'Qh5', ev(30, 'g1f3'), { cp: -40, best: 'b8c6', pv: ['b8c6'] })).motif, 'principle-queen');
assert.strictEqual(explain(judge(e4e5, 'Ke2', ev(30, 'g1f3'), { cp: -90, best: 'b8c6', pv: ['b8c6'] })).motif, 'principle-king');

// the opponent's errors are described in the third person, without a tip for them
j = judge('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3', 'Bc5', ev(-20, 'g8f6'), { mate: 1, best: 'f3f7', pv: ['f3f7'] });
ex = explain(j, 'w');
assert.strictEqual(ex.motif, 'allowed-mate');
assert.strictEqual(ex.tip, '');
assert(!/\bYou\b|\byour\b/.test(ex.text.split('.')[0]), 'does not address the opponent as you: ' + ex.text);

// a pin is recognised as a pin
const pinFen = 'r1bqkbnr/ppp2ppp/2np4/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 4';
assert.strictEqual(Coach.idea(pinFen, new Chess(pinFen).move('Bb5'), 6, null).key, 'pin');

// every grade produces a title, some text and a known mood, for both sides and for a neutral reader
const MOODS = ['neutral', 'happy', 'excited', 'thinking', 'worried', 'shocked'];
for (const user of ['w', 'b', null]) {
  for (const [san, evA] of [['Nf3', { cp: 30 }], ['Qh5', { cp: -40 }], ['Ke2', { cp: -300 }], ['d4', { cp: 28 }], ['a3', { cp: 10 }]]) {
    const r = Coach.explain(judge(e4e5, san, ev(30, 'g1f3', ['g1f3'], 25), Object.assign({ best: 'b8c6', pv: ['b8c6'] }, evA)), user);
    assert(r.title && r.text && MOODS.includes(r.mood), 'explain(' + san + ', ' + user + ')');
    assert(!/undefined|NaN|null/.test(r.title + r.text + r.tip), 'clean text for ' + san + ': ' + r.text);
  }
}

// ---------- threats ----------
let th = Coach.threats('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 3 3', 'Marlo');
assert.strictEqual(th.kind, 'mate');
assert.strictEqual(th.sq, 'f7');
assert.strictEqual(Coach.threats(START, 'Marlo'), null, 'no warning in a quiet position');
th = Coach.threats('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', 'Marlo');
assert.strictEqual(th.kind, 'check');
// a threat that takes two moves, found from the "what if I pass" search
th = Coach.threats('r3k2r/ppp2ppp/8/3N4/8/8/PPP2PPP/R3K2R b KQkq - 0 1', 'Marlo', { pv: forkPv, cp: 400 });
assert.strictEqual(th.kind, 'tactic');
assert(th.text.includes('Nxc7+'));
// a loose piece is flagged without any engine help
th = Coach.threats('r3k2r/ppp2ppp/8/8/1b6/2B5/PP1Q1PPP/4K2R b Kkq - 0 1', 'Marlo');
assert.strictEqual(th.kind, 'hang');
assert.strictEqual(th.sq, 'b4');

// ---------- hints, retry, focus ----------
const stages = [1, 2, 3].map((s) => Coach.hint(forkFen, 'd5c7', 30, null, s));
assert(stages[0].more && !stages[0].square && !stages[0].arrow, 'first hint is only a nudge');
assert.strictEqual(stages[1].square, 'd5', 'second hint names the piece');
assert.deepStrictEqual(stages[2].arrow, { from: 'd5', to: 'c7' }, 'third hint shows the move');
assert.strictEqual(stages[2].more, false);
assert.strictEqual(Coach.hint(forkFen, 'a1a8', 30, null, 1), null, 'no hint for an impossible move');

j = judge(forkFen, 'a3', ev(400, 'd5c7', forkPv), { cp: 20, best: 'c7c6', pv: ['c7c6'] });
const tryMove = (san) => new Chess(forkFen).move(san);
assert.strictEqual(Coach.retry(j, tryMove('Nxc7+'), 0, true).ok, true);
assert.strictEqual(Coach.retry(j, tryMove('a3'), j.loss, false).ok, false, 'the game move is not an answer');
assert.strictEqual(Coach.retry(j, tryMove('Nf6+'), 1, false).ok, true, 'a near-equal move is accepted');
assert.strictEqual(Coach.retry(j, tryMove('h3'), 40, false).ok, false);

const blunders = [judge('r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3', 'Qxe5+', ev(20, 'g1f3'), { cp: -750, best: 'c6e5', pv: ['c6e5'] })];
assert(/protect/i.test(Coach.focus(blunders, 'w').title), 'a hung piece becomes the thing to work on');
assert(Coach.focus([], 'w').title, 'a clean game still gets a line');

const best = Coach.explainBest(j);
assert(best.title.includes('Nxc7+') && best.line[0] === 'Nxc7+');

// ---------- the coach's picture ----------
assert(/^<img src="img\/av\/coach\.webp"/.test(Coach.avatar('happy')), 'the coach has a picture');
assert(require('fs').existsSync(path.join(__dirname, '../www/img/av/coach.webp')), 'and the file is there');

// ---------- speech ----------
assert.strictEqual(Voice.speakable('Nxf3+ was best'), 'knight takes F 3, check was best');
assert.strictEqual(Voice.speakable('O-O-O'), 'castles queenside');
assert.strictEqual(Voice.speakable('e8=Q#'), 'E 8 promotes to queen, checkmate');
assert.strictEqual(Voice.speakable('Good move.'), 'Good move.', 'ordinary words are left alone');

// ---------- the long explanation ----------
// French Defense, 3. Ba6: the bishop can be taken, and the engine's dxe4 (hitting the knight too) is even stronger
const french = 'rnbqkbnr/ppp2ppp/4p3/3p4/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
const frenchReply = ['d5e4', 'a6e2', 'e4f3', 'e2f3'];
let afterBa6 = new Chess(french);
afterBa6.move('Ba6');
assert.strictEqual(Coach.lineSwing(afterBa6.fen(), frenchReply, 'w', 1), -3, 'a piece that falls after a quiet in-between move is counted');
j = judge(french, 'Ba6', ev(20, 'e4e5', ['e4e5', 'c7c5', 'c2c3']), { cp: -670, best: 'd5e4', pv: frenchReply });
let long = Coach.explain(j, 'w');
assert.strictEqual(long.motif, 'hung-piece', 'the coach says the bishop hangs, not just that a pawn drops');
assert(/bishop/.test(long.reason) && /a6/.test(long.reason), long.reason);
assert(long.points.length >= 3 && long.points.some((p) => p.bad) && long.points.some((p) => !p.bad), 'reasons for and against');
assert(long.points.some((p) => /down a piece/.test(p.text)), 'the cost is spelled out');
assert.strictEqual(long.best.san, 'e5');
assert.deepStrictEqual([long.best.from, long.best.to], ['e4', 'e5']);
assert.strictEqual(long.best.lineText, '3. e5 c5 4. c3');
assert.strictEqual(long.played.lineText, '3. Ba6 dxe4 4. Be2 exf3 5. Bxf3');
assert.strictEqual(long.stand.before, 'about level');
assert.strictEqual(long.stand.after, 'losing');
assert(!/undefined|NaN|null/.test(JSON.stringify(long)), 'clean long explanation');
// a good move has no bad points, and no "best" when it was the best
j = judge(french, 'e5', ev(20, 'e4e5', ['e4e5', 'c7c5', 'c2c3']), { cp: 22, best: 'c7c5', pv: ['c7c5', 'c2c3'] });
long = Coach.explain(j, 'w');
assert(long.points.length >= 1 && !long.points.some((p) => p.bad) && long.best === null);
// move numbers, starting with either side
assert.strictEqual(Coach.lineText(START, ['e4', 'e5', 'Nf3']), '1. e4 e5 2. Nf3');
assert.strictEqual(Coach.lineText(e4e5.replace(' w ', ' b '), ['Nc6', 'Nf3']), '2... Nc6 3. Nf3');
assert.strictEqual(Coach.standWords(50), 'about level');
assert.strictEqual(Coach.standWords(95), 'winning');
// a pawn pushed in front of the castled king is named as the problem
const castled = 'r2q1rk1/ppp1bppp/2np1n2/4p3/2B1P1b1/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8';
j = judge(castled, 'g3', ev(20, 'h2h3', ['h2h3', 'g4h5', 'c1e3']), { cp: -60, best: 'a7a6', pv: ['a7a6', 'c1e3', 'f8e8'] });
assert.strictEqual(Coach.explain(j, 'w').motif, 'king-shelter');
// a line that stops in the middle of an exchange is not read as a lost piece
assert.strictEqual(Coach.lineSwing(START, ['e2e4', 'd7d5', 'e4d5'], 'w', 1), 0, 'pawn takes, queen takes back');
assert.strictEqual(Coach.lineSwing(START, ['e2e4', 'd7d5', 'e4d5', 'd8d5'], 'w', 1), 0);
// quiet pawn moves get a reason of their own
const italian = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
assert.strictEqual(Coach.idea(italian, new Chess(italian).move('c3'), 6, null).key, 'prepare');
assert.strictEqual(Coach.idea(castled, new Chess(castled).move('h3'), 14, null).key, 'attack', 'h3 hits the bishop first of all');
// the written report: needs a few moves, and is clean text
assert.deepStrictEqual(Coach.report({ moves: [], sides: {} }, 'w', null, 'win'), []);
const gameMoves = [];
const gc = new Chess();
['e4', 'e6', 'Nf3', 'd5', 'Ba6', 'dxe4', 'Be2', 'exf3', 'Bxf3', 'Nf6'].forEach((san, i) => {
  const fenB = gc.fen();
  const mv = gc.move(san);
  const white = i % 2 === 0;
  const drop = san === 'Ba6';
  const evB = ev(drop || i > 4 ? (i > 4 ? -670 : 20) : 20, drop ? 'e4e5' : mv.from + mv.to, drop ? ['e4e5', 'c7c5', 'c2c3'] : [mv.from + mv.to]);
  const evA = { cp: i >= 4 ? -670 : 20, best: 'a7a6', pv: drop ? frenchReply : ['a7a6'] };
  const jj = Review.judgeMove({ fenBefore: fenB, move: mv, evBefore: evB, evAfter: evA, sans: [], prev: gameMoves[i - 1] || null });
  gameMoves.push(Object.assign({}, mv, jj, { ply: i, phase: 'opening', fenBefore: fenB, fenAfter: gc.fen(), evBefore: evB, evAfter: evA, prev: gameMoves[i - 1] || null, all: gameMoves }));
});
const phases = { opening: { acc: 60 }, middlegame: { acc: null }, endgame: { acc: null } };
const rep = Coach.report({ moves: gameMoves, sides: { w: { phases }, b: { phases } }, opening: 'French Defense' }, 'w', null, 'loss');
assert(rep.length >= 2 && rep.every((r) => r.cls && r.text && !/undefined|NaN|null/.test(r.text)), 'a clean report');
assert(rep.some((r) => /Ba6/.test(r.text)), 'the report names the turning point');
assert(rep.some((r) => /French Defense/.test(r.text)), 'and the opening');

// ---------- saved reviews ----------
const packed = Review.pack([{ cp: 31, best: 'e2e4', pv: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6', 'e1g1', 'f8e7'], lines: [{ cp: 31, pv: ['e2e4'] }, { cp: 25, pv: ['d2d4'] }], depth: 14 },
  { mate: 0, won: 'w', lines: [], terminal: true }]);
assert.strictEqual(packed[0].pv.length, 8, 'long lines are trimmed');
assert.strictEqual(packed[0].lines[1].cp, 25, 'the second line survives, since grading needs it');
assert.deepStrictEqual(JSON.parse(JSON.stringify(packed[1])), { mate: 0, won: 'w', terminal: true, pv: [], lines: [] });

// ---------- sound sprite ----------
const used = ['move1', 'move2', 'move3', 'move4', 'capture1', 'capture2', 'capture3', 'castle', 'ding1', 'ding2', 'ding3'];
let end = 0;
for (const name of used) {
  assert(SOUND_MAP[name], 'sound clip "' + name + '" is in the sprite map');
  const [at, len] = SOUND_MAP[name];
  assert(at >= end - 1e-9 && len > 0.05, 'clip "' + name + '" does not overlap the one before it');
  end = at + len;
}

console.log('logic tests passed (' + Openings.LINES.length + ' opening lines)');
