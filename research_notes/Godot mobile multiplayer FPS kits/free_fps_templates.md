# Free / open-source Godot 4.x FPS templates comparable to Cowsins' FPS Engine (Unity)

Method note: Research done 2026-11-03. GitHub star counts, licenses and "last push" dates come from `gh search repos` results fetched that day; the GitHub REST repo endpoint and github.com HTML pages were blocked from this sandbox, so the per-repo GitHub links below were checked through search results and raw README files, not by loading the github.com page. Codeberg data comes from the Codeberg API. Godot Asset Library data comes from its JSON API (`godotengine.org/asset-library/api/asset/<id>`). "Last push" means the date of the most recent push to any branch.

## Which free/open-source Godot 4 FPS projects exist, and what does each include?

### Takeaway
No free Godot 4 project matches FPS Engine's full feature set: many weapon types, ADS, recoil, inventory, pickups, advanced movement such as wallrun/dash/grapple, AI, HUD and menus. The closest all-in-one free templates are:
- bukkbeek/GodotFPS-Template: ADS, 5 working weapons, ammo/reload, zombie AI, HUD, pickups and vehicles. Work in progress.
- Chaff Games' Godot4-FPS-Template: resource-based weapons, hitscan/projectile, spray patterns. The most mature of the three.
- COGITO: an immersive-sim kit with movement, inventory, weapons-as-items, NPC AI, save/load and menus, but not shooter-focused.

The most common way to get further is to pair a strong controller with a weapon addon, for example Jeheno's Advanced FPS Controller with his Simple FPS Weapon System. None of the projects I found implements wallrun, dash or grapple as a documented feature.

### Cited Findings

