// Menus, game modes, the loop, the HUD and online play.
import { buildWorld } from './world.js';
import { newCar, stepCar, collideCars, packCar, unpackCar, emptyInput } from './car.js';
import { Match, applySnapshot, RULES } from './sim.js';
import { Bot } from './bot.js';
import { Renderer, CAR_STYLES, CAR_COLORS } from './render.js';
import { TouchPad, Keyboard, mix } from './input.js';
import { unlock, sfx, Engine, isMuted, setMuted } from './audio.js';
import { HostSession, GuestSession, makeCode, cleanCode } from './net.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const Plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
Plugins.StatusBar?.hide?.().catch?.(() => {});

const store = {
  get(k, d) { try { const v = localStorage.getItem('sr-' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sr-' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const randomName = () => ['Turbo', 'Zoom', 'Nitro', 'Drifty', 'Bolt', 'Rocket', 'Comet', 'Blaze'][Math.floor(Math.random() * 8)] + Math.floor(Math.random() * 90 + 10);

const me = {
  name: store.get('name', randomName()),
  style: store.get('style', 'comet'),
  color: store.get('color', CAR_COLORS[0]),
  skill: store.get('skill', 'normal'),
};
const p2 = { name: store.get('name2', 'Player 2'), style: store.get('style2', 'brick'), color: store.get('color2', CAR_COLORS[1]) };

const world = buildWorld(7);
const canvas = $('#view');
const R = new Renderer(canvas, world);
const kb = new Keyboard();
window.__sr = { world, R, get game() { return game; } };

// ---------- screens ----------
function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
}
let toastT = 0;
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms);
}

// ---------- garage ----------
function drawCarIcon(cv, style, color) {
  const g = cv.getContext('2d');
  const W = cv.width = 144, H = cv.height = 80;
  g.clearRect(0, 0, W, H);
  g.fillStyle = color; g.strokeStyle = '#2a2350'; g.lineWidth = 5; g.lineJoin = 'round';
  g.beginPath();
  if (style === 'brick') { g.roundRect(14, 26, 116, 34, 6); g.moveTo(30, 26); g.roundRect(30, 8, 76, 22, 5); }
  else if (style === 'bubble') { g.roundRect(18, 30, 108, 30, 14); g.moveTo(38, 32); g.roundRect(38, 10, 66, 30, 16); }
  else { g.moveTo(10, 56); g.lineTo(12, 38); g.lineTo(48, 32); g.lineTo(66, 18); g.lineTo(100, 18); g.lineTo(118, 32); g.lineTo(134, 36); g.lineTo(134, 56); g.closePath(); g.moveTo(112, 22); g.lineTo(134, 18); }
  g.fill(); g.stroke();
  g.fillStyle = '#2a2350';
  const wr = style === 'brick' ? 13 : 11;
  for (const x of [38, 106]) { g.beginPath(); g.arc(x, 60, wr, 0, 7); g.fill(); g.fillStyle = '#ddd'; g.beginPath(); g.arc(x, 60, wr * 0.45, 0, 7); g.fill(); g.fillStyle = '#2a2350'; }
}

function garage(prefix, who, other) {
  const styles = $('#styles' + prefix), colors = $('#colors' + prefix);
  styles.innerHTML = ''; colors.innerHTML = '';
  const names = { comet: 'Comet', brick: 'Brick', bubble: 'Bubble' };
  const draw = () => {
    $$('button', styles).forEach((b) => { b.classList.toggle('sel', b.dataset.v === who.style); drawCarIcon($('canvas', b), b.dataset.v, who.color); });
    $$('button', colors).forEach((b) => b.classList.toggle('sel', b.dataset.v === who.color));
    if (!prefix) R.setCars([{ style: me.style, color: me.color }]);
  };
  for (const s of CAR_STYLES) {
    const b = document.createElement('button'); b.dataset.v = s;
    b.innerHTML = `<canvas></canvas><span>${names[s]}</span>`;
    b.onclick = () => { who.style = s; save(); draw(); sfx.click(); };
    styles.append(b);
  }
  for (const c of CAR_COLORS) {
    const b = document.createElement('button'); b.dataset.v = c; b.style.background = c;
    b.onclick = () => { who.color = c; save(); draw(); sfx.click(); };
    colors.append(b);
  }
  draw();
  void other;
}
function save() {
  store.set('name', me.name); store.set('style', me.style); store.set('color', me.color); store.set('skill', me.skill);
  store.set('name2', p2.name); store.set('style2', p2.style); store.set('color2', p2.color);
}

$('#nameInput').value = me.name;
$('#nameInput').oninput = (e) => { me.name = e.target.value.trim().slice(0, 12) || 'Driver'; save(); };
$('#name2Input').value = p2.name;
$('#name2Input').oninput = (e) => { p2.name = e.target.value.trim().slice(0, 12) || 'Player 2'; save(); };
garage('', me);
garage('2', p2);

$('#btnSound').textContent = isMuted() ? '🔇' : '🔊';
$('#btnSound').onclick = () => { setMuted(!isMuted()); $('#btnSound').textContent = isMuted() ? '🔇' : '🔊'; };
$('#btnHelp').onclick = () => show('help');
$$('[data-back]').forEach((b) => (b.onclick = () => { sfx.click(); show('menu'); }));
$('#skillLabel').textContent = me.skill;
document.addEventListener('pointerdown', unlock, { capture: true });
document.addEventListener('keydown', unlock, { capture: true });

$('#btnBot').onclick = () => { sfx.click(); show('bot'); paintSkill(); };
function paintSkill() { $$('#skillSeg button').forEach((b) => b.classList.toggle('sel', b.dataset.v === me.skill)); $('#skillLabel').textContent = me.skill; }
$$('#skillSeg button').forEach((b) => (b.onclick = () => { me.skill = b.dataset.v; save(); paintSkill(); sfx.click(); }));
$('#btnBotGo').onclick = () => startGame({ mode: 'bot' });
$('#btnLocal').onclick = () => { sfx.click(); show('local'); };
$('#btnLocalGo').onclick = () => startGame({ mode: 'local' });
$('#btnOnline').onclick = () => { sfx.click(); $('#onlineStatus').textContent = ''; show('online'); };

// ---------- the game ----------
let game = null;

function playersFor(mode) {
  if (mode === 'bot') {
    const style = CAR_STYLES[(CAR_STYLES.indexOf(me.style) + 1) % 3];
    const color = CAR_COLORS.find((c) => c !== me.color && c !== '#f4f1ea' && c !== '#2b2b36');
    const botName = { easy: 'Rusty', normal: 'Bolt', hard: 'Viper' }[me.skill] || 'Bolt';
    return [{ ...me }, { name: botName + ' 🤖', style, color }];
  }
  if (mode === 'local') {
    const c2 = p2.color === me.color ? CAR_COLORS.find((c) => c !== me.color) : p2.color;
    return [{ ...me }, { ...p2, color: c2 }];
  }
  return null;
}

function startGame(opts) {
  unlock();
  sfx.click();
  if (game) endGame(false);
  const players = opts.players || playersFor(opts.mode);
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  const g = game = {
    mode: opts.mode,              // bot | local | host | guest
    players,
    local: opts.mode === 'local' ? [0, 1] : opts.mode === 'guest' ? [1] : [0],
    match: null, view: null,
    paused: false,
    net: opts.net || null,
    sendT: 0, snapT: 0,
    lastRemote: performance.now(),
    engines: [],
    pads: [],
    seed,
  };
  if (opts.mode === 'guest') {
    // the guest mirrors the host's match and drives only its own car
    g.view = { phase: 'count', t: -RULES.countdown, clock: RULES.time, scores: [0, 0], stars: [], winner: -1, stats: [{}, {}], cars: world.spawns.map((s, i) => newCar(s, i)) };
  } else {
    g.match = new Match(world, { seed });
    if (opts.mode === 'bot') g.bot = new Bot(world, 1, me.skill);
  }
  R.setCars(players.map((p, i) => ({ ...p, name: g.local.includes(i) && g.mode !== 'local' ? '' : p.name })));
  buildHud(g);
  for (const i of g.local) g.engines[i] = new Engine();
  g.countBeep = 4;
  show(null);
  $('#hud').classList.add('on');
  g.lastPhase = 'count';
}

function endGame(toMenu = true) {
  const g = game;
  if (!g) return;
  for (const e of g.engines) e && e.stop();
  game = null;
  $('#hud').classList.remove('on');
  $('#hud').innerHTML = '';
  if (toMenu) {
    if (g.net) { g.net.close(); }
    R.setCars([{ style: me.style, color: me.color }]);
    show('menu');
  }
}

// state the HUD and renderer read: the match on host/solo, the mirror on a guest
const S = (g) => g.match || g.view;

// ---------- HUD ----------
function buildHud(g) {
  const hud = $('#hud');
  hud.innerHTML = '';
  g.pv = [];
  const tpl = $('#pviewTpl');
  const views = g.local;
  views.forEach((carIdx, k) => {
    const el = tpl.content.firstElementChild.cloneNode(true);
    hud.append(el);
    const pad = new TouchPad($('.controls', el), false);
    const pv = { el, car: carIdx, pad, map: $('.minimap', el), banner: $('.banner', el), boost: $('.boost', el), pts: $$('.pts', el), clock: $('.clock', el), flip: false, k };
    $$('.side', el).forEach((s, i) => {
      $('.nm', s).textContent = g.players[i].name;
      $('.dot', s).style.background = g.players[i].color;
      s.classList.toggle('me', i === carIdx);
    });
    $('.pauseBtn', el).onclick = () => pause(true);
    g.pv.push(pv);
  });
  if (views.length === 2) {
    const d = document.createElement('div'); d.className = 'divider'; hud.append(d); g.divider = d;
  }
  layout();
}

function layout() {
  const w = innerWidth, h = innerHeight;
  R.resize(w, h);
  const g = game;
  if (!g) return;
  if (g.pv.length === 1) {
    Object.assign(g.pv[0].el.style, { left: 0, top: 0, width: w + 'px', height: h + 'px' });
    g.pv[0].rect = { x: 0, y: 0, w, h };
    g.pv[0].el.classList.toggle('compact', h < 560);
  } else {
    const portrait = h >= w;
    const touch = matchMedia('(hover: none)').matches;
    // portrait: the friend sits across the table, so their half is upside down
    const [a, b] = g.pv;
    if (portrait) {
      const hh = Math.floor(h / 2);
      b.rect = { x: 0, y: 0, w, h: hh }; a.rect = { x: 0, y: hh, w, h: h - hh };
      b.flip = touch;
      Object.assign(g.divider.style, { top: hh - 2 + 'px', left: 0, right: 0, width: '', bottom: '' });
      g.divider.classList.remove('v');
    } else {
      const hw = Math.floor(w / 2);
      a.rect = { x: 0, y: 0, w: hw, h }; b.rect = { x: hw, y: 0, w: w - hw, h };
      b.flip = false;
      Object.assign(g.divider.style, { left: hw - 2 + 'px', top: 0, height: h + 'px' });
      g.divider.classList.add('v');
    }
    for (const p of g.pv) {
      Object.assign(p.el.style, { left: p.rect.x + 'px', top: p.rect.y + 'px', width: p.rect.w + 'px', height: p.rect.h + 'px' });
      p.el.classList.add('compact');
      p.el.classList.toggle('flip', p.flip);
      p.pad.flip = p.flip;
    }
  }
}
addEventListener('resize', layout);

function banner(g, text, sub = '', ms = 1200, only = null) {
  for (const pv of g.pv) {
    if (only != null && pv.car !== only) continue;
    pv.banner.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    pv.banner.classList.add('on');
    clearTimeout(pv.bT);
    pv.bT = setTimeout(() => pv.banner.classList.remove('on'), ms);
  }
}

// minimap: the painted street map, the stars and both cars
let mapImg = null;
function drawMap(pv, s, cars, players) {
  const cv = pv.map, g = cv.getContext('2d');
  const W = cv.width;
  if (!mapImg) {
    mapImg = document.createElement('canvas'); mapImg.width = mapImg.height = 240;
    mapImg.getContext('2d').drawImage(R.mapCanvas, 0, 0, 240, 240);
  }
  const me = cars[pv.car];
  // zoomed in round your car, north up
  const zoom = 2.1, half = world.HALF;
  const scale = (W / (half * 2)) * zoom;
  g.save();
  g.clearRect(0, 0, W, W);
  g.translate(W / 2, W / 2);
  g.scale(scale, scale);
  g.translate(-me.x, -me.z);
  g.globalAlpha = 0.9;
  g.drawImage(mapImg, -half, -half, half * 2, half * 2);
  g.globalAlpha = 1;
  for (const b of world.boxes) { g.fillStyle = 'rgba(70,60,110,.75)'; g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0); }
  for (const st of s.stars) {
    g.fillStyle = st.v > 1 ? '#ff7ad9' : '#ffd23f';
    g.beginPath(); g.arc(st.x, st.z, (st.v > 1 ? 4.5 : 3) / zoom * 1.6, 0, 7); g.fill();
  }
  cars.forEach((c, i) => {
    g.save();
    g.translate(c.x, c.z);
    g.rotate(-c.h);
    const k = 1.6 / zoom * 2.2;
    g.scale(k, k);
    g.fillStyle = players[i].color; g.strokeStyle = '#fff'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, 5); g.lineTo(3.8, -3.5); g.lineTo(0, -1.8); g.lineTo(-3.8, -3.5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  });
  g.restore();
  // the rival off the edge: an arrow on the rim
  const o = cars[1 - pv.car];
  const dx = (o.x - me.x) * scale, dz = (o.z - me.z) * scale;
  if (Math.abs(dx) > W / 2 - 6 || Math.abs(dz) > W / 2 - 6) {
    const a = Math.atan2(dz, dx);
    const r = W / 2 - 12;
    g.fillStyle = players[1 - pv.car].color;
    g.beginPath(); g.arc(W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r, 9, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
  }
}

const fmt = (t) => { t = Math.ceil(t); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

function updateHud(g) {
  const s = S(g);
  const cars = s.cars;
  for (const pv of g.pv) {
    pv.pts.forEach((el, i) => {
      const v = String(s.scores[i]);
      if (el.textContent !== v) { el.textContent = v; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    });
    const c = s.phase === 'overtime' ? 'OT' : fmt(s.clock);
    if (pv.clock.textContent !== c) pv.clock.textContent = c;
    pv.clock.classList.toggle('hot', s.phase === 'overtime' || s.clock < 15);
    const b = Math.round(cars[pv.car].boost);
    pv.boost.style.setProperty('--b', b);
    pv.boost.classList.toggle('full', b >= 99);
    drawMap(pv, s, cars, g.players);
  }
}

// ---------- events: sounds, effects, banners ----------
function onEvent(g, e) {
  const s = S(g);
  R.event(e, s.cars);
  const mine = (i) => g.local.includes(i);
  if (e.k === 'go') { banner(g, 'GO!', '', 700); sfx.beep(true); }
  if (e.k === 'pick') {
    if (mine(e.who)) sfx.pick(e.v > 1);
    if (e.v > 1) banner(g, '+3', 'big star!', 900, e.who);
    if (g.mode === 'guest' && e.who === 1) g.view.cars[1].boost = Math.min(100, g.view.cars[1].boost + (e.boost || 6));
  }
  if (e.k === 'bump' && g.local.some((i) => Math.hypot(s.cars[i].x - e.x, s.cars[i].z - e.z) < 6)) sfx.bump(e.f);
  if (e.k === 'ram') {
    sfx.ram();
    if (mine(e.victim)) {
      haptic(true);
      if (e.n) banner(g, `−${e.n} ★`, 'you got rammed!', 1100, e.victim);
      if (g.mode === 'guest' && e.victim === 1) g.view.cars[1].spin = 0.9;
      for (const pv of g.pv) if (pv.car === e.victim) R.shakeView(pv.k, 1.2);
    }
    if (mine(e.attacker)) { haptic(false); if (e.n) banner(g, 'STOLE ' + e.n + '!', 'grab them!', 1100, e.attacker); else banner(g, 'BAM!', '', 700, e.attacker); }
  }
  if (e.k === 'big') { sfx.big(); for (const pv of g.pv) if (!pv.banner.classList.contains('on')) banner(g, '💖 Big star!', 'worth 3', 1300, pv.car); }
  if (e.k === 'overtime') { banner(g, 'OVERTIME', 'next star wins', 1800); sfx.beep(true); }
  if (e.k === 'over') setTimeout(() => showResult(g), 1300);
}

function haptic(heavy) {
  if (Plugins.Haptics?.impact) Plugins.Haptics.impact({ style: heavy ? 'HEAVY' : 'MEDIUM' }).catch(() => {});
  else navigator.vibrate?.(heavy ? 60 : 30);
}

function showResult(g) {
  if (game !== g) return;
  const s = S(g);
  const w = s.winner;
  let title;
  if (g.mode === 'local') title = w < 0 ? 'Draw!' : `${g.players[w].name} wins!`;
  else title = w < 0 ? 'Draw!' : g.local.includes(w) ? 'You win! 🏆' : 'You lose…';
  $('#resTitle').textContent = title;
  if (g.mode !== 'local') (g.local.includes(w) ? sfx.win : sfx.sad)(); else sfx.win();
  $('#resBoard').innerHTML = g.players.map((p, i) => `<div class="pl ${i === w ? 'win' : ''}"><i style="background:${p.color}"></i><span>${esc(p.name)}<small>${(s.stats?.[i]?.rams || 0)} rams · ${(s.stats?.[i]?.stolen || 0)} stolen</small></span><b>★ ${s.scores[i]}</b></div>`).join('');
  const canRematch = g.mode !== 'guest';
  $('#btnRematch').style.display = canRematch ? '' : 'none';
  $('#resStatus').textContent = g.mode === 'guest' ? 'Waiting for the host to start a rematch…' : '';
  show('result');
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

$('#btnRematch').onclick = () => {
  const g = game;
  if (!g) return;
  if (g.mode === 'host') {
    const seed = Math.floor(Math.random() * 1e9);
    g.net.broadcast({ t: 'start', seed, players: g.players });
    startGame({ mode: 'host', players: g.players, net: g.net, seed });
    hookHost(game);
  } else startGame({ mode: g.mode, players: g.players });
};
$('#btnMenu').onclick = () => endGame(true);

function pause(on) {
  const g = game;
  if (!g) return;
  if (on && $('#result').classList.contains('on')) return;
  g.paused = on && g.mode !== 'host' && g.mode !== 'guest' ? true : false;
  show(on ? 'pause' : null);
}
$('#btnResume').onclick = () => pause(false);
$('#btnQuit').onclick = () => {
  const net = game?.net;
  if (net) net.broadcast ? net.broadcast({ t: 'bye' }) : net.send({ t: 'bye' });
  setTimeout(() => endGame(true), 100);
};
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && game) pause(!$('#pause').classList.contains('on'));
});
document.addEventListener('visibilitychange', () => { if (document.hidden && game && game.mode !== 'host' && game.mode !== 'guest') pause(true); });
Plugins.App?.addListener?.('backButton', () => {
  if (game) pause(!$('#pause').classList.contains('on'));
  else if (!$('#menu').classList.contains('on')) show('menu');
  else Plugins.App.exitApp?.();
});

// ---------- online ----------
$('#btnHost').onclick = () => {
  sfx.click();
  const code = makeCode();
  $('#lobbyTitle').textContent = 'Your code';
  $('#lobbyCode').textContent = code;
  $('#lobbyStatus').textContent = 'Connecting…';
  $('#lobbyVs').textContent = '';
  show('lobby');
  let guestId = null;
  const net = new HostSession(code, {
    onOpen: () => { $('#lobbyStatus').textContent = 'Tell your friend this code. Waiting for them to join…'; },
    onJoin: (id) => { if (guestId && guestId !== id) { net.send(id, { t: 'full' }); return; } guestId = id; },
    onMessage: (id, m) => {
      if (id !== guestId) return;
      if (m.t === 'hello') {
        const guest = { name: String(m.name || 'Friend').slice(0, 12), style: CAR_STYLES.includes(m.style) ? m.style : 'comet', color: CAR_COLORS.includes(m.color) ? m.color : CAR_COLORS[1] };
        if (guest.color === me.color) guest.color = CAR_COLORS.find((c) => c !== me.color);
        const players = [{ ...me }, guest];
        $('#lobbyVs').textContent = `${me.name} vs ${guest.name}`;
        $('#lobbyStatus').textContent = 'Starting!';
        const seed = Math.floor(Math.random() * 1e9);
        net.broadcast({ t: 'start', seed, players });
        setTimeout(() => { startGame({ mode: 'host', players, net, seed }); hookHost(game); }, 600);
      } else if (game && game.net === net) onHostMessage(game, m);
    },
    onLeave: (id) => {
      if (id !== guestId) return;
      guestId = null;
      if (game && game.net === net) { toast('Your friend left the game'); setTimeout(() => game && game.net === net && endGame(true), 1500); }
    },
    onError: (msg) => { $('#lobbyStatus').textContent = msg; },
  });
  lobbyNet = net;
};
let lobbyNet = null;
$('#btnLeaveLobby').onclick = () => { lobbyNet?.close(); lobbyNet = null; show('online'); };

function hookHost(g) { g.guestState = null; }
function onHostMessage(g, m) {
  if (m.t === 'car' && g.match) { unpackCar(g.match.cars[1], m.c); g.lastRemote = performance.now(); g.remoteAge = 0; }
  if (m.t === 'bye') { toast('Your friend left the game'); endGame(true); }
}

$('#codeInput').oninput = (e) => { e.target.value = cleanCode(e.target.value); };
$('#codeInput').onkeydown = (e) => { if (e.key === 'Enter') $('#btnJoin').click(); };
$('#btnJoin').onclick = () => {
  sfx.click();
  const code = cleanCode($('#codeInput').value);
  if (code.length !== 5) { $('#onlineStatus').textContent = 'Codes have 5 letters'; return; }
  $('#lobbyTitle').textContent = 'Joining';
  $('#lobbyCode').textContent = code;
  $('#lobbyStatus').textContent = 'Looking for your friend…';
  $('#lobbyVs').textContent = '';
  show('lobby');
  const net = new GuestSession(code, {
    onOpen: () => { $('#lobbyStatus').textContent = 'Connected! Waiting for the host…'; net.send({ t: 'hello', name: me.name, style: me.style, color: me.color }); },
    onMessage: (m) => onGuestMessage(net, m),
    onClose: () => { if (game && game.net === net) toast('Connection lost, reconnecting…'); },
    onError: (msg) => { $('#lobbyStatus').textContent = msg; },
  });
  lobbyNet = net;
};

function onGuestMessage(net, m) {
  const g = game && game.net === net ? game : null;
  if (m.t === 'full') { $('#lobbyStatus').textContent = 'That game already has two players.'; return; }
  if (m.t === 'start') {
    startGame({ mode: 'guest', players: m.players, net, seed: m.seed });
    return;
  }
  if (!g) return;
  if (m.t === 'snap') {
    applySnapshot(g.view, m.s);
    unpackCar(g.view.cars[0], m.host);
    g.lastRemote = performance.now();
  }
  if (m.t === 'ev') for (const e of m.e) onEvent(g, e);
  if (m.t === 'bye') { toast('The host left the game'); endGame(true); }
}

// ---------- the loop ----------
const STEP = 1 / 60;
let acc = 0, last = performance.now();
const remoteState = new Map();

function inputFor(g, i) {
  const pv = g.pv.find((p) => p.car === i);
  const touch = pv ? pv.pad.read() : emptyInput();
  const set = g.mode === 'local' ? (i === 0 ? 'p1' : 'p2') : 'solo';
  return mix(kb.read(set), touch);
}

function tick(dt) {
  const g = game;
  if (!g || g.paused) return;
  if (g.mode === 'guest') return tickGuest(g, dt);
  const m = g.match;
  const inputs = [0, 1].map((i) => (g.local.includes(i) ? inputFor(g, i) : emptyInput()));
  if (g.bot) inputs[1] = g.bot.update(dt, m);
  const remote = [false, g.mode === 'host'];
  if (g.mode === 'host') {
    // dead-reckon the guest's car between its updates
    const c = m.cars[1];
    if (performance.now() - g.lastRemote < 300) { c.x += c.vx * dt; c.z += c.vz * dt; }
  }
  for (const i of g.local) R.setThrottle(i, inputs[i].throttle);
  m.step(dt, inputs, remote);
  // countdown beeps
  if (m.phase === 'count') {
    const n = Math.ceil(-m.t);
    if (n < g.countBeep && n > 0) { g.countBeep = n; banner(g, String(n), '', 800); sfx.beep(false); }
  }
  const evs = m.events.splice(0);
  for (const e of evs) onEvent(g, e);
  localCarSounds(g, m.cars, inputs);
  if (g.mode === 'host') {
    if (evs.length) g.net.broadcast({ t: 'ev', e: evs.filter((e) => e.k !== 'bump' || e.f > 6) });
    g.snapT -= dt;
    if (g.snapT <= 0) { g.snapT = 1 / 15; g.net.broadcast({ t: 'snap', s: m.snapshot(), host: packCar(m.cars[0]) }); }
  }
}

function tickGuest(g, dt) {
  const v = g.view;
  const mine = v.cars[1], host = v.cars[0];
  v.t += dt;
  const inp = inputFor(g, 1);
  R.setThrottle(1, inp.throttle);
  const locked = v.phase === 'count' || v.phase === 'over';
  if (performance.now() - g.lastRemote < 300) { host.x += host.vx * dt; host.z += host.vz * dt; }
  stepCar(mine, inp, world, dt, locked);
  // bump the host's car, but only move our own
  const hit = collideCars(host, mine, { moveA: false, moveB: true });
  if (hit && hit.closing > 4 && (g.bumpCool || 0) <= 0) { sfx.bump(hit.closing); g.bumpCool = 0.3; R.event({ k: 'bump', x: hit.x, z: hit.z }); }
  g.bumpCool = (g.bumpCool || 0) - dt;
  if (v.phase === 'count') {
    const n = Math.ceil(-v.t);
    if (n < g.countBeep && n > 0) { g.countBeep = n; banner(g, String(n), '', 800); sfx.beep(false); }
  }
  localCarSounds(g, v.cars, [null, inp]);
  g.sendT -= dt;
  if (g.sendT <= 0) { g.sendT = 1 / 20; g.net.send({ t: 'car', c: packCar(mine) }); }
}

function localCarSounds(g, cars, inputs) {
  for (const i of g.local) {
    const c = cars[i];
    g.engines[i]?.set(c.speed, inputs[i]?.throttle || 0, c.drifting && c.grounded, c.boosting || c.turbo > 0, g.local.length > 1 ? 0.6 : 1);
    if (c.bump > 6) { sfx.wall(c.bump); for (const pv of g.pv) if (pv.car === i) R.shakeView(pv.k, Math.min(0.8, c.bump * 0.03)); }
    if (c.landed > 10) sfx.land(c.landed);
    if (c.padHit) { sfx.pad(); c.padHit = false; }
    c.bump = 0; c.landed = 0;
  }
  // remote/bot cars: clear their one-shot flags too
  for (const c of cars) if (!g.local.includes(c.id)) { c.bump = 0; c.landed = 0; c.padHit = false; }
}

// the menu showcase: your car parked on the corner, the camera circling
const showcase = { ...newCar({ x: 111, z: 30, h: -1.9 }, 0), menu: true };

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const g = game;
  if (g) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 6) { tick(STEP); acc -= STEP; n++; }
    if (n >= 6) acc = 0;
    const s = S(g);
    R.update(g.paused ? 0 : dt, s.cars, s.stars, s.t);
    updateHud(g);
    R.render(g.paused ? 0 : dt, g.pv.map((pv) => ({ ...pv.rect, car: pv.car, flip: pv.flip, i: pv.k })), s.cars);
  } else {
    R.update(dt, [showcase], [], 0);
    R.renderMenu(dt, showcase);
  }
}

// ---------- boot ----------
layout();
document.fonts?.ready.then(() => { garage('', me); garage('2', p2); });
show('menu');
requestAnimationFrame((t) => { last = t; frame(t); });
setTimeout(() => $('#splash').classList.add('gone'), 300);
void remoteState;
