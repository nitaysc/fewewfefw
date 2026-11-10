/* The Puzzles tab and the puzzle screen.
   Modes: rated puzzles (your puzzle rating goes up and down), Puzzle Rush (three minutes, three strikes,
   each puzzle a little harder), the daily puzzle, and theme practice (unrated). As on the big chess sites,
   the opponent's move sets up each puzzle; you then find the best reply, and the opponent answers until
   the line is done. A wrong move, a hint or the solution counts as a miss for a rated puzzle.
   app.js passes in the shell helpers it shares (A). */
(function (g) {
  const RW = g.RW;
  RW.PuzzleScreen = function (A) {
    const { $, esc, icon, store, sheet, closeSheet, buzz, Snd, setAv, popBubble, fillActs, miniBoard, plural } = A;
    const P = RW.Puzzles, U = RW.U;
    const RUSH_MS = 3 * 60 * 1000;
    const TAG = { ok: '✓', bad: '✗', best: '★' };

    /* ---------- stored progress ---------- */
    const blank = () => ({ rating: null, n: 0, ok: 0, streak: 0, best: 0, seen: [], hist: [], last: null,
      rush: { best: 0, runs: 0, last: null }, daily: { last: '', streak: 0, solved: 0 }, th: {} });
    const st = Object.assign(blank(), store.get('puzzles', {}));
    const save = () => store.set('puzzles', st);
    // a first puzzle rating: the player's game estimate if there is one, else a beginner-friendly 1000
    const startRating = () => { const lv = A.myLevel(); return lv ? Math.max(600, Math.min(2000, lv.elo)) : 1000; };
    const rating = () => (st.rating == null ? startRating() : st.rating);
    const seenSet = () => new Set(st.seen);
    function markSeen(id) {
      const i = st.seen.indexOf(id);
      if (i >= 0) st.seen.splice(i, 1);
      st.seen.push(id);
      if (st.seen.length > 1500) st.seen.splice(0, st.seen.length - 1500);
    }
    const dailyDone = () => st.daily.last === P.today();
    const dailyStreak = () => (st.daily.last === P.today() || st.daily.last === P.yesterday(P.today()) ? st.daily.streak : 0);

    /* ---------- session ---------- */
    let S = null;   // the puzzle on screen
    let rush = null; // the Puzzle Rush run, if one is going
    const board = new RW.Board($('#pBoard'));
    board.getMoves = (sq) => {
      if (!S || S.busy || S.done) return [];
      const p = S.chess.get(sq);
      return p && p.color === S.color ? S.chess.moves({ square: sq, verbose: true }) : [];
    };
    board.onMove = (f, t, pr, dragged) => userMove(f, t, pr, dragged);
    board.onIllegal = () => Snd.play('illegal');
    const onScreen = () => !$('#puzzle').hidden;
    const alive = (seq) => S && S.seq === seq && onScreen();
    const play = (u) => S.chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    const lastMove = () => { const h = S.chess.history({ verbose: true }); return h[h.length - 1] || null; };
    const sideName = (c) => (c === 'w' ? 'White' : 'Black');
    const isMate = (p) => p.themes.some((t) => /^mateIn/.test(P.themeKey(t)));
    const mateIn = (p) => { const t = p.themes.find((x) => /^mateIn\d/.test(P.themeKey(x))); return t != null ? +P.themeKey(t).slice(6) : 0; };

    function say(o) {
      $('#pzHead').innerHTML = (o.tag ? '<span class="tag c-' + o.tag + '">' + TAG[o.tag] + '</span>' : '') + esc(o.title || '');
      $('#pzText').innerHTML = o.html || esc(o.text || '');
      $('#pzTip').textContent = o.tip || '';
      fillActs($('#pzActs'), o.acts);
      setAv($('#pzAv'), o.mood || 'neutral');
      popBubble($('#pzBubble'));
    }

    /* The strip over the board: who moves and your rating, or the Rush clock, score and strikes. */
    function strip() {
      const el = $('#pzStrip');
      if (!S) return;
      if (rush) {
        el.innerHTML = '<span class="rclock' + (rush.left < 15000 ? ' low' : '') + '" id="pzClock">' + clock(rush.left) + '</span>' +
          '<span class="rscore"><b>' + rush.score + '</b><small>solved</small></span>' +
          '<span class="strikes" aria-label="' + plural(rush.strikes, 'strike') + '">' + [0, 1, 2].map((i) => '<i class="' + (i < rush.strikes ? 'on' : '') + '">' + icon('x') + '</i>').join('') + '</span>';
        return;
      }
      let right = '';
      if (S.mode === 'rated') {
        const d = S.delta;
        right = '<span class="pzr"><small>Rating</small><b>' + rating() + '</b>' + (d != null ? '<em class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '+' : '−') + Math.abs(d) + '</em>' : '') + '</span>';
      } else if (S.mode === 'daily') right = '<span class="pzr"><small>Streak</small><b>' + dailyStreak() + '</b></span>';
      else right = '<span class="pzr"><small>Solved</small><b>' + (S.sessionOk || 0) + '</b></span>';
      const sub = S.done ? (S.ok && S.clean ? 'Solved' : S.ok ? 'Solved with help' : 'Shown') + ' · rated ' + S.puzzle.rating
        : S.intro ? 'Watch the opponent\'s move' : 'Your turn';
      el.innerHTML = '<span class="tomove ' + S.color + '"><span class="pc ' + S.color + 'k"></span></span>' +
        '<div class="pinfo"><b>' + sideName(S.color) + ' to move</b><small>' + sub + '</small></div>' + right;
    }

    function tools() {
      const el = $('#pzTools');
      const b = (id, ic, label, dis) => '<button id="' + id + '"' + (dis ? ' disabled' : '') + '><span>' + icon(ic) + '</span>' + label + '</button>';
      if (rush) el.innerHTML = b('ptEnd', 'stop', 'End run');
      else if (S.done) el.innerHTML = b('ptRetry', 'again', 'Retry') + b('ptFlip', 'flip', 'Flip') + (S.mode === 'daily' ? b('ptDone', 'check', 'Done') : b('ptNext', 'skip', 'Next'));
      else el.innerHTML = b('ptHint', 'bulb', 'Hint', S.busy) + b('ptSol', 'eye', 'Solution', S.busy) + (S.mode === 'daily' ? b('ptFlip', 'flip', 'Flip') : b('ptSkip', 'skip', 'Skip', S.busy));
      const on = (id, fn) => { const x = el.querySelector('#' + id); if (x) x.onclick = fn; };
      on('ptEnd', () => endRush('quit'));
      on('ptRetry', retry);
      on('ptFlip', flip);
      on('ptNext', next);
      on('ptDone', leave);
      on('ptHint', hint);
      on('ptSol', solution);
      on('ptSkip', skip);
    }

    /* ---------- the flow of one puzzle ---------- */
    function open(mode, o) {
      o = o || {};
      if (mode === 'daily' && !P.daily(P.today())) return;
      S = { mode, theme: o.theme, seq: 0, sessionOk: 0 };
      rush = mode === 'rush' ? { n: 0, score: 0, strikes: 0, results: [], left: RUSH_MS, last: 0, seen: seenSet(), over: false, top: 0, iv: null } : null;
      $('#pzTitle').textContent = mode === 'rush' ? 'Puzzle Rush' : mode === 'daily' ? 'Daily Puzzle' : mode === 'theme' ? P.themeName(o.theme) : 'Puzzles';
      $('#pzRushRow').hidden = !rush;
      $('#pzRushRow').innerHTML = '';
      $('#pzFlip').hidden = !!rush;
      A.show('puzzle');
      next();
      if (rush) startClock();
    }

    function next() {
      if (!S) return;
      let p;
      if (S.mode === 'daily') p = P.daily(P.today());
      else if (rush) p = P.pickRush(rush.n, rush.seen);
      else p = P.pick({ rating: S.mode === 'rated' ? rating() : Math.max(700, rating() - 100), seen: seenSet(), theme: S.theme });
      if (p) load(p, false);
    }

    function lead(p) {
      const who = sideName(P.solverColor(p));
      if (S.mode === 'theme') {
        const m = mateIn(p);
        if (m) return 'Find the checkmate in ' + m + ' for ' + who + '.';
        return 'Theme: ' + P.themeName(S.theme).toLowerCase() + '. Find the best move for ' + who + '.';
      }
      if (S.mode === 'daily') return 'Today\'s puzzle, the same one all day. Find the best move for ' + who + '.';
      return 'Find the best move for ' + who + '.';
    }

    function load(p, again) {
      const seq = ++S.seq;
      Object.assign(S, { puzzle: p, chess: new Chess(p.fen), color: P.solverColor(p), k: 1, done: false, ok: false, busy: true, intro: true,
        failed: !!again, helped: !!again, clean: false, hintStage: 0, delta: again ? S.delta : null, recorded: !!again });
      if (rush) rush.seen.add(p.id);
      board.setOrientation(S.color);
      board.setPosition(S.chess, null, false);
      board.setArrows([]);
      board.setBadge(null);
      board.setInteractive(false);
      strip();
      tools();
      if (rush) say({ title: 'Puzzle ' + (rush.n + 1), text: sideName(S.color) + ' to move. Find the best move.', mood: rush.strikes ? 'thinking' : 'neutral' });
      else say({ title: again ? 'Try it again' : sideName(S.color) + ' to move', text: again ? 'Same position. Can you find the whole line this time?' : lead(p), mood: 'neutral' });
      // let the position register for a moment, then play the opponent's move that sets the puzzle
      setTimeout(() => {
        if (!alive(seq)) return;
        const mv = play(p.moves[0]);
        board.setPosition(S.chess, mv, true);
        Snd.forMove(mv, S.chess, { opponent: true });
        S.busy = false;
        S.intro = false;
        board.setInteractive(true);
        strip();
        tools();
      }, rush ? 380 : 650);
    }

    function userMove(from, to, promo, dragged) {
      if (!S || S.busy || S.done) return;
      const seq = S.seq;
      const u = from + to + (promo || '');
      const verdict = P.check(S.puzzle, S.k, S.chess.fen(), u);
      const mv = play(u);
      if (!mv) return;
      board.setInteractive(false);
      board.setPosition(S.chess, mv, !dragged);
      Snd.forMove(mv, S.chess, { delay: dragged ? 0 : 0.08 });
      buzz(8);
      if (verdict !== 'correct') return wrong(mv, seq);
      board.setBadge({ sq: mv.to, cls: 'ok' });
      S.k++;
      if (S.chess.in_checkmate() || S.k >= S.puzzle.moves.length) return solved(seq);
      Snd.play('correct');
      S.busy = true;
      tools();
      if (!rush) say({ title: 'Best move!', tag: 'ok', text: 'Keep going, there is more to find.', mood: 'happy' });
      setTimeout(() => {
        if (!alive(seq)) return;
        const reply = play(S.puzzle.moves[S.k]);
        S.k++;
        board.setPosition(S.chess, reply, true);
        board.setBadge(null);
        Snd.forMove(reply, S.chess, { opponent: true });
        S.busy = false;
        S.hintStage = 0;
        board.setInteractive(true);
        tools();
      }, 520);
    }

    function wrong(mv, seq) {
      board.setBadge({ sq: mv.to, cls: 'bad' });
      Snd.play('wrong');
      buzz(35);
      S.busy = true;
      if (rush) {
        rush.strikes++;
        rush.results.push({ ok: false, r: S.puzzle.rating });
        rush.n++;
        rushRow();
        strip();
        S.done = true;
        // take the move back and show the right one for a moment, then go on
        setTimeout(() => {
          if (!alive(seq)) return;
          S.chess.undo();
          const best = S.puzzle.moves[S.k];
          board.setPosition(S.chess, lastMove(), false);
          board.setArrows([{ from: best.slice(0, 2), to: best.slice(2, 4) }]);
          setTimeout(() => { if (!alive(seq) || !rush || rush.over) return; if (rush.strikes >= 3) endRush('strikes'); else next(); }, 850);
        }, 420);
        return;
      }
      const first = !S.failed;
      miss();
      const tip = first ? 'Look at checks, captures and threats first, for both sides.' : '';
      const rated = S.mode === 'rated' && first && S.delta != null ? ' Your rating ' + (rating() - S.delta) + ' → ' + rating() + '.' : '';
      say({ title: mv.san + ' is not it', tag: 'bad', text: 'That is not the best move here.' + rated + ' Try again, or tap Solution.', tip, mood: 'worried' });
      strip();
      tools();
      setTimeout(() => {
        if (!alive(seq)) return;
        S.chess.undo();
        board.setPosition(S.chess, lastMove(), false);
        board.setBadge(null);
        S.busy = false;
        board.setInteractive(true);
        tools();
      }, 850);
    }

    /* First slip on a puzzle (a wrong move, a hint, the solution or a skip): it now counts as missed. */
    function miss() {
      if (S.failed && S.recorded) return;
      S.failed = true;
      if (S.mode === 'rated') rate(false);
      record(false);
    }
    function rate(won) {
      const before = rating();
      const d = P.rate(before, S.puzzle.rating, won, st.n);
      st.rating = before + d;
      st.n++;
      if (won) { st.ok++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0;
      st.hist.push(st.rating);
      if (st.hist.length > 60) st.hist.shift();
      st.last = d;
      S.delta = d;
    }
    function record(won) {
      if (S.recorded) return;
      S.recorded = true;
      markSeen(S.puzzle.id);
      for (const t of S.puzzle.themes) {
        const x = st.th[t] || (st.th[t] = [0, 0]);
        x[1]++;
        if (won) x[0]++;
      }
      save();
    }

    function solved(seq) {
      S.done = true;
      S.ok = true;
      S.busy = false;
      board.setInteractive(false);
      const p = S.puzzle;
      if (rush) {
        rush.score++;
        rush.n++;
        rush.top = Math.max(rush.top, p.rating);
        rush.results.push({ ok: true, r: p.rating });
        rushRow();
        strip();
        Snd.play('correct');
        setTimeout(() => { if (alive(seq) && rush && !rush.over) next(); }, 420);
        return;
      }
      S.clean = !S.failed && !S.helped;
      if (S.clean) {
        if (S.mode === 'rated') rate(true);
        S.sessionOk++;
        record(true);
      }
      if (S.mode === 'daily') {
        const today = P.today();
        if (st.daily.last !== today) {
          st.daily.streak = st.daily.last === P.yesterday(today) ? st.daily.streak + 1 : 1;
          st.daily.last = today;
          st.daily.solved++;
          save();
        }
      }
      save();
      Snd.play('solved');
      buzz(S.clean ? 22 : 10);
      const m = S.chess.in_checkmate();
      const head = S.clean ? (m ? 'Checkmate! Solved' : ['Solved!', 'Nicely done!', 'Puzzle solved!'][U.hash(p.id) % 3]) : 'Solved, with help';
      say({ title: head, tag: S.clean ? 'ok' : null, mood: S.clean ? 'excited' : 'happy', html: about(true), acts: afterActs() });
      strip();
      tools();
    }

    /* What the puzzle was about, shown once it is over. */
    function about(won) {
      const p = S.puzzle;
      // the tactical ideas only: the game phase and how big the win is say little about the puzzle
      const skip = new Set(['opening', 'middlegame', 'endgame', 'crushing', 'equality']);
      const th = p.themes.filter((t) => !skip.has(P.themeKey(t))).map(P.themeName);
      let h = 'Puzzle rated <b class="inl">' + p.rating + '</b>' + (th.length ? ', ' + esc(th.slice(0, 3).join(', ').toLowerCase()) : '') + '.';
      if (S.mode === 'rated' && S.delta != null) h += ' Your rating is now <b class="inl">' + rating() + '</b> (' + (S.delta >= 0 ? '+' : '−') + Math.abs(S.delta) + ').';
      if (S.mode === 'rated' && won && st.streak >= 3) h += ' That is ' + st.streak + ' in a row.';
      if (S.mode === 'daily') h += ' Come back tomorrow for a new one' + (dailyStreak() > 1 ? ', your streak is ' + dailyStreak() + ' days' : '') + '.';
      return h;
    }
    function afterActs() {
      if (S.mode === 'daily') return [{ label: 'Rated puzzles', fn: () => open('rated') }, { label: 'Done', alt: true, fn: leave }];
      return [{ label: 'Next puzzle', fn: next }, { label: 'Retry', alt: true, fn: retry }];
    }

    function hint() {
      if (!S || S.done || S.busy) return;
      const u = S.puzzle.moves[S.k];
      if (!S.helped) {
        S.helped = true;
        if (!S.failed) miss();
      }
      S.hintStage = Math.min(2, S.hintStage + 1);
      const pc = S.chess.get(u.slice(0, 2));
      const note = S.mode === 'rated' && S.delta != null && S.hintStage === 1 ? ' (A hint counts as a miss for your rating.)' : '';
      if (S.hintStage === 1) {
        board.setHint(u.slice(0, 2));
        say({ title: 'Hint', text: 'Your ' + U.NAME[pc.type] + ' on ' + u.slice(0, 2) + ' is the piece to move.' + note + ' Tap Hint again to see the move.', mood: 'thinking' });
      } else {
        board.setHint(u.slice(0, 2));
        board.setArrows([{ from: u.slice(0, 2), to: u.slice(2, 4) }]);
        const c = new Chess(S.chess.fen());
        const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        say({ title: 'Play ' + m.san, text: 'Follow the arrow. Then work out why it is strong.', mood: 'neutral' });
      }
      strip();
    }

    function solution() {
      if (!S || S.done || S.busy) return;
      if (!S.helped) { S.helped = true; if (!S.failed) miss(); }
      S.done = true;
      S.busy = true;
      board.setInteractive(false);
      const seq = S.seq;
      const start = S.chess.fen();
      const sans = [];
      say({ title: 'Solution', text: 'Watch the line.', mood: 'neutral' });
      tools();
      const step = () => {
        if (!alive(seq)) return;
        if (S.k >= S.puzzle.moves.length) {
          S.busy = false;
          say({ title: 'That was the solution', mood: 'thinking', html: '<span class="line">' + esc(lineText(start, sans)) + '</span>' + about(false), acts: afterActs() });
          strip();
          tools();
          return;
        }
        const mine = S.k % 2 === 1;
        const mv = play(S.puzzle.moves[S.k]);
        S.k++;
        sans.push(mv.san);
        board.setArrows([]);
        board.setPosition(S.chess, mv, true);
        board.setBadge(mine ? { sq: mv.to, cls: 'best' } : null);
        Snd.forMove(mv, S.chess, { opponent: !mine, delay: 0.05 });
        setTimeout(step, 850);
      };
      step();
    }

    function skip() {
      if (!S || S.done || S.busy) return;
      // a skipped rated puzzle counts as missed; in practice it is only marked as seen
      if (S.mode === 'rated') miss();
      else { markSeen(S.puzzle.id); save(); }
      next();
    }
    function retry() { if (S && S.puzzle && !S.busy) load(S.puzzle, true); }
    function flip() {
      if (!S) return;
      board.setOrientation(U.other(board.orient));
      board.setPosition(S.chess, lastMove(), false);
    }

    /* "23. Qxg2# 24. Kh1" from fen. */
    function lineText(fen, sans) {
      const f = fen.split(' ');
      let no = +f[5] || 1, white = f[1] === 'w', out = '';
      sans.forEach((s, i) => {
        if (white) out += no + '. ';
        else if (i === 0) out += no + '... ';
        out += s + ' ';
        if (!white) no++;
        white = !white;
      });
      return out.trim();
    }

    /* ---------- Puzzle Rush ---------- */
    const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    function startClock() {
      rush.last = performance.now();
      clearInterval(rush.iv);
      rush.iv = setInterval(tick, 200);
    }
    function tick() {
      if (!rush || rush.over) return;
      const now = performance.now();
      // the clock waits while the app is in the background
      if (!document.hidden && onScreen()) rush.left -= now - rush.last;
      rush.last = now;
      const el = $('#pzClock');
      if (el) { el.textContent = clock(rush.left); el.classList.toggle('low', rush.left < 15000); }
      if (rush.left <= 0) endRush('time');
    }
    function rushRow() {
      const el = $('#pzRushRow');
      el.innerHTML = rush.results.map((r, i) => '<i class="' + (r.ok ? 'ok' : 'bad') + '" title="' + (i + 1) + '">' + icon(r.ok ? 'check' : 'x') + '</i>').join('');
      el.scrollLeft = el.scrollWidth;
    }
    function endRush(why) {
      if (!rush || rush.over) return;
      rush.over = true;
      clearInterval(rush.iv);
      S.seq++;
      S.busy = true;
      board.setInteractive(false);
      const r = rush;
      const prev = st.rush.best;
      const best = r.score > prev;
      st.rush.best = Math.max(prev, r.score);
      st.rush.runs++;
      st.rush.last = r.score;
      for (const id of r.seen) markSeen(id);
      save();
      Snd.play(best && r.score > 0 ? 'win' : 'draw');
      buzz(best ? 40 : 20);
      const reason = why === 'time' ? 'Time is up' : why === 'strikes' ? 'Three strikes' : 'Run ended';
      sheet('<div class="rushend"><span class="coach-av">' + RW.Coach.avatar(best && r.score ? 'excited' : r.score >= 5 ? 'happy' : 'thinking') + '</span>' +
        '<small>' + reason + '</small><b class="big">' + r.score + '</b><p>' + (best && r.score ? 'New personal best!' : 'Best: ' + st.rush.best) + '</p></div>' +
        '<div class="opts"><div class="opt"><span><b>Puzzles tried</b></span><b>' + r.results.length + '</b></div>' +
        '<div class="opt"><span><b>Hardest solved</b></span><b>' + (r.top || '–') + '</b></div></div>' +
        '<div class="row2"><button class="ghost" id="reDone">Done</button><button class="primary" id="reAgain">Try again</button></div>',
      () => leave());
      $('#reAgain').onclick = () => { closeSheet(); open('rush'); };
      $('#reDone').onclick = () => { closeSheet(); leave(); };
    }

    /* ---------- leaving ---------- */
    function leave() {
      if (rush && !rush.over) return endRush('quit');
      if (rush) clearInterval(rush.iv);
      rush = null;
      if (S) S.seq++;
      S = null;
      A.show('puzzles');
    }
    /* The Android back button or the back arrow. Returns true when handled. */
    function back() {
      if (!onScreen()) return false;
      leave();
      return true;
    }

    /* ---------- the Puzzles tab ---------- */
    function after1(p) {
      const c = new Chess(p.fen);
      c.move({ from: p.moves[0].slice(0, 2), to: p.moves[0].slice(2, 4), promotion: p.moves[0][4] });
      return c.fen();
    }
    const thumbs = new Map();
    function themeThumb(t) {
      if (!thumbs.has(t)) {
        const list = P.byTheme(t);
        const p = list.slice().sort((a, b) => Math.abs(a.rating - 1100) - Math.abs(b.rating - 1100))[0];
        thumbs.set(t, p ? miniBoard(after1(p), P.solverColor(p)) : '');
      }
      return thumbs.get(t);
    }
    function render() {
      const r = rating();
      const tried = st.n;
      $('#pzLvl').textContent = r;
      const pct = tried ? Math.round((100 * st.ok) / tried) + '%' : '–';
      let spark = '';
      const hs = st.hist.slice(-30);
      if (hs.length >= 2) {
        const lo = Math.min(...hs) - 10, hi = Math.max(...hs) + 10, n = hs.length - 1;
        const y = (v) => (38 - ((v - lo) / (hi - lo)) * 34).toFixed(1);
        const pts = hs.map((v, i) => ((i / n) * 100).toFixed(1) + ',' + y(v)).join(' ');
        spark = '<div class="spark"><svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-label="Puzzle rating over your last ' + hs.length + ' puzzles">' +
          '<polygon points="0,40 ' + pts + ' 100,40" fill="var(--accent)" fill-opacity=".13"/><polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg></div>';
      }
      const daily = P.daily(P.today());
      $('#pzHero').innerHTML =
        '<div class="pzh-top"><div class="pzrate"><small>Puzzle rating</small><b>' + r + '</b>' +
        (st.last != null ? '<em class="' + (st.last >= 0 ? 'up' : 'down') + '">' + (st.last >= 0 ? '▲ ' : '▼ ') + Math.abs(st.last) + '</em>' : '<em class="dim">' + (st.rating == null ? 'Your starting rating' : '') + '</em>') +
        '</div><span class="pzart">' + icon('puzzle') + '</span></div>' + spark +
        '<div class="pzstats"><div class="stat"><b>' + st.ok + '</b><small>Solved</small></div><div class="stat"><b>' + pct + '</b><small>Success</small></div><div class="stat"><b>' + st.streak + '</b><small>Streak' + (st.best > st.streak ? ' · best ' + st.best : '') + '</small></div></div>' +
        '<button class="primary big" id="pzGo"><span>' + (tried ? 'Solve puzzles' : 'Start solving') + '</span><small>Rated · puzzles around ' + r + '</small></button>';
      $('#pzModes').innerHTML =
        '<button class="card mode rush" id="pzRush"><i class="mi">' + icon('bolt') + '</i><span><b>Puzzle Rush</b><small>' + (st.rush.best ? 'Best score ' + st.rush.best : '3 minutes · 3 strikes') + '</small></span></button>' +
        '<button class="card mode daily" id="pzDaily"><span class="mini-wrap">' + (daily ? miniBoard(after1(daily), P.solverColor(daily)) : '') + '</span><span><b>Daily Puzzle</b><small>' +
        (dailyDone() ? 'Solved today ✓' : 'A new one today') + (dailyStreak() > 1 ? ' · ' + dailyStreak() + ' days' : '') + '</small></span></button>';
      $('#pzThemes').innerHTML = RW.PUZZLE_THEMES.map((th, t) => {
        const x = st.th[t];
        const sub = x ? x[0] + ' of ' + x[1] + ' solved' : plural(P.byTheme(t).length, 'puzzle');
        return '<button class="card theme" data-t="' + t + '"><span class="mini-wrap">' + themeThumb(t) + '</span><b>' + esc(th[1]) + '</b><small>' + sub + '</small></button>';
      }).join('');
      $('#pzGo').onclick = () => open('rated');
      $('#pzRush').onclick = () => open('rush');
      $('#pzDaily').onclick = () => open('daily');
      $('#pzThemes').onclick = (e) => { const b = e.target.closest('.theme'); if (b) open('theme', { theme: +b.dataset.t }); };
    }

    $('#pzBack').onclick = leave;
    $('#pzFlip').onclick = flip;
    $('#pzSettings').onclick = () => A.settingsSheet();
    document.addEventListener('visibilitychange', () => { if (rush && !rush.over) rush.last = performance.now(); });

    return { render, back, open, get state() { return S; }, get rush() { return rush; }, stats: st };
  };
})(window);
