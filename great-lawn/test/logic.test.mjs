// The Great Lawn: checks that run without a browser.
//  - the page and the code agree (every element id, texture and import exists)
//  - the mower drives, turns and stops at walls the way the game expects
//  - the hands really hold the wheel and the bottle (no fingers through them)
//  - mowing a strip counts the right amount of lawn
//  - the arms reach the hands from the shoulders with the right bone lengths
//  - nothing can write an out-of-range colour (the cause of black flashes on phones)
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../www/vendor/three.module.js';
import { Vehicle, DIM } from '../www/js/player/vehicle.js';
import { POSES, buildHandSDF } from '../www/js/player/hands.js';
import { CutMap, GRID } from '../www/js/world/cutmap.js';
import { MAP, heightAt, LAWN } from '../www/js/world/layout.js';
import { solveElbow, ARM } from '../www/js/player/body.js';
import { HDR_MAX } from '../www/js/core/hdrsafe.js';

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
  for (const m of src.matchAll(/'(assets\/[^']+\.(?:json|png|jpg))'/g)) check(`asset ${m[1]}`, existsSync(join(root, m[1])));
}
check('sky photo', existsSync(join(root, 'assets/sky/sky_bg.jpg')));
check('sky HDR (RGBE PNG)', existsSync(join(root, 'assets/sky/sky_rgbe.png')));
// every asset is a type a static web host serves
for (const f of walk(join(root, 'assets'))) check(`served type: ${f.slice(root.length + 1)}`, /\.(jpg|png|json)$/.test(f));
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
      // fingertip flesh gives a little against the rim: allow ~15% of the finger's radius
      const gap = v.length() - (R + r * 0.85);
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

// ---- arms ----
console.log('arms');
{
  const S = new THREE.Vector3(0.185, 1.17, 0.34), down = new THREE.Vector3(0.65, -1, 0.15).normalize();
  // the hand on the wheel rim, forearm running back towards the body
  const W = new THREE.Vector3(0.077, 1.034, -0.109), F = new THREE.Vector3(-0.19, -0.6, 0.78).normalize();
  const E = solveElbow(S, W, F, down);
  check('upper arm keeps its length', Math.abs(E.distanceTo(S) - ARM.UPPER) < 1e-3, E.distanceTo(S).toFixed(4));
  check('forearm keeps its length', Math.abs(E.distanceTo(W) - ARM.FORE) < 1e-3, E.distanceTo(W).toFixed(4));
  check('the elbow hangs below the hand and shoulder', E.y < Math.min(S.y, W.y), E.y.toFixed(3));
  // a hand raised to the lips: the elbow stays low and out to the side
  const W2 = new THREE.Vector3(0.078, 1.14, 0.2), F2 = new THREE.Vector3(0.3, -0.77, 0.56).normalize();
  const E2 = solveElbow(S, W2, F2, down);
  check('raised hand: elbow below the wrist', E2.y < W2.y, E2.y.toFixed(3));
  check('raised hand: elbow out to the side', E2.x > W2.x, E2.x.toFixed(3));
  // out of reach (the crate on the footboard): the arm runs straight towards it
  const W3 = new THREE.Vector3(-0.43, 0.45, 0.12), S3 = new THREE.Vector3(-0.185, 1.17, 0.34);
  const E3 = solveElbow(S3, W3, new THREE.Vector3(0, 1, 0), down);
  const onLine = E3.clone().sub(S3).cross(W3.clone().sub(S3)).length() < 1e-6;
  check('out of reach: elbow on the line to the hand', onLine && Math.abs(E3.distanceTo(S3) - W3.distanceTo(S3) * ARM.UPPER / (ARM.UPPER + ARM.FORE)) < 1e-6);
}

// ---- out-of-range colours ----
console.log('render safety');
{
  const C = THREE.ShaderChunk;
  check('every material clamps its colour before it is stored', C.opaque_fragment.includes('hdrSafe( outgoingLight )') && C.common.includes('vec3 hdrSafe('));
  check('the clamp is far below the half-float limit', HDR_MAX < 65504 / 8);
  const post = readFileSync(join(root, 'js/core/post.js'), 'utf8');
  check('the bloom input is clamped and NaN-free', /materialHighPassFilter/.test(post) && /isnan/.test(post));
  for (const f of jsFiles) {
    const src = readFileSync(f, 'utf8');
    if (/gl_FragColor = vec4\(outgoingLight/.test(src)) check(`${f.slice(root.length + 1)} guards its own output`, false, 'raw outgoingLight written');
  }
  const main = readFileSync(join(root, 'js/main.js'), 'utf8');
  const dyn = main.slice(main.indexOf('dynamic resolution'), main.indexOf('saveTimer -= dt'));
  check('dynamic resolution never resizes the canvas', dyn.includes('setDynScale') && !dyn.includes('resize()'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
