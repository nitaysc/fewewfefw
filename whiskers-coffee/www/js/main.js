// Whiskers & Coffee: screens, input, building, saving and the co-op session.
import { Renderer } from './render.js';
import { Sim } from './game/sim.js';
import { newCafe, uid, footprint, canPlace, furnitureAt, ROOM_W, ROOM_H, strays, adoptPrice, MAX_CATS, upgradeCafe } from './game/world.js';
import { CATALOG, SHOP_ORDER, SETS } from './game/catalog.js';
import { WALL_STYLES, FLOOR_STYLES, WALL_ORDER, FLOOR_ORDER, styleSwatch } from './art/room.js';
import { HostSession, GuestSession, makeCode, cleanCode } from './net.js';
import { personSprite, randomLook, SKINS, HAIR_COLORS, HAIR_STYLES, OUTFIT_COLORS } from './art/people.js';
import { DRINKS, DRINK_ORDER, cupCanvas } from './art/drinks.js';
import { seededRng, customerName } from './game/customers.js';
import { catFrame, COLLARS, COLLAR_ORDER } from './art/cats.js';
import { icon, iconImg } from './ui/icons.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const Plugins = (window.Capacitor && window.Capacitor.Plugins) || {};

// ---------- saved data ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or unavailable */ } },
};
const prefs = Object.assign({
  id: uid('p'),
  name: 'Barista',
  look: { skin: SKINS[1], hair: HAIR_COLORS[1], style: 'bob', shirt: OUTFIT_COLORS[1], pants: '#2f3f4a', apron: true, apronColor: '#e8d7b0' },
  sound: true,
}, store.get('wc-prefs', {}));
const savePrefs = () => store.set('wc-prefs', prefs);
savePrefs();
const cafes = () => store.get('wc-cafes', {});
function saveCafe(cafe, extra = {}) {
  const all = cafes();
  all[cafe.id] = { ...cafe, ...extra, savedAt: Date.now() };
  store.set('wc-cafes', all);
  store.set('wc-last', cafe.id);
}
const lastCafe = () => { const all = cafes(); return all[store.get('wc-last', '')] || null; };

// ---------- state ----------
const S = {
  screen: 'menu',
  role: null,             // 'solo' | 'host' | 'guest'
  cafe: null,             // the authoritative café (host/solo) or the guest's mirror
  sim: null,
  host: null, guest: null, code: null,
  myId: prefs.id,
  snaps: [], roster: [],  // guest: recent snapshots and the player list
  build: null,
  dirty: false,
};

const renderer = new Renderer($('#game'));
window.addEventListener('resize', () => renderer.resize());

// ---------- sound: soft synthesized café noises ----------
let actx;
function tone(f, d, type = 'sine', v = 0.08, slide = 0) {
  if (!prefs.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.05);
  } catch { /* no audio */ }
}
const sfx = {
  click() { tone(880, 0.05, 'triangle', 0.05); },
  purr() { for (let i = 0; i < 6; i++) setTimeout(() => tone(55 + Math.random() * 8, 0.12, 'sawtooth', 0.03), i * 110); },
  meow() { tone(720, 0.28, 'triangle', 0.06, 380); setTimeout(() => tone(1000, 0.2, 'triangle', 0.04, -420), 180); },
  place() { tone(220, 0.08, 'square', 0.05); setTimeout(() => tone(330, 0.1, 'square', 0.04), 70); },
  coin() { tone(1320, 0.08, 'square', 0.04); setTimeout(() => tone(1760, 0.12, 'square', 0.04), 70); },
  bell() { tone(1568, 0.5, 'sine', 0.06); setTimeout(() => tone(2093, 0.6, 'sine', 0.04), 120); },
  nope() { tone(180, 0.15, 'square', 0.04); },
};
function buzz(ms = 20) { if (Plugins.Haptics) Plugins.Haptics.vibrate({ duration: ms }).catch(() => {}); }

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function show(id) {
  for (const el of $$('.screen')) el.classList.toggle('show', el.id === id || (el.id === 'hud' && ['hud', 'invite', 'cats', 'pause'].includes(id)));
  S.screen = id;
}

// ---------- starting and joining ----------
function startSim(cafe) {
  S.sim = new Sim(cafe, onSimEvent);
  S.sim.addPlayer(S.myId, prefs.name, prefs.look);
}

function playSolo(cafe) {
  leaveSession();
  S.cafe = cafe; S.role = 'solo';
  startSim(cafe);
  saveCafe(cafe);
  enterCafe();
}

function enterCafe() {
  renderer.userZoom = false;
  renderer.resize();
  renderer.centre();
  show('hud');
  refreshHud();
  sfx.bell();
}

function startHosting() {
  if (S.role === 'guest' || S.host) return;
  const code = makeCode();
  S.code = code;
  $('#inviteCode').textContent = code;
  $('#inviteStatus').textContent = 'Opening your café to friends…';
  S.host = new HostSession(code, {
    onOpen: () => { S.role = 'host'; $('#inviteStatus').textContent = 'Waiting for your friend to join…'; refreshHud(); },
    onJoin: (id) => { $('#inviteStatus').textContent = 'Your friend is connected!'; },
    onMessage: onHostMessage,
    onLeave: (id) => { if (S.sim) { const p = S.sim.players.get(id); S.sim.removePlayer(id); if (p) toast(`${p.name} left the café`); } },
    onError: (e) => { $('#inviteStatus').textContent = e; S.host?.close(); S.host = null; S.role = 'solo'; },
  });
}

