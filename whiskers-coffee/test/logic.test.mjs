// Checks the shared café rules without a browser: placement, pathfinding, building and cats.
import { newCafe, canPlace, applyBuild, blockedGrid, findPath, ROOM_W, ROOM_H, tilesOf, strays, adoptPrice, MAX_CATS, upgradeCafe } from '../www/js/game/world.js';
import { IsoPainter } from '../www/js/art/iso.js';
import { DRINKS, DRINK_ORDER, finalBuild, cupPix, orderPrice, tipFor, starsFor, stepsFor, surfaceMap } from '../www/js/art/drinks.js';
import { STEPS } from '../www/js/brew/station.js';
import { paintRoom, WALL_ORDER, FLOOR_ORDER } from '../www/js/art/room.js';
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
  check('drink is made', sim2.shop.brewed('me', cust.id, 1) === null && sim2.players.get('me').carry.drink === cust.order);
  const money = c2.money, due = orderPrice(cust.order, cust.extra);
  sim2.shop.serve('me', cust.id);
  for (let i = 0; i < 400 && cust.state === 'order'; i++) sim2.step(0.05);
  check('serving pays for the drink', cust.state === 'drink' && !sim2.players.get('me').carry);
  check('a perfect drink earns a 50% tip', c2.money - money >= due + Math.round(due * 0.5) && cust.stars === 3);
  for (let i = 0; i < 2000 && sim2.shop.list.has(cust.id); i++) sim2.step(0.05);
  check('the customer leaves happily afterwards', !sim2.shop.list.has(cust.id));
  check('unlock a recipe', applyBuild(c2, { op: 'recipe', id: 'cappuccino' }) === null && c2.recipes.includes('cappuccino'));
  check('snapshot carries customers', Array.isArray(sim2.snapshot().u));
}

// walls and floors: buy once, switch back for free
{
  const c = newCafe('Decor');
  c.money = 500;
  check('café starts with cream walls and oak floor', c.decor.wall === 'cream' && c.decor.floor === 'oak');
  check('buy rose wallpaper', applyBuild(c, { op: 'style', kind: 'wall', id: 'rose' }) === null && c.decor.wall === 'rose' && c.money === 380);
  check('switch back to cream for free', applyBuild(c, { op: 'style', kind: 'wall', id: 'cream' }) === null && c.money === 380);
  check('switch to rose again for free', applyBuild(c, { op: 'style', kind: 'wall', id: 'rose' }) === null && c.money === 380);
  c.money = 5;
  check('cannot buy a floor without coins', applyBuild(c, { op: 'style', kind: 'floor', id: 'tatami' }) === 'Not enough coins' && c.decor.floor === 'oak');
  check('unknown styles are refused', applyBuild(c, { op: 'style', kind: 'wall', id: 'lava' }) !== null);
  let painted = true;
  for (const w of WALL_ORDER) for (const f of FLOOR_ORDER.slice(0, 1)) { try { paintRoom(ROOM_W, ROOM_H, undefined, f, w); } catch { painted = false; } }
  for (const f of FLOOR_ORDER) { try { paintRoom(ROOM_W, ROOM_H, undefined, f, 'cream'); } catch { painted = false; } }
  check('every wall and floor style paints', painted);
}

// every piece of furniture paints in all four rotations
{
  let ok = true;
  for (const [id, def] of Object.entries(CATALOG)) for (let r = 0; r < 4; r++) {
    try { const p = new IsoPainter(...def.size, def.rotates ? r : 0); def.paint(p); p.bake(); } catch (e) { ok = false; console.log('  paint failed', id, r, e.message); }
  }
  check('all furniture paints in every rotation', ok);
}

