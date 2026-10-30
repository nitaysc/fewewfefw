// Bot shot planning runs here so the game never stutters while bots think.
import { COURSES } from './courses.js';
import { BotPlanner } from './bot.js';

let key = null, planner = null;
onmessage = ({ data }) => {
  const { req, course, hole, from, t0, skill } = data;
  if (key !== `${course}:${hole}`) {
    key = `${course}:${hole}`;
    planner = new BotPlanner(COURSES.find((c) => c.id === course).holes[hole]);
  }
  const gen = planner.plan(from, t0, skill);
  let r; do r = gen.next(); while (!r.done);
  postMessage({ req, ...r.value });
};