function onHostMessage(id, m) {
  const sim = S.sim;
  if (!sim || !m || typeof m !== 'object') return;
  switch (m.t) {
    case 'hello':
      sim.addPlayer(id, String(m.name || 'Friend').slice(0, 14), m.look || prefs.look);
      S.host.send(id, { t: 'welcome', you: id, cafe: S.cafe, roster: sim.roster(), code: S.code });
      toast(`${m.name || 'Your friend'} joined the café!`);
      sfx.bell();
      break;
    case 'move': sim.movePlayer(id, +m.x, +m.y); break;
    case 'pet': sim.petCat(id, m.cat); break;
    case 'build': {
      const err = sim.build(m.op, id);
      if (err) S.host.send(id, { t: 'toast', text: err });
      break;
    }
    case 'claim': case 'brewed': case 'serve': {
      const err = sim.shop[m.t](id, m.id);
      if (err) S.host.send(id, { t: 'toast', text: err });
      break;
    }
    case 'look': {
      const p = sim.players.get(id);
      if (p) { p.name = String(m.name || p.name).slice(0, 14); p.look = m.look || p.look; S.host.broadcast({ t: 'roster', roster: sim.roster() }); }
      break;
    }
  }
}

function onSimEvent(type, data) {
  if (type === 'fx') {
    renderer.addFx(data);
    S.host?.broadcast({ t: 'fx', fx: data });
    fxFeedback(data);
  } else if (type === 'cafe') {
    S.host?.broadcast({ t: 'cafe', cafe: S.cafe });
    refreshHud();
    if (S.build) renderTray();
    if (S.screen === 'cats' && !catsUi.editing) renderCats();
  } else if (type === 'roster') {
    S.host?.broadcast({ t: 'roster', roster: S.sim.roster() });
    refreshHud();
  } else if (type === 'save') S.dirty = true;
}

function joinCafe(code) {
  leaveSession();
  $('#joinStatus').textContent = 'Connecting…';
  $('#joinGo').disabled = true;
  S.role = 'guest';
  S.code = code;
  S.guest = new GuestSession(code, {
    onOpen: () => {
      $('#joinStatus').textContent = 'Connected! Opening the café…';
      $('#netBanner').hidden = true;
      S.guest.send({ t: 'hello', name: prefs.name, look: prefs.look });
    },
    onMessage: onGuestMessage,
    onClose: () => { if (S.screen !== 'menu') { $('#netBanner').hidden = false; $('#netBanner').textContent = 'Connection lost, reconnecting…'; } },
    onError: (e) => { $('#joinStatus').textContent = e; $('#joinGo').disabled = false; if (S.screen !== 'join') toast(e); },
  });
}

function onGuestMessage(m) {
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'welcome':
      S.myId = m.you; S.cafe = m.cafe; S.roster = m.roster; S.snaps = [];
      saveCafe(S.cafe, { guestOf: m.code });
      $('#joinGo').disabled = false;
      if (S.screen === 'join' || S.screen === 'menu') enterCafe();
      refreshHud();
      break;
    case 'snap':
      S.snaps.push({ at: performance.now(), ...m });
      if (S.snaps.length > 6) S.snaps.shift();
      if (S.cafe && m.m !== S.cafe.money) { S.cafe.money = m.m; refreshHud(); }
      break;
    case 'cafe':
      S.cafe = m.cafe;
      saveCafe(S.cafe, { guestOf: S.code });
      refreshHud();
      if (S.build) { if (S.build.selectedId && !S.cafe.furniture.some((f) => f.id === S.build.selectedId)) S.build.selectedId = null; renderTray(); }
      if (S.screen === 'cats' && !catsUi.editing) renderCats();
      break;
    case 'roster': S.roster = m.roster; refreshHud(); break;
    case 'fx':
      renderer.addFx(m.fx);
      fxFeedback(m.fx);
      break;
    case 'toast': toast(m.text); sfx.nope(); break;
  }
}

function fxFeedback(f) {
  if (f.kind === 'hearts' && f.by === S.myId) { sfx.purr(); buzz(25); toast(`${f.name} purrs happily`); }
  if (f.kind === 'bell') sfx.bell();
  if (f.kind === 'coins') { sfx.coin(); if (f.by === S.myId) { buzz(30); toast(`${f.name} loves it! +${f.amount}`); } }
  if (f.kind === 'flash') tone(2400, 0.05, 'square', 0.03);
  if (f.kind === 'adopted') { sfx.meow(); buzz(30); toast(`Welcome home, ${f.name}!`); }
}

function leaveSession() {
  S.host?.close(); S.guest?.close();
  S.host = S.guest = null;
  if (S.sim && S.cafe && S.role !== 'guest') saveCafe(S.cafe);
  S.sim = null; S.role = null; S.snaps = []; S.code = null;
  closeBuild();
}

// ---------- actions: applied locally by the host, sent as requests by a guest ----------
function act(kind, data) {
  if (S.role === 'guest') return S.guest?.send({ t: kind, ...data });
  if (!S.sim) return;
  if (kind === 'move') S.sim.movePlayer(S.myId, data.x, data.y);
  else if (kind === 'pet') S.sim.petCat(S.myId, data.cat);
  else if (kind === 'claim' || kind === 'brewed' || kind === 'serve') {
    const err = S.sim.shop[kind](S.myId, data.id);
    if (err) { toast(err); sfx.nope(); }
    return err;
  }
  else if (kind === 'build') {
    const err = S.sim.build(data.op, S.myId);
    if (err) { toast(err); sfx.nope(); }
  } else if (kind === 'look') {
    const p = S.sim.players.get(S.myId);
    if (p) { p.name = data.name; p.look = data.look; S.sim.emit('roster'); }
  }
}

