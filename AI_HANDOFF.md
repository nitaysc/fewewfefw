# AI handoff: start here

This repo holds several of the owner's game projects, all built in conversations with
an AI. Each project has its own notes:

- **`whiskers-coffee/DEVLOG.md`**: the active project, a co-op cat café. It's the most
  detailed: architecture, conventions, network protocol, what's in progress and what's
  next. **Start with section 11** (the current art) and the end of the log for what is open.
- **`whiskers-coffee/tools/art3d/README.md`: THE ART GUIDE.** Every picture in the café
  (people, cats, furniture, room, drinks, food) is modelled and rendered by that pipeline.
  Read it before adding or changing any art; it explains the style, units, cameras,
  anchors and exactly how to add a character, cat, furniture piece, drink or dish.
- `whiskers-coffee/DEVELOPMENT.md`: milestone checklist and technical decisions.
- **`galleon/HANDOFF.md`: start here for the ship game** (history, architecture, the licensed brig
  model and how to rebuild it, build/test/screenshot commands, open issues).
- `galleon/README.md`: realistic galleon sailing simulator in **Godot 4.3** (ocean, buoyancy, sails).
  The ship is built by `galleon/tools/build_galleon.py` (Blender via `pip install bpy`).
  Release link: `https://github.com/nitaysc/fewewfefw/releases/tag/galleon-v0.1.<run number>`.
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
- Art: do NOT cut sprites from AI images any more and do not hand-draw them in code; the owner
  rejected both. Use `whiskers-coffee/tools/art3d` (see its README). The older sheet tools
  (`ART_PROMPTS.md`, `auto_extract.py`, `refsprites.js`) are kept only as history/fallback.
