# AI handoff: start here

This repo holds several of the owner's game projects, all built in conversations with
an AI. Each project has its own notes:

- **`whiskers-coffee/DEVLOG.md`**: the active project, a co-op cat café. It's the most
  detailed: architecture, conventions, network protocol, what's in progress and what's
  next.
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
