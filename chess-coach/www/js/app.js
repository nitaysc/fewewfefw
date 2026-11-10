/* Rookwise: the app shell (tabs, sheets), game flow against the bot, live coaching, and the review walkthrough. */
(function () {
  'use strict';
  const U = RW.U, R = RW.Review, C = RW.Coach, Snd = RW.Sound, Voice = RW.Voice, AV = RW.Avatars;
  const Plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

  const store = {
    get(k, d) { try { const v = localStorage.getItem('rw.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rw.' + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem('rw.' + k); } catch (e) {} }
  };

  /* ---------- icons ---------- */
  const MARK = '<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="10" fill="#f3b33d"/><path fill="#1d1503" d="M10 8h4v3h2.5V8h3v3H22V8h4v7l-3 2.5V24l3 2v3H10v-3l3-2v-6.5L10 15z"/></svg>';
  /* Icons: Material Design Icons (pictogrammers.com), Apache 2.0. One filled path each, 24 x 24. */
  const IC = {
    back: 'M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z',
    prev: 'M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z',
    next: 'M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z',
    first: 'M18.41,16.59L13.82,12L18.41,7.41L17,6L11,12L17,18L18.41,16.59M6,6H8V18H6V6Z',
    last: 'M5.59,7.41L10.18,12L5.59,16.59L7,18L13,12L7,6L5.59,7.41M16,6H18V18H16V6Z',
    flip: 'M9,3L5,7H8V14H10V7H13M16,17V10H14V17H11L15,21L19,17H16Z',
    flag: 'M14.4,6L14,4H5V21H7V14H12.6L13,16H20V6H14.4Z',
    undo: 'M13.5,7A6.5,6.5 0 0,1 20,13.5A6.5,6.5 0 0,1 13.5,20H10V18H13.5C16,18 18,16 18,13.5C18,11 16,9 13.5,9H7.83L10.91,12.09L9.5,13.5L4,8L9.5,2.5L10.92,3.91L7.83,7H13.5M6,18H8V20H6V18Z',
    bulb: 'M12,6A6,6 0 0,1 18,12C18,14.22 16.79,16.16 15,17.2V19A1,1 0 0,1 14,20H10A1,1 0 0,1 9,19V17.2C7.21,16.16 6,14.22 6,12A6,6 0 0,1 12,6M14,21V22A1,1 0 0,1 13,23H11A1,1 0 0,1 10,22V21H14M20,11H23V13H20V11M1,11H4V13H1V11M13,1V4H11V1H13M4.92,3.5L7.05,5.64L5.63,7.05L3.5,4.93L4.92,3.5M16.95,5.63L19.07,3.5L20.5,4.93L18.37,7.05L16.95,5.63Z',
    chart: 'M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M9 17H7V10H9V17M13 17H11V7H13V17M17 17H15V13H17V17Z',
    home: 'M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z',
    again: 'M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z',
    gear: 'M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z',
    voice: 'M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z',
    mute: 'M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z',
    play: 'M19 22H5V20H19V22M16 18H8L10.18 10H8V8H10.72L10.79 7.74C10.1 7.44 9.55 6.89 9.25 6.2C8.58 4.68 9.27 2.91 10.79 2.25C12.31 1.58 14.08 2.27 14.74 3.79C15.41 5.31 14.72 7.07 13.2 7.74L13.27 8H16V10H13.82L16 18Z',
    games: 'M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3',
    puzzle: 'M20.5,11H19V7C19,5.89 18.1,5 17,5H13V3.5A2.5,2.5 0 0,0 10.5,1A2.5,2.5 0 0,0 8,3.5V5H4A2,2 0 0,0 2,7V10.8H3.5C5,10.8 6.2,12 6.2,13.5C6.2,15 5,16.2 3.5,16.2H2V20A2,2 0 0,0 4,22H7.8V20.5C7.8,19 9,17.8 10.5,17.8C12,17.8 13.2,19 13.2,20.5V22H17A2,2 0 0,0 19,20V16H20.5A2.5,2.5 0 0,0 23,13.5A2.5,2.5 0 0,0 20.5,11Z',
    bolt: 'M11 15H6L13 1V9H18L11 23V15Z',
    eye: 'M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z',
    skip: 'M16,18H18V6H16M6,18L14.5,12L6,6V18Z',
    check: 'M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z',
    x: 'M20 6.91L17.09 4L12 9.09L6.91 4L4 6.91L9.09 12L4 17.09L6.91 20L12 14.91L17.09 20L20 17.09L14.91 12L20 6.91Z',
    stop: 'M18,18H6V6H18V18Z',
    info: 'M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z',
    target: 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,10.84 21.79,9.69 21.39,8.61L19.79,10.21C19.93,10.8 20,11.4 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4C12.6,4 13.2,4.07 13.79,4.21L15.4,2.6C14.31,2.21 13.16,2 12,2M19,2L15,6V7.5L12.45,10.05C12.3,10 12.15,10 12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12C14,11.85 14,11.7 13.95,11.55L16.5,9H18L22,5H19V2M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12H16A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8V6Z'
  };
  const icon = (n) => '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + IC[n] + '"/></svg>';
  const fillIcons = (root) => (root || document).querySelectorAll('[data-ic]').forEach((el) => (el.innerHTML = icon(el.dataset.ic)));
  $$('[data-art="mark"]').forEach((el) => (el.innerHTML = MARK));
  fillIcons();

  /* ---------- opponents, looks, piece sets ---------- */
  const BOTS = [
    { name: 'Pip', elo: 400, art: 'chick', hue: '#8ccdf2', depth: 2, mpv: 4, rand: 0.3, temp: 26, line: 'I just learned how the horsey moves.' },
    { name: 'Dot', elo: 700, art: 'mouse', hue: '#a8dc90', depth: 3, mpv: 4, rand: 0.16, temp: 17, line: 'I take everything I can. Is that bad?' },
    { name: 'Marlo', elo: 1000, art: 'fox', hue: '#9fd8cb', depth: 4, mpv: 4, rand: 0.07, temp: 11, line: 'I know a few tricks. Watch your queen.' },
    { name: 'Juno', elo: 1300, art: 'cat', hue: '#f6b896', depth: 5, mpv: 4, rand: 0.025, temp: 7, line: 'Develop, castle, attack. Simple plan.' },
    { name: 'Bram', elo: 1600, art: 'bear', hue: '#eaa5c8', depth: 7, mpv: 4, rand: 0, temp: 4, line: 'I do not hang pieces. Mostly.' },
    { name: 'Ilse', elo: 1900, art: 'penguin', hue: '#c7aef2', depth: 9, mpv: 3, rand: 0, temp: 2.2, line: 'I can wait. You will crack first.' },
    { name: 'Leon', elo: 2200, art: 'lion', hue: '#93d9d2', depth: 11, mpv: 3, rand: 0, temp: 1.1, line: 'Small advantages add up.' },
    { name: 'Sable', elo: 2500, art: 'wolf', hue: '#cfd4de', depth: 13, mpv: 2, rand: 0, temp: 0.4, line: 'I saw this coming ten moves ago.' },
    { name: 'Maximum', elo: 3000, art: 'robot', hue: '#f3b33d', depth: 18, mpv: 1, rand: 0, temp: 0, line: 'Full engine strength. Good luck.' }
  ];
  const botArt = (i) => AV.ART[(BOTS[i] || BOTS[0]).art];
  const eloText = (i) => BOTS[i].elo + (i === BOTS.length - 1 ? '+' : '');
  // board colours only: the rest of the app looks the same whichever board is picked
  const BG = '#2c2b28';
  const LOOKS = [
    { id: 'classic', name: 'Green', light: '#ebecd0', dark: '#749454' },
    { id: 'ocean', name: 'Blue', light: '#e4e9f0', dark: '#6485a8' },
    { id: 'walnut', name: 'Wood', light: '#ead7b5', dark: '#a97a52' },
    { id: 'graphite', name: 'Grey', light: '#dcdfe4', dark: '#7f8996' }
  ];
  const SETS = [
    { id: 'staunty', name: 'Modern' }, { id: 'california', name: 'California' }, { id: 'mpchess', name: 'Solid' }, { id: 'cburnett', name: 'Classic' },
    { id: 'merida', name: 'Merida' }, { id: 'chessnut', name: 'Chessnut' }, { id: 'celtic', name: 'Celtic' }, { id: 'kiwen-suwi', name: 'Bold' }
  ];

  const S = { settings: Object.assign({ bot: 2, color: 'w', coach: true, pause: true, voice: false, evalbar: false, sound: true, haptics: true, movetime: 450, look: 'classic', pieces: 'staunty' }, store.get('settings', {})) };
  // the green board and the Modern pieces became the default; switch an existing install over once
  // (both can be changed back in Settings)
  if (store.get('style', 0) !== 2) {
    S.settings.look = 'classic';
    S.settings.pieces = 'staunty';
    try { localStorage.setItem('rw.style', '2'); localStorage.setItem('rw.settings', JSON.stringify(S.settings)); } catch (e) {}
  }
  if (!LOOKS.some((l) => l.id === S.settings.look)) S.settings.look = 'classic';
  if (!SETS.some((p) => p.id === S.settings.pieces)) S.settings.pieces = 'staunty';
  if (!BOTS[S.settings.bot]) S.settings.bot = 2;
  const saveSettings = () => store.set('settings', S.settings);

  const engine = new RW.Engine('vendor/stockfish-19-lite-single.js');

  function buzz(ms) {
    if (!S.settings.haptics) return;
    try {
      if (Plugins.Haptics) Plugins.Haptics.vibrate({ duration: ms }).catch(() => {});
      else if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
  }
  Snd.preload();
  document.addEventListener('pointerdown', () => Snd.unlock(), { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Voice.stop(); });

  function applySettings() {
    const s = S.settings;
    document.documentElement.setAttribute('data-look', s.look);
    const href = 'css/pieces-' + s.pieces + '.css';
    if ($('#pieceCss').getAttribute('href') !== href) $('#pieceCss').setAttribute('href', href);
    Snd.setEnabled(s.sound);
    Voice.setEnabled(s.voice && Voice.available);
    $$('.voice-btn').forEach((b) => {
      b.hidden = !Voice.available;
      b.innerHTML = icon(s.voice ? 'voice' : 'mute');
      b.classList.toggle('on', !!s.voice);
      b.setAttribute('aria-pressed', !!s.voice);
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', BG);
    try {
      // the app draws under a transparent status bar (MainActivity.java); keep its icons light
      if (Plugins.StatusBar) Plugins.StatusBar.setStyle({ style: 'DARK' }).catch(() => {});
    } catch (e) {}
    $('#gEval').hidden = !s.evalbar;
    $('#gRow').classList.toggle('noeval', !s.evalbar);
    fit();
  }
  $$('.voice-btn').forEach((b) => (b.onclick = () => {
    S.settings.voice = !S.settings.voice;
    saveSettings();
    applySettings();
    if (S.settings.voice) Voice.speak('Voice on. I will read my comments aloud.');
  }));

  /* ---------- shell: tabs, screens, sheets ---------- */
  const TABS = ['home', 'puzzles', 'games', 'prefs'];
  const SCREENS = TABS.concat(['game', 'review', 'puzzle']);
  // how deep a screen sits, for the direction of the slide when it opens (deeper slides in from the right)
  const DEPTH = { home: 0, puzzles: 0, games: 0, prefs: 0, game: 1, puzzle: 1, review: 2 };
  let tab = 'home';
  function show(id) {
    const was = SCREENS.find((s) => !$('#' + s).hidden);
    for (const s of SCREENS) $('#' + s).hidden = s !== id;
    $('#tabnav').hidden = !TABS.includes(id);
    if (TABS.includes(id)) {
      tab = id;
      $$('#tabnav button').forEach((b) => (b.dataset.tab === id ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    }
    if (id !== 'prefs') $('#prefsBody').innerHTML = '';
    if (id === 'home') renderHome();
    if (id === 'puzzles') PZ.render();
    if (id === 'games') renderGames();
    if (id === 'prefs') renderPrefs();
    if (id !== 'review') Voice.stop();
    const el = $('#' + id);
    if (was !== id) {
      el.classList.remove('in', 'back');
      void el.offsetWidth;
      if (was && DEPTH[id] < DEPTH[was]) el.classList.add('back');
      el.classList.add('in');
    }
    if (TABS.includes(id)) { el.scrollTop = 0; raise(el); }
    fit();
  }
  /* Tab pages: the top bar lifts onto a surface once the page scrolls under it, as in Material apps. */
  function raise(el) { const bar = el.querySelector('.topbar'); if (bar) bar.classList.toggle('raised', el.scrollTop > 4); }
  TABS.forEach((t) => $('#' + t).addEventListener('scroll', (e) => raise(e.currentTarget), { passive: true }));

  /* Touch ripples: the ink spreading from the finger that Android buttons have. */
  const RIPPLE = '.tabnav button, .toolbar button, .icon, button.opt, .hist, .keym, .mode, .theme, .row, .ghost, .primary, .pill, .bubble-acts button, .seg button';
  document.addEventListener('pointerdown', (e) => {
    let el = e.target.closest && e.target.closest(RIPPLE);
    if (!el || el.disabled) return;
    if (el.matches('.tabnav button')) el = el.querySelector('i');
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.1;
    const ink = document.createElement('span');
    ink.className = 'ripple';
    ink.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX - r.left - size / 2) + 'px;top:' + (e.clientY - r.top - size / 2) + 'px';
    el.appendChild(ink);
    const done = () => ink.remove();
    ink.addEventListener('animationend', done);
    setTimeout(done, 900);
  }, { passive: true });
  // no browser long-press menu or image dragging
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('textarea, input')) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => e.preventDefault());
  $('#tabnav').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.tab === tab) return;
    buzz(6);
    show(b.dataset.tab);
  };

  let sheetTimer = null;
  function sheet(html, onClose) {
    clearTimeout(sheetTimer);
    const sc = $('#scrim'), sh = $('#sheet');
    sc.classList.remove('closing');
    sh.style.transform = '';
    sh.innerHTML = html;
    fillIcons(sh);
    sc.hidden = false;
    sh.scrollTop = 0;
    sc.onclick = (e) => { if (e.target.id === 'scrim') { closeSheet(); if (onClose) onClose(); } };
  }
  function closeSheet() {
    const sc = $('#scrim');
    if (sc.hidden || sc.classList.contains('closing')) return;
    sc.classList.add('closing');
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(() => { sc.hidden = true; sc.classList.remove('closing'); $('#sheet').style.transform = ''; }, 200);
  }
  // pull a sheet down to close it
  (function () {
    const sh = $('#sheet');
    let y0 = null, dy = 0;
    sh.addEventListener('touchstart', (e) => { y0 = sh.scrollTop <= 0 && !e.target.closest('textarea') ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
    sh.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0) { sh.style.transform = ''; return; }
      e.preventDefault();
      sh.classList.add('dragging');
      sh.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: false });
    sh.addEventListener('touchend', () => {
      if (y0 == null) return;
      sh.classList.remove('dragging');
      if (dy > 90) closeSheet(); else sh.style.transform = '';
      y0 = null;
    });
  })();

  /* The board's size comes from the screen alone: as wide as the screen, unless the phone is so short that
     the coach would be left less than a few lines. The coach box takes the height that is left and scrolls
     inside it, so nothing the coach says (a long comment, the thinking dots, buttons) can resize the board.
     Before this, the board grew and shrank by a few percent on every move as the comment changed length. */
  const FIT = [['game', '#game'], ['revSteps', '#review'], ['puzzle', '#puzzle']];
  function fit() {
    for (const [id, screen] of FIT) {
      const s = $('#' + id);
      if (!s || s.hidden || $(screen).hidden) continue;
      const area = s.querySelector(':scope > .board-area'), coach = s.querySelector(':scope > .coach');
      if (!area) continue;
      const row = area.querySelector('.board-row');
      const cs = getComputedStyle(s);
      const inner = s.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const gap = parseFloat(cs.rowGap) || 0;
      let fixed = 0, n = 0;
      for (const c of s.children) {
        if (c.hidden || getComputedStyle(c).display === 'none' || getComputedStyle(c).position === 'absolute') continue;
        n++;
        if (c !== area && c !== coach) fixed += c.getBoundingClientRect().height;
      }
      fixed += gap * Math.max(0, n - 1);
      const acs = getComputedStyle(area);
      const width = Math.min(560, area.clientWidth - parseFloat(acs.paddingLeft) - parseFloat(acs.paddingRight));
      const evalW = row.querySelector('.evalbar:not([hidden])') ? 18 : 0;
      const coachMin = coach ? (inner < 640 ? 104 : 116) : 0;
      const full = width - evalW;
      let side = Math.min(full, inner - fixed - coachMin);
      // a board a few pixels short of the screen edge looks like a mistake: take them from the coach instead
      if (full - side <= 14 && inner - fixed - full >= coachMin - 14) side = full;
      side = Math.floor(Math.max(180, side));
      const px = side + 'px';
      if (area.style.height !== px) area.style.height = px;
      row.style.height = px;
    }
  }
  window.addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

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

  const tagHtml = (cls) => (cls ? '<span class="tag c-' + cls + '">' + R.CLS[cls].sym + '</span>' : '');
  const DOTS = '<span class="dots"><i></i><i></i><i></i></span>';

  function setAv(el, mood) {
    el.innerHTML = C.avatar(mood || 'neutral');
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
  function fillActs(box, acts) {
    box.innerHTML = '';
    (acts || []).forEach((a) => {
      const b = document.createElement('button');
      b.textContent = a.label;
      if (a.alt) b.className = 'alt';
      b.onclick = a.fn;
      box.appendChild(b);
    });
  }
  function popBubble(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    const body = el.querySelector('.bubble-body');
    body.scrollTop = 0;
    if (!body.onscroll) body.onscroll = () => moreFade(body);
    requestAnimationFrame(() => moreFade(body));
  }
  // a comment longer than its box fades out at the bottom edge, so it is clear there is more to scroll
  const moreFade = (body) => body.classList.toggle('more', body.scrollHeight - body.scrollTop - body.clientHeight > 3);

  function movesStrip(el, hist, current, classes) {
    let h = '';
    hist.forEach((m, i) => {
      if (i % 2 === 0) h += '<span class="n">' + (i / 2 + 1) + '.</span>';
      h += '<button class="mv' + (i + 1 === current ? ' on' : '') + '" data-ply="' + (i + 1) + '">' +
        (classes && classes[i] ? '<u class="c-' + classes[i] + '"></u>' : '') + esc(m.san) + '</button>';
    });
    el.innerHTML = h;
    const on = el.querySelector('.on');
    el.scrollLeft = on ? on.offsetLeft - el.clientWidth / 2 + on.clientWidth / 2 : 0;
  }

  /* A small static picture of a position. style: extra inline CSS (used to preview another look). */
  function miniBoard(fen, orient, style) {
    let b;
    try { b = new Chess(fen).board(); } catch (e) { b = []; }
    let h = '<span class="mini"' + (style ? ' style="' + style + '"' : '') + '>';
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const p = b[r] && b[r][f];
      if (!p) continue;
      const x = orient === 'b' ? 7 - f : f, y = orient === 'b' ? 7 - r : r;
      h += '<span class="pc ' + p.color + p.type + '" style="transform:translate(' + x * 100 + '%,' + y * 100 + '%)"></span>';
    }
    return h + '</span>';
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
    const taken = o.caps.lost[U.other(o.color)];
    const lead = o.color === 'w' ? o.caps.diff : -o.caps.diff;
    el.innerHTML = '<span class="avatar">' + o.art + '</span><div class="pinfo"><div class="pname"><b>' + esc(o.name) + '</b>' + (o.rating ? '<span>' + o.rating + '</span>' : '') + '</div>' +
      '<div class="caps">' + taken.map((t) => '<span class="pc ' + U.other(o.color) + t + '"></span>').join('') + (lead > 0 ? '<em>+' + lead + '</em>' : '') + '</div></div>' +
      '<span class="pstate' + (o.state === 'turn' ? ' turn' : '') + '">' + (o.state === 'think' ? 'Thinking ' + DOTS : o.state === 'turn' ? 'Your move' : '') + '</span>';
  }

  /* ---------- records ---------- */
  const history = () => store.get('history', []);
  function myLevel() {
    const h = history().filter((x) => x.elo).slice(0, 10);
    if (!h.length) return null;
    return { elo: Math.round(h.reduce((s, x) => s + x.elo, 0) / h.length / 10) * 10, n: h.length };
  }
  function finalFen(x) {
    if (x.fen) return x.fen;
    const c = new Chess();
    for (const s of x.sans) if (!c.move(s)) break;
    return c.fen();
  }
  function statsHtml() {
    const h = history();
    const rec = { win: 0, loss: 0, draw: 0 };
    h.forEach((x) => rec[x.outcome]++);
    const lv = myLevel();
    const accs = h.filter((x) => x.acc != null).slice(0, 12).reverse().map((x) => x.acc);
    const avg = accs.length ? accs.reduce((s, a) => s + a, 0) / accs.length : null;
    let html = '<div class="stat"><b>' + (lv ? lv.elo : '–') + '</b><small>Est. rating</small></div>' +
      '<div class="stat"><span class="wld"><span class="w">' + rec.win + '</span><span class="l">' + rec.loss + '</span><span class="d">' + rec.draw + '</span></span><small>Won · lost · drawn</small></div>' +
      '<div class="stat"><b>' + (avg == null ? '–' : avg.toFixed(1)) + '</b><small>Avg. accuracy</small></div>';
    if (accs.length >= 2) {
      const n = accs.length - 1;
      const y = (a) => (38 - Math.max(0, Math.min(1, (a - 30) / 70)) * 34).toFixed(1);
      const pts = accs.map((a, i) => ((i / n) * 100).toFixed(1) + ',' + y(a)).join(' ');
      html += '<div class="spark"><svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-label="Accuracy over your last ' + accs.length + ' reviewed games">' +
        '<polygon points="0,40 ' + pts + ' 100,40" fill="var(--accent)" fill-opacity=".13"/>' +
        '<polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
        '<line x1="100" y1="' + y(accs[n]) + '" x2="100" y2="' + y(accs[n]) + '" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></div>';
    } else {
      html += '<p class="empty">' + (h.length ? 'Review your games to see your accuracy trend.' : 'Play and review a game to get your first rating estimate.') + '</p>';
    }
    return html;
  }
  function dateText(t) {
    const d = new Date(t), now = new Date();
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /* ---------- play tab ---------- */
  function renderHome(scrollToBot) {
    const s = S.settings, bot = BOTS[s.bot];
    $('#bots').innerHTML = BOTS.map((b, i) => '<button class="bot" role="radio" aria-checked="' + (i === s.bot) + '" data-i="' + i + '" aria-label="' + b.name + ', ' + eloText(i) + '"><span class="avatar">' + AV.ART[b.art] + '</span>' + b.name + '<small>' + eloText(i) + '</small></button>').join('');
    $('#heroAv').innerHTML = AV.ART[bot.art];
    $('#heroName').textContent = bot.name;
    $('#heroElo').textContent = eloText(s.bot);
    $('#botLine').textContent = '“' + bot.line + '”';
    $$('#colorSeg button').forEach((b) => b.setAttribute('aria-checked', b.dataset.v === s.color));
    $('#playSub').textContent = 'vs ' + bot.name + ' · ' + (s.color === 'r' ? 'random color' : 'as ' + (s.color === 'w' ? 'White' : 'Black'));
    const lv = myLevel();
    $('#lvlChip').hidden = !lv;
    if (lv) $('#lvlChip').textContent = '≈ ' + lv.elo;
    const sv = store.get('game', null);
    const ok = !!(sv && sv.sans && sv.sans.length && BOTS[sv.bot]);
    $('#resumeBtn').hidden = !ok;
    if (ok) {
      $('#resumeInfo').textContent = 'vs ' + BOTS[sv.bot].name + ' · move ' + (Math.floor(sv.sans.length / 2) + 1);
      $('#resumeBoard').innerHTML = miniBoard(finalFen(sv), sv.user);
    }
    $('#resumeRows').hidden = !ok;
    // shortcuts: today's puzzle, and the last game played
    const d = PZ.dailyInfo();
    $('#dailyRow').hidden = !d;
    if (d) {
      $('#dailyBoard').innerHTML = miniBoard(d.fen, d.orient);
      $('#dailyInfo').textContent = d.done ? 'Solved today' + (d.streak > 1 ? ' · ' + d.streak + ' day streak' : '')
        : (d.orient === 'w' ? 'White' : 'Black') + ' to move' + (d.streak > 0 ? ' · ' + d.streak + ' day streak' : '');
    }
    const lastG = history()[0];
    $('#lastRow').hidden = !lastG;
    if (lastG) {
      const lb = BOTS[lastG.bot] || BOTS[0];
      $('#lastBoard').innerHTML = miniBoard(finalFen(lastG), lastG.user);
      $('#lastInfo').textContent = (lastG.outcome === 'win' ? 'Won' : lastG.outcome === 'loss' ? 'Lost' : 'Drew') + ' vs ' + lb.name +
        (lastG.acc != null ? ' · accuracy ' + lastG.acc.toFixed(1) : ' · ' + plural(Math.ceil(lastG.sans.length / 2), 'move'));
    }
    $('#homeStats').innerHTML = statsHtml();
    if (scrollToBot !== false) {
      const car = $('#bots'), it = car.querySelector('[aria-checked="true"]');
      if (it) car.scrollLeft = it.offsetLeft - car.clientWidth / 2 + it.clientWidth / 2;
    }
  }
  $('#bots').onclick = (e) => {
    const b = e.target.closest('.bot');
    if (!b || +b.dataset.i === S.settings.bot) return;
    S.settings.bot = +b.dataset.i;
    saveSettings();
    buzz(6);
    renderHome(false);
  };
  $('#colorSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) { S.settings.color = b.dataset.v; saveSettings(); renderHome(false); } };
  $('#playBtn').onclick = () => newGame();
  $('#resumeBtn').onclick = () => resumeGame();
  $('#dailyRow').onclick = () => PZ.open('daily');
  $('#lastRow').onclick = () => { const x = history()[0]; if (x) openHistory(x, 'home'); };
  $('#pgnBtn').onclick = () => pgnSheet();

  /* Open a finished game from the history in the review. */
  function openHistory(x, back) {
    const bi = BOTS[x.bot] ? x.bot : 0;
    const c = new Chess();
    for (const s of x.sans) if (!c.move(s)) break;
    const names = x.user === 'w' ? { w: 'You', b: BOTS[bi].name } : { w: BOTS[bi].name, b: 'You' };
    const avatars = x.user === 'w' ? { w: AV.you(), b: botArt(bi) } : { w: botArt(bi), b: AV.you() };
    startReview({ id: x.id, moves: c.history({ verbose: true }), user: x.user, names, coachNames: names, avatars, result: x.result, back });
  }

  /* ---------- games tab ---------- */
  function renderGames() {
    $('#gamesStats').innerHTML = statsHtml();
    const h = history();
    if (!h.length) {
      $('#gameList').innerHTML = '<div class="blank"><span class="coach-av">' + C.avatar('thinking') + '</span><b>No games yet</b><p>Finished games show up here. Open any of them for a full review with the coach.</p><button class="primary" id="blankPlay">Play a game</button></div>';
      $('#blankPlay').onclick = () => show('home');
      return;
    }
    $('#gameList').innerHTML = h.map((x, i) => {
      const b = BOTS[x.bot] || BOTS[0];
      const label = x.outcome === 'win' ? 'Won' : x.outcome === 'loss' ? 'Lost' : 'Draw';
      return '<button class="card hist" data-i="' + i + '"><span class="mini-wrap">' + miniBoard(finalFen(x), x.user) + '<span class="avatar">' + AV.ART[b.art] + '</span></span>' +
        '<span class="txt"><b>' + b.name + ' <span class="dim">(' + b.elo + ')</span></b><small>' + esc(x.opening || 'As ' + (x.user === 'w' ? 'White' : 'Black')) + '</small><small>' +
        dateText(x.date) + ' · ' + plural(Math.ceil(x.sans.length / 2), 'move') + '</small></span>' +
        '<span class="side"><span class="res ' + x.outcome + '">' + label + '</span>' + (x.acc != null ? '<em>' + x.acc.toFixed(1) + '</em>' : '<em class="dim">Review</em>') + '</span></button>';
    }).join('');
    $$('#gameList .hist').forEach((el) => (el.onclick = () => openHistory(h[+el.dataset.i], 'games')));
  }

  /* ---------- settings ---------- */
  function settingsHtml(inSheet) {
    const s = S.settings;
    const tog = (id, label, sub, on, off) => '<label class="opt"><span><b>' + label + '</b><small>' + sub + '</small></span><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + (off ? ' disabled' : '') + '></label>';
    const start = new Chess().fen();
    return (inSheet ? '<h3>Settings</h3>' : '') +
      '<h2>Board</h2><div class="looks" id="sLooks" role="radiogroup" aria-label="Board look">' +
      LOOKS.map((l) => '<button class="look" role="radio" aria-checked="' + (l.id === s.look) + '" data-id="' + l.id + '">' + miniBoard(start, 'w', '--sq-dark:' + l.dark + ';--sq-light:' + l.light) + l.name + '</button>').join('') + '</div>' +
      '<h2>Pieces</h2><div class="sets" id="sSets" role="radiogroup" aria-label="Piece set">' +
      SETS.map((p) => '<button class="set" role="radio" aria-checked="' + (p.id === s.pieces) + '" data-id="' + p.id + '"><i class="pv-' + p.id + '"></i>' + p.name + '</button>').join('') + '</div>' +
      '<h2>Coach</h2><div class="opts">' +
      tog('sCoach', 'Coach comments', 'Feedback, warnings and explanations as you play', s.coach) +
      tog('sPause', 'Pause on mistakes', 'Stop after a serious error so you can take it back', s.pause) +
      tog('sVoice', 'Coach voice', Voice.available ? 'Read the coach\'s comments aloud' : 'Not available on this device', s.voice && Voice.available, !Voice.available) + '</div>' +
      '<h2>Game</h2><div class="opts">' +
      tog('sSound', 'Sound', 'Recorded piece sounds', s.sound) +
      tog('sHaptics', 'Vibration', 'A short tick when you move', s.haptics) +
      tog('sEval', 'Evaluation bar', 'Show who is ahead while you play', s.evalbar) +
      '<div class="opt"><span><b>Review depth</b><small>Deeper is more accurate but slower</small></span><div class="seg small" id="sDepth">' +
      [[200, 'Fast'], [450, 'Normal'], [1200, 'Deep']].map((d) => '<button data-v="' + d[0] + '" aria-checked="' + (s.movetime === d[0]) + '">' + d[1] + '</button>').join('') + '</div></div></div>' +
      '<div class="opts">' + (inSheet && G && !$('#game').hidden ? '<button class="opt" id="sFlip"><span><b>Flip board</b></span><span class="chev" data-ic="flip"></span></button>' : '') +
      '<button class="opt" id="sCredits"><span><b>Credits and licences</b><small>Engine, sounds, pieces and fonts</small></span><span class="chev" data-ic="next"></span></button></div>' +
      (inSheet ? '<button class="primary" id="sDone">Done</button>' : '<p class="fine">Rookwise · Stockfish runs on your device; nothing leaves it.</p>');
  }
  function bindSettings(root, inSheet) {
    const s = S.settings;
    const q = (sel) => root.querySelector(sel);
    q('#sLooks').onclick = (e) => {
      const b = e.target.closest('.look');
      if (!b) return;
      s.look = b.dataset.id;
      saveSettings();
      applySettings();
      buzz(6);
      root.querySelectorAll('.look').forEach((x) => x.setAttribute('aria-checked', x.dataset.id === s.look));
    };
    q('#sSets').onclick = (e) => {
      const b = e.target.closest('.set');
      if (!b) return;
      s.pieces = b.dataset.id;
      saveSettings();
      applySettings();
      buzz(6);
      root.querySelectorAll('.set').forEach((x) => x.setAttribute('aria-checked', x.dataset.id === s.pieces));
    };
    const bind = (id, key, after) => (q('#' + id).onchange = (e) => { s[key] = e.target.checked; saveSettings(); applySettings(); if (after) after(e.target.checked); });
    bind('sCoach', 'coach');
    bind('sPause', 'pause');
    bind('sVoice', 'voice', (on) => { if (on) Voice.speak('Voice on. I will read my comments aloud.'); });
    bind('sSound', 'sound', (on) => { if (on) Snd.play('move'); });
    bind('sHaptics', 'haptics', (on) => { if (on) buzz(12); });
    bind('sEval', 'evalbar');
    q('#sDepth').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      s.movetime = +b.dataset.v;
      saveSettings();
      root.querySelectorAll('#sDepth button').forEach((x) => x.setAttribute('aria-checked', x === b));
    };
    if (q('#sFlip')) q('#sFlip').onclick = () => { closeSheet(); flipGame(); };
    q('#sCredits').onclick = () => creditsSheet(inSheet ? settingsSheet : closeSheet);
    if (q('#sDone')) q('#sDone').onclick = closeSheet;
  }
  function renderPrefs() {
    const root = $('#prefsBody');
    root.innerHTML = settingsHtml(false);
    fillIcons(root);
    bindSettings(root, false);
  }
  function settingsSheet() {
    sheet(settingsHtml(true));
    bindSettings($('#sheet'), true);
  }
  function creditsSheet(back) {
    sheet('<h3>Credits</h3><div class="credits">' +
      '<p><b>Engine</b> Stockfish 19 (lite, WebAssembly build by Nathan Rugg), GPLv3.</p>' +
      '<p><b>Rules</b> chess.js by Jeff Hlywa, BSD 2-Clause.</p>' +
      '<p><b>Puzzles</b> From the Lichess puzzle database (database.lichess.org), made from real games by lichess.org and its players, CC0.</p>' +
      '<p><b>Piece sounds</b> Chess Console Sounds by Stefan Haack (shaack.com), CC BY 4.0. Levels adjusted and clips trimmed.</p>' +
      '<p><b>Bell sounds</b> Bell dings by PWL on OpenGameArt, CC0.</p>' +
      '<p><b>Pieces</b> Modern (staunty): sadsnake1, CC BY-NC-SA 4.0. California: Jerry S., CC BY-NC-SA 4.0. Solid (mpchess): Maxime Chupin, GPLv3+. Classic: Colin M.L. Burnett, GPLv2+. Merida: Armando Hernandez Marroquin, GPLv2+. Chessnut: Alexis Luengas, Apache 2.0. Celtic: Maurizio Monge, MIT. Bold (kiwen-suwi): neverRare, CC BY 4.0. All taken unchanged from the lichess-org/lila collection.</p>' +
      '<p><b>Pictures</b> The opponents and the coach are Fluent Emoji by Microsoft, MIT licence.</p>' +
      '<p><b>Icons</b> Material Design Icons by Pictogrammers, Apache 2.0.</p>' +
      '<p><b>Font</b> Roboto (The Roboto Project Authors), SIL Open Font License 1.1.</p>' +
      '</div><button class="primary" id="cDone">Back</button>');
    $('#cDone').onclick = back;
  }

  /* ---------- the coach explains a move in full ----------
     j: a graded move (from live play or a review). o: {user, names, orient, takeback}. */
  function explainSheet(j, o) {
    const ex = C.explain(j, o.user, o.names);
    const mine = !!o.user && j.color === o.user;
    const who = mine ? 'You' : (o.names && o.names[j.color]) || (j.color === 'w' ? 'White' : 'Black');
    const pct = (x) => Math.round(Math.max(0, Math.min(100, x))) + '%';
    const evChip = (ev) => { const t = U.evalText(ev); return t ? '<em' + (U.winPct(ev) >= 50 ? ' class="w"' : '') + '>' + esc(t) + '</em>' : '<em></em>'; };
    const bad = R.BAD.includes(j.cls);
    let h = '<div class="exp-head">' + tagHtml(j.cls) + '<div><b>' + esc(ex.title) + '</b><small>Move ' + (Math.floor(j.ply / 2) + 1) + ' · ' + esc(who) + ', playing ' + (j.color === 'w' ? 'White' : 'Black') + '</small></div></div>' +
      '<p class="exp-text">' + esc(ex.text) + '</p>' +
      '<div class="exp-board"><div class="board" id="xBoard"></div></div>' +
      '<p class="fine exp-key">' + (ex.best ? '<i class="k-good"></i>Best: ' + esc(ex.best.san) + '<i class="k-' + (bad ? 'bad' : 'ok') + '"></i>Played: ' + esc(j.san) : '<i class="k-good"></i>' + esc(j.san) + ' was the best move') + '</p>' +
      '<div class="cmp">' +
      '<div class="cmp-row"><small>Played</small><span><b>' + esc(j.san) + '</b><span class="ln">' + esc(ex.played.lineText) + '</span></span>' + evChip(j.evAfter) + '</div>' +
      (ex.best ? '<div class="cmp-row"><small>Best</small><span><b>' + esc(ex.best.san) + '</b><span class="ln">' + esc(ex.best.lineText) + '</span></span>' + evChip(j.evBefore) + '</div>' : '') +
      '</div>' +
      '<div class="meter-row"><div class="lbl"><span>' + (mine ? 'Your' : esc(who) + (who.endsWith('s') ? '\'' : '\'s')) + ' winning chances</span><b>' + pct(j.wpB) + ' → ' + pct(j.wpA) + '</b></div>' +
      '<div class="meter"><i style="width:' + pct(j.wpA) + '"></i></div>' +
      '<div class="lbl"><span>Before: ' + ex.stand.before + '</span><span>After: ' + ex.stand.after + '</span></div></div>';
    if (ex.points.length) h += '<ul class="points">' + ex.points.map((p) => '<li' + (p.bad ? ' class="bad"' : '') + '>' + esc(p.text) + '</li>').join('') + '</ul>';
    if (ex.tip) h += '<div class="exp-tip"><b>Tip.</b> ' + esc(ex.tip) + '</div>';
    h += o.takeback ? '<div class="row2"><button class="ghost" id="xClose">Close</button><button class="primary" id="xBack">Take back</button></div>' : '<button class="primary" id="xClose">Got it</button>';
    sheet(h);
    // the position before the move, with the move played and the better one
    const xb = new RW.Board($('#xBoard'));
    xb.setOrientation(o.orient || o.user || 'w');
    xb.setPosition(new Chess(j.fenBefore), null, false);
    const arrows = [{ from: j.from, to: j.to, kind: ex.best ? (bad ? 'bad' : 'ok') : 'good' }];
    if (ex.best) arrows.push({ from: ex.best.from, to: ex.best.to, kind: 'good' });
    xb.setArrows(arrows);
    $('#xClose').onclick = closeSheet;
    if ($('#xBack')) $('#xBack').onclick = () => { closeSheet(); takeback(); };
    Voice.stop();
  }

  /* ---------- game ---------- */
  let G = null;
  const gBoard = new RW.Board($('#gBoard'));
  gBoard.getMoves = (sq) => {
    if (!G || G.over || G.chess.turn() !== G.user) return [];
    const p = G.chess.get(sq);
    return p && p.color === G.user ? G.chess.moves({ square: sq, verbose: true }) : [];
  };
  gBoard.onMove = (f, t, p, dragged) => userMove(f, t, p, dragged);
  gBoard.onIllegal = () => Snd.play('illegal');

  /* The coach bubble under the board. o: {title, text, cls, mood, note, warn, tip, acts, thinking, speak} */
  function say(o) {
    $('#gTitle').innerHTML = tagHtml(o.cls) + esc(o.title || '');
    $('#gText').innerHTML = o.thinking ? DOTS : esc(o.text || '');
    $('#gNote').textContent = o.note || '';
    $('#gWarn').textContent = o.warn || '';
    $('#gTip').textContent = o.tip || '';
    fillActs($('#gActs'), o.acts);
    setAv($('#gAv'), o.mood);
    popBubble($('#gBubble'));
    if (!o.thinking && o.speak !== false) Voice.speak([o.title, o.text].filter(Boolean).join('. '));
  }
  function showThreat(th) {
    $('#gWarn').textContent = th ? th.text : '';
    gBoard.setWarn(th && th.sq && th.kind !== 'check' ? th.sq : null);
    if (th) { setAv($('#gAv'), 'worried'); Voice.speak(th.text, true); }
  }

  function makeGame(chess, user, botIdx, id) {
    const bot = BOTS[botIdx];
    return { chess, user, botIdx, bot, seq: 0, over: false, judged: {}, id, streak: 0, inBook: true, paused: false,
      names: user === 'w' ? { w: 'You', b: bot.name } : { w: bot.name, b: 'You' } };
  }
  function newGame() {
    engine.cancelAll();
    closeSheet();
    const s = S.settings;
    const color = s.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : s.color;
    G = makeGame(new Chess(), color, s.bot, Date.now());
    Snd.play('start');
    say({ title: 'Good luck against ' + G.bot.name, mood: 'happy',
      text: color === 'w' ? 'You have White, so you move first. Fight for the center and get your pieces out.' : 'You have Black. Meet the first move in the center and develop quickly.',
      note: G.bot.name + ': "' + G.bot.line + '"' });
    openGame();
  }
  function resumeGame() {
    const sv = store.get('game', null);
    if (!sv || !BOTS[sv.bot]) return;
    engine.cancelAll();
    const chess = new Chess();
    for (const san of sv.sans) if (!chess.move(san)) break;
    G = makeGame(chess, sv.user, sv.bot, sv.id || Date.now());
    G.inBook = !!RW.Openings.lookup(chess.history());
    say({ title: 'Welcome back', mood: 'happy', text: 'We pick up where you left off. It is ' + (chess.turn() === G.user ? 'your move.' : G.bot.name + "'s move.") });
    openGame();
  }
  function openGame() {
    show('game');
    closeSheet();
    gBoard.setOrientation(G.user);
    applySettings();
    const h = G.chess.history({ verbose: true });
    renderGame(h[h.length - 1] || null, false);
    step();
  }
  function renderPlayers(thinking) {
    const g = G;
    const caps = captured(g.chess);
    const lv = myLevel();
    const yourTurn = !g.over && !g.paused && !thinking && g.chess.turn() === g.user;
    const botO = { name: g.bot.name, rating: eloText(g.botIdx), art: botArt(g.botIdx), color: U.other(g.user), caps, state: thinking ? 'think' : '' };
    const userO = { name: 'You', rating: lv ? '≈ ' + lv.elo : '', art: AV.you(), color: g.user, caps, state: yourTurn ? 'turn' : '' };
    const botOnTop = gBoard.orient === g.user;
    playerStrip($('#gTop'), botOnTop ? botO : userO);
    playerStrip($('#gBot'), botOnTop ? userO : botO);
  }
  function renderGame(move, animate) {
    const g = G;
    gBoard.setArrows([]);
    gBoard.setBadge(null);
    gBoard.setPosition(g.chess, move, animate);
    renderPlayers(!g.over && !g.paused && g.chess.turn() !== g.user);
    const h = g.chess.history({ verbose: true });
    movesStrip($('#gMoves'), h, h.length, h.map((m, i) => (g.judged[i] ? g.judged[i].cls : null)));
    $('#gameTitle').textContent = RW.Openings.nameFor(h.map((m) => m.san)) || 'vs ' + g.bot.name;
    const set = (id, ic, label) => ($(id).innerHTML = '<span>' + icon(ic) + '</span>' + label);
    if (g.over) { set('#resignBtn', 'home', 'Menu'); set('#undoBtn', 'again', 'Rematch'); set('#hintBtn', 'chart', 'Review'); }
    else { set('#resignBtn', 'flag', 'Resign'); set('#undoBtn', 'undo', 'Take back'); set('#hintBtn', 'bulb', 'Hint'); }
    set('#explainBtn', 'info', 'Explain');
    syncExplain();
    if (!g.over) store.set('game', { sans: g.chess.history(), user: g.user, bot: g.botIdx, id: g.id, fen: g.chess.fen() });
    fit();
  }
  /* The last of the player's moves the coach has graded, or null. */
  function lastJudged() {
    if (!G) return null;
    const ks = Object.keys(G.judged).map(Number);
    return ks.length ? G.judged[Math.max.apply(null, ks)] : null;
  }
  function syncExplain() {
    const b = $('#explainBtn');
    b.hidden = !S.settings.coach;
    b.disabled = !lastJudged();
  }
  function explainLast() {
    const g = G, j = lastJudged();
    if (!j) return;
    // taking back is offered while that move is still the player's latest
    const n = g.chess.history().length;
    explainSheet(j, { user: g.user, names: g.names, orient: gBoard.orient, takeback: !g.over && j.ply >= n - 2 });
  }
  function flipGame() {
    gBoard.setOrientation(U.other(gBoard.orient));
    const h = G.chess.history({ verbose: true });
    renderGame(h[h.length - 1] || null, false);
    if (G.lastEv) evalBar($('#gEval'), G.lastEv, gBoard.orient);
  }
  function step() {
    if (!G || G.over) return;
    if (G.chess.game_over()) return finish();
    if (G.chess.turn() === G.user) userTurn(); else botTurn();
  }

  function userTurn() {
    const g = G, seq = g.seq, fen = g.chess.fen();
    const live = () => G === g && g.seq === seq && !g.over;
    g.hintStage = 0;
    gBoard.setInteractive(true);
    renderPlayers(false);
    const h = g.chess.history({ verbose: true });
    const last = h[h.length - 1];
    const coach = S.settings.coach;
    let quick = null;
    if (coach && last && last.color !== g.user) {
      // the note needs the position before the reply, which we only have if we watched it happen
      if (g.botFenBefore) {
        let note = C.opponentNote(g.botFenBefore, last, h.length - 1, h[h.length - 2], g.bot.name);
        if (g.inBook && h.length > 2 && !RW.Openings.lookup(h.map((m) => m.san))) { g.inBook = false; note += ' That takes us out of the opening book.'; }
        $('#gNote').textContent = note;
      }
      // the warning does not: it matters just as much after a take-back or when resuming a game
      quick = C.threats(fen, g.bot.name);
      showThreat(quick);
    }
    // a "what if I pass" search finds threats that take more than one move
    const pass = coach && !engine.failed && h.length >= 2 && !quick ? U.passFen(fen) : null;
    const probeP = pass ? R.evalPosition(engine, pass, { movetime: 220, depth: 10 }) : null;
    g.pre = R.evalPosition(engine, fen, { movetime: 700, depth: 16, multipv: 2 }).then((ev) => {
      if (live() && ev) { g.lastEv = ev; evalBar($('#gEval'), ev, gBoard.orient); }
      return ev;
    });
    if (probeP) {
      Promise.all([probeP, g.pre]).then(([probe, base]) => {
        if (!live() || !probe || !base) return;
        const th = C.threats(fen, g.bot.name, probe, base);
        if (th) showThreat(th);
      });
    }
  }

  const COUNT = { 3: 'three', 5: 'five', 8: 'eight', 12: 'twelve' };
  function userMove(from, to, promo, dragged) {
    const g = G;
    const fenBefore = g.chess.fen();
    const pre = g.pre;
    const mv = g.chess.move({ from, to, promotion: promo });
    if (!mv) return;
    const seq = ++g.seq;
    const live = () => G === g && g.seq === seq && !g.over;
    gBoard.setInteractive(false);
    Snd.forMove(mv, g.chess, { delay: dragged ? 0 : 0.1 });
    buzz(8);
    g.badge = null;
    renderGame(mv, !dragged);
    if (g.chess.game_over()) return finish();
    (async () => {
      if (S.settings.coach && !engine.failed) {
        say({ title: mv.san, thinking: true, mood: 'thinking' });
        const evB = await pre;
        if (!live()) return;
        const evA = await R.evalPosition(engine, g.chess.fen(), { movetime: 400, depth: 14 });
        if (!live()) return;
        if (evB && evA) {
          const h = g.chess.history({ verbose: true });
          const ply = h.length - 1;
          let prev = null;
          if (ply > 0) {
            prev = Object.assign({}, h[ply - 1], { opening: g.lastOpening });
            if (g.lastAfter && U.povPct(g.lastAfter, prev.color) - U.povPct(evB, prev.color) >= 10) prev.cls = 'mistake';
          }
          const sans = g.chess.history();
          const j = Object.assign({}, mv, R.judgeMove({ fenBefore, move: mv, evBefore: evB, evAfter: evA, sans, prev }),
            { ply, fenBefore, fenAfter: g.chess.fen(), evBefore: evB, evAfter: evA, prev, all: h });
          g.judged[ply] = j;
          syncExplain();
          g.lastAfter = g.lastEv = evA;
          g.lastOpening = j.opening;
          const ex = C.explain(j, g.user, g.names);
          let text = ex.text;
          const strong = ['best', 'great', 'brilliant', 'excellent'].includes(j.cls);
          if (strong) g.streak++; else if (!['book', 'good', 'forced'].includes(j.cls)) g.streak = 0;
          if (strong && COUNT[g.streak]) text += ' That is ' + COUNT[g.streak] + ' strong moves in a row.';
          if (g.inBook && !RW.Openings.lookup(sans)) { g.inBook = false; if (ply >= 2 && j.cls !== 'book') text += ' We are out of the opening book now.'; }
          const serious = ['mistake', 'miss', 'blunder'].includes(j.cls);
          const hold = serious && S.settings.pause;
          g.paused = hold;
          say({ title: ex.title, text, cls: j.cls, mood: ex.mood, tip: ex.tip,
            acts: hold ? [{ label: 'Take back', fn: takeback }, { label: 'Keep it', alt: true, fn: () => { if (g.resume) g.resume(); } }]
              : serious ? [{ label: 'Take back', fn: takeback }] : null });
          gBoard.setBadge({ sq: mv.to, cls: j.cls });
          g.badge = { sq: mv.to, cls: j.cls };
          evalBar($('#gEval'), evA, gBoard.orient);
          movesStrip($('#gMoves'), h, h.length, h.map((m, i) => (g.judged[i] ? g.judged[i].cls : null)));
          if (serious) buzz(30);
          if (hold) {
            renderPlayers(false);
            await new Promise((res) => (g.resume = res));
            g.resume = null;
            g.paused = false;
            if (!live()) return;
            fillActs($('#gActs'), null);
          } else if (serious) {
            await sleep(700);
            if (!live()) return;
          }
        } else say({ title: mv.san, text: '', speak: false });
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
    gBoard.setInteractive(false);
    renderPlayers(true);
    const t0 = performance.now();
    const fenBefore = g.chess.fen();
    const choice = await pickBotMove(g);
    if (!live() || !choice) return;
    const wait = 600 - (performance.now() - t0);
    if (wait > 0) await sleep(wait);
    if (!live()) return;
    const mv = g.chess.move({ from: choice.from, to: choice.to, promotion: choice.promotion });
    if (!mv) return;
    g.seq++;
    g.botFenBefore = fenBefore;
    Snd.forMove(mv, g.chess, { opponent: true, delay: 0.1 });
    const keep = g.badge && mv.to !== g.badge.sq ? g.badge : null;
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
    g.paused = false;
    if (g.resume) { const r = g.resume; g.resume = null; r(); }
    const n = g.chess.history().length;
    Object.keys(g.judged).forEach((k) => { if (+k >= n) delete g.judged[k]; });
    syncExplain();
    g.lastAfter = null;
    g.badge = null;
    g.streak = 0;
    g.botFenBefore = null;
    Snd.play('takeback');
    const h = g.chess.history({ verbose: true });
    renderGame(h[h.length - 1] || null, false);
    say({ title: 'Move taken back', mood: 'neutral', text: 'Have another look. What is each of your pieces attacking, and what is attacking them?' });
    step();
  }
  async function hint() {
    const g = G;
    if (!g || g.over || g.paused || g.chess.turn() !== g.user) return;
    if (engine.failed) return say({ title: 'No hints right now', mood: 'worried', text: 'The engine could not start on this device.' });
    const seq = g.seq;
    const keep = { note: $('#gNote').textContent, warn: $('#gWarn').textContent };
    say(Object.assign({ title: 'Let me look', thinking: true, mood: 'thinking' }, keep));
    const ev = await g.pre;
    if (G !== g || g.seq !== seq) return;
    const h = g.chess.history({ verbose: true });
    const stage = Math.min(3, (g.hintStage || 0) + 1);
    const hn = ev && ev.best ? C.hint(g.chess.fen(), ev.best, h.length, h[h.length - 1], stage) : null;
    if (!hn) return say(Object.assign({ title: 'No hint available', mood: 'neutral', text: 'I do not have a suggestion here.' }, keep));
    g.hintStage = stage;
    gBoard.setHint(hn.square || null);
    gBoard.setArrows(hn.arrow ? [hn.arrow] : []);
    say(Object.assign({ title: hn.title, text: hn.text + (hn.more ? ' Tap Hint again for more.' : ''), mood: hn.mood }, keep));
  }
  function finish(resigned) {
    const g = G;
    g.over = true;
    g.paused = false;
    gBoard.setInteractive(false);
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
    const sans = g.chess.history();
    const hs = history();
    hs.unshift({ id: g.id, date: Date.now(), sans, user: g.user, bot: g.botIdx, result, outcome, fen: g.chess.fen(), opening: RW.Openings.nameFor(sans) || '' });
    store.set('history', hs.slice(0, 30));
    const h = g.chess.history({ verbose: true });
    renderGame(h[h.length - 1] || null, false);
    setTimeout(() => Snd.play(outcome === 'win' ? 'win' : outcome === 'loss' ? 'lose' : 'draw'), 380);
    buzz(outcome === 'win' ? 45 : 25);
    say({ title: outcome === 'win' ? 'You won!' : outcome === 'loss' ? g.bot.name + ' won' : 'Draw',
      mood: outcome === 'win' ? 'excited' : outcome === 'loss' ? 'worried' : 'neutral',
      text: outcome === 'win' ? 'Well played. Let us go through it and see what you did right.' : outcome === 'loss' ? 'Tough one. The review will show exactly where it turned.' : 'A fair result. The review will show the chances both sides had.' });
    setTimeout(() => { if (G === g && !$('#game').hidden && $('#scrim').hidden) overSheet(); }, 900);
  }
  function overSheet() {
    const g = G;
    const head = g.outcome === 'win' ? 'You won!' : g.outcome === 'loss' ? g.bot.name + ' won' : 'Draw';
    const score = g.outcome === 'draw' ? '½–½' : g.outcome === 'win' ? '1–0' : '0–1';
    sheet('<div class="versus"><span class="avatar' + (g.outcome === 'win' ? ' won' : '') + '">' + AV.you() + '</span><b>' + score + '</b><span class="avatar' + (g.outcome === 'loss' ? ' won' : '') + '">' + botArt(g.botIdx) + '</span></div>' +
      '<h3>' + esc(head) + '</h3><p class="sub">' + g.reason + ' · ' + plural(Math.ceil(g.chess.history().length / 2), 'move') + '</p>' +
      '<button class="primary big" id="oReview">Game Review</button><div class="row2"><button class="ghost" id="oAgain">Rematch</button><button class="ghost" id="oHome">New opponent</button></div>');
    $('#oReview').onclick = () => { closeSheet(); reviewCurrent(); };
    $('#oAgain').onclick = () => newGame();
    $('#oHome').onclick = () => { closeSheet(); show('home'); };
  }
  function reviewCurrent() {
    const g = G;
    const avatars = g.user === 'w' ? { w: AV.you(), b: botArt(g.botIdx) } : { w: botArt(g.botIdx), b: AV.you() };
    startReview({ id: g.id, moves: g.chess.history({ verbose: true }), user: g.user, names: g.names, coachNames: g.names, avatars, result: g.result, back: 'game' });
  }
  $('#gameBack').onclick = () => { engine.cancelAll(); if (G) { G.seq++; if (G.resume) G.resume(); } show('home'); };
  $('#gameSettings').onclick = () => settingsSheet();
  $('#undoBtn').onclick = () => (G.over ? newGame() : takeback());
  $('#hintBtn').onclick = () => (G.over ? reviewCurrent() : hint());
  $('#explainBtn').onclick = explainLast;
  // tapping the coach's comment opens the full explanation too
  $('#gBubble').onclick = (e) => { if (!e.target.closest('button') && lastJudged() && S.settings.coach) explainLast(); };
  $('#resignBtn').onclick = () => {
    if (G.over) return show('home');
    sheet('<h3>Resign this game?</h3><p class="sub">You can still review it afterwards.</p><div class="row2"><button class="ghost" id="rNo">Keep playing</button><button class="primary" id="rYes">Resign</button></div>');
    $('#rNo').onclick = closeSheet;
    $('#rYes').onclick = () => { closeSheet(); if (G.resume) G.resume(); G.seq++; finish(true); };
  };

  /* ---------- PGN import ---------- */
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
      let result = hd.Result && hd.Result !== '*' ? hd.Result : '';
      if (!result && c.in_checkmate()) result = c.turn() === 'w' ? '0-1' : '1-0';
      else if (!result && c.game_over()) result = '1/2-1/2';
      closeSheet();
      const names = { w: hd.White && hd.White !== '?' ? hd.White : 'White', b: hd.Black && hd.Black !== '?' ? hd.Black : 'Black' };
      if (side) names[side] = 'You';
      const avatars = { w: side === 'w' ? AV.you() : AV.side('w'), b: side === 'b' ? AV.you() : AV.side('b') };
      startReview({ id: 'pgn' + U.hash(text), moves, startFen: hd.FEN || null, user: side || null, names, avatars, result, back: tab });
    };
  }

  /* ---------- review ---------- */
  let RV = null;
  const cache = new Map();
  const rBoard = new RW.Board($('#rBoard'));
  rBoard.onIllegal = () => Snd.play('illegal');
  rBoard.getMoves = (sq) => {
    const rv = RV;
    if (!rv || rv.mode !== 'retry' || !rv.data) return [];
    const m = rv.data.moves[rv.ply - 1];
    const c = new Chess(rv.data.fens[rv.ply - 1]);
    const p = c.get(sq);
    return p && p.color === m.color ? c.moves({ square: sq, verbose: true }) : [];
  };
  rBoard.onMove = (f, t, p, dragged) => tryRetry(f, t, p, dragged);
  const KEY = ['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder'];
  const canImprove = (m) => !!(m && m.best && !m.isBest && !['book', 'forced'].includes(m.cls));
  const moveNo = (m) => Math.floor(m.ply / 2) + 1 + (m.color === 'w' ? '.' : '...');

  function pane(id) {
    for (const p of ['revLoading', 'revSummary', 'revSteps']) $('#' + p).hidden = p !== id;
    $('#revSummaryBtn').style.visibility = id === 'revSteps' ? 'visible' : 'hidden';
    fit();
  }
  function stopLine() { if (RV && RV.timer) { clearTimeout(RV.timer); RV.timer = null; } }
  function ring(p) {
    $('#revRingVal').style.strokeDashoffset = (326.7 * (1 - p)).toFixed(1);
    $('#revPctNum').textContent = Math.round(p * 100) + '%';
  }

  /* The coach bubble above the review board. */
  $('#rBubble').onclick = (e) => {
    const rv = RV;
    if (e.target.closest('button') || !rv || !rv.data || rv.mode !== 'move' || rv.ply < 1) return;
    explainSheet(rv.data.moves[rv.ply - 1], { user: rv.src.user, names: rv.src.coachNames, orient: rv.orient });
  };
  function rSay(o, ev, acts) {
    $('#rEvChip').textContent = ev ? U.evalText(ev) : '';
    $('#rTitle').innerHTML = tagHtml(o.cls) + esc(o.title || '');
    $('#rText').innerHTML = o.thinking ? DOTS : esc(o.text || '');
    $('#rTip').textContent = o.tip || '';
    fillActs($('#rActs'), acts);
    setAv($('#rAv'), o.mood);
    popBubble($('#rBubble'));
    if (!o.thinking && o.speak !== false) Voice.speak([o.title, o.text].filter(Boolean).join('. '));
  }

  function startReview(src) {
    engine.cancelAll();
    Voice.stop();
    stopLine();
    if (!src.avatars) src.avatars = { w: AV.side('w'), b: AV.side('b') };
    show('review');
    const rv = (RV = { src, ply: 0, mode: 'move', orient: src.user || 'w', data: null, timer: null });
    if (cache.has(src.id)) { rv.data = cache.get(src.id); return renderSummary(); }
    const saved = store.get('reviews', {})[src.id];
    pane('revLoading');
    setAv($('#lAv'), 'thinking');
    ring(0);
    $('#revPct').textContent = '';
    const stuck = !src.moves.length ? 'There are no moves in this game to review.' : engine.failed && !saved ? 'The engine could not start on this device, so I cannot review games here.' : '';
    $('#revLoadMsg').textContent = stuck || 'I am checking all ' + plural(src.moves.length, 'move') + ' with the engine.';
    if (stuck) return;
    R.analyzeGame({
      engine, moves: src.moves, startFen: src.startFen, movetime: S.settings.movetime, alive: () => RV === rv, cached: saved && saved.evals,
      onProgress: (p, i, n) => {
        if (RV !== rv) return;
        ring(p);
        $('#revPct').textContent = 'Move ' + Math.max(1, Math.ceil(i / 2)) + ' of ' + Math.ceil(n / 2);
      }
    }).then((data) => {
      if (RV !== rv) return;
      if (!data) { $('#revLoadMsg').textContent = 'The review was interrupted. Go back and try again.'; return; }
      rv.data = data;
      cache.set(src.id, data);
      // keep the evaluations so this review opens at once next time
      const all = store.get('reviews', {});
      all[src.id] = { t: Date.now(), evals: R.pack(data.evals) };
      Object.keys(all).sort((a, b) => all[b].t - all[a].t).slice(6).forEach((k) => delete all[k]);
      store.set('reviews', all);
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

  /* The handful of moves that decided the game, in game order. */
  function keyMoments(d, u) {
    const weight = (m) => (m.cls === 'brilliant' ? 60 : m.cls === 'great' ? 40 : m.loss) + (u && m.color === u ? 8 : 0);
    return d.moves.filter((m) => ['brilliant', 'great', 'mistake', 'miss', 'blunder'].includes(m.cls))
      .sort((a, b) => weight(b) - weight(a)).slice(0, 5).sort((a, b) => a.ply - b.ply);
  }

  function renderSummary() {
    const rv = RV, d = rv.data, src = rv.src, sd = d.sides;
    stopLine();
    rv.mode = 'move';
    pane('revSummary');
    const u = src.user;
    const fmt = (a) => (a == null ? '–' : a.toFixed(1));
    let head, msg, mood = 'neutral';
    if (u && sd[u].acc != null) {
      const mine = sd[u];
      const worst = d.moves.filter((m) => m.color === u && ['blunder', 'miss', 'mistake'].includes(m.cls)).sort((a, b) => b.loss - a.loss)[0];
      const bestM = d.moves.find((m) => m.color === u && (m.cls === 'brilliant' || m.cls === 'great'));
      head = mine.elo ? 'You played like ' + (/^(8|11|18)/.test(String(mine.elo)) ? 'an ' : 'a ') + mine.elo + ' this game' : 'Your accuracy was ' + fmt(mine.acc);
      mood = mine.acc >= 85 ? 'excited' : mine.acc >= 70 ? 'happy' : 'thinking';
      msg = (mine.acc >= 90 ? 'Very clean chess.' : mine.acc >= 80 ? 'A solid game.' : mine.acc >= 65 ? 'Some good ideas, with a few costly slips.' : 'A rough one, but there is plenty to learn from it.') +
        (worst ? ' The moment to study is move ' + (Math.floor(worst.ply / 2) + 1) + ', ' + worst.san + '.' : ' No serious mistakes from you.') +
        (bestM ? ' I really liked ' + bestM.san + ' on move ' + (Math.floor(bestM.ply / 2) + 1) + '.' : '');
    } else {
      head = 'Review ready';
      msg = 'White scored ' + fmt(sd.w.acc) + ' and Black ' + fmt(sd.b.acc) + '. Step through the game to see where it was decided.';
    }
    const row = (k) => '<div class="tr"><span class="v" style="color:var(--c-' + k + ')">' + sd.w.counts[k] + '</span><span class="k"><u class="c-' + k + '">' + R.CLS[k].sym + '</u>' + R.CLS[k].label + '</span><span class="v" style="color:var(--c-' + k + ')">' + sd.b.counts[k] + '</span></div>';
    const grade = (gd) => (gd ? '<span class="g c-' + gd + '">' + R.CLS[gd].sym + '</span>' : '<span class="dim">–</span>');
    const phase = (p) => '<div class="tr"><span class="v">' + grade(sd.w.phases[p].grade) + '</span><span class="k">' + cap(p) + '</span><span class="v">' + grade(sd.b.phases[p].grade) + '</span></div>';
    const keys = keyMoments(d, u);
    const focus = u ? C.focus(d.moves, u, src.coachNames) : null;
    const outcome = !u || !src.result ? null : src.result === '1/2-1/2' ? 'draw' : (src.result === '1-0') === (u === 'w') ? 'win' : 'loss';
    const notes = u ? C.report(d, u, src.coachNames, outcome) : [];
    const who = (c) => '<div class="who"><span class="avatar lg">' + src.avatars[c] + '</span><b>' + esc(src.names[c]) + '</b><span class="accbox ' + c + '">' + fmt(sd[c].acc) + '</span></div>';
    $('#revSummary').innerHTML =
      '<div class="coach"><span class="coach-av">' + C.avatar(mood) + '</span><div class="bubble"><div class="bubble-body"><b>' + esc(head) + '</b><p>' + esc(msg) + '</p></div></div></div>' +
      '<div class="card sumhead">' + who('w') + '<div class="mid"><b>' + esc((src.result || '–').replace('1/2-1/2', '½–½').replace('-', '–')) + '</b><small>Accuracy</small></div>' + who('b') + '</div>' +
      '<div class="graph tall" id="sGraph">' + graphSvg(d) + '</div>' +
      '<button class="primary big" id="sStart">Start Review</button>' +
      (notes.length ? '<h2>Coach\'s notes</h2><div class="card notes">' + notes.map((n) => '<div class="note-row"><u class="c-' + n.cls + '"></u><p>' + esc(n.text) + '</p></div>').join('') + '</div>' : '') +
      (focus ? '<div class="card focus"><span class="fi">' + icon('bulb') + '</span><div><b>Next game: ' + esc(focus.title.toLowerCase()) + '</b><p>' + esc(focus.text) + '</p></div></div>' : '') +
      (keys.length ? '<h2>Key moments</h2><div class="keys">' + keys.map((m) => '<button class="card keym" data-ply="' + (m.ply + 1) + '"><u class="c-' + m.cls + '">' + R.CLS[m.cls].sym + '</u><span><b>' + moveNo(m) + ' ' + esc(m.san) + '</b><small>' +
        esc(R.CLS[m.cls].label + ' by ' + (u && m.color === u ? 'you' : src.names[m.color])) + '</small></span><span class="chev">' + icon('next') + '</span></button>').join('') + '</div>' : '') +
      '<h2>Ratings and phases</h2><div class="card tbl"><div class="tr"><span class="v big">' + (sd.w.elo || '–') + '</span><span class="k">Game rating</span><span class="v big">' + (sd.b.elo || '–') + '</span></div>' +
      ['opening', 'middlegame', 'endgame'].map(phase).join('') + '</div>' +
      '<h2>Move quality</h2><div class="card tbl">' + R.ORDER.map(row).join('') + '</div>' +
      (d.opening ? '<p class="fine">Opening: ' + esc(d.opening) + '</p>' : '') +
      '<p class="fine">Game rating estimates the strength shown in this one game from move accuracy. Games under 10 moves are not rated.</p>';
    $('#revSummary').scrollTop = 0;
    $('#sStart').onclick = () => { rv.ply = 0; rv.mode = 'move'; pane('revSteps'); renderStep(false); };
    $$('#revSummary .keym').forEach((b) => (b.onclick = () => { rv.ply = +b.dataset.ply; rv.mode = 'move'; pane('revSteps'); renderStep(false); }));
    if (S.settings.voice) Voice.speak(head + '. ' + msg);
  }

  function revButtons() {
    const rv = RV, d = rv.data, p = rv.ply;
    const m = p > 0 ? d.moves[p - 1] : null;
    const ok = canImprove(m);
    $('#rRetry').disabled = !ok;
    $('#rRetry').textContent = rv.mode === 'retry' ? (rv.solved ? 'Done' : 'Cancel') : 'Retry';
    $('#rBest').disabled = !ok;
    $('#rBest').textContent = rv.mode === 'best' || rv.mode === 'line' ? 'Back' : 'Show best';
    $('#rNextKey').disabled = nextKey() == null;
    $('#rPrev').disabled = $('#rFirst').disabled = p === 0;
    $('#rNext').disabled = $('#rLast').disabled = p === d.moves.length;
  }
  function renderStep(animate) {
    const rv = RV, d = rv.data, p = rv.ply;
    const m = p > 0 ? d.moves[p - 1] : null;
    const u = rv.src.user, names = rv.src.coachNames;
    stopLine();
    rv.solved = false;
    rBoard.setOrientation(rv.orient);
    let ex, ev, acts = null;
    if (rv.mode === 'best' && canImprove(m)) {
      rBoard.setInteractive(false);
      rBoard.setPosition(new Chess(d.fens[p - 1]), d.moves[p - 2] || null, false);
      rBoard.setBadge(null);
      rBoard.setArrows([{ from: m.best.slice(0, 2), to: m.best.slice(2, 4) }]);
      ex = C.explainBest(m, u, names);
      ev = d.evals[p - 1];
      if (ex.line && ex.line.length > 1) acts = [{ label: 'Play it out', fn: playLine }];
    } else if (rv.mode === 'retry' && canImprove(m)) {
      rBoard.setPosition(new Chess(d.fens[p - 1]), d.moves[p - 2] || null, false);
      rBoard.setBadge(null);
      rBoard.setArrows([]);
      rBoard.setInteractive(true, true);
      const who = u && m.color === u ? 'You' : (names && names[m.color]) || (m.color === 'w' ? 'White' : 'Black');
      ex = { title: 'Find a better move for ' + (m.color === 'w' ? 'White' : 'Black'), mood: 'thinking', text: who + ' played ' + m.san + ' here. What is stronger? Make the move on the board.' };
      ev = null;
      acts = [{ label: 'Show me', alt: true, fn: () => { rv.mode = 'best'; renderStep(false); } }];
    } else {
      rv.mode = 'move';
      rBoard.setInteractive(false);
      rBoard.setPosition(new Chess(d.fens[p]), m, animate);
      rBoard.setArrows([]);
      rBoard.setBadge(m ? { sq: m.to, cls: m.cls } : null);
      if (m) acts = [{ label: 'Explain', alt: true, fn: () => explainSheet(m, { user: u, names, orient: rv.orient }) }];
      ex = m ? C.explain(m, u, names) : { title: 'Starting position', mood: 'neutral', text: (d.opening ? 'This game was a ' + d.opening + '. ' : '') + 'Use the arrows to step through, or jump straight to the key moves.' };
      ev = d.evals[p];
    }
    evalBar($('#rEval'), d.evals[rv.mode === 'move' ? p : p - 1], rv.orient);
    rSay(ex, ev, acts);
    movesStrip($('#rMoves'), d.moves, p, d.moves.map((x) => x.cls));
    $('#rGraph').innerHTML = graphSvg(d, p);
    revButtons();
  }

  async function tryRetry(from, to, promo, dragged) {
    const rv = RV, d = rv.data, p = rv.ply, m = d.moves[p - 1];
    const c = new Chess(d.fens[p - 1]);
    const mv = c.move({ from, to, promotion: promo });
    if (!mv) return;
    stopLine();
    rBoard.setInteractive(false);
    rBoard.setPosition(c, mv, !dragged);
    Snd.forMove(mv, c, { delay: dragged ? 0 : 0.1 });
    buzz(8);
    const still = () => RV === rv && rv.ply === p && rv.mode === 'retry';
    let res;
    if (U.uci(mv) === m.best) res = C.retry(m, mv, 0, true);
    else if (mv.san === m.san) res = C.retry(m, mv, m.loss, false);
    else if (engine.failed) res = { ok: false, cls: null, mood: 'thinking', title: mv.san + ' is not the engine\'s choice', text: 'Try again, or tap Show best.' };
    else {
      rSay({ title: mv.san, thinking: true, mood: 'thinking' }, null, null);
      const ev = await R.evalPosition(engine, c.fen(), { movetime: 350, depth: 14 });
      if (!still()) return;
      res = C.retry(m, mv, ev ? Math.max(0, m.wpB - U.povPct(ev, m.color)) : 99, false);
    }
    if (!still()) return;
    if (res.cls) rBoard.setBadge({ sq: mv.to, cls: res.cls });
    rv.solved = !!res.ok;
    revButtons();
    const back = () => { rv.mode = 'move'; renderStep(false); };
    rSay(res, null, res.ok ? [{ label: 'Back to the game', fn: back }] : [{ label: 'Show best', alt: true, fn: () => { rv.mode = 'best'; renderStep(false); } }]);
    if (res.ok) buzz(20);
    if (!res.ok) {
      // put the position back so the next attempt can start straight away
      rv.timer = setTimeout(() => {
        if (!still()) return;
        rBoard.setPosition(new Chess(d.fens[p - 1]), d.moves[p - 2] || null, false);
        rBoard.setBadge(null);
        rBoard.setInteractive(true, true);
      }, 1400);
    }
  }

  /* "12. Nf3 Nc6 13. Bb5" for a line that starts from fen. */
  const lineText = C.lineText;
  function playLine() {
    const rv = RV, d = rv.data, p = rv.ply, m = d.moves[p - 1];
    stopLine();
    rv.mode = 'line';
    const pv = (m.evBefore.pv || []).slice(0, 6);
    const c = new Chess(d.fens[p - 1]);
    const sans = [];
    let k = 0;
    const alive = () => RV === rv && rv.mode === 'line' && rv.ply === p;
    const done = () => rSay({ title: 'That is the idea', mood: 'happy', text: lineText(d.fens[p - 1], sans), speak: false }, null,
      [{ label: 'Replay', fn: playLine }, { label: 'Back to the game', alt: true, fn: () => { rv.mode = 'move'; renderStep(false); } }]);
    const tick = () => {
      if (!alive()) return;
      const u = pv[k];
      const mv = u ? c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }) : null;
      if (!mv) return done();
      k++;
      sans.push(mv.san);
      rBoard.setArrows([]);
      rBoard.setPosition(c, mv, true);
      rBoard.setBadge(k === 1 ? { sq: mv.to, cls: 'best' } : null);
      Snd.forMove(mv, c, { delay: 0.1, opponent: mv.color !== m.color });
      rSay({ title: 'Best line', mood: 'neutral', text: lineText(d.fens[p - 1], sans), speak: false }, null, null);
      rv.timer = setTimeout(tick, 950);
    };
    rBoard.setInteractive(false);
    revButtons();
    tick();
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
    const fwd = ply === rv.ply + 1 && rv.mode === 'move';
    rv.ply = ply;
    rv.mode = 'move';
    renderStep(animate !== false && fwd);
    if (fwd) { const m = rv.data.moves[ply - 1]; Snd.forMove(m, new Chess(rv.data.fens[ply]), { delay: 0.1, opponent: !!rv.src.user && m.color !== rv.src.user }); }
  }
  $('#rNext').onclick = () => go(RV.ply + 1);
  $('#rPrev').onclick = () => go(RV.ply - 1);
  $('#rFirst').onclick = () => go(0);
  $('#rLast').onclick = () => go(RV.data.moves.length);
  $('#rFlip').onclick = () => { RV.orient = U.other(RV.orient); renderStep(false); };
  $('#rBest').onclick = () => { RV.mode = RV.mode === 'best' || RV.mode === 'line' ? 'move' : 'best'; renderStep(false); };
  $('#rRetry').onclick = () => { RV.mode = RV.mode === 'retry' ? 'move' : 'retry'; renderStep(false); };
  $('#rNextKey').onclick = () => { const k = nextKey(); if (k != null) go(k); };
  $('#rMoves').onclick = (e) => { const b = e.target.closest('.mv'); if (b) go(+b.dataset.ply, false); };
  const scrub = (e) => {
    if (!RV || !RV.data || (e.type === 'pointermove' && !e.buttons)) return;
    const r = $('#rGraph').getBoundingClientRect();
    const ply = Math.round(((e.clientX - r.left) / r.width) * RV.data.moves.length);
    if (ply !== RV.ply || RV.mode !== 'move') go(ply, false);
  };
  $('#rGraph').addEventListener('pointerdown', scrub);
  $('#rGraph').addEventListener('pointermove', scrub);
  $('#revSummaryBtn').onclick = () => renderSummary();
  $('#revBack').onclick = () => {
    const rv = RV;
    if (rv && rv.data && !$('#revSteps').hidden) return renderSummary();
    stopLine();
    RV = null;
    engine.cancelAll();
    const back = rv && rv.src.back;
    show(back === 'game' && G ? 'game' : TABS.includes(back) ? back : 'home');
  };
  document.addEventListener('keydown', (e) => {
    if ($('#review').hidden || $('#revSteps').hidden || !RV) return;
    if (e.key === 'ArrowRight') go(RV.ply + 1);
    if (e.key === 'ArrowLeft') go(RV.ply - 1);
  });

  /* ---------- puzzles (puzzle-screen.js) ---------- */
  const PZ = RW.PuzzleScreen({ $, esc, icon, store, sheet, closeSheet, buzz, Snd, setAv, popBubble, fillActs, miniBoard, plural, myLevel, settingsSheet, show });

  /* ---------- Android back button ---------- */
  function goBack() {
    if (!$('#scrim').hidden) { closeSheet(); return true; }
    if (PZ.back()) return true;
    if (!$('#review').hidden) { $('#revBack').click(); return true; }
    if (!$('#game').hidden) { $('#gameBack').click(); return true; }
    if (tab !== 'home') { show('home'); return true; }
    return false;
  }
  try {
    if (Plugins.App && Plugins.App.addListener) Plugins.App.addListener('backButton', () => {
      if (goBack()) return;
      if (Plugins.App.minimizeApp) Plugins.App.minimizeApp().catch(() => Plugins.App.exitApp && Plugins.App.exitApp());
      else if (Plugins.App.exitApp) Plugins.App.exitApp();
    });
  } catch (e) {}

  window.__rw = { get G() { return G; }, get RV() { return RV; }, engine, newGame, startReview, go, S, BOTS, fit, show, PZ };
  applySettings();
  setAv($('#gAv'), 'neutral');
  setAv($('#rAv'), 'neutral');
  show('home');
})();
