using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Numerics;
using RoostMX.Sim;
using RoostMX.Sim.Track;

namespace RoostMX.Tests
{
    /// <summary>
    /// Headless ride tests. Every scenario drives the real BikeSim with BikeInput only, and
    /// checks physical outcomes (sag, acceleration, braking distance, lean tracking, jump
    /// landing, full laps). Exit code 1 if any check fails.
    ///   dotnet run -c Release              all scenarios
    ///   dotnet run -c Release -- lap       only the named scenario(s)
    ///   ROOST_CSV=1 dotnet run ...         also write telemetry CSVs to ./out
    /// </summary>
    public static class Program
    {
        static int failures;
        static readonly List<string> report = new List<string>();
        static bool csv = Environment.GetEnvironmentVariable("ROOST_CSV") == "1";

        /// <summary>Reported but never fails the run (tracked numbers, e.g. the AI pilot's crashes).</summary>
        static void Info(string what, string detail)
        {
            string line = $"  [INFO] {what}: {detail}";
            Console.WriteLine(line);
            report.Add(line);
        }

        static void Check(string what, bool ok, string detail)
        {
            string line = $"  [{(ok ? "PASS" : "FAIL")}] {what}: {detail}";
            Console.WriteLine(line);
            report.Add(line);
            if (!ok) failures++;
        }

        public static int Main(string[] args)
        {
            var only = new HashSet<string>(args);
            bool Run(string name) => only.Count == 0 || only.Contains(name);
            var sw = Stopwatch.StartNew();
            foreach (var spec in new[] { BikeSpec.Create450F(), BikeSpec.Create250F() })
            {
                Console.WriteLine($"=== {spec.Name} ===");
                if (Run("settle")) Settle(spec);
                if (Run("accel")) Accelerate(spec);
                if (Run("brake")) Brake(spec);
                if (Run("turn")) SteadyTurn(spec);
                if (Run("slalom")) Slalom(spec);
                if (Run("surfaces")) Surfaces(spec);
                if (Run("air")) AirControl(spec);
                if (Run("jump")) Jump(spec);
            }
            if (Run("lap")) Laps();
            if (only.Contains("tune")) Tune.Run();
            if (only.Contains("map")) MapDump.Run();
            Console.WriteLine($"\n{(failures == 0 ? "ALL PASSED" : failures + " FAILED")} in {sw.Elapsed.TotalSeconds:F1}s");
            return failures == 0 ? 0 : 1;
        }

        static TestRig Flat(BikeSpec spec, float speed = 0f, SurfaceType s = SurfaceType.Hardpack) =>
            new TestRig(spec, HeightfieldGround.Flat(s), Vector3.Zero, Vector3.UnitZ, speed);

        static void Settle(BikeSpec spec)
        {
            var r = Flat(spec);
            for (int i = 0; i < 600; i++) r.Step(new BikeInput());
            var s = r.Sim;
            float totalLoad = s.Front.Load + s.Rear.Load;
            float weight = (spec.Mass + spec.Rider.Mass) * SimMath.G;
            Check("settle: static load = weight", Math.Abs(totalLoad - weight) < weight * 0.05f, $"{totalLoad:F0} N vs {weight:F0} N");
            Check("settle: front sag", Math.Abs(s.Front.Compression - spec.Front.SagCompression) < 0.03f, $"{s.Front.Compression * 1000:F0} mm (spec {spec.Front.SagCompression * 1000:F0})");
            Check("settle: rear sag", Math.Abs(s.Rear.Compression - spec.Rear.SagCompression) < 0.03f, $"{s.Rear.Compression * 1000:F0} mm (spec {spec.Rear.SagCompression * 1000:F0})");
            float frontPct = s.Front.Load / totalLoad * 100f;
            Check("settle: weight distribution", frontPct > 40f && frontPct < 55f, $"{frontPct:F0}% front");
            Check("settle: upright and still", Math.Abs(s.Lean) < 0.05f && r.Body.Velocity.Length() < 0.05f, $"lean {s.Lean * SimMath.Rad2Deg:F1} deg, v {r.Body.Velocity.Length():F3} m/s");

            // standing raises the combined CoM and keeps loads balanced
            for (int i = 0; i < 300; i++) r.Step(new BikeInput { Stand = true });
            float comSit = spec.Rider.SitCom.Y, comStand = (s.Rider.Position - r.Body.Position).Y;
            Check("settle: standing raises rider", comStand > comSit + 0.1f, $"rider CoM +{comStand:F2} m over bike CoM (sitting +{comSit:F2})");
            float before = s.Front.Load;
            for (int i = 0; i < 300; i++) r.Step(new BikeInput { Stand = true, RiderForeAft = 1f });
            Check("settle: rider forward loads the front", s.Front.Load > before + 120f, $"{before:F0} N -> {s.Front.Load:F0} N");
        }

