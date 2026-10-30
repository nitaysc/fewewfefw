// Bots plan each putt by replaying candidate shots in a private copy of the hole,
// then add aim/power error according to their skill.
import { HoleSim } from './physics.js';

export const SKILLS = {
  easy: { angleErr: 0.24, powerErr: 0.32, angles: 16 },
  medium: { angleErr: 0.13, powerErr: 0.2, angles: 24 },
  hard: { angleErr: 0.03, powerErr: 0.05, angles: 32 },
};
const POWERS = [0.2, 0.35, 0.5, 0.7, 0.9];
const MAX_SIM_TIME = 7;

export class BotPlanner {
  constructor(hole, layout) {
    this.sim = new HoleSim(hole, layout);
    this.ball = this.sim.addBall('planner');
  }

  simulate(from, angle, power, t0) {
    const { sim, ball } = this;
    sim.resetBall(ball, from);
    sim.t = t0;
    sim.shoot(ball, angle, power);
    const end = t0 + MAX_SIM_TIME;
    while (ball.state === 'moving' && sim.t < end) sim.step();
    let score;
    if (ball.state === 'sunk') score = -100 + (sim.t - t0) * 0.1;
    else if (ball.state === 'out') score = 500;
    else score = sim.pathDistance(ball.body.position);
    return score;
  }

  // a generator so the search can be spread over several frames; the final value is the shot
  *plan(from, t0, skillName, rand = Math.random) {
    const skill = SKILLS[skillName] || SKILLS.medium;
    const tried = [];
    const n = skill.angles;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      for (const p of POWERS) {
        tried.push({ a, p, s: this.simulate(from, a, p, t0) });
      }
      yield;
    }
    tried.sort((x, y) => x.s - y.s);
    // refine around the best few
    const seeds = tried.slice(0, 3);
    for (const seed of seeds) {
      if (seed.s < -50) break;
      for (const da of [-0.08, -0.04, 0.04, 0.08]) {
        for (const dp of [-0.08, 0, 0.08]) {
          const a = seed.a + da, p = Math.min(1, Math.max(0.08, seed.p + dp));
          tried.push({ a, p, s: this.simulate(from, a, p, t0) });
        }
      }
      yield;
    }
    tried.sort((x, y) => x.s - y.s);
    const best = tried[0];
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
    return {
      angle: best.a + gauss() * skill.angleErr,
      power: Math.min(1, Math.max(0.05, best.p * (1 + gauss() * skill.powerErr))),
      expected: best.s,
    };
  }
}
