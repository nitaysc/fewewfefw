# Roost MX: mobile motocross simulator (Unity 6, Android)

A physics-first motocross sim for Android phones. This folder is a **Unity 6 project**
(`6000.0.84f1`, URP, Input System). Everything original: no assets, names or branding
from other games.

**Current state: Stage 1 (core motorcycle physics prototype)** plus the base of Stage 2
(an independent rider body). Open the project, press Play, and ride a generated motocross
track with jumps, berms, whoops, sand and braking bumps. The bike, rider and environment
art are **procedural placeholders**; the physics is real. See [What is real and what is
placeholder](#what-is-real-and-what-is-placeholder).

---

## Run it

### In the Unity editor (PC or Mac)
1. Install **Unity Hub** and **Unity 6000.0.84f1** (any 6000.0 LTS works) with **Android
   Build Support** (includes OpenJDK, Android SDK and NDK).
2. Hub → *Add project from disk* → select this `roost-mx` folder.
3. On first open, `ProjectSetup` runs by itself. It creates the URP pipeline asset, the
   template materials, `Assets/RoostMX/Scenes/TestTrack.unity`, the build settings and the
   Android player settings. You can re-run it from **Roost MX ▸ Setup Project**.
4. Open `TestTrack` and press **Play**. Pressing Play in any empty scene also works:
   `Bootstrap` creates the game itself.

If Unity asks to enable the new Input System backend, say yes. The code supports both
backends either way.

### Build the APK
- **Editor:** *Roost MX ▸ Build Android APK* → `Builds/roost-mx.apk`.
- **Command line:**
  `Unity -batchmode -quit -projectPath roost-mx -buildTarget Android -executeMethod RoostMX.EditorTools.BuildScript.BuildAndroid -customBuildPath Builds/roost-mx.apk`
- **GitHub Actions** (`.github/workflows/build-roost-mx.yml`): every push that touches
  `roost-mx/` runs the physics tests and the compile check. If a Unity license is in the
  repository secrets it also builds the APK with GameCI and publishes it as a
  `roost-mx-v0.1.N` release (not marked "latest", so the other games' links keep working).
  One-time setup, by the repo owner:
  1. Activate Unity Personal on your own computer (Unity Hub → sign in → Preferences →
     Licenses → Add → Get a free personal license).
  2. Copy the contents of the license file into a repository secret named
     `UNITY_LICENSE`. The file is `C:\ProgramData\Unity\Unity_lic.ulf` on Windows,
     `/Library/Application Support/Unity/Unity_lic.ulf` on macOS or
     `~/.local/share/unity3d/Unity/Unity_lic.ulf` on Linux.
  3. Add secrets `UNITY_EMAIL` and `UNITY_PASSWORD` (your Unity account).
  4. Re-run the workflow. Without these secrets the Android job is skipped with a warning.
- The APK is signed with `android-signing/roostmx-debug.keystore` (committed on purpose),
  so each build installs over the previous one.

### Headless tests (no Unity needed)
```sh
dotnet run -c Release --project roost-mx/Tests                 # all ride tests
dotnet run -c Release --project roost-mx/Tests -- jump lap     # some of them
ROOST_CSV=1 dotnet run -c Release --project roost-mx/Tests     # + telemetry CSVs in Tests/out
python3 roost-mx/tools/crashview.py roost-mx/Tests/out/lap_450F.csv   # what led to each crash
dotnet run -c Release --project roost-mx/Tests -- map && python3 roost-mx/tools/render_track.py roost-mx/Tests/out/track.bin roost-mx/Tests/out/track.png
dotnet build -c Release -p:Editor=true roost-mx/tools/unity-compile-check  # type-check Unity scripts
```

---

## Controls

| Action | Touch (landscape) | Keyboard | Gamepad |
|---|---|---|---|
| Steer / lean | left pad: drag left/right from where you touch | A / D | left stick |
| Rider body (fore-aft, left-right) | small stick above the steer pad | I K / J L | right stick |
| Throttle (analog) | right strip: higher finger = more gas | W | RT |
| Front brake | FRONT BRAKE | S | LT |
| Rear brake | REAR BRAKE | Space | X / West |
| Stand / sit | STAND (toggle) | Left Ctrl | RB toggle, A hold |
| Gear + / − | shown when auto-gearbox is off | E / Q | Y / B |
| Clutch | strip, shown when auto-clutch is off | Left Shift | LB |
| Camera (chase / close / helmet) | CAM | C | View |
| Respawn | RESET | R | |
| Telemetry panel | DATA | T | |
| Pause / settings | II | Esc | Menu |

Steering works the way a real bike's does. With *steering assist* on (the default), your
input is a **lean request**. A virtual rider counter-steers to start the lean, holds the
bars, and keeps within the lean the tyres and the berm can support. With it off, you push
the bars yourself (counter-steer) on top of the bike's own self-steer. In the air the
steer input whips the rider's torso, and body fore-aft pitches the bike through the
rider's mass.

Pause menu: bike (450F / 250F), auto gearbox, auto clutch, steering assist, balance
assist, brake assist (eases the front brake when the rear lifts), wheelie assist (eases
the gas when the front climbs), graphics Low/Medium/High/Ultra, 30/60 FPS, camera.
Settings are saved.

---

## Architecture

```
roost-mx/
  Assets/RoostMX/Scripts/Sim/     engine-independent physics core (System.Numerics, no UnityEngine;
                                  asmdef noEngineReferences). The same files run in Unity and in Tests/.
    BikeSpec.cs                   all numbers for the 450F and 250F (geometry, suspension, engine, gearing, rider)
    TireModel.cs                  combined-slip Pacejka-style tyre with camber thrust
    WheelSystem.cs                torus tyre contact, unsprung mass, spring/damper/bump stop, tyre carcass, relaxation lengths
    Powertrain.cs                 engine (torque curve, engine braking, limiter, idle, stall), friction clutch, gearbox
    RiderBody.cs                  the rider as an independent 75 kg body + torso
    BikeSim.cs                    the step: contact → virtual rider → substepped drivetrain/tyres → forces
    Surface.cs                    hardpack / loose / sand / grass / mud grip properties
    Track/TrackLayout.cs          spline circuit, jumps, whoops, berms, surfaces → height + splat grids
    Track/TrackPilot.cs           an AI rider that drives through BikeInput only (tests, future AI)
  Assets/RoostMX/Scripts/Game/    Unity layer
    UnityAdapters.cs              Rigidbody ↔ ISimBody, Physics.SphereCast ↔ IGroundProbe
    BikeController.cs             Rigidbody setup, FixedUpdate at 200 Hz, crash and respawn
    BikeVisual.cs / RiderVisual.cs placeholder bike and rider, posed from the simulation
    TrackBuilder.cs               Terrain + props from TrackLayout
    CameraController.cs           chase, close chase, helmet
    MobileInputManager.cs         touch UI + keyboard + gamepad → BikeInput
    GameUI.cs                     HUD, telemetry, pause/settings, lap timer
    EngineAudio.cs                procedural single-cylinder engine, tyres, wind, impacts
    DirtFx.cs                     roost and dust from the tyre model
    SettingsManager.cs            persisted settings, quality presets
    Bootstrap.cs                  builds the scene at runtime
  Assets/RoostMX/Editor/          ProjectSetup (URP, materials, scene, player settings), BuildScript (CI)
  Tests/                          headless ride tests (dotnet)
  tools/unity-compile-check/      type-checks the Unity scripts against Unity reference DLLs
```

The physics core never touches Unity. `BikeController` hands it the Rigidbody through
`ISimBody` and the world through `IGroundProbe`. The core adds forces and torques, and
PhysX integrates the chassis. The headless tests swap in a small rigid-body integrator
and the same height grid the Terrain is built from, so the tests ride the same track the
game does.

## How the physics works

Everything that moves the bike is a force or torque from one of these sources. Nothing is
animated or scripted.

- **Chassis:** a Rigidbody with the bike's sprung mass and an explicit inertia tensor. The
  wheels are not colliders: each wheel sweeps a sphere the size of the tyre's cross-section
  from the rim point nearest the ground, so a leaned tyre touches down on its shoulder.
- **Suspension:** each wheel is an unsprung mass (15 kg front, 19 kg rear) on its own axis:
  the raked fork axis in front, the swingarm arc tangent at the rear. It sits between a
  progressive spring with preload, two-stage (digressive) compression and rebound damping,
  a bump stop, and a tyre carcass spring below. Static sag is about 70 mm front and 105 mm
  rear with the rider on board. Fork dive, squat, bottoming, wheel hop and packing all
  come out of this.
- **Tyres:** longitudinal and lateral slip go through relaxation lengths (stable at
  standstill, with realistic lag), are normalised by the surface's peak slip, and are
  combined in one Pacejka shape. Spinning or locking a wheel uses up cornering grip. Past
  the peak the force falls (a locked front tucks). Camber gives lateral thrust from lean.
  Load comes from the suspension, so weight transfer changes grip.
- **Drivetrain:** a torque curve per bike, part-throttle map, pumping and friction losses
  (engine braking), a rev limiter that cuts ignition, idle control and stalling. A friction
  clutch that locks or slips against its capacity, 5-speed box, primary and final drive,
  torque cut on shifts. Auto-clutch fans out when engine braking locks the rear. The
  auto-gearbox shift points follow throttle.
- **Brakes:** torque on the wheels that can stop but not reverse them. The rear brake also
  has to stop the engine when the clutch is engaged.
- **Spinning parts:** wheel and crank speed-ups push the chassis the other way, so gas in
  the air lifts the front and rear brake drops it. There is gyroscopic torque from the
  wheels and crank, and from turning the bars on a spinning front wheel.
- **Rider:** a separate 75 kg mass held to the bike by spring-dampers (stiff seated, softer
  standing), plus a torso with its own inertia and muscle torques. The bike feels the rider
  only through those reactions: moving forward loads the front, standing raises the
  combined centre of mass, and throwing the torso in the air rotates the bike the other
  way. A big enough separation throws the rider off.
- **Virtual rider (steering assist):** turns a lean request into bar angle (counter-steer,
  hold, stand it up). It limits lean to what grip and berm banking allow, and backs off
  when the front tyre is past its peak. Gains were tuned with a headless step-response
  sweep (`Tests/Tune.cs`): about 0.6 s to 90 % lean with ≤ 3 % overshoot at 6, 12 and
  20 m/s.
- **Foot assist:** at walking pace the rider dabs a foot. That is a fading roll torque
  below 4.5 m/s, or 1.6 m/s with balance assist off.

## Test results (this commit)

All 64 handling checks pass for both bikes (`dotnet run -c Release --project Tests`):

| | 450F | 250F |
|---|---|---|
| Static sag front / rear | 71 / 104 mm | 69 / 104 mm |
| Weight on front | 46 % | 46 % |
| 0–60 / 0–100 km/h (standing, weight forward) | 2.2 / 3.9 s | 2.5 / 4.5 s |
| Speed after 14 s | 145 km/h | 133 km/h |
| 72 km/h to stop | 31.6 m | 30.7 m |
| Steady turn, lean requested vs reached | 31.7° / 31.7° | 31.7° / 31.7° |
| Turn radius vs v²/(g·tan lean) | 30.5 / 30.9 m | 29.6 / 30.1 m |
| Tabletop (2.2 m): air time, travel used | 0.60 s, 81 % | 0.54 s, 77 % |
| Full lap of the generated track (AI pilot) | 1:30 | 1:33 |

Known weak spots, measured and not hidden:
- The scripted **AI pilot crashes 13–16 times per lap**. It is a test driver: it misjudges
  jump speed from short run-ups and comes off the double and the tabletop landing. Crash
  counts are reported, not used as pass/fail. Making it a real AI rider is Stage 5 work.
- Off the tabletop the bike tends to land **nose-low (about −35°) on a ~15° landing**. The
  physics behind this is plausible (the rear kicks at the lip), but jump faces and in-air
  control need tuning on a real device with real thumbs.
- Not tested yet in Unity itself. Unity cannot be downloaded in the environment this was
  built in. The scripts compile against Unity reference assemblies, but nothing has been
  played in the editor or on a phone yet. Expect a first round of fixes when it is opened.

## What is real and what is placeholder

| Real, working | Placeholder (clearly temporary) |
|---|---|
| Bike, tyre, suspension, drivetrain, brake and rider physics | Bike model: procedural meshes. Moving parts are driven by the sim |
| 450F vs 250F: mass, torque curve, revs, gearing, engine braking, inertia | Rider: procedural mannequin with two-bone IK to bars and pegs, no cloth |
| Generated track: jumps, rollers, whoops, step-up, berms, braking bumps, 4 surfaces | Track art: procedural textures, primitive stakes, trees, gate, light towers, hills |
| Touch, keyboard and gamepad controls; six independent assists | Crash: the rider becomes a tumbling capsule (ragdoll is Stage 2) |
| HUD, telemetry, lap timer, pause and settings, quality presets | Engine audio: synthesised in code, no recordings yet |
| CI: physics tests, compile check, Android build when a license exists | |

No professional rider or bike models are included. They have to be obtained under a
proper license (Unity Asset Store, Fab, CGTrader, or Sketchfab with a license allowing use
in a game) or commissioned. `BikeVisual` and `RiderVisual` are the integration points:
they read only simulation state (hub positions, steer angle, spin angles, rider mass
position, torso angles, standing).

## Roadmap

1. **Stage 1, done:** core bike physics, track, controls, camera, HUD, build pipeline.
2. **Stage 2, rider:** articulated ragdoll for crashes (ConfigurableJoints) instead of the
   capsule; get back on the bike; whip and scrub techniques at the lip using the torso
   DOFs that already exist; rider leg dab and foot-out in flat turns.
3. **Stage 3, handling:** tune on device; anti-squat from chain pull; tyre data per
   surface; rut-following; clutch-up starts from the gate.
4. **Stage 4, visuals:** licensed bike and rider models with LODs; hybrid cloth (spring
   bones on jersey and pants, selective vertex simulation on loose fabric); ruts and
   terrain deformation decals; mud build-up on bike and rider; URP lighting and post FX
   tuned for mobile.
5. **Stage 5, game:** Time Attack and Race (gate drop, laps, checkered flag), AI riders
   grown from `TrackPilot`, garage, customization, more tracks.
6. **Stage 6, mobile:** profile CPU, GPU, memory and physics on target phones; quality
   presets; recorded multi-layer engine audio for 250F and 450F.
7. **Stage 7:** release builds and store packaging.
