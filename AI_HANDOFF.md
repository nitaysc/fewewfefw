# AI handoff: start here

This repo holds several of the owner's game projects, all built in conversations with
an AI. Each project has its own notes:

- **`whiskers-coffee/DEVLOG.md`**: the active project, a co-op cat café. It's the most
  detailed: architecture, conventions, network protocol, what's in progress and what's
  next. **Start with sections 8f and 8g**: it lists what the owner asked for last and what is
  still open. The biggest open job is richer pixel art matching
  `whiskers-coffee/docs/art-references/`.
- `whiskers-coffee/DEVELOPMENT.md`: milestone checklist and technical decisions.
- `putt-party/README.md`: 3D minigolf against bots.
- `redeclipse-android/README.md`: unofficial Android port of Red Eclipse 2. Parked: it
  reached the engine starting on the phone; image loading was just fixed and still
  needs testing.
- `README.md` (root): "שיחקת אותה!", a Hebrew party guessing game (web code in `www/`).

Ground rules:
- Develop on the branch your session assigns (the last rounds used
  `claude/chat-session-alr9cs` and then `claude/coffee-game-continue-i9dl5k`).
- Each project builds an APK on push through `.github/workflows/`. The owner downloads
  it from the repo's Releases page.
- Keep the committed debug keystores so updates install over existing apps.

Working notes for the café game:
- Test with `npm test` (in `whiskers-coffee/`) and by playing in headless Chromium at phone
  size (844×390); `window.__wc` exposes the game (`station`, `kitchen`, `act`, `startOrder`...).
- The owner plays on an Android phone with a partner, in English and Russian. Every user-facing
  string goes through `t()`; add the Russian line to `www/js/lang/ru.js` (tests check the
  placeholders match).
- After each push, give the owner the release link:
  `https://github.com/nitaysc/fewewfefw/releases/tag/whiskers-coffee-v0.1.<run number>`
  (the build takes about two minutes).
