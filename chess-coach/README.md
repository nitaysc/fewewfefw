# Rookwise

A phone-first chess app: play Stockfish at nine strength levels with a coach beside the board,
then go through the game move by move in a full review.

- **Play tab**: pick one of nine opponents (400 to 3000+), your color, and go. An unfinished
  game can be continued from where you left it; shortcuts open today's puzzle and the review of
  your last game. Your estimated rating, record and accuracy trend sit underneath.
- **Coach while you play**: every move gets a grade (brilliant, great, best, excellent, good,
  book, inaccuracy, mistake, miss, blunder) and a plain explanation: hanging pieces, forks,
  pins, skewers, missed or allowed mates, opening principles, with a tip after serious slips.
  It also explains the opponent's replies and warns about threats before you move. After a
  serious mistake it pauses so you can take the move back. Hints come in three steps (idea,
  piece, move). The coach can read its comments aloud.
- **Explain**: the Explain button (or a tap on the coach's comment) opens the long version for
  the move: the position with the move played and the best move as arrows, both lines with move
  numbers and evaluations, how the winning chances changed, and the reasons one by one (what the
  move was for, what it allows, what it stops, what comes next, the engine's line and what it
  costs in material), with Take back right there. Beyond tactics the coach names positional
  slips: pawns pushed in front of the castled king, trading while behind, a piece retreating to
  the back rank, doubled pawns, and what the opponent's best reply does.
- **Game review**: accuracy for both sides, an evaluation graph, the coach's written notes
  (opening, best moment, the biggest swing and why, how the lead went, material lost and chances
  missed, strongest and weakest phase), key moments, one thing to work on next game, phase
  grades, an estimated game rating and move-quality counts. Every move has Explain. Step
  through with "Show best", "Play it out", and "Retry", where you look for the better move
  yourself and the coach judges the attempt. Reviews are stored, so reopening one is instant.
- **Puzzles tab**: 3,125 tactics puzzles from real games (the Lichess puzzle database, CC0).
  The opponent's move sets up each puzzle, then you find the best reply and the opponent answers
  until the line is done. Rated puzzles move your puzzle rating up or down (a wrong move, a hint,
  the solution or a skip counts as a miss); **Puzzle Rush** gives three minutes and three strikes,
  each puzzle a little harder; the **Daily Puzzle** is the same all day and keeps a streak; and 27
  themes (mate in 1/2/3, fork, pin, skewer, back rank mate, sacrifice, endgames...) can be practised
  unrated. Hints come in two steps (the piece, then the move); Solution plays the line out.
- **Games tab**: past games with board thumbnails, results and accuracy; import any PGN.
- **Settings tab**: four board colours (green by default), eight piece sets, coach, sound,
  vibration, evaluation bar and review depth.
- **Sound**: recorded piece and bell sounds, not synthesized.

Everything runs on the device; nothing is sent to a server.

## Look

One flat, dark, warm-grey interface with a green action colour, whichever board is picked
(`data-look` only swaps the board's colours). Roboto, Android's own typeface, is bundled. Players
are shown in square frames; lists are rows in one panel. The default pieces are "Modern" (staunty),
a bold, shaded set. Nothing is copied from another chess site: no artwork, logo or characters. The
opponents' and coach's pictures are Fluent Emoji (MIT), the icons Material Design Icons (Apache 2.0).

Two of the piece sets (Modern/staunty and California) are CC BY-NC-SA: free to use in this free
app, but not in anything sold or carrying ads. See `tools/make_pieces.py` for how to drop them.

## Feeling like an app, not a web page

- The board's size comes from the screen alone (`fit()` in `app.js`): as wide as the screen, with the
  coach box taking the height that is left and scrolling inside it. Before, the board grew and shrank a
  few percent on every move as the comment under it changed length.
- `MainActivity.java` draws the app edge to edge behind transparent status and navigation bars and
  passes their sizes to the page (`__rwInsets` in `index.html` sets `--sat`, `--sab`, `--sal`, `--sar`,
  and `--kb` for the keyboard). It also turns off the WebView's overscroll glow, scroll bars, zoom,
  long-press menu and system font scaling. The window and launch screen are the app's dark colour.
- In the page: touch ripples on buttons, screens that slide in from the right and back from the left,
  tabs that fade through, a top bar that lifts when the page scrolls under it, no text selection or
  context menu, and Back on the first tab sends the app to the background like other Android apps.

## Layout

- `www/index.html`, `www/css/app.css`: screens and styling (`data-look` on `<html>` picks the look)
- `www/js/app.js`: app shell, tabs, sheets, game flow, review screens, the Explain sheet
- `www/js/coach.js`: what the coach says (motifs, positional drawbacks, threats, hints, retry
  feedback, the long explanation and the game report)
- `www/js/review.js`: position evaluation, move grading, accuracy, rating estimate
- `www/js/engine.js`: Stockfish worker behind a promise queue
- `www/js/board.js`: board rendering and input (tap or drag)
- `www/js/avatars.js`, `www/img/av/`: the opponents', coach's and player's pictures
  (built by `tools/make_avatars.py`)
- `www/js/sound.js`, `www/js/sounds-map.js`, `www/sounds/sounds.wav`: recorded sounds
- `www/js/voice.js`: text to speech (native plugin in the app, browser speech elsewhere)
- `www/js/openings.js`: opening book with names and a one-line idea per opening
- `www/js/puzzles.js`: puzzle logic (judging a move, rating changes, picking, Rush difficulty, daily pick)
- `www/js/puzzle-screen.js`: the Puzzles tab and the puzzle screen
- `www/js/puzzles-data.js`: the puzzles, built by `tools/make_puzzles.py`
- `www/css/pieces-*.css`, `www/css/piece-previews.css`: piece sets, built by `tools/make_pieces.py`
- `www/fonts/`: Roboto, bundled so the APK looks the same on every phone and works offline
- `www/vendor/`: Stockfish 19 lite and chess.js 0.10.3
- `android/`: Capacitor wrapper; `.github/workflows/build-chess-coach.yml` builds the APK on push

## Tools

- `python3 tools/make_sounds.py`: rebuilds the sound sprite from the source recordings
  (downloaded once, checked by SHA-256). Needs numpy and ffmpeg.
- `python3 tools/make_pieces.py`: rebuilds the piece-set stylesheets (checked against `tools/pieces.lock`).
- `python3 tools/make_icons.py`: redraws the launcher icons and splash screens.
- `python3 tools/make_avatars.py`: fetches the Fluent Emoji pictures (checked against
  `tools/avatars.lock`) and writes them as 192 px WebP. Needs Pillow.
- `python3 tools/make_puzzles.py`: rebuilds the puzzle list from the first 45 MB of the Lichess
  puzzle database (a random sample, since rows are ordered by id). Needs `pip install zstandard`.

## Run and test

```sh
npm test          # logic tests (grading, coach findings, threats, hints), every puzzle played through
                  # with chess.js, and the Android config check
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

## Credits

Stockfish (GPLv3), chess.js (BSD), puzzles from the Lichess puzzle database (CC0), piece sounds by Stefan Haack (CC BY 4.0), bell sounds by PWL
(CC0), piece sets from the lichess-org/lila collection (staunty and california CC BY-NC-SA 4.0,
mpchess GPLv3+, cburnett and merida GPLv2+, celtic MIT, chessnut Apache 2.0, kiwen-suwi CC BY 4.0),
pictures from Fluent Emoji by Microsoft (MIT), Material Design Icons by Pictogrammers (Apache 2.0),
Roboto under the SIL Open Font License. The in-app Credits page lists the same.
