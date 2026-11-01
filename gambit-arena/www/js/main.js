// Menus, turns, duels and online play.
import * as C from './chess.js';
import { chooseMove } from './ai.js';
import { FIGHTERS, duelOdds } from './pieces.js';
import * as D from './duel.js';
import * as R from './render.js';
import { HostSession, GuestSession, makeCode, cleanCode } from './net.js';
import { sfx, unlock, toggleMute, muted, buzz } from './audio.js';

const $ = (id) => document.getElementById(id);
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const G = {
  mode: null,        // 'bot' | 'online'
  me: 'w',
  level: +store.get('ga-level', 1),
  sens: +store.get('ga-sens', 1),
  state: C.newGame(),
  selected: -1,
  last: null,
  phase: 'menu',     // menu | board | duel | over
  net: null, isHost: false,
  myName: store.get('ga-name', ''), oppName: 'Bot',
  duel: null,
  lost: { w: [], b: [] },
  botTimer: 0,
  pendingPromo: null,
};
window.__ga = G; // for testing in the browser

// ---------- screens ----------
const layers = ['menu', 'lobby', 'help', 'boardHud', 'promo', 'duelIntro', 'duelHud', 'duelResult', 'pause', 'over'];
function show(...ids) { for (const l of layers) $(l).classList.toggle('show', ids.includes(l)); }
let toastTimer = 0;
function toast(msg, ms = 2400) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------- menu ----------
$('nameInput').value = G.myName;
$('nameInput').addEventListener('input', (e) => { G.myName = e.target.value.trim(); store.set('ga-name', G.myName); });
$('sensInput').value = G.sens;
$('sensInput').addEventListener('input', (e) => { G.sens = +e.target.value; store.set('ga-sens', G.sens); });
function paintLevel() { for (const b of $('levelSeg').children) b.classList.toggle('on', +b.dataset.v === G.level); }
$('levelSeg').addEventListener('click', (e) => { const v = e.target.closest('button')?.dataset.v; if (v != null) { G.level = +v; store.set('ga-level', v); paintLevel(); } });
paintLevel();
const paintSound = () => document.querySelectorAll('.soundBtn').forEach((b) => (b.textContent = muted ? '🔇' : '🔊'));
document.querySelectorAll('.soundBtn').forEach((b) => b.addEventListener('click', () => { toggleMute(); paintSound(); }));
paintSound();
document.addEventListener('pointerdown', unlock, { capture: true });

$('statTable').innerHTML = Object.entries(FIGHTERS).map(([t, f]) =>
  `<div><b>${GLYPH[t]} ${f.name}</b>${f.weapon.name} · ${f.hp} HP</div>`).join('');
$('helpBtn').onclick = () => show('help');
$('helpClose').onclick = () => show(G.phase === 'menu' ? 'menu' : 'boardHud');

$('botBtn').onclick = () => {
  G.mode = 'bot'; G.me = 'w'; G.oppName = ['Easy bot', 'Bot', 'Hard bot'][G.level];
  newGame();
};

$('hostBtn').onclick = () => {
  closeNet();
  G.mode = 'online'; G.isHost = true; G.me = 'w';
  show('lobby');
  $('lobbyTitle').textContent = 'Host a game';
  $('hostBox').hidden = false; $('joinBox').hidden = true;
  const code = makeCode();
  $('codeOut').textContent = code;
  $('hostStatus').textContent = 'Connecting…';
  G.net = new HostSession(code, {
    onOpen: () => { $('hostStatus').textContent = 'Waiting for your friend to join…'; },
    onJoin: () => { $('hostStatus').textContent = 'Friend connected!'; },
    onMessage: (_, m) => onNet(m),
    onLeave: () => { if (G.phase !== 'menu') toast('Your friend disconnected. Waiting for them to come back…', 4000); if (G.duel && G.duel.phase !== 'done') endDuel(false); },
    onError: (e) => { $('hostStatus').textContent = e; },
  });
};

