'use strict';

// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// restart a CSS animation class on an element
const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

const Plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
const TEAM_COLORS = ['#ffcc33', '#ff5c8a', '#2ed47a', '#4fc3ff', '#b388ff', '#ff9f1c'];
const DECK_EMOJIS = ['⭐', '😂', '🍕', '🎉', '🏖️', '🐶', '🎮', '❤️', '🔥', '🤪', '🏫', '👨‍👩‍👧'];
const CUSTOM_COLORS = [['#8e2de2', '#4a00e0'], ['#f857a6', '#ff5858'], ['#43cea2', '#185a9d'], ['#f7971e', '#ffd200']];

// ---------- persistent state ----------
const settings = Object.assign({ time: 60, rounds: 3, sound: 1, vibe: 1 }, store.get('settings', {}));
let teams = store.get('teams', ['האריות', 'הנמרים']);
let customDecks = store.get('customDecks', []);
let best = store.get('best', {});
let stats = Object.assign({ xp: 0, games: 0, correct: 0 }, store.get('stats', {}));
const saveAll = () => {
  store.set('settings', settings);
  store.set('teams', teams);
  store.set('customDecks', customDecks);
  store.set('best', best);
  store.set('stats', stats);
};

// ---------- levels: each correct guess is 10 XP, every level needs 50 XP more than the last ----------
const XP_PER_WORD = 10;
const xpForLevel = (lvl) => 25 * (lvl - 1) * (lvl + 2); // total XP needed to reach a level
function levelInfo(xp = stats.xp) {
  let lvl = 1;
  while (xp >= xpForLevel(lvl + 1)) lvl++;
  const from = xpForLevel(lvl), to = xpForLevel(lvl + 1);
  return { lvl, into: xp - from, need: to - from, frac: (xp - from) / (to - from) };
}
const LEVEL_NAMES = ['מתחילים', 'חובבנים', 'שחקנים', 'מנחשים', 'אלופים', 'כוכבים', 'מקצוענים', 'אגדות'];
const levelName = (lvl) => LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((lvl - 1) / 3))];
function renderHUD() {
  const L = levelInfo();
  $('#lvlNum').textContent = L.lvl;
  $('#lvlName').textContent = `רמה ${L.lvl} · ${levelName(L.lvl)}`;
  $('#xpFill').style.width = `${Math.round(L.frac * 100)}%`;
}
function renderProfile() {
  const L = levelInfo();
  $('#pLvl').textContent = L.lvl;
  $('#pName').textContent = `רמה ${L.lvl} · ${levelName(L.lvl)}`;
  $('#pXp').style.width = `${Math.round(L.frac * 100)}%`;
  $('#pXpText').textContent = `${L.into} / ${L.need} XP לרמה הבאה`;
  $('#stGames').textContent = stats.games;
  $('#stCorrect').textContent = stats.correct;
  $('#stBest').textContent = Math.max(0, ...Object.values(best));
  $('#optSound').checked = !!settings.sound;
  $('#optVibe').checked = !!settings.vibe;
}
$('#optSound').addEventListener('change', (e) => { settings.sound = e.target.checked ? 1 : 0; saveAll(); });
$('#optVibe').addEventListener('change', (e) => { settings.vibe = e.target.checked ? 1 : 0; saveAll(); });
$('#resetStats').addEventListener('click', async () => {
  if (!(await ask('לאפס רמה, XP ושיאים?', 'איפוס', 'ביטול'))) return;
  stats = { xp: 0, games: 0, correct: 0 };
  best = {};
  saveAll();
  renderProfile();
  renderHUD();
});
// adds XP for a finished turn and reports whether a new level was reached
function gainXP(correct) {
  const before = levelInfo().lvl;
  stats.xp += correct * XP_PER_WORD;
  stats.correct += correct;
  saveAll();
  renderHUD();
  return { xp: correct * XP_PER_WORD, levelUp: levelInfo().lvl > before ? levelInfo().lvl : 0 };
}

const MIX = { id: 'mix', name: 'מיקס הכל', emoji: '🎲', get words() { return allDecks().flatMap((d) => d.words); } };
const allDecks = () => [...customDecks.map((d) => ({ ...d, custom: true })), ...DECKS];
const findDeck = (id) => (id === 'mix' ? MIX : allDecks().find((d) => d.id === id));
function deckStyle(d) {
  if (DECK_STYLE[d.id]) return DECK_STYLE[d.id];
  const i = customDecks.findIndex((c) => c.id === d.id);
  return { colors: CUSTOM_COLORS[Math.max(0, i) % CUSTOM_COLORS.length], art: [d.emoji, '✨', '💬', '🎉'], desc: 'החפיסה שלכם, עם המילים שלכם.', tags: ['✏️ שלי'] };
}