// ---------- the view each frame ----------
function currentView(now) {
  const cafe = S.cafe;
  let players = [], cats = [];
  const catData = new Map(cafe.cats.map((c) => [c.id, c]));
  let customers = [];
  if (S.sim) {
    players = [...S.sim.players.values()].map((p) => ({ ...p, carry: p.carry?.drink, me: p.id === S.myId }));
    cats = [...S.sim.cats.values()].map((c) => ({ ...c, coat: catData.get(c.id)?.coat, name: catData.get(c.id)?.name, collar: catData.get(c.id)?.collar }));
    customers = [...S.sim.shop.list.values()].map((u) => ({ id: u.id, x: u.x, y: u.y, z: u.z, view: u.view, flip: u.flip, state: u.state, seed: u.seed, order: u.order, emote: u.emote, claimed: u.claimedBy, moving: u.moving, look: lookFor(u.seed), name: u.name }));
  } else if (S.snaps.length) {
    // draw guests 120ms in the past and blend between the two snapshots around that moment
    const at = now - 120;
    let a = S.snaps[0], b = S.snaps[S.snaps.length - 1];
    for (let i = 0; i < S.snaps.length - 1; i++) if (S.snaps[i].at <= at && S.snaps[i + 1].at >= at) { a = S.snaps[i]; b = S.snaps[i + 1]; }
    const k = b.at > a.at ? Math.max(0, Math.min(1, (at - a.at) / (b.at - a.at))) : 1;
    const lerp = (x, y) => x + (y - x) * k;
    const roster = new Map(S.roster.map((r) => [r.id, r]));
    const pa = new Map(a.p.map((p) => [p[0], p]));
    for (const p of b.p) {
      const q = pa.get(p[0]) || p, r = roster.get(p[0]);
      players.push({ id: p[0], x: lerp(q[1], p[1]), y: lerp(q[2], p[2]), view: p[3] ? 'back' : 'front', flip: !!p[4], moving: !!p[5], carry: p[6] || null, name: r?.name, look: r?.look || prefs.look, me: p[0] === S.myId });
    }
    const ua = new Map((a.u || []).map((u) => [u[0], u]));
    for (const u of b.u || []) {
      const q = ua.get(u[0]) || u;
      customers.push({ id: u[0], x: lerp(q[1], u[1]), y: lerp(q[2], u[2]), z: u[3], view: u[4] ? 'back' : 'front', flip: !!u[5], state: u[6], seed: u[7], order: u[8], emote: u[9] || null, claimed: u[10] || null, moving: !!u[11], look: lookFor(u[7]), name: customerName(u[7]) });
    }
    const ca = new Map(a.c.map((c) => [c[0], c]));
    for (const c of b.c) {
      const q = ca.get(c[0]) || c, d = catData.get(c[0]);
      cats.push({ id: c[0], x: lerp(q[1], c[1]), y: lerp(q[2], c[2]), z: lerp(q[3], c[3]), state: c[4], flip: !!c[5], coat: d?.coat, name: d?.name, collar: d?.collar });
    }
  }
  return { cafe, players, cats, customers, build: S.build, time: now / 1000 };
}

const looks = new Map();
function lookFor(seed) {
  if (!looks.has(seed)) looks.set(seed, randomLook(seededRng(seed)));
  return looks.get(seed);
}

// the simulation and networking tick on a timer, so the café keeps running for a guest
// even when the host's screen isn't drawing
let last = performance.now(), snapAt = 0, saveAt = 0;
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (S.sim) S.sim.step(dt);
  if (S.host && S.host.count && now - snapAt > 90) { snapAt = now; S.host.broadcast({ t: 'snap', ...S.sim.snapshot() }); }
  if (S.dirty && now - saveAt > 4000 && S.cafe && S.role !== 'guest') { saveAt = now; S.dirty = false; saveCafe(S.cafe); }
}, 33);
let shownMoney = null;
function frame(now) {
  requestAnimationFrame(frame);
  if (!S.cafe) return;
  renderer.draw(currentView(now));
  if (S.cafe.money !== shownMoney) { shownMoney = S.cafe.money; $('#money').textContent = shownMoney; }
}

// ---------- touch: tap to walk or pet, drag to look around, pinch to zoom ----------
const pointers = new Map();
let gesture = null;
const canvas = $('#game');
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  if (pointers.size === 1) gesture = { kind: 'tap', moved: 0, cam: { ...renderer.cam } };
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: renderer.zoom };
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || !gesture) return;
  const dpr = renderer.dpr;
  p.x = e.clientX; p.y = e.clientY;
  if (gesture.kind === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const z = Math.round(gesture.z0 * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0);
    renderer.zoom = Math.max(2, Math.min(10, z));
    renderer.userZoom = true;
    return;
  }
  const dx = (p.x - p.x0) * dpr, dy = (p.y - p.y0) * dpr;
  gesture.moved = Math.max(gesture.moved, Math.hypot(dx, dy));
  if (gesture.moved > 12 * dpr && gesture.kind === 'tap') gesture.kind = 'pan';
  if (gesture.kind === 'pan') {
    renderer.cam.x = gesture.cam.x - dx / renderer.zoom;
    renderer.cam.y = gesture.cam.y - dy / renderer.zoom;
    renderer.clampCam();
  }
});
const endPointer = (e) => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!p || !gesture) return;
  if (gesture.kind === 'tap' && pointers.size === 0) tap(p.x * renderer.dpr, p.y * renderer.dpr);
  if (pointers.size === 0) gesture = null;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); gesture = null; });
canvas.addEventListener('wheel', (e) => { renderer.zoom = Math.max(2, Math.min(10, renderer.zoom + (e.deltaY < 0 ? 1 : -1))); renderer.userZoom = true; }, { passive: true });

function tap(sx, sy) {
  if (S.screen !== 'hud' || !S.cafe) return;
  const [tx, ty] = renderer.toTile(sx, sy);
  const ix = Math.floor(tx), iy = Math.floor(ty);
  if (S.build) return buildTap(ix, iy);
  const v = currentView(performance.now());
  const cust = renderer.personAt(v.customers, sx, sy);
  if (cust) return tapCustomer(cust, v);
  const hit = furnitureAt(S.cafe, ix, iy, false);
  if (hit && CATALOG[hit.type].station) return openBrew();
  const cat = renderer.catAt(v.cats, sx, sy);
  if (cat) { act('pet', { cat: cat.id }); sfx.meow(); return; }
  if (ix >= 0 && iy >= 0 && ix < ROOM_W && iy < ROOM_H) { act('move', { x: ix + 0.5, y: iy + 0.5 }); sfx.click(); }
}

// ---------- serving and the espresso bar ----------
function myPlayer(v) { return v.players.find((p) => p.me); }

