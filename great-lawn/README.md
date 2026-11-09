# The Great Lawn

A first-person ride-on mower game set on an English country estate. The Great Lawn of
Hollingmere Park has not been mown since Easter: drive the old racing-green garden tractor,
cut it back into stripes, and take your time over a bottle of estate ale and a Churchill.

- Drive a 1950s-style ride-on with a wooden wheel, brass gauges and levers. Engage the blades
  and the knee-high meadow (seed heads, buttercups, daisies) falls into proper lawn stripes
  that follow your direction of travel. The engine bogs down in the long stuff.
- Your hands are modelled from bones, knuckles, tendons and nails. The right one steers with
  a cigar between its fingers; the left keeps an ale on your knee. Hold **Q** to drink (the ale
  level in the bottle drops and the bottle tips further as it empties), hold **E** to draw on
  the cigar (the ember brightens; let go and you exhale), **F** taps the ash, **R** fetches a
  fresh bottle from the crate or lights a new cigar.
- The estate: a Palladian house with a giant Ionic portico, colonnades and pavilions, a
  fountain, yew hedges and topiary, a herbaceous border, a cedar of Lebanon, a bronze horse
  at the end of the lawn and a ha-ha with parkland beyond.
- Real sky and light: a photographed CC0 sky with the sun's position and strength measured
  from the HDR, soft shadows, sun glowing through grass and leaves.
- The engraved *Plan of the Great Lawn* fills in as you go; progress saves automatically.
- Two views: the driver's seat, or a chase camera behind the mower (the driver has a face,
  a moustache and a tweed flat cap for it).
- Mow together: host a lawn and give friends the four-letter code; up to four mowers restore
  the same lawn, each in its own paint, every stripe shared. Players connect directly
  (WebRTC); PeerJS's public server only introduces them, so an internet connection is needed.
- Sounds are synthesised live: engine putter, blades and the crunch of long grass, gravel,
  blackbirds, rooks, gulps, the hiss of a fresh bottle.

## Controls

| | Keyboard / mouse | Phone |
|---|---|---|
| Drive, reverse, steer | W S A D or arrows | left stick |
| Open the throttle | Shift | Throttle |
| Blades on / off | Space | Blades |
| Drink (hold) | Q or left mouse | Drink |
| Smoke (hold) | E or right mouse | Smoke |
| Tap the ash | F | |
| Fresh bottle / new cigar | R | the button that appears |
| Look about (or swing the camera, from behind) | mouse | drag on the right |
| Driver's seat / view from behind | V | View |
| Pause | Esc | II |

A gamepad works too (sticks, triggers to drive, shoulders to drink and smoke).

## Picture quality

Automatic, Low, Medium, High or Ultra in Settings. Automatic picks from the graphics chip:
recent flagship phones start on High, mid-range ones on Medium. On phones each level is
trimmed where it costs most (shadow-map size, multisampling, grass reach; trees keep baked
shadows), and if the frame rate sags the game lowers its resolution, then thins the grass a
little, putting both back when it can.

## Layout

- `www/js/world/` — `layout.js` (the estate plan: heights, masks, collision field),
  `grass.js` (instanced blades, LODs, wind, stripes), `cutmap.js` (what is mown, on GPU and
  CPU), `terrain.js`, `sky.js`, `house.js`, `trees.js`, `garden.js`, `foliage.js`
- `www/js/player/` — `vehicle.js` (driving), `mower.js` (the model), `hands.js` (SDF hands),
  `beer.js`, `cigar.js`, `cockpit.js` (what the hands do)
- `www/js/core/` — rendering helpers, post-processing, input, audio, quality presets
- `www/js/ui/hud.js` — HUD and the plan
- `www/assets/` — CC0 textures, sky and a statue model (see `CREDITS.md`)
- `test/logic.test.mjs` — `npm test`: driving, grips, mowing and wiring checks
- `tools/serve.mjs` — `npm run serve` to play in a desktop browser at http://localhost:8123
- `tools/dev/` — a model viewer and the icon/splash generator used during development

Every push that touches `great-lawn/` builds an APK and publishes it as a
`great-lawn-v1.0.N` release.