        static void Accelerate(BikeSpec spec)
        {
            var r = Flat(spec);
            Csv log = csv ? new Csv($"accel_{spec.Name}") : null;
            float t60 = -1, t100 = -1, maxPitch = 0, maxLean = 0;
            int maxGear = 1;
            for (int i = 0; i < 200 * 14; i++)
            {
                // a real launch: weight forward, standing, pinned
                var inp = new BikeInput { Throttle = 1f, RiderForeAft = 1f, Stand = true };
                if (r.Sim.WheelieAmount > 0.25f) inp.Throttle = 0.6f;
                r.Step(inp);
                float kmh = r.SpeedKmh;
                if (t60 < 0 && kmh >= 60) t60 = r.Time;
                if (t100 < 0 && kmh >= 100) t100 = r.Time;
                maxPitch = Math.Max(maxPitch, r.Sim.Pitch);
                maxLean = Math.Max(maxLean, Math.Abs(r.Sim.Lean));
                maxGear = Math.Max(maxGear, r.Sim.Gearbox.Gear);
                log?.Row(r);
            }
            log?.Close();
            Check("accel: 0-60 km/h", t60 > 1.6f && t60 < 4.5f, $"{t60:F2} s");
            Check("accel: 0-100 km/h", t100 > 3.5f && t100 < 9f, $"{t100:F2} s");
            Check("accel: shifts up", maxGear >= 4, $"reached gear {maxGear}");
            Check("accel: top speed plausible", r.SpeedKmh > 115 && r.SpeedKmh < 175, $"{r.SpeedKmh:F0} km/h after 14 s");
            Check("accel: no wheelie loop / stays upright", maxPitch < 0.6f && maxLean < 0.15f && !r.Sim.Crashed, $"max pitch {maxPitch * SimMath.Rad2Deg:F0} deg, max lean {maxLean * SimMath.Rad2Deg:F1} deg");

            // sitting back, full gas in 1st: the front must come up (physics, not script)
            var w = Flat(spec);
            float pitchW = 0;
            for (int i = 0; i < 200 * 2; i++) { w.Step(new BikeInput { Throttle = 1f, RiderForeAft = -1f }); pitchW = Math.Max(pitchW, w.Sim.Pitch); }
            Check("accel: weight back + gas lifts the front", pitchW > 0.08f, $"pitch reached {pitchW * SimMath.Rad2Deg:F0} deg");
        }