// ---------- navigation ----------
const navStack = [];
function show(id, push = true) {
  const cur = $('.screen.active');
  if (cur && push && cur.id !== id) navStack.push(cur.id);
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}
function back() { show(navStack.pop() || 'home', false); }
function quitToHome() {
  clearInterval(timerId);
  tilt.stop();
  unlockOrientation();
  game = null; turn = null;
  navStack.length = 0;
  renderHome();
  show('home', false);
}
$$('[data-back]').forEach((b) => b.addEventListener('click', back));

// in-app dialog (native confirm/alert popups are blocked in some WebViews)
function ask(text, yes = 'כן', no = 'ביטול') {
  return new Promise((resolve) => {
    $('#modalText').textContent = text;
    $('#modalYes').textContent = yes;
    $('#modalNo').textContent = no || '';
    $('#modalNo').style.display = no ? '' : 'none';
    $('#modal').classList.add('show');
    const done = (v) => {
      $('#modal').classList.remove('show');
      $('#modalYes').onclick = $('#modalNo').onclick = null;
      resolve(v);
    };
    $('#modalYes').onclick = () => done(true);
    $('#modalNo').onclick = () => done(false);
  });
}
const modalOpen = () => $('#modal').classList.contains('show');

// Android hardware back button
if (Plugins.App) Plugins.App.addListener('backButton', () => {
  const cur = $('.screen.active').id;
  if (modalOpen()) $('#modalNo').click();
  else if ($('#sheetWrap').classList.contains('show')) closeSheet();
  else if (cur === 'home') Plugins.App.exitApp();
  else if (cur === 'play') pauseMenu();
  else if (game) askQuit();
  else back();
});

// ---------- sound & haptics ----------
let audio;
function beep(freq = 660, dur = 0.12, type = 'sine', vol = 0.25) {
  if (!settings.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur);
  } catch { /* no audio */ }
}
const sfx = {
  good() { beep(880, 0.1, 'triangle'); setTimeout(() => beep(1320, 0.15, 'triangle'), 90); },
  skip() { beep(300, 0.18, 'sawtooth', 0.15); },
  tick() { beep(1000, 0.05, 'square', 0.1); },
  go() { beep(523, 0.1); setTimeout(() => beep(784, 0.25), 100); },
  end() { beep(392, 0.2, 'square', 0.2); setTimeout(() => beep(262, 0.5, 'square', 0.2), 200); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle'), i * 120)); },
  click() { beep(1400, 0.04, 'triangle', 0.12); },
  star(i) { beep(880 + i * 220, 0.16, 'triangle', 0.22); },
};
// a soft click on every button press, like a real game UI (on click, so starting a scroll stays silent)
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn, .icon-btn, .tab, .deck-card, .seg button, .lvl, .hat-banner, .toggle')) sfx.click();
});
function buzz(ms = 60) {
  if (!settings.vibe) return;
  if (Plugins.Haptics) Plugins.Haptics.vibrate({ duration: ms }).catch(() => {});
  else if (navigator.vibrate) navigator.vibrate(ms);
}

// ---------- orientation ----------
function lockLandscape() {
  if (Plugins.ScreenOrientation) return Plugins.ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
  try { return screen.orientation.lock('landscape').catch(() => {}); } catch { return Promise.resolve(); }
}
function unlockOrientation() {
  if (Plugins.ScreenOrientation) return Plugins.ScreenOrientation.unlock().catch(() => {});
  try { screen.orientation.unlock(); } catch { /* not supported */ }
}

// ---------- tilt detection ----------
// gravity along the screen normal: ~-9.8 when screen faces the floor, ~+9.8 when it faces the ceiling
const tilt = {
  on: false, armed: false, cb: null,
  handler(e) {
    const g = e.accelerationIncludingGravity;
    if (!tilt.on || !g || g.z == null) return;
    const z = g.z;
    if (Math.abs(z) < 4) { tilt.armed = true; return; }
    if (!tilt.armed) return;
    if (z < -7) { tilt.armed = false; tilt.cb('correct'); }
    else if (z > 7) { tilt.armed = false; tilt.cb('pass'); }
  },
  async start(cb) {
    this.cb = cb; this.armed = false; this.on = true;
    if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
      try { await DeviceMotionEvent.requestPermission(); } catch { /* denied */ }
    }
    window.addEventListener('devicemotion', this.handler);
  },
  stop() { this.on = false; window.removeEventListener('devicemotion', this.handler); },
};