$('joinBtn').onclick = () => {
  closeNet();
  G.mode = 'online'; G.isHost = false; G.me = 'b';
  show('lobby');
  $('lobbyTitle').textContent = 'Join a game';
  $('hostBox').hidden = true; $('joinBox').hidden = false;
  $('joinStatus').textContent = '';
  $('codeIn').value = '';
  setTimeout(() => $('codeIn').focus(), 50);
};
$('codeIn').addEventListener('input', (e) => { e.target.value = cleanCode(e.target.value); });
$('joinGo').onclick = () => {
  const code = cleanCode($('codeIn').value);
  if (code.length !== 5) { $('joinStatus').textContent = 'The code has 5 letters.'; return; }
  closeNet();
  $('joinStatus').textContent = 'Connecting…';
  G.net = new GuestSession(code, {
    onOpen: () => { $('joinStatus').textContent = 'Connected!'; send({ t: 'hello', name: G.myName || 'Friend' }); },
    onMessage: (m) => onNet(m),
    onClose: () => { if (G.phase !== 'menu') toast('Connection lost, reconnecting…', 3000); },
    onError: (e) => { $('joinStatus').textContent = e; },
  });
};
$('lobbyBack').onclick = () => { closeNet(); show('menu'); G.phase = 'menu'; };

function closeNet() { try { G.net?.close(); } catch {} G.net = null; }
function send(m) {
  if (!G.net) return;
  if (G.isHost) G.net.broadcast(m); else G.net.send(m);
}

// ---------- game flow ----------
function newGame() {
  G.state = C.newGame();
  G.selected = -1; G.last = null; G.duel = null;
  G.lost = { w: [], b: [] };
  G.phase = 'board';
  clearTimeout(G.botTimer);
  R.setBoardSide(G.me);
  R.syncBoard(G.state);
  R.setMode('board');
  show('boardHud');
  refreshBoard();
  maybeBotMove();
}

function refreshBoard() {
  const st = C.status(G.state);
  const mine = G.state.turn === G.me;
  const check = st === 'check' ? C.kingSquare(G.state.board, G.state.turn) : -1;
  const moves = G.selected >= 0 ? C.legalMoves(G.state, G.selected) : [];
  R.setMarks({ selected: G.selected, moves, last: G.last, check });
  const b = $('turnBanner');
  b.className = '';
  if (st === 'check') { b.textContent = mine ? 'Check! Your move' : 'Check!'; b.classList.add('check'); }
  else if (mine) { b.textContent = 'Your move'; b.classList.add('mine'); }
  else b.textContent = G.mode === 'bot' ? 'Bot is thinking…' : `${G.oppName}'s move`;
  $('myName').textContent = `${G.me === 'w' ? '♔' : '♚'} ${G.myName || 'You'}`;
  $('oppName').textContent = `${G.me === 'w' ? '♚' : '♔'} ${G.oppName}`;
  document.querySelector('.tag.me').classList.toggle('turn', mine);
  document.querySelector('.tag.opp').classList.toggle('turn', !mine);
  // pieces each side has lost
  $('myLost').textContent = G.lost[G.me].map((t) => GLYPH[t]).join('');
  $('oppLost').textContent = G.lost[C.other(G.me)].map((t) => GLYPH[t]).join('');
  paintPieceInfo(moves);
}

function paintPieceInfo(moves) {
  const el = $('pieceInfo');
  if (G.selected < 0) { el.classList.remove('show'); return; }
  const t = C.typeOf(G.state.board[G.selected]);
  const f = FIGHTERS[t];
  const caps = moves.filter((m) => m.captured);
  let html = `<b>${GLYPH[t]} ${f.name}</b>${f.weapon.name} · ${f.hp} HP`;
  if (caps.length) {
    const odds = [...new Set(caps.map((m) => C.typeOf(m.captured)))]
      .map((d) => `${GLYPH[d]} ${Math.round(duelOdds(t, d) * 100)}%`).join('  ');
    html += `<br><span class="odds">Fair-fight odds: ${odds}</span><br>Tap a red ring to start a duel.`;
  }
  el.innerHTML = html;
  el.classList.add('show');
}