        static void Brake(BikeSpec spec)
        {
            var r = Flat(spec, 20f);
            for (int i = 0; i < 100; i++) r.Step(new BikeInput { Throttle = 0.3f });
            Vector3 start = r.Body.Position;
            float v0 = r.Sim.Speed;
            float maxDive = 0;
            int steps = 0;
            Csv log = csv ? new Csv($"brake_{spec.Name}") : null;
            while (r.Sim.Speed > 0.5f && steps < 200 * 10)
            {
                log?.Row(r);
                r.Step(new BikeInput { FrontBrake = 0.75f, RearBrake = 0.6f, RiderForeAft = -0.6f, Stand = true });
                maxDive = Math.Max(maxDive, r.Sim.Front.Compression);
                steps++;
            }
            log?.Close();
            float dist = Vector3.Distance(start, r.Body.Position);
            float decel = v0 * v0 / (2 * dist);
            Check("brake: 72 km/h to stop", decel > 4.5f && decel < 10.5f, $"{dist:F1} m, avg {decel / SimMath.G:F2} g");
            Check("brake: fork dives", maxDive > spec.Front.SagCompression + 0.04f, $"front compression peaked at {maxDive * 1000:F0} mm");
            Check("brake: stays upright", !r.Sim.Crashed && Math.Abs(r.Sim.Lean) < 0.2f, $"lean {r.Sim.Lean * SimMath.Rad2Deg:F1} deg");

            // panic: a locked front on loose dirt must wash/tuck rather than stop straight like a car
            var p = Flat(spec, 14f, SurfaceType.LooseDirt);
            for (int i = 0; i < 100; i++) p.Step(new BikeInput { Throttle = 0.3f, Steer = 0.5f });
            float minRatio = 0;
            for (int i = 0; i < 200; i++) { p.Step(new BikeInput { FrontBrake = 1f, Steer = 0.5f }); minRatio = Math.Min(minRatio, p.Sim.Front.SlipRatio); }
            Check("brake: grabbing the front mid-turn locks it", minRatio < -0.5f, $"front slip ratio reached {minRatio:F2}");
        }

        static void SteadyTurn(BikeSpec spec)
        {
            foreach (float steer in new[] { 0.5f, -0.8f })
            {
                var r = Flat(spec, 13f);
                Csv log = csv ? new Csv($"turn_{spec.Name}_{steer}") : null;
                float speedSum = 0; int n = 0;
                for (int i = 0; i < 200 * 8; i++)
                {
                    float thr = SimMath.Clamp01(0.35f + (13f - r.Sim.Speed) * 0.3f);
                    r.Step(new BikeInput { Throttle = thr, Steer = steer });
                    log?.Row(r);
                    if (r.Time > 5f) { speedSum += r.Sim.Speed; n++; }
                }
                log?.Close();
                float lean = r.Sim.Lean, target = r.Sim.TargetLean;
                Check($"turn {steer:+0.0;-0.0}: lean tracks request", Math.Abs(lean - target) < 0.09f && !r.Sim.Crashed,
                    $"lean {lean * SimMath.Rad2Deg:F1} deg, wanted {target * SimMath.Rad2Deg:F1}");
                float v = speedSum / n;
                float yawRate = Vector3.Dot(r.Body.AngularVelocity, Vector3.UnitY);
                float radius = Math.Abs(v / yawRate);
                float expected = v * v / (SimMath.G * (float)Math.Tan(Math.Abs(lean)));
                Check($"turn {steer:+0.0;-0.0}: radius matches lean physics", Math.Abs(radius - expected) < expected * 0.35f,
                    $"radius {radius:F1} m, v^2/(g tan lean) = {expected:F1} m");
                Check($"turn {steer:+0.0;-0.0}: turns the right way", Math.Sign(yawRate) == Math.Sign(steer), $"yaw rate {yawRate:F2} rad/s");
            }
        }

        static void Slalom(BikeSpec spec)
        {
            var r = Flat(spec, 15f);
            Csv log = csv ? new Csv($"slalom_{spec.Name}") : null;
            float maxLean = 0;
            for (int i = 0; i < 200 * 12; i++)
            {
                float steer = Math.Sin(r.Time * 2.0 * Math.PI / 2.4) > 0 ? 0.8f : -0.8f;
                float thr = SimMath.Clamp01(0.4f + (15f - r.Sim.Speed) * 0.3f);
                log?.Row(r);
                r.Step(new BikeInput { Throttle = thr, Steer = steer, Stand = true });
                maxLean = Math.Max(maxLean, Math.Abs(r.Sim.Lean));
            }
            log?.Close();
            Check("slalom: quick direction changes without falling", !r.Sim.Crashed && maxLean > 0.35f, $"max lean {maxLean * SimMath.Rad2Deg:F0} deg, crashed={r.Sim.Crashed}");
        }

