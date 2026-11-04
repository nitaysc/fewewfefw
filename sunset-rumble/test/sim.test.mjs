// Rules and physics checks that run in node: `npm test`.
import assert from 'node:assert/strict';
import { buildWorld, isFree, groundAt } from '../www/js/world.js';
import { newCar, stepCar, emptyInput } from '../www/js/car.js';
import { Match } from '../www/js/sim.js';
import { Bot } from '../www/js/bot.js';

const world = buildWorld(7);
const dt = 1 / 60;
let fails = 0;
const test = (name, fn) => { try { fn(); console.log('ok  ', name); } catch (e) { fails++; console.log('FAIL', name, '\n  ', e.message); } };

test('the town builds the same every time', () => {
  assert.equal(JSON.stringify(buildWorld(7)), JSON.stringify(world));
});

test('spawn points are clear', () => {
  for (const s of world.spawns) assert.ok(isFree(world, s.x, s.z, 2), `${s.x},${s.z}`);
});

test('every road junction can reach every other', () => {
  const seen = new Set([0]); const q = [0];
  while (q.length) for (const v of world.links[q.shift()]) if (!seen.has(v)) { seen.add(v); q.push(v); }
  assert.equal(seen.size, world.nodes.length);
});

test('a car flat out never goes through a building', () => {
  for (let trial = 0; trial < 40; trial++) {
    const c = newCar({ x: -30, z: -60, h: (trial / 40) * Math.PI * 2 }, 0);
    for (let i = 0; i < 600; i++) {
      stepCar(c, { steer: Math.sin(i / 50 + trial), throttle: 1, drift: false, boost: i % 120 < 60 }, world, dt);
      for (const b of world.boxes) {
        if (c.y > b.h) continue;
        assert.ok(!(c.x > b.x0 + 0.3 && c.x < b.x1 - 0.3 && c.z > b.z0 + 0.3 && c.z < b.z1 - 0.3), `inside a box at ${c.x.toFixed(1)},${c.z.toFixed(1)}`);
      }
      assert.ok(Math.abs(c.x) < world.HALF && Math.abs(c.z) < world.HALF, 'left the town');
    }
  }
});

test('a ramp launches the car', () => {
  const r = world.ramps[0];
  const c = newCar({ x: r.x - Math.sin(r.ang) * 20, z: r.z - Math.cos(r.ang) * 20, h: r.ang }, 0);
  let maxY = 0;
  for (let i = 0; i < 180; i++) { stepCar(c, { steer: 0, throttle: 1, drift: false, boost: true }, world, dt); maxY = Math.max(maxY, c.y); }
  assert.ok(maxY > r.h + 0.5, `max height ${maxY.toFixed(2)}`);
  assert.ok(groundAt(world, r.x, r.z) > 0);
});

test('ramming knocks stars loose', () => {
  const m = new Match(world, { seed: 3 });
  m.phase = 'play'; m.t = 1;
  m.scores = [0, 5];
  const [a, b] = m.cars;
  Object.assign(a, { x: 0, z: 40, h: 0, vx: 0, vz: 30 });
  Object.assign(b, { x: 0, z: 42.8, h: Math.PI / 2, vx: 0, vz: 0 });
  m.step(dt, [emptyInput(), emptyInput()]);
  assert.equal(m.scores[1], 2, 'victim lost three');
  assert.ok(m.events.some((e) => e.k === 'ram' && e.attacker === 0));
  assert.ok(b.spin > 0, 'victim spins');
});

test('two bots finish a match and both score', () => {
  for (const seed of [1, 2, 3]) {
    const m = new Match(world, { seed });
    const bots = [new Bot(world, 0, 'hard'), new Bot(world, 1, 'normal')];
    let steps = 0;
    while (m.phase !== 'over' && steps < 60 * 260) {
      m.step(dt, bots.map((b) => b.update(dt, m)));
      m.events.length = 0;
      steps++;
    }
    const rams = m.stats[0].rams + m.stats[1].rams;
    console.log(`     seed ${seed}: ${m.scores.join(' - ')} in ${(steps / 60).toFixed(0)}s, rams ${rams}`);
    assert.equal(m.phase, 'over');
    assert.ok(m.scores[0] + m.scores[1] >= 10, 'they should find stars');
  }
});

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log('all good');
