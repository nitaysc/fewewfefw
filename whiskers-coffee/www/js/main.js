// Whiskers & Coffee: screens, input, building, saving and the co-op session.
import { Renderer } from './render.js';
import { Sim } from './game/sim.js';
import { newCafe, uid, footprint, canPlace, furnitureAt, tilesOf, ROOM_W, ROOM_H, strays, adoptPrice, MAX_CATS, upgradeCafe } from './game/world.js';
import { CATALOG, SHOP_ORDER, SETS } from './game/catalog.js';
import { WALL_STYLES, FLOOR_STYLES, WALL_ORDER, FLOOR_ORDER, styleSwatch } from './art/room.js';
import { HostSession, GuestSession, makeCode, cleanCode } from './net.js';
import { personSprite, randomLook, SKINS, HAIR_COLORS, HAIR_STYLES, OUTFIT_COLORS, PANTS_COLORS, SHOE_COLORS, EYE_STYLES, EYE_COLORS, TOPS, BOTTOMS, HATS, GLASSES } from './art/people.js';
import { DRINKS, DRINK_ORDER, cupCanvas, EXTRAS } from './art/drinks.js';
import { FOODS, FOOD_ORDER, plateCanvas, wantsText } from './art/foods.js';
import { Station, REFUSE_BELOW } from './brew/station.js';
import { Kitchen } from './brew/kitchen.js';
import { seededRng, customerName, clockText, OPEN_AT } from './game/customers.js';
import { catFrame, COLLARS, COLLAR_ORDER } from './art/cats.js';
import { icon, iconImg } from './ui/icons.js';
import { t, tr, setLang, getLang, LANGUAGES, translatePage } from './i18n.js';
import { loadRefs, refImg, MODELS, MODEL_ORDER, CUSTOMER_MODELS, catPose } from './art/refsprites.js';
import { loadR3, r3, r3Ready, modelFor, personFrame, catFrame3 } from './art/r3.js';

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
  look: { model: 'catear', skin: SKINS[2], hair: HAIR_COLORS[1], style: 'bob', eyes: 'dot', eyeColor: EYE_COLORS[0], top: 'tee', shirt: OUTFIT_COLORS[2], bottom: 'pants', pants: '#2f3f4a', shoes: SHOE_COLORS[0], apron: true, apronColor: '#e8d7b0' },
  sound: true,
  lang: (navigator.language || '').startsWith('ru') ? 'ru' : 'en',
}, store.get('wc-prefs', {}));
const savePrefs = () => store.set('wc-prefs', prefs);
savePrefs();
setLang(prefs.lang);
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
  day: null,              // guest: the day as last heard from the host
};

const renderer = new Renderer($('#game'));
window.addEventListener('resize', () => renderer.resize());

