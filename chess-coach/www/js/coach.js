/* The coach: turns engine findings into plain-language feedback, hints and warnings.
   Everything here is rule-based: it reads the position, the engine's lines and the move's grade,
   works out what the move did (or failed to do), and says so in ordinary words. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  const U = RW.U;
  const { VAL, NAME } = U;

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const WHAT = (n) => (n >= 8 ? 'the queen' : n >= 5 ? 'a rook' : n >= 3 ? 'a piece' : n >= 2 ? 'material' : 'a pawn');
  const TACTICS = ['fork', 'pin', 'skewer', 'disc-check', 'discovered', 'threat-mate'];

  /* Who are we talking about? `you` for the player being coached, else a side name. */
  function voice(color, userColor, names) {
    if (userColor && color === userColor) {
      return { you: true, subj: 'you', Subj: 'You', poss: 'your', are: "you're", Are: "You're", s: '', opp: 'your opponent', oppPoss: "your opponent's" };
    }
    const n = (names && names[color]) || (color === 'w' ? 'White' : 'Black');
    const o = userColor ? 'you' : (names && names[U.other(color)]) || (color === 'w' ? 'Black' : 'White');
    return { you: false, subj: n, Subj: n, poss: n + "'s", are: n + ' is', Are: n + ' is', s: 's', opp: o, oppPoss: o === 'you' ? 'your' : o + "'s" };
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
        if (!c.get(next.slice(2, 4)) && !next[4]) break;
      }
      if (i >= 10) break;
    }
    return U.balance(c, pov) - start;
  }

  /* What does this move do? Returns {key, text}: a category and a short phrase
     that completes "you're ..." ("developing the knight toward the center"). */
  function idea(fenBefore, move, ply, prev) {
    const before = new g.Chess(fenBefore);
    const board = U.flat(before);
    const after = new g.Chess(fenBefore);
    after.move({ from: move.from, to: move.to, promotion: move.promotion });
    const b2 = U.flat(after);
    const me = move.color, them = U.other(me);
    const from = U.idx(move.from), to = U.idx(move.to);
    const piece = NAME[move.promotion || move.piece];
    const R = (key, text, extra) => Object.assign({ key, text }, extra || {});
    const pname = (p) => NAME[p.type];

    if (move.san.includes('#')) return R('mate', 'delivering checkmate');
    if (move.flags.includes('k') || move.flags.includes('q')) return R('castle', 'getting the king to safety and bringing a rook into play');
    if (move.promotion) return R('promote', 'promoting to a ' + NAME[move.promotion]);

    // what the moved piece now attacks
    const targets = [];
    for (let i = 0; i < 64; i++) {
      const p = b2[i];
      if (!p || p.color !== them) continue;
      if (!U.attackersOf(b2, i, me).includes(to)) continue;
      const defended = U.attackersOf(b2, i, them).length > 0;
      if (p.type === 'k' || VAL[p.type] > VAL[b2[to].type] || (!defended && p.type !== 'p')) targets.push({ i, p });
    }
    targets.sort((x, y) => VAL[y.p.type] - VAL[x.p.type]);
    const hitters = U.attackersOf(b2, to, them);
    const safe = !hitters.some((a) => U.see(b2, a, to) > 0);

    if (move.captured) {
      const got = NAME[move.captured];
      const ex = U.see(board, from, to);
      if (targets.length >= 2 && safe && VAL[move.captured] < VAL[targets[1].p.type]) {
        return R('fork', 'taking the ' + got + ' and forking the ' + pname(targets[0].p) + ' and ' + pname(targets[1].p));
      }
      if (prev && prev.captured && prev.to === move.to) return R('recapture', ex >= 1 ? 'recapturing and coming out ahead' : 'recapturing to keep material level');
      if (ex >= VAL[move.captured] && VAL[move.captured] >= 3) return R('free-piece', 'picking up a free ' + got);
      if (ex >= 2) return R('win-material', 'winning material by taking the ' + got);
      if (ex >= 1) return R('win-pawn', 'winning a pawn');
      if (move.captured === move.piece) return R('trade', 'trading ' + got + 's');
      return R('capture', 'taking the ' + got);
    }

    const kingIdx = b2.findIndex((p) => p && p.type === 'k' && p.color === them);
    const checkers = move.san.includes('+') ? U.attackersOf(b2, kingIdx, me) : [];
    if (checkers.length && !checkers.includes(to)) {
      return R('disc-check', 'uncovering a check from the ' + pname(b2[checkers[0]]));
    }
    if (targets.length >= 2 && safe) return R('fork', 'forking the ' + pname(targets[0].p) + ' and ' + pname(targets[1].p));

    // pins and skewers along the moved piece's lines
    if (safe) {
      for (const l of U.lineUps(b2, to)) {
        const F = b2[l.front], B = b2[l.back];
        if (F.type === 'k' || F.type === 'p') continue;
        if (B.type === 'k') return R('pin', 'pinning the ' + pname(F) + ' to the king');
        if (VAL[B.type] > VAL[F.type] && VAL[B.type] > VAL[b2[to].type]) return R('pin', 'pinning the ' + pname(F) + ' to the ' + pname(B));
        if (VAL[F.type] > VAL[B.type] && VAL[F.type] > VAL[b2[to].type] && VAL[B.type] >= 3) return R('skewer', 'skewering the ' + pname(F) + ' and the ' + pname(B) + ' behind it');
      }
    }
    if (checkers.length) {
      const also = targets.find((t) => t.p.type !== 'k');
      return also && safe ? R('fork', 'giving check and hitting the ' + pname(also.p)) : R('check', 'giving check');
    }

    // a queen newly attacked by one of our other pieces
    const q = b2.findIndex((p) => p && p.type === 'q' && p.color === them);
    if (q >= 0) {
      const now = U.attackersOf(b2, q, me).filter((a) => a !== to);
      const was = U.attackersOf(board, q, me);
      const fresh = now.find((a) => !was.includes(a));
      if (fresh != null) return R('discovered', 'uncovering an attack on the queen');
    }

    // threatening mate next move
    const pass = U.passFen(after.fen());
    if (pass) {
      const mate = U.mateInOne(pass);
      if (mate) return R('threat-mate', 'threatening checkmate on ' + mate.to, { mate: mate.san });
    }
    if (targets.length === 1 && safe) return R('attack', 'attacking the ' + pname(targets[0].p) + ' on ' + U.sqName(targets[0].i));

    // getting a piece out of trouble
    const wasHit = U.attackersOf(board, from, them);
    if (move.piece !== 'p' && move.piece !== 'k' && wasHit.some((a) => U.see(board, a, from) > 0) && safe) return R('escape', 'moving the ' + piece + ' out of danger');
    const hungBefore = U.hanging(board, me).filter((h) => h.sq !== move.from && h.gain >= 2);
    if (hungBefore.length) {
      const hungAfter = U.hanging(b2, me);
      const saved = hungBefore.find((h) => !hungAfter.some((x) => x.sq === h.sq));
      if (saved) return R('defend', 'defending the ' + NAME[saved.type] + ' on ' + saved.sq);
    }

    const homeRank = me === 'w' ? '1' : '8';
    if (ply < 24 && (move.piece === 'n' || move.piece === 'b') && move.from[1] === homeRank) {
      if (move.piece === 'b' && ['g2', 'b2', 'g7', 'b7'].includes(move.to)) return R('develop', 'putting the bishop on the long diagonal');
      return R('develop', 'developing the ' + piece + ' toward the center');
    }
    if (move.piece === 'p' && ply < 16 && ['d4', 'e4', 'd5', 'e5', 'c4', 'c5'].includes(move.to)) return R('center', 'taking space in the center');
    if (move.piece === 'r') {
      const f = to & 7;
      let pawns = 0;
      for (let r = 0; r < 8; r++) if (b2[r * 8 + f] && b2[r * 8 + f].type === 'p') pawns++;
      if (move.to[1] === (me === 'w' ? '7' : '2')) return R('seventh', 'putting the rook on the seventh rank');
      if (pawns === 0) return R('open-file', 'putting the rook on an open file');
    }
    if (move.piece === 'p') {
      const rank = +move.to[1];
      if ((me === 'w' && rank >= 6) || (me === 'b' && rank <= 3)) return R('push', 'pushing the pawn closer to promotion');
      return R('improve', (me === 'w' ? rank >= 5 : rank <= 4) ? 'gaining space with the pawn' : 'making a useful pawn move');
    }
    if (move.piece === 'k') return R('king', U.pieceCount(after) <= 6 ? 'bringing the king into the fight' : 'stepping the king to a safer square');
    if (move.piece === 'r') return R('improve', 'activating the rook');
    if (move.piece === 'q') return R('improve', 'repositioning the queen');
    return R('improve', 'bringing the ' + piece + ' to a better square');
  }
  const describe = (fenBefore, move, ply, prev) => idea(fenBefore, move, ply, prev).text;

  function standing(wp, v) {
    if (wp >= 85) return v.Are + ' still winning.';
    if (wp >= 65) return v.Subj + ' still ' + (v.you ? 'have' : 'has') + ' the better position.';
    if (wp >= 40) return 'The game is about level now.';
    if (wp >= 20) return cap(v.opp) + (v.opp === 'you' ? ' are' : ' is') + ' clearly better now.';
    return cap(v.opp) + (v.opp === 'you' ? ' are' : ' is') + ' winning now.';
  }

  const TIPS = {
    'hung-piece': 'Before you let go of a piece, check what can capture it there.',
    'hung-other': 'When you move a piece, ask what it was guarding.',
    'hung-pawn': 'Count attackers and defenders before you leave a pawn behind.',
    'ignored-threat': 'Start each turn by asking what their last move threatens.',
    'allowed-tactic': 'Look at their checks and captures before you commit to a move.',
    'allowed-mate': 'Keep an eye on your king: does it have an escape square?',
    'missed-mate': 'When the enemy king is exposed, look at every check.',
    'missed-capture': 'Scan for undefended pieces every move, theirs and yours.',
    'missed-tactic': 'Checks, captures and threats: look at those first, every move.',
    'principle-queen': 'In the opening, bring out knights and bishops before the queen.',
    'principle-tempo': 'In the opening, try to move each piece once and get everyone out.',
    'principle-king': 'Castle early so the king is not stuck in the middle.',
    'principle-rim': 'Knights are strongest near the center, where they reach the most squares.'
  };

  const MOOD = { brilliant: 'excited', great: 'happy', best: 'happy', excellent: 'happy', good: 'neutral', book: 'neutral', forced: 'neutral', inaccuracy: 'thinking', mistake: 'worried', miss: 'worried', blunder: 'shocked' };

  /* Opening-principle slips that explain an inaccuracy when no tactic does. */
  function principle(j, v, board) {
    const me = j.color, ply = j.ply;
    const hist = (j.all || []).slice(0, ply).filter((m) => m.color === me);
    const home = me === 'w' ? 7 : 0;
    let minorsHome = 0;
    for (let f = 0; f < 8; f++) { const p = board[home * 8 + f]; if (p && p.color === me && (p.type === 'n' || p.type === 'b')) minorsHome++; }
    const hit = U.attackersOf(board, U.idx(j.from), U.other(me)).length > 0;
    if (j.piece === 'q' && ply < 14 && !j.captured && minorsHome >= 3) {
      return { motif: 'principle-queen', text: 'Bringing the queen out this early usually just hands ' + v.opp + ' free developing moves while they chase it.' };
    }
    if ((j.piece === 'n' || j.piece === 'b') && ply < 16 && !j.captured && !hit && minorsHome >= 2 && hist.some((m) => m.to === j.from && m.piece === j.piece)) {
      return { motif: 'principle-tempo', text: 'That is the same ' + NAME[j.piece] + ' moving again while other pieces are still at home.' };
    }
    const rights = j.fenBefore.split(' ')[2];
    const canCastle = me === 'w' ? /[KQ]/.test(rights) : /[kq]/.test(rights);
    if (j.piece === 'k' && !j.flags.includes('k') && !j.flags.includes('q') && ply < 30 && canCastle && !new g.Chess(j.fenBefore).in_check()) {
      return { motif: 'principle-king', text: 'Moving the king gives up the right to castle, so it will be harder to keep safe.' };
    }
    if (j.piece === 'n' && ply < 20 && !j.captured && (j.to[0] === 'a' || j.to[0] === 'h')) {
      return { motif: 'principle-rim', text: 'On the edge of the board the knight reaches only a few squares.' };
    }
    return null;
  }

  /* Build the coach's comment for a graded move.
     j: the move merged with Review.judgeMove's result, plus fenBefore, fenAfter, evBefore, evAfter,
        prev (the move before) and optionally all (the full list of moves so far).
     Returns {title, text, cls, mood, motif, tip}. */
  function explain(j, userColor, names) {
    const v = voice(j.color, userColor, names);
    const cls = RW.Review.CLS[j.cls];
    const seed = U.hash(j.san + ':' + j.ply);
    const pick = (list, k) => list[(seed >>> (k || 0)) % list.length];
    const me = j.color;
    const what = idea(j.fenBefore, j, j.ply, j.prev);
    const out = { cls: j.cls, mood: MOOD[j.cls] || 'neutral', motif: null, tip: '' };
    out.title = j.san.includes('#') ? j.san + ' is checkmate' : j.san + ' is ' + cls.phrase;

    let bestMove = null, bestIdea = null;
    if (j.best && !j.isBest) {
      const c = new g.Chess(j.fenBefore);
      bestMove = c.move({ from: j.best.slice(0, 2), to: j.best.slice(2, 4), promotion: j.best[4] });
      if (bestMove) bestIdea = idea(j.fenBefore, bestMove, j.ply, j.prev);
    }
    const doing = v.Are + ' ' + what.text + '.';
    const mateFor = (ev) => (ev && ev.mate != null && ev.mate !== 0 ? ((ev.mate > 0) === (me === 'w') ? Math.abs(ev.mate) : -Math.abs(ev.mate)) : 0);

    switch (j.cls) {
      case 'book': {
        const sameAsBefore = j.prev && j.prev.opening === j.opening;
        const note = RW.Openings.idea(j.opening);
        if (j.opening && !sameAsBefore) out.text = 'Book move: this is the ' + j.opening + '.' + (note ? ' ' + note : '');
        else out.text = pick(['Still theory', 'Still in the book', 'A standard move'], 3) + (j.opening ? ' in the ' + j.opening : '') + '. ' + doing;
        break;
      }
      case 'forced':
        out.text = 'It was the only legal move, so there was nothing to decide.';
        break;
      case 'brilliant': {
        const m = mateFor(j.evAfter);
        out.text = pick(['What a move!', 'Brilliant!', 'Now that is special.']) + ' ' + v.Subj + ' give' + v.s + ' up the ' + NAME[j.piece] + ' on ' + j.to +
          (m > 0 ? ', and it leads to a forced checkmate.' : ', and it works: the sacrifice is the strongest idea in the position.');
        break;
      }
      case 'great':
        out.text = pick(['Great find. Everything else was clearly worse.', 'Well spotted. This was the only move that keeps things on track.', 'The only good move, and ' + (v.you ? 'you' : v.subj) + ' found it.']) + ' ' + doing;
        break;
      case 'best':
        if (j.san.includes('#')) { out.text = pick(['Checkmate! Game over.', 'And that is checkmate.', 'Checkmate. Nicely finished.']); out.mood = 'excited'; break; }
        out.text = (v.you ? pick(['Exactly what I would play.', 'That is the top move.', 'Spot on.', 'Right idea.', 'Nothing better here.']) : pick(['The strongest move.', 'The top engine choice.', 'Best.'])) + ' ' + doing;
        break;
      case 'excellent':
        out.text = pick(['A strong move.', 'Very nearly the best.', 'Good choice.']) + ' ' + doing +
          (j.bestSan && (seed >>> 5) % 2 === 0 ? ' ' + j.bestSan + ' was the engine\'s first pick, but there is very little in it.' : '');
        break;
      case 'good':
        out.text = pick(['A reasonable move.', 'That works.', 'Fine.']) + ' ' + doing +
          (j.bestSan ? ' ' + j.bestSan + ' was a little more precise' + (bestIdea && bestIdea.key !== 'improve' ? ', ' + bestIdea.text : '') + '.' : '');
        break;
      default: {
        const theirs = !v.you && !!userColor;
        const lead = j.cls === 'inaccuracy' ? pick(['A small slip.', 'Not the most precise.', 'Slightly off.'])
          : j.cls === 'mistake' ? (v.you ? pick(['That is a mistake.', 'This one costs something.', 'Careful.']) : theirs ? pick(['That helps you.', 'A mistake from ' + v.subj + '.']) : 'A mistake.')
          : j.cls === 'miss' ? (v.you ? pick(['So close.', 'There was more here.']) : theirs ? v.Subj + ' lets you off the hook.' : 'A chance goes begging.')
          : v.you ? pick(['Ouch.', 'Oh no.', 'That hurts.']) : theirs ? pick(['A serious error.', 'That is a gift.', 'A big slip from ' + v.subj + '.']) : pick(['A serious error.', 'A big slip.']);
        const hadMate = mateFor(j.evBefore), nowMate = mateFor(j.evAfter);
        const board = U.flat(new g.Chess(j.fenBefore));
        const afterC = new g.Chess(j.fenAfter);
        const bAfter = U.flat(afterC);
        const ru = j.evAfter && j.evAfter.pv && j.evAfter.pv[0];
        const reply = ru ? afterC.move({ from: ru.slice(0, 2), to: ru.slice(2, 4), promotion: ru[4] }) : null;
        const playedSwing = (j.captured ? VAL[j.captured] : 0) + (j.promotion ? VAL[j.promotion] - 1 : 0) + lineSwing(j.fenAfter, j.evAfter && j.evAfter.pv, me, 1);
        const bestSwing = lineSwing(j.fenBefore, j.evBefore && j.evBefore.pv, me, 3);
        const tail = bestIdea && bestIdea.key !== 'improve' ? ', ' + bestIdea.text : '';
        let better = j.bestSan ? ' ' + pick([j.bestSan + ' was the move' + tail + '.', 'Better was ' + j.bestSan + tail + '.', j.bestSan + ' was stronger' + tail + '.'], 7) : '';
        let reason, stand = j.cls === 'blunder' || j.cls === 'mistake';
        const mover = NAME[j.promotion || j.piece];

        if (nowMate < 0) {
          out.motif = 'allowed-mate';
          reason = nowMate === -1 && reply ? 'This allows ' + reply.san + ', and that is checkmate.'
            : 'This allows a forced checkmate in ' + -nowMate + (reply ? ', starting with ' + reply.san : '') + '.';
          stand = false;
        } else if (hadMate > 0 && nowMate <= 0) {
          out.motif = 'missed-mate';
          reason = hadMate === 1 ? v.Subj + ' missed checkmate: ' + j.bestSan + ' ends the game on the spot.'
            : 'There was a forced checkmate in ' + hadMate + (j.bestSan ? ', starting with ' + j.bestSan : '') + '.';
          better = '';
          stand = true;
        } else if (playedSwing <= -2 && bestSwing - playedSwing >= 2 && reply) {
          if (reply.captured && reply.to === j.to) {
            out.motif = 'hung-piece';
            const guarded = U.attackersOf(bAfter, U.idx(j.to), me).length > 0;
            reason = guarded ? cap(v.poss) + ' ' + mover + ' is attacked more times than it is defended on ' + j.to + ', so ' + reply.san + ' wins material.'
              : pick(['That leaves ' + v.poss + ' ' + mover + ' on ' + j.to + ' hanging. ' + reply.san + ' simply takes it.',
                cap(v.poss) + ' ' + mover + ' has no protection on ' + j.to + ', and ' + reply.san + ' wins it.'], 9);
          } else if (reply.captured) {
            const lost = NAME[reply.captured], sq = reply.to;
            const wasHanging = U.hanging(board, me).some((h) => h.sq === sq);
            const wasGuarded = U.attackersOf(board, U.idx(sq), me).includes(U.idx(j.from));
            if (wasHanging) {
              out.motif = 'ignored-threat';
              reason = cap(v.poss) + ' ' + lost + ' on ' + sq + ' was already under attack, and this does not save it. ' + reply.san + ' wins it.';
            } else if (wasGuarded) {
              out.motif = 'hung-other';
              reason = 'The ' + mover + ' was guarding ' + v.poss + ' ' + lost + ' on ' + sq + '. Now ' + reply.san + ' wins it.';
            } else {
              out.motif = 'hung-other';
              reason = 'This leaves ' + v.poss + ' ' + lost + ' on ' + sq + ' loose, and ' + reply.san + ' picks it up.';
            }
          } else {
            out.motif = 'allowed-tactic';
            const ri = idea(j.fenAfter, reply, j.ply + 1, j);
            reason = TACTICS.includes(ri.key) ? 'This walks into ' + reply.san + ', ' + ri.text + '. It costs ' + WHAT(-playedSwing) + '.'
              : 'This loses ' + WHAT(-playedSwing) + ' after ' + reply.san + '.';
          }
        } else if (reply && reply.captured === 'p' && playedSwing <= -1 && bestSwing - playedSwing >= 1 && U.see(bAfter, U.idx(reply.from), U.idx(reply.to)) > 0) {
          out.motif = 'hung-pawn';
          reason = 'This drops a pawn: ' + reply.san + ' wins the one on ' + reply.to + '.';
        } else if (bestSwing >= 2 && bestSwing - playedSwing >= 2 && bestMove) {
          if (bestIdea.key === 'free-piece') {
            out.motif = 'missed-capture';
            reason = v.Subj + ' could have taken the ' + NAME[bestMove.captured] + ' on ' + bestMove.to + ' for free with ' + j.bestSan + '.';
          } else {
            out.motif = TACTICS.includes(bestIdea.key) || !bestMove.captured ? 'missed-tactic' : 'missed-capture';
            reason = j.bestSan + ' would have won ' + WHAT(bestSwing) + (TACTICS.includes(bestIdea.key) || bestIdea.key === 'win-material' ? ', ' + bestIdea.text : '') + '.';
          }
          better = '';
          stand = true;
        } else {
          const p = principle(j, v, board);
          if (p) { out.motif = p.motif; reason = p.text; }
          else {
            out.motif = 'positional';
            reason = j.cls === 'inaccuracy' ? 'It is playable, but it lets some of the advantage slip.'
              : j.cls === 'miss' ? cap(v.opp) + ' slipped on the last move, and this does not punish it.'
              : j.cls === 'mistake' ? 'It makes the position noticeably harder to play.'
              : 'It gives away a lot of the position' + (reply ? ' after ' + reply.san : '') + '.';
          }
        }
        out.text = lead + ' ' + reason + better + (stand ? ' ' + standing(j.wpA, v) : '');
        if (v.you && j.cls !== 'inaccuracy' && TIPS[out.motif]) out.tip = TIPS[out.motif];
        else if (v.you && TIPS[out.motif] && out.motif.startsWith('principle')) out.tip = TIPS[out.motif];
      }
    }
    return out;
  }

  /* Follow-up when the player asks to see the best move. */
  function explainBest(j) {
    const none = { title: 'No better move found', text: '', cls: null, mood: 'neutral', line: [] };
    if (!j.best) return none;
    const c = new g.Chess(j.fenBefore);
    const m = c.move({ from: j.best.slice(0, 2), to: j.best.slice(2, 4), promotion: j.best[4] });
    if (!m) return none;
    const line = U.pvToSan(j.fenBefore, j.evBefore.pv, 6);
    const what = idea(j.fenBefore, m, j.ply, j.prev);
    return {
      title: m.san + ' was best', cls: 'best', mood: 'happy', line,
      text: cap(what.text) + ' was the idea.' + (line.length > 1 ? ' A likely continuation is ' + line.join(' ') + '.' : '')
    };
  }

  /* One sentence about the opponent's reply, for live play. */
  function opponentNote(fenBefore, move, ply, prev, name) {
    const what = idea(fenBefore, move, ply, prev);
    const seed = U.hash(move.san + ply);
    if (what.key === 'mate') return name + ' played ' + move.san + '. That is checkmate.';
    const lead = [name + ' played ' + move.san, name + ' answers with ' + move.san, name + ' goes ' + move.san][seed % 3];
    return lead + ', ' + what.text + '.';
  }

  /* What should the player watch out for right now? fen has the player to move.
     probe: optional evaluation (White's point of view) of the same position with the opponent
            to move again, used to spot threats that take more than one move.
     base: optional evaluation of the position as it is, to judge how much a pass would cost.
     Returns {text, kind} or null. */
  function threats(fen, name, probe, base) {
    const c = new g.Chess(fen);
    const me = c.turn();
    if (c.in_check()) {
      const n = c.moves().length;
      return { kind: 'check', text: n === 1 ? 'You are in check, and there is only one way out.' : 'You are in check. Deal with that first.' };
    }
    const pass = U.passFen(fen);
    if (pass) {
      const mate = U.mateInOne(pass);
      if (mate) return { kind: 'mate', sq: mate.to, text: 'Watch out: ' + name + ' is threatening checkmate with ' + mate.san + '.' };
    }
    const b = U.flat(c);
    const hung = U.hanging(b, me).filter((h) => h.gain >= 2);
    if (hung.length >= 2) {
      return { kind: 'hang', sq: hung[0].sq, text: 'Two of your pieces are in danger: the ' + NAME[hung[0].type] + ' on ' + hung[0].sq + ' and the ' + NAME[hung[1].type] + ' on ' + hung[1].sq + '.' };
    }
    if (hung.length === 1) {
      const h = hung[0];
      const defended = U.attackersOf(b, U.idx(h.sq), me).length > 0;
      return { kind: 'hang', sq: h.sq, text: 'Careful: your ' + NAME[h.type] + ' on ' + h.sq + ' is attacked by the ' + NAME[b[U.idx(h.by)].type] + (defended ? ' and is not defended enough.' : ' and has no defender.') };
    }
    if (probe && pass && probe.pv && probe.pv.length) {
      const pc = new g.Chess(pass);
      const u = probe.pv[0];
      const tm = new g.Chess(pass).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      if (tm) {
        const them = pc.turn();
        const mateIn = probe.mate != null && probe.mate !== 0 && (probe.mate > 0) === (them === 'w') ? Math.abs(probe.mate) : 0;
        if (mateIn && mateIn <= 3) {
          return { kind: 'mate', sq: tm.to, text: 'Careful: ' + name + ' has a mating attack coming, starting with ' + tm.san + '.' };
        }
        const swing = lineSwing(pass, probe.pv, them, 3);
        const ti = idea(pass, tm, 99, null);
        if (swing >= 2) {
          return { kind: 'tactic', sq: tm.to, text: name + ' is threatening ' + tm.san + (TACTICS.includes(ti.key) ? ', ' + ti.text : ', winning ' + WHAT(swing)) + '.' };
        }
        // no material in sight, but passing would cost a lot: still worth a warning
        if (base && U.povPct(probe, them) - U.povPct(base, them) >= 22) {
          const next = U.pvToSan(pass, probe.pv, 3)[2];
          const follow = next && /[x#]/.test(next) ? ', and then ' + next : '';
          return { kind: 'tactic', sq: tm.to, text: name + ' is threatening ' + tm.san + (ti.key !== 'improve' ? ', ' + ti.text : follow) + '.' };
        }
      }
    }
    return null;
  }

  /* Staged hints: 1 = a question about the idea, 2 = which piece, 3 = the move. */
  const NUDGE = {
    mate: 'There is a checkmate here. Look at every check you have.',
    castle: 'Your king is still in the middle. How do you make it safe?',
    promote: 'One of your pawns is ready to become something bigger.',
    recapture: 'They just took something. What is the best way to take back?',
    'free-piece': 'One of their pieces has no defender. Can you take something for free?',
    'win-material': 'There is a capture that wins material. Count the attackers and defenders.',
    'win-pawn': 'There is a pawn you can win safely.',
    trade: 'A trade helps you here. Which one?',
    capture: 'Look at your captures.',
    fork: 'Can one of your pieces attack two things at once?',
    'disc-check': 'Moving one piece can uncover an attack from another.',
    discovered: 'Moving one piece can uncover an attack from another.',
    pin: 'One of their pieces is lined up with something more valuable behind it.',
    skewer: 'Two of their pieces stand on the same line.',
    check: 'Start with your checks.',
    'threat-mate': 'Can you create a threat of checkmate?',
    attack: 'One of their pieces can be attacked with gain of time.',
    escape: 'One of your pieces is in danger. Find it and make it safe.',
    defend: 'One of your pieces needs protection.',
    develop: 'You still have pieces at home. Which one wants to join the game?',
    center: 'Think about the center. Which pawn can claim more space?',
    'open-file': 'Rooks want open files. Is there one?',
    seventh: 'A rook deep in their position causes trouble.',
    push: 'You have a pawn that wants to run.',
    king: 'Think about your king.',
    improve: 'Which of your pieces is doing the least? Find it a better square.'
  };
  function hint(fen, bestUci, ply, prev, stage) {
    const c = new g.Chess(fen);
    const m = c.move({ from: bestUci.slice(0, 2), to: bestUci.slice(2, 4), promotion: bestUci[4] });
    if (!m) return null;
    const what = idea(fen, m, ply, prev);
    if (stage <= 1) return { title: 'Here is a nudge', text: NUDGE[what.key] || NUDGE.improve, mood: 'thinking', more: true };
    if (stage === 2) return { title: 'Look at your ' + NAME[m.piece] + ' on ' + m.from, text: 'That is the piece to move. Where does it do the most?', mood: 'thinking', square: m.from, more: true };
    return { title: m.san + ' is the move', text: cap(what.text) + '.', mood: 'happy', arrow: { from: m.from, to: m.to }, more: false };
  }

  /* Feedback for a retry attempt in review. loss: win chance given up by the attempt. */
  function retry(j, m, loss, isBest) {
    const seed = U.hash(m.san + j.ply);
    if (isBest) {
      const what = idea(j.fenBefore, m, j.ply, j.prev);
      return { ok: true, cls: 'best', mood: 'excited', title: m.san + ' is the best move', text: ['That is it!', 'You found it.', 'Exactly right.'][seed % 3] + ' ' + cap(what.text) + ' was the idea.' };
    }
    if (m.san === j.san) return { ok: false, cls: j.cls, mood: 'thinking', title: m.san + ' is what you played', text: 'That is the move from the game. Try something different.' };
    if (loss < 2.5) return { ok: true, cls: 'excellent', mood: 'happy', title: m.san + ' works too', text: 'That is nearly as strong as ' + j.bestSan + '. Nicely done.' };
    if (loss < j.loss - 4) return { ok: false, cls: 'good', mood: 'thinking', title: m.san + ' is better, but not best', text: 'It improves on ' + j.san + ', yet there is something stronger. Have another look.' };
    return { ok: false, cls: loss >= 20 ? 'blunder' : 'mistake', mood: 'worried', title: m.san + ' is not it', text: 'That does not solve the problem. Try again, or tap Show best.' };
  }

  /* What to work on, from the player's mistakes in one game. */
  function focus(moves, userColor, names) {
    const tally = {};
    let n = 0;
    for (const m of moves) {
      if (m.color !== userColor || !['mistake', 'miss', 'blunder', 'inaccuracy'].includes(m.cls)) continue;
      const ex = explain(m, userColor, names);
      if (!ex.motif || ex.motif === 'positional') continue;
      const key = ex.motif.startsWith('principle') ? 'principle' : ['hung-other', 'ignored-threat', 'hung-pawn'].includes(ex.motif) ? 'hung-piece' : ex.motif === 'missed-capture' ? 'missed-tactic' : ex.motif;
      tally[key] = (tally[key] || 0) + (m.cls === 'inaccuracy' || ex.motif === 'hung-pawn' ? 0.5 : 1);
      n++;
    }
    const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    if (!top || tally[top] < 1) return { title: 'Keep doing what you are doing', text: 'No recurring problem this game. Keep up the quick safety check before every move.' };
    const times = (k) => { const c = Math.round(tally[k]); return c <= 1 ? 'once' : c === 2 ? 'twice' : c + ' times'; };
    const T = {
      'hung-piece': ['Protect your pieces', 'You left material where it could be taken ' + times(top) + '. Before every move, ask: what can they capture after this?'],
      'allowed-tactic': ['Check their replies', 'A fork or a check cost you material ' + times(top) + '. After you pick a move, look at their checks and captures before you play it.'],
      'missed-tactic': ['Hunt for loose pieces', 'You passed up a chance to win material ' + times(top) + '. Each move, scan for their undefended pieces first.'],
      'allowed-mate': ['Guard your king', 'Your king got caught ' + times(top) + '. When things heat up, give it an escape square.'],
      'missed-mate': ['Finish the game', 'There was a forced checkmate you did not play. When their king is exposed, calculate every check.'],
      principle: ['Opening basics', 'In the opening: bring out knights and bishops, castle, and leave the queen at home until later.']
    };
    return { title: T[top][0], text: T[top][1] };
  }

  /* The coach's face. An original owl; the expression follows the mood. */
  function avatar(mood) {
    const ink = '#14171d';
    let eyes, extra = '';
    const pupils = (x1, y1, x2, y2, r) => '<circle cx="' + x1 + '" cy="' + y1 + '" r="' + r + '" fill="' + ink + '"/><circle cx="' + x2 + '" cy="' + y2 + '" r="' + r + '" fill="' + ink + '"/>' +
      '<circle cx="' + (x1 + 1.3) + '" cy="' + (y1 - 1.4) + '" r="' + (r * 0.32).toFixed(2) + '" fill="#fff"/><circle cx="' + (x2 + 1.3) + '" cy="' + (y2 - 1.4) + '" r="' + (r * 0.32).toFixed(2) + '" fill="#fff"/>';
    const brow = (d) => '<path d="' + d + '" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round" fill="none"/>';
    let beak = '<path fill="#f3b33d" d="M32 34l-3.5 4.5L32 43l3.5-4.5z"/>';
    switch (mood) {
      case 'happy':
        eyes = brow('M18 32q5-7 10 0') + brow('M36 32q5-7 10 0');
        break;
      case 'excited':
        eyes = pupils(24, 30, 40, 30, 5);
        extra = '<path fill="#f3b33d" d="M56 6l1.4 3.6L61 11l-3.6 1.4L56 16l-1.4-3.6L51 11l3.6-1.4zM7 9l1 2.5L10.5 12.5 8 13.5 7 16l-1-2.5L3.5 12.5 6 11.5z"/>';
        beak = '<path fill="#f3b33d" d="M32 34l-4 4 4 6 4-6z"/><path fill="#a8651a" d="M29.5 39.5h5L32 43.5z"/>';
        break;
      case 'thinking':
        eyes = pupils(26, 28, 42, 28, 3.6) + brow('M36 19l10-2.5');
        extra = '<circle cx="55" cy="14" r="2.2" fill="#bfe6dd"/><circle cx="59" cy="8" r="3" fill="#bfe6dd"/>';
        break;
      case 'worried':
        eyes = pupils(23.5, 32.5, 40.5, 32.5, 3.2) + brow('M15 22l11-4') + brow('M49 22l-11-4');
        break;
      case 'shocked':
        eyes = pupils(23, 30, 41, 30, 2.4) + brow('M16 18.5l9-1.5') + brow('M48 18.5l-9-1.5');
        beak = '<path fill="#f3b33d" d="M32 33.5l-4 4.5 4 7 4-7z"/><ellipse cx="32" cy="40.5" rx="1.8" ry="2.6" fill="#7a3d10"/>';
        extra = '<path fill="#9ad8f0" d="M54 20c2 3 3 4.6 3 6a3 3 0 01-6 0c0-1.4 1-3 3-6z"/>';
        break;
      default:
        eyes = pupils(24, 31, 40, 31, 4);
    }
    return ('<svg viewBox="0 0 64 64" aria-hidden="true"><path fill="#2c8c84" d="M13 14l9 6h20l9-6-3 14c3 4 4 8 4 13 0 12-9 19-20 19S12 53 12 41c0-5 1-9 4-13z"/>' +
      '<ellipse cx="32" cy="46" rx="11" ry="10" fill="#bfe6dd"/><circle cx="23" cy="30" r="9" fill="#fff"/><circle cx="41" cy="30" r="9" fill="#fff"/>' +
      eyes + beak + '<path fill="#f3b33d" d="M22 60h7v-3h-5zM35 57v3h7l-2-3z"/>' + extra + '</svg>');
  }

  RW.Coach = { explain, explainBest, describe, idea, lineSwing, voice, opponentNote, threats, hint, retry, focus, avatar, TIPS };
})(typeof window !== 'undefined' ? window : globalThis);
