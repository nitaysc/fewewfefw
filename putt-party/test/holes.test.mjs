// Plays every hole with a perfect bot to prove each one can be finished,
// and reports how many putts it took and how long planning took.
import { COURSES } from '../www/js/courses.js';
import { HoleSim } from '../www/js/physics.js';
import { BotPlanner } from '../www/js/bot.js';

let failed = 0;
for (const course of COURSES) {
  course.holes.forEach((hole, i) => {
    const sim = new HoleSim(hole);
    const ball = sim.addBall('bot');
    const planner = new BotPlanner(hole, sim.layout);
    const outs = [];
    sim.onEvent = (type) => { if (type === 'out') outs.push(sim.t); };
    let planMs = 0;
    while (ball.state !== 'sunk' && ball.strokes < 10) {
      const t0 = performance.now();
      const gen = planner.plan(ball.body.position.clone(), sim.t, 'hard', () => 0.5);
      let r; do r = gen.next(); while (!r.done);
      planMs += performance.now() - t0;
      sim.shoot(ball, r.value.angle, r.value.power);
      const end = sim.t + 30;
      while (ball.state === 'moving' && sim.t < end) sim.step();
      if (ball.state === 'out') { sim.resetBall(ball, ball.lastRest); ball.strokes++; }
    }
    const ok = ball.state === 'sunk' && ball.strokes <= hole.par + 1;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${course.id} #${i + 1} ${hole.name}: ${ball.strokes} putts (par ${hole.par}), outs ${outs.length}, planning ${(planMs / ball.strokes).toFixed(0)} ms/shot`);
  });
}
process.exit(failed ? 1 : 0);