// ---------- sound: soft synthesized café noises ----------
let actx;
function tone(f, d, type = 'sine', v = 0.08, slide = 0) {
  if (!prefs.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), at = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(f, at);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), at + d);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + d);
    o.connect(g).connect(actx.destination); o.start(at); o.stop(at + d + 0.05);
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
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function show(id) {
  for (const el of $$('.screen')) el.classList.toggle('show', el.id === id || (el.id === 'hud' && ['hud', 'invite', 'cats', 'pause', 'dayEnd'].includes(id)));
  S.screen = id;
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- starting and joining ----------
function startSim(cafe) {
  S.sim = new Sim(cafe, onSimEvent);
  S.sim.addPlayer(S.myId, prefs.name, prefs.look);
}

function playSolo(cafe) {
  leaveSession();
  upgradeCafe(cafe);
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
  if (dayPhase() === 'closed') showDayEnd();
}

function startHosting() {
  if (S.role === 'guest' || S.host) return;
  const code = makeCode();
  S.code = code;
  $('#inviteCode').textContent = code;
  $('#inviteStatus').textContent = t('Opening your café to friends…');
  S.host = new HostSession(code, {
    onOpen: () => { S.role = 'host'; $('#inviteStatus').textContent = t('Waiting for your friend to join…'); refreshHud(); },
    onJoin: () => { $('#inviteStatus').textContent = t('Your friend is connected!'); },
    onMessage: onHostMessage,
    onLeave: (id) => { if (S.sim) { const p = S.sim.players.get(id); S.sim.removePlayer(id); if (p) toast(t('{name} left the café', { name: p.name })); } },
    onError: (e) => { $('#inviteStatus').textContent = t(e); S.host?.close(); S.host = null; S.role = 'solo'; },
  });
}

// one place that applies a player's action on the host, for the host itself and for guests
function hostAct(pid, kind, m) {
  const sim = S.sim, shop = sim.shop;
  switch (kind) {
    case 'move': sim.movePlayer(pid, +m.x, +m.y); return null;
    case 'pet': sim.petCat(pid, m.cat); return null;
    case 'build': return sim.build(m.op, pid);
    case 'claim': return shop.claim(pid, m.id, m.idx);
    case 'unclaim': return shop.unclaim(pid, m.id, m.idx);
    case 'brewed': return shop.brewed(pid, m.id, m.idx, m.q);
    case 'serve': return shop.serve(pid, m.id);
    case 'drop': return shop.drop(pid);
    case 'tip': return shop.collectTip(pid, m.id);
    case 'nextDay': return shop.nextDay();
    case 'closeEarly': return shop.closeEarly();
    case 'look': {
      const p = sim.players.get(pid);
      if (p) { p.name = String(m.name || p.name).slice(0, 14); p.look = m.look || p.look; sim.emit('roster'); }
      return null;
    }
  }
  return null;
}

function onHostMessage(id, m) {
  const sim = S.sim;
  if (!sim || !m || typeof m !== 'object') return;
  if (m.t === 'hello') {
    sim.addPlayer(id, String(m.name || 'Friend').slice(0, 14), m.look || prefs.look);
    S.host.send(id, { t: 'welcome', you: id, cafe: S.cafe, roster: sim.roster(), code: S.code });
    toast(t('{name} joined the café!', { name: m.name || t('Your friend') }));
    sfx.bell();
    return;
  }
  const err = hostAct(id, m.t, m);
  if (err) S.host.send(id, { t: 'toast', text: err });
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
  $('#joinStatus').textContent = t('Connecting…');
  $('#joinGo').disabled = true;
  S.role = 'guest';
  S.code = code;
  S.guest = new GuestSession(code, {
    onOpen: () => {
      $('#joinStatus').textContent = t('Connected! Opening the café…');
      $('#netBanner').hidden = true;
      S.guest.send({ t: 'hello', name: prefs.name, look: prefs.look });
    },
    onMessage: onGuestMessage,
    onClose: () => { if (S.screen !== 'menu') { $('#netBanner').hidden = false; $('#netBanner').textContent = t('Connection lost, reconnecting…'); } },
    onError: (e) => { $('#joinStatus').textContent = t(e); $('#joinGo').disabled = false; if (S.screen !== 'join') toast(t(e)); },
  });
}

function onGuestMessage(m) {
  if (!m || typeof m !== 'object') return;
  switch (m.t) {
    case 'welcome':
      S.myId = m.you; S.cafe = upgradeCafe(m.cafe); S.roster = m.roster; S.snaps = [];
      saveCafe(S.cafe, { guestOf: m.code });
      $('#joinGo').disabled = false;
      if (S.screen === 'join' || S.screen === 'menu') enterCafe();
      refreshHud();
      break;
    case 'snap':
      S.snaps.push({ at: performance.now(), ...m });
      if (S.snaps.length > 6) S.snaps.shift();
      if (S.cafe && m.m !== S.cafe.money) { S.cafe.money = m.m; refreshHud(); }
      if (m.d) S.day = { n: m.d[0], min: m.d[1], phase: m.d[2], rain: !!m.d[3] };
      break;
    case 'cafe':
      S.cafe = upgradeCafe(m.cafe);
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
    case 'toast': toast(tr(m.text)); sfx.nope(); break;
  }
}

function fxFeedback(f) {
  const mine = f.by === S.myId;
  if (f.kind === 'hearts' && mine) { sfx.purr(); buzz(25); toast(t('{name} purrs happily', { name: f.name })); }
  if (f.kind === 'bell') sfx.bell();
  if (f.kind === 'coins') {
    sfx.coin();
    if (mine) { buzz(30); toast(f.tip ? t('Tip collected! +{n}', { n: f.amount }) : f.stars === 3 ? t('Perfect! {name} loves it! +{n}', { name: f.name, n: f.amount }) : t('{name} loves it! +{n}', { name: f.name, n: f.amount })); }
  }
  if (f.kind === 'flash') tone(2400, 0.05, 'square', 0.03);
  if (f.kind === 'adopted') { sfx.meow(); buzz(30); toast(t('Welcome home, {name}!', { name: f.name })); }
  if (f.kind === 'refused' && mine) { sfx.nope(); toast(tr(f.text)); }
  if (f.kind === 'closing') { sfx.bell(); toast(t('Closing time! No new customers. Serve the last ones')); }
  if (f.kind === 'dayEnd') { S.lastToday = f.today; setTimeout(showDayEnd, 600); }
  if (f.kind === 'dayStart') { if (S.screen === 'dayEnd') show('hud'); sfx.bell(); toast(t('Day {n} begins. Good morning!', { n: f.day })); }
}

function leaveSession() {
  S.host?.close(); S.guest?.close();
  S.host = S.guest = null;
  if (S.sim && S.cafe && S.role && S.role !== 'guest') saveCafe(S.cafe);
  S.sim = null; S.role = null; S.snaps = []; S.code = null; S.day = null;
  closeBuild();
  station.hide(); kitchen.hide(); closeBrew();
}

// ---------- actions: applied locally by the host, sent as requests by a guest ----------
function act(kind, data = {}) {
  if (S.role === 'guest') return S.guest?.send({ t: kind, ...data });
  if (!S.sim) return null;
  const err = hostAct(S.myId, kind, data);
  if (err) { toast(tr(err)); sfx.nope(); }
  return err;
}

// ---------- the day ----------
const dayNow = () => (S.role === 'guest' ? S.day : S.cafe?.day) || { n: 1, min: 0, phase: 'open', rain: true };
const dayPhase = () => dayNow().phase;
function skyFor(d) {
  const h = (OPEN_AT + d.min) / 60;
  if (d.phase === 'closed') return { tint: 'rgba(12,16,44,0.6)', dark: 0.3, rain: d.rain };
  if (h >= 20) return { tint: 'rgba(40,40,96,0.5)', dark: 0.22, rain: d.rain };
  if (h >= 18.5) return { tint: 'rgba(240,120,90,0.4)', dark: 0.12, rain: d.rain, sun: d.rain ? null : '#ffb070', sunY: 0.75 };
  if (h >= 16) return { tint: 'rgba(255,190,110,0.32)', dark: 0.05, rain: d.rain, sun: d.rain ? null : '#ffe090', sunY: 0.5 };
  if (h < 10) return { tint: 'rgba(255,214,170,0.3)', dark: 0, rain: d.rain, sun: d.rain ? null : '#fff0c0', sunY: 0.65 };
  return { tint: d.rain ? 'rgba(140,160,190,0.3)' : 'rgba(150,205,255,0.45)', dark: 0, rain: d.rain, sun: d.rain ? null : '#fff6d0', sunY: 0.2 };
}
function refreshClock() {
  const d = dayNow();
  const label = d.phase === 'closed' ? t('Closed') : d.phase === 'closing' ? t('Closing') : clockText(d.min);
  $('#clock').innerHTML = `${iconImg(d.phase === 'open' && (OPEN_AT + d.min) / 60 < 18.5 ? 'sun' : 'moon', 2)}<span>${t('Day {n}', { n: d.n })}</span><b>${label}</b>`;
}
function showDayEnd() {
  if (!S.cafe || !S.role) return;
  const d = dayNow(), today = (S.role === 'guest' ? S.lastToday : S.cafe.day.today) || S.lastToday || { served: 0, earned: 0, tips: 0, perfect: 0 };
  $('#dayTitle').textContent = t('Day {n} is done!', { n: d.n });
  const row = (label, v, ic) => `<div><span>${ic ? iconImg(ic, 2) : ''}${label}</span><b>${v}</b></div>`;
  $('#dayStats').innerHTML = row(t('Orders served'), today.served) + row(t('Perfect orders'), today.perfect, 'star')
    + row(t('Coins from orders'), today.earned, 'coin') + row(t('Tips collected'), today.tips, 'coin') + `<div class="total"><span>${t('Total today')}</span><b>${today.earned + today.tips}</b></div>`;
  $('#dayHint').textContent = (S.cafe.tips || []).length ? t('Tips are still waiting on the tables. You can pick them up tomorrow.') : t('The cats are asleep and the café is quiet. Ready for tomorrow?');
  $('#dayNext').textContent = t('Open day {n}', { n: d.n + 1 });
  show('dayEnd');
}
$('#dayNext').addEventListener('click', () => { sfx.click(); act('nextDay'); if (S.role !== 'guest') show('hud'); });

// ---------- the view each frame ----------
const lookCache = new Map();
function lookFor(seed) {
  if (!lookCache.has(seed)) {
    // most customers are characters from the reference art; some are mixed from parts
    const rng = seededRng(seed), L = randomLook(rng);
    if (rng() < 0.8) L.model = CUSTOMER_MODELS[Math.floor(rng() * CUSTOMER_MODELS.length)];
    lookCache.set(seed, L);
  }
  return lookCache.get(seed);
}
function whoIs(id) {
  if (!id) return null;
  if (S.sim) { const p = S.sim.players.get(id); return p ? { name: p.name, color: p.look?.shirt } : null; }
  const r = S.roster.find((x) => x.id === id);
  return r ? { name: r.name, color: r.look?.shirt } : null;
}
const itemView = (i) => { const w = whoIs(i.by); return { ...i, byName: w && i.by !== S.myId ? w.name : i.by === S.myId ? t('You') : null, byColor: w?.color }; };

function currentView(now) {
  const cafe = S.cafe;
  let players = [], cats = [], customers = [], tips = [];
  const catData = new Map(cafe.cats.map((c) => [c.id, c]));
  if (S.sim) {
    players = [...S.sim.players.values()].map((p) => ({ ...p, carry: p.carry ? (p.carry.kind === 'food' ? 'f:' : '') + p.carry.id : null, carryExtra: p.carry?.extra || '', me: p.id === S.myId }));
    cats = [...S.sim.cats.values()].map((c) => ({ ...c, coat: catData.get(c.id)?.coat, name: catData.get(c.id)?.name, collar: catData.get(c.id)?.collar }));
    customers = [...S.sim.shop.list.values()].map((u) => ({ id: u.id, x: u.x, y: u.y, z: u.z, view: u.view, flip: u.flip, state: u.state, seed: u.seed, emote: u.emote, moving: u.moving, look: lookFor(u.seed), name: u.name, items: u.items.map(itemView), table: u.seat.table ? [u.seat.table.x, u.seat.table.y, u.seat.table.z] : null }));
    tips = cafe.tips || [];
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
      players.push({ id: p[0], x: lerp(q[1], p[1]), y: lerp(q[2], p[2]), view: p[3] ? 'back' : 'front', flip: !!p[4], moving: !!p[5], carry: p[6] || null, carryExtra: p[7] || '', name: r?.name, look: r?.look || prefs.look, me: p[0] === S.myId });
    }
    const ua = new Map((a.u || []).map((u) => [u[0], u]));
    for (const u of b.u || []) {
      const q = ua.get(u[0]) || u;
      const items = (u[8] || []).map((i) => itemView({ kind: i[0] ? 'food' : 'drink', id: i[1], extra: i[2] || '', by: i[3] || null, done: !!i[4] }));
      customers.push({ id: u[0], x: lerp(q[1], u[1]), y: lerp(q[2], u[2]), z: u[3], view: u[4] ? 'back' : 'front', flip: !!u[5], state: u[6], seed: u[7], items, emote: u[9] || null, moving: !!u[10], look: lookFor(u[7]), name: customerName(u[7]), table: u[11] || null });
    }
    const ca = new Map(a.c.map((c) => [c[0], c]));
    for (const c of b.c) {
      const q = ca.get(c[0]) || c, d = catData.get(c[0]);
      cats.push({ id: c[0], x: lerp(q[1], c[1]), y: lerp(q[2], c[2]), z: lerp(q[3], c[3]), state: c[4], flip: !!c[5], coat: d?.coat, name: d?.name, collar: d?.collar });
    }
    tips = (b.tp || []).map((x) => ({ id: x[0], x: x[1], y: x[2], z: x[3], amount: x[4] }));
  }
  return { cafe, players, cats, customers, tips, build: S.build, time: now / 1000, sky: skyFor(dayNow()) };
}