function tapCustomer(u, v) {
  const me = myPlayer(v);
  if (u.state === 'order') {
    if (me?.carry === u.order) { act('serve', { id: u.id }); sfx.click(); return; }
    if (me?.carry) { toast(`${u.name} would like ${aOrAn(DRINKS[u.order].name)}`); sfx.nope(); return; }
    return openBrew(u.id);
  }
  if (u.state === 'drink') toast(`${u.name} is enjoying their ${DRINKS[u.order].name.toLowerCase()}`);
  else if (u.state === 'enter') toast(`${u.name} is finding a seat`);
}
const aOrAn = (s) => (/^[aeiou]/i.test(s) ? 'an ' : 'a ') + s.toLowerCase();

const brew = { open: false, id: null, step: 0, busy: false };
function openBrew(preselect = null) {
  brew.open = true; brew.id = null; brew.step = 0; brew.busy = false;
  $('#brew').hidden = false;
  $('#brewClose').innerHTML = iconImg('cross', 2);
  if (preselect) startOrder(preselect); else renderBrew();
}
function closeBrew() { brew.open = false; $('#brew').hidden = true; }
$('#brewClose').addEventListener('click', () => { sfx.click(); closeBrew(); });

function waitingOrders() {
  const v = currentView(performance.now());
  return v.customers.filter((u) => u.state === 'order');
}

function renderBrew() {
  if (!brew.open) return;
  const body = $('#brewBody');
  if (!brew.id) {
    $('#brewTitle').textContent = 'Orders';
    const list = waitingOrders();
    const me = myPlayer(currentView(performance.now()));
    if (me?.carry) {
      body.innerHTML = `<p class="hint">You're holding ${aOrAn(DRINKS[me.carry].name)}. Tap the customer who ordered it to serve.</p>`;
      return;
    }
    body.innerHTML = list.length ? list.map((u) => {
      const taken = u.claimed && u.claimed !== S.myId;
      return `<button class="order${taken ? ' taken' : ''}" data-order="${u.id}"><img src="${cupCanvas(u.order, 1, false, 3).toDataURL()}" alt="">
        <div><b>${DRINKS[u.order].name}</b><small>for ${escapeHtml(u.name)}${taken ? ' · your friend is on it' : ''}</small></div></button>`;
    }).join('') : '<p class="hint">No orders right now. Customers drop by every little while; enjoy the cats meanwhile.</p>';
    return;
  }
  const u = waitingOrders().find((o) => o.id === brew.id);
  const d = DRINKS[brew.drink];
  $('#brewTitle').textContent = d.name;
  const done = brew.step >= d.steps.length;
  const progress = done ? 1 : brew.step / d.steps.length;
  body.innerHTML = `<div class="brew-cup"><canvas id="brewCup"></canvas></div>
    <div class="step-list">${d.steps.map((_, i) => `<span class="${i < brew.step ? 'done' : ''}"></span>`).join('')}</div>
    ${done ? `<p class="hint">Ready! Tap <b>${escapeHtml(u?.name || 'the customer')}</b> to serve it.</p><button class="btn primary" id="brewDone">Okay</button>`
      : `<button class="btn primary step-btn" id="stepBtn"><i></i>${d.steps[brew.step][1]}</button>`}`;
  const big = cupCanvas(brew.drink, progress, true, 4);
  const cv = $('#brewCup'); cv.width = big.width; cv.height = big.height;
  cv.getContext('2d').drawImage(big, 0, 0);
}

function startOrder(id) {
  const u = waitingOrders().find((o) => o.id === id);
  if (!u) return renderBrew();
  if (u.claimed && u.claimed !== S.myId) { toast('Your friend is already making that one'); sfx.nope(); return renderBrew(); }
  const err = act('claim', { id });
  if (err) return renderBrew();
  brew.id = id; brew.drink = u.order; brew.step = 0;
  renderBrew();
}

$('#brew').addEventListener('click', (e) => {
  const o = e.target.closest('[data-order]');
  if (o) { sfx.click(); return startOrder(o.dataset.order); }
  if (e.target.closest('#brewDone')) { sfx.click(); return closeBrew(); }
  const btn = e.target.closest('#stepBtn');
  if (!btn || brew.busy) return;
  brew.busy = true;
  const bar = btn.querySelector('i'), key = DRINKS[brew.drink].steps[brew.step][0];
  stepSound(key);
  const t0 = performance.now(), dur = 650;
  (function fill(now) {
    const k = Math.min(1, (now - t0) / dur);
    bar.style.width = `${k * 100}%`;
    if (k < 1) return requestAnimationFrame(fill);
    brew.busy = false;
    brew.step++;
    buzz(12);
    if (brew.step >= DRINKS[brew.drink].steps.length) { act('brewed', { id: brew.id }); sfx.coin(); }
    renderBrew();
  })(t0);
});

function stepSound(key) {
  if (key === 'grind') for (let i = 0; i < 8; i++) setTimeout(() => tone(140 + Math.random() * 60, 0.05, 'sawtooth', 0.025), i * 70);
  else if (key === 'shot' || key === 'pour' || key === 'choc') tone(300, 0.5, 'sine', 0.03, -120);
  else if (key === 'milk' || key === 'foam' || key === 'whisk') for (let i = 0; i < 10; i++) setTimeout(() => tone(2000 + Math.random() * 800, 0.04, 'triangle', 0.012), i * 55);
  else if (key === 'ice') [0, 90, 170].forEach((d) => setTimeout(() => tone(1800 + Math.random() * 400, 0.05, 'square', 0.02), d));
  else tone(660, 0.12, 'triangle', 0.04);
}
// keep the order list fresh while the panel is open
setInterval(() => { if (brew.open && !brew.id) renderBrew(); }, 1000);