function onBoardTap(x, y) {
  if (G.phase !== 'board' || G.state.turn !== G.me) return;
  const s = R.pickSquare(x, y);
  if (s < 0) return;
  if (G.selected >= 0) {
    const options = C.legalMoves(G.state, G.selected).filter((m) => m.to === s);
    if (options.length) {
      if (options.length > 1) { G.pendingPromo = options; show('boardHud', 'promo'); return; }
      return commit(options[0]);
    }
  }
  const p = G.state.board[s];
  if (p && C.colorOf(p) === G.me && s !== G.selected) { G.selected = s; sfx.select(); }
  else G.selected = -1;
  refreshBoard();
}

$('promo').addEventListener('click', (e) => {
  const p = e.target.closest('button')?.dataset.p;
  if (!p || !G.pendingPromo) return;
  const m = G.pendingPromo.find((x) => x.promo === p);
  G.pendingPromo = null;
  show('boardHud');
  commit(m);
});

// Plays a move chosen here (or received from the friend).
function commit(m, fromNet = false) {
  G.selected = -1;
  if (G.mode === 'online' && !fromNet) send({ t: 'move', from: m.from, to: m.to, promo: m.promo || '' });
  if (m.captured) return startDuel(m);
  G.state = C.applyMove(G.state, m);
  G.last = { from: m.from, to: m.to };
  sfx.move();
  R.syncBoard(G.state, { from: m.from, to: m.to });
  afterMove();
}

function afterMove() {
  const st = C.status(G.state);
  refreshBoard();
  if (['checkmate', 'stalemate', 'draw', 'kingless', 'exposed'].includes(st)) {
    setTimeout(() => gameOver(st), 900);
    return;
  }
  maybeBotMove();
}

function maybeBotMove() {
  if (G.mode !== 'bot' || G.phase !== 'board' || G.state.turn === G.me) return;
  clearTimeout(G.botTimer);
  G.botTimer = setTimeout(() => {
    if (G.phase !== 'board' || G.state.turn === G.me) return;
    const m = chooseMove(G.state, G.level);
    if (m) commit(m);
  }, 650);
}

function gameOver(st, why = '') {
  if (G.phase === 'over') return;
  G.phase = 'over';
  const loser = st === 'resign' ? why : C.loser(G.state, st);
  const won = loser && loser !== G.me;
  const title = !loser ? 'Draw' : won ? 'You win!' : 'You lose';
  const reasons = {
    checkmate: 'Checkmate.',
    stalemate: 'Stalemate.',
    draw: 'Draw by the fifty-move rule or not enough material.',
    kingless: 'The king fell in a duel.',
    exposed: 'A failed attack left the king in check.',
    resign: won ? `${G.oppName} resigned.` : 'You resigned.',
  };
  $('overTitle').textContent = title;
  $('overSub').textContent = reasons[st] || '';
  (won ? sfx.win : sfx.lose)();
  R.setMode('board');
  show('boardHud', 'over');
}

$('again').onclick = () => {
  if (G.mode === 'online') {
    if (!G.isHost) { send({ t: 'rematch' }); toast('Asked the host for a rematch'); return; }
    startOnlineGame();
  } else newGame();
};
$('toMenu').onclick = toMenu;
$('pauseBtn').onclick = () => { if (G.phase === 'board') show('boardHud', 'pause'); };
$('resume').onclick = () => show('boardHud');
$('resign').onclick = () => {
  if (G.mode === 'online') send({ t: 'resign' });
  gameOver('resign', G.me);
};
$('quit').onclick = () => { if (G.mode === 'online') send({ t: 'resign' }); toMenu(); };
$('rotBtn').onclick = () => R.rotateBoardView(Math.PI / 2);

function toMenu() {
  clearTimeout(G.botTimer);
  closeNet();
  G.phase = 'menu'; G.duel = null;
  R.endDuelScene();
  R.setMode('board');
  show('menu');
}

// ---------- online ----------
function startOnlineGame() {
  send({ t: 'start', name: G.myName || 'Host' });
  G.me = 'w';
  newGame();
}