// the simulation and networking tick on a timer, so the café keeps running for a guest
// even when the host's screen isn't drawing
let last = performance.now(), snapAt = 0, saveAt = 0, clockAt = 0;
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (S.sim) S.sim.step(dt);
  if (S.host && S.host.count && now - snapAt > 90) { snapAt = now; S.host.broadcast({ t: 'snap', ...S.sim.snapshot() }); }
  if (S.dirty && now - saveAt > 4000 && S.cafe && S.role && S.role !== 'guest') { saveAt = now; S.dirty = false; saveCafe(S.cafe); }
  if (now - clockAt > 500 && S.cafe && S.screen !== 'menu') { clockAt = now; refreshClock(); if (brew.open) renderBrew(); }
}, 33);
let shownMoney = null;
function frame(now) {
  requestAnimationFrame(frame);
  if (!S.cafe || station.open || kitchen.open) return;
  renderer.draw(currentView(now));
  if (S.cafe.money !== shownMoney) { shownMoney = S.cafe.money; $('#money').textContent = shownMoney; }
}

// ---------- touch: tap to walk or pet, drag to look around, pinch to zoom ----------
// while decorating: press and hold furniture (or just drag it) to pick it up and move it
const pointers = new Map();
let gesture = null;
const canvas = $('#game');
const tileUnder = (x, y) => { const [tx, ty] = renderer.toTile(x * renderer.dpr, y * renderer.dpr); return [Math.floor(tx), Math.floor(ty)]; };
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
  if (pointers.size === 1) {
    gesture = { kind: 'tap', moved: 0, cam: { ...renderer.cam }, t0: performance.now() };
    const b = S.build;
    if (b) {
      const [ix, iy] = tileUnder(e.clientX, e.clientY);
      if (b.ghost && tilesOf(b.ghost).some(([a, c]) => a === ix && c === iy)) gesture = { kind: 'ghost', off: [ix - b.ghost.x, iy - b.ghost.y], moved: 0 };
      else if (!b.ghost) {
        const it = furnitureAt(S.cafe, ix, iy);
        if (it) {
          gesture = { kind: 'press', item: it, moved: 0, cam: { ...renderer.cam }, off: [ix - it.x, iy - it.y] };
          const g = gesture;
          setTimeout(() => { if (gesture === g && g.kind === 'press') liftItem(g); }, 320);
        }
      }
    }
  }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: renderer.zoom };
  }
});
function liftItem(g) {
  const b = S.build, it = g.item;
  if (!b || !S.cafe.furniture.includes(it)) return;
  b.ghost = { type: it.type, x: it.x, y: it.y, rot: it.rot, source: 'move', moving: it.id, id: it.id };
  b.hideId = it.id; b.selectedId = null;
  g.kind = 'ghost'; g.lifted = true;
  buzz(15); sfx.click();
  renderTray();
}
function moveGhostTo(ix, iy, off = [0, 0]) {
  const g = S.build?.ghost;
  if (!g) return;
  const [w, d] = footprint(g);
  const nx = Math.max(0, Math.min(ROOM_W - w, ix - off[0])), ny = Math.max(0, Math.min(ROOM_H - d, iy - off[1]));
  if (nx !== g.x || ny !== g.y) { g.x = nx; g.y = ny; tone(1200, 0.02, 'triangle', 0.02); }
}
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || !gesture) return;
  const dpr = renderer.dpr;
  p.x = e.clientX; p.y = e.clientY;
  if (gesture.kind === 'pinch' && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const zr = gesture.z0 * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0, z = r3Ready() ? Math.round(zr / 2) * 2 : Math.round(zr);
    renderer.zoom = Math.max(2, Math.min(12, z));
    renderer.userZoom = true;
    return;
  }
  const dx = (p.x - p.x0) * dpr, dy = (p.y - p.y0) * dpr;
  gesture.moved = Math.max(gesture.moved, Math.hypot(dx, dy));
  if (gesture.kind === 'press' && gesture.moved > 10 * dpr) liftItem(gesture);
  if (gesture.kind === 'ghost') { const [ix, iy] = tileUnder(p.x, p.y); moveGhostTo(ix, iy, gesture.off); return; }
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
  if (gesture.kind === 'press' && pointers.size === 0) tap(p.x * renderer.dpr, p.y * renderer.dpr);
  if (gesture.kind === 'ghost' && (gesture.moved > 6 || gesture.lifted)) commitGhost(true);
  if (pointers.size === 0) gesture = null;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); gesture = null; });
canvas.addEventListener('wheel', (e) => { renderer.zoom = Math.max(2, Math.min(12, renderer.zoom + (e.deltaY < 0 ? 1 : -1) * (r3Ready() ? 2 : 1))); renderer.userZoom = true; }, { passive: true });

function tap(sx, sy) {
  if (S.screen !== 'hud' || !S.cafe) return;
  const [tx, ty] = renderer.toTile(sx, sy);
  const ix = Math.floor(tx), iy = Math.floor(ty);
  if (S.build) return buildTap(ix, iy);
  const v = currentView(performance.now());
  const tip = renderer.tipAt(v.tips, sx, sy);
  if (tip) { act('tip', { id: tip.id }); return; }
  const cust = renderer.personAt(v.customers, sx, sy);
  if (cust) return tapCustomer(cust, v);
  const hit = furnitureAt(S.cafe, ix, iy, false);
  if (hit && (CATALOG[hit.type].station || hit.type === 'pastry')) return openBrew();
  const cat = renderer.catAt(v.cats, sx, sy);
  if (cat) { act('pet', { cat: cat.id }); sfx.meow(); return; }
  if (ix >= 0 && iy >= 0 && ix < ROOM_W && iy < ROOM_H) { act('move', { x: ix + 0.5, y: iy + 0.5 }); sfx.click(); }
}

// ---------- orders, serving, the barista station and the kitchen ----------
const myPlayer = (v) => v.players.find((p) => p.me);
const itemTitle = (i) => (i.kind === 'food' ? t(FOODS[i.id].name) + (i.extra ? ' + ' + wantsText(i.extra, t) : '') : t(DRINKS[i.id].name) + (i.extra ? ' + ' + t(EXTRAS[i.extra].name) : ''));
const itemPic = (i, s = 3) => (i.kind === 'food' ? plateCanvas(i.id, s) : cupCanvas(i.id, i.extra, s)).toDataURL();
const carryMatches = (me, i) => me?.carry && !i.done && (i.kind === 'food' ? me.carry === 'f:' + i.id && (me.carryExtra || '') === (i.extra || '') : me.carry === i.id && (me.carryExtra || '') === (i.extra || ''));

function tapCustomer(u, v) {
  const me = myPlayer(v);
  if (u.state === 'order') {
    if (u.items.some((i) => carryMatches(me, i))) { act('serve', { id: u.id }); sfx.click(); return; }
    if (me?.carry) { toast(t('{name} would like: {what}', { name: u.name, what: u.items.filter((i) => !i.done).map(itemTitle).join(', ') })); sfx.nope(); return; }
    return openBrew(u.id);
  }
  if (u.state === 'drink') toast(t('{name} is enjoying their order', { name: u.name }));
  else if (u.state === 'enter') toast(t('{name} is finding a seat', { name: u.name }));
}

