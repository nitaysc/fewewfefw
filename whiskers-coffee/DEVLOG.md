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

**Messages added this round:** `claim/unclaim/brewed {id, idx, q}`, `drop`, `tip {id}`,
`nextDay`, `closeEarly`. Snapshot: `p[6]` = carried id (`f:` prefix for food),
`p[7]` = extra; `u = [id, x, y, z, back, flip, state, seed, items, emote, moving]`
with items as `[isFood, id, extra, by, done]`; `d = [n, min, phase, rain]`; `tp`.

**Tested:** 73+ logic checks; every drink and dish made by its recipe gets 3 stars; a
latte made by hand in the browser (grind, tamp, shot, steam, pour, art) scored 0.95;
spill → blocked → wipe → serve; a cake plated by dragging; furniture moved by hold and
drag and dragged in from the shop; tips; a two-browser co-op run with an English host
and a Russian guest (claims, the "is making it" label, serving, tips, day end, next day).

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
