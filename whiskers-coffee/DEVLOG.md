# Whiskers & Coffee: dev log and handoff

**Read this first if you are an AI or developer continuing the project.** It explains
what the game is, how the code is laid out, how to run, test and ship it, what is done,
what is half-done, and what to build next. `DEVELOPMENT.md` has the milestone checklist
and the reasons behind the technical decisions; this file is the hands-on guide.

---

## 1. The game in one paragraph

A cozy isometric pixel-art cat café for **two players on two Android phones**, playing
online together in the same café. Players walk around, pet autonomous cats, decorate
with furniture bought with shared coins, and (next) serve patient customers by making
drinks.

It stays **cozy: no angry customers, no game over**. The original rule was "no failure
at all"; in round 5 the owner asked for real mistakes (spills, toppled cream, orders
that have to be remade) and a day/closing cycle, so those exist now, but customers
are always patient and nothing is ever lost for good. The art direction comes from warm, dark-wood pixel cafés: cream walls, wood
paneling, rainy windows, warm lamps and plants. All assets are original and drawn in
code. Do not use emoji as game art.

## 2. Where things live

The repo `nitaysc/fewewfefw` holds several of the owner's projects. **Work on the branch
your session assigns** (rounds so far used `claude/chat-session-alr9cs`, then
`claude/coffee-game-continue-i9dl5k`) and push there; every push that touches a project
folder builds its APK on GitHub, from any branch.

| Folder | Project | Notes |
|---|---|---|
| `whiskers-coffee/` | **this game** | Capacitor (web → Android) |
| `putt-party/` | 3D minigolf vs bots | three.js + cannon-es, Capacitor |
| `www/`, `android/` (repo root) | "שיחקת אותה!", a Hebrew party guessing game | Capacitor |
| `redeclipse-android/` | Unofficial Android port of Red Eclipse 2 | C++ patch + SDL2; parked |

How the owner installs builds:
1. They open `https://github.com/nitaysc/fewewfefw/releases` on their phone.
2. They download the newest `whiskers-coffee-v0.1.N` release, file `whiskers-coffee.apk`.

The APK is signed with the committed `android/app/debug.keystore`, so new builds install
over old ones. Never change that key, or the owner has to uninstall and loses their saves.

## 3. Stack and why

- **Plain ES modules, no bundler, no framework.** `www/index.html` loads
  `vendor/peerjs.min.js` (global `window.peerjs`) and then `js/main.js`.
- **Capacitor 7** wraps `www/` into an Android app. The Android project is in
  `android/` and is committed: landscape lock in `AndroidManifest.xml`, plus the
  signing config and the `versionCode` from CI in `app/build.gradle`.
- **Rendering:** Canvas 2D at whole-number zoom. Every sprite is generated at startup by
  a tiny pixel rasteriser (`art/pix.js`), so there are **no image files**.
- **Multiplayer:** host-authoritative over WebRTC data channels using PeerJS. The free
  public PeerJS cloud server does the signalling.
- Godot 4 was requested but rejected for practical reasons; see `DEVELOPMENT.md`. Don't
  switch engines without asking the owner.

## 4. Code map (`whiskers-coffee/www/js/`)

```
main.js        screens, input (tap / pan / pinch), decorate tray, character creator,
               co-op session glue, save/load, sound effects, the game loops
render.js      Renderer: camera, room + furniture + people + cats with depth sorting,
               lamp glow, rain, steam, hearts, build grid and ghost, hit tests
net.js         HostSession / GuestSession (PeerJS), invite codes, ICE config, retry
game/world.js  café data model (newCafe), placement rules (canPlace), grid,
               A* pathfinding, applyBuild (buy / move / store / place). Pure data, no DOM.
game/sim.js    Sim: players and cats on the host. Cat AI states, petting, build
               (calls applyBuild, then re-grids), snapshot(), roster()
game/catalog.js every furniture item: name, category, set, price, footprint, flags
               (seat, seatZ, surface, table, flat, bed, perch, station, rotates,
               glow, fire, twinkle) and paint(); SHOP_ORDER and SETS
game/customers.js CustomerSystem (sim.shop): customers, orders, serving
art/pix.js     Pix raster: set/rect/line/isoline/poly/ellipse/blit/outline/toCanvas,
               plus grid() (sprites from letter rows), shade(), hash()
art/iso.js     IsoPainter: box()/cyl()/shape() in iso units (16 per tile, z = pixels),
               4 rotations, face details, parts ordered by 3D overlap
art/room.js    paintRoom(): floor, the two back walls and their features
               (windows, chalkboard, clock, painting, shelf, door), wall caps.
               WALL_STYLES / FLOOR_STYLES and styleSwatch() for the shop
art/cats.js    hand-drawn cat frames (walk1/2, sit1/2, blink, groom, sleep1/2, happy),
               8 coats via palette letters, COLLARS (cells per frame in COLLAR_AT)
art/people.js  chibi people from parts: 6 hair styles, skin and outfits;
               frames 0-3 walk, 4-5 idle, 6 sit; front and back views, mirrored
art/palette.js the shared colour palette
art/drinks.js  recipes (DRINKS), EXTRAS, stars and tips, the layered "build" of a
               drink, drawDrink() for big and small cups, surfaceMap() (the top seen
               from above: latte art, cocoa, cream...), bubbles and emotes
brew/station.js the drink counter: TOOLS on shelves (cups, coffee, milk, cold,
               sweet, toppings), pouring/spills/wipe/bin, judging (section 8c)
brew/kitchen.js the food counter: plate bases, ingredients placed freely, sauces,
               shakers, undo/bin, scoring (section 8d)
art/foods.js   FOODS recipes, INGREDIENTS / SAUCES / SHAKERS / BASES and their art,
               scorePlate(), idealPlate(), plateCanvas()
i18n.js        t(), msg()/tr() for host messages, translatePage(); lang/ru.js
               holds Russian keyed by the English text (section 8e)
ui/icons.js    pixel UI icons (coin, paw, hammer, rotate, check, cross, box, move,
               friend, gear...) as data URLs
```