function onNet(m) {
  switch (m.t) {
    case 'hello':
      if (!G.isHost) break;
      G.oppName = (m.name || 'Friend').slice(0, 12);
      if (G.phase === 'board' || G.phase === 'duel') {
        // a reconnect: send the whole position
        send({ t: 'sync', name: G.myName || 'Host', fen: C.toFEN(G.state), last: G.last, lost: G.lost });
        toast(`${G.oppName} is back`);
      } else startOnlineGame();
      break;
    case 'start':
      G.oppName = (m.name || 'Host').slice(0, 12);
      G.me = 'b';
      newGame();
      break;
    case 'sync':
      G.oppName = (m.name || 'Host').slice(0, 12);
      if (G.duel) abortDuel();
      G.state = C.fromFEN(m.fen); G.last = m.last; G.lost = m.lost || G.lost;
      G.phase = 'board';
      R.setBoardSide(G.me);
      R.syncBoard(G.state);
      R.setMode('board');
      show('boardHud');
      refreshBoard();
      break;
    case 'move': {
      if (G.phase !== 'board') break;
      const mv = C.legalMoves(G.state, m.from).find((x) => x.to === m.to && (x.promo || '') === (m.promo || ''));
      if (mv) commit(mv, true);
      break;
    }
    case 'st': {
      const d = G.duel;
      if (!d) break;
      d.net = m;
      d.netAt = performance.now();
      if (performance.now() > d.hpLockUntil) d.opp.hp = m.hp; else d.opp.hp = Math.min(d.opp.hp, m.hp);
      d.opp.zoomed = !!m.zm;
      break;
    }
    case 'fx': {
      const d = G.duel;
      if (!d) break;
      for (const e of m.ends) R.addTracer(m.o, e, false);
      sfx.shot(d.opp.weapon, true);
      break;
    }
    case 'rk': {
      const d = G.duel;
      if (!d) break;
      d.rockets.push({ ...m.r, owner: d.opp.side, remote: true });
      sfx.shot(d.opp.weapon, true);
      break;
    }
    case 'hit':
      if (G.duel && G.duel.phase !== 'done') takeDamage(m.dmg);
      break;
    case 'dead':
      if (G.isHost && G.duel && G.duel.phase !== 'done') {
        G.duel.opp.hp = 0;
        resolveOnline();
      }
      break;
    case 'duelEnd':
      if (G.duel && G.duel.phase !== 'done') endDuel(m.attackerWon);
      break;
    case 'resign':
      if (G.phase === 'board' || G.phase === 'duel') { if (G.duel) abortDuel(); gameOver('resign', C.other(G.me)); }
      break;
    case 'rematch':
      if (G.isHost) startOnlineGame();
      break;
  }
}

// ---------- duels ----------
const input = { mx: 0, mz: 0, fire: false, stickId: null, lookId: null, sx: 0, sy: 0, lx: 0, ly: 0, keys: new Set() };

