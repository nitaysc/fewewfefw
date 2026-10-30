// Average strokes per hole for each bot level, to keep the game fair for humans.
import { COURSES } from '../www/js/courses.js';
import { HoleSim } from '../www/js/physics.js';
import { BotPlanner } from '../www/js/bot.js';
const RUNS = 4;
for (const skill of ['easy', 'medium', 'hard']) {
  const per = [];
  for (const hole of COURSES[0].holes) {
    let tot = 0;
    for (let k = 0; k < RUNS; k++) {
      const sim = new HoleSim(hole), ball = sim.addBall('b'), pl = new BotPlanner(hole, sim.layout);
      while (ball.state !== 'sunk' && ball.strokes < 8) {
        const g = pl.plan(ball.body.position.clone(), sim.t, skill); let r; do r = g.next(); while (!r.done);
        sim.shoot(ball, r.value.angle, r.value.power);
        const end = sim.t + 30; while (ball.state === 'moving' && sim.t < end) sim.step();
        if (ball.state === 'out') { sim.resetBall(ball, ball.lastRest); ball.strokes++; }
      }
      tot += ball.state === 'sunk' ? ball.strokes : 10;
    }
    per.push((tot / RUNS).toFixed(1));
  }
  console.log(skill.padEnd(6), per.join('  '), ' total', per.reduce((s, v) => s + +v, 0).toFixed(1));
}