// ---------- smooth scrolling ----------
// cards animate only while on screen, and everything decorative holds still mid-scroll
const cardWatcher = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '40px' })
  : null;
let scrollIdle;
document.addEventListener('scroll', () => {
  if (!document.body.classList.contains('scrolling')) document.body.classList.add('scrolling');
  clearTimeout(scrollIdle);
  scrollIdle = setTimeout(() => document.body.classList.remove('scrolling'), 150);
}, { capture: true, passive: true });

// ---------- home ----------
let mode = 'forehead';
let currentDeck = 'mix';

function cardHTML(d, i) {
  const st = deckStyle(d);
  const popular = st.tags.some((t) => t.includes('פופולרי'));
  const isNew = st.tags.some((t) => t.includes('חדש'));
  return `
    <button class="deck-card" data-id="${esc(d.id)}" style="--c1:${st.colors[0]};--c2:${st.colors[1]};--i:${i}">
      <span class="sunburst"></span>
      ${coverSVG(d.id)}
      <span class="deck-title">${esc(d.name)}</span>
      <span class="deck-badges">${isNew ? '<span>✨ חדש</span>' : popular ? '<span>🔥</span>' : ''}<span>${d.words.length} מילים</span></span>
    </button>`;
}
function renderHome() {
  $('#newRow').innerHTML = NEW_DECKS.map(findDeck).filter(Boolean).map(cardHTML).join('');
  $('#popularRow').innerHTML = POPULAR.map(findDeck).filter(Boolean).map(cardHTML).join('');
  $('#deckGrid').innerHTML = [MIX, ...allDecks()].map(cardHTML).join('')
    + `<button class="deck-card add" id="addDeckCard" style="--i:${allDecks().length + 1}"><b>＋</b>חפיסה משלכם</button>`;
  $$('#home .deck-card[data-id]').forEach((el) => el.addEventListener('click', () => openSheet(el.dataset.id)));
  if (cardWatcher) { cardWatcher.disconnect(); $$('#home .deck-card').forEach((el) => cardWatcher.observe(el)); }
  else $$('#home .deck-card').forEach((el) => el.classList.add('live'));
  $('#addDeckCard').addEventListener('click', () => { renderMyDecks(); openEditor(null); });
}
$$('[data-go]').forEach((b) => b.addEventListener('click', () => {
  const go = b.dataset.go;
  if (go === 'hat') { mode = 'hat'; startHatWords(); }
  else if (go === 'mydecks') { renderMyDecks(); show('mydecks'); }
  else if (go === 'settings') { renderProfile(); show('settings'); }
  else show(go);
}));

// ---------- deck sheet ----------
function openSheet(id) {
  const d = findDeck(id);
  if (!d) return;
  currentDeck = id;
  const st = deckStyle(d);
  $('#sheetHead').style.cssText = `--c1:${st.colors[0]};--c2:${st.colors[1]}`;
  $('#sheetArt').innerHTML = coverSVG(id, 'sheet');
  $('#sheetTitle').textContent = d.name;
  $('#sheetDesc').textContent = st.desc;
  $('#sheetTags').innerHTML = [`📝 ${d.words.length} מילים`, ...st.tags].map((t) => `<span>${esc(t)}</span>`).join('');
  $('#sheetBest').textContent = best[id] ? `🏅 השיא שלכם: ${best[id]}` : '';
  renderSegs();
  $('#sheet').scrollTop = 0;
  document.body.classList.add('sheet-open');
  const w = $('#sheetWrap');
  void w.offsetWidth; // apply the new content before the slide-in starts
  w.classList.add('show');
  buzz(15);
}
async function closeSheet() {
  const w = $('#sheetWrap');
  if (!w.classList.contains('show')) return;
  w.classList.remove('show');
  await wait(260);
  document.body.classList.remove('sheet-open');
}
$('#sheetClose').addEventListener('click', closeSheet);
$('#sheetWrap').addEventListener('click', (e) => { if (e.target.id === 'sheetWrap') closeSheet(); });
$('#sheetPlay').addEventListener('click', async () => {
  saveAll();
  await closeSheet();
  mode = 'forehead';
  startForeheadGame(['אתם'], 1, true);
});
$('#sheetTeams').addEventListener('click', async () => {
  await closeSheet();
  mode = 'forehead';
  renderSetup();
  show('setup');
});