const brew = { open: false, only: null };
function openBrew(only = null) {
  brew.open = true; brew.only = only;
  $('#brew').hidden = false;
  $('#brewClose').innerHTML = iconImg('cross', 2);
  renderBrew();
}
function closeBrew() { brew.open = false; $('#brew').hidden = true; }
$('#brewClose').addEventListener('click', () => { sfx.click(); closeBrew(); });

function renderBrew() {
  if (!brew.open || !S.cafe) return;
  const v = currentView(performance.now()), me = myPlayer(v);
  $('#brewTitle').textContent = t('Orders');
  let html = '';
  if (me?.carry) {
    const pic = me.carry.startsWith('f:') ? plateCanvas(me.carry.slice(2), 4) : cupCanvas(me.carry, me.carryExtra, 4);
    html += `<div class="holding"><img src="${pic.toDataURL()}" alt=""><p class="hint">${t('You are holding something. Tap the customer who ordered it to serve.')}</p><button class="btn small-btn" data-drop>${t('Throw it away')}</button></div>`;
  }
  const list = v.customers.filter((u) => u.state === 'order' && (!brew.only || u.id === brew.only));
  html += list.length ? list.map((u) => `<div class="order-card"><b class="who">${escapeHtml(u.name)}</b>${u.items.map((i, idx) => {
    const mineNow = i.by === S.myId, taken = i.by && !mineNow;
    const status = i.done ? `<small class="ok">${t('Served')}</small>` : taken ? `<small>${t('{name} is making it', { name: escapeHtml(i.byName || t('Your friend')) })}</small>` : mineNow ? `<small class="ok">${t('You are making it')}</small>` : '';
    return `<button class="order${taken || i.done ? ' taken' : ''}" data-order="${u.id}" data-idx="${idx}" ${i.done ? 'disabled' : ''}><img src="${itemPic(i)}" alt=""><div><b>${itemTitle(i)}</b>${status}</div></button>`;
  }).join('')}</div>`).join('') : `<p class="hint">${t('No orders right now. Customers drop by every little while; enjoy the cats meanwhile.')}</p>`;
  $('#brewBody').innerHTML = html;
}

let making = null;
function startOrder(id, idx) {
  const v = currentView(performance.now()), u = v.customers.find((c) => c.id === id), it = u?.items[idx];
  if (!it || it.done) return renderBrew();
  if (it.by && it.by !== S.myId) { toast(t('Your friend is already making that one')); sfx.nope(); return renderBrew(); }
  if (myPlayer(v)?.carry) { toast(t('Your hands are full: serve what you are holding first')); sfx.nope(); return; }
  const err = act('claim', { id, idx });
  if (err) return renderBrew();
  closeBrew();
  making = { id, idx, kind: it.kind, name: u.name };
  if (it.kind === 'food') kitchen.start(it.id, u.name, it.extra); else station.start(it.id, it.extra, u.name);
}
$('#brew').addEventListener('click', (e) => {
  if (e.target.closest('[data-drop]')) { sfx.click(); act('drop'); renderBrew(); return; }
  const o = e.target.closest('[data-order]');
  if (o && !o.disabled) { sfx.click(); startOrder(o.dataset.order, +o.dataset.idx); }
});

// both counters share one layout
function shell(root, wipeLabel) {
  root.innerHTML = `<aside class="st-card"><b class="st-title"></b><small class="st-for"></small><ol class="st-steps"></ol>
    <div class="st-buttons"><button class="btn primary st-serve"></button><button class="btn st-wipe"></button><button class="btn st-bin"></button></div><div class="st-end"></div></aside>
    <div class="st-main"><div class="st-stage"><canvas></canvas></div><div class="st-hint"></div></div>
    <aside class="st-side"><div class="st-sidehead"><div class="st-tabs"></div><button class="sq small st-close" aria-label="Close"></button></div><div class="st-tools"></div></aside>`;
  const q = (s) => root.querySelector(s);
  return { root, canvas: q('canvas'), title: q('.st-title'), for: q('.st-for'), needs: q('.st-steps'), end: q('.st-end'), hint: q('.st-hint'), close: q('.st-close'), tabs: q('.st-tabs'), tools: q('.st-tools'), serve: q('.st-serve'), wipe: q('.st-wipe'), bin: q('.st-bin'), wipeLabel };
}
function labelShell(els) {
  els.serve.innerHTML = `${iconImg('check', 2)}${t('Serve')}`;
  els.wipe.innerHTML = `${iconImg(els.wipeLabel === 'Undo' ? 'back' : 'rag', 2)}${t(els.wipeLabel)}`;
  els.bin.innerHTML = `${iconImg('bin', 2)}${t('Bin')}`;
  els.close.innerHTML = iconImg('cross', 2);
}
const stationEls = shell($('#station'), 'Wipe'), kitchenEls = shell($('#kitchen'), 'Undo');
const counterHooks = {
  sound: stationSound,
  toast,
  done(q) {
    act('brewed', { id: making.id, idx: making.idx, q });
    sfx.coin(); buzz(25);
    toast(q < REFUSE_BELOW ? t('Hmm, that one did not turn out right. {name} may ask again', { name: making.name }) : t('Ready! Tap {name} to serve', { name: making.name }));
  },
  close() { sfx.click(); if (making) act('unclaim', { id: making.id, idx: making.idx }); },
};
const station = new Station(stationEls, counterHooks);
const kitchen = new Kitchen(kitchenEls, counterHooks);
labelShell(stationEls); labelShell(kitchenEls);
document.documentElement.style.setProperty('--star-on', `url(${icon('star', 2)})`);
document.documentElement.style.setProperty('--star-off', `url(${icon('starOff', 2)})`);

function stationSound(k) {
  const noise = (n, f, v, gap) => { for (let i = 0; i < n; i++) setTimeout(() => tone(f + Math.random() * f * 0.4, 0.04, 'triangle', v), i * gap); };
  if (k === 'click') sfx.click();
  else if (k === 'nope') sfx.nope();
  else if (k === 'grind') noise(3, 140, 0.03, 40);
  else if (k === 'stir') tone(900 + Math.random() * 200, 0.05, 'sine', 0.02);
  else if (k === 'tamp') { tone(110, 0.12, 'square', 0.05); buzz(30); }
  else if (k === 'tick-shot' || k.startsWith('tick-cold') || k === 'tick-water' || k === 'tick-pourmilk') tone(260 + Math.random() * 60, 0.12, 'sine', 0.025, -80);
  else if (k === 'tick-steam' || k === 'tick-froth') noise(2, 2200, 0.012, 30);
  else if (k === 'tick-cream') tone(1600, 0.06, 'sawtooth', 0.01, -400);
  else if (k === 'shake' || k === 'wipe') noise(3, k === 'wipe' ? 900 : 3000, 0.015, 25);
  else if (k === 'plop' || k === 'pump') tone(500, 0.12, 'sine', 0.05, -250);
  else if (k === 'ice' || k === 'clink' || k === 'plate') tone(1900 + Math.random() * 400, 0.06, 'square', 0.02);
  else if (k === 'mash' || k === 'drop') tone(160, 0.1, 'triangle', 0.05, -60);
  else if (k === 'pour') tone(320, 0.6, 'sine', 0.025, -140);
  else if (k === 'spill') { tone(240, 0.3, 'sawtooth', 0.03, -120); buzz(40); }
  else if (k === 'bin') { tone(140, 0.2, 'square', 0.04, -60); buzz(30); }
  else if (k === 'step') { tone(880, 0.08, 'triangle', 0.05); buzz(12); }
  else if (k === 'perfect') { tone(1046, 0.1, 'triangle', 0.05); setTimeout(() => tone(1318, 0.1, 'triangle', 0.05), 90); setTimeout(() => tone(1568, 0.16, 'triangle', 0.05), 180); buzz(20); }
  else if (k === 'done') sfx.bell();
}

