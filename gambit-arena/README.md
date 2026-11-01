# Gambit Arena ♞🎯

Chess where every capture is a first-person gunfight. Play a friend online with a
five-letter code, or practise against the bot.

## Rules

- Normal chess moves, checks and checkmate.
- A capture starts a duel in a 3D arena between the two pieces (light squares = open
  courtyard, dark squares = tight maze).
- The attacker wins → it takes the square. The attacker loses → it is removed and the
  defender stays. The 75 s clock runs out → the defender holds.
- A king that attacks and loses, or a failed attack that leaves your own king in check,
  loses the game.

| Piece | Weapon | HP | Notes |
|---|---|---|---|
| Pawn | Sidearm | 100 | quick, accurate pistol |
| Knight | Scattergun | 110 | fastest runner, close-range shotgun |
| Bishop | Longshot | 100 | sniper with zoom |
| Rook | Mortar | 170 | slow and tough, explosive shells with splash |
| Queen | Stormgun | 140 | automatic, big magazine |
| King | Crown Cannon | 150 | heavy revolver |

Hits on the top of a piece ("crown shots") do 1.5× damage.

## Code

- `www/js/chess.js`: chess rules (perft-tested), plus the duel outcomes (`applyFailedCapture`, `status`, `loser`)
- `www/js/ai.js`: chess bot (alpha-beta; weighs captures by the odds of winning the duel)
- `www/js/pieces.js`: fighter stats and weapons for each piece
- `www/js/duel.js`: arena, movement, hitscan and mortar shells, nav grid, duel bot. No DOM
- `www/js/render.js`: three.js board and arena, piece models built from lathe profiles
- `www/js/main.js`: menus, turns, duels, touch controls, online messages
- `www/js/net.js`: PeerJS host/guest sessions (same as Whiskers & Coffee)
- `test/`: `npm test` runs perft and other chess checks, plus a bot-vs-bot duel balance table

## Online protocol (host = White)

`hello`/`start`/`sync` to set up and reconnect · `move {from,to,promo}` · during a duel each
phone simulates its own fighter and sends `st` (15 Hz). The shooter decides its own hits
(`hit {dmg}`), `fx`/`rk` are visual only. The victim sends `dead`, and the host decides the
result (`duelEnd {attackerWon}`) and the timeout.

Every push that touches `gambit-arena/` builds an APK and publishes it as a
`gambit-arena-v1.0.N` release.
