// The Great Lawn: checks that run without a browser.
//  - the page and the code agree (every element id, texture and import exists)
//  - the mower drives, turns and stops at walls the way the game expects
//  - the hands really hold the wheel and the bottle (no fingers through them)
//  - mowing a strip counts the right amount of lawn
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../www/vendor/three.module.js';
import { Vehicle, DIM } from '../www/js/player/vehicle.js';
import { POSES, buildHandSDF } from '../www/js/player/hands.js';
import { CutMap, GRID } from '../www/js/world/cutmap.js';
import { MAP, heightAt, LAWN } from '../www/js/world/layout.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../www');
let failed = 0, passed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ok  ${name}`); } else { failed++; console.log(`FAIL  ${name} ${detail}`); }
};
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const jsFiles = walk(join(root, 'js')).filter((f) => f.endsWith('.js'));
const html = readFileSync(join(root, 'index.html'), 'utf8');

// ---- page and code agree ----
console.log('page wiring');
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
for (const f of jsFiles) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\$\('([A-Za-z0-9_-]+)'\)|getElementById\('([A-Za-z0-9_-]+)'\)/g)) {
    const id = m[1] || m[2];
    check(`#${id} exists (used in ${f.slice(root.length + 1)})`, ids.has(id));
  }
  for (const m of src.matchAll(/^\s*import[^'"]*['"](\.[^'"]+)['"]/gm)) {
    check(`import ${m[1]} from ${f.slice(root.length + 1)}`, existsSync(resolve(dirname(f), m[1])));
  }
  for (const m of src.matchAll(/tex\('([a-z_]+)'/g)) check(`texture ${m[1]}.jpg`, existsSync(join(root, 'assets/tex', `${m[1]}.jpg`)));
  for (const m of src.matchAll(/'(assets\/[^']+\.(?:gltf|hdr|jpg))'/g)) check(`asset ${m[1]}`, existsSync(join(root, m[1])));
}
check('sky photo', existsSync(join(root, 'assets/sky/sky_bg.jpg')));
check('sky HDR', existsSync(join(root, 'assets/sky/sky_1k.hdr')));
check('main script referenced', html.includes('js/main.js'));

// ---- driving ----
console.log('driving');
const openField = { sdf: () => 10, surface: () => ({ gravel: 0, grass: 1, paving: 0 }) };
const ctl = (o) => ({ throttle: 0, steer: 0, boost: false, ...o });
{
  const v = new Vehicle(openField); v.reset(0, 0, 0);
  for (let i = 0; i < 240; i++) v.update(1 / 60, ctl({ throttle: 1 }), 0, false);
  check('top speed about 3.2 m/s', v.v > 2.8 && v.v < 3.4, `got ${v.v.toFixed(2)}`);
  check('drives north at heading 0', v.z < -5 && Math.abs(v.x) < 0.05, `at ${v.x.toFixed(2)}, ${v.z.toFixed(2)}`);
  for (let i = 0; i < 240; i++) v.update(1 / 60, ctl({ throttle: 1, boost: true }), 0, false);
  check('opening the throttle is faster', v.v > 4.6, `got ${v.v.toFixed(2)}`);
  for (let i = 0; i < 180; i++) v.update(1 / 60, ctl({ throttle: -1 }), 0, false);
  check('brakes then reverses', v.v < 0 && v.v > -1.8, `got ${v.v.toFixed(2)}`);
}
{
  const v = new Vehicle(openField); v.reset(0, 0, 0);
  const pts = [];
  for (let i = 0; i < 1200; i++) { v.update(1 / 60, ctl({ throttle: 0.6, steer: 1 }), 0, false); if (i > 300) pts.push([v.x - v.fx * DIM.rearZ, v.z - v.fz * DIM.rearZ]); }
  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const r = pts.reduce((a, p) => a + Math.hypot(p[0] - cx, p[1] - cz), 0) / pts.length;
  check('turning circle a little over 2 m', r > 1.8 && r < 3.2, `radius ${r.toFixed(2)}`);
  check('steering right turns clockwise (to the east first)', pts[0][0] > 0, `x ${pts[0][0].toFixed(2)}`);
}
{
  const wall = { sdf: (x) => 8 - x, surface: () => ({ gravel: 0, grass: 1, paving: 0 }) };
  const v = new Vehicle(wall); v.reset(0, 0, -Math.PI / 2); // facing east, wall at x = 8
  let maxX = -1e9;
  for (let i = 0; i < 600; i++) { v.update(1 / 60, ctl({ throttle: 1 }), 0, false); maxX = Math.max(maxX, v.x); }
  check('stops at a wall', maxX < 8 - 1.0, `reached x ${maxX.toFixed(2)}`);
  check('a hard knock is reported', v.events.some((e) => e.type === 'bump'));
}
{
  const v = new Vehicle(openField); v.reset(0, 0, 0);
  for (let i = 0; i < 300; i++) v.update(1 / 60, ctl({ throttle: 1 }), 0, true);
  const free = v.v;
  const v2 = new Vehicle(openField); v2.reset(0, 0, 0);
  for (let i = 0; i < 300; i++) v2.update(1 / 60, ctl({ throttle: 1 }), 1, true);
  check('long grass slows the mower', v2.v < free - 0.4, `${v2.v.toFixed(2)} vs ${free.toFixed(2)}`);
  check('long grass bogs the engine down', v2.rpm < v.rpm - 200, `${v2.rpm.toFixed(0)} vs ${v.rpm.toFixed(0)} rpm`);
}

// ---- hands ----
console.log('hands');
for (const [name, R] of [['wheel', 0.0135], ['bottle', 0.0325]]) {
  const pose = POSES[name]();
  const { fingers } = buildHandSDF(pose);
  const c = new THREE.Vector3(...pose.grip.c), ax = new THREE.Vector3(...pose.grip.ax).normalize();
  let worst = 1, touching = 0, n = 0;
  for (const ch of fingers.slice(0, 4)) {
    for (let s = 0; s < 3; s++) for (const t of [0.3, 0.7, 1]) {
      const p = ch.joints[s].clone().lerp(ch.joints[s + 1], t), r = ch.r[s] + (ch.r[s + 1] - ch.r[s]) * t;
      const v = p.clone().sub(c); v.addScaledVector(ax, -v.dot(ax));
      const gap = v.length() - (R + r);
      worst = Math.min(worst, gap); n++;
      if (gap < 0.006) touching++;
    }
  }
  check(`${name}: no finger sinks into the grip`, worst > -0.0012, `deepest ${(worst * 1000).toFixed(1)} mm`);
  check(`${name}: fingers close round it`, touching / n > 0.5, `${touching}/${n} points in contact`);
}

// ---- mowing ----
console.log('mowing');
{
  const cm = Object.create(CutMap.prototype);
  cm.cut = new Uint8Array(GRID * GRID); cm.dir = new Uint8Array(GRID * GRID); cm.lawnCell = new Uint8Array(GRID * GRID).fill(1);
  cm.cutLawn = 0; cm.totalLawn = GRID * GRID; cm.listeners = [];
  // the grid is 0.5 m, so average passes at a few offsets across a cell
  let fresh = 0;
  const offs = [0, 0.1, 0.2, 0.3, 0.4];
  offs.forEach((o, i) => { fresh += cm.strokeCPU(0, o + i * 10, 20, o + i * 10, DIM.deckR, 1, 0); });
  const area = fresh * (MAP.size / GRID) ** 2 / offs.length, want = 20 * 2 * DIM.deckR + Math.PI * DIM.deckR ** 2;
  check('a 20 m pass mows about 26 m²', Math.abs(area - want) / want < 0.12, `${area.toFixed(1)} m² vs ${want.toFixed(1)}`);
  const again = cm.strokeCPU(0, 0, 20, 0, DIM.deckR, -1, 0);
  check('mowing it again adds nothing', again === 0);
  const data = cm.serialize();
  const cm2 = Object.create(CutMap.prototype);
  Object.assign(cm2, { cut: new Uint8Array(GRID * GRID), dir: new Uint8Array(GRID * GRID), lawnCell: cm.lawnCell, cutLawn: 0, listeners: [] });
  // restore without a GPU: replay the run-length data
  let k = 0, same = true;
  for (let i = 0; i < data.length; i += 2) for (let j = 0; j < data[i + 1]; j++, k++) { const v = data[i]; if ((v ? 1 : 0) !== cm.cut[k] || (v && v - 1 !== cm.dir[k])) same = false; }
  check('saved lawn reads back exactly', same && k === GRID * GRID);
}
{
  let maxSlope = 0, maxH = 0;
  for (let x = LAWN.x0 + 2; x < LAWN.x1 - 2; x += 2) for (let z = LAWN.z0 + 2; z < LAWN.z1 - 2; z += 2) {
    const h = heightAt(x, z); maxH = Math.max(maxH, Math.abs(h));
    maxSlope = Math.max(maxSlope, Math.abs(heightAt(x + 1, z) - h), Math.abs(heightAt(x, z + 1) - h));
  }
  check('the Great Lawn is nearly level', maxH < 0.5 && maxSlope < 0.08, `max height ${maxH.toFixed(2)} m, slope ${maxSlope.toFixed(3)}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