function startDuel(m) {
  clearTimeout(G.botTimer);
  const attColor = G.state.turn;
  const iAttack = attColor === G.me;
  const toLight = (C.fileOf(m.to) + C.rankOf(m.to)) % 2 === 1;
  const arena = D.makeArena(toLight ? 'light' : 'dark');
  const att = D.makeFighter(C.typeOf(m.piece), 0, arena);
  const def = D.makeFighter(C.typeOf(m.captured), 1, arena);
  const me = iAttack ? att : def, opp = iAttack ? def : att;
  G.duel = {
    m, arena, me, opp, iAttack, att, def,
    phase: 'intro', t: 0, count: 3,
    rockets: [], sendT: 0, net: null, hpLockUntil: 0, sentDead: false,
    bot: G.mode === 'bot' ? new D.DuelBot(opp, arena, G.level) : null,
  };
  G.phase = 'duel';
  G.selected = -1;
  input.fire = false; input.mx = input.mz = 0;
  const card = (f, color, mine) => `<div class="who">${mine ? 'You' : G.oppName}</div>
    <div class="glyph">${GLYPH[f.type]}</div><b>${FIGHTERS[f.type].name}</b>
    <span>${f.weapon.name}</span><span>${f.maxHp} HP</span>`;
  $('vsA').innerHTML = card(att, attColor, iAttack);
  $('vsB').innerHTML = card(def, C.other(attColor), !iAttack);
  $('vsA').classList.toggle('you', iAttack);
  $('vsB').classList.toggle('you', !iAttack);
  $('vsRole').textContent = iAttack ? 'You attack. Win to take the square.' : 'You defend. Survive the clock or win to keep your piece.';
  show('duelIntro');
  sfx.duel();
  buzz(60);
  R.startDuelScene(arena, me, opp, iAttack ? attColor : C.other(attColor), iAttack ? C.other(attColor) : attColor);
  $('enemyName').textContent = `${G.oppName} · ${FIGHTERS[opp.type].name}`;
  $('weaponName').textContent = me.weapon.name;
  $('zoomBtn').style.display = me.weapon.zoom ? '' : 'none';
  $('scope').classList.remove('show');
  me.zoomed = false; R.setZoom(false);
  $('cross').style.setProperty('--gap', `${Math.round(5 + me.weapon.spread * 260)}px`);
  setTimeout(() => {
    if (G.duel?.phase !== 'intro') return;
    G.duel.phase = 'count';
    R.setMode('duel');
    show('duelHud');
  }, 2300);
}

function abortDuel() {
  G.duel = null;
  R.endDuelScene();
  R.setMode('board');
}

function dealDamage(dmg, head) {
  const d = G.duel;
  if (!dmg || !d) return;
  if (G.mode === 'online') {
    send({ t: 'hit', dmg, head });
    d.hpLockUntil = performance.now() + 600;
  }
  d.opp.hp = Math.max(0, d.opp.hp - dmg);
  const hm = $('hitmark');
  hm.classList.toggle('head', !!head);
  hm.style.opacity = 1;
  hm.dataset.t = performance.now();
  sfx.hit(head);
}

function takeDamage(dmg) {
  const d = G.duel;
  if (!d || d.me.hp <= 0) return;
  d.me.hp = Math.max(0, d.me.hp - dmg);
  $('hurt').style.opacity = Math.min(1, 0.35 + dmg / 60);
  sfx.hurt();
  buzz(dmg > 30 ? 60 : 25);
}

function fire(f, isMe) {
  const d = G.duel;
  const dirs = D.tryFire(f);
  if (!dirs) return;
  const target = isMe ? d.opp : d.me;
  if (f.weapon.rocket) {
    const r = D.makeRocket(f, dirs[0]);
    d.rockets.push(r);
    if (isMe && G.mode === 'online') send({ t: 'rk', r: { x: r.x, y: r.y, z: r.z, vx: r.vx, vy: r.vy, vz: r.vz, life: r.life } });
  } else {
    const res = D.resolveHitscan(d.arena, f, target, dirs);
    for (const h of res.hits) R.addTracer(res.origin, h.end, isMe);
    if (isMe) {
      if (G.mode === 'online') send({ t: 'fx', o: res.origin, ends: res.hits.map((h) => h.end) });
      dealDamage(res.damage, res.head);
    } else takeDamage(res.damage);
  }
  if (isMe) { R.muzzleFlash(); buzz(10); }
  sfx.shot(f.weapon, !isMe);
}

