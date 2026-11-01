// Bot-vs-bot duels: every matchup must finish, and stronger pieces should usually win
// without the weaker one being hopeless.
import assert from 'node:assert/strict';
import { makeArena, makeFighter, moveFighter, updateWeapon, tryFire, resolveHitscan, makeRocket, stepRocket, splashDamage, DuelBot, DUEL_TIME, findPath } from '../www/js/duel.js';

let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function fight(att, def, kind) {
  const arena = makeArena(kind);
  const f = [makeFighter(att, 0, arena), makeFighter(def, 1, arena)];
  const bots = f.map((x) => new DuelBot(x, arena, 1, rnd));
  let rockets = [];
  const dt = 1 / 30;
  for (let t = 0; t < DUEL_TIME; t += dt) {
    for (let i = 0; i < 2; i++) {
      const me = f[i], them = f[1 - i];
      updateWeapon(me, dt);
      const ctl = bots[i].think(dt, them);
      moveFighter(me, ctl.mx, ctl.mz, dt, arena, them);
      if (ctl.fire) {
        const dirs = tryFire(me, rnd);
        if (dirs) {
          if (me.weapon.rocket) rockets.push(makeRocket(me, dirs[0]));
          else them.hp -= resolveHitscan(arena, me, them, dirs).damage;
        }
      }
    }
    rockets = rockets.filter((rk) => {
      const boom = stepRocket(rk, dt, arena, f);
      if (!boom) return true;
      for (const x of f) x.hp -= splashDamage(arena, boom, x, f[rk.owner].weapon);
      return false;
    });
    if (f[0].hp <= 0 || f[1].hp <= 0) return { winner: f[1].hp <= 0 && f[0].hp > 0 ? 0 : 1, t };
  }
  return { winner: 1, t: DUEL_TIME, timeout: true };
}

for (const kind of ['light', 'dark']) {
  const a = makeArena(kind);
  assert.ok(findPath(a, { x: 0, z: a.d / 2 - 2.5 }, { x: 0, z: -a.d / 2 + 2.5 }).length > 10, `${kind} arena is connected`);
}

const types = 'pnbrqk';
const table = {};
let timeouts = 0, total = 0;
for (const a of types) for (const d of types) {
  let wins = 0;
  const N = a + d === 'pq' || a + d === 'qp' ? 40 : 12;
  for (let i = 0; i < N; i++) {
    const r = fight(a, d, i % 2 ? 'dark' : 'light');
    if (r.winner === 0) wins++;
    if (r.timeout) timeouts++;
    total++;
  }
  table[a + 'x' + d] = wins / N;
}
console.log('attacker win rate (row attacks column):');
console.log('    ' + [...types].join('     '));
for (const a of types) console.log(a + '  ' + [...types].map((d) => table[a + 'x' + d].toFixed(2)).join('  '));
console.log(`timeouts: ${timeouts}/${total}`);
assert.ok(timeouts / total < 0.15, 'most duels should end before the clock');
assert.ok(table.qxp > 0.5, 'queen should usually beat a pawn');
assert.ok(table.pxq > 0, 'a pawn should sometimes beat a queen');
console.log('duel tests passed');
