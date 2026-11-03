# Godot 4 Multiplayer FPS Bases and Internet Multiplayer for Android Phones

Research date: 2026-11-03. Note: the GitHub API was blocked in this session, so stars, last-commit dates and release dates for GitHub repos could not be checked directly. Repo facts below come from fetched README pages or search snippets, and are marked where uncertain.

## Q1: What open Godot 4 multiplayer FPS projects, demos, templates and netcode addons exist?

### Takeaway
No open, maintained, mobile-ready Godot 4 multiplayer FPS exists. The usable pieces are small MIT FPS templates that connect by IP (TheDahoom's FPS-Multiplayer-Template, Dankakes, SimpleFPS) and the netfox addon (MIT, rollback and lag compensation, noray connectivity), whose only example is a brawler. Liblast, the best-known open Godot FPS, says in its own README that it is not in a working state.

### Cited Findings
- **netfox (foxssake/netfox)**: MIT license. "Godot 4.x is supported." The examples, including Forest Brawl, were written for Godot 4.1 and may not work in other versions. The addons are netfox (core: timing, rollback), netfox.noray (connects players through noray), netfox.extras (base classes for input management, weapons, etc.) and netfox.internals (shared dependency). Features: consistent timing across machines, client-server architecture, interpolation, lag compensation through client-side prediction plus server-side reconciliation, and noray connectivity. Examples: Forest Brawl (a party brawler, in the repo) and the third-party "Godot Rocket League" (physics rollback). — [netfox GitHub](https://github.com/foxssake/netfox)
- The netfox docs list a RewindableAction node and a "Predicting input" tutorial. The docs mention no FPS example or tutorial, and Forest Brawl ships with each release for Windows and Linux. — [netfox docs](https://foxssake.github.io/netfox/latest/)
- **Official godot-demo-projects /networking**: folders multiplayer_bomber, multiplayer_pong, webrtc_minimal, webrtc_signaling, websocket_chat, websocket_minimal and websocket_multiplayer. All are GDScript, the WebRTC demos rely on the C++ GDExtension, and all use the Compatibility renderer. There is no FPS demo. — [godot-demo-projects/networking](https://github.com/godotengine/godot-demo-projects/tree/master/networking)
- **Liblast** (moved to Codeberg): a "Libre Multiplayer FPS" in GDScript using the Godot Jolt and Panku Console add-ons. `main` tracks the latest stable Godot 4, and the project was upgraded to 4.3 in Sept 2024. The last commit (2025-04-30) added a warning that the repository is "NOT in a working state" and redirected readers to a "Liblast Framework" repo. CI is failing, and the license file exists but its type wasn't shown on the page. — [Liblast on Codeberg](https://codeberg.org/Liblast/Liblast)
- **TheDahoom/FPS-Multiplayer-Template**: MIT, with MIT-licensed assets. Features: a full map with custom 3D assets, controller support, a cinematic main menu, pause/options menus (FPS and ping counters, sensitivity), bullet wall collision, random respawns, and sounds. Friends join a host by IP using UPnP or manual port forwarding on port 9999. Touch/mobile controls are not mentioned. — [GitHub](https://github.com/TheDahoom/FPS-Multiplayer-Template). Search results say the Asset Library listing targets Godot 4.3. — [Godot Asset Library edit](https://godotengine.org/asset-library/asset/edit/15536)
- **Dankakes/Godot-Multiplayer-FPS-Template**: a commented example for Godot 4.1 with PvP damage, teams, a chatbox and an animated FPS controller. License not confirmed. — [itch.io page](https://dankakes.itch.io/godot-multiplayer-fps-template)
- **djeanql/SimpleFPS**: a simple Godot 4 multiplayer FPS with a pistol, usernames, death messages and UPnP auto port forwarding. Its README lists "somewhat choppy" movement as a known issue. — [GitHub](https://github.com/djeanql/SimpleFPS)
- **CopperGecko/Godot-4-Multiplayer-FPS**: "A simple free to use multiplayer FPS for those who want the base code for most things multiplayer". 1 star, last push 2025-08-28, no license listed (from GitHub search). — [GitHub](https://github.com/CopperGecko/Godot-4-Multiplayer-FPS)
- **Photon Fusion for Godot**: a GDExtension addon. The 3.0.0 Preview (May 2026) requires Godot 4.6+, and its docs say it is a development preview not intended for production, with an API that may change. — [Photon Fusion Godot SDK page](https://doc.photonengine.com/fusion-godot/current/getting-started/sdk-download); [Godot store listing](https://store.godotengine.org/asset/photon/photon-fusion/)

### Inferences
- The most practical base is probably a small MIT FPS template (TheDahoom's is the most complete) using Godot's built-in ENet with MultiplayerSpawner/MultiplayerSynchronizer, plus touch controls added. Switching its connection step to a dedicated server or to netfox.noray would fix the internet problem. netfox could be added later if lag compensation matters, but no netfox FPS sample exists to copy, so this is more work.
- The netfox examples target 4.1. On a current Godot (4.5-4.7) some breakage is possible.

### Gaps
- Not verified (GitHub API blocked): star counts, exact last-commit dates and netfox's latest version number.
- I did not look up DevLogLogan, Battery Acid Dev or Brackeys-style tutorial repos individually, so I can't confirm their URLs or licenses.
- I found no Godot 4 FPS that already has Android touch controls and online play.

## Q2: How can phones on mobile data or behind CGNAT connect over the internet? (options, costs, limits)

### Takeaway
Phones on mobile data usually sit behind carrier-grade NAT (CGNAT), so a phone can't host a game other phones join by IP, and port forwarding or UPnP won't help. The working options are:
- an always-reachable dedicated server on a public IP (VPS, cheap or free)
- a punch-through-plus-relay service: noray (self-host, or a free public test instance), Edgegap relays, or EOS P2P
- a hosted backend (W4 Cloud, GD-Sync, Nakama, Photon)

### Cited Findings
**Why plain ENet hosting fails**
- Most mobile providers use CGNAT. The phone gets a private address, so inbound connections can't reach it and port forwarding through a phone or hotspot doesn't work. — [Nextcloud forum](https://help.nextcloud.com/t/port-forwarding-not-working-with-android-phone-as-wifi-adapter/126516); [BATC forum](https://forum.batc.org.uk/viewtopic.php?p=31241)
- An answer on Godot Q&A says no mobile carrier will let you do port forwarding, and suggests a relay or VPN instead. — [Godot Q&A](https://ask.godotengine.org/120755/my-game-is-working-on-lan-but-need-to-step-it-a-bit)
- Some carriers don't use CGNAT, so behavior varies by carrier. — [BATC forum](https://forum.batc.org.uk/viewtopic.php?p=31233)

**noray + netfox.noray**
- noray is MIT-licensed and orchestrates connections: it tries UDP hole punching first and relays traffic when that fails. It's a fork of Natty. It runs on Bun 1.3+ or as the Docker image `ghcr.io/foxssake/noray:main`. Ports: 8890/TCP (registration), 8891/TCP (metrics), 8809/UDP (port registrar) and 49152-51200/UDP (relays). The relay supports UDP only, relay ports are limited (allocated at startup), and exposing many ports can slow deploys. No CPU or RAM requirements are given. — [noray GitHub](https://github.com/foxssake/noray)
- The netfox maintainers run a free public noray instance at `tomfol.io:8890` for prototyping. It has usage limits and no uptime guarantees, and they don't recommend it for shipping games. — [netfox GitHub](https://github.com/foxssake/netfox); [netfox docs](https://foxssake.github.io/netfox/latest/)

**WebRTC**
- On native platforms, including Android, Godot's WebRTC classes need the external webrtc-native GDExtension. Peers also need a signaling server (often WebSocket) to exchange SDP, and can disconnect from it once connected. Android exports must enable the INTERNET permission. — [Godot docs: WebRTC](https://docs.godotengine.org/en/stable/tutorials/networking/webrtc.html)
- webrtc-native is MIT (libdatachannel under other permissive licenses). Build targets are Windows, Linux, macOS, Android and iOS. The default build supports Godot 4.1+. — [webrtc-native GitHub](https://github.com/godotengine/webrtc-native)
- The Godot docs page doesn't mention STUN or TURN. — [Godot docs: WebRTC](https://docs.godotengine.org/en/stable/tutorials/networking/webrtc.html)

**W4 Cloud (W4 Games)**
- Lobbies, matchmaking queues and WebRTC signaling for P2P. It's used through the w4gd editor addon. — [W4 Cloud launch](https://w4games.com/2024/03/05/w4-cloud-is-here-the-new-multiplayer-infrastructure-for-godot-games); [apis.io listing](https://apis.io/providers/w4-games/)
- Described as an AGPL stack that can be self-hosted, with a free tier whose limits aren't specified. — [Supercraft blog (status check dated Aug 20, 2026)](https://crux.supercraft.host/blog/best-godot-backend-2026/)
- The W4 Cloud product page at w4games.com/w4cloud returned 404 when fetched, and I found no public price list. W4 Games raised a Series B led by Tencent in 2026. — [cinevva news](https://app.cinevva.com/fr/news/2026-08-25-w4-games-tencent-godot-asia)

**Nakama (Heroic Labs)**
- Open source (Apache 2.0) and free to self-host, with a maintained Godot 4 SDK. — [Supercraft blog](https://crux.supercraft.host/blog/best-godot-backend-2026/)
- Heroic Cloud pricing isn't published as a simple figure. AWS Marketplace lists Nakama CPU at $13.33/day and DB CPU at $6.67/day (about $600/month together). Aggregator sites quote $600-$6,000/month tiers, and sources conflict. — [Heroic Labs pricing](https://heroiclabs.com/pricing); [AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-zfxkalyjehlh2)

**GD-Sync**
- Closed-source, Godot-only real-time multiplayer service with no self-hosting. Free plan: 4 players per lobby, 200 MB/day transfer, 25 MB cloud storage. — [Supercraft blog](https://crux.supercraft.host/blog/best-godot-backend-2026/) (the pricing page couldn't be fetched to verify)

**Talo**
- MIT, with a native Godot plugin and a free tier of 10,000 players. Its features are leaderboards, player data, events and stats, not real-time netcode or relays. — [Supercraft blog](https://crux.supercraft.host/blog/best-godot-backend-2026/)

**LootLocker**
- Ended its free-forever tier in May 2025 (now a 30-day trial, with free use only for non-commercial projects). — [Supercraft blog](https://crux.supercraft.host/blog/best-godot-backend-2026/)

**Epic Online Services (EOSG plugin by 3ddelano)**
- GDExtension for Godot 4.2+. Platforms include Android (x64/arm64), and features include P2P multiplayer and lobbies. Android setup needs the EOS Android SDK from the Epic Developer Portal, the Android build template and a manual `.aar` dependency. — [EOSG docs](https://3ddelano.github.io/epic-online-services-godot); [GitHub](https://github.com/3ddelano/epic-online-services-godot)
- A different project, gd-eos, offers `EOSMultiplayerPeer`. — [ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fdaylily-zeleen%2Fgd-eos)

**GodotSteam**
- The GDExtension build lists Android ARM64 (tied to Steam Frame testing). Precompiled Android bundles were pulled after 4.17.1 and were expected back in 4.18. — [GodotSteam blog](https://godotsteam.com/blog/category/patches/page/2/); [Asset Library](https://godotengine.org/asset-library/asset/edit/24540)

**Photon Fusion for Godot**
- Preview only, requires Godot 4.6+, not for production. — [Photon docs](https://doc.photonengine.com/fusion-godot/current/getting-started/sdk-download)

**Rivet**
- rivet.gg now redirects to rivet.dev. Rivet now calls itself "The orchestrator for agentic workloads" (Actors, Agents, Workflows). It doesn't mention game servers, Godot or matchmaking, only "Multiplayer state over WebSockets". It is Apache 2.0 and self-hostable. — [rivet.dev](https://www.rivet.dev/)
- The old Godot plugin (rivet-gg/plugin-godot, Apache-2.0) is still listed in the Asset Library. — [Asset Library](https://godotengine.org/asset-library/asset/edit/11140)

**Edgegap**
- Free tier: no card, 1 app, up to 1.5 vCPU / 3 GB, 1 concurrent deployment, with a 60-minute uptime cap per deployment.
- Edge Cloud: $0.00115/vCPU-minute (about $0.069/vCPU-hour), $0.10/GB egress, 24-hour maximum container runtime.
- Distributed Relays: free trial for 50 CCU with 160 GB egress, then $8/month for 100 CCU.
- Source for all of the above: [Edgegap pricing](https://edgegap.com/pricing)

**VPS hosting**
- **Oracle Cloud Always Free**:
  - Ampere A1: 1,500 OCPU-hours and 9,000 GB-hours per month, which Oracle equates to 2 OCPU / 12 GB.
  - Two AMD E2.1.Micro instances (1/8 OCPU, 1 GB, 50 Mbps).
  - 10 TB/month outbound.
  - Oracle may reclaim instances that are idle for 7 days (95th-percentile CPU, network and, for A1, memory all under 20%).
  - Source: [Oracle docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
  - Older sources often say 4 OCPU / 24 GB. The current page says 2 / 12.
- **Hetzner Cloud**: Cost-Optimized from €5.99/month and Regular Performance from €6.49/month (excl. VAT). Locations: Germany, Finland, Singapore, and the USA (Oregon, Virginia). — [Hetzner Cloud](https://www.hetzner.com/cloud/)

**Headless server in CI and Docker**
- Export with `godot --headless --export-release "<preset>" <path>`. The barichello/godot-ci Docker image is the common GitHub Actions approach, and in Actions HOME is /github/home, which affects template paths. — [search summary; godot-proposals #1411](https://github.com/godotengine/godot-proposals/issues/1411)
- rivet-gg/godot-docker shows a multi-stage Dockerfile: export the Linux build, then run it with `--headless -- --server` on slim Ubuntu. — [rivet-gg/godot-docker](https://github.com/rivet-gg/godot-docker)

### Inferences
- **GodotSteam** is not a real option for phones. Steam P2P/relay needs a logged-in Steam client, which ordinary Android phones don't have. The Android build seems aimed at the Steam Frame device. This is my inference, not stated by a source.
- **EOS** appears to be free to use (Epic markets EOS as free), and its P2P includes relay fallback, so it could work on Android. However, the Android setup (AAR and SDK download from the Epic portal) is heavy for an AI that only edits files. EOS pricing wasn't checked against a primary source in this session.
- **Tailscale/ZeroTier**: each friend would install a VPN app and join a shared network. That works around CGNAT, but every player has to set it up, and Android allows only one VPN at a time. It's a fallback, not a product solution. I found no primary sources on this in this session.
- **Fly.io**: not verified this session. Its UDP support needs specific config, and it no longer has a free tier (from training data, uncertain).

### Gaps
- I couldn't get W4 Cloud's current pricing or free-tier limits (product page 404).
- I didn't verify the GD-Sync pricing page (404) or Fly.io pricing and UDP specifics.
- I found no primary source for the Tailscale/ZeroTier approach or for EOS pricing.
- I don't know whether noray's relay holds up for 60 Hz FPS traffic, or what the public instance's exact limits are.

## Q3: What is the simplest, cheapest reliable setup for a few friends playing an FPS on Android phones, maintainable by an AI that only edits files and uses GitHub Actions?

### Takeaway
The simplest option that works on mobile data is an authoritative headless Godot server on a public-IP VPS: an Oracle Always Free A1 instance, or Hetzner at about €6/month if Oracle reclaims it or signup fails. Phones connect to it as plain ENet clients, so there are no NAT problems. GitHub Actions can build the Android APK and the Linux server binary or Docker image, and deploy over SSH. The zero-infrastructure alternative is netfox.noray with the free `tomfol.io:8890` instance, with the caveat that it's for prototyping and has no uptime guarantee.

### Cited Findings
- A server on a public IP avoids CGNAT because phones only make outbound connections, which CGNAT allows. — [BATC forum](https://forum.batc.org.uk/viewtopic.php?p=31241)
- Oracle Always Free: 2 OCPU / 12 GB A1 and 10 TB egress per month, but idle instances may be reclaimed. — [Oracle docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- Hetzner Cloud from €5.99/month. — [Hetzner](https://www.hetzner.com/cloud/)
- Headless export and Docker run pattern (`--headless -- --server`). — [rivet-gg/godot-docker](https://github.com/rivet-gg/godot-docker)
- Free noray instance `tomfol.io:8890`, not for shipping. — [netfox](https://github.com/foxssake/netfox)
- Edgegap's free tier caps deployments at 60 minutes, which is fine for a session but not an always-on server. — [Edgegap pricing](https://edgegap.com/pricing)

### Inferences
- **Recommended layout**:
  - One Godot project with a `--server` command-line flag, exported as an Android client and a Linux headless server.
  - Server-authoritative ENet (the default high-level multiplayer API) using MultiplayerSpawner/MultiplayerSynchronizer, at 2-8 players.
  - A GitHub Actions workflow that exports both builds, uploads the APK as a release artifact, and either pushes a Docker image to GHCR or scp's the binary to the VPS and restarts a systemd service (SSH key in repo secrets).
  - The server IP or hostname is baked into the client, or entered in the menu.
- The Godot export is ARM64-compatible for an Oracle A1 server, but check that `linux.arm64` export templates exist for the chosen Godot version. Both are uncertain.
- Oracle's idle reclaim could hit a game server that's mostly idle. A cron "keep-alive" load works around it, but that may conflict with Oracle's terms. Hetzner avoids the issue for about €6-7/month.
- **Second choice: netfox.noray with the public instance.** No server is needed, but a phone hosts and the relay fallback has no guarantees. The upgrade path is to self-host noray on the same VPS, which needs a range of open UDP relay ports.
- Avoid for this use case:
  - Nakama: heavy, and Heroic Cloud is expensive.
  - W4 Cloud: pricing unclear.
  - GodotSteam: no Steam client on phones.
  - Photon Fusion: preview only.
  - Rivet: no longer a game server host.
  - EOS: complex Android setup.
  - GD-Sync: closed source, 4 players per lobby on the free plan.

### Gaps
- I couldn't confirm Oracle Free Tier sign-up reliability, Ampere availability in each region, or whether Oracle reclaims game servers in practice.
- I have no measured bandwidth or CPU figures for a headless Godot FPS server with about 8 players.