// ---------- setup ----------
function renderSegs() {
  $$('.seg').forEach((seg) => {
    [...seg.children].forEach((b) => b.classList.toggle('on', String(settings[seg.dataset.key]) === b.dataset.v));
  });
}
function renderSetup() {
  $('#teamList').innerHTML = teams.map((t, i) => `
    <div class="team-row">
      <span class="team-dot" style="background:${TEAM_COLORS[i % TEAM_COLORS.length]}"></span>
      <input type="text" value="${esc(t)}" data-i="${i}" maxlength="20">
      ${teams.length > 2 ? `<button class="icon-btn" data-del="${i}">✕</button>` : ''}
    </div>`).join('');
  $$('#teamList input').forEach((inp) => inp.addEventListener('input', () => { teams[+inp.dataset.i] = inp.value; }));
  $$('#teamList [data-del]').forEach((b) => b.addEventListener('click', () => { teams.splice(+b.dataset.del, 1); renderSetup(); }));
  $('#addTeam').style.display = teams.length >= 6 ? 'none' : '';
  renderSegs();
  $('#roundsCard').style.display = mode === 'hat' ? 'none' : '';
}
$('#addTeam').addEventListener('click', () => { teams.push(`קבוצה ${teams.length + 1}`); renderSetup(); });
$$('.seg button').forEach((b) => b.addEventListener('click', () => {
  settings[b.parentElement.dataset.key] = +b.dataset.v;
  renderSegs();
}));
$('#startGame').addEventListener('click', () => {
  teams = teams.map((t, i) => t.trim() || `קבוצה ${i + 1}`);
  saveAll();
  mode === 'hat' ? startHatGame() : startForeheadGame(teams.slice(), settings.rounds, false);
});

// ---------- shared game state ----------
let game = null;
const teamName = (i) => game.teams[i];
const teamColor = (i) => TEAM_COLORS[i % TEAM_COLORS.length];

function buildPool() {
  const d = findDeck(currentDeck) || MIX;
  const decks = currentDeck === 'mix' ? allDecks() : [d];
  const words = [];
  decks.forEach((dk) => dk.words.forEach((w) => words.push({ w, deck: dk.name, emoji: dk.emoji })));
  const seen = new Set();
  return shuffle(words.filter((x) => (seen.has(x.w) ? false : seen.add(x.w))));
}

// ---------- forehead mode ----------
function startForeheadGame(gameTeams, rounds, solo) {
  game = { mode: 'forehead', solo, teams: gameTeams, rounds, pool: buildPool(), scores: gameTeams.map(() => 0), team: 0, round: 1 };
  showTurn();
}
function showTurn() {
  if (game.mode === 'forehead') {
    $('#turnRound').textContent = game.solo ? findDeck(currentDeck).name : `סיבוב ${game.round} מתוך ${game.rounds}`;
    $('#turnMsg').textContent = 'שימו את הטלפון על המצח, מסך כלפי החבר\'ה. הטו למטה כשניחשתם, למעלה כדי לדלג.';
    $('.turn-phone').style.display = '';
  } else {
    $('#turnRound').textContent = `${HAT_STAGES[game.stage].name} · נשארו ${game.pool.length} בכובע`;
    $('#turnMsg').textContent = 'המסביר מחזיק את הטלפון, רואה את המילה ומסביר לקבוצה שלו.';
    $('.turn-phone').style.display = 'none';
  }
  $('#turnTeam').textContent = game.solo ? 'מוכנים?' : teamName(game.team);
  $('#turnTeam').style.color = game.solo ? 'var(--primary)' : teamColor(game.team);
  replay($('#turnTeam'), 'turn-team');
  show('turn', false);
}
async function askQuit() {
  if (await ask('לצאת מהמשחק? הניקוד לא יישמר.', 'יציאה לתפריט', 'ביטול')) quitToHome();
}
$('#turnQuit').addEventListener('click', askQuit);
$('#turnGo').addEventListener('click', async () => {
  if (game.mode === 'forehead') await lockLandscape();
  startTurn();
});

