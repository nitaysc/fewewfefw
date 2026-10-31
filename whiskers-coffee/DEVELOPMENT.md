# Whiskers & Coffee: development notes

A cozy isometric pixel-art cat café for two players on two Android phones.

## Technical decisions

**Engine: web technology packaged with Capacitor, not Godot.** The brief preferred
Godot 4. I chose otherwise for three practical reasons:

- the development environment can't download Google's Android SDK, so Godot could only
  export on CI, with no way to check visual changes locally;
- this stack already ships APKs to the user's phone through the same GitHub workflow,
  and every change can be screenshotted and tested in a headless browser;
- online co-op without running a server is straightforward with WebRTC in the Android
  WebView.

**Rendering: a custom isometric pixel renderer** (`www/js/art/`).
- `pix.js` rasterises shapes pixel by pixel with no anti-aliasing.
- `iso.js` builds furniture from boxes and cylinders in iso units. It draws all four
  rotations from one description and orders parts by 3D overlap.
- `room.js` paints the floor and walls as a dollhouse cutaway, with windows,
  chalkboard, shelves, clock, painting and door.
- Cats (`cats.js`) are hand-drawn frames in six coats.
- People (`people.js`) are built from parts so they can be customised.
- `render.js` draws whole-pixel zoom levels, sorts furniture, people and cats by depth,
  and adds dithered lamp glow, rain behind the windows, steam and heart effects.

**Multiplayer: host-authoritative WebRTC (PeerJS).**
- The host's phone runs the simulation (`game/sim.js`).
- A friend joins with a five-letter code. The public PeerJS signalling server only
  introduces the two phones; after that they talk directly over a data channel.
- Guests send requests (walk, pet, build). The host validates them with the same rules
  it uses for its own actions (`world.applyBuild`), then broadcasts:
  - snapshots of players and cats about 11 times a second;
  - the whole café whenever furniture or money changes.
- Guests draw 120 ms in the past and blend between snapshots, so movement is smooth.
- Both phones keep a saved copy of the café, so either player can reopen it later.
- Guests reconnect on their own after a dropped connection.

## Milestones

- [x] **1. Foundation**
  - [x] Isometric café with plank floor and decorated walls
  - [x] Camera: pan, pinch-zoom, fit-to-screen
  - [x] Furniture catalog: 16 items with 4-way rotation
  - [x] Placement validation: no overlaps, out-of-bounds or blocked door
  - [x] Tap-to-walk with A* pathfinding
  - [x] First cats
- [x] **2. Multiplayer**
  - [x] Host with an invite code; a friend joins it
  - [x] Two-player movement sync
  - [x] Furniture and money sync
  - [x] Guest requests validated by the host
  - [x] Saved copy of the café on both phones
  - [x] Reconnection
  - [x] Tested with two separate browsers over real WebRTC against a local PeerJS server
- [x] **3. Living café**
  - [x] Cat AI: sitting, grooming, wandering, sleeping in beds, perching on cat trees, visiting players
  - [x] Petting with hearts, purring and affection
  - [x] Customers who sit, order, drink and react to cats
  - [x] Coffee-making steps
  - [x] Serving, coins and tips
  - [x] Recipe unlocks
  - [x] Order-claim conflict handling in co-op
- [ ] **4. Customisation** — partly done:
  - [x] Shop with prices
  - [x] Storage
  - [x] Move, turn and store furniture
  - [ ] Walls and floors
  - [ ] Furniture collections
  - [ ] Cat adoption
- [ ] 5. Progression and story: economy loop, recipes, quests, grandmother's notebook
- [ ] 6. Polish: music, weather and seasons, photo mode
- [x] **7. Android**
  - [x] Landscape APK built by GitHub Actions, with a fixed signing key so updates install over each other

## Known limitations

- **Some networks can't connect.** There is no TURN relay. Most home and mobile
  networks connect peer-to-peer using STUN, but some strict mobile networks (symmetric
  NAT) cannot. A TURN server (for example from Metered or Twilio) can be added in
  `net.js` `peerOptions()` if that happens.
- **Third-party services.** Matchmaking uses the free public PeerJS server
  (`0.peerjs.com`), and the development environment could not reach it, so the online
  path between two real phones is untested here. Locally, a self-hosted PeerJS server
  stands in for it (`?peer=host:port`).
- **The host keeps the café running.** If the host closes the app, the guest waits and
  reconnects when it reopens. Either player can reopen the café from their own saved
  copy, but there is no merge if both changed it while apart: the copy that is opened
  wins.

## Running and testing

```sh
cd whiskers-coffee/www && python3 -m http.server 8790   # then open /index.html
npm test                                                # rules, pathfinding, cats (no browser)
```

- Art previews: `test/preview.html` (room and furniture) and `test/sprites.html`
  (cats and people), served from the `whiskers-coffee` folder.
- Two-player test: start a PeerJS server (`npx peerjs --port 9000`), then open two
  browsers with `index.html?peer=127.0.0.1:9000`.

## Building the APK

Every push that touches `whiskers-coffee/` runs `.github/workflows/build-whiskers.yml`.
It runs the tests, builds a debug APK signed with the committed key, and publishes a
`whiskers-coffee-v0.1.N` release. To build locally: `npm ci && npx cap sync android &&
cd android && ./gradlew assembleDebug`.