        static void Surfaces(BikeSpec spec)
        {
            // same launch on three surfaces: sand bogs, loose spins more than hardpack
            var results = new Dictionary<SurfaceType, (float v, float slip)>();
            foreach (var s in new[] { SurfaceType.Hardpack, SurfaceType.LooseDirt, SurfaceType.Sand })
            {
                var r = Flat(spec, 0f, s);
                float slipSum = 0;
                for (int i = 0; i < 200 * 3; i++)
                {
                    var inp = new BikeInput { Throttle = 1f, RiderForeAft = 1f, Stand = true };
                    if (r.Sim.WheelieAmount > 0.25f) inp.Throttle = 0.6f;
                    r.Step(inp);
                    slipSum += Math.Abs(r.Sim.Rear.SlipRatio);
                }
                results[s] = (r.Sim.Speed, slipSum / 600f);
            }
            Check("surfaces: hardpack fastest, sand slowest", results[SurfaceType.Hardpack].v > results[SurfaceType.LooseDirt].v && results[SurfaceType.LooseDirt].v > results[SurfaceType.Sand].v,
                $"3 s speeds {results[SurfaceType.Hardpack].v * 3.6f:F0} / {results[SurfaceType.LooseDirt].v * 3.6f:F0} / {results[SurfaceType.Sand].v * 3.6f:F0} km/h");
            Check("surfaces: loose ground spins the rear more", results[SurfaceType.LooseDirt].slip > results[SurfaceType.Hardpack].slip,
                $"mean rear slip {results[SurfaceType.Hardpack].slip:F2} vs {results[SurfaceType.LooseDirt].slip:F2}");
        }

        static void AirControl(BikeSpec spec)
        {
            // Bike launched into the air with no rotation. Gas, brake and body must each pitch it
            // through real reaction torques (no scripted rotation).
            float Pitch(Func<BikeInput> inp)
            {
                var r = Flat(spec, 15f);
                r.Body.Position += new Vector3(0, 20f, 0);
                r.Body.Velocity += new Vector3(0, 6f, 0);
                r.Sim.Rider.Place(r.Body);
                for (int i = 0; i < 200 * 0.6f; i++) r.Step(inp());
                return r.Sim.Pitch;
            }
            float none = Pitch(() => new BikeInput { Throttle = 0.15f });
            float gas = Pitch(() => new BikeInput { Throttle = 1f });
            float brake = Pitch(() => new BikeInput { RearBrake = 1f });
            float lean = Pitch(() => new BikeInput { Throttle = 0.15f, RiderForeAft = -1f, Stand = true });
            Check("air: gas lifts the front", gas > none + 0.03f, $"pitch {none * SimMath.Rad2Deg:F1} -> {gas * SimMath.Rad2Deg:F1} deg");
            Check("air: rear brake drops the front", brake < none - 0.03f, $"pitch {none * SimMath.Rad2Deg:F1} -> {brake * SimMath.Rad2Deg:F1} deg");
            Check("air: rider body pitches the bike", Math.Abs(lean - none) > 0.03f, $"pitch {none * SimMath.Rad2Deg:F1} -> {lean * SimMath.Rad2Deg:F1} deg");
        }

