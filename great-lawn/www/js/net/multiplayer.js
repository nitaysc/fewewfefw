// Mowing together. One player hosts the lawn and is given a four-letter code; friends join
// with it. Players talk to each other directly (WebRTC data channels); PeerJS's public
// server only introduces them. The host relays everything (a star), hands each newcomer the
// lawn as it stands, and from then on every player's mowing strokes reach everyone, so all
// of them are restoring the same lawn. Other players appear as their own mowers and drivers
// (the same models as ours, lighter), smoothly following the positions they send.
import * as THREE from '../../vendor/three.module.js';
import { MowerModel } from '../player/mower.js';
import { Cockpit } from '../player/cockpit.js';
import { DriverHead } from '../player/head.js';
import { DIM } from '../player/vehicle.js';
import { heightAt } from '../world/layout.js';

const PREFIX = 'greatlawn-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_PLAYERS = 4;
export const PAINTS = [
  { name: 'Racing green', color: '#0e3a25' },
  { name: 'Claret', color: '#5a1220' },
  { name: 'Royal blue', color: '#16336e' },
  { name: 'Ivory', color: '#d6ccae' },
  { name: 'Mustard', color: '#94700f' },
];
const NAMES = ['Sir Reginald', 'Lord Fotheringay', 'Colonel Mustard', 'Mr Pumphrey', 'Lady Whitlow', 'The Vicar', 'Major Bagshot', 'Jenkins'];
export const randomName = () => NAMES[Math.floor(Math.random() * NAMES.length)];
export const makeCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

const r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;

// The connection broker: PeerJS's free cloud by default; ?peerhost=&peerport= for a local one
function peerOptions() {
  const p = new URLSearchParams(location.search);
  const host = p.get('peerhost');
  if (!host) return { debug: 0 };
  return { host, port: +(p.get('peerport') || 9000), path: p.get('peerpath') || '/', secure: false, debug: 0, config: { iceServers: [] } };
}
async function loadPeer() { return (await import('../../vendor/peerjs.mjs')).Peer; }
function openPeer(Peer, id) {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    const t = setTimeout(() => { peer.destroy(); reject(new Error('The connection service did not answer.')); }, 15000);
    peer.once('open', () => { clearTimeout(t); resolve(peer); });
    peer.once('error', (e) => { clearTimeout(t); peer.destroy(); reject(e); });
  });
}

// ------------------------------------------------------------------ another player's mower
class RemotePlayer {
  constructor(game, info) {
    this.info = info;
    this.id = info.id;
    this.root = new THREE.Group();
    this.root.name = 'remote-' + info.id;
    game.scene.add(this.root);
    this.mower = new MowerModel({ paint: info.color });
    this.root.add(this.mower.group);
    this.head = new THREE.Object3D(); this.head.position.copy(DIM.eye); this.root.add(this.head);
    this.headLook = new THREE.Object3D(); this.head.add(this.headLook);
    const Q = { ...game.Q, handRes: 0.004, treeDetail: Math.min(game.Q.treeDetail, 0.7) };
    this.root.position.set(info.x ?? 0, 0, info.z ?? 0);
    this.root.updateMatrixWorld(true);
    // the same driver as ours, animated from what the other player sends
    const proxy = { scene: game.scene, camera: game.camera, mower: this.mower, mowerRoot: this.root, Q, headLook: this.headLook, settings: game.settings };
    this.cockpit = new Cockpit(proxy, { tone: info.tone });
    this.driver = new DriverHead({ quality: Q, tone: info.tone });
    this.headLook.add(this.driver.group);
    this.vs = { steer: 0, frontSpin: 0, wheelSpin: 0, throttle: 0, rpm: 1100, v: 0 };
    this.s = null; this.at = 0;
    this.x = info.x ?? 0; this.z = info.z ?? 0; this.h = info.h ?? 0;
    this.label = document.createElement('div');
    this.label.className = 'net-label';
    this.label.textContent = info.name;
    this.label.style.borderColor = info.color;
    document.getElementById('netLabels')?.appendChild(this.label);
  }
  receive(s) {
    if (!this.s) { this.x = s.x; this.z = s.z; this.h = s.h; }
    this.s = s; this.at = performance.now();
  }
  update(dt, game) {
    const s = this.s;
    if (!s) { this.root.visible = false; return; }
    this.root.visible = true;
    // aim a little ahead of the last report (it is up to a twelfth of a second old)
    const ahead = Math.min(0.25, (performance.now() - this.at) / 1000);
    const fx = -Math.sin(s.h), fz = -Math.cos(s.h);
    const tx = s.x + fx * s.v * ahead, tz = s.z + fz * s.v * ahead;
    const k = 1 - Math.exp(-dt * 10);
    this.x += (tx - this.x) * k; this.z += (tz - this.z) * k;
    this.h += Math.atan2(Math.sin(s.h - this.h), Math.cos(s.h - this.h)) * k;
    this.root.position.set(this.x, heightAt(this.x, this.z), this.z);
    this.root.rotation.set(0, this.h, 0, 'YXZ');
    const vs = this.vs;
    vs.steer += (s.st - vs.steer) * k; vs.v = s.v; vs.throttle = s.v > 0.05 ? 1 : 0;
    vs.wheelSpin += s.v * dt / 0.38; vs.frontSpin += s.v * dt / 0.24;
    vs.rpm += ((1100 + Math.abs(s.v) * 520 + (s.b ? 500 : 0)) - vs.rpm) * k;
    this.mower.update(dt, vs, { bladesOn: !!s.b, boost: false, time: game.time, fuel: 0.8 });
    this.root.updateMatrixWorld(true);
    // the driver: ale and cigar as reported
    const ck = this.cockpit;
    ck.bottle.fill = s.f; ck.cigarLeft = Math.max(0.03, s.c);
    if (s.w && ck.swapT < 0) { ck.swapT = 0; ck.refilled = false; }
    this.headLook.rotation.set(-0.12 + ck.headTilt, 0, 0, 'YXZ');
    this.headLook.updateMatrixWorld(true);
    ck.update(dt, { drink: !!s.d, puff: !!s.p, pressed: new Set() }, true);
    ck.bottle.fill = s.f;
    ck.events.length = 0;
  }
  placeLabel(camera, w, h) {
    const p = _v.set(this.x, this.root.position.y + 2.05, this.z);
    const d = p.distanceTo(camera.position);
    p.project(camera);
    const on = this.root.visible && p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 && d < 90;
    this.label.style.display = on ? '' : 'none';
    if (on) this.label.style.transform = `translate(${((p.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-p.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%)`;
  }
  dispose(game) {
    game.scene.remove(this.root);
    this.root.traverse((o) => { if (o.isMesh) { o.geometry?.dispose?.(); } });
    for (const g of [this.cockpit.leftRig, this.cockpit.rightRig, this.cockpit.bottle.group]) game.scene.remove(g);
    for (const a of Object.values(this.cockpit.body.arms)) game.scene.remove(a.rm.mesh);
    this.label.remove();
  }
}
const _v = new THREE.Vector3();