// ---------- decorating ----------
const TABS = () => [['all', 'All'], ['furniture', 'Furniture'], ['counter', 'Counter'], ['decor', 'Decor'], ['cat', 'For cats'], ...Object.entries(SETS), ['room', 'Walls & floors'], ['recipes', 'Menu'], ['storage', 'Storage']];
function openBuild() {
  S.build = { tab: 'all', ghost: null, selectedId: null, folded: false };
  $('#tray').hidden = false;
  $('.dock').style.display = 'none';
  renderTray();
}
function closeBuild() {
  S.build = null;
  $('#tray').hidden = true;
  $('.dock').style.display = '';
  renderer.offsetY = 0;
  renderer.resize();
}
function fitTray() {
  // keep the café in view above the tray
  renderer.offsetY = Math.round($('#tray').offsetHeight * renderer.dpr / 2);
  renderer.resize();
}

function freeSpotFor(type, rot) {
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
  if (b.ghost) { moveGhostTo(ix, iy, [Math.floor((footprint(b.ghost)[0] - 1) / 2), Math.floor((footprint(b.ghost)[1] - 1) / 2)]); sfx.click(); return renderTray(); }
  const it = furnitureAt(S.cafe, ix, iy);
  b.selectedId = it ? it.id : null;
  sfx.click();
  renderTray();
}

// place the item being moved or bought; `dragged` means the finger just let go of it
function commitGhost(dragged = false) {
  const b = S.build, g = b?.ghost;
  if (!g) return;
  if (!canPlace(S.cafe, g, g.moving)) { if (dragged) { toast(t("It doesn't fit there")); sfx.nope(); } renderTray(); return; }
  const op = g.source === 'shop' ? { op: 'buy', type: g.type, x: g.x, y: g.y, rot: g.rot }
    : g.source === 'storage' ? { op: 'place', type: g.type, x: g.x, y: g.y, rot: g.rot }
    : { op: 'move', id: g.moving, x: g.x, y: g.y, rot: g.rot };
  act('build', { op });
  if (g.source === 'shop') sfx.coin(); else sfx.place();
  buzz(15);
  b.ghost = null; b.hideId = null;
  renderTray();
}

function renderTray() {
  const b = S.build;
  if (!b) return;
  upgradeCafe(S.cafe);
  const actions = $('#trayActions');
  const coin = iconImg('coin', 2);
  const fold = `<button class="btn fold" data-a="fold" aria-label="fold">${iconImg(b.folded ? 'up' : 'down', 2)}</button>`;
  if (b.preview) {
    const kind = b.preview.wall ? 'wall' : 'floor', id = b.preview[kind];
    const st = (kind === 'wall' ? WALL_STYLES : FLOOR_STYLES)[id];
    const owned = S.cafe.decor.owned.includes(id), current = S.cafe.decor[kind] === id;
    actions.innerHTML = `<div class="label">${t(st.name)}${owned ? '' : ` · ${coin} ${st.price}`}<br><small>${current ? t('This is what your café has now') : owned ? t('You own this one') : t('Have a look before you buy')}</small></div>`
      + `<button class="btn" data-a="unpreview">${iconImg('cross', 2)}</button>`
      + (current ? '' : `<button class="btn primary" data-a="usestyle">${iconImg('check', 2)}${owned ? t('Use') : t('Buy')}</button>`) + fold;
  } else if (b.ghost) {
    const def = CATALOG[b.ghost.type];
    const label = b.ghost.source === 'shop' ? `${t(def.name)} · ${coin} ${def.price}` : b.ghost.source === 'storage' ? t('{name} from storage', { name: t(def.name) }) : t('Moving {name}', { name: t(def.name) });
    actions.innerHTML = `<div class="label">${label}<br><small>${t('Drag it where you like')}</small></div>`
      + (def.rotates ? `<button class="btn" data-a="rot">${iconImg('rotate', 2)}</button>` : '')
      + `<button class="btn" data-a="cancel">${iconImg('cross', 2)}</button>`
      + `<button class="btn primary" data-a="ok">${iconImg('check', 2)}${b.ghost.source === 'shop' ? t('Buy') : t('Place')}</button>` + fold;
  } else if (b.selectedId) {
    const it = S.cafe.furniture.find((f) => f.id === b.selectedId);
    const def = it && CATALOG[it.type];
    if (!def) { b.selectedId = null; return renderTray(); }
    actions.innerHTML = `<div class="label">${t(def.name)}<br><small>${t('Hold and drag to move it')}</small></div>`
      + (def.rotates ? `<button class="btn" data-a="turn">${iconImg('rotate', 2)}</button>` : '')
      + `<button class="btn" data-a="move">${iconImg('move', 2)}</button>`
      + (def.station ? '' : `<button class="btn" data-a="store">${iconImg('box', 2)}</button>`)
      + `<button class="btn primary" data-a="done">${iconImg('check', 2)}${t('Done')}</button>` + fold;
  } else {
    actions.innerHTML = `<div class="label">${t('Drag something from the shop into the café, or hold furniture to move it.')}</div><button class="btn primary" data-a="done">${iconImg('check', 2)}${t('Done')}</button>` + fold;
  }
  $('#tray').classList.toggle('folded', !!b.folded);
  const tabs = $('#trayTabs'), scroll = tabs.scrollLeft;
  tabs.innerHTML = TABS().map(([k, n]) => `<button class="chip${b.tab === k ? ' on' : ''}" data-tab="${k}">${t(n)}</button>`).join('');
  tabs.scrollLeft = scroll;
  if (b.tab === 'room') {
    const card = (kind, id) => {
      const st = (kind === 'wall' ? WALL_STYLES : FLOOR_STYLES)[id];
      const owned = S.cafe.decor.owned.includes(id), current = S.cafe.decor[kind] === id;
      return `<button class="item${b.preview?.[kind] === id ? ' on' : ''}${!owned && st.price > S.cafe.money ? ' poor' : ''}" data-style="${id}" data-kind="${kind}">
        <div class="pic"><img src="${swatchFor(kind, id)}" alt=""></div><b>${t(st.name)}</b>
        <span>${current ? t('In use') : owned ? t('Owned') : `${iconImg('coin', 1)}${st.price}`}</span></button>`;
    };
    $('#trayItems').innerHTML = `<div class="group">${t('Walls')}</div>` + WALL_ORDER.map((id) => card('wall', id)).join('')
      + `<div class="group">${t('Floors')}</div>` + FLOOR_ORDER.map((id) => card('floor', id)).join('');
  } else if (b.tab === 'recipes') {
    const card = (kind, id) => {
      const d = kind === 'food' ? FOODS[id] : DRINKS[id], owned = (kind === 'food' ? S.cafe.foods : S.cafe.recipes).includes(id);
      const pic = kind === 'food' ? plateCanvas(id, 3) : cupCanvas(id, '', 3);
      return `<button class="recipe${owned ? ' have' : ''}${!owned && d.unlock > S.cafe.money ? ' poor' : ''}" data-recipe="${id}" data-rkind="${kind}"><img src="${pic.toDataURL()}" alt=""><b>${t(d.name)}</b>
        <span>${owned ? t('On the menu') : `${iconImg('coin', 1)}${d.unlock}`}</span><span>${t('sells for {n}', { n: d.price })}</span></button>`;
    };
    $('#trayItems').innerHTML = `<div class="group">${t('Drinks')}</div>` + DRINK_ORDER.map((id) => card('drink', id)).join('') + `<div class="group">${t('Food')}</div>` + FOOD_ORDER.map((id) => card('food', id)).join('');
  } else {
    let list;
    if (b.tab === 'storage') list = Object.entries(S.cafe.inventory || {}).map(([type, n]) => ({ type, n }));
    else list = SHOP_ORDER.filter((tp) => b.tab === 'all' || CATALOG[tp].cat === b.tab || CATALOG[tp].set === b.tab).map((type) => ({ type }));
    $('#trayItems').innerHTML = list.length ? list.map(({ type, n }) => {
      const def = CATALOG[type];
      const poor = !n && def.price > S.cafe.money;
      return `<button class="item${poor ? ' poor' : ''}${b.ghost?.type === type ? ' on' : ''}" data-item="${type}" data-src="${n ? 'storage' : 'shop'}">
        <div class="pic"><img src="${iconFor(type)}" alt="" draggable="false"></div><b>${t(def.name)}</b>
        <span>${n ? `×${n}` : `${iconImg('coin', 1)}${def.price}`}</span></button>`;
    }).join('') : `<p class="hint">${t('Nothing in storage yet. Use Store on furniture to put it away.')}</p>`;
  }
  requestAnimationFrame(fitTray);
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
    const c = renderer.icon(type), k = Math.max(1, Math.min(2, Math.floor(48 / c.height)));
    const out = document.createElement('canvas');
    out.width = c.width * k; out.height = c.height * k;
    const g = out.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, out.width, out.height);
    iconCache.set(type, out.toDataURL());
  }
  return iconCache.get(type);
}