Tests and tools live in `whiskers-coffee/test/`:
- `logic.test.mjs` runs in Node (`npm test`) and is run by CI before every build.
- `preview.html`, `sprites.html` and `icon.html` are art previews for the browser.

## 5. Key conventions (follow these)

- **Coordinates.** Tiles are `(x, y)`; `x` runs down-right on screen and `y` down-left.
  Tile centre = `i + 0.5`.
  - World pixels: `wx = (x - y) * 16`, `wy = (x + y) * 8 - z`.
  - The north wall is along `y = 0`, the west wall along `x = 0`, and the door is on
    the west wall at tiles `y` 5–6 (`DOOR_TILES`, always kept clear).
  - The room is `ROOM_W × ROOM_H` = 11 × 9.
- **Iso painter units.** One tile is 16 × 16 units; `z` is in pixels.
  - `box(x, y, z, w, d, h, colours)` draws a box. Details go on faces: `'top'`, `'x'`
    (the +x side, right face), `'y'` (the +y side, left face). Faces that end up facing
    away after rotation are skipped automatically.
  - Visible faces are top, +x and +y. Put details a player should see on `'y'` at
    `rot` 0.
- **Rotation.** `rot` 0–3 quarter turns. 2×1 items swap their footprint on odd
  rotations (`footprint()`).
  - Chairs: rot 0 faces +y (towards the camera, down-left), rot 1 faces −x,
    rot 2 faces −y, rot 3 faces +x.
- **Facing for people and cats.** `flip` = the screen direction is left; `view` =
  `'front'` when moving down the screen, `'back'` when moving up.
- **Who owns the state.** Only the host (or a solo player) runs `Sim` and changes
  `cafe`.
  - Guests call `act(kind, data)` in `main.js`, which sends `{t: kind, ...}`.
  - The host handles requests in `onHostMessage` and applies them through the same
    `Sim` methods it uses for its own actions, so the rules can't diverge.
  - **To add a new player action, add it in both places.**
- **Network messages.**

  | Direction | Message | Purpose |
  |---|---|---|
  | guest → host | `hello` | name and look on joining |
  | guest → host | `move` | walk to a tile |
  | guest → host | `pet` | pet a cat |
  | guest → host | `build` | `{op}` passed to `applyBuild` (furniture, recipes, styles, cats) |
  | guest → host | `look` | changed name or look |
  | host → guest | `welcome` | `{you, cafe, roster, code}` |
  | host → guest | `snap` | about every 90 ms: `{time, p:[[id,x,y,back,flip,moving]], c:[[id,x,y,z,state,flip]], m: money}` |
  | host → guest | `cafe` | the full café after a change |
  | host → guest | `roster` | the player list |
  | host → guest | `fx` | effects, e.g. `{kind:'hearts', ...}` |
  | host → guest | `toast` | a message to show |

  **Never put a key named `t` inside a payload you spread into a message.** It
  overwrites the message type; that bug already happened once (snapshot time is now
  `time`).
- **The sim runs on `setInterval` (33 ms), not `requestAnimationFrame`,** so a host
  keeps the café running while its screen isn't drawing. Rendering uses rAF.
- **Saves.** `localStorage`:
  - `wc-prefs`: player id, name, look, sound, `made`.
  - `wc-cafes`: `{id: cafe}`. Guests also store the café with `guestOf: code`.
  - `wc-last`: the last café opened.

  The `cafe` object is the whole persistent state. Add new fields with defaults in
  `newCafe()` **and in `upgradeCafe()`** (world.js), which `Sim` runs on every café it
  opens, so older saves pick them up.
- **UI style.** Pixelify Sans, wooden panels (`.panel`), cream buttons (`.btn`) and
  lamp-yellow primary buttons. No emoji: use `iconImg(name)` from `ui/icons.js`, and
  add new icons there as letter grids.
- **Commits.** Clear messages explaining the why. The APK workflow publishes
  `whiskers-coffee-v0.1.<run>` releases with `--latest=false`; the root party game owns
  "latest".

## 6. Run, test, ship

```sh
cd whiskers-coffee && npm install
npm test                                   # logic tests in Node
cd .. && python3 -m http.server 8790       # from whiskers-coffee/, open /www/index.html
```

**Visual checks.** The original workflow used Playwright with headless Chromium:
1. Load the page at a phone size (844×390, `isMobile`, `deviceScaleFactor: 2`).
2. Drive it through `window.__wc` (`S`, `act`, `startHosting`, `joinCafe`, `renderer`).
3. Screenshot and look at the result.

The first run shows the character creator. Skip it by setting `made: true` in
`wc-prefs` and reloading.

**Two-player test.**
1. Run a local PeerJS server bound to IPv4:
   `require('peer').PeerServer({port: 9000, host: '127.0.0.1', path: '/'})`.
2. Open two separate browser contexts on `index.html?peer=127.0.0.1:9000`.
3. Launch Chromium with `--disable-features=WebRtcHideLocalIpsWithMdns`, or local
   WebRTC fails.