// ---------- decorating ----------
const TABS = [['all', 'All'], ['furniture', 'Furniture'], ['counter', 'Counter'], ['decor', 'Decor'], ['cat', 'For cats'], ...Object.entries(SETS), ['room', 'Walls & floors'], ['recipes', 'Recipes'], ['storage', 'Storage']];
function openBuild() {
  S.build = { tab: 'all', ghost: null, selectedId: null };
  $('#tray').hidden = false;
  $('.dock').style.display = 'none';
  renderTray();
  // keep the café in view above the tray
  renderer.offsetY = Math.round($('#tray').offsetHeight * renderer.dpr / 2);
  renderer.resize();
}
function closeBuild() {
  if (S.build?.preview) S.build.preview = null;
  S.build = null;
  $('#tray').hidden = true;
  $('.dock').style.display = '';
  renderer.offsetY = 0;
  renderer.resize();
}

function freeSpotFor(type, rot) {
  // somewhere near the middle of the screen that fits
  const [cx, cy] = renderer.toTile(renderer.canvas.width / 2, renderer.canvas.height / 2);
  let best = null, bd = Infinity;
  for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) {
    const g = { type, x, y, rot };
    if (!canPlace(S.cafe, g)) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (d < bd) { bd = d; best = g; }
  }
  return best || { type, x: Math.floor(cx), y: Math.floor(cy), rot };
}

function buildTap(ix, iy) {
  const b = S.build;
  if (b.ghost) {
    const [w, d] = footprint(b.ghost);
    b.ghost.x = Math.max(0, Math.min(ROOM_W - w, ix - Math.floor((w - 1) / 2)));
    b.ghost.y = Math.max(0, Math.min(ROOM_H - d, iy - Math.floor((d - 1) / 2)));
    sfx.click();
    return renderTray();
  }
  const it = furnitureAt(S.cafe, ix, iy);
  b.selectedId = it ? it.id : null;
  sfx.click();
  renderTray();
}

function renderTray() {
  const b = S.build;
  if (!b) return;
  const actions = $('#trayActions');
  const coin = iconImg('coin', 2);
  if (b.preview) {
    const kind = b.preview.wall ? 'wall' : 'floor', id = b.preview[kind];
    const st = (kind === 'wall' ? WALL_STYLES : FLOOR_STYLES)[id];
    const owned = S.cafe.decor.owned.includes(id), current = S.cafe.decor[kind] === id;
    actions.innerHTML = `<div class="label">${st.name}${owned ? '' : ` · ${coin} ${st.price}`}<br><small>${current ? 'This is what your café has now' : owned ? 'You own this one' : 'Have a look before you buy'}</small></div>`
      + `<button class="btn" data-a="unpreview">${iconImg('cross', 2)}</button>`
      + (current ? '' : `<button class="btn primary" data-a="usestyle">${iconImg('check', 2)}${owned ? 'Use' : 'Buy'}</button>`);
  } else if (b.ghost) {
    const def = CATALOG[b.ghost.type];
    const label = b.ghost.source === 'shop' ? `${def.name} · ${coin} ${def.price}` : b.ghost.source === 'storage' ? `${def.name} from storage` : `Moving ${def.name}`;
    actions.innerHTML = `<div class="label">${label}<br><small>Tap the floor to choose a spot</small></div>`
      + (def.rotates ? `<button class="btn" data-a="rot">${iconImg('rotate', 2)}Turn</button>` : '')
      + `<button class="btn" data-a="cancel">${iconImg('cross', 2)}</button>`
      + `<button class="btn primary" data-a="ok">${iconImg('check', 2)}${b.ghost.source === 'shop' ? 'Buy' : 'Place'}</button>`;
  } else if (b.selectedId) {
    const it = S.cafe.furniture.find((f) => f.id === b.selectedId);
    const def = it && CATALOG[it.type];
    if (!def) { b.selectedId = null; return renderTray(); }
    actions.innerHTML = `<div class="label">${def.name}</div>`
      + (def.rotates ? `<button class="btn" data-a="turn">${iconImg('rotate', 2)}Turn</button>` : '')
      + `<button class="btn" data-a="move">${iconImg('move', 2)}Move</button>`
      + (def.station ? '' : `<button class="btn" data-a="store">${iconImg('box', 2)}Store</button>`)
      + `<button class="btn primary" data-a="done">${iconImg('check', 2)}Done</button>`;
  } else {
    actions.innerHTML = `<div class="label">Pick something to buy, or tap furniture in the café to move it.</div><button class="btn primary" data-a="done">${iconImg('check', 2)}Done</button>`;
  }
  const tabs = $('#trayTabs'), scroll = tabs.scrollLeft;
  tabs.innerHTML = TABS.map(([k, n]) => `<button class="chip${b.tab === k ? ' on' : ''}" data-tab="${k}">${n}</button>`).join('');
  tabs.scrollLeft = scroll;
  if (b.tab === 'room') {
    const card = (kind, id) => {
      const st = (kind === 'wall' ? WALL_STYLES : FLOOR_STYLES)[id];
      const owned = S.cafe.decor.owned.includes(id), current = S.cafe.decor[kind] === id;
      const on = b.preview?.[kind] === id;
      return `<button class="item${on ? ' on' : ''}${!owned && st.price > S.cafe.money ? ' poor' : ''}" data-style="${id}" data-kind="${kind}">
        <div class="pic"><img src="${swatchFor(kind, id)}" alt=""></div><b>${st.name}</b>
        <span>${current ? 'In use' : owned ? 'Owned' : `${iconImg('coin', 1)}${st.price}`}</span></button>`;
    };
    $('#trayItems').innerHTML = `<div class="group">Walls</div>` + WALL_ORDER.map((id) => card('wall', id)).join('')
      + `<div class="group">Floors</div>` + FLOOR_ORDER.map((id) => card('floor', id)).join('');
    return;
  }
  if (b.tab === 'recipes') {
    const have = S.cafe.recipes || [];
    $('#trayItems').innerHTML = DRINK_ORDER.map((id) => {
      const d = DRINKS[id], owned = have.includes(id);
      return `<button class="recipe${owned ? ' have' : ''}" data-recipe="${id}"><img src="${cupCanvas(id, 1, false, 3).toDataURL()}" alt=""><b>${d.name}</b>
        <span>${owned ? 'On the menu' : `${iconImg('coin', 1)}${d.unlock}`}</span><span>sells for ${d.price}</span></button>`;
    }).join('');
    return;
  }
  let list;
  if (b.tab === 'storage') list = Object.entries(S.cafe.inventory || {}).map(([type, n]) => ({ type, n }));
  else list = SHOP_ORDER.filter((t) => b.tab === 'all' || CATALOG[t].cat === b.tab || CATALOG[t].set === b.tab).map((type) => ({ type }));
  $('#trayItems').innerHTML = list.length ? list.map(({ type, n }) => {
    const def = CATALOG[type];
    const poor = !n && def.price > S.cafe.money;
    return `<button class="item${poor ? ' poor' : ''}${b.ghost?.type === type ? ' on' : ''}" data-item="${type}" data-src="${n ? 'storage' : 'shop'}">
      <div class="pic"><img src="${iconFor(type)}" alt=""></div><b>${def.name}</b>
      <span>${n ? `×${n}` : `${iconImg('coin', 1)}${def.price}`}</span></button>`;
  }).join('') : '<p class="hint">Nothing in storage yet. Use "Store" on furniture to put it away.</p>';
}