        static void Jump(BikeSpec spec)
        {
            // a tabletop on a flat straight
            var f = new TrackFeature { Kind = FeatureKind.Tabletop, S = 30f, Height = 2.2f, Face = 7f, Top = 10f, Land = 12f };
            var ground = new HeightfieldGround(
                (x, z) => f.Profile(z - f.S),
                (x, z) => { float e = 0.05f; float d = (f.Profile(z + e - f.S) - f.Profile(z - e - f.S)) / (2 * e); return Vector3.Normalize(new Vector3(0, 1, -d)); },
                (x, z) => SurfaceType.Hardpack);
            float vJump = TrackPilot.JumpSpeed(f);
            var r = new TestRig(spec, ground, Vector3.Zero, Vector3.UnitZ, vJump);
            Csv log = csv ? new Csv($"jump_{spec.Name}") : null;
            float air = 0, maxAir = 0, maxComp = 0, landPitch = 0, peakY = 0;
            bool landed = false, tookOff = false;
            for (int i = 0; i < 200 * 7; i++)
            {
                var inp = new BikeInput { Throttle = SimMath.Clamp01(0.4f + (vJump - r.Sim.Speed) * 0.5f), Stand = true };
                if (r.Sim.Airborne)
                {
                    float pitchRate = -r.Body.AngularVelocity.X;
                    float pitchErr = r.Sim.Pitch - (-0.18f) + pitchRate * 0.25f;
                    TrackPilot.AirPitchControl(pitchErr, ref inp);
                }
                r.Step(inp);
                log?.Row(r);
                if (r.Sim.Airborne) { air += TestRig.Dt; peakY = Math.Max(peakY, r.Body.Position.Y); }
                else
                {
                    if (air > 0.3f) { tookOff = true; if (!landed) { landed = true; landPitch = r.Sim.Pitch; } }
                    maxAir = Math.Max(maxAir, air);
                    air = 0;
                }
                if (landed) maxComp = Math.Max(maxComp, Math.Max(r.Sim.Front.Compression, r.Sim.Rear.Compression));
            }
            log?.Close();
            float zEnd = r.Body.Position.Z;
            Check("jump: takes off", tookOff && maxAir > 0.45f, $"airtime {maxAir:F2} s at {vJump * 3.6f:F0} km/h, peak CoM {peakY:F1} m");
            Check("jump: lands and rides away", landed && !r.Sim.Crashed && zEnd > f.S + f.Length + 10f, $"landing pitch {landPitch * SimMath.Rad2Deg:F0} deg, peak compression {maxComp * 1000:F0} mm, crashed={r.Sim.Crashed} ({r.Sim.CrashReason})");
            Check("jump: suspension absorbs the landing", maxComp > 0.15f, $"used {maxComp / spec.Rear.Travel * 100:F0}% of travel");
        }

