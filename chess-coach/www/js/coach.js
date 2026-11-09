/* The coach: turns engine findings into plain-language feedback about a move. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  const U = RW.U;
  const { VAL, NAME } = U;

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const WHAT = (n) => (n >= 8 ? 'the queen' : n >= 5 ? 'a rook' : n >= 3 ? 'a piece' : n >= 2 ? 'material' : 'a pawn');

  /* Who are we talking about? `you` for the player being coached, else a side name. */
  function voice(color, userColor) {
    if (userColor && color === userColor) return { subj: 'you', poss: 'your', obj: 'you', s: '', is: 'are', opp: 'your opponent' };
    const n = color === 'w' ? 'White' : 'Black';
    return { subj: n, poss: n + "'s", obj: n, s: 's', is: 'is', opp: userColor ? 'you' : color === 'w' ? 'Black' : 'White' };
  }

  /* Play a line and report the material change for pov. Plays at least `min` plies,
     then keeps going while the line keeps capturing. */
  function lineSwing(fen, pv, pov, min) {
    const c = new g.Chess(fen);
    const start = U.balance(c, pov);
    let i = 0;
    for (const u of pv || []) {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      if (!m) break;
      i++;
      if (i >= min) {
        const next = pv[i];
        if (!next) break;
        const target = c.get(next.slice(2, 4));
        if (!target && !next[4] && i >= min) break;
      }
      if (i >= 10) break;
    }
    return U.balance(c, pov) - start;
  }

  /* What does this move do? Returns a short gerund phrase ("developing the knight"). */
  function describe(fenBefore, move, ply, prev) {
    const before = new g.Chess(fenBefore);
    const board = U.flat(before);
    const after = new g.Chess(fenBefore);
    after.move({ from: move.from, to: move.to, promotion: move.promotion });
    const b2 = U.flat(after);
    const me = move.color, them = U.other(me);
    const to = U.idx(move.to);
    const piece = NAME[move.promotion || move.piece];

    if (move.san.includes('#')) return 'delivering checkmate';
    if (move.flags.includes('k') || move.flags.includes('q')) return 'getting the king to safety and bringing a rook into play';
    if (move.promotion) return 'promoting to a ' + NAME[move.promotion];

    // what the moved piece now attacks
    const targets = [];
    for (let i = 0; i < 64; i++) {
      const p = b2[i];
      if (!p || p.color !== them) continue;
      if (!U.attackersOf(b2, i, me).includes(to)) continue;
      const defended = U.attackersOf(b2, i, them).length > 0;
      if (p.type === 'k' || VAL[p.type] > VAL[b2[to].type] || (!defended && p.type !== 'p')) targets.push({ i, p });
    }
    const safe = U.attackersOf(b2, to, them).length === 0 || U.see(b2, U.attackersOf(b2, to, them)[0], to) <= 0;
    const tname = (t) => (t.p.type === 'k' ? 'king' : NAME[t.p.type]);

    if (move.captured) {
      const got = NAME[move.captured];
      const ex = U.see(board, U.idx(move.from), to);
      if (prev && prev.captured && prev.to === move.to) return ex >= 1 ? 'recapturing and coming out ahead' : 'recapturing to keep material level';
      if (ex >= VAL[move.captured] && VAL[move.captured] >= 3) return 'picking up a free ' + got;
      if (ex >= 2) return 'winning material by taking the ' + got;
      if (ex >= 1) return 'winning a pawn';
      if (move.captured === move.piece) return 'trading ' + got + 's';
      return 'taking the ' + got;
    }
    if (targets.length >= 2 && safe) {
      targets.sort((x, y) => VAL[y.p.type] - VAL[x.p.type]);
      return 'forking the ' + tname(targets[0]) + ' and ' + tname(targets[1]);
    }
    if (move.san.includes('+')) return targets.length > 1 ? 'giving check and hitting the ' + tname(targets.find((t) => t.p.type !== 'k') || targets[0]) : 'giving check';
    if (targets.length === 1 && safe && targets[0].p.type !== 'k') return 'attacking the ' + tname(targets[0]) + ' on ' + U.sqName(targets[0].i);

    const homeRank = me === 'w' ? '1' : '8';
    if (ply < 24 && (move.piece === 'n' || move.piece === 'b') && move.from[1] === homeRank) return 'developing the ' + piece + ' toward the center';
    if (move.piece === 'p' && ply < 16 && ['d4', 'e4', 'd5', 'e5', 'c4', 'c5'].includes(move.to)) return 'taking space in the center';
    if (move.piece === 'r') {
      const f = to & 7;
      let pawns = 0;
      for (let r = 0; r < 8; r++) if (b2[r * 8 + f] && b2[r * 8 + f].type === 'p') pawns++;
      if (pawns === 0) return 'putting the rook on an open file';
    }
    if (move.piece === 'p') {
      const rank = +move.to[1];
      if ((me === 'w' && rank >= 6) || (me === 'b' && rank <= 3)) return 'pushing the pawn closer to promotion';
    }
    // moved out of danger?
    const from = U.idx(move.from);
    const wasHit = U.attackersOf(board, from, them);
    if (wasHit.length && move.piece !== 'p' && U.see(board, wasHit[0], from) > 0 && safe) return 'moving the ' + piece + ' out of danger';
    if (move.piece === 'k' && U.pieceCount(after) <= 6) return 'bringing the king into the fight';
    return move.piece === 'p' ? 'making a useful pawn move' : 'improving the ' + piece;
  }

  function standing(wp, v) {
    if (wp >= 85) return cap(v.subj) + ' ' + v.is + ' still winning.';
    if (wp >= 65) return cap(v.subj) + ' ' + (v.subj === 'you' ? 'keep' : 'keeps') + ' the better position.';
    if (wp >= 40) return 'The game is about level now.';
    if (wp >= 20) return cap(v.opp) + (v.opp === 'you' ? ' are' : ' is') + ' clearly better now.';
    return cap(v.opp) + (v.opp === 'you' ? ' are' : ' is') + ' winning now.';
  }

  /* Build the coach's comment for a graded move.
     j: graded move (from Review.judgeMove merged with the move), plus fenBefore, fenAfter, evBefore, evAfter. */
  function explain(j, userColor) {
    const v = voice(j.color, userColor);
    const cls = RW.Review.CLS[j.cls];
    const mine = userColor && j.color === userColor;
    const title = j.san + ' is ' + cls.phrase;
    let text = '';
    const what = describe(j.fenBefore, j, j.ply, j.prev);
    let bestMove = null, bestWhat = '';
    if (j.best && !j.isBest) {
      const c = new g.Chess(j.fenBefore);
      bestMove = c.move({ from: j.best.slice(0, 2), to: j.best.slice(2, 4), promotion: j.best[4] });
      if (bestMove) bestWhat = describe(j.fenBefore, bestMove, j.ply, j.prev);
    }
    const me = j.color;
    const mateFor = (ev) => (ev && ev.mate != null && ev.mate !== 0 ? ((ev.mate > 0) === (me === 'w') ? Math.abs(ev.mate) : -Math.abs(ev.mate)) : 0);

    switch (j.cls) {
      case 'book':
        text = (j.opening ? 'This is theory: the ' + j.opening + '. ' : 'A well-known opening move. ') + cap(what) + ' is a standard idea here.';
        break;
      case 'forced':
        text = 'It was the only legal move, so there was nothing to decide.';
        break;
      case 'brilliant':
        text = (mine ? 'You give' : cap(v.subj) + ' gives') + ' up the ' + NAME[j.piece] + ' on ' + j.to + ', and it works. The sacrifice is the strongest idea in the position.';
        break;
      case 'great':
        text = 'This was the one move that holds everything together, ' + what + '. Other moves were much worse.';
        break;
      case 'best':
        text = (mine ? 'Exactly what I would play: ' : 'The top engine choice: ') + what + '.';
        if (j.san.includes('#')) text = 'Checkmate. Game over.';
        break;
      case 'excellent':
        text = cap(what) + ' is nearly as strong as the top choice' + (j.bestSan ? ' (' + j.bestSan + ')' : '') + '.';
        break;
      case 'good':
        text = 'A solid move, ' + what + '.' + (j.bestSan ? ' ' + j.bestSan + ' was a little more precise' + (bestWhat ? ', ' + bestWhat : '') + '.' : '');
        break;
      default: {
        const hadMate = mateFor(j.evBefore), nowMate = mateFor(j.evAfter);
        const reply = j.evAfter && j.evAfter.pv && j.evAfter.pv.length ? U.pvToSan(j.fenAfter, j.evAfter.pv, 1)[0] : null;
        const playedSwing = (j.captured ? VAL[j.captured] : 0) + (j.promotion ? VAL[j.promotion] - 1 : 0) + lineSwing(j.fenAfter, j.evAfter && j.evAfter.pv, me, 1);
        const bestSwing = lineSwing(j.fenBefore, j.evBefore && j.evBefore.pv, me, 3);
        const better = j.bestSan ? ' ' + j.bestSan + ' was the move' + (bestWhat ? ', ' + bestWhat : '') + '.' : '';
        if (nowMate < 0) {
          text = 'This allows a forced checkmate in ' + -nowMate + (reply ? ', starting with ' + reply : '') + '.' + better;
        } else if (hadMate > 0 && nowMate <= 0) {
          text = 'There was a forced checkmate in ' + hadMate + (j.bestSan ? ', starting with ' + j.bestSan : '') + '. ' + standing(j.wpA, v);
        } else if (playedSwing <= -2 && bestSwing - playedSwing >= 2 && reply) {
          const after = new g.Chess(j.fenAfter);
          const r = after.move(reply);
          if (r && r.captured && r.to === j.to) {
            text = 'That leaves ' + v.poss + ' ' + NAME[j.promotion || j.piece] + ' on ' + j.to + ' hanging. ' + reply + ' simply wins it.' + better;
          } else if (r && r.captured) {
            text = 'This loses ' + WHAT(-playedSwing) + ': ' + reply + ' takes the ' + NAME[r.captured] + ' on ' + r.to + '.' + better;
          } else {
            text = 'This loses ' + WHAT(-playedSwing) + ' after ' + reply + '.' + better;
          }
        } else if (bestSwing >= 2 && bestSwing - playedSwing >= 2 && j.bestSan) {
          text = (mine ? 'You' : cap(v.subj)) + ' could have won ' + WHAT(bestSwing) + ' with ' + j.bestSan + (bestWhat && !/improving/.test(bestWhat) ? ', ' + bestWhat : '') + '. ' + standing(j.wpA, v);
        } else {
          const lead =
            j.cls === 'inaccuracy' ? 'Playable, but it lets some of the advantage slip.'
            : j.cls === 'miss' ? cap(v.opp) + ' slipped on the last move and this does not punish it.'
            : j.cls === 'mistake' ? 'This makes the position noticeably harder to play.'
            : 'This gives away a lot of the position' + (reply ? ' after ' + reply : '') + '.';
          text = lead + better + (j.cls === 'blunder' || j.cls === 'mistake' ? ' ' + standing(j.wpA, v) : '');
        }
      }
    }
    return { title, text, cls: j.cls };
  }

  /* Follow-up when the player asks to see the best move. */
  function explainBest(j) {
    if (!j.best) return { title: 'No better move found', text: '' };
    const c = new g.Chess(j.fenBefore);
    const m = c.move({ from: j.best.slice(0, 2), to: j.best.slice(2, 4), promotion: j.best[4] });
    if (!m) return { title: 'No better move found', text: '' };
    const line = U.pvToSan(j.fenBefore, j.evBefore.pv, 5);
    return {
      title: m.san + ' was best',
      text: cap(describe(j.fenBefore, m, j.ply, j.prev)) + '.' + (line.length > 1 ? ' A likely continuation: ' + line.join(' ') + '.' : ''),
      cls: 'best'
    };
  }

  RW.Coach = { explain, explainBest, describe, lineSwing, voice };
})(typeof window !== 'undefined' ? window : globalThis);