4. Host: click Invite and read `#inviteCode`. Guest: Join with that code.
5. Assert on movement, buying, moving furniture and petting.

**Ship.** Push to the branch; `.github/workflows/build-whiskers.yml` runs `npm test`,
`cap sync`, `gradlew assembleDebug` and `gh release create`. Tell the owner the release
link.

## 7. Status

**Done and tested.** Everything below works in solo and two-player:
- the isometric café and its art;
- 16 furniture items with 4 rotations;
- shop, storage, moving and turning furniture;
- placement rules;
- tap-to-walk;
- cats with AI (sit, groom, wander, sleep in beds, perch on cat trees, visit players);
- petting with affection;
- the character creator;
- invite code / join, host-validated actions, snapshots with interpolation;
- saves on both phones, reconnection;
- APK on CI.

Confirmed by the owner on their phone: "It's working". Their feedback, *"there isn't
much to do in this version"*, led to customers and coffee making (section 8, done) and
then customisation (section 8b, done): wallpapers, floors, furniture sets and adopting
cats give the coins from serving something to go towards.

**Not verified:**
- Two real phones over the internet. The public PeerJS server was unreachable from the
  dev sandbox.
- There is no TURN server, so strict mobile NATs may fail. Add TURN credentials in
  `net.js → peerOptions()` if the owner reports that connecting fails.

## 8. Customers and coffee (milestone 3): done

**`game/customers.js` (`CustomerSystem`, on the host as `sim.shop`).**
- Customers spawn at the door every ~14–28 s while a seat is free; at most 6 at once.
- They walk to the free tile in front of a seat (`seats()` / `approach()`) and sit:
  z = seat height, facing from the seat's `rot`; a stool faces the nearest table.
- They order a random drink from `cafe.recipes` and wait with no timer. After 5 minutes
  unclaimed they leave smiling, with no penalty.
- When served they drink for 22–34 s. They emote at cats within 1.8 tiles (heart,
  camera with a flash, wow) and each emote adds a small tip, paid when they leave.
- If their seat is moved or stored they leave happily (`relayout()`).
- Looks come from `seed` → `randomLook(seededRng(seed))`, so guests rebuild them
  identically. The name comes from `customerName(seed)`.

**Player actions.** Each one goes through `act()` and `onHostMessage`:

| Action | What it does |
|---|---|
| `claim(id)` | Reserves the order so the other player can't make it, and walks to the espresso bar. |
| `brewed(id)` | Sets `player.carry`. |
| `serve(id)` | Walks to the customer; on arrival `deliver()` pays the price into the shared money, adds a coin effect and starts them drinking. |

A drink made for one customer can go to another who ordered the same thing.

**UI** (`main.js`, the "serving and the espresso bar" section):
- Tap a customer: if you're carrying their drink, serve it; otherwise open the espresso
  bar panel on that order.
- Tap the espresso bar: open the order list.
- The panel (`#brew`) steps through `DRINKS[id].steps`. Each tap fills a bar with a
  sound, and the big cup fills via `cupCanvas(id, progress, true)`.
- The tray has a **Recipes** tab: `applyBuild` op `recipe` unlocks a drink for its
  `unlock` cost.

**Rendering.**
- Seated customers draw in front of the seat when facing the camera and behind it
  otherwise.
- Order and emote bubbles bob above heads; an order someone has claimed is drawn faded.
- The carried cup shows in the player's hand, and customers hold theirs while drinking.
- Effects: `coins` floats a +N amount, `flash` a camera flash, `bell` the door bell sound.

**Snapshot additions.** `p[6]` = the carried drink id.
`u: [[id, x, y, z, back, flip, state, seed, order, emote, claimedBy, moving, seatKey]]`.

**Tests.** `test/logic.test.mjs` covers spawning, sitting, ordering, claim conflicts,
brewing, serving, payment, leaving and unlocking recipes. The two-browser test also
covers a guest making and serving a drink.

**Ideas for this milestone not built yet:** regulars with names and stories,
customer–customer chatting, customers petting cats, putting cups on tables, pastries
from the pastry case, and orders for two drinks at once.

## 8b. Customisation (milestone 4): done

Everything here is an `applyBuild` op, so it reaches the host through the existing
`build` message and both phones use the same rules. `Sim.build()` then calls
`syncCats()` (spawns adopted cats at the door) and broadcasts the café.

| op | fields | what it does |
|---|---|---|
| `style` | `kind: 'wall'\|'floor', id` | buys a style once (`cafe.decor.owned`), switching later is free |
| `adopt` | `pick` (0–2), `id`, `name?` | adopts one of `strays(cafe)` for `adoptPrice(cafe)`; max `MAX_CATS` = 6 |
| `catname` | `id, name` | renames a cat (12 chars) |
| `collar` | `id, collar` | puts on a collar from `COLLARS` (costs its price; "none" is free) |

- **Café fields:** `cafe.decor = {wall, floor, owned: [...]}`, `cafe.adoptSeed`
  (the shelter's three cats come from it via `seededRng`, so both phones show the same
  strays; it advances after each adoption), and `collar` on each cat.
- **Walls & floors tab:** tapping a style sets `S.build.preview`, which the renderer
  uses in `ensureRoom()` instead of the café's style, so players see it in their café
  before buying. The room is repainted only when the style key changes.