const swatchCache = new Map();
function swatchFor(kind, id) {
  const k = kind + id;
  if (!swatchCache.has(k)) swatchCache.set(k, styleSwatch(kind, id).toCanvas().toDataURL());
  return swatchCache.get(k);
}

const iconCache = new Map();
function iconFor(type) {
  if (!iconCache.has(type)) {
    const c = renderer.icon(type), k = Math.max(1, Math.min(2, Math.floor(56 / c.height)));
    const out = document.createElement('canvas');
    out.width = c.width * k; out.height = c.height * k;
    const g = out.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, out.width, out.height);
    iconCache.set(type, out.toDataURL());
  }
  return iconCache.get(type);
}

$('#tray').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const b = S.build;
  sfx.click();
  if (btn.dataset.tab) { b.tab = btn.dataset.tab; b.ghost = null; b.preview = null; b.hideId = null; return renderTray(); }
  if (btn.dataset.style) {
    b.preview = { [btn.dataset.kind]: btn.dataset.style };
    return renderTray();
  }
  if (btn.dataset.a === 'unpreview') { b.preview = null; return renderTray(); }
  if (btn.dataset.a === 'usestyle') {
    const kind = b.preview.wall ? 'wall' : 'floor', id = b.preview[kind];
    const st = (kind === 'wall' ? WALL_STYLES : FLOOR_STYLES)[id], owned = S.cafe.decor.owned.includes(id);
    if (!owned && S.cafe.money < st.price) { toast('Not enough coins yet'); sfx.nope(); return; }
    act('build', { op: { op: 'style', kind, id } });
    if (!owned) sfx.coin(); else sfx.place();
    buzz(15);
    b.preview = null;
    return renderTray();
  }
  if (btn.dataset.recipe) {
    const id = btn.dataset.recipe, d = DRINKS[id];
    if ((S.cafe.recipes || []).includes(id)) return toast(`${d.name} is already on the menu`);
    if (S.cafe.money < d.unlock) { toast('Not enough coins yet'); sfx.nope(); return; }
    act('build', { op: { op: 'recipe', id } });
    sfx.coin(); toast(`${d.name} added to the menu!`);
    return;
  }
  if (btn.dataset.item) {
    const type = btn.dataset.item, src = btn.dataset.src;
    if (src === 'shop' && CATALOG[type].price > S.cafe.money) { toast('Not enough coins yet'); sfx.nope(); return; }
    b.selectedId = null;
    b.ghost = { ...freeSpotFor(type, 0), source: src, id: undefined };
    return renderTray();
  }
  const a = btn.dataset.a;
  if (a === 'done') return closeBuild();
  if (a === 'cancel') { b.ghost = null; b.hideId = null; return renderTray(); }
  if (a === 'rot') { b.ghost.rot = (b.ghost.rot + 1) % 4; return renderTray(); }
  if (a === 'ok') {
    const g = b.ghost;
    if (!canPlace(S.cafe, g, g.moving)) { toast("It doesn't fit there"); sfx.nope(); return; }
    const op = g.source === 'shop' ? { op: 'buy', type: g.type, x: g.x, y: g.y, rot: g.rot }
      : g.source === 'storage' ? { op: 'place', type: g.type, x: g.x, y: g.y, rot: g.rot }
      : { op: 'move', id: g.moving, x: g.x, y: g.y, rot: g.rot };
    act('build', { op });
    if (g.source === 'shop') sfx.coin(); else sfx.place();
    buzz(15);
    b.ghost = null; b.hideId = null;
    return renderTray();
  }
  const it = S.cafe.furniture.find((f) => f.id === b.selectedId);
  if (!it) return;
  if (a === 'turn') { act('build', { op: { op: 'move', id: it.id, x: it.x, y: it.y, rot: (it.rot + 1) % 4 } }); sfx.place(); }
  if (a === 'move') { b.ghost = { type: it.type, x: it.x, y: it.y, rot: it.rot, source: 'move', moving: it.id, id: it.id }; b.hideId = it.id; b.selectedId = null; renderTray(); }
  if (a === 'store') { act('build', { op: { op: 'store', id: it.id } }); b.selectedId = null; sfx.place(); renderTray(); }
});