let timerId = null, turn = null;
const RING_LEN = 2 * Math.PI * 44;
function setTimeRing() {
  const frac = Math.max(0, turn.left / settings.time);
  $('#ringFg').style.strokeDashoffset = RING_LEN * (1 - frac);
  $('#ring').classList.toggle('low', turn.left <= 5);
}
function startTurn() {
  turn = { left: settings.time, results: [], busy: true, current: null };
  $('#timer').textContent = turn.left;
  $('#ringFg').style.transition = 'none';
  setTimeRing();
  $('#playScore').textContent = '0';
  $('#word').textContent = '';
  $('#wordDeck').textContent = '';
  $('#wordCard').style.visibility = 'hidden';
  $('#play').classList.remove('good', 'bad');
  const forehead = game.mode === 'forehead';
  // forehead mode is tilt-only; hat mode's describer taps the buttons
  $('#playButtons').style.display = forehead ? 'none' : '';
  show('play', false);
  const cd = $('#countdown');
  cd.classList.add('show');
  let n = 3;
  const step = () => {
    if (!turn) return;
    if (turn.paused) { setTimeout(step, 200); return; }
    if (n > 0) {
      cd.innerHTML = `<b>${n}</b><small>${forehead ? 'על המצח!' : 'מתכוננים...'}</small>`;
      sfx.tick(); buzz(20); n--; setTimeout(step, 1000);
    } else {
      cd.classList.remove('show');
      sfx.go();
      turn.busy = false;
      $('#ringFg').style.transition = '';
      nextWord();
      timerId = setInterval(onTick, 1000);
      if (forehead) tilt.start(answer);
    }
  };
  step();
}
function onTick() {
  turn.left--;
  $('#timer').textContent = Math.max(0, turn.left);
  setTimeRing();
  if (turn.left <= 5 && turn.left > 0) sfx.tick();
  if (turn.left <= 0) endTurn();
}
function nextWord() {
  if (game.mode === 'forehead' && game.pool.length === 0) game.pool = buildPool();
  if (game.pool.length === 0) { endTurn(); return; }
  turn.current = game.pool.pop();
  const card = $('#wordCard');
  card.className = 'word-card';
  card.style.visibility = '';
  $('#word').textContent = turn.current.w;
  replay(card, 'in');
  $('#wordDeck').textContent = game.mode === 'forehead' && currentDeck === 'mix' ? `${turn.current.emoji} ${turn.current.deck}` : '';
}

// ✕ during play: pause the clock and offer to resume or quit
async function pauseMenu() {
  if (!turn || turn.ended || turn.paused) return;
  turn.paused = true;
  clearInterval(timerId);
  tilt.stop();
  const quit = await ask('המשחק בהפסקה ⏸', 'יציאה לתפריט', 'המשך לשחק');
  if (quit) { quitToHome(); return; }
  turn.paused = false;
  if (!turn.current) return; // still in the countdown, which resumes by itself
  timerId = setInterval(onTick, 1000);
  if (game.mode === 'forehead') tilt.start(answer);
}
$('#btnQuit').addEventListener('click', pauseMenu);

// right/wrong is shown only by painting the whole screen green or red
function answer(kind) {
  if (!turn || turn.busy || turn.paused || !turn.current) return;
  turn.busy = true;
  const ok = kind === 'correct';
  turn.results.push({ w: turn.current.w, ok, item: turn.current });
  if (game.mode === 'hat' && !ok) game.pool.unshift(turn.current); // skipped words go back in the hat
  const score = $('#playScore');
  score.textContent = turn.results.filter((r) => r.ok).length;
  if (ok) replay(score, 'bump');
  ok ? sfx.good() : sfx.skip();
  buzz(ok ? 60 : 30);
  const play = $('#play');
  play.classList.add(ok ? 'good' : 'bad');
  $('#wordCard').className = `word-card ${ok ? 'out-good' : 'out-bad'}`;
  setTimeout(() => {
    play.classList.remove('good', 'bad');
    turn.busy = false;
    turn.current = null;
    if (game.mode === 'hat' && ok && game.pool.length === 0) { endTurn(); return; }
    nextWord();
  }, 600);
}
$('#btnCorrect').addEventListener('click', () => answer('correct'));
$('#btnPass').addEventListener('click', () => answer('pass'));

