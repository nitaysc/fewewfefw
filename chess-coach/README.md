# Rookwise

A phone-first chess app: play against Stockfish at nine strength levels, get a coach's
comment on every move as you play, then walk through a full game review.

- **Play**: tap or drag pieces, take back moves, ask for a two-step hint (first the piece, then the move).
- **Coach**: after each of your moves the engine grades it (brilliant, great, best, excellent, good,
  book, inaccuracy, mistake, miss, blunder) and the coach explains why in plain words: hanging
  pieces, missed captures and forks, missed or allowed checkmates, better alternatives.
- **Game review**: accuracy for both sides, an evaluation graph, move-type counts, a per-phase
  grade, an estimated game rating, and a move-by-move walkthrough with "show best" and
  "next key moment".
- **Review a PGN**: paste any game and review it the same way.

Everything runs on the device; nothing is sent to a server.

## Layout

- `www/index.html`, `www/css/app.css`: screens and styling
- `www/js/engine.js`: Stockfish worker behind a promise queue
- `www/js/review.js`: position evaluation, move grading, accuracy, rating estimate
- `www/js/coach.js`: the coach's explanations
- `www/js/board.js`: board rendering and input
- `www/js/openings.js`: small opening book (names and book moves)
- `www/js/app.js`: game flow and screens
- `www/vendor/`: Stockfish 19 lite (GPLv3), chess.js 0.10.3 (BSD). Piece images are the
  "cburnett" set (GPLv2+).
- `android/`: Capacitor wrapper; `.github/workflows/build-chess-coach.yml` builds the APK on push.

## Run and test

```sh
npm test          # logic tests (opening book, grading, coach text)
npm run serve     # http://localhost:8080
```

## How the numbers work

- Win chance from an evaluation: `50 + 50 * (2 / (1 + exp(-0.00368 * centipawns)) - 1)`.
- A move's cost is the win chance it gives up; grades are cut at 2, 5, 10 and 20 points.
- Accuracy per move: `103.17 * exp(-0.0435 * cost) - 3.17`; the game figure blends the mean and
  the harmonic mean so one terrible move weighs more.
- Game rating is a curve fitted to accuracy (about 550 at 59, 1150 at 75, 1650 at 84, 2600 at 95).
  It is an estimate of the strength shown in one game, not a rating you earned. Games under
  10 moves are not rated.
