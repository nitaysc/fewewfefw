// Checks the shared café rules without a browser: placement, pathfinding, building and cats.
import { newCafe, canPlace, applyBuild, blockedGrid, findPath, ROOM_W, ROOM_H, tilesOf, strays, adoptPrice, MAX_CATS, upgradeCafe } from '../www/js/game/world.js';
import { IsoPainter } from '../www/js/art/iso.js';
import { DRINKS, DRINK_ORDER, finalBuild, cupPix, orderPrice, tipFor, starsFor, surfaceMap, judge, newBuild, pour, needFor } from '../www/js/art/drinks.js';
import { FOODS, FOOD_ORDER, idealPlate, scorePlate, newPlate, platePix, INGREDIENTS, SAUCES, SHAKERS } from '../www/js/art/foods.js';
import { TOOLS } from '../www/js/brew/station.js';
import { DAY_MINUTES, MIN_PER_SEC } from '../www/js/game/customers.js';
import { RU } from '../www/js/lang/ru.js';
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

// customers: arrive, sit, order, get it made and served, pay, and leave a tip on the table
{
  const c2 = newCafe('Shop');
  const sim2 = new Sim(c2, () => {});
  sim2.addPlayer('me', 'Tester', {});
  check('café starts with drinks and food on the menu', c2.recipes.length >= 3 && c2.foods.length >= 3);
  check('customer finds a seat', sim2.shop.spawn());
  const cust = [...sim2.shop.list.values()][0];
  for (let i = 0; i < 400 && cust.state === 'enter'; i++) sim2.step(0.05);
  check('customer sits and orders', cust.state === 'order' && cust.items.length >= 1 && cust.z > 0);
  cust.items = [{ kind: 'drink', id: 'latte', extra: '', by: null, done: false }, { kind: 'food', id: 'shortcake', extra: '', by: null, done: false }];
  check('claiming an item works', sim2.shop.claim('me', cust.id, 0) === null && cust.items[0].by === 'me');
  sim2.addPlayer('friend', 'Friend', {});
  check('a friend cannot claim the same item', sim2.shop.claim('friend', cust.id, 0) !== null);
  check('but the friend can make the food', sim2.shop.claim('friend', cust.id, 1) === null);
  check('drink is made', sim2.shop.brewed('me', cust.id, 0, 1) === null && sim2.players.get('me').carry.id === 'latte');
  const money = c2.money;
  sim2.shop.serve('me', cust.id);
  for (let i = 0; i < 400 && !cust.items[0].done; i++) sim2.step(0.05);
  check('serving pays the price', cust.items[0].done && c2.money === money + orderPrice('latte') && !sim2.players.get('me').carry);
  check('they keep waiting for the rest of the order', cust.state === 'order');
  check('a perfect item earns a tip for later', cust.tip >= Math.round(orderPrice('latte') * 0.5));
  // a badly made dish is politely refused and has to be made again
  sim2.shop.brewed('friend', cust.id, 1, 0.1);
  sim2.shop.serve('friend', cust.id);
  for (let i = 0; i < 400 && sim2.players.get('friend').carry; i++) sim2.step(0.05);
  check('a mix-up is refused and the item stays open', !cust.items[1].done && cust.items[1].by === 'friend');
  sim2.shop.brewed('friend', cust.id, 1, 0.9);
  sim2.shop.serve('friend', cust.id);
  for (let i = 0; i < 400 && !cust.items[1].done; i++) sim2.step(0.05);
  check('once everything arrives they enjoy it', cust.state === 'drink');
  for (let i = 0; i < 2000 && sim2.shop.list.has(cust.id); i++) sim2.step(0.05);
  check('the customer leaves happily afterwards', !sim2.shop.list.has(cust.id));
  check('and leaves a tip on the table', c2.tips.length === 1 && c2.tips[0].amount > 0);
  const m2 = c2.money, tipAmt = c2.tips[0].amount;
  sim2.shop.collectTip('me', c2.tips[0].id);
  check('tapping the tip collects it', c2.tips.length === 0 && c2.money === m2 + tipAmt && c2.day.today.tips === tipAmt);
  check('unlock a recipe', applyBuild(c2, { op: 'recipe', id: 'cappuccino' }) === null && c2.recipes.includes('cappuccino'));
  c2.money = 1000;
  check('unlock a dish', applyBuild(c2, { op: 'recipe', kind: 'food', id: 'pancakes' }) === null && c2.foods.includes('pancakes'));
  const snap = sim2.snapshot();
  check('snapshot carries customers, tips and the day', Array.isArray(snap.u) && Array.isArray(snap.tp) && snap.d.length === 4);
}