// dragging straight out of the shop into the café
let trayDrag = null, swallowClick = false;
$('#trayItems').addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('[data-item]');
  if (!btn || !S.build) return;
  trayDrag = { type: btn.dataset.item, src: btn.dataset.src, x0: e.clientX, y0: e.clientY, started: false };
});
window.addEventListener('pointermove', (e) => {
  if (!trayDrag || !S.build) return;
  const trayTop = $('#tray').getBoundingClientRect().top;
  if (!trayDrag.started && (e.clientY < trayTop - 4 || Math.abs(e.clientY - trayDrag.y0) > 30)) {
    if (trayDrag.src === 'shop' && CATALOG[trayDrag.type].price > S.cafe.money) { toast(t('Not enough coins yet')); sfx.nope(); trayDrag = null; return; }
    trayDrag.started = true;
    S.build.selectedId = null; S.build.preview = null;
    S.build.ghost = { ...freeSpotFor(trayDrag.type, 0), source: trayDrag.src, id: undefined };
    renderTray();
  }
  if (trayDrag.started && e.clientY < trayTop) { const [ix, iy] = tileUnder(e.clientX, e.clientY); moveGhostTo(ix, iy, [0, 0]); }
});
window.addEventListener('pointerup', (e) => {
  if (!trayDrag) return;
  const d = trayDrag; trayDrag = null;
  if (!d.started) return;
  swallowClick = true; setTimeout(() => (swallowClick = false), 50);
  if (e.clientY < $('#tray').getBoundingClientRect().top) commitGhost(true);
});

$('#tray').addEventListener('click', (e) => {
  if (swallowClick) return;
  const btn = e.target.closest('button');
  if (!btn) return;
  const b = S.build;
  sfx.click();
  if (btn.dataset.tab) { b.tab = btn.dataset.tab; b.ghost = null; b.preview = null; b.hideId = null; return renderTray(); }
  if (btn.dataset.style) { b.preview = { [btn.dataset.kind]: btn.dataset.style }; return renderTray(); }
  const a = btn.dataset.a;
  if (a === 'fold') { b.folded = !b.folded; return renderTray(); }
  if (a === 'unpreview') { b.preview = null; return renderTray(); }
  if (a === 'usestyle') {
    const kind = b.preview.wall ? 'wall' : 'floor', id = b.preview[kind];
    const st = (kind === 'wall' ? WALL_STYLES : FLOOR_STYLES)[id], owned = S.cafe.decor.owned.includes(id);
    if (!owned && S.cafe.money < st.price) { toast(t('Not enough coins yet')); sfx.nope(); return; }
    act('build', { op: { op: 'style', kind, id } });
    if (!owned) sfx.coin(); else sfx.place();
    buzz(15);
    b.preview = null;
    return renderTray();
  }
  if (btn.dataset.recipe) {
    const id = btn.dataset.recipe, kind = btn.dataset.rkind, d = kind === 'food' ? FOODS[id] : DRINKS[id];
    if ((kind === 'food' ? S.cafe.foods : S.cafe.recipes).includes(id)) return toast(t('{name} is already on the menu', { name: t(d.name) }));
    if (S.cafe.money < d.unlock) { toast(t('Not enough coins yet')); sfx.nope(); return; }
    act('build', { op: { op: 'recipe', id, kind } });
    sfx.coin(); toast(t('{name} added to the menu!', { name: t(d.name) }));
    return;
  }
  if (btn.dataset.item) {
    const type = btn.dataset.item, src = btn.dataset.src;
    if (src === 'shop' && CATALOG[type].price > S.cafe.money) { toast(t('Not enough coins yet')); sfx.nope(); return; }
    b.selectedId = null;
    b.ghost = { ...freeSpotFor(type, 0), source: src, id: undefined };
    return renderTray();
  }
  if (a === 'done') return closeBuild();
  if (a === 'cancel') { b.ghost = null; b.hideId = null; return renderTray(); }
  if (a === 'rot') { b.ghost.rot = (b.ghost.rot + 1) % 4; return renderTray(); }
  if (a === 'ok') return commitGhost();
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
  refreshClock();
}
function labelHud() {
  $('#coinIcon').src = icon('coin', 3);
  $('#btnMenu').innerHTML = iconImg('gear2', 3);
  $('#btnInvite').innerHTML = iconImg('friend', 3);
  $('#btnBuild').innerHTML = `${iconImg('sofa', 3)}<span>${t('Decorate')}</span>`;
  $('#btnCats').innerHTML = `${iconImg('paw2', 3)}<span>${t('Cats')}</span>`;
  $('#btnOrders').innerHTML = `${iconImg('mug', 3)}<span>${t('Orders')}</span>`;
}

$('#btnBuild').addEventListener('click', () => { sfx.click(); openBuild(); });
$('#btnOrders').addEventListener('click', () => { sfx.click(); openBrew(); });
$('#btnCats').addEventListener('click', () => { sfx.click(); renderCats(); show('cats'); });
$('#catsClose').addEventListener('click', () => { sfx.click(); catsUi.editing = null; show('hud'); });
$('#btnInvite').addEventListener('click', () => {
  sfx.click();
  if (S.role === 'guest') { toast(t("You're visiting your friend's café ({code})", { code: S.code })); return; }
  show('invite');
  if (!S.host) startHosting();
});
$('#inviteClose').addEventListener('click', () => { sfx.click(); show('hud'); });
$('#inviteShare').addEventListener('click', async () => {
  const text = t('Come help me run our cat café in Whiskers & Coffee! Join code: {code}', { code: S.code });
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(S.code); toast(t('Code copied')); } } catch { /* cancelled */ }
});
function openPause() {
  $('#pauseTitle').textContent = S.cafe?.name || t('Café');
  $('#pauseSound').textContent = prefs.sound ? t('Sound: on') : t('Sound: off');
  $('#langRow').innerHTML = LANGUAGES.map(([k, n]) => `<button class="chip${getLang() === k ? ' on' : ''}" data-lang="${k}">${n}</button>`).join('');
  $('#pauseClose2').hidden = dayPhase() !== 'open';
  show('pause');
}
$('#btnMenu').addEventListener('click', () => { sfx.click(); openPause(); });
$('#pauseClose').addEventListener('click', () => { sfx.click(); show('hud'); });
$('#pauseClose2').addEventListener('click', () => { sfx.click(); act('closeEarly'); show('hud'); });
$('#pauseSound').addEventListener('click', () => { prefs.sound = !prefs.sound; savePrefs(); $('#pauseSound').textContent = prefs.sound ? t('Sound: on') : t('Sound: off'); });
$('#pauseChar').addEventListener('click', () => { sfx.click(); openCharacter('pause'); });
$('#pauseLeave').addEventListener('click', () => { sfx.click(); leaveSession(); goMenu(); });
$('#langRow').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lang]');
  if (!b) return;
  prefs.lang = b.dataset.lang; savePrefs(); setLang(prefs.lang);
  relabel();
  openPause();
});
// put every visible text into the chosen language
function relabel() {
  translatePage(); labelHud(); labelShell(stationEls); labelShell(kitchenEls); refreshHud();
  if (S.build) renderTray();
  if (S.screen === 'menu') goMenu();
}