- **Collections:** catalog items have `set: 'kyoto' | 'cottage' | 'autumn' | 'winter'`
  and each set is a shop tab (`SETS`). New flags: `table` (gets a pendant lamp),
  `seatZ` (seat height for customers), `glow: z` (small lamp glow), `fire` (big
  flickering orange glow), `twinkle` (blinking fairy lights drawn in `lights()`).
- **Cats panel:** your cats with rename and collar swatches, then the shelter.
- **Tests:** styles, all furniture painting in 4 rotations, adoption (price, limit,
  same strays on both phones), renaming, collars, old saves, new seat types. The
  two-browser test covered a guest buying a floor and a fireplace, adopting, putting
  on a collar and renaming.

## 8c. The barista station (coffee making, round 2): done

The owner found the first version boring ("you just click the same button") and the
cups plain, so making a drink is now hands-on, the way café games do it.

**Flow.** Tap a customer or the espresso bar → order list (`#brew`) → pick an order →
`act('claim')` → the full-screen station (`#station`, `Station.start(drink, extra,
name)`) → finish → "Take it to …" → `act('brewed', {id, q})` → carry and serve.

**Steps** (`STEPS` in `brew/station.js`). Each step has a mechanic:

| mech | steps | how it plays | graded |
|---|---|---|---|
| `circle` | grind (turn the crank), choc (stir) | drag in circles; progress = angle turned | no |
| `timing` | tamp | tap when the swinging marker is in the middle | yes |
| `hold` | shot, milk, foam, pour, cream | hold, let go in the gold band of the meter | yes |
| `trace` | art (heart / rosetta), caramel (zigzag) | drag through the guide dots on the cup seen from above | yes (coverage) |
| `shake` | cocoa, cinnamon, whisk | swipe back and forth | no |
| `tap` | marsh (tap where to drop), ice, berry | tap N times | no |

Quality `q` = average of graded steps (0..1). `starsFor(q)`: ≥0.85 → 3, ≥0.55 → 2,
else 1. `tipFor`: +50% / +20% / 0 on top of the price. A drink can never fail, and
the worst score is still a 1-star drink the customer loves.

**Drinks are builds** (`art/drinks.js`): layers in a vessel (`demi`, `cup`, `mug`,
`glass`, `tall`) plus a top surface map (art strokes, dust dots, marshmallows, cream,
caramel). Station steps change the build live; `applyIdeal()` is what each step does
when perfect, and `finalBuild(id, extra)` makes the café sprites (`cupCanvas(id, extra)`)
from it, so bubbles, carried cups and menus all match.

**Extras.** After the café has served 3 drinks, about 45% of orders add an extra the
drink allows (`DRINKS[id].extras`): whipped cream, caramel or cinnamon. Each adds a
step and a few coins. Customers only accept the drink with their extra.

**Network.** `brewed` carries `q`; the host clamps it and stores
`player.carry = {drink, extra, q, for}`. Snapshot: `p[7]` = carried extra,
`u[13]` = the customer's extra. The `coins` effect now has `tip` and `stars` (stars
float up over the customer).

**Testing the station.** `window.__wc.station` exposes the station; the Playwright
driver used in development reads `station.cur` and plays each mechanic with real
pointer events (hold until the band, click on the beat, circles, swipes, traces).

## 8c. Drinks, round 3: tools, free-form making, mistakes

The owner's partner played it: still too samey, wanted more detail, freedom and real
mistakes. So the counter is now **tool-driven** (`brew/station.js`):

- Pick a cup (`VESSELS`), then any tool from six shelves (`TOOLS[k].tab`). Nothing
  forces an order; a glowing tool (`suggest()`) and the recipe card guide you.
- Mechanics per tool: `hold` (shot, water, cold milk/water, pour milk, cream, steam/
  froth heat), `tap` (ice, syrups, fruit, tea bag, marshmallows, mint), `circle`
  (grinder crank, melting chocolate), `timing` (tamp), `shake` (cocoa, cinnamon,
  matcha whisk, the wiping rag), `trace` (latte art, drizzles; drawing freely works).
- The espresso needs grinding first; a tamped shot scores higher (`shotQ`).
- Steam or froth fills the jug with what the drink needs (`release()`): steaming gives
  silky milk plus a little foam, frothing gives lots of foam. Picking the wrong one
  leaves the wrong ratio. Overheating burns the milk; past 1.25 it boils over.
- **Mistakes:** `pour()` returns what spilled over the rim; spills and toppled cream
  set `b.messy` and serving is blocked until the rag wipes it. The bin restarts.
- **Judging** (`judge()` in `art/drinks.js`): each `need` key is scored (amounts with a
  tolerance, counts, toppings), extra ingredients and the wrong cup cost points, and
  the card shows notes ("Too much: Cold milk"). `q < 0.35` means the customer kindly
  asks for a remake (`deliver()` sends a `refused` effect and keeps the claim).
- 16 drinks (`DRINK_ORDER`); `START_DRINKS` are free, the rest unlock in the Menu tab.
  Extras: cream, caramel (drizzle), cinnamon, vanilla.

## 8d. Food

`art/foods.js` and `brew/kitchen.js`. Ten dishes (cakes, salads, toast, pancakes,
croissant, cookies, fruit bowl). Choose a base, then tap the plate to place an
ingredient, drag things to arrange them, drag them off the plate to drop them (they
fall and count as `dropped`), draw sauces, swipe shakers. Undo and bin. A recipe only
asks for a few things (`need`); anything else is decoration and earns a small bonus.

## 8e. Orders, tips, days, languages, customisation, decorating