function endTurn() {
  if (!turn || turn.ended) return;
  turn.ended = true;
  clearInterval(timerId);
  tilt.stop();
  // a word still on screen when time ran out goes back to the hat
  if (game.mode === 'hat' && turn.current) game.pool.push(turn.current);
  sfx.end(); buzz(400);
  const t = $('#timesUp');
  t.textContent = game.mode === 'hat' && game.pool.length === 0 ? 'הכובע ריק! 🎩' : 'נגמר הזמן! ⏰';
  t.classList.add('show');
  setTimeout(async () => {
    t.classList.remove('show');
    $('#play').classList.remove('good', 'bad');
    await unlockOrientation();
    showSummary();
  }, 1400);
}

function showSummary() {
  $('#sumTitle').textContent = game.solo ? 'סיכום' : teamName(game.team);
  const render = (animate) => {
    $('#sumScore').textContent = turn.results.filter((r) => r.ok).length;
    $('#sumList').innerHTML = turn.results.map((r, i) => `
      <li class="${r.ok ? 'ok' : ''}" data-i="${i}" style="--i:${animate ? i : 0};${animate ? '' : 'animation:none'}">
        <span>${esc(r.w)}</span><span class="mark">${r.ok ? '✓' : '✕'}</span></li>`).join('')
      || '<li>לא היו מילים בתור הזה</li>';
    $$('#sumList li[data-i]').forEach((li) => li.addEventListener('click', () => {
      const r = turn.results[+li.dataset.i];
      // in hat mode, flipping a word's result moves it in or out of the hat
      if (game.mode === 'hat') {
        if (r.ok) game.pool.push(r.item);
        else { const k = game.pool.indexOf(r.item); if (k >= 0) game.pool.splice(k, 1); }
      }
      r.ok = !r.ok;
      buzz(15);
      render(false);
    }));
  };
  render(true);
  show('summary', false);
}
$('#sumNext').addEventListener('click', () => {
  const pts = turn.results.filter((r) => r.ok).length;
  game.scores[game.team] += pts;
  const g = gainXP(pts);
  game.xpGained = (game.xpGained || 0) + g.xp;
  if (g.levelUp) game.levelUp = g.levelUp;
  if (game.mode === 'forehead') {
    // put skipped words back at the bottom so they may come up again later
    turn.results.filter((r) => !r.ok).forEach((r) => game.pool.unshift(r.item));
    if (game.solo) { showSoloResult(pts); return; }
    game.team++;
    if (game.team >= game.teams.length) { game.team = 0; game.round++; }
    if (game.round > game.rounds) showScores(true);
    else if (game.team === 0) showScores(false, `אחרי סיבוב ${game.round - 1}`);
    else showTurn();
  } else {
    game.team = (game.team + 1) % game.teams.length;
    if (game.pool.length === 0) {
      game.stage++;
      if (game.stage >= HAT_STAGES.length) { showScores(true); return; }
      game.pool = shuffle(game.allWords.slice());
      showScores(false, `סוף ${HAT_STAGES[game.stage - 1].name}`);
    } else showTurn();
  }
});