// ---------- cats ----------
const MOOD_TEXT = { sleepy: 'Sleepy, loves warm spots', playful: 'Playful, always exploring', shy: 'Shy, takes time to trust', calm: 'Calm and friendly' };
const catsUi = { editing: null };
function drawCatInto(cv, coat, collar) {
  const c3 = r3Ready() && r3(catFrame3(coat, 'sit', 0, 0));
  if (c3) { cv.width = c3.w; cv.height = c3.h; const g = cv.getContext('2d'); g.clearRect(0, 0, c3.w, c3.h); g.drawImage(c3.canvas, 0, 0); return; }
  const cp = catPose(coat, 'sit', 0, 0), ri = cp && refImg(cp.name);
  if (ri) { cv.width = ri.w; cv.height = ri.h; const g = cv.getContext('2d'); g.clearRect(0, 0, ri.w, ri.h); g.drawImage(ri.canvas, 0, 0); return; }
  const s = catFrame('sit1', coat, false, collar || 'none');
  cv.width = s.canvas.width; cv.height = s.canvas.height;
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(s.canvas, 0, 0);
}
function renderCats() {
  const list = S.cafe.cats;
  upgradeCafe(S.cafe);
  $('#catList').innerHTML = list.map((c) => {
    const name = catsUi.editing === c.id
      ? `<span class="rename"><input id="catName" maxlength="12" value="${escapeHtml(c.name)}" autocomplete="off"><button class="chip on" data-a="savename" data-cat="${c.id}">OK</button></span>`
      : `<b>${escapeHtml(c.name)}</b><button class="chip mini" data-a="rename" data-cat="${c.id}">${t('Rename')}</button>`;
    const collars = COLLAR_ORDER.map((k) => {
      const col = COLLARS[k], on = (c.collar || 'none') === k;
      return `<button class="sw tiny${on ? ' on' : ''}${k === 'none' ? ' none' : ''}" style="background:${col.color || 'transparent'}" data-a="collar" data-cat="${c.id}" data-collar="${k}" aria-label="${col.name}">${col.bell ? '<i></i>' : ''}</button>`;
    }).join('');
    return `<div class="cat-card"><canvas data-coat="${c.coat}" data-collar="${c.collar || 'none'}"></canvas>
      <div class="cat-info"><div class="cat-name">${name}</div><small>${t(MOOD_TEXT[c.mood] || '')}</small>
      <div class="meter"><i style="width:${c.affection || 0}%"></i></div>
      <div class="collars"><span>${t('Collar')}</span>${collars}</div></div></div>`;
  }).join('');
  const full = list.length >= MAX_CATS, price = adoptPrice(S.cafe);
  $('#adoptList').innerHTML = full
    ? `<p class="hint">${t('Your café is full of cats and love. Every one of them is home.')}</p>`
    : strays(S.cafe).map((c, i) => `<div class="cat-card stray"><canvas data-coat="${c.coat}" data-collar="none"></canvas>
      <div class="cat-info"><b>${escapeHtml(c.name)}</b><small>${t(MOOD_TEXT[c.mood])}</small>
      <button class="btn primary adopt${S.cafe.money < price ? ' poor' : ''}" data-a="adopt" data-pick="${i}">${iconImg('heart', 2)}${t('Adopt')} ${iconImg('coin', 2)}${price}</button></div></div>`).join('');
  $('#adoptHead').textContent = full ? t('The shelter') : t('Adopt a cat ({n}/{max})', { n: list.length, max: MAX_CATS });
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
    if (S.cafe.money < col.price) { toast(t('Not enough coins yet')); sfx.nope(); return; }
    act('build', { op: { op: 'collar', id, collar: k } });
    if (col.price) { sfx.coin(); toast(t('{name} looks lovely! -{n}', { name: cat.name, n: col.price })); }
    return;
  }
  if (a === 'adopt') {
    const price = adoptPrice(S.cafe), pick = +btn.dataset.pick;
    if (S.cafe.money < price) { toast(t('Adopting costs {n} coins. Serve a few more orders!', { n: price })); sfx.nope(); return; }
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
let charReturn = 'menu', charTab = 'model', charView = 'front';
const CHAR_TABS = [['model', 'Character'], ['face', 'Face'], ['hair', 'Hair'], ['clothes', 'Clothes'], ['extras', 'Extras']];
const NAMES = { dot: 'Dot', round: 'Round', happy: 'Happy', sleepy: 'Sleepy', lashes: 'Lashes', sparkle: 'Sparkly', short: 'Short', bob: 'Bob', long: 'Long', bun: 'Bun', curly: 'Curly', spiky: 'Spiky', ponytail: 'Ponytail', twintails: 'Twin tails', afro: 'Afro', sidepart: 'Side part', buzz: 'Buzz cut', wavy: 'Wavy', tee: 'T-shirt', sweater: 'Sweater', hoodie: 'Hoodie', shirt: 'Shirt', stripes: 'Stripes', dress: 'Dress', pants: 'Trousers', shorts: 'Shorts', skirt: 'Skirt', beret: 'Beret', cap: 'Cap', beanie: 'Beanie', bow: 'Bow', flower: 'Flower', headband: 'Headband', square: 'Square', sun: 'Sunglasses' };
function openCharacter(ret) {
  charReturn = ret;
  $('#nameInput').value = prefs.name;
  renderCharOptions();
  show('character');
}
function renderCharOptions() {
  const L = prefs.look;
  const sw = (list, key) => `<div class="swatches">${list.map((c) => `<button class="sw${L[key] === c ? ' on' : ''}" style="background:${c}" data-key="${key}" data-val="${c}"></button>`).join('')}</div>`;
  const chips = (list, key) => `<div class="chips">${list.map((v) => `<button class="chip${(L[key] ?? null) === v ? ' on' : ''}" data-key="${key}" data-val="${v ?? ''}">${v == null ? t('None') : t(NAMES[v] || v)}</button>`).join('')}</div>`;
  const toggle = (key, label) => `<button class="chip${L[key] ? ' on' : ''}" data-key="${key}" data-toggle="1">${t(label)}</button>`;
  const opt = (label, body) => `<div class="opt"><span>${t(label)}</span>${body}</div>`;
  $('#charTabs').innerHTML = CHAR_TABS.map(([k, n]) => `<button class="chip${charTab === k ? ' on' : ''}" data-ctab="${k}">${t(n)}</button>`).join('');
  let html = '';
  if (charTab === 'model') html = `<p class="hint">${t('Pick a ready-made barista, or Custom to build your own on the other tabs.')}</p>` + `<div class="chips">${['', ...MODEL_ORDER].map((m) => `<button class="chip${(L.model || '') === m ? ' on' : ''}" data-key="model" data-val="${m}">${m ? t(MODELS[m].name) : t('Custom')}</button>`).join('')}</div>`;
  if (charTab === 'face') html = opt('Skin', sw(SKINS, 'skin')) + opt('Eyes', chips(EYE_STYLES, 'eyes')) + opt('Eye colour', sw(EYE_COLORS, 'eyeColor')) + opt('Details', `<div class="chips">${toggle('freckles', 'Freckles')}<button class="chip${L.blush !== false ? ' on' : ''}" data-key="blush" data-toggle="1">${t('Blush')}</button></div>`) + opt('Glasses', chips(GLASSES, 'glasses'));
  if (charTab === 'hair') html = opt('Hair', chips(HAIR_STYLES, 'style')) + opt('Hair colour', sw(HAIR_COLORS, 'hair'));
  if (charTab === 'clothes') html = opt('Top', chips(TOPS, 'top')) + opt('Top colour', sw(OUTFIT_COLORS, 'shirt')) + opt('Bottom', chips(BOTTOMS, 'bottom')) + opt('Bottom colour', sw(PANTS_COLORS, 'pants')) + opt('Shoes', sw(SHOE_COLORS, 'shoes'));
  if (charTab === 'extras') html = opt('Apron', `<div class="chips">${toggle('apron', 'Apron')}</div>`) + opt('Apron colour', sw(['#e8d7b0', '#5b3a26', '#3d4a6b', '#6d8a58', '#c9786f', '#2b2b30', '#f4efe6', '#ef8fae'], 'apronColor')) + opt('Hat', chips(HATS, 'hat')) + opt('Hat colour', sw(OUTFIT_COLORS, 'hatColor'));
  $('#charOpts').innerHTML = html;
}
$('#character').addEventListener('click', (e) => {
  const tb = e.target.closest('[data-ctab]');
  if (tb) { charTab = tb.dataset.ctab; sfx.click(); return renderCharOptions(); }
  const b = e.target.closest('[data-key]');
  if (!b) return;
  const key = b.dataset.key;
  let val = b.dataset.val === '' ? null : b.dataset.val;
  if (b.dataset.toggle) val = key === 'blush' ? prefs.look.blush === false : !prefs.look[key];
  prefs.look = { ...prefs.look, [key]: val };
  savePrefs(); sfx.click(); renderCharOptions();
});
$('#charSpin').addEventListener('click', () => { charView = charView === 'front' ? 'back' : 'front'; sfx.click(); });
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
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  if (r3Ready()) {
    const f = personFrame(modelFor(prefs.look), { view: charView, flip: false, moving: true, x: 0, y: 0 }, now / 1000);
    const p3 = r3(f.name);
    if (p3) { const k = Math.floor(Math.min(cv.width / p3.w, cv.height / p3.h)); g.drawImage(p3.canvas, Math.round((cv.width - p3.w * k) / 2), cv.height - p3.h * k, p3.w * k, p3.h * k); return; }
  }
  const M = prefs.look.model && MODELS[prefs.look.model];
  const im = M && refImg(charView === 'back' && M.back ? M.back : M.front);
  if (im) { const k = Math.min(cv.width / im.w, cv.height / im.h); g.drawImage(im.canvas, (cv.width - im.w * k) / 2, cv.height - im.h * k, im.w * k, im.h * k); return; }
  const s = personSprite(prefs.look, charView, Math.floor(now / 160) % 4, false);
  g.drawImage(s.canvas, (cv.width - 32 * 2) / 2, cv.height - 58 * 2, 64, 116);
}
(function loop(now) { requestAnimationFrame(loop); drawCharPreview(now); })(0);

