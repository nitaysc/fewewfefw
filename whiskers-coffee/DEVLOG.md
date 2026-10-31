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

There is **no stress, no timers, no failure**. That is a hard design rule from the
owner. The art direction comes from warm, dark-wood pixel cafés: cream walls, wood
paneling, rainy windows, warm lamps and plants. All assets are original and drawn in
code. Do not use emoji as game art.

## 2. Where things live

The repo `nitaysc/fewewfefw` holds several of the owner's projects. **Work on branch
`claude/chat-session-alr9cs`** and push there; every push that touches a project folder
builds its APK on GitHub.

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
game/catalog.js every furniture item: name, category, price, footprint, flags
               (seat, surface, flat, bed, perch, station, rotates) and paint()
art/pix.js     Pix raster: set/rect/line/isoline/poly/ellipse/blit/outline/toCanvas,
               plus grid() (sprites from letter rows), shade(), hash()
art/iso.js     IsoPainter: box()/cyl()/shape() in iso units (16 per tile, z = pixels),
               4 rotations, face details, parts ordered by 3D overlap
art/room.js    paintRoom(): plank floor, the two back walls and their features
               (windows, chalkboard, clock, painting, shelf, door), wall caps
art/cats.js    hand-drawn cat frames (walk1/2, sit1/2, blink, groom, sleep1/2, happy)
               and 6 coats via palette letters
art/people.js  chibi people from parts: 6 hair styles, skin and outfits;
               frames 0-3 walk, 4-5 idle, 6 sit; front and back views, mirrored
art/palette.js the shared colour palette
art/drinks.js  NEW, not wired up yet: drink recipes (DRINKS), cup and glass sprites
               with a fill level, speech bubbles and emote icons (see section 8)
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
  | guest → host | `build` | `{op}` passed to `applyBuild` |
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
  `newCafe()` and **tolerate older saves that lack them**.
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

Confirmed by the owner on their phone: "It's working". Their feedback: *"there isn't
much to do in this version"*, so **customers and coffee making are the priority.**

**Not verified:**
- Two real phones over the internet. The public PeerJS server was unreachable from the
  dev sandbox.
- There is no TURN server, so strict mobile NATs may fail. Add TURN credentials in
  `net.js → peerOptions()` if the owner reports that connecting fails.

## 8. In progress: customers and coffee (milestone 3)

`art/drinks.js` is written but **not yet used anywhere**. It provides:

- `DRINKS`: 7 recipes. Each has `name`, `price`, `unlock` (coin cost; 0 = free from the
  start), sprite colours (`fill`, `top`, `art`, `dots`, `dust`, `cold`) and `steps`
  (`[id, label]` pairs).
- `cupPix(id, progress, big)` / `cupCanvas(...)`: a hot cup or cold glass sprite that
  fills as `progress` goes 0→1.
- `bubbleCanvas(kind)`: a speech bubble holding a drink icon or an emote
  (heart, note, sparkle, camera, wow, coin, smile).

Planned design (agreed with the owner, still to build):

1. **Customers** (state in `Sim`, host only).
   - Spawn at the door every ~20–35 s while there is a free seat. Seats are furniture
     with `seat: true`: chair, stool, armchair, and the sofa, which counts as 2 seats.
   - They walk to a free tile next to the seat, then sit on it.
     - Position = seat tile centre; z ≈ seat height: chair 9, stool 14, armchair and
       sofa 10.
     - Facing comes from the seat's `rot` (section 5). A stool faces the nearest table.
   - The look comes from a seed: `randomLook(seededRng(seed))` in `people.js`, so guests
     can rebuild it from the snapshot.
   - **Drawing order:** if the seat faces the camera (rot 0 or 3), draw the customer
     after the seat; otherwise before it, so the chair back covers them.
   - Ordering: a bubble shows the drink. Customers wait patiently with no timer. If
     nobody serves them for a few minutes, they leave happily with no penalty.
   - Served: they drink for ~25 s, react to cats within 1.5 tiles (heart, camera flash,
     wow emotes; a small tip bonus), then leave through the door.
2. **Making a drink.**
   1. Tap the espresso bar (`def.station === 'coffee'`). The player walks there and a
      brewing panel lists the waiting orders.
   2. Pick an order. Send `claim` to the host so two players can't make the same one;
      the host refuses if it's already claimed.
   3. Tap through the recipe `steps`. Each tap fills a short bar and the big cup
      preview gains a layer.
   4. When done, send `brewed`. The host sets `player.carry = {drink, for}` and the cup
      is drawn in the player's hands.
3. **Serving.** Tap the customer → `serve`. The player walks there and on arrival the
   host pays `price` plus a tip into the shared `cafe.money`, with a coin effect.
4. **Recipes.** A "Recipes" tab in the tray unlocks drinks for coins. Store them as
   `cafe.recipes = ['espresso', 'latte', 'hotchoc', ...]`.
5. **Network.**
   - Add customers to `snapshot()`: `[id, x, y, z, back, flip, state, seed, order, emote]`.
   - Add `carry` to the player entries.
   - Add the guest→host actions `claim`, `brewed` and `serve`.
   - Extend `test/logic.test.mjs`: a customer spawns, sits, orders, gets served and
     money goes up.

## 9. Later milestones (from the owner's brief)

- **Customisation:**
  - Wall and floor styles (`cafe.walls`/floors already flow into `paintRoom`).
  - Furniture collections: Japanese, cottagecore, autumn, Christmas.
  - Cat adoption with new coats from `COATS`; cats get names, moods and accessories.
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