// end-of-game reward: XP count-up and a level-up callout
function showReward() {
  stats.games++;
  saveAll();
  const el = $('#xpGain');
  const total = game.xpGained || 0;
  el.className = 'xp-gain';
  el.textContent = '';
  if (!total) return;
  let shown = 0;
  const stepSize = Math.max(1, Math.ceil(total / 25));
  const tick = setInterval(() => {
    shown = Math.min(total, shown + stepSize);
    el.textContent = `+${shown} XP`;
    if (shown >= total) {
      clearInterval(tick);
      if (game && game.levelUp) setTimeout(() => {
        el.textContent = `⭐ עליתם לרמה ${game.levelUp}! ⭐`;
        replay(el, 'lvl-up');
        sfx.win();
      }, 500);
    }
  }, 40);
}
function showStars(n) {
  const stars = $$('#stars span');
  stars.forEach((s) => s.classList.remove('on'));
  $('#stars').classList.add('show');
  stars.slice(0, n).forEach((s, i) => setTimeout(() => { s.classList.add('on'); sfx.star(i); buzz(40); }, 450 + i * 380));
}
function showSoloResult(pts) {
  const record = pts > (best[currentDeck] || 0);
  if (record) { best[currentDeck] = pts; saveAll(); }
  const starCount = pts >= 12 ? 3 : pts >= 7 ? 2 : pts >= 3 ? 1 : 0;
  $('#scoresSub').textContent = findDeck(currentDeck).name;
  $('#scoresTitle').textContent = record && pts > 0 ? 'שיא חדש!' : starCount === 3 ? 'שיחקתם אותה!' : starCount ? 'כל הכבוד!' : 'נסו שוב!';
  $('#scoreboard').innerHTML = `<div class="solo-score">${pts}</div><p class="small-cap">ניחושים נכונים${best[currentDeck] ? ` · שיא: ${best[currentDeck]}` : ''}</p>`;
  $('#trophy').classList.remove('show');
  $('#scoresNext').textContent = 'שחקו שוב 🔄';
  $('#scoresNext').dataset.final = '1';
  show('scores', false);
  showStars(starCount);
  showReward();
  if (record && pts > 0) { setTimeout(() => { sfx.win(); confetti(); }, 450 + starCount * 380); }
}
function showScores(final, sub) {
  const order = game.teams.map((t, i) => ({ t, i, s: game.scores[i] })).sort((a, b) => b.s - a.s);
  const tie = order.length > 1 && order[0].s === order[1].s;
  $('#scoresTitle').textContent = final ? (tie ? 'תיקו! 🤝' : `${order[0].t} ניצחו!`) : 'טבלת ניקוד';
  $('#scoresSub').textContent = final ? 'סוף המשחק' : (sub || '');
  $('#scoreboard').innerHTML = order.map((o, k) => `
    <li class="${k === 0 && !tie ? 'first' : ''}" style="--i:${k}">
      <span class="team-dot" style="background:${teamColor(o.i)}"></span>
      <span>${esc(o.t)}</span><span class="pts">${o.s}</span>
    </li>`).join('');
  $('#trophy').classList.toggle('show', final && !tie);
  $('#stars').classList.remove('show');
  $('#xpGain').textContent = '';
  $('#scoresNext').textContent = final ? 'משחק חדש 🔄' : 'המשך';
  $('#scoresNext').dataset.final = final ? '1' : '';
  show('scores', false);
  if (final) { sfx.win(); confetti(); showReward(); }
}
$('#scoresNext').addEventListener('click', () => {
  if ($('#scoresNext').dataset.final) {
    if (game.mode === 'hat') { game = null; startHatWords(true); }
    else startForeheadGame(game.teams, game.rounds, game.solo);
    return;
  }
  if (game.mode === 'hat') showStage(); else showTurn();
});
$('#scoresHome').addEventListener('click', quitToHome);

// ---------- confetti ----------
function confetti() {
  const c = $('#confetti');
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
  ctx.scale(dpr, dpr);
  const W = c.clientWidth, H = c.clientHeight;
  const colors = ['#ffcc33', '#ff5c8a', '#22c55e', '#4fc3ff', '#b388ff', '#fff'];
  const parts = Array.from({ length: 140 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * 80, y: H * 0.35,
    vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 13 - 4,
    r: Math.random() * 6 + 4, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    color: colors[(Math.random() * colors.length) | 0],
  }));
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, W, H);
    parts.forEach((p) => {
      p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    });
    if (t - t0 < 4000 && $('#scores').classList.contains('active')) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  })(t0);
}

// ---------- hat mode ----------
const HAT_STAGES = [
  { name: 'שלב 1: הסבר חופשי', emoji: '🗣️', rule: 'מסבירים במילים, בלי להגיד את המילה עצמה ובלי "נשמע כמו".' },
  { name: 'שלב 2: מילה אחת', emoji: '☝️', rule: 'מותר להגיד רק מילה אחת כרמז. כבר שמעתם את כל המילים בשלב הקודם, אז תזכרו!' },
  { name: 'שלב 3: פנטומימה', emoji: '🤐', rule: 'בלי מילים ובלי קולות. רק תנועות, פרצופים וידיים.' },
];
let hatWords = [];
function startHatWords(keep) {
  if (!keep) hatWords = [];
  renderHat();
  show('hatWords');
  setTimeout(() => $('#hatInput').focus(), 250);
}
function renderHat() {
  $('#hatCount').textContent = hatWords.length;
  $('#hatNext').disabled = hatWords.length < 3;
  $('#hatNext').style.opacity = hatWords.length < 3 ? 0.4 : 1;
}
$('#hatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#hatInput').value.trim();
  if (!v) return;
  hatWords.push(v);
  $('#hatInput').value = '';
  $('#hatLast').textContent = `✓ נוספה מילה (סה"כ ${hatWords.length}) · המילה מוסתרת`;
  replay($('#hatPaper'), 'drop');
  buzz(30);
  renderHat();
});
$('#hatRandom').addEventListener('click', () => {
  const pool = shuffle(DECKS.flatMap((d) => d.words).filter((w) => !hatWords.includes(w)));
  hatWords.push(...pool.slice(0, 10));
  $('#hatLast').textContent = `🎲 נוספו 10 מילים אקראיות (סה"כ ${hatWords.length})`;
  replay($('#hatPaper'), 'drop');
  renderHat();
});
$('#hatUndo').addEventListener('click', () => {
  if (!hatWords.length) return;
  hatWords.pop();
  $('#hatLast').textContent = `↺ המילה האחרונה הוסרה (סה"כ ${hatWords.length})`;
  renderHat();
});
$('#hatNext').addEventListener('click', () => { renderSetup(); show('setup'); });