// ---------- title screen ----------
function goMenu() {
  closeBuild();
  // a calm café behind the title: the last café, or a fresh one
  const c = upgradeCafe(lastCafe() || newCafe());
  S.cafe = c;
  S.role = null;
  S.sim = new Sim(c, () => {});
  S.sim.idle = true;
  renderer.userZoom = false; renderer.resize(); renderer.centre();
  const saved = lastCafe();
  $('#menuButtons').innerHTML = (saved ? `<button class="btn primary wide" data-m="continue">${t('Open {name}', { name: escapeHtml(saved.name) })}</button>` : `<button class="btn primary wide" data-m="new">${t('Open our café')}</button>`)
    + `<button class="btn" data-m="join">${t('Join a friend')}</button>`
    + `<button class="btn" data-m="char">${t('My character')}</button>`
    + `<div class="lang-row menu-lang">${LANGUAGES.map(([k, n]) => `<button class="chip${getLang() === k ? ' on' : ''}" data-mlang="${k}">${n}</button>`).join('')}</div>`
    + (saved ? `<button class="btn wide" data-m="new">${t('Start a new café')}</button>` : '');
  show('menu');
}
$('#menuButtons').addEventListener('click', (e) => {
  const lb = e.target.closest('[data-mlang]');
  if (lb) { prefs.lang = lb.dataset.mlang; savePrefs(); setLang(prefs.lang); sfx.click(); relabel(); return; }
  const m = e.target.closest('[data-m]')?.dataset.m;
  if (!m) return;
  sfx.click();
  if (!prefs.made && m !== 'char') { pendingStart = m; return openCharacter('start'); }
  if (m === 'continue') {
    const c = lastCafe();
    if (c?.guestOf) toast(t('Hosting this café from your phone now'));
    playSolo(c);
  } else if (m === 'new') {
    if (lastCafe() && !confirmNew()) return;
    playSolo(newCafe(prefs.name ? t("{name}'s Café", { name: prefs.name }) : t('Our Café')));
  } else if (m === 'join') { $('#joinStatus').textContent = ''; $('#codeInput').value = ''; show('join'); setTimeout(() => $('#codeInput').focus(), 50); }
  else if (m === 'char') openCharacter('menu');
});
let newArmed = 0;
function confirmNew() {
  if (Date.now() - newArmed < 3000) return true;
  newArmed = Date.now();
  toast(t('Tap again to start a fresh café (your old one stays saved)'));
  return false;
}
$('#joinBack').addEventListener('click', () => { sfx.click(); leaveSession(); goMenu(); });
$('#codeInput').addEventListener('input', (e) => { e.target.value = cleanCode(e.target.value); });
$('#joinGo').addEventListener('click', () => {
  const code = cleanCode($('#codeInput').value);
  if (code.length !== 5) { $('#joinStatus').textContent = t('Codes have five letters'); return; }
  sfx.click();
  joinCafe(code);
});

// logo cat
{
  const s = catFrame('sit1', 'orange'), g = $('#logoCat').getContext('2d');
  $('#logoCat').width = s.canvas.width; $('#logoCat').height = s.canvas.height;
  g.drawImage(s.canvas, 0, 0);
}

// ---------- app lifecycle ----------
if (Plugins.StatusBar) Plugins.StatusBar.hide().catch(() => {});
if (Plugins.App) Plugins.App.addListener('backButton', () => {
  if (station.open) { station.hide(); counterHooks.close(); return; }
  if (kitchen.open) { kitchen.hide(); counterHooks.close(); return; }
  if (brew.open) return closeBrew();
  if (S.build) return closeBuild();
  if (['invite', 'cats', 'pause'].includes(S.screen)) return show('hud');
  if (S.screen === 'hud') return $('#btnMenu').click();
  if (S.screen === 'menu') return Plugins.App.exitApp();
  goMenu();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && S.cafe && S.role && S.role !== 'guest') saveCafe(S.cafe); });

translatePage();
labelHud();
goMenu();
// the reference art loads in the background; redraw furniture and icons once it's here
loadR3().then(() => {
  renderer.sprites.clear(); iconCache.clear(); renderer.roomKey = '';
  renderer.resize();
  if (S.build) renderTray();
  if (S.screen === 'cats') renderCats();
  const lc = r3('c_orange_sit0');
  if (lc) { const c = $('#logoCat'); c.width = lc.w; c.height = lc.h; c.getContext('2d').drawImage(lc.canvas, 0, 0); }
});
loadRefs().then(() => {
  if (r3Ready()) return;
  renderer.sprites.clear(); iconCache.clear();
  if (S.build) renderTray();
  if (S.screen === 'cats') renderCats();
  const lc = refImg('orange_sit');
  if (lc) { const c = $('#logoCat'); c.width = lc.w; c.height = lc.h; c.getContext('2d').drawImage(lc.canvas, 0, 0); }
});
requestAnimationFrame(frame);

// hooks for automated tests
window.__wc = { S, renderer, act, startHosting, joinCafe, playSolo, newCafe, goMenu, currentView, openBrew, station, kitchen, startOrder, setLang: (l) => { prefs.lang = l; setLang(l); relabel(); } };