**1. bukkbeek / GodotFPS-Template (closest free "full template")**
- URL: https://github.com/bukkbeek/GodotFPS-Template — MIT license, 70 stars, last push 2026-03-31 — [gh search](https://github.com/bukkbeek/GodotFPS-Template)
- Built with Godot 4.6. Marked "Work in progress… You may encounter bugs, incomplete code". The author says it was built with Cursor (AI-assisted). — [README](https://raw.githubusercontent.com/bukkbeek/GodotFPS-Template/HEAD/README.md)
- Complete features (v0.1):
  - player movement and input manager
  - weapon base and weapon manager
  - ammo tracking autoload and ammo refill pickups
  - working weapons: knife, pistol, assault rifle, burst rifle, LMG
  - patrol-see-chase-attack zombie enemy AI
  - auto doors, exploding barrels, drivable jeep vehicle
  - gameplay HUD (health/weapon/ammo), crosshair, damage display
  - muzzle flash, bullet decals, explosions, enemy spawner
  
  — [README feature table](https://raw.githubusercontent.com/bukkbeek/GodotFPS-Template/HEAD/README.md)
- Still "in progress", with arms animations done but code not yet implemented: SMG, shotgun, sniper, rifle, railgun, flamethrower, grenade launcher, hand grenade, smoke grenade, medkit. — [README](https://raw.githubusercontent.com/bukkbeek/GodotFPS-Template/HEAD/README.md)
- ADS is included ("player movement, aim-down-sights (ADS), a complete hitscan weapon system"). — [README](https://raw.githubusercontent.com/bukkbeek/GodotFPS-Template/HEAD/README.md)
- Price conflict: the itch.io page is titled "[FREE & open-source]" but shows "$4.99 USD" and says "Head to GitHub if you want access to project files". The GitHub code is free under MIT. Status on itch: "In development". — [itch.io](https://bukkbeek.itch.io/godot-fps-template)
- No multiplayer, mobile/touch or menus are mentioned. The docs are a brief README tutorial, and "a more comprehensive tutorial is planned". — [README](https://raw.githubusercontent.com/bukkbeek/GodotFPS-Template/HEAD/README.md)

**2. Chaff Games (chafmere) / Godot4-FPS-Template — "First Person Shooter Template"**
- The project I found under Chaff Games is this one; I found no repo literally named "Quality FPS".
- URL: https://github.com/chafmere/Godot4-FPS-Template — MIT, 120 stars, last push 2026-02-01 — [gh search](https://github.com/chafmere/Godot4-FPS-Template)
- Godot Asset Library #2652: "First Person Shooter Template" by ChaffGames, MIT, v2.5, Godot 4.5 listed, description says "for Godot 4.6", modified 2026-02-02. — [Asset Library](https://godotengine.org/asset-library/asset/2652)
- Weapons are defined as Weapon_Resource resources and loaded by a weapon manager with a state machine. Each weapon takes string references to animations, so placeholders can be swapped later. Projectiles (hitscan or projectile) and spray profiles are separate swappable components. "Currently 4 Weapons". The README has a "Movement Options" promo image, but I did not verify the movement feature list. — [README](https://raw.githubusercontent.com/chafmere/Godot4-FPS-Template/HEAD/README.md)
- Has dedicated documentation (https://docs.chaffgames.com/docs/fpstemplate/table_of_contents/), a YouTube tutorial series and a Discord. — [README](https://raw.githubusercontent.com/chafmere/Godot4-FPS-Template/HEAD/README.md); [itch.io](https://chafmere.itch.io/godot-4-fps-controller)
- The free itch page status is "In development". A separate paid "Godot 4 FPS Pro" adds ADS/secondary fire and a full rig; it is out of scope here. — [itch free](https://chafmere.itch.io/godot-4-fps-controller); [itch Pro](https://chafmere.itch.io/godot-4-fps-pro)
- Search snippets conflicted on the license: one listing said AGPLv3, but the GitHub repo and Asset Library both say MIT. — [Asset Library](https://godotengine.org/asset-library/asset/2652)

**3. COGITO (Phazorknight): "Immersive Sim Template"**
- The repo is now on Codeberg: https://codeberg.org/Phazorknight/Cogito. It has 71 Codeberg stars. The last commit was 2026-10-28 ("Fix ledge climbing…"), and the latest release is 1.2.0 (2026-10-10). The old github.com/Phazorknight/Cogito URL returned 404 via fetch. — [Codeberg API](https://codeberg.org/api/v1/repos/Phazorknight/Cogito); [releases](https://codeberg.org/Phazorknight/Cogito/releases)
- Godot Asset Library #2536: MIT, v1.1.6 for Godot 4.5.1, modified 2026-04-24. — [Asset Library](https://godotengine.org/asset-library/asset/2536)
- Features:
  - movement: sprint, jump, crouch, slide, stairs, ladders, bunnyhop, fall damage, headbob
  - component-based attributes: health, stamina, visibility for stealth
  - resource-based inventory with UI, including ammo and weapons item types
  - component-based interactions: doors, drawers, carryables, keypads, elevators
  - NavigationAgent-based NPC with a state machine, plus detection areas and line-of-sight
  - full gamepad support, localization
  - "Systemic Properties (very WIP)", quest system, save/load with scene persistence
  - demo level with weapons
  - full written docs plus video tutorials
  
  — [Asset Library](https://godotengine.org/asset-library/asset/2536)
- It explicitly positions itself away from shooters: "In comparison to other first person assets out there, which focus mostly on shooter mechanics, COGITO focuses on providing a framework for creating interactable objects and items." It also warns: "not 100% bug-free… hobbyist open source software". — [Asset Library](https://godotengine.org/asset-library/asset/2536)

**4. Kenney / Starter-Kit-FPS**
- URL: https://github.com/KenneyNL/Starter-Kit-FPS — MIT code with CC0 assets, 1015 stars (the most-starred FPS template found), last push 2026-03-12. The README says Godot 4.6. — [README](https://raw.githubusercontent.com/KenneyNL/Starter-Kit-FPS/HEAD/README.md)
- Asset Library #2208: v1.0.0, Godot 4.5, modified 2025-09-20. — [Asset Library](https://godotengine.org/asset-library/asset/2208)
- Features are basic: character controller, weapons as resources (cooldown, damage, spread), weapon switching with E, enemies, and CC0 sprites/models. No ADS, reload or advanced movement is listed. — [README](https://raw.githubusercontent.com/KenneyNL/Starter-Kit-FPS/HEAD/README.md)
- Derivative: gremstard/blaster-arena (MIT, 1 star, last push 2026-09-07) is built on it for Godot 4.7. It adds:
  - P2P multiplayer: host by IP, UDP 7777
  - 3 weapons, each with alternate fire, including a scoped marksman
  - health/shield/speed/double-damage pickups, kill streaks, scoreboard
  - double jump, map editor
  
  — [README](https://raw.githubusercontent.com/gremstard/blaster-arena/HEAD/README.md)

**5. Jeheno (Jeh3no): Simple FPS Weapon System + Advanced State Machine First Person Controller (a modular pair)**
- Weapon System: https://github.com/Jeh3no/Godot-Simple-FPS-Weapon-System-Asset. Asset Library #4105, MIT, v2.2, Godot 4.4 listed, modified 2026-06-21. — [Asset Library](https://godotengine.org/asset-library/asset/4105)
- Weapon System features:
  - resource-based weapons with a weapon manager
  - switching, shooting, reloading
  - bob, tilt, sway
  - hitscan and projectile types
  - shared ammo and ammo refill
  - procedural camera recoil, viewport weapon camera
  - muzzle flash, decals, explosions
  - shooting range test map with moving targets
  - properties HUD
  - fully commented GDScript
  
  Compatibility: Godot 4.4–4.7 fully supported. The author calls it "some sort of demo" for a bigger future asset. — [README](https://raw.githubusercontent.com/Jeh3no/Godot-Simple-FPS-Weapon-System-Asset/HEAD/README.md)
- Advanced controller: https://github.com/Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller — MIT, 239 stars, last push 2026-11-02, so very active. Asset Library #3475, v3.6, Godot 4.4. — [gh search](https://github.com/Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller); [Asset Library](https://godotengine.org/asset-library/asset/3475)
- Advanced controller features: FSM-based, modular camera, debug HUD. The test map has jump pads, gravity zones, conveyors and slippery zones. — [Asset Library](https://godotengine.org/asset-library/asset/3475)

**6. TheDahoom / FPS-Multiplayer-Template (multiplayer-focused)**
- URL: https://github.com/TheDahoom/FPS-Multiplayer-Template — MIT (code and the author's 3D assets), 70 stars, last push 2026-04-28. Asset Library #3658: v1.2.4, Godot 4.3, modified 2025-03-19. — [Asset Library](https://godotengine.org/asset-library/asset/3658)
- Features:
  - multiplayer: host prints a public IP, UPnP with port 9999 forwarding as fallback; base follows DevLogLogan's tutorial
  - full map with custom assets
  - controller support including menus
  - cinematic main menu, pause and options menus (fullscreen, FPS/ping counters, sensitivity)
  - bullet wall collision, random respawns, music and bullet sounds
  - no weapon variety, ADS or reload is listed
  
  — [README](https://raw.githubusercontent.com/TheDahoom/FPS-Multiplayer-Template/HEAD/README.md)

**7. Liblast (libre multiplayer FPS game and framework)**
- The game repo https://codeberg.org/Liblast/Liblast says "WARNING! CURRENTLY THIS PROJECT IS NOT WORKING". Its last commit was 2025-04-30 and it has 11 stars. — [Codeberg API](https://codeberg.org/api/v1/repos/Liblast/Liblast); [repo page](https://codeberg.org/Liblast/Liblast)
- The old GitHub repo unfa/liblast (MIT, 129 stars) was last pushed 2023-02-03. The Codeberg Liblast-legacy repo is archived. — [gh search](https://github.com/unfa/liblast); [Codeberg API](https://codeberg.org/api/v1/repos/Liblast/Liblast-legacy)
- Active successor: https://codeberg.org/Liblast/liblast-framework, "an integrated set of systems… for (primarily) online FPS game development". It has 23 stars, its last commit was 2026-03-16 (docs), and repo metadata was updated 2026-10-19. — [Codeberg API](https://codeberg.org/api/v1/repos/Liblast/liblast-framework)

**8. AxelReviron / Godot-FPS-Template**
- URL: https://github.com/AxelReviron/Godot-FPS-Template — MIT, 3 stars, last push 2026-01-09, Godot 4.4.1, status WIP. — [README](https://raw.githubusercontent.com/AxelReviron/Godot-FPS-Template/HEAD/README.md)
- "Currently, only the player's movement system is fully implemented". That movement is an FSM with idle, walk, sprint, jump (optional double jump), fall, crouch and slide. It also has resource-based weapons, a central input singleton and a debug panel. Recoil is on the to-do list. — [README](https://raw.githubusercontent.com/AxelReviron/Godot-FPS-Template/HEAD/README.md)

**9. Movement-only controllers (pair with a weapon system)**
- ColormaticStudios quality-godot-first-person-2:
  - URL: https://github.com/ColormaticStudios/quality-godot-first-person-2 — MIT, 216 stars, last push 2026-09-30. The GitHub repo is a mirror of git.colormatic.org.
  - Asset Library #2418 lists v2.6.6 for Godot 4.7 (modified 2026-08-11).
  - Features: sprint, crouch, in-air momentum, FOV smoothing, crosshairs, gamepad support. No slide, wallrun or weapons.
  
  — [README](https://raw.githubusercontent.com/ColormaticStudios/quality-godot-first-person-2/HEAD/README.md); [Asset Library API](https://godotengine.org/asset-library/api/asset?filter=first%20person&godot_version=any)
- Btan2/Q_Move ("Quake-like controller"): GPL-3.0, 129 stars, last push 2024-02-21. The GitHub version is Godot 3.5; an "updated version" is Godot 4.2.1 Mono (C#). The license is copyleft. — [README](https://raw.githubusercontent.com/Btan2/Q_Move/HEAD/README.md)
- yosoyfreeman/godot_fps_camera: CC0, 15 stars, last push 2025-01-04. — [gh search](https://github.com/yosoyfreeman/godot_fps_camera)

**10. Weapon-only addons**
- JarLowrey/GodotWeapons: MIT, 82 stars, last push 2025-12-29, Godot 4.5. A component approach: Ammo, Charge, Magazine with reload, AutoAttack, BulletSpawner, Combo. — [README](https://raw.githubusercontent.com/JarLowrey/GodotWeapons/HEAD/README.md)
- toledosq/godot_weapon_manager:
  - MIT, 12 stars, last push 2024-02-06. "on the backburner and will not be receiving updates".
  - Features: FPS controller, drag-and-drop inventory, dynamic recoil curves, sway, ammo types, grenades, item inspection.
  
  — [README](https://raw.githubusercontent.com/toledosq/godot_weapon_manager/HEAD/README.md)
- CiaNCI-Studio/ShooterKit ("3D Shooter Kit"): MIT, 6 stars, last push 2025-02-23. Asset Library #3746, v0.8 beta, Godot 4.3. Raycast or rigidbody projectiles, aim zoom, impact particles. — [Asset Library](https://godotengine.org/asset-library/asset/3746)

**11. Multiplayer netcode demos (FPS-flavored)**
- jonathaneeckhout/godot-fps-multiplayer:
  - BSD-2-Clause, 7 stars, last push 2025-09-26.
  - A server-authoritative FPS demo with client prediction, server reconciliation, lag compensation, interpolation and clock sync.
  
  — [README](https://raw.githubusercontent.com/jonathaneeckhout/godot-fps-multiplayer/HEAD/README.md)
- foxssake/netfox (a general multiplayer addon, not an FPS template): MIT, 1124 stars, last push 2026-09-26. — [gh search](https://github.com/foxssake/netfox)

**12. Other small or old templates found (low relevance)**
- MilkAndBanana01/godot-fps-template: CC0, 82 stars, last push 2022-06-24. The itch page said the author had not tested it with Godot 4, so treat it as Godot 3-era. — [gh search](https://github.com/MilkAndBanana01/godot-fps-template); [itch](https://milkandbanana.itch.io/godot-fps-template)
- futuramafan4/Godot-FPS-Template is Godot 3.5. TwistedTwigleg/Godot_FPS_Tutorial is Godot 3. Asset Library "Multiplayer FPS" #666 is Godot 3.2. Skip all of these. — [gh search](https://github.com/futuramafan4/Godot-FPS-Template); [Asset Library](https://godotengine.org/asset-library/asset/666)
- DotWith/FPS-Template: "simple FPS Template made in Godot 4", MIT, 5 stars, last push 2023-02-03. Abandoned. — [gh search](https://github.com/DotWith/FPS-Template)
- Osaka-Research/fps-starter-kit claims "Production-ready… Godot 4.3", but it has 0 stars and was pushed 2026-10-23. It is unverified and should be treated with caution. — [gh search](https://github.com/Osaka-Research/fps-starter-kit)
- Gweebo's FPS template on itch.io (retro/PSX-style, Godot 4.3): procedural recoil with patterns, sway, tilt, headbob, destructibles. Status "In development". I could not parse the price. — [itch](https://gweebo.itch.io/gweebos-fps-template)
- godotengine/tps-demo (1391 stars, last push 2026-08-31) and gdquest-demos/godot-4-3d-third-person-controller (1043 stars, last push 2026-08-15) are third-person, not FPS. They are useful only as code/quality references. — [gh search](https://github.com/godotengine/tps-demo)
- RNB Games "PRO FPS & Enemy AI Template": its feature list is the closest to FPS Engine (FSM AI, recoil, sniper scope, weapon drop, reload). However, the page shows a price ($65 USD with a 16.25 sale price), so it is NOT free and is out of scope. — [itch](https://rnb-games.itch.io/pro-fps-template-godot)

### Inferences
- Best free "out-of-the-box" FPS: bukkbeek (widest gameplay coverage: ADS, AI, HUD, pickups) or Chaff Games (cleanest weapon architecture plus real docs). Neither has menus, multiplayer or wallrun/dash/grapple.
- Best "build-your-own FPS Engine" stack:
  - Jeheno Advanced FPS Controller (very active) plus Jeheno Weapon System (recoil, reload, ammo, switching)
  - plus TheDahoom, netfox or Liblast framework patterns for multiplayer
  - plus COGITO ideas for inventory, save and NPCs
- Wallrun, dash and grapple would have to be custom-built on any free option.
- Mobile/touch: none of the READMEs or listings I read mention touch controls or mobile support. Gamepad support exists in COGITO, Colormatic and TheDahoom.

### Gaps
- Not verified or not found:
  - Brackeys Godot 4 FPS repo
  - Majikayo FPS tutorial code
  - "Wolfie FPS"
  - "Ramatak"
  - "Bastion"
  - "Sapphire/GDQuest shooter demos"
  - "Godot FPS Kit"
  - "Arena Shooter Template"
  - "BoomerShooter template"
  
  Searches either did not surface them or yielded only tiny repos (e.g. DichterDev/GodotArenaShooter, 0 stars; billowper/godot-boomer-shooter, 1 star).
- Godot Asset Store (store-beta/store.godotengine.org): I could not search it from this environment, and web searches returned no store listings.
- I could not open github.com HTML pages or the REST API, so commit counts, release lists and open issues on GitHub repos are unverified.
- COGITO 1.2.0's exact Godot version requirement is unconfirmed. Asset Library v1.1.6 targets 4.5.1.
- I did not check download counts. The Asset Library API does not expose them.

## Which are actively maintained (late 2026) vs abandoned?

### Takeaway
Active as of Oct–Nov 2026: Jeheno controller (push 2026-11-02), COGITO (commit 2026-10-28, release 1.2.0 on 2026-10-10), Colormatic controller (2026-09-30), netfox (2026-09-26) and blaster-arena (2026-09-07).

Recently active but slowing (pushes in H1 2026): Chaff Games (2026-02-01), bukkbeek (2026-03-31), Kenney (2026-03-12), TheDahoom (2026-04-28), Jeheno weapon system (asset updated 2026-06-21) and AxelReviron (2026-01-09).

Abandoned or stalled: Liblast game (not working, last commit 2025-04), unfa/liblast (2023), toledosq weapon manager (explicitly backburnered), Q_Move (2024), DotWith (2023), and all Godot 3 templates.

### Cited Findings
- Jeheno Advanced FPS Controller last push 2026-11-02 — [gh search](https://github.com/Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller)
- COGITO last commit 2026-10-28, release 1.2.0 on 2026-10-10 — [Codeberg API](https://codeberg.org/api/v1/repos/Phazorknight/Cogito)
- Colormatic quality-godot-first-person-2 last push 2026-09-30 — [gh search](https://github.com/ColormaticStudios/quality-godot-first-person-2)
- Chaff Games template last push 2026-02-01; Asset Library v2.5 2026-02-02 — [Asset Library](https://godotengine.org/asset-library/asset/2652)
- bukkbeek last push 2026-03-31, itch status "In development" — [itch](https://bukkbeek.itch.io/godot-fps-template)
- Kenney Starter Kit FPS last push 2026-03-12 — [gh search](https://github.com/KenneyNL/Starter-Kit-FPS)
- TheDahoom last push 2026-04-28 (Asset Library entry still 1.2.4 from 2025-03-19) — [Asset Library](https://godotengine.org/asset-library/asset/3658)
- Liblast game "NOT in a working state", last commit 2025-04-30; liblast-framework last commit 2026-03-16 — [Codeberg](https://codeberg.org/Liblast/Liblast); [Codeberg API](https://codeberg.org/api/v1/repos/Liblast/liblast-framework)
- toledosq weapon manager: "on the backburner and will not be receiving updates" — [README](https://raw.githubusercontent.com/toledosq/godot_weapon_manager/HEAD/README.md)

### Inferences
- The free templates closest to FPS Engine in scope (bukkbeek, Chaff) are maintained by one person each and have not been pushed for 7–9 months. Treat them as starting points, not supported products.
- COGITO and the Jeheno assets have the healthiest maintenance cadence.

### Gaps
- Push dates count any branch and do not prove substantive feature work. I did not inspect commit contents for most GitHub repos.