function stepDuel(dt) {
  const d = G.duel;
  if (!d) return;
  if (d.phase === 'count') {
    const before = Math.ceil(d.count);
    d.count -= dt;
    const now = Math.ceil(d.count);
    $('countdown').textContent = d.count > 0 ? now : 'GO!';
    if (now !== before && d.count > 0) sfx.count();
    if (d.count <= 0) { d.phase = 'fight'; sfx.go(); setTimeout(() => { if (G.duel === d) $('countdown').textContent = ''; }, 600); }
  }
  const fighting = d.phase === 'fight';
  const me = d.me, opp = d.opp;

  // look with the keyboard (desktop testing)
  const k = input.keys;
  if (k.has('ArrowLeft')) me.yaw += 2.4 * dt;
  if (k.has('ArrowRight')) me.yaw -= 2.4 * dt;
  if (k.has('ArrowUp')) me.pitch = Math.min(1.35, me.pitch + 1.6 * dt);
  if (k.has('ArrowDown')) me.pitch = Math.max(-1.35, me.pitch - 1.6 * dt);
  let mx = input.mx, mz = input.mz;
  if (k.has('KeyW')) mz = 1; if (k.has('KeyS')) mz = -1;
  if (k.has('KeyA')) mx = -1; if (k.has('KeyD')) mx = 1;

  D.updateWeapon(me, dt);
  if (fighting && me.hp > 0) {
    D.moveFighter(me, mx, mz, dt, d.arena, opp);
    if (input.fire || k.has('Space')) {
      // gentle aim assist toward a visible enemy close to the crosshair
      if (opp.hp > 0 && D.canSee(d.arena, me, opp)) {
        const want = Math.atan2(-(opp.x - me.x), -(opp.z - me.z));
        const diff = Math.atan2(Math.sin(want - me.yaw), Math.cos(want - me.yaw));
        if (Math.abs(diff) < 0.12) me.yaw += Math.max(-0.5 * dt, Math.min(0.5 * dt, diff));
      }
      fire(me, true);
    }
  } else D.moveFighter(me, 0, 0, dt, d.arena, opp);

  // opponent
  if (d.bot) {
    D.updateWeapon(opp, dt);
    if (fighting && opp.hp > 0 && me.hp > 0) {
      const ctl = d.bot.think(dt, me);
      D.moveFighter(opp, ctl.mx, ctl.mz, dt, d.arena, me);
      if (ctl.fire) fire(opp, false);
    } else D.moveFighter(opp, 0, 0, dt, d.arena, me);
  } else if (d.net) {
    const n = d.net, kk = Math.min(1, dt * 14);
    opp.x += (n.x - opp.x) * kk; opp.z += (n.z - opp.z) * kk;
    opp.yaw += Math.atan2(Math.sin(n.yaw - opp.yaw), Math.cos(n.yaw - opp.yaw)) * kk;
    opp.pitch += (n.pitch - opp.pitch) * kk;
    opp.reloading = n.rl ? 1 : 0;
  }

  // rockets (remote ones are only drawn; their owner works out the damage)
  d.rockets = d.rockets.filter((rk) => {
    const boom = D.stepRocket(rk, dt, d.arena, [me, opp]);
    if (!boom) return true;
    R.addExplosion(boom, (rk.owner === me.side ? me : opp).weapon.splash);
    sfx.boom(); buzz(40);
    if (rk.remote) return false;
    const w = (rk.owner === me.side ? me : opp).weapon;
    const toOpp = D.splashDamage(d.arena, boom, opp, w);
    const toMe = D.splashDamage(d.arena, boom, me, w) * (rk.owner === me.side ? 0.5 : 1);
    if (rk.owner === me.side) { if (toOpp) dealDamage(toOpp, false); if (toMe) takeDamage(toMe); }
    else if (d.bot) { if (toMe) takeDamage(toMe); if (toOpp) opp.hp = Math.max(0, opp.hp - Math.round(toOpp * 0.5)); }
    return false;
  });
  R.syncRockets(d.rockets);

  if (fighting) d.t += dt;
  // network state
  if (G.mode === 'online') {
    d.sendT -= dt;
    if (d.sendT <= 0) {
      d.sendT = 1 / 15;
      send({ t: 'st', x: +me.x.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), hp: me.hp, zm: me.zoomed ? 1 : 0, rl: me.reloading > 0 ? 1 : 0 });
    }
    if (me.hp <= 0 && !d.sentDead) { d.sentDead = true; if (G.isHost) resolveOnline(); else send({ t: 'dead' }); }
    if (G.isHost && fighting && d.t >= D.DUEL_TIME && d.phase !== 'done') { send({ t: 'duelEnd', attackerWon: false }); endDuel(false); }
  } else if (d.phase !== 'done') {
    if (me.hp <= 0 || opp.hp <= 0) endDuel(d.def.hp <= 0 && d.att.hp > 0);
    else if (d.t >= D.DUEL_TIME) endDuel(false);
  }
  paintDuelHud(d);
}