// ------------------------------------------------------------------ the session
export class Net {
  constructor(game) {
    this.game = game;
    this.role = null;          // 'host' or 'guest' while playing together
    this.code = '';
    this.myId = 0;
    this.me = { name: randomName(), color: PAINTS[0].color };
    this.players = new Map();  // id -> RemotePlayer
    this.conns = new Map();    // host: guest id -> connection; guest: 0 -> host
    this.strokes = [];
    this.sendTimer = 0;
    this.onEvent = () => {};   // (kind, text) for toasts and the menus
  }
  get active() { return !!this.role; }
  get count() { return this.active ? 1 + this.players.size : 1; }

  async host(me) {
    this.me = me;
    const Peer = await loadPeer();
    let lastErr = null;
    for (let attempt = 0; attempt < 3 && !this.peer; attempt++) {
      const code = makeCode();
      try { this.peer = await openPeer(Peer, PREFIX + code); this.code = code; } catch (e) { lastErr = e; if (e.type !== 'unavailable-id') break; }
    }
    if (!this.peer) throw lastErr || new Error('Could not open the gates.');
    this.role = 'host'; this.myId = 0; this.nextId = 1;
    this.peer.on('connection', (conn) => this.acceptGuest(conn));
    this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (e) { /* closed */ } });
    return this.code;
  }

  acceptGuest(conn) {
    const id = this.nextId++;
    conn.on('data', (m) => this.fromGuest(id, conn, m));
    conn.on('close', () => this.drop(id, true));
    conn.on('error', () => this.drop(id, true));
  }

  fromGuest(id, conn, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      if (this.players.size + 1 >= MAX_PLAYERS) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 400); return; }
      const v = this.game.vehicle;
      const roster = [{ id: 0, name: this.me.name, color: this.me.color, x: v.x, z: v.z, h: v.heading },
        ...[...this.players.values()].map((p) => ({ ...p.info, x: p.x, z: p.z, h: p.h }))];
      this.conns.set(id, conn);
      conn.send({ t: 'welcome', id, lawn: this.game.cutmap.serialize(), players: roster });
      const info = { id, name: String(m.name || 'A guest').slice(0, 18), color: m.color || PAINTS[1].color };
      this.add(info);
      this.broadcast({ t: 'join', ...info }, id);
      this.onEvent('join', `${info.name} has come to help with the mowing.`);
    } else if (m.t === 'state' || m.t === 'cut') {
      if (!this.conns.has(id)) return;
      m.id = id;   // the host decides who is who
      this.apply(m);
      this.broadcast(m, id);
    }
  }

  async join(code, me) {
    this.me = me;
    this.code = cleanCode(code);
    if (this.code.length !== 4) throw new Error('Codes are four letters and numbers.');
    const Peer = await loadPeer();
    this.peer = await openPeer(Peer);
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true });
    const lawn = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('No lawn answers to that code.')), 15000);
      this.welcome = { resolve: (l) => { clearTimeout(t); resolve(l); }, reject: (e) => { clearTimeout(t); reject(e); } };
      this.peer.on('error', (e) => this.welcome?.reject(e.type === 'peer-unavailable' ? new Error('No lawn answers to that code.') : e));
      conn.on('open', () => conn.send({ t: 'hello', name: me.name, color: me.color }));
      conn.on('data', (m) => this.fromHost(m));
      conn.on('close', () => this.hostGone());
      conn.on('error', () => this.hostGone());
    });
    this.conns.set(0, conn);
    this.role = 'guest';
    return lawn;
  }

  fromHost(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'welcome') {
      this.myId = m.id;
      for (const p of m.players) this.add(p);
      this.welcome?.resolve(m.lawn); this.welcome = null;
    } else if (m.t === 'full') {
      this.welcome?.reject(new Error(`That lawn already has ${MAX_PLAYERS} mowers on it.`)); this.welcome = null;
    } else if (m.t === 'join') {
      this.add(m);
      this.onEvent('join', `${m.name} has come to help with the mowing.`);
    } else if (m.t === 'leave') this.drop(m.id, false);
    else if (m.t === 'state' || m.t === 'cut') this.apply(m);
  }

  hostGone() {
    if (this.role !== 'guest') return;
    this.onEvent('left', 'The host has gone in for tea. You are mowing on your own now.');
    this.leave();
  }

  add(info) {
    if (info.id === this.myId || this.players.has(info.id)) return;
    this.players.set(info.id, new RemotePlayer(this.game, info));
  }
  drop(id, tell) {
    const p = this.players.get(id);
    if (this.conns.has(id)) { try { this.conns.get(id).close(); } catch (e) { /* gone */ } this.conns.delete(id); }
    if (!p) return;
    p.dispose(this.game);
    this.players.delete(id);
    if (tell && this.role === 'host') this.broadcast({ t: 'leave', id });
    this.onEvent('left', `${p.info.name} has gone in for tea.`);
  }

  apply(m) {
    if (m.t === 'state') this.players.get(m.id)?.receive(m);
    else if (m.t === 'cut' && Array.isArray(m.s)) {
      const cm = this.game.cutmap, s = m.s;
      for (let i = 0; i + 5 < s.length; i += 6) cm.stroke({ x: s[i], y: s[i + 1] }, { x: s[i + 2], y: s[i + 3] }, DIM.deckR, { x: s[i + 4], y: s[i + 5] });
    }
  }

  broadcast(m, except) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(m); }
  send(m) { if (this.role === 'host') this.broadcast(m); else { const c = this.conns.get(0); if (c && c.open) c.send(m); } }

  // our own mowing, sent with the next state
  stroke(a, b, dir) { if (this.active) this.strokes.push(r2(a.x), r2(a.y), r2(b.x), r2(b.y), r3(dir.x), r3(dir.y)); }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    this.sendTimer -= dt;
    if (this.sendTimer <= 0) {
      this.sendTimer = 1 / 12;
      const v = g.vehicle, ck = g.cockpit;
      this.send({ t: 'state', id: this.myId, x: r2(v.x), z: r2(v.z), h: r3(v.heading), v: r2(v.v), st: r3(v.steer), b: g.bladesOn ? 1 : 0,
        d: ck.wantDrink ? 1 : 0, p: ck.wantPuff ? 1 : 0, f: r2(ck.bottle.fill), c: r2(ck.cigarLeft), w: ck.swapping ? 1 : 0 });
      if (this.strokes.length) { this.send({ t: 'cut', id: this.myId, s: this.strokes }); this.strokes = []; }
    }
    for (const p of this.players.values()) p.update(dt, g);
    const w = innerWidth, h = innerHeight;
    for (const p of this.players.values()) p.placeLabel(g.camera, w, h);
  }

  leave() {
    for (const id of [...this.players.keys()]) this.drop(id, false);
    for (const c of this.conns.values()) { try { c.close(); } catch (e) { /* gone */ } }
    this.conns.clear();
    try { this.peer?.destroy(); } catch (e) { /* gone */ }
    this.peer = null; this.role = null; this.code = ''; this.strokes = [];
  }
}
