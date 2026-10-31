// Checks the shared café rules without a browser: placement, pathfinding, building and cats.
import { newCafe, canPlace, applyBuild, blockedGrid, findPath, ROOM_W, ROOM_H, tilesOf } from '../www/js/game/world.js';
import { Sim } from '../www/js/game/sim.js';
import { CATALOG } from '../www/js/game/catalog.js';

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failed++; };

const cafe = newCafe('Test');
// the starting layout must be valid
check('starting furniture does not overlap', cafe.furniture.every((f) => canPlace(cafe, f, f.id)));
check('every catalog item has a footprint and price', Object.values(CATALOG).every((d) => d.size && d.price >= 0 && d.paint));

// every free tile can be reached from the door
const grid = blockedGrid(cafe);
let unreachable = 0;
for (let y = 0; y < ROOM_H; y++) for (let x = 0; x < ROOM_W; x++) if (!grid[y * ROOM_W + x] && !findPath(grid, 1.5, 5.5, x + 0.5, y + 0.5)) unreachable++;
check('all open floor is reachable from the door', unreachable === 0);

// buying costs money and is refused when it doesn't fit or can't be afforded
const before = cafe.money;
check('buy a plant in a free spot', applyBuild(cafe, { op: 'buy', type: 'plant_big', x: 2, y: 3 }) === null && cafe.money === before - CATALOG.plant_big.price);
check('cannot buy onto the espresso bar', applyBuild(cafe, { op: 'buy', type: 'stool', x: 4, y: 2 }) !== null);
check('cannot block the door', applyBuild(cafe, { op: 'buy', type: 'stool', x: 0, y: 5 }) !== null);
cafe.money = 10;
check('cannot buy without coins', applyBuild(cafe, { op: 'buy', type: 'sofa', x: 2, y: 4 }) === 'Not enough coins');
cafe.money = 1000;

// store and place back
const plant = cafe.furniture.find((f) => f.type === 'plant_big' && f.x === 2);
check('store furniture', applyBuild(cafe, { op: 'store', id: plant.id }) === null && cafe.inventory.plant_big === 1);
check('place from storage', applyBuild(cafe, { op: 'place', type: 'plant_big', x: 2, y: 3 }) === null && !cafe.inventory.plant_big);
const bar = cafe.furniture.find((f) => f.type === 'espresso');
check('the espresso bar cannot be stored', applyBuild(cafe, { op: 'store', id: bar.id }) !== null);

// rotating a 2x1 sofa swaps its footprint
applyBuild(cafe, { op: 'buy', type: 'sofa', x: 2, y: 8 });
const sofa = cafe.furniture.find((f) => f.type === 'sofa');
check('sofa footprint is 2x1', tilesOf(sofa).length === 2);

// a player walks and pets a cat; the cat's affection goes up
const events = [];
const sim = new Sim(cafe, (t, d) => events.push([t, d]));
sim.addPlayer('me', 'Tester', {});
const cat = [...sim.cats.values()][0];
sim.petCat('me', cat.id);
for (let i = 0; i < 400; i++) sim.step(0.05);
check('petting a cat sends hearts', events.some(([t, d]) => t === 'fx' && d.kind === 'hearts'));
check('petting raises affection', cafe.cats.find((c) => c.id === cat.id).affection > 0);

// cats keep doing things on their own
const states = new Set();
for (let i = 0; i < 2400; i++) { sim.step(0.05); for (const c of sim.cats.values()) states.add(c.state); }
check('cats move between behaviours', states.size >= 3);

// snapshots are small and carry everyone
const snap = sim.snapshot();
check('snapshot carries players and cats', snap.p.length === 1 && snap.c.length === cafe.cats.length && !('t' in snap));

// customers: arrive, sit, order, get a drink made and served, and pay
{
  const c2 = newCafe('Shop');
  const sim2 = new Sim(c2, () => {});
  sim2.addPlayer('me', 'Tester', {});
  check('café starts with three recipes', c2.recipes.length === 3);
  check('customer finds a seat', sim2.shop.spawn());
  const cust = [...sim2.shop.list.values()][0];
  for (let i = 0; i < 400 && cust.state === 'enter'; i++) sim2.step(0.05);
  check('customer sits and orders', cust.state === 'order' && c2.recipes.includes(cust.order) && cust.z > 0);
  check('claiming the order works', sim2.shop.claim('me', cust.id) === null);
  sim2.addPlayer('friend', 'Friend', {});
  check('a friend cannot claim the same order', sim2.shop.claim('friend', cust.id) !== null);
  check('drink is made', sim2.shop.brewed('me', cust.id) === null && sim2.players.get('me').carry.drink === cust.order);
  const money = c2.money;
  sim2.shop.serve('me', cust.id);
  for (let i = 0; i < 400 && cust.state === 'order'; i++) sim2.step(0.05);
  check('serving pays for the drink', cust.state === 'drink' && c2.money > money && !sim2.players.get('me').carry);
  for (let i = 0; i < 2000 && sim2.shop.list.has(cust.id); i++) sim2.step(0.05);
  check('the customer leaves happily afterwards', !sim2.shop.list.has(cust.id));
  check('unlock a recipe', applyBuild(c2, { op: 'recipe', id: 'cappuccino' }) === null && c2.recipes.includes('cappuccino'));
  check('snapshot carries customers', Array.isArray(sim2.snapshot().u));
}

process.exit(failed ? 1 : 0);