function resolveOnline() {
  const d = G.duel;
  if (!d || d.phase === 'done') return;
  const attackerWon = d.def.hp <= 0 && d.att.hp > 0;
  send({ t: 'duelEnd', attackerWon });
  endDuel(attackerWon);
}

function endDuel(attackerWon) {
  const d = G.duel;
  if (!d || d.phase === 'done') return;
  d.phase = 'done';
  input.fire = false;
  $('fireBtn').classList.remove('held');
  const iWon = attackerWon === d.iAttack;
  const timeout = !attackerWon && d.att.hp > 0 && d.def.hp > 0;
  $('resTitle').textContent = iWon ? 'VICTORY' : 'DEFEATED';
  $('resTitle').className = iWon ? 'win' : 'lose';
  $('resSub').textContent = attackerWon ? 'The attacker takes the square.' : timeout ? 'Time! The defender holds the square.' : 'The defender holds the square.';
  (iWon ? sfx.win : sfx.lose)();
  setTimeout(() => {
    if (G.duel !== d) return;
    show('duelResult');
    setTimeout(() => {
      if (G.duel !== d) return;
      const m = d.m;
      const attColor = G.state.turn;
      if (attackerWon) {
        G.state = C.applyMove(G.state, m);
        G.lost[C.other(attColor)].push(C.typeOf(m.captured));
      } else {
        G.state = C.applyFailedCapture(G.state, m);
        G.lost[attColor].push(C.typeOf(m.piece));
      }
      G.last = { from: m.from, to: m.to };
      G.duel = null;
      R.endDuelScene();
      R.setMode('board');
      R.syncBoard(G.state, attackerWon ? { from: m.from, to: m.to } : null);
      G.phase = 'board';
      show('boardHud');
      afterMove();
    }, 1900);
  }, 700);
}

function paintDuelHud(d) {
  const me = d.me, opp = d.opp;
  $('myHp').style.width = `${(100 * Math.max(0, me.hp)) / me.maxHp}%`;
  $('myHpText').textContent = `${Math.max(0, Math.ceil(me.hp))} / ${me.maxHp}`;
  $('enemyHp').style.width = `${(100 * Math.max(0, opp.hp)) / opp.maxHp}%`;
  $('ammoText').textContent = me.reloading > 0 ? 'reloading…' : `${me.ammo} / ${me.weapon.mag}`;
  const left = Math.max(0, Math.ceil(D.DUEL_TIME - d.t));
  $('timer').textContent = left;
  $('timer').classList.toggle('low', left <= 10);
  const hurt = $('hurt');
  hurt.style.opacity = Math.max(0, (+hurt.style.opacity || 0) - 0.03);
  const hm = $('hitmark');
  if (+hm.style.opacity > 0 && performance.now() - +hm.dataset.t > 150) hm.style.opacity = Math.max(0, +hm.style.opacity - 0.1);
  // enemy marker over their head when in sight
  const tag = $('enemyTag');
  const see = opp.hp > 0 && D.canSee(d.arena, me, opp);
  const pos = see ? R.oppScreenPos() : null;
  if (pos) { tag.style.display = 'block'; tag.style.left = `${pos.x * 100}%`; tag.style.top = `${pos.y * 100}%`; } else tag.style.display = 'none';
  // red crosshair when on target
  const dir = D.aimDir(me.yaw, me.pitch);
  const onTarget = see && D.rayFighter(D.eye(me), dir, opp) < D.rayBoxes(d.arena, D.eye(me), dir, me.weapon.range);
  $('cross').classList.toggle('on', onTarget);
}

