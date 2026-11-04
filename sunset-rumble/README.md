# Sunset Rumble 🚗💥⭐

A 1v1 cartoon car brawl in a seaside town at sunset. Grab stars, ram your rival to
knock their stars loose, and steal them back. First to **20** wins, or most stars when
the 2:30 clock runs out. If it's a tie, overtime starts and the next star wins.

## Modes
- **1v1 Online**: one phone hosts and gets a 5-letter code, and the friend types it in.
  The phones connect directly over WebRTC (PeerJS). The public PeerJS server only
  introduces them.
- **vs Bot**: easy, normal or hard.
- **Same Phone**: put the phone flat between you. The bottom half is yours and the top
  half is turned round for your friend. On a laptop it's a side-by-side split, using
  WASD + F/G against arrows + `.`/`/`.

## Controls
- **Stick**: push it the way you want to go (forward is gas, back is brake/reverse).
- **Drift button** (car with skid lines): hold it while turning to slide and charge
  boost. A long drift pays out a free burst.
- **Boost button** (double chevron): hold it to burn the meter (the ring round it).
- Blue arrows on the road and big jumps refill the meter too. Pink stars are worth 3.

## Code
- `www/js/world.js`: the town as plain data (roads, buildings, ramps, boost pads, bot waypoints)
- `www/js/car.js`: arcade car physics: grip, drifting, boost, ramps, collisions
- `www/js/sim.js`: the match rules: stars, rams, the clock, the winner
- `www/js/bot.js`: the bot driver (road-graph routing plus aggression)
- `www/js/scenery.js`: sky, sea, the painted street map, buildings, palms, Ferris wheel and more
- `www/js/render.js`: cars, stars, particles, skid marks, the cameras and split screen
- `www/js/main.js`: menus, HUD, game loop and online play; `net.js` is the PeerJS wrapper
- `test/sim.test.mjs`: `npm test` checks the physics never goes through walls, ramps
  launch, rams knock stars loose, and two bots can finish a match
- `test/icon.html`: renders the app icon from the in-game car

Online protocol: the host runs the match. The guest drives its own car and sends
`car` (packed state, 20/s). The host sends `snap` (stars, scores, clock, its car, 15/s)
and `ev` (picks, rams, bumps, go, over), plus `start` for every match and rematch.

To test online play without the internet, run a local PeerJS server and open
`index.html?peer=127.0.0.1:9000` in two tabs.

Every push that touches `sunset-rumble/` builds an APK and publishes it as a
`sunset-rumble-v1.0.N` release.