// the day: open, closing, closed, then the next morning
{
  const c = newCafe('Day');
  const s = new Sim(c, () => {});
  check('a café starts on day 1, open', c.day.n === 1 && c.day.phase === 'open');
  for (let i = 0; i < (DAY_MINUTES / MIN_PER_SEC) * 20 + 20; i++) s.step(0.05);
  check('at closing time no one new comes in', c.day.phase !== 'open');
  for (let i = 0; i < 20000 && c.day.phase !== 'closed'; i++) s.step(0.05);
  check('once everyone has left the day is over', c.day.phase === 'closed' && s.shop.list.size === 0);
  check('the next day starts fresh', s.shop.nextDay() === null && c.day.n === 2 && c.day.phase === 'open' && c.day.today.served === 0);
  check('closing early works', s.shop.closeEarly() === null && c.day.phase === 'closing');
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

// drinks: recipes, judging, spills and looks
{
  const tools = new Set(Object.keys(TOOLS));
  const makes = { espresso: 'shot', water: 'water', tea: 'water', milk: 'pourmilk', foam: 'pourmilk', drizzle: 'drizzle' };
  check('every recipe ingredient has a tool', DRINK_ORDER.every((id) => Object.keys(needFor(id, DRINKS[id].extras[0] || '')).every((k) => tools.has(makes[k] || k))));
  let ok = true;
  for (const id of DRINK_ORDER) for (const ex of ['', ...DRINKS[id].extras]) {
    try {
      const b = finalBuild(id, ex); surfaceMap(b); cupPix(id, ex);
      if (b.layers.reduce((a, l) => a + l.amt, 0) > 1.01) ok = false;
      const j = judge(b, id, ex);
      if (j.q < 0.85) { ok = false; console.log('  ideal drink not perfect', id, ex, j.q.toFixed(2), JSON.stringify(j.notes)); }
    } catch (e) { ok = false; console.log('  drink failed', id, ex, e.message); }
  }
  check('every drink made by the recipe gets 3 stars', ok);
  const b = newBuild('latte', '', 'glass');
  pour(b, 'espresso', 0.25);
  check('a latte without milk is not a latte', judge(b, 'latte').q < 0.6);
  const spilt = pour(b, 'milk', 0.9);
  check('pouring too much spills over the rim', spilt > 0 && b.messy);
  const wrongCup = finalBuild('latte'); wrongCup.vessel = 'mug';
  check('the wrong cup costs a little', judge(wrongCup, 'latte').q < judge(finalBuild('latte'), 'latte').q);
  check('stars and tips grow with quality', starsFor(0.95) === 3 && starsFor(0.6) === 2 && starsFor(0.2) === 1 && tipFor(20, 0.95) > tipFor(20, 0.6) && tipFor(20, 0.2) === 0);
  check('extras cost a little more', orderPrice('latte', 'caramel') > orderPrice('latte'));
}

// food: plating your own way
{
  let ok = true;
  for (const id of FOOD_ORDER) { try { const pl = idealPlate(id); platePix(id); const r = scorePlate(id, pl); if (r.q < 0.85) { ok = false; console.log('  ideal plate not perfect', id, r.q); } } catch (e) { ok = false; console.log('  food failed', id, e.message); } }
  check('every dish made by the recipe gets 3 stars', ok);
  check('every dish asks only for things on the shelves', FOOD_ORDER.every((id) => Object.keys(FOODS[id].need).every((k) => INGREDIENTS[k] || SAUCES[k] || SHAKERS[k])));
  const pl = newPlate('vanilla');
  check('an empty cake slice is not a shortcake yet', scorePlate('shortcake', pl).q < 0.5);
  pl.items.push({ k: 'cream', x: 0, y: 0 }, { k: 'cream', x: 0.2, y: 0 }, { k: 'strawberry', x: -0.2, y: 0 }, { k: 'strawberry', x: 0, y: 0.2 }, { k: 'mint', x: 0.3, y: 0.3 });
  check('the right things make a lovely shortcake', scorePlate('shortcake', pl).q >= 0.85);
  check('the wrong base is not that dish', scorePlate('salad', pl).q < 0.35);
}

// Russian: every translation keeps its placeholders
{
  const bad = Object.entries(RU).filter(([en, ru]) => (en.match(/\{\w+\}/g) || []).sort().join() !== (ru.match(/\{\w+\}/g) || []).sort().join());
  if (bad.length) console.log('  placeholder mismatch:', bad.slice(0, 3));
  check('Russian keeps every placeholder', bad.length === 0);
}

process.exit(failed ? 1 : 0);