// ---------- touch controls ----------
const hud = $('duelHud');
const stick = $('stick');
hud.addEventListener('pointerdown', (e) => {
  const d = G.duel;
  if (!d) return;
  e.preventDefault();
  const id = e.target.id;
  if (id === 'reloadBtn') { D.startReload(d.me); sfx.reload(); return; }
  if (id === 'zoomBtn') { toggleZoom(); return; }
  if (id === 'fireBtn') {
    input.fire = true;
    $('fireBtn').classList.add('held');
    input.fireId = e.pointerId;
    if (d.phase === 'fight' && d.me.hp > 0) fire(d.me, true); // a quick tap still shoots
    if (input.lookId == null) { input.lookId = e.pointerId; input.lx = e.clientX; input.ly = e.clientY; }
    return;
  }
  if (e.clientX < window.innerWidth * 0.42 && input.stickId == null) {
    input.stickId = e.pointerId; input.sx = e.clientX; input.sy = e.clientY;
    stick.style.display = 'block'; stick.style.left = `${e.clientX}px`; stick.style.top = `${e.clientY}px`;
    stick.firstElementChild.style.transform = '';
  } else if (input.lookId == null) {
    input.lookId = e.pointerId; input.lx = e.clientX; input.ly = e.clientY;
  }
});
hud.addEventListener('pointermove', (e) => {
  const d = G.duel;
  if (!d) return;
  if (e.pointerId === input.stickId) {
    let dx = e.clientX - input.sx, dy = e.clientY - input.sy;
    const L = Math.hypot(dx, dy), max = 50;
    if (L > max) { dx *= max / L; dy *= max / L; }
    input.mx = dx / max; input.mz = -dy / max;
    stick.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
  } else if (e.pointerId === input.lookId) {
    const s = 0.0062 * G.sens * (d.me.zoomed ? 0.35 : 1);
    d.me.yaw -= (e.clientX - input.lx) * s;
    d.me.pitch = Math.max(-1.35, Math.min(1.35, d.me.pitch - (e.clientY - input.ly) * s));
    input.lx = e.clientX; input.ly = e.clientY;
  }
});
function release(e) {
  if (e.pointerId === input.stickId) { input.stickId = null; input.mx = input.mz = 0; stick.style.display = 'none'; }
  if (e.pointerId === input.lookId) input.lookId = null;
  if (e.pointerId === input.fireId) { input.fire = false; input.fireId = null; $('fireBtn').classList.remove('held'); }
}
hud.addEventListener('pointerup', release);
hud.addEventListener('pointercancel', release);

function toggleZoom() {
  const d = G.duel;
  if (!d || !d.me.weapon.zoom) return;
  d.me.zoomed = !d.me.zoomed;
  R.setZoom(d.me.zoomed);
  $('scope').classList.toggle('show', d.me.zoomed);
  $('zoomBtn').classList.toggle('on', d.me.zoomed);
}

window.addEventListener('keydown', (e) => {
  input.keys.add(e.code);
  if (e.code === 'KeyR' && G.duel) D.startReload(G.duel.me);
  if (e.code === 'KeyZ') toggleZoom();
});
window.addEventListener('keyup', (e) => input.keys.delete(e.code));
window.addEventListener('blur', () => { input.keys.clear(); input.fire = false; });

// board taps (ignore drags)
let tapStart = null;
const canvas = $('view');
canvas.addEventListener('pointerdown', (e) => { tapStart = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 14) onBoardTap(e.clientX, e.clientY);
  tapStart = null;
});

// ---------- Android ----------
const Cap = window.Capacitor?.Plugins;
try { Cap?.StatusBar?.hide(); } catch {}
try {
  Cap?.App?.addListener('backButton', () => {
    if (G.phase === 'menu') {
      if ($('lobby').classList.contains('show') || $('help').classList.contains('show')) { closeNet(); show('menu'); }
      else Cap.App.exitApp();
    } else if (G.phase === 'board') show('boardHud', $('pause').classList.contains('show') ? null : 'pause');
    else if (G.phase === 'over') toMenu();
  });
} catch {}

// ---------- loop ----------
let lastT = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000);
  lastT = t;
  if (G.phase === 'duel') stepDuel(dt);
  R.frame(dt);
  requestAnimationFrame(loop);
}
R.syncBoard(G.state);
requestAnimationFrame(loop);