// ---------- HUD ----------
function refreshHud() {
  if (!S.cafe) return;
  $('#cafeName').textContent = S.cafe.name;
  $('#money').textContent = S.cafe.money;
  const list = S.sim ? S.sim.roster() : S.roster;
  $('#playerList').innerHTML = list.map((p) => `<span><i style="background:${p.look?.shirt || '#888'}"></i>${escapeHtml(p.name || '')}</span>`).join('')
    + (S.role === 'host' ? `<span style="color:var(--lamp)">· ${S.code}</span>` : '');
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

$('#coinIcon').src = icon('coin', 3);
$('#btnMenu').innerHTML = iconImg('gear', 3);
$('#btnInvite').innerHTML = iconImg('friend', 3);
$('#btnBuild').innerHTML = `${iconImg('hammer', 4)}Decorate`;
$('#btnCats').innerHTML = `${iconImg('paw', 4)}Cats`;

$('#btnBuild').addEventListener('click', () => { sfx.click(); openBuild(); });
$('#btnCats').addEventListener('click', () => { sfx.click(); renderCats(); show('cats'); });
$('#catsClose').addEventListener('click', () => { sfx.click(); catsUi.editing = null; show('hud'); });
$('#btnInvite').addEventListener('click', () => {
  sfx.click();
  if (S.role === 'guest') { toast(`You're visiting your friend's café (${S.code})`); return; }
  show('invite');
  if (!S.host) startHosting();
});
$('#inviteClose').addEventListener('click', () => { sfx.click(); show('hud'); });
$('#inviteShare').addEventListener('click', async () => {
  const text = `Come help me run our cat café in Whiskers & Coffee! Join code: ${S.code}`;
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(S.code); toast('Code copied'); } } catch { /* cancelled */ }
});
$('#btnMenu').addEventListener('click', () => { sfx.click(); $('#pauseTitle').textContent = S.cafe?.name || 'Café'; $('#pauseSound').textContent = `Sound: ${prefs.sound ? 'on' : 'off'}`; show('pause'); });
$('#pauseClose').addEventListener('click', () => { sfx.click(); show('hud'); });
$('#pauseSound').addEventListener('click', () => { prefs.sound = !prefs.sound; savePrefs(); $('#pauseSound').textContent = `Sound: ${prefs.sound ? 'on' : 'off'}`; });
$('#pauseChar').addEventListener('click', () => { sfx.click(); openCharacter('pause'); });
$('#pauseLeave').addEventListener('click', () => { sfx.click(); leaveSession(); goMenu(); });

const MOOD_TEXT = { sleepy: 'Sleepy, loves warm spots', playful: 'Playful, always exploring', shy: 'Shy, takes time to trust', calm: 'Calm and friendly' };
const catsUi = { editing: null };
function drawCatInto(cv, coat, collar) {
  const s = catFrame('sit1', coat, false, collar || 'none');
  cv.width = s.w; cv.height = s.h;
  const g = cv.getContext('2d'); g.clearRect(0, 0, s.w, s.h); g.drawImage(s.canvas, 0, 0);
}
function renderCats() {
  const list = S.cafe.cats;
  upgradeCafe(S.cafe);
  $('#catList').innerHTML = list.map((c) => {
    const name = catsUi.editing === c.id
      ? `<span class="rename"><input id="catName" maxlength="12" value="${escapeHtml(c.name)}" autocomplete="off"><button class="chip on" data-a="savename" data-cat="${c.id}">OK</button></span>`
      : `<b>${escapeHtml(c.name)}</b><button class="chip mini" data-a="rename" data-cat="${c.id}">Rename</button>`;
    const collars = COLLAR_ORDER.map((k) => {
      const col = COLLARS[k], on = (c.collar || 'none') === k;
      return `<button class="sw tiny${on ? ' on' : ''}${k === 'none' ? ' none' : ''}" style="background:${col.color || 'transparent'}" data-a="collar" data-cat="${c.id}" data-collar="${k}" aria-label="${col.name}">${col.bell ? '<i></i>' : ''}</button>`;
    }).join('');
    return `<div class="cat-card"><canvas data-coat="${c.coat}" data-collar="${c.collar || 'none'}"></canvas>
      <div class="cat-info"><div class="cat-name">${name}</div><small>${MOOD_TEXT[c.mood] || ''}</small>
      <div class="meter"><i style="width:${c.affection || 0}%"></i></div>
      <div class="collars"><span>Collar</span>${collars}</div></div></div>`;
  }).join('');
  // the shelter: three cats looking for a home
  const full = list.length >= MAX_CATS, price = adoptPrice(S.cafe);
  $('#adoptList').innerHTML = full
    ? '<p class="hint">Your café is full of cats and love. Every one of them is home.</p>'
    : strays(S.cafe).map((c, i) => `<div class="cat-card stray"><canvas data-coat="${c.coat}" data-collar="none"></canvas>
      <div class="cat-info"><b>${escapeHtml(c.name)}</b><small>${MOOD_TEXT[c.mood]}</small>
      <button class="btn primary adopt${S.cafe.money < price ? ' poor' : ''}" data-a="adopt" data-pick="${i}">${iconImg('heart', 2)}Adopt ${iconImg('coin', 2)}${price}</button></div></div>`).join('');
  $('#adoptHead').textContent = full ? 'The shelter' : `Adopt a cat (${list.length}/${MAX_CATS})`;
  $$('#cats canvas[data-coat]').forEach((cv) => drawCatInto(cv, cv.dataset.coat, cv.dataset.collar));
  if (catsUi.editing) { const inp = $('#catName'); inp?.focus(); inp?.select(); }
}
$('#cats').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-a]');
  if (!btn) return;
  const a = btn.dataset.a, id = btn.dataset.cat;
  const cat = S.cafe.cats.find((c) => c.id === id);
  sfx.click();
  if (a === 'rename') { catsUi.editing = id; return renderCats(); }
  if (a === 'savename') return saveCatName();
  if (a === 'collar' && cat) {
    const k = btn.dataset.collar, col = COLLARS[k];
    if ((cat.collar || 'none') === k) return;
    if (S.cafe.money < col.price) { toast('Not enough coins yet'); sfx.nope(); return; }
    act('build', { op: { op: 'collar', id, collar: k } });
    if (col.price) { sfx.coin(); toast(`${cat.name} looks lovely! -${col.price}`); }
    return;
  }
  if (a === 'adopt') {
    const price = adoptPrice(S.cafe), pick = +btn.dataset.pick;
    if (S.cafe.money < price) { toast(`Adopting costs ${price} coins. Serve a few more drinks!`); sfx.nope(); return; }
    act('build', { op: { op: 'adopt', pick, id: uid('c') } });
    sfx.coin();
  }
});
function saveCatName() {
  const id = catsUi.editing, name = $('#catName')?.value.trim();
  catsUi.editing = null;
  if (id && name) act('build', { op: { op: 'catname', id, name } });
  renderCats();
}
$('#cats').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'catName') saveCatName(); });