function startHatGame() {
  const allWords = hatWords.map((w) => ({ w, deck: '', emoji: '🎩' }));
  game = { mode: 'hat', teams: teams.slice(), allWords, pool: shuffle(allWords.slice()), scores: teams.map(() => 0), team: 0, stage: 0 };
  showStage();
}
function showStage() {
  const s = HAT_STAGES[game.stage];
  $('#stageNum').textContent = `שלב ${game.stage + 1} מתוך 3 · ${game.allWords.length} מילים בכובע`;
  $('#stageEmoji').textContent = s.emoji;
  replay($('#stageEmoji'), 'stage-emoji');
  $('#stageName').textContent = s.name.split(': ')[1];
  $('#stageRule').textContent = s.rule;
  show('hatStage', false);
}
$('#stageGo').addEventListener('click', showTurn);

// ---------- my decks ----------
let editing = null;
function renderMyDecks() {
  $('#myDeckList').innerHTML = customDecks.map((d, i) => `
    <div class="my-deck" data-i="${i}" style="animation-delay:${i * 50}ms">
      <span class="emoji">${d.emoji}</span>
      <div class="info"><div class="name">${esc(d.name)}</div><div class="count">${d.words.length} מילים</div></div>
      <span>✏️</span>
    </div>`).join('');
  $('#myDeckEmpty').style.display = customDecks.length ? 'none' : '';
  $$('#myDeckList .my-deck').forEach((el) => el.addEventListener('click', () => openEditor(+el.dataset.i)));
}
function openEditor(i) {
  editing = i;
  const d = i == null ? { name: '', emoji: DECK_EMOJIS[0], words: [] } : customDecks[i];
  $('#edName').value = d.name;
  $('#edWords').value = d.words.join('\n');
  $('#edDelete').style.display = i == null ? 'none' : '';
  $('#edEmoji').innerHTML = DECK_EMOJIS.map((e) => `<button class="${e === d.emoji ? 'on' : ''}">${e}</button>`).join('');
  $$('#edEmoji button').forEach((b) => b.addEventListener('click', () => {
    $$('#edEmoji button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
  }));
  updateEdCount();
  show('editor');
}
const edWords = () => [...new Set($('#edWords').value.split('\n').map((w) => w.trim()).filter(Boolean))];
function updateEdCount() { $('#edCount').textContent = edWords().length; }
$('#edWords').addEventListener('input', updateEdCount);
$('#newDeck').addEventListener('click', () => openEditor(null));
$('#edSave').addEventListener('click', () => {
  const words = edWords();
  const name = $('#edName').value.trim() || 'החפיסה שלי';
  if (words.length < 1) { ask('תוסיפו לפחות מילה אחת', 'אוקיי', null); return; }
  const emoji = ($('#edEmoji button.on') || {}).textContent || DECK_EMOJIS[0];
  if (editing == null) customDecks.push({ id: `custom-${Date.now()}`, name, emoji, words });
  else Object.assign(customDecks[editing], { name, emoji, words });
  saveAll();
  renderMyDecks();
  renderHome();
  back();
});
$('#edDelete').addEventListener('click', async () => {
  if (editing == null || !(await ask('למחוק את החפיסה?', 'מחק', 'ביטול'))) return;
  customDecks.splice(editing, 1);
  saveAll();
  renderMyDecks();
  renderHome();
  back();
});

// ---------- launch ----------
renderHome();
renderHUD();
if (Plugins.StatusBar) Plugins.StatusBar.hide().catch(() => {});
setTimeout(() => { $('#splash').classList.add('done'); sfx.go(); }, 1500);