        static void Laps()
        {
            var track = TrackLayout.CreateDefault();
            var sw = Stopwatch.StartNew();
            track.BuildFields();
            Console.WriteLine($"=== track: {track.Length:F0} m, built in {sw.ElapsedMilliseconds} ms, heights {track.MinHeight:F1}..{track.MaxHeight:F1} m ===");
            var ground = HeightfieldGround.FromTrack(track);
            foreach (var spec in new[] { BikeSpec.Create450F(), BikeSpec.Create250F() })
            {
                track.SpawnPose(0, out var pos, out var fwd);
                var r = new TestRig(spec, ground, pos, fwd);
                var pilot = new TrackPilot(track);
                Csv log = csv ? new Csv($"lap_{spec.Name}") : null;
                int crashes = 0; float maxSpeed = 0, airTotal = 0; int frameHits = 0;
                var crashNotes = new List<string>();
                float lapTime = -1, lastCrashS = -999f; int repeat = 0;
                for (int i = 0; i < 200 * 240 && lapTime < 0; i++)
                {
                    var inp = pilot.Drive(r.Sim, r.Body);
                    r.Step(inp);
                    log?.Row(r, pilot.Progress, pilot.TargetSpeed);
                    maxSpeed = Math.Max(maxSpeed, r.SpeedKmh);
                    if (r.Sim.Airborne) airTotal += TestRig.Dt;
                    if (r.Body.FrameTouched) frameHits++;
                    if (r.Sim.Crashed)
                    {
                        crashes++;
                        crashNotes.Add($"{r.Sim.CrashReason} at s={track.Dist[pilot.Sample]:F0} m, {r.SpeedKmh:F0} km/h");
                        // respawn like the game does; repeat crashes at one spot back up further
                        float sCrash = track.Dist[pilot.Sample];
                        repeat = Math.Abs(sCrash - lastCrashS) < 25f ? repeat + 1 : 0;
                        lastCrashS = sCrash;
                        int back = (int)(repeat * 30f * track.Points.Length / track.Length);
                        track.SpawnPose(pilot.Sample - back, out pos, out fwd);
                        var nr = new TestRig(spec, ground, pos, fwd);
                        nr.Time = r.Time; r = nr;
                        pilot.Relocate();
                    }
                    if (pilot.Progress > track.Length) lapTime = r.Time;
                }
                log?.Close();
                Console.WriteLine($"  probe: {HeightfieldGround.StartInside} casts started inside ground, {HeightfieldGround.Misses} clean misses");
                HeightfieldGround.StartInside = HeightfieldGround.Misses = 0;
                Check($"lap {spec.Name}: completes a lap", lapTime > 0, lapTime > 0 ? $"{(int)(lapTime / 60)}:{lapTime % 60:00.0}, top {maxSpeed:F0} km/h, {airTotal:F1} s airborne" : $"progress {pilot.Progress:F0}/{track.Length:F0} m");
                // The pilot is a scripted test rider, not a perfect one: this bounds regressions.
                Info($"lap {spec.Name}: AI pilot crashes", crashes == 0 ? "clean" : $"{crashes}: " + string.Join("; ", crashNotes.GetRange(0, Math.Min(6, crashNotes.Count))));
                Info($"lap {spec.Name}: frame contact", $"{frameHits * TestRig.Dt:F2} s");
            }
        }

        sealed class Csv
        {
            readonly StreamWriter w;
            public Csv(string name)
            {
                Directory.CreateDirectory("out");
                w = new StreamWriter(Path.Combine("out", name + ".csv"));
                w.WriteLine("t,x,y,z,speed_kmh,lean,target_lean,pitch,steer,gear,rpm,thr,fbrake,rbrake,clutch,f_comp,r_comp,f_load,r_load,f_slip,r_slip,f_alpha,r_alpha,air,rider_dz,rider_dy,progress,target_speed");
            }
            public void Row(TestRig r, float progress = 0, float targetSpeed = 0)
            {
                var s = r.Sim; var p = r.Body.Position;
                Vector3 rl = Vector3.Transform(s.Rider.Position - p, Quaternion.Inverse(r.Body.Rotation));
                w.WriteLine(string.Join(",", new object[] {
                    r.Time, p.X, p.Y, p.Z, r.SpeedKmh, s.Lean * SimMath.Rad2Deg, s.TargetLean * SimMath.Rad2Deg, s.Pitch * SimMath.Rad2Deg,
                    s.Front.SteerAngle * SimMath.Rad2Deg, s.Gearbox.Gear, s.Engine.Rpm, s.ThrottleCmd, s.FrontBrakeCmd, s.RearBrakeCmd, s.Clutch.Engagement,
                    s.Front.Compression, s.Rear.Compression, s.Front.Load, s.Rear.Load, s.Front.SlipRatio, s.Rear.SlipRatio,
                    s.Front.TanSlipAngle, s.Rear.TanSlipAngle, s.Airborne ? 1 : 0, rl.Z, rl.Y, progress, targetSpeed * 3.6f }.ToStrings()));
            }
            public void Close() => w.Dispose();
        }

        static IEnumerable<string> ToStrings(this object[] a)
        {
            foreach (var o in a) yield return o is float f ? f.ToString("0.####", System.Globalization.CultureInfo.InvariantCulture) : o.ToString();
        }
    }
}