- **Orders** are `c.items = [{kind: 'drink'|'food', id, extra, by, done}]`; a customer
  may want one or two things. Claims are per item (`claim(pid, id, idx)`), so two
  players can each make a part. Bubbles show every item, the claimer's colour tag,
  a "<name> is making it" label, and a tick for what has arrived.
- **Tips** go on the customer's table when they leave (`cafe.tips`); tap the coins to
  collect (`tip` action). Snapshot `tp`.
- **Days:** `cafe.day = {n, min, phase: open|closing|closed, rain, today}`. 8:00–20:00
  in about 9 real minutes (`MIN_PER_SEC`). Busier at lunch. At closing no one new comes;
  when the last guest leaves the summary screen appears on both phones and either
  player opens the next day (`nextDay`). Pause menu: close early. Windows follow the
  time of day (`skyFor()` → renderer `rain()` tint, sun, evening dimming).
- **Sitting:** seated people are drawn 6 px lower (hips on the seat, legs hanging).
- **Languages:** English and Russian (pause menu and title screen). Pixelify Sans's
  Cyrillic subset is bundled. Add strings with `t('English text')`; host errors use
  `msg()` so the guest translates them. `npm test` checks every Russian line keeps
  the same `{placeholders}`.
- **Character:** tabs Face / Hair / Clothes / Extras: 6 eye styles and 7 colours,
  freckles, blush, glasses, 12 hairstyles and 14 colours, 6 tops, trousers/shorts/
  skirt, shoes, apron, 6 hats with colours. Customers use the same parts.
- **Decorating:** hold furniture (or just drag it) to pick it up and drop it; drag an
  item straight out of the shop into the café; the tray is smaller and folds away,
  and the café keeps its zoom.

**Round 6 fixes (from play feedback):**
- One grind holds enough for the drink's espresso (`pf.left`), so the shot doesn't stop
  early; when it does run dry the popup says to grind again.
- Counter screens: card on the left, the scene in the middle, tools in a sidebar on the
  right. Scenes are drawn at a smooth (non-integer) scale that fills the space, and the
  sidebar has a fixed width, so the scene never zooms in and out while picking tools.
  The drink scene is 150×100, the kitchen 120×80 (the plate is bigger).
- Sitting: chairs are lower (`seatZ` 6) and the seated pose has a lap, bent knees and
  tucked feet; seated people are drawn lower than standing ones.

**Messages added this round:** `claim/unclaim/brewed {id, idx, q}`, `drop`, `tip {id}`,
`nextDay`, `closeEarly`. Snapshot: `p[6]` = carried id (`f:` prefix for food),
`p[7]` = extra; `u = [id, x, y, z, back, flip, state, seed, items, emote, moving]`
with items as `[isFood, id, extra, by, done]`; `d = [n, min, phase, rain]`; `tp`.

**Tested:** 73+ logic checks; every drink and dish made by its recipe gets 3 stars; a
latte made by hand in the browser (grind, tamp, shot, steam, pour, art) scored 0.95;
spill → blocked → wipe → serve; a cake plated by dragging; furniture moved by hold and
drag and dragged in from the shop; tips; a two-browser co-op run with an English host
and a Russian guest (claims, the "is making it" label, serving, tips, day end, next day).

## 8f. Round 7 (in progress when the session stopped): read this first

**Done in this round (pushed):**
- Food art at 2× resolution: `art/foodart.js` paints every ingredient (`HD[key](p, x, y, r)`)
  and base (`drawBaseHD`, `drawPlateHD`) with shading. Strawberries come whole or halved
  (`r` odd), cake slices show their cut layers (shortcake has strawberry bits in the cream,
  cheesecake has a baked top and biscuit crust). The kitchen scene is now 240×160 with the
  plate at R=72 (`brew/kitchen.js`); `drawPlate()` switches to the detailed path at R ≥ 50.
  Small café plates still use the simple shapes in `foods.js`.
- Customers no longer all want the same dish: each food order can ask for 0–2 extras from
  `FOODS[id].options` (`foodWants()` → `item.extra = "olive:2|cucumber:1"`;
  `foodNeed()`, `foodPrice()` (+2 per extra), `wantsText()`). The kitchen card and the
  order list show them. Drink extras now start after the first order and come up half
  the time.
- Latte art was invisible: pouring foam onto espresso made the whole top foam-white. The
  surface now stays latte-coloured (`pour()` in `art/drinks.js`), so the white heart shows.
- Toasts (the "Hana loves it!" messages) now appear at the top of the screen instead of
  covering the bottom.
- The owner's art references are saved in `whiskers-coffee/docs/art-references/`.

**Still open: the owner's latest requests, in priority order:**
1. **Much richer, professional pixel art like the references** (`docs/art-references/`):
   warm lighting, detailed shaded characters with big expressive eyes, soft coloured
   outlines (not pure black), plants and hanging vines, cups and cakes on tables, cats with
   fur shading. Keep it isometric/3D-looking. Suggested approach (not started):
   - Double the world's pixel density: tiles 32 units instead of 16 (scale `proj` in
     `art/iso.js` and `wx/wy` in `render.js`, then halve the render zoom). Furniture painted
     with `IsoPainter` gets finer automatically. Check `room.js` loops that step per unit
     (the floor shadow dither) and every hard-coded pixel offset in `render.js` (bubbles,
     cups in hand, name tags, shadows, effects).
   - Redraw people at about 32×56 (`art/people.js`) in the reference style: shaded hair
     strands, eye whites and highlights, clothes folds, coloured outlines, a proper seated
     pose holding a cup.
   - Cats at 2×: hand-drawn new frames, or start from Scale2x of `art/cats.js` frames and
     add fur shading and stripes.
   - Richer furniture shading: gradients and ambient occlusion in `drawBox`; more decor
     (hanging plants, vines, chalkboard menu, neon sign, glass pastry display with cakes).