// ---------- character creator ----------
let charReturn = 'menu';
function openCharacter(ret) {
  charReturn = ret;
  $('#nameInput').value = prefs.name;
  renderCharOptions();
  show('character');
}
function renderCharOptions() {
  const L = prefs.look;
  const sw = (id, list, key) => { $(id).innerHTML = list.map((c) => `<button class="sw${L[key] === c ? ' on' : ''}" style="background:${c}" data-key="${key}" data-val="${c}"></button>`).join(''); };
  sw('#skinRow', SKINS, 'skin');
  sw('#hairRow', HAIR_COLORS, 'hair');
  sw('#shirtRow', OUTFIT_COLORS, 'shirt');
  sw('#apronRow', ['#e8d7b0', '#5b3a26', '#3d4a6b', '#6d8a58', '#c9786f'], 'apronColor');
  $('#styleRow').innerHTML = HAIR_STYLES.map((s) => `<button class="chip${L.style === s ? ' on' : ''}" data-key="style" data-val="${s}">${s}</button>`).join('');
}
$('#character').addEventListener('click', (e) => {
  const b = e.target.closest('[data-key]');
  if (!b) return;
  prefs.look = { ...prefs.look, [b.dataset.key]: b.dataset.val };
  savePrefs(); sfx.click(); renderCharOptions();
});
let pendingStart = null;
$('#charDone').addEventListener('click', () => {
  prefs.name = $('#nameInput').value.trim().slice(0, 14) || 'Barista';
  prefs.made = true;
  savePrefs(); sfx.click();
  act('look', { name: prefs.name, look: prefs.look });
  if (charReturn === 'pause') show('hud');
  else if (charReturn === 'start') { goMenu(); const m = pendingStart; pendingStart = null; $(`[data-m="${m}"]`)?.click(); }
  else goMenu();
});
function drawCharPreview(now) {
  if (S.screen !== 'character') return;
  const cv = $('#charPreview'), g = cv.getContext('2d');
  const frame = Math.floor(now / 160) % 4;
  const s = personSprite(prefs.look, 'front', frame, false);
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(s.canvas, 0, 0);
}
(function loop(now) { requestAnimationFrame(loop); drawCharPreview(now); })(0);

// ---------- title screen ----------
function goMenu() {
  closeBuild();
  // a calm café behind the title: the last café, or a fresh one
  const c = lastCafe() || newCafe();
  S.cafe = c;
  S.role = null;
  S.sim = new Sim(c, () => {});
  renderer.userZoom = false; renderer.resize(); renderer.centre();
  const saved = lastCafe();
  $('#menuButtons').innerHTML = (saved ? `<button class="btn primary wide" data-m="continue">Open ${escapeHtml(saved.name)}</button>` : `<button class="btn primary wide" data-m="new">Open our café</button>`)
    + `<button class="btn" data-m="join">Join a friend</button>`
    + `<button class="btn" data-m="char">My character</button>`
    + (saved ? `<button class="btn wide" data-m="new">Start a new café</button>` : '');
  show('menu');
}
$('#menuButtons').addEventListener('click', (e) => {
  const m = e.target.closest('[data-m]')?.dataset.m;
  if (!m) return;
  sfx.click();
  if (!prefs.made && m !== 'char') { pendingStart = m; return openCharacter('start'); }
  if (m === 'continue') {
    const c = lastCafe();
    if (c?.guestOf) toast('Hosting this café from your phone now');
    playSolo(c);
  } else if (m === 'new') {
    if (lastCafe() && !confirmNew()) return;
    playSolo(newCafe(prefs.name ? `${prefs.name}'s Café` : 'Our Café'));
  } else if (m === 'join') { $('#joinStatus').textContent = ''; $('#codeInput').value = ''; show('join'); setTimeout(() => $('#codeInput').focus(), 50); }
  else if (m === 'char') openCharacter('menu');
});
let newArmed = 0;
function confirmNew() {
  if (Date.now() - newArmed < 3000) return true;
  newArmed = Date.now();
  toast('Tap again to start a fresh café (your old one stays saved)');
  return false;
}
$('#joinBack').addEventListener('click', () => { sfx.click(); leaveSession(); goMenu(); });
$('#codeInput').addEventListener('input', (e) => { e.target.value = cleanCode(e.target.value); });
$('#joinGo').addEventListener('click', () => {
  const code = cleanCode($('#codeInput').value);
  if (code.length !== 5) { $('#joinStatus').textContent = 'Codes have five letters'; return; }
  sfx.click();
  joinCafe(code);
});

// logo cat
{
  const s = catFrame('sit1', 'orange'), g = $('#logoCat').getContext('2d');
  $('#logoCat').width = s.w; $('#logoCat').height = s.h;
  g.drawImage(s.canvas, 0, 0);
}

// ---------- app lifecycle ----------
if (Plugins.StatusBar) Plugins.StatusBar.hide().catch(() => {});
if (Plugins.App) Plugins.App.addListener('backButton', () => {
  if (S.build) return closeBuild();
  if (['invite', 'cats', 'pause'].includes(S.screen)) return show('hud');
  if (S.screen === 'hud') return $('#btnMenu').click();
  if (S.screen === 'menu') return Plugins.App.exitApp();
  goMenu();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && S.cafe && S.role && S.role !== 'guest') saveCafe(S.cafe); });

goMenu();
requestAnimationFrame(frame);

// hooks for automated tests
window.__wc = { S, renderer, act, startHosting, joinCafe, playSolo, newCafe, goMenu, currentView, openBrew };
