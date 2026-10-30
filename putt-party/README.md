# Putt Party ⛳

A 3D minigolf party game for Android: play a course against up to three bots.

- `www/js/courses.js` — the courses and holes, as plain grid data
- `www/js/physics.js` — ball physics (cannon-es), shared by the game, the bots and the tests
- `www/js/bot.js` — bots plan each putt by test-running shots in a private copy of the hole
- `www/js/render.js` — the 3D scene (three.js)
- `www/js/main.js` — menus, turns, controls and scoring
- `test/holes.test.mjs` — a perfect bot must finish every hole within par + 1 (`npm test`)

Every push that touches `putt-party/` builds an APK and publishes it as a
`putt-party-v1.0.N` release.