// adopting cats
{
  const c = newCafe('Cats');
  const ev = [];
  const s = new Sim(c, (t, d) => ev.push([t, d]));
  c.money = 10000;
  const first = strays(c);
  check('three different strays at the shelter', first.length === 3 && new Set(first.map((k) => k.coat)).size === 3);
  check('strays are the same on every phone', JSON.stringify(strays(JSON.parse(JSON.stringify(c)))) === JSON.stringify(first));
  const price = adoptPrice(c), money = c.money;
  check('adopt a cat', s.build({ op: 'adopt', pick: 1 }) === null && c.cats.length === 3 && c.money === money - price && c.cats[2].coat === first[1].coat);
  check('the new cat walks into the café', s.cats.has(c.cats[2].id) && ev.some(([t, d]) => t === 'fx' && d.kind === 'adopted'));
  check('the shelter has new cats afterwards', JSON.stringify(strays(c)) !== JSON.stringify(first));
  check('adopting gets a little dearer', adoptPrice(c) > price);
  while (c.cats.length < MAX_CATS) s.build({ op: 'adopt', pick: 0 });
  check('no more than six cats', s.build({ op: 'adopt', pick: 0 }) !== null && c.cats.length === MAX_CATS);
  const id = c.cats[0].id;
  check('rename a cat', s.build({ op: 'catname', id, name: '  Momo<b>  ' }) === null && c.cats[0].name === 'Momob');
  check('a cat needs a name', s.build({ op: 'catname', id, name: '   ' }) !== null);
  const m2 = c.money;
  check('buy a collar', s.build({ op: 'collar', id, collar: 'red' }) === null && c.cats[0].collar === 'red' && c.money < m2);
  for (let i = 0; i < 200; i++) s.step(0.05);
  check('snapshot carries every cat', s.snapshot().c.length === MAX_CATS);
}

// saves from before decor and adoption still open
{
  const old = newCafe('Old');
  delete old.decor; delete old.adoptSeed; delete old.recipes;
  const s = new Sim(old, () => {});
  check('old saves get walls, floors and a shelter', old.decor?.wall === 'cream' && old.adoptSeed != null && old.recipes.length === 3 && strays(old).length === 3);
}

// new seats: customers can sit on cushions, hay bales and wicker chairs
{
  const c = newCafe('Seats');
  c.money = 5000;
  c.furniture = c.furniture.filter((f) => !CATALOG[f.type].seat);
  applyBuild(c, { op: 'buy', type: 'chabudai', x: 6, y: 6 });
  applyBuild(c, { op: 'buy', type: 'zabuton', x: 5, y: 6 });
  applyBuild(c, { op: 'buy', type: 'hay_bale', x: 8, y: 7 });
  const s = new Sim(c, () => {});
  const seats = s.shop.seats();
  check('cushion and hay bale are seats at their own heights', seats.length === 2 && seats.some((x) => x.z === 3) && seats.some((x) => x.z === 10));
  check('a customer sits on the cushion or bale', s.shop.spawn());
}

// drinks: recipes, extras and their looks
{
  check('every recipe step has a minigame', DRINK_ORDER.every((id) => [...DRINKS[id].steps, 'cream', 'caramel', 'cinnamon'].every((k) => STEPS[k])));
  let ok = true;
  for (const id of DRINK_ORDER) for (const ex of ['', ...DRINKS[id].extras]) {
    try { const b = finalBuild(id, ex); surfaceMap(b); cupPix(id, ex); if (b.layers.reduce((a, l) => a + l.amt, 0) > 1.01) ok = false; } catch (e) { ok = false; console.log('  drink failed', id, ex, e.message); }
  }
  check('every drink and extra draws and fits its cup', ok);
  check('extras add a step and cost a little more', stepsFor('latte', 'caramel').length === DRINKS.latte.steps.length + 1 && orderPrice('latte', 'caramel') > orderPrice('latte'));
  check('stars and tips grow with quality', starsFor(0.95) === 3 && starsFor(0.6) === 2 && starsFor(0.2) === 1 && tipFor(20, 0.95) > tipFor(20, 0.6) && tipFor(20, 0.2) === 0);

  // an order with an extra needs that extra
  const c3 = newCafe('Extras');
  c3.stats.served = 10;
  const s3 = new Sim(c3, () => {});
  s3.addPlayer('me', 'Tester', {});
  s3.shop.spawn();
  const u = [...s3.shop.list.values()][0];
  for (let i = 0; i < 400 && u.state === 'enter'; i++) s3.step(0.05);
  u.order = 'latte'; u.extra = 'caramel';
  s3.shop.claim('me', u.id); s3.shop.brewed('me', u.id, 0.6);
  check('the drink carries its extra', s3.players.get('me').carry.extra === 'caramel');
  s3.players.get('me').carry.extra = '';
  check('a drink without the extra is not what they ordered', s3.shop.serve('me', u.id) !== null);
  check('snapshot carries the extra', s3.snapshot().u[0][13] === 'caramel');
}

process.exit(failed ? 1 : 0);