2. **Food ingredients are still small on the plate** in the kitchen close-up; consider
   drawing them about 1.5× bigger (the plate is R=72 in a 240×160 scene).
3. Customers should look **seated** convincingly; this round's lower chairs and bent-knee pose help but
   the owner still reported standing in the previous build. A seat-front overlay drawn over
   seated people (paint only the chair's seat and front legs as a second sprite) would fix it.
4. Put served cups and plates **on the table** instead of in the customer's hand.

**Owner feedback history (so the next person understands the direction):**
- Round 3: "there isn't much to do" → customers and coffee.
- Round 4: "boring, you just click the same button" → minigame station.
- Round 5 (partner played): wants food, more detail and freedom, mistakes, more drinks,
  a day/closing cycle, Russian, more customisation, easier decorating.
- Round 6: the espresso shot stopped early, the counter UI was too small and zoomed in and
  out, customers stood on chairs → all fixed (sidebar layout, smooth scale, `pf.left`).
- Round 7: better strawberry/cheesecake models, latte heart invisible, everyone orders the
  same salad, toasts cover the screen, and "make the pixel art rich and professional like
  these references". The first four are done; the art upgrade (item 1 above) is the big next job.

## 8g. Round 8: art upgrade toward the references (started)

The owner asked for the art to look "exactly like" `docs/art-references/` (painted,
probably AI-generated pixel illustrations). Code-drawn art can't match them exactly; this
round moved the whole game a big step toward that style.

- **Twice the pixel detail everywhere.** World coordinates are unchanged; art is made at
  2× density and drawn into the same footprint (each sprite keeps its base `w/h/ax/ay`
  and `blit()` scales the 2× canvas into it):
  - furniture: `IsoPainter.bake(null)` → `scale2x()` (EPX smoothing) → `softOutline()`
    (a warm outline in a dark version of the neighbouring colour) in `render.sprite()`;
  - room: `scale2x(paintRoom(...))`;
  - cats: `catFrame()` strips the hard outline, applies Scale2x, adds fur light/shade and
    a soft outline; `w/h` stay the base size, the canvas is 2×;
  - people: a new `drawPersonHD()` (32×58) in `art/people.js`: big chibi head, curved
    hair shine, a fringe in locks, eyes with whites and highlights, eyebrows, blush, mouth,
    shaded clothes (light left / shadow right), aprons with pockets, shoes with soles, and
    hats/glasses. `personSprite()` returns it with `w: 16, h: 29`. The old 16×29
    `drawPerson()` is still in the file but unused.
- Helpers in `art/pix.js`: `scale2x`, `softOutline`, `stripOutline`.
- **Greenery:** `paintGreenery()` in `art/room.js` adds ivy trailing from the wall tops, a
  leafy garland and hanging pots between wall features.
- **Orders on tables:** customers who are enjoying their order have their cups and plates
  drawn on the table in front of them (snapshot `u[11]` = table `[x, y, z]`).
- Zoom: any whole number (2× art at odd zooms has slightly uneven pixels; at phone
  pixel densities it isn't noticeable).

**Next steps toward the references:**
- Native 2× furniture: paint functions in `game/catalog.js` are still designed at base
  resolution (Scale2x only smooths them). Redrawing key pieces (sofa with cushions,
  wooden chairs with spindles, round tables, the espresso machine, a glass cake display)
  at 2× would be the next biggest win.
- Warmer lighting: stronger lamp glows and a warm evening grade, more plants on the floor,
  a neon or wooden café sign, a chalkboard menu with text.
- Seated poses holding a cup (`drawPersonHD` frame 6 with arms forward) and a side view.
- Cats: hand-drawn 2× frames with stripes and calico patches like the reference sheet.
- People: a longer walk cycle (the references show 4–5 frames) and an idle blink.

## 8h. Round 9: the art now comes from the owner's reference sheets

The owner wanted the art "exactly like the references". There is no image generator in
this environment, so the sprites were **cut out of the reference sheets themselves**
(`docs/art-references/*.jpg`, which the owner supplied for this game) and are used directly.

**Pipeline (re-runnable):**
1. `python3 tools/extract.py www/img/ref` (needs numpy, pillow, scipy): for each named box in
   `S` (coordinates in half-size preview pixels of a sheet), flood-fills the paper
   background from the edges, drops specks, finds the art's pixel grid (cell about 4.5–4.8
   sheet pixels) by minimising the colour spread inside cells, takes each cell's median
   colour, reduces to a 40-colour palette and saves a PNG plus `manifest.json`.
2. `python3 tools/clean.py`: removes the pale halo left by the paper, turns the pale
   shadows under furniture into soft dark shadows and drops stray scraps.
3. Copy the manifest into `www/js/art/refmanifest.js` (a one-line Python snippet in the
   commit that added it; any JSON-to-JS export works).

**In the game** (`www/js/art/refsprites.js`):
- `loadRefs()` loads every PNG at startup (main.js), then clears the sprite caches so
  furniture redraws. Until they load, or for anything without a picture, the code-drawn art
  is used.
- People: `MODELS` (barista, cat-ear barista, hoodie, pink coat, green and olive jacket,
  white sweater, cap & apron, black apron). `look.model` selects one, and the character creator has
  a Character tab with a Custom option that keeps the parts-based look. Customers are 80%
  models. `personPose()` picks front, back, side-walk frames or the seated-with-cup picture;
  models without a seated picture show their top 60% above the seat (`cut`). Everyone is
  scaled to `PERSON_HEIGHT` (46 world px), so bubbles and name tags sit higher for models.
- Cats: `catPose()` for orange/tabby, calico, grey, black and tuxedo (sit, walk cycle, sleep,
  groom, happy); cream and siamese still use the code-drawn cats.
- Furniture: `FURNITURE` maps catalog types to pictures per quarter turn (mirrored for the
  other facing) with a width in world px; `render.sprite()` anchors them on the front of
  their footprint. New "Cozy" set in the catalog: grey sofa, pink armchair, green and
  cream stools, table with cake, coffee tables, potted fern, cat house, menu board,
  welcome sign, hanging plant, paw mat. Seat heights and table surfaces were raised
  to match the pictures (chair 13, sofa/armchair 11, stool 15, round table 20).
- New cafés start with some Cozy pieces.

**What still uses code-drawn art:** walls, floor, windows, the espresso bar, counters,
pastry case, bookshelf, lamps, the Kyoto/Cottage/Autumn/Winter sets, cream/siamese cats,
the drink and food counters, bubbles and UI. The reference scene's counter and display case
are front-on and don't match the isometric counters, so they weren't used. More pictures can be added by
adding boxes to `tools/extract.py` and entries in `refsprites.js`.

**New art from the owner:** `tools/ART_PROMPTS.md` holds the style block and ready prompts
the owner uses to generate new sheets in the same style (counter pieces, seated
characters, seats from all four sides, new characters, cats, decor, seasonal sets).
`tools/auto_extract.py <sheet> <prefix>` cuts any such sheet automatically (no boxes
needed if sprites are well spaced on a flat background), writes a numbered contact sheet,
and updates both manifests. Priorities when sheets arrive: counter/espresso/cake case
(replace the code-drawn counters), seated poses for every model (replace the `cut`
fallback), and all four facings for seats (replace the mirrored pictures).

## 9. Later milestones (from the owner's brief)

- **Customisation, next steps:** wall decorations players can place (`cafe.walls`
  features), more collections, more cat accessories (hats, bandanas), cats that like
  particular furniture (e.g. napping by the fireplace).
- **Story:** inheriting grandma's café; her notebook with recipes, memories and photos.
  Chapters and gentle quests such as "find the missing toy" or "help a stray kitten".
- **Atmosphere:** weather and seasons (the rain is already in the windows), seasonal
  drinks, photo mode with a scrapbook, music and ambience with a volume control.
- **Customers:** regulars with names and little stories.

## 10. Owner preferences learned so far

- Communicates casually, often from a phone. Wants real, playable APKs and a download
  link at the end of each round.
- Values polish: they pushed back on small UI and "not much to do". Show them visible
  progress each round.
- Likes being told honest percentages and limitations.
- Writes in English for this project.

## 11. Detailed art ("r3"): modelled, lit and rendered to pixel art

The owner rejected the AI-sheet sprites (white fringes, uneven style) and the three.js attempt.
All art in the game is now generated by `tools/art3d` (Python: numpy + Pillow):

- `sdf.py`: a small SDF ray-marcher. Shapes are modelled from rounded boxes, cylinders, capsules,
  ellipsoids and tori, lit (one light, soft shadows, ambient occlusion), then snapped to hand-made
  hue-shifted colour ramps with coloured outlines, so the output is clean pixel art.
- `items.py`, `models.py`: every catalog item (51). A model is centred on its footprint, stands on
  y = 0 and faces +z (= rot 0). One floor tile is 1 unit.
- `people.py`, `cats.py`: chibi people (faces hand-painted onto the render) and cats.
- `room.py`: floors (6 styles), both walls (7 styles) and the wall features.
- `build.py`: renders everything into `www/img/r3` and writes `www/js/art/r3manifest.js`
  (`name: [w, h, anchorX, anchorY]`). Run `python3 tools/art3d/build.py all room` (about 1-2 min).
  `catalog.json` there is the catalog's sizes and rotations; regenerate it if the catalog changes.

Camera: true 2:1 isometric (yaw 45, pitch 30), 2 picture pixels per world pixel (K3 = 2), so the
renderer keeps the zoom even. People and cats use a lower camera (pitch 14 / 20) so faces read.
Anchors: furniture = the item's back floor corner (tile x, y); people = feet, or hips when seated;
cats = paws. Frames: `p_<model>_<f|b>_<idle0-1|walk0-3|carry0-3|carryidle0|sit0|sip0>` (pictures
face right; flip for left), `c_<coat>_<sit0-2|walk0-3|sleep0-1|groom0-1|happy0>`,
`f_<type>_<rot>`, `r_floor_<style>`, `r_wall<n|w>_<style>`, `r_f<n|w>_<feature>_<len>`.

`www/js/art/r3.js` loads them and picks frames; `render.js` uses them when loaded (old art stays as
the fallback). Catalog heights (`seatZ`, `surface`, `perch`, `glow`) were changed to match the
models (world px = units x 19.6). Every person now uses one of the ready-made characters; a custom
look maps to one of the baristas. HUD buttons were restyled (cream, rounded, coloured band).

### 11b. Drinks, food and effects in the same style

- `tools/art3d/food3d.py` models all 16 drinks (with their extras) and 10 dishes: ceramic cups
  and saucers, mugs, glass mugs and tall glasses with visible layers, latte-art heart and
  matcha leaf, cocoa/cinnamon dust, drizzles, whipped cream, marshmallows, ice, straws, fruit;
  cake slices with layers, croissant, pancakes with syrup, salads in bowls, avocado toast.
  Three sizes: `s` (café), `m` (order bubbles), `b` (menus). `r3.js` has `drink3`, `food3`,
  `itemURL` (menu data URLs) and `orderBubble3` (rounded order bubbles).
- Old-style effects replaced when the art is loaded: soft floor shadows, round steam puffs,
  smooth gold tip coins, vector hearts, smooth lamp light pools, no hanging pendant drawings.
- (The station and kitchen screens were moved to the same art in 11c below.)
- Full how-to for adding art: `tools/art3d/README.md`.

### 11c. The barista station and the kitchen in the same style

- `tools/art3d/station3d.py` models the bar (tiled wall, counter, tall espresso machine with
  gauges and a group head over the drip tray, steam wand, red grinder, wall shelf), every prop
  that comes and goes (portafilter empty/full, tamper, crank knob, jug with/without milk,
  carton, pitcher, ice bucket, bottles, fruit, tub, tea box, cream can, shakers, whisk, spoon,
  marshmallow jar, rag...), all five cups and glasses from the front and from above, the
  overhead counter, and the kitchen (wood table with plate, napkin, fork and knife; every base:
  cake slices, salad bowl, toast, pancakes, croissant; 25 ingredients + 4 macaron colours;
  sauce bottles and shakers for the shelf icons). `python3 station3d.py` (about 3 minutes;
  `bar`, `props`, `ves`, `kitchen` for one group; `ONLY=<text>` to rebuild matching jobs).
  Pictures: `st_*` (bar), `sv_<cup>[_top]` (vessels), `k_*` (kitchen), in the shared r3 manifest.
- It also writes `www/js/art/st3layout.js` (`ST3`): where the cup, spout, crank, hopper,
  wand, jug and prop slot are in scene px, each vessel's inner size, rim and bottom, and the
  kitchen plate centre. The station and kitchen move their hit points (`CUP`, `SPOUT`,
  `CRANK`, `PL`...) to these when the art is loaded; `TOP.r` becomes 29 so the saucer fits.
- `www/js/art/st3.js` draws at run time on top of the pictures: the drink in the cup (layers
  seen through glass with roundness shading, the surface clipped into the cup's opening), the
  surface from above (`surfaceCanvas`: foam bubbles, smooth latte-art/drizzle strokes, dust,
  mint leaves, whipped-cream swirl, marshmallow pictures), liquid streams, ice, straw, cream,
  scoop, tea bag, drips; `iconURL` builds the shelf icons from the pictures.
- `brew/station.js` `draw3/drawBar3/drawTop3` and `brew/kitchen.js` `draw3` use them; the old
  pixel drawing stays only as a fallback while the pictures load. Meters, guide dots, rings and
  sparkles are still the small pixel UI drawn on top.
- `sdf.render` no longer blows up tiny shading differences on a single flat plane (that made
  bands on plain table tops).
- The owner said the first fork "looked weird": it is now a proper fork (head, neck, four
  tines, tapered handle) with a knife on a napkin. Look at small props up close before shipping.
- Second pass after the owner's feedback ("plate inside the cup", "the grinder looks weird"):
  cups now stand on a small raised saucer (`LIFT` in station3d.py; the layout includes it) with
  a light lining inside; the espresso machine is one clean body with a darker brew panel (no
  overhanging housing casting odd shadows); the grinder is a tapered red body with a glass
  hopper of individual-looking beans, a steel lid and the crank attached to its side; the light
  is more frontal so shadows fall behind things; the salad bowl is a deep white bowl with a
  blue rim, heaped with leaves, so it doesn't read as a plate on a plate.
- Third pass ("plate inside the cup", "feels like a browser game", "make things sit in the food"):
  - The cup bug was `rcone`: it is a *rounded* cone, so the cup's bottom was a half-ball poking
    out under the saucer. `sdf.fcone(y0, y1, r0, r1, c)` is a flat-ended cone; use it for cups,
    jugs, buckets, hoppers and anything that stands on a surface.
  - Kitchen physics (`kitchen.js` `surfH`, `phys`, `onFood`, `inBowl`): pieces rest on the food's
    real top (cake, toast, pancakes, croissant, salad heap) instead of plate level, drop in from
    above, bounce, squash and swing while dragged; sauces and dust follow the surface; things
    behind a cake are hidden by it; in the salad bowl pieces sit inside under the bowl's front
    wall (`k_bowl_front`) and are kept away from the rim; the salad leaves are clipped to the
    bowl. Shaker sprinkles fall, confetti when a dish is good.
  - Station feel (`st3.js` particles: `splash`, `confetti`, `stepParts`, `drawParts`): the level
    rises smoothly, the surface sways and ripples with droplets while pouring, ice and syrups
    splash, marshmallows splash in the top view, grounds stream from the grinder, the cup drops
    onto the tray with a squash, confetti on a good drink.
  - Café smoothness: the simulation ticks at 60 Hz (was 30) and `smoothMoves` in main.js eases
    every character and cat toward its position each frame, so walking no longer steps.
  - App feel: no long-press menu, press animations on buttons/chips/tools, the station and
    kitchen slide in, panels pop in, shelf icons are drawn smooth.

