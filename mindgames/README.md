# MINDGAMES

A premium daily brain-game app for Android. Three short games, the same puzzles for everyone
each day, one attempt each.

| Game | What you do | Rounds | Max |
| --- | --- | --- | --- |
| **Close Enough** | Type your best estimate for a factual question | 5 | 1,000 |
| **Perception** | Answer a question about a figure built to fool your eyes | 6 | 1,000 |
| **Odd One Out** | Tap the one symbol that differs before time runs out | 8 | 1,000 |

## Download the APK

Every push that touches `mindgames/` builds a new APK. Get it from the repo's **Releases** page:
the newest `mindgames-v1.0.<n>` release, file `mindgames.apk`.

## Run and build

```sh
cd mindgames
npm install
npm run dev          # browser preview at http://localhost:5173
npm test             # puzzle and scoring checks
npm run build        # type-check + production web build into dist/
npx cap sync android # copy the web build into the Android project
cd android && ./gradlew assembleDebug   # APK at app/build/outputs/apk/debug/
```

Stack: React 18 + TypeScript + Vite, plain CSS with design tokens, Capacitor 7 for Android.
Fonts (Bebas Neue, Manrope) and all graphics ship inside the app, so it works fully offline.

## How it is organised

```
src/
  app/            App shell, navigation, the save-data store, XP/levels
  components/     Shared UI: buttons, sheets, icons, avatar, confetti, bottom nav
  home/           Home screen, game cards and their illustrations
  games/
    types.ts            Shared game types and timed-scoring helper
    GameHost.tsx        Game chrome: header, progress pips, intro, saving, quitting
    ResultScreen.tsx    End-of-game score, rewards and next steps
    close-enough/       questions.ts (question bank), logic.ts (scoring), view
    perception/         generators.ts (10 challenge templates), Figure.tsx, view
    odd-one-out/        generator.ts (13 puzzle recipes), Glyph.tsx, view
  daily/          Daily log, streaks, the Daily tab and calendar
  leaderboard/    Leaderboard service (sample league) and screen
  profile/        Profile screen, settings, onboarding, challenge-code entry
  statistics/     SVG charts
  services/       Seeded RNG, dates, storage, haptics, sound, sharing
  styles/         tokens.css (design tokens), base, components, screens, games
test/             Logic tests (vitest)
```

Game logic never imports UI. Each game exposes pure functions (build a set from a seed, score an
answer, validate a puzzle) and a thin React view.

## How the daily challenge works

- The seed for a daily game is the player's local date (`YYYY-MM-DD`). All puzzle generation
  runs through a seeded random generator, so the same date always produces the same puzzles on
  every device, with no server.
- Close Enough walks through a shuffled copy of the question bank, so no question repeats until
  the whole bank (118 questions, about 23 days) has been used.
- A daily game can be scored once. Progress is saved after every round, so leaving and coming
  back resumes where you stopped. In the two timed games, the round on screen when you leave
  counts as missed, so leaving cannot buy a second look.
- Practice runs use a random 5-character code as the seed. Sharing that code
  (for example `PE-7K3MQ`) lets a friend play the identical set.

## Puzzle correctness

- **Close Enough** answers are stable, well-documented figures. Anything that changes over time
  is pinned to a date or survey in the question text. Scoring is based on the ratio between
  guess and answer: full marks inside the question's tolerance, zero at double or half, a smooth
  curve in between. Zero, negative and absurd guesses score nothing.
- **Perception** generators record the real measurement behind every option. `validateChallenge`
  rejects any figure where the answer is not the single best option by a set margin.
- **Odd One Out** reduces every cell to a canonical "what it looks like" key that accounts for
  rotational symmetry. `validatePuzzle` rejects any grid that does not have exactly one odd cell.
- `npm test` runs these validators across thousands of seeds, and CI runs them before each build.

## Leaderboards, friends and what is real

Leaderboards currently use a **sample league**: simulated players generated on the device, labelled
as such in the app. They are not real people. `LeaderboardProvider` in
`src/leaderboard/service.ts` is the seam for a real backend: implement that interface against a
server and the screens keep working. Friends are a local list for now; real friends, online
leaderboards and accounts need a backend and are not built yet.

Player data (scores, streak, XP, settings) is stored on the device only, through Capacitor
Preferences (native storage on Android, `localStorage` in a browser).

## Android notes

- App id `com.mindgames.daily`, portrait only, dark system bars.
- `android/app/debug.keystore` is committed on purpose so every build installs over the last one.
- Launcher icons are generated from the logo (`icon-1024.png`, `src/assets/logo-mark.png`).
