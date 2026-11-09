/* Rookwise: screens, game flow against the bot, live coaching, and the review walkthrough. */
(function () {
  'use strict';
  const U = RW.U, R = RW.Review, C = RW.Coach;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const store = {
    get(k, d) { try { const v = localStorage.getItem('rw.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rw.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('rw.' + k); } catch (e) {} }
  };

  /* ---------- art ---------- */
  const ART = {
    mark: '<svg viewBox="0 0 36 36"><rect width="36" height="36" rx="9" fill="#f3b33d"/><path fill="#1d1503" d="M10 8h4v3h2.5V8h3v3H22V8h4v7l-3 2.5V24l3 2v3H10v-3l3-2v-6.5L10 15z"/></svg>',
    coach: '<svg viewBox="0 0 64 64"><path fill="#2c8c84" d="M13 14l9 6h20l9-6-3 14c3 4 4 8 4 13 0 12-9 19-20 19S12 53 12 41c0-5 1-9 4-13z"/><ellipse cx="32" cy="46" rx="11" ry="10" fill="#bfe6dd"/><circle cx="23" cy="30" r="9" fill="#fff"/><circle cx="41" cy="30" r="9" fill="#fff"/><circle cx="24" cy="31" r="4" fill="#14171d"/><circle cx="40" cy="31" r="4" fill="#14171d"/><circle cx="25.3" cy="29.6" r="1.3" fill="#fff"/><circle cx="41.3" cy="29.6" r="1.3" fill="#fff"/><path fill="#f3b33d" d="M32 34l-3.5 4.500L32 43l3.5-4.500z"/><path fill="#f3b33d" d="M22 60h7v-3h-5zM35 57v3h7l-2-3z"/></svg>'
  };
  const IC = {
    back: 'M15 5l-7 7 7 7', prev: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7',
    first: 'M7 5v14M18 5l-8 7 8 7', last: 'M17 5v14M6 5l8 7-8 7',
    flip: 'M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3',
    flag: 'M6 21V4M6 4h11l-2 4 2 4H6', undo: 'M8 7L4 11l4 4M4 11h10a5 5 0 010 10h-3',
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z',
    chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3', home: 'M4 11l8-7 8 7M6 10v10h12V10', again: 'M20 12a8 8 0 11-3-6.2M20 4v5h-5'
  };
  const icon = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + IC[n] + '"/></svg>';
  document.querySelectorAll('[data-art]').forEach((el) => (el.innerHTML = ART[el.dataset.art]));
  document.querySelectorAll('[data-ic]').forEach((el) => (el.innerHTML = icon(el.dataset.ic)));

  /* ---------- opponents ---------- */
  const BOTS = [
    { name: 'Pip', elo: 400, hue: '#9ad0f5', depth: 2, mpv: 4, rand: 0.3, temp: 26 },
    { name: 'Dot', elo: 700, hue: '#b7e3a1', depth: 3, mpv: 4, rand: 0.16, temp: 17 },
    { name: 'Marlo', elo: 1000, hue: '#f6d37a', depth: 4, mpv: 4, rand: 0.07, temp: 11 },
    { name: 'Juno', elo: 1300, hue: '#f5b48a', depth: 5, mpv: 4, rand: 0.025, temp: 7 },
    { name: 'Bram', elo: 1600, hue: '#e7a0c4', depth: 7, mpv: 4, rand: 0, temp: 4 },
    { name: 'Ilse', elo: 1900, hue: '#c3a8f0', depth: 9, mpv: 3, rand: 0, temp: 2.2 },
    { name: 'Corvin', elo: 2200, hue: '#8fd6cf', depth: 11, mpv: 3, rand: 0, temp: 1.1 },
    { name: 'Sable', elo: 2500, hue: '#c9ced8', depth: 13, mpv: 2, rand: 0, temp: 0.4 },
    { name: 'Maximum', elo: 3000, hue: '#f3b33d', depth: 18, mpv: 1, rand: 0, temp: 0 }
  ];

  const S = { settings: Object.assign({ bot: 2, color: 'w', coach: true, evalbar: false, sound: true, movetime: 450 }, store.get('settings', {})) };
  const saveSettings = () => store.set('settings', S.settings);

  const engine = new RW.Engine('vendor/stockfish-19-lite-single.js');

  /* ---------- sound ---------- */
  let ac = null;
  function blip(freq, dur, type, vol, slide) {
    if (!S.settings.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + dur);
    } catch (e) {}
  }
  function moveSound(m, chess) {
    if (chess.in_checkmate()) { blip(520, 0.18, 'sine', 0.2); setTimeout(() => blip(780, 0.3, 'sine', 0.2), 140); }
    else if (chess.in_check()) blip(700, 0.12, 'square', 0.07, 500);
    else if (m.captured) { blip(240, 0.07, 'triangle', 0.3, 90); setTimeout(() => blip(180, 0.07, 'triangle', 0.25, 80), 45); }
    else blip(200, 0.07, 'triangle', 0.3, 110);
  }

  /* ---------- screens and sheets ---------- */
  function show(id) {
    for (const s of ['home', 'game', 'review']) $('#' + s).hidden = s !== id;
    if (id === 'home') renderHome();
  }
  function sheet(html, onClose) {
    $('#sheet').innerHTML = html;
    $('#scrim').hidden = false;
    $('#scrim').onclick = (e) => { if (e.target.id === 'scrim') { closeSheet(); if (onClose) onClose(); } };
  }
  function closeSheet() { $('#scrim').hidden = true; }

  function evalBar(el, ev, orient) {
    if (!ev) return;
    const wp = U.winPct(ev);
    const fill = el.querySelector('.fill'), num = el.querySelector('.num');
    el.classList.toggle('flip', orient === 'b');
    fill.style.height = Math.max(3, Math.min(97, wp)) + '%';
    const whiteAhead = wp >= 50;
    const atBottom = whiteAhead === (orient !== 'b');
    num.style.top = atBottom ? 'auto' : '3px';
    num.style.bottom = atBottom ? '3px' : 'auto';
    num.style.color = whiteAhead ? '#2b2f38' : '#f1f3f6';
    num.textContent = U.evalText(ev).replace(/^[+−-]/, '');
  }

  function tagHtml(cls) { return cls ? '<span class="tag c-' + cls + '">' + R.CLS[cls].sym + '</span>' : ''; }

  function movesStrip(el, hist, current, classes) {
    let h = '';
    hist.forEach((m, i) => {
      if (i % 2 === 0) h += '<span class="n">' + (i / 2 + 1) + '.</span>';
      h += '<button class="mv' + (i + 1 === current ? ' on' : '') + '" data-ply="' + (i + 1) + '">' +
        (classes && classes[i] ? '<u class="c-' + classes[i] + '"></u>' : '') + esc(m.san) + '</button>';
    });
    el.innerHTML = h;
    const on = el.querySelector('.on');
    if (on) el.scrollLeft = on.offsetLeft - el.clientWidth / 2 + on.clientWidth / 2;
    else el.scrollLeft = 0;
  }

  function captured(chess) {
    const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const have = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
    for (const p of U.flat(chess)) if (p && p.type !== 'k') have[p.color][p.type]++;
    const lost = { w: [], b: [] };
    for (const c of ['w', 'b']) for (const t of ['q', 'r', 'b', 'n', 'p']) for (let i = have[c][t]; i < start[t]; i++) lost[c].push(t);
    return { lost, diff: U.balance(chess, 'w') };
  }
  function playerStrip(el, o) {
    const cp = o.caps;
    const taken = cp.lost[U.other(o.color)];
    const lead = o.color === 'w' ? cp.diff : -cp.diff;
    el.innerHTML = '<span class="face" style="background:' + o.hue + '">' + esc(o.name[0]) + '</span><span class="nm">' + esc(o.name) + '</span>' +
      (o.rating ? '<span class="rt">' + o.rating + '</span>' : '') + (o.thinking ? '<span class="think">thinking…</span>' : '') +
      '<span class="caps">' + taken.map((t) => '<span class="pc ' + U.other(o.color) + t + '"></span>').join('') + (lead > 0 ? '<em>+' + lead + '</em>' : '') + '</span>';
  }

  /* ---------- home ---------- */
  function history() { return store.get('history', []); }
  function myLevel() {
    const h = history().filter((x) => x.elo).slice(0, 10);
    if (!h.length) return null;
    return { elo: Math.round(h.reduce((s, x) => s + x.elo, 0) / h.length / 10) * 10, n: h.length };
  }
  function renderHome() {
    const s = S.settings;
    $('#bots').innerHTML = BOTS.map((b, i) => '<button class="bot" role="radio" aria-checked="' + (i === s.bot) + '" data-i="' + i + '"><span class="face" style="background:' + b.hue + '">' + b.name[0] + '</span><b>' + b.name + '</b><small>' + b.elo + (i === 8 ? '+' : '') + '</small></button>').join('');
    document.querySelectorAll('#colorSeg button').forEach((b) => b.setAttribute('aria-checked', b.dataset.v === s.color));
    document.querySelectorAll('#depthSeg button').forEach((b) => b.setAttribute('aria-checked', +b.dataset.v === s.movetime));
    $('#optCoach').checked = s.coach;
    $('#optEval').checked = s.evalbar;
    $('#optSound').checked = s.sound;
    const lv = myLevel();
    $('#lvlChip').hidden = !lv;
    if (lv) {
      $('#lvlChip').textContent = 'You ≈ ' + lv.elo;
      $('#homeHello').textContent = 'You are playing at about ' + lv.elo;
      $('#homeMsg').textContent = 'That is my estimate from your last ' + lv.n + ' reviewed game' + (lv.n > 1 ? 's' : '') + '. Pick an opponent near that level for a fair fight.';
    }
    const sv = store.get('game', null);
    $('#resumeBtn').hidden = !(sv && sv.sans && sv.sans.length);
    if (sv && sv.sans) $('#resumeInfo').textContent = 'vs ' + BOTS[sv.bot].name + ' (' + BOTS[sv.bot].elo + '), move ' + (Math.floor(sv.sans.length / 2) + 1);
  }
  $('#bots').onclick = (e) => { const b = e.target.closest('.bot'); if (b) { S.settings.bot = +b.dataset.i; saveSettings(); renderHome(); } };
  $('#colorSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) { S.settings.color = b.dataset.v; saveSettings(); renderHome(); } };
  $('#depthSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) { S.settings.movetime = +b.dataset.v; saveSettings(); renderHome(); } };
  $('#optCoach').onchange = (e) => { S.settings.coach = e.target.checked; saveSettings(); };
  $('#optEval').onchange = (e) => { S.settings.evalbar = e.target.checked; saveSettings(); };
  $('#optSound').onchange = (e) => { S.settings.sound = e.target.checked; saveSettings(); };
  $('#playBtn').onclick = () => newGame();
  $('#resumeBtn').onclick = () => resumeGame();
  $('#historyBtn').onclick = () => historySheet();
  $('#pgnBtn').onclick = () => pgnSheet();

  /* ---------- game ---------- */
  let G = null;
  const gBoard = new RW.Board($('#gBoard'));
  gBoard.getMoves = (sq) => {
    if (!G || G.over || G.chess.turn() !== G.user) return [];
    const p = G.chess.get(sq);
    return p && p.color === G.user ? G.chess.moves({ square: sq, verbose: true }) : [];
  };
  gBoard.onMove = (f, t, p, dragged) => userMove(f, t, p, dragged);

  function say(title, text, cls, acts) {
    $('#gCoachTitle').innerHTML = tagHtml(cls) + esc(title);
    $('#gCoachText').innerHTML = text === '…' ? '<span class="dots"><i></i><i></i><i></i></span>' : esc(text || '');
    const box = $('#gCoachActs');
    box.innerHTML = '';
    (acts || []).forEach((a) => {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.onclick = a.fn;
      box.appendChild(b);
    });
  }

  function newGame() {
    engine.cancelAll();
    const s = S.settings;
    const color = s.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : s.color;
    G = { chess: new Chess(), user: color, botIdx: s.bot, bot: BOTS[s.bot], seq: 0, over: false, judged: {}, id: Date.now() };
    openGame();
    say('Good luck against ' + G.bot.name, color === 'w' ? 'You have White, so you move first. Fight for the center and get your pieces out.' : 'You have Black. Meet the first move in the center and develop quickly.');
  }
  function resumeGame() {
    const sv = store.get('game', null);
    if (!sv) return;
    engine.cancelAll();
    const chess = new Chess();
    for (const san of sv.sans) if (!chess.move(san)) break;
    G = { chess, user: sv.user, botIdx: sv.bot, bot: BOTS[sv.bot], seq: 0, over: false, judged: {}, id: sv.id || Date.now() };
    openGame();
    say('Welcome back', 'We pick up where you left off. It is ' + (chess.turn() === G.user ? 'your move.' : G.bot.name + "'s move."));
  }
  function openGame() {
    show('game');
    closeSheet();
    gBoard.setOrientation(G.user);
    $('#gEval').hidden = !S.settings.evalbar;
    $('#gRow').classList.toggle('noeval', !S.settings.evalbar);
    const hist = G.chess.history({ verbose: true });
    renderGame(hist[hist.length - 1] || null, false);
    step();
  }
  function renderGame(move, animate) {
    const g = G;
    gBoard.setArrows([]);
    gBoard.setBadge(null);
    gBoard.setPosition(g.chess, move, animate);
    const caps = captured(g.chess);
    const botTurnNow = !g.over && g.chess.turn() !== g.user;
    const top = gBoard.orient === g.user ? 'bot' : 'user';
    const botO = { name: g.bot.name, rating: g.bot.elo, hue: g.bot.hue, color: U.other(g.user), caps, thinking: botTurnNow };
    const lv = myLevel();
    const userO = { name: 'You', rating: lv ? lv.elo : '', hue: '#eceff5', color: g.user, caps };
    playerStrip($('#gTop'), top === 'bot' ? botO : userO);
    playerStrip($('#gBot'), top === 'bot' ? userO : botO);
    const hist = g.chess.history({ verbose: true });
    movesStrip($('#gMoves'), hist, hist.length, hist.map((m, i) => (g.judged[i] ? g.judged[i].cls : null)));
    const op = RW.Openings.nameFor(hist.map((m) => m.san));
    $('#gameTitle').textContent = op || 'vs ' + g.bot.name;
    const set = (id, ic, label) => ($(id).innerHTML = '<span>' + icon(ic) + '</span>' + label);
    if (g.over) { set('#resignBtn', 'home', 'Menu'); set('#undoBtn', 'again', 'Rematch'); set('#hintBtn', 'chart', 'Review'); }
    else { set('#resignBtn', 'flag', 'Resign'); set('#undoBtn', 'undo', 'Take back'); set('#hintBtn', 'bulb', 'Hint'); }
    if (!g.over) store.set('game', { sans: g.chess.history(), user: g.user, bot: g.botIdx, id: g.id });
  }
  function step() {
    if (!G || G.over) return;
    if (G.chess.game_over()) return finish();
    if (G.chess.turn() === G.user) userTurn(); else botTurn();
  }
  function userTurn() {
    const g = G, seq = g.seq;
    g.hintLevel = 0;
    gBoard.interactive = true;
    g.pre = R.evalPosition(engine, g.chess.fen(), { movetime: 700, depth: 16, multipv: 2 }).then((ev) => {
      if (G === g && g.seq === seq && ev) evalBar($('#gEval'), ev, gBoard.orient);
      return ev;
    });
  }
  function userMove(from, to, promo, dragged) {
    const g = G;
    const fenBefore = g.chess.fen();
    const pre = g.pre;
    const mv = g.chess.move({ from, to, promotion: promo });
    if (!mv) return;
    const seq = ++g.seq;
    const live = () => G === g && g.seq === seq && !g.over;
    gBoard.interactive = false;
    moveSound(mv, g.chess);
    renderGame(mv, !dragged);
    if (g.chess.game_over()) return finish();
    (async () => {
      if (S.settings.coach && !engine.failed) {
        say(mv.san, '…');
        const evB = await pre;
        if (!live()) return;
        const evA = await R.evalPosition(engine, g.chess.fen(), { movetime: 400, depth: 14 });
        if (!live()) return;
        if (evB && evA) {
          const hist = g.chess.history({ verbose: true });
          const ply = hist.length - 1;
          let prev = null;
          if (ply > 0) {
            prev = Object.assign({}, hist[ply - 1]);
            if (g.lastAfter && U.povPct(g.lastAfter, prev.color) - U.povPct(evB, prev.color) >= 10) prev.cls = 'mistake';
          }
          const j = Object.assign({}, mv, R.judgeMove({ fenBefore, move: mv, evBefore: evB, evAfter: evA, sans: g.chess.history(), prev }),
            { ply, fenBefore, fenAfter: g.chess.fen(), evBefore: evB, evAfter: evA, prev });
          g.judged[ply] = j;
          g.lastAfter = evA;
          const ex = C.explain(j, g.user);
          const serious = ['mistake', 'miss', 'blunder'].includes(j.cls);
          say(ex.title, ex.text, j.cls, serious ? [{ label: 'Take back', fn: takeback }] : null);
          gBoard.setBadge({ sq: mv.to, cls: j.cls });
          g.badge = { sq: mv.to, cls: j.cls };
          evalBar($('#gEval'), evA, gBoard.orient);
          movesStrip($('#gMoves'), hist, hist.length, hist.map((m, i) => (g.judged[i] ? g.judged[i].cls : null)));
          if (serious) await sleep(700);
          if (!live()) return;
        } else say(mv.san, '');
      }
      botTurn();
    })();
  }
  async function pickBotMove(g) {
    const legal = g.chess.moves({ verbose: true });
    const random = () => legal[Math.floor(Math.random() * legal.length)];
    const b = g.bot;
    if (engine.failed) return random();
    if (g.chess.history().length > 3 && Math.random() < b.rand) return random();
    const r = await engine.analyse(g.chess.fen(), { depth: b.depth, movetime: 1500, multipv: Math.min(b.mpv, legal.length) });
    if (!r) return engine.failed ? random() : null;
    const lines = r.lines.filter((l) => l.pv && l.pv[0]);
    if (!lines.length) return random();
    const wp = (l) => U.winPct(l.mate != null ? { mate: l.mate } : { cp: l.cp });
    let pick = lines[0];
    const mateNow = pick.mate != null && pick.mate > 0 && pick.mate <= (b.elo >= 1000 ? 3 : 1);
    if (b.temp > 0 && !mateNow) {
      const top = wp(lines[0]);
      const w = lines.map((l) => Math.exp(-(top - wp(l)) / b.temp));
      let x = Math.random() * w.reduce((s, v) => s + v, 0);
      for (let i = 0; i < lines.length; i++) { x -= w[i]; if (x <= 0) { pick = lines[i]; break; } }
    }
    const u = pick.pv[0];
    return { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] };
  }
  async function botTurn() {
    const g = G, seq = g.seq;
    const live = () => G === g && g.seq === seq && !g.over;
    gBoard.interactive = false;
    const t0 = performance.now();
    const hist0 = g.chess.history({ verbose: true });
    playerStrip(gBoard.orient === g.user ? $('#gTop') : $('#gBot'), { name: g.bot.name, rating: g.bot.elo, hue: g.bot.hue, color: U.other(g.user), caps: captured(g.chess), thinking: true });
    const choice = await pickBotMove(g);
    if (!live() || !choice) return;
    const wait = 550 - (performance.now() - t0);
    if (wait > 0) await sleep(wait);
    if (!live()) return;
    const mv = g.chess.move({ from: choice.from, to: choice.to, promotion: choice.promotion });
    if (!mv) return;
    g.seq++;
    moveSound(mv, g.chess);
    const keep = g.badge && hist0.length && g.badge.sq === hist0[hist0.length - 1].to && mv.to !== g.badge.sq ? g.badge : null;
    renderGame(mv, true);
    if (keep) gBoard.setBadge(keep);
    g.badge = null;
    step();
  }
  function takeback() {
    const g = G;
    if (!g || g.over || !g.chess.history().length) return;
    engine.cancelAll();
    if (g.chess.turn() === g.user) { g.chess.undo(); if (g.chess.history().length) g.chess.undo(); }
    else g.chess.undo();
    g.seq++;
    const n = g.chess.history().length;
    Object.keys(g.judged).forEach((k) => { if (+k >= n) delete g.judged[k]; });
    g.lastAfter = null;
    const hist = g.chess.history({ verbose: true });
    renderGame(hist[hist.length - 1] || null, false);
    say('Move taken back', 'Have another look. Check what each of your pieces is attacking and what is attacking them.');
    step();
  }
  async function hint() {
    const g = G;
    if (!g || g.over || g.chess.turn() !== g.user) return;
    if (engine.failed) return say('No hints right now', 'The engine could not start on this device.');
    const seq = g.seq;
    say('Let me look', '…');
    const ev = await g.pre;
    if (G !== g || g.seq !== seq) return;
    if (!ev || !ev.best) return say('No hint available', '');
    const from = ev.best.slice(0, 2), to = ev.best.slice(2, 4);
    const tmp = new Chess(g.chess.fen());
    const m = tmp.move({ from, to, promotion: ev.best[4] });
    if (!m) return;
    g.hintLevel = (g.hintLevel || 0) + 1;
    const hist = g.chess.history({ verbose: true });
    const what = C.describe(g.chess.fen(), m, hist.length, hist[hist.length - 1]);
    if (g.hintLevel === 1) {
      gBoard.setHint(from);
      say('Look at your ' + U.NAME[m.piece] + ' on ' + from, 'There is a strong idea here: think about ' + what + '. Tap Hint again to see the move.');
    } else {
      gBoard.setHint(null);
      gBoard.setArrows([{ from, to, kind: 'hint' }]);
      say(m.san + ' is the move', cap(what) + '.');
    }
  }
  function finish(resigned) {
    const g = G;
    g.over = true;
    gBoard.interactive = false;
    engine.cancelAll();
    let result, reason;
    if (resigned) { result = g.user === 'w' ? '0-1' : '1-0'; reason = 'by resignation'; }
    else if (g.chess.in_checkmate()) { result = g.chess.turn() === 'w' ? '0-1' : '1-0'; reason = 'by checkmate'; }
    else {
      result = '1/2-1/2';
      reason = g.chess.in_stalemate() ? 'by stalemate' : g.chess.in_threefold_repetition() ? 'by repetition' : g.chess.insufficient_material() ? 'by insufficient material' : 'by the fifty-move rule';
    }
    const outcome = result === '1/2-1/2' ? 'draw' : (result === '1-0') === (g.user === 'w') ? 'win' : 'loss';
    g.result = result; g.outcome = outcome; g.reason = reason;
    store.del('game');
    const h = history();
    h.unshift({ id: g.id, date: Date.now(), sans: g.chess.history(), user: g.user, bot: g.botIdx, result, outcome });
    store.set('history', h.slice(0, 30));
    const hist = g.chess.history({ verbose: true });
    renderGame(hist[hist.length - 1] || null, false);
    const head = outcome === 'win' ? 'You won!' : outcome === 'loss' ? g.bot.name + ' won' : 'Draw';
    say(head, outcome === 'win' ? 'Well played. Let us go through it and see what you did right.' : outcome === 'loss' ? 'Tough one. The review will show exactly where it turned.' : 'A fair result. The review will show the chances both sides had.');
    setTimeout(() => { if (G === g) overSheet(); }, 500);
  }
  function overSheet() {
    const g = G;
    const head = g.outcome === 'win' ? 'You won!' : g.outcome === 'loss' ? g.bot.name + ' won' : 'Draw';
    sheet('<h3>' + esc(head) + '</h3><p class="sub">' + g.reason + ' · ' + Math.ceil(g.chess.history().length / 2) + ' moves</p>' +
      '<button class="primary big" id="oReview">Game Review</button><div class="row2"><button class="ghost" id="oAgain">Rematch</button><button class="ghost" id="oHome">New opponent</button></div>');
    $('#oReview').onclick = () => { closeSheet(); reviewCurrent(); };
    $('#oAgain').onclick = () => newGame();
    $('#oHome').onclick = () => { closeSheet(); show('home'); };
  }
  function reviewCurrent() {
    const g = G;
    startReview({ id: g.id, moves: g.chess.history({ verbose: true }), user: g.user, names: g.user === 'w' ? { w: 'You', b: g.bot.name } : { w: g.bot.name, b: 'You' }, botElo: g.bot.elo, result: g.result, back: 'game' });
  }
  $('#gameBack').onclick = () => { engine.cancelAll(); if (G) G.seq++; show('home'); };
  $('#gameFlip').onclick = () => {
    gBoard.setOrientation(U.other(gBoard.orient));
    const hist = G.chess.history({ verbose: true });
    renderGame(hist[hist.length - 1] || null, false);
  };
  $('#undoBtn').onclick = () => (G.over ? newGame() : takeback());
  $('#hintBtn').onclick = () => (G.over ? reviewCurrent() : hint());
  $('#resignBtn').onclick = () => {
    if (G.over) return show('home');
    sheet('<h3>Resign this game?</h3><p class="sub">You can still review it afterwards.</p><div class="row2"><button class="ghost" id="rNo">Keep playing</button><button class="primary" id="rYes">Resign</button></div>');
    $('#rNo').onclick = closeSheet;
    $('#rYes').onclick = () => { closeSheet(); finish(true); };
  };

  /* ---------- history and PGN ---------- */
  function historySheet() {
    const h = history();
    let html = '<h3>Past games</h3>';
    if (!h.length) html += '<p class="sub">Finished games show up here so you can review them.</p>';
    h.forEach((x, i) => {
      const b = BOTS[x.bot] || BOTS[0];
      html += '<button class="hist" data-i="' + i + '"><span class="res ' + x.outcome + '">' + (x.outcome === 'win' ? 'W' : x.outcome === 'loss' ? 'L' : 'D') + '</span><span><b>vs ' + b.name + ' (' + b.elo + ')</b><small>' +
        new Date(x.date).toLocaleDateString() + ' · ' + Math.ceil(x.sans.length / 2) + ' moves · as ' + (x.user === 'w' ? 'White' : 'Black') + '</small></span>' + (x.acc ? '<em>' + x.acc.toFixed(1) + '</em>' : '') + '</button>';
    });
    html += '<button class="ghost" id="hClose">Close</button>';
    sheet(html);
    $('#hClose').onclick = closeSheet;
    $('#sheet').querySelectorAll('.hist').forEach((el) => (el.onclick = () => {
      const x = h[+el.dataset.i], b = BOTS[x.bot] || BOTS[0];
      const c = new Chess();
      for (const s of x.sans) if (!c.move(s)) break;
      closeSheet();
      startReview({ id: x.id, moves: c.history({ verbose: true }), user: x.user, names: x.user === 'w' ? { w: 'You', b: b.name } : { w: b.name, b: 'You' }, botElo: b.elo, result: x.result, back: 'home' });
    }));
  }
  function pgnSheet() {
    sheet('<h3>Review a PGN</h3><p class="sub">Paste a game from anywhere and I will review it.</p><textarea id="pgnText" placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ..."></textarea><p class="err" id="pgnErr" hidden></p>' +
      '<div class="seg" id="pgnSide"><button data-v="w" aria-checked="true">I was White</button><button data-v="b">I was Black</button><button data-v="">Neither</button></div>' +
      '<div class="row2"><button class="ghost" id="pCancel">Cancel</button><button class="primary" id="pGo">Review</button></div>');
    let side = 'w';
    $('#pgnSide').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      side = b.dataset.v;
      $('#pgnSide').querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', x === b));
    };
    $('#pCancel').onclick = closeSheet;
    $('#pGo').onclick = () => {
      const c = new Chess();
      const text = $('#pgnText').value.trim();
      if (!text || !c.load_pgn(text, { sloppy: true }) || !c.history().length) {
        $('#pgnErr').hidden = false;
        $('#pgnErr').textContent = 'I could not read that as a chess game. Paste the moves in standard notation, for example "1. e4 e5 2. Nf3".';
        return;
      }
      const hd = c.header();
      const moves = c.history({ verbose: true });
      closeSheet();
      startReview({ id: 'pgn' + Date.now(), moves, startFen: hd.FEN || null, user: side || null, names: { w: hd.White && hd.White !== '?' ? hd.White : 'White', b: hd.Black && hd.Black !== '?' ? hd.Black : 'Black' }, result: hd.Result || '', back: 'home' });
    };
  }

  /* ---------- review ---------- */
  let RV = null;
  const cache = new Map();
  const rBoard = new RW.Board($('#rBoard'));
  const KEY = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder'];

  function pane(id) { for (const p of ['revLoading', 'revSummary', 'revSteps']) $('#' + p).hidden = p !== id; $('#revSummaryBtn').style.visibility = id === 'revSteps' ? 'visible' : 'hidden'; }

  function startReview(src) {
    engine.cancelAll();
    show('review');
    const rv = (RV = { src, ply: 0, showBest: false, orient: src.user || 'w', data: null });
    if (cache.has(src.id)) { rv.data = cache.get(src.id); return renderSummary(); }
    pane('revLoading');
    $('#revProg').style.width = '0%';
    $('#revPct').textContent = '0%';
    $('#revLoadMsg').textContent = engine.failed ? 'The engine could not start on this device, so I cannot review games here.' : 'I am checking all ' + src.moves.length + ' moves with the engine. This takes a moment.';
    if (engine.failed || !src.moves.length) return;
    R.analyzeGame({
      engine, moves: src.moves, startFen: src.startFen, movetime: S.settings.movetime, alive: () => RV === rv,
      onProgress: (p) => { if (RV === rv) { $('#revProg').style.width = p * 100 + '%'; $('#revPct').textContent = Math.round(p * 100) + '%'; } }
    }).then((data) => {
      if (RV !== rv) return;
      if (!data) { $('#revLoadMsg').textContent = 'The review was interrupted. Go back and try again.'; return; }
      rv.data = data;
      cache.set(src.id, data);
      if (src.user) {
        const h = history(), x = h.find((e) => e.id === src.id);
        if (x) { x.acc = data.sides[src.user].acc; x.elo = data.sides[src.user].elo; store.set('history', h); }
      }
      renderSummary();
    });
  }

  function graphSvg(d, cursor) {
    const n = Math.max(1, d.evals.length - 1);
    let pts = '0,100 ';
    d.evals.forEach((ev, i) => (pts += i + ',' + (100 - U.winPct(ev)).toFixed(1) + ' '));
    pts += n + ',100';
    let marks = '';
    d.moves.forEach((m, i) => {
      if (!['brilliant', 'great', 'mistake', 'miss', 'blunder'].includes(m.cls)) return;
      const y = (100 - U.winPct(d.evals[i + 1])).toFixed(1);
      marks += '<line x1="' + (i + 1) + '" y1="' + y + '" x2="' + (i + 1) + '" y2="' + y + '" stroke="var(--c-' + m.cls + ')" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
    });
    const cur = cursor != null ? '<line x1="' + cursor + '" y1="0" x2="' + cursor + '" y2="100" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/>' : '';
    return '<svg viewBox="0 0 ' + n + ' 100" preserveAspectRatio="none"><polygon points="' + pts + '" fill="#f1f3f6"/><line x1="0" y1="50" x2="' + n + '" y2="50" stroke="#8a93a3" stroke-width="1" stroke-opacity=".6" vector-effect="non-scaling-stroke"/>' + marks + cur + '</svg>';
  }

  function renderSummary() {
    const rv = RV, d = rv.data, src = rv.src, sd = d.sides;
    pane('revSummary');
    const u = src.user;
    const fmt = (a) => (a == null ? '–' : a.toFixed(1));
    let head, msg;
    if (u && sd[u].acc != null) {
      const mine = sd[u];
      const worst = d.moves.filter((m) => m.color === u && ['blunder', 'miss', 'mistake'].includes(m.cls)).sort((a, b) => b.loss - a.loss)[0];
      const bestM = d.moves.find((m) => m.color === u && (m.cls === 'brilliant' || m.cls === 'great'));
      head = mine.elo ? 'You played like a ' + mine.elo + ' this game' : 'Accuracy ' + fmt(mine.acc);
      msg = (mine.acc >= 90 ? 'Very clean chess.' : mine.acc >= 80 ? 'A solid game.' : mine.acc >= 65 ? 'Some good ideas, with a few costly slips.' : 'A rough one, but there is plenty to learn from it.') +
        (worst ? ' The moment to study is move ' + (Math.floor(worst.ply / 2) + 1) + ', ' + worst.san + '.' : ' No serious mistakes from you.') +
        (bestM ? ' I really liked ' + bestM.san + ' on move ' + (Math.floor(bestM.ply / 2) + 1) + '.' : '');
    } else {
      head = 'Review ready';
      msg = 'White scored ' + fmt(sd.w.acc) + ' and Black ' + fmt(sd.b.acc) + '. Step through the game to see where it was decided.';
    }
    const row = (k) => '<div class="tr"><span class="v" style="color:var(--c-' + k + ')">' + sd.w.counts[k] + '</span><span class="k"><u class="c-' + k + '">' + R.CLS[k].sym + '</u>' + R.CLS[k].label + '</span><span class="v" style="color:var(--c-' + k + ')">' + sd.b.counts[k] + '</span></div>';
    const grade = (g) => (g ? '<span class="g c-' + g + '">' + R.CLS[g].sym + '</span>' : '<span class="dim">–</span>');
    const phase = (p) => '<div class="tr"><span class="v">' + grade(sd.w.phases[p].grade) + '</span><span class="k">' + cap(p) + '</span><span class="v">' + grade(sd.b.phases[p].grade) + '</span></div>';
    $('#revSummary').innerHTML =
      '<div class="coach"><span class="coach-av">' + ART.coach + '</span><div class="bubble"><b>' + esc(head) + '</b><p>' + esc(msg) + '</p></div></div>' +
      '<div class="vs"><div class="card w"><span class="who">' + esc(src.names.w) + '</span><span class="acc">' + fmt(sd.w.acc) + '</span><span class="cap">Accuracy</span></div>' +
      '<div class="mid">' + esc((src.result || '').replace('1/2-1/2', '½-½')) + '<small>Result</small></div>' +
      '<div class="card b"><span class="who">' + esc(src.names.b) + '</span><span class="acc">' + fmt(sd.b.acc) + '</span><span class="cap">Accuracy</span></div></div>' +
      '<div class="graph tall" id="sGraph">' + graphSvg(d) + '</div>' +
      '<button class="primary big" id="sStart">Start Review</button>' +
      '<div class="tbl"><div class="tr"><span class="v big">' + (sd.w.elo || '–') + '</span><span class="k">Game rating</span><span class="v big">' + (sd.b.elo || '–') + '</span></div>' +
      ['opening', 'middlegame', 'endgame'].map(phase).join('') + '</div>' +
      '<div class="tbl">' + R.ORDER.map(row).join('') + '</div>' +
      (d.opening ? '<p class="fine">Opening: ' + esc(d.opening) + '</p>' : '') +
      '<p class="fine">Game rating estimates the strength shown in this one game from move accuracy. Short games are not rated.</p>';
    $('#sStart').onclick = () => { rv.ply = 0; rv.showBest = false; pane('revSteps'); renderStep(false); };
  }

  function renderStep(animate) {
    const rv = RV, d = rv.data;
    const p = rv.ply;
    const m = p > 0 ? d.moves[p - 1] : null;
    const showBest = rv.showBest && m;
    const c = new Chess(d.fens[showBest ? p - 1 : p]);
    rBoard.setOrientation(rv.orient);
    rBoard.setPosition(c, showBest ? null : m, animate);
    let ex;
    if (showBest) {
      rBoard.setBadge(null);
      rBoard.setArrows([{ from: m.best.slice(0, 2), to: m.best.slice(2, 4) }]);
      ex = C.explainBest(m);
    } else {
      rBoard.setArrows([]);
      rBoard.setBadge(m ? { sq: m.to, cls: m.cls } : null);
      ex = m ? C.explain(m, rv.src.user) : { title: 'Starting position', text: (d.opening ? 'This game was a ' + d.opening + '. ' : '') + 'Tap the arrows to step through, or jump straight to the key moments.' };
    }
    const ev = d.evals[showBest ? p - 1 : p];
    evalBar($('#rEval'), ev, rv.orient);
    $('#rEvChip').textContent = U.evalText(ev);
    $('#rTitle').innerHTML = tagHtml(ex.cls) + esc(ex.title);
    $('#rText').textContent = ex.text;
    movesStrip($('#rMoves'), d.moves, p, d.moves.map((x) => x.cls));
    $('#rGraph').innerHTML = graphSvg(d, p);
    const canBest = m && m.best && !m.isBest && !['book', 'forced'].includes(m.cls);
    $('#rBest').disabled = !canBest;
    $('#rBest').textContent = showBest ? 'Back to the move' : 'Show best';
    $('#rNextKey').disabled = nextKey() == null;
    $('#rPrev').disabled = $('#rFirst').disabled = p === 0;
    $('#rNext').disabled = $('#rLast').disabled = p === d.moves.length;
  }
  function nextKey() {
    const rv = RV, d = rv.data;
    for (let i = rv.ply; i < d.moves.length; i++) {
      const m = d.moves[i];
      if (KEY.includes(m.cls) && (!rv.src.user || m.color === rv.src.user)) return i + 1;
    }
    return null;
  }
  function go(ply, animate) {
    const rv = RV;
    if (!rv || !rv.data) return;
    const n = rv.data.moves.length;
    ply = Math.max(0, Math.min(n, ply));
    const fwd = ply === rv.ply + 1 && !rv.showBest;
    rv.ply = ply;
    rv.showBest = false;
    renderStep(animate !== false && fwd);
    if (fwd) moveSound(rv.data.moves[ply - 1], new Chess(rv.data.fens[ply]));
  }
  $('#rNext').onclick = () => go(RV.ply + 1);
  $('#rPrev').onclick = () => go(RV.ply - 1);
  $('#rFirst').onclick = () => go(0);
  $('#rLast').onclick = () => go(RV.data.moves.length);
  $('#rFlip').onclick = () => { RV.orient = U.other(RV.orient); renderStep(false); };
  $('#rBest').onclick = () => { RV.showBest = !RV.showBest; renderStep(false); };
  $('#rNextKey').onclick = () => { const k = nextKey(); if (k != null) go(k); };
  $('#rMoves').onclick = (e) => { const b = e.target.closest('.mv'); if (b) go(+b.dataset.ply, false); };
  const scrub = (e) => {
    if (!RV || !RV.data || (e.type === 'pointermove' && !e.buttons)) return;
    const r = $('#rGraph').getBoundingClientRect();
    go(Math.round(((e.clientX - r.left) / r.width) * RV.data.moves.length), false);
  };
  $('#rGraph').addEventListener('pointerdown', scrub);
  $('#rGraph').addEventListener('pointermove', scrub);
  $('#revSummaryBtn').onclick = () => renderSummary();
  $('#revBack').onclick = () => {
    const rv = RV;
    if (rv && rv.data && !$('#revSteps').hidden) return renderSummary();
    RV = null;
    engine.cancelAll();
    show(rv && rv.src.back === 'game' && G ? 'game' : 'home');
  };
  document.addEventListener('keydown', (e) => {
    if ($('#review').hidden || $('#revSteps').hidden) return;
    if (e.key === 'ArrowRight') go(RV.ply + 1);
    if (e.key === 'ArrowLeft') go(RV.ply - 1);
  });

  window.__rw = { get G() { return G; }, get RV() { return RV; }, engine, newGame, startReview, go, S };
  show('home');
})();
