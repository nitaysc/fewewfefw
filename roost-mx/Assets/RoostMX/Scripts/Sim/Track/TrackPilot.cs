using System;
using System.Numerics;

namespace RoostMX.Sim.Track
{
    /// <summary>
    /// A rider "brain" that produces the same BikeInput a player does (it never touches the
    /// physics directly). Used by the headless tests to ride full laps, and the starting
    /// point for AI riders later. Pure pursuit for the line, a curvature/braking-distance
    /// speed profile, standing over rough sections, and pitch control in the air with the
    /// rider's body and the rear wheel.
    /// </summary>
    public sealed class TrackPilot
    {
        readonly TrackLayout track;
        public int Sample = -1;
        public float Aggression = 0.85f;     // fraction of the grip it is willing to use
        public float TopSpeed = 24f;
        public float TargetSpeed;
        public float Progress;               // metres travelled along the track (unwrapped)
        int lastSample;
        float steerSmooth, throttle;

        public TrackPilot(TrackLayout t) { track = t; }

        /// <summary>Call after the bike is moved (respawn): re-find our place on the track.</summary>
        public void Relocate() { Sample = -1; throttle = 0f; steerSmooth = 0f; }

        public BikeInput Drive(BikeSim sim, ISimBody body)
        {
            var input = new BikeInput();
            Vector3 pos = body.Position;
            int m = track.Points.Length;
            if (Sample < 0) { Sample = track.NearestSample(pos); lastSample = Sample; }
            else
            {
                int best = Sample; float bd = float.MaxValue;
                for (int k = -10; k <= 40; k++)
                {
                    int i = (Sample + k + m) % m;
                    float dx = track.Points[i].X - pos.X, dz = track.Points[i].Z - pos.Z;
                    float d = dx * dx + dz * dz;
                    if (d < bd) { bd = d; best = i; }
                }
                Sample = best;
            }
            int adv = (Sample - lastSample + m) % m;
            if (adv < m / 2) Progress += adv * track.Length / m;
            lastSample = Sample;

            float v = Math.Max(sim.Speed, 0f);
            Vector3 fwd = SimMath.Rotate(body.Rotation, Vector3.UnitZ);
            Vector3 heading = Vector3.Normalize(new Vector3(fwd.X, 0, fwd.Z));

            // --- line: pure pursuit ---
            // look about a second ahead: the bike needs ~0.6 s to change lean
            float ld = SimMath.Clamp(7f + 1.0f * v, 9f, 34f);
            int ahead = (Sample + (int)(ld / (track.Length / m))) % m;
            Vector3 tgt = track.Points[ahead];
            Vector3 to = new Vector3(tgt.X - pos.X, 0, tgt.Z - pos.Z);
            float dist = Math.Max(1f, to.Length());
            to /= dist;
            float sinErr = heading.Z * to.X - heading.X * to.Z;   // + = target is to the right
            float curvature = 2f * sinErr / dist;
            float wantLean = (float)Math.Atan(v * v * curvature / SimMath.G);
            float maxLean = SimMath.Lerp(14f, 52f, SimMath.SmoothStep(1.5f, 10f, v)) * SimMath.Deg2Rad;
            // damp against our own lateral drift so the line doesn't oscillate
            Vector3 c = track.Points[Sample];
            Vector3 tg = track.Tangents[Sample];
            float lateral = (pos.X - c.X) * tg.Z - (pos.Z - c.Z) * tg.X;          // + right of the line
            float latVel = body.Velocity.X * tg.Z - body.Velocity.Z * tg.X;
            wantLean -= SimMath.Clamp(latVel * 0.03f + lateral * 0.004f, -0.15f, 0.15f);
            float steerCmd = SimMath.Clamp(wantLean / maxLean, -0.85f, 0.85f);
            steerSmooth += (steerCmd - steerSmooth) * SimMath.LagFactor(1f / 200f, 0.08f);
            input.Steer = steerSmooth;

            // --- speed: limited by curvature ahead and the distance needed to brake for it ---
            float target = TopSpeed;
            float brakeDecel = 5.5f * Aggression;
            for (int k = 0; k < 90; k += 2)
            {
                int i = (Sample + k) % m;
                float kap = Math.Abs(track.Curv[i]);
                float bankHelp = 1f + track.Bank[i] * 0.25f;
                float vc = (float)Math.Sqrt(Aggression * 0.78f * bankHelp * SimMath.G / Math.Max(kap, 1e-3f));
                float d = k * track.Length / m;
                float allowed = (float)Math.Sqrt(vc * vc + 2f * brakeDecel * d);
                if (allowed < target) target = allowed;
            }
            // whoops and jumps: carry a sensible speed
            float sHere = track.Dist[Sample];
            foreach (var f in track.Features)
            {
                float rel = f.S - sHere;
                if (rel < -f.Length || rel > 40f) continue;
                float want = f.Kind == FeatureKind.Whoops ? 13f
                           : f.Kind == FeatureKind.BrakingBumps ? 99f
                           : f.Kind == FeatureKind.Roller ? RollerSpeed(f)
                           : JumpSpeed(f);
                if (rel > 0f) want = (float)Math.Sqrt(want * want + 2f * brakeDecel * rel);
                else if (f.Kind != FeatureKind.Whoops && f.Kind != FeatureKind.BrakingBumps) want = 99f; // committed: no brakes on the face
                if (want < target) target = want;
            }
            TargetSpeed = target;
            float err = target - v;
            float thrWant = 0f, brakeWant = 0f;
            if (err > 0f) thrWant = SimMath.Clamp01(0.35f + err * 0.35f);
            else brakeWant = SimMath.Clamp01(-err * 0.25f);
            // feel: roll on progressively, back off when the rear spins up
            thrWant *= SimMath.Clamp01(1f - (sim.Rear.SlipRatio - 0.2f) * 2.5f);
            throttle = thrWant > throttle ? SimMath.MoveTowards(throttle, thrWant, 2.5f / 200f) : thrWant;
            input.Throttle = throttle;
            input.FrontBrake = brakeWant;
            input.RearBrake = sim.Rear.SlipRatio < -0.2f ? 0f : brakeWant * 0.6f;

            // --- body ---
            bool rough = false;
            foreach (var f in track.Features) { float rel = sHere - f.S; if (rel > -12f && rel < f.Length + 3f) rough = true; }
            input.Stand = rough || v > 9f;
            if (!sim.Airborne)
            {
                // drive out of turns with the weight forward; roll off if the front still climbs
                if (sim.WheelieAmount > 0.05f) { input.RiderForeAft = 1f; input.Throttle *= 0.5f; }
                else input.RiderForeAft = input.Throttle > 0.3f ? 0.8f : (input.FrontBrake > 0.3f ? -0.4f : 0.2f);
            }
            else
            {
                // match the bike's pitch to the ground where it will land (a touch front-high)
                float groundPitch = LandingPitch(body, heading) + 0.04f;
                float pitchRate = -Vector3.Dot(body.AngularVelocity, Vector3.Cross(SimMath.Up, heading));
                float pitchErr = sim.Pitch - groundPitch + pitchRate * 0.25f;
                AirPitchControl(pitchErr, ref input);
                input.Stand = true;
                // straighten up for the landing: the torso is the lever (bike counter-rotates)
                float rollRate = -Vector3.Dot(body.AngularVelocity, heading);
                input.RiderLean = SimMath.Clamp((sim.Lean + rollRate * 0.3f) * 3f, -1f, 1f);
                input.FrontBrake = 0f;
                input.Steer = 0f;
            }
            return input;
        }

        /// <summary>
        /// Takeoff speed that lands the bike on the upper part of the landing ramp: ballistic
        /// flight from the lip (angle of the face at its top) to a point 30% down the landing.
        /// </summary>
        public static float JumpSpeed(TrackFeature f)
        {
            if (f.Kind == FeatureKind.Roller || f.Kind == FeatureKind.Whoops || f.Kind == FeatureKind.BrakingBumps) return 99f;
            float e = 0.05f;
            float lipSlope = (f.Profile(f.Face - e) - f.Profile(f.Face - 3 * e)) / (2 * e);
            float a = (float)Math.Atan(lipSlope);
            float lip = f.Profile(f.Face - e);
            float xLand = f.Kind == FeatureKind.Tabletop ? f.Face + f.Top + f.Land * 0.3f
                        : f.Kind == FeatureKind.Double ? f.Face + f.Top + TrackFeature.BackSide + f.Land * 0.3f
                        : f.Face + f.Top + f.Land * 0.25f;
            float dx = xLand - f.Face;
            float dy = f.Profile(xLand) - lip;                      // negative = lands lower
            float cos = (float)Math.Cos(a), tan = (float)Math.Tan(a);
            float denom = 2f * cos * cos * (dx * tan - dy);
            if (denom <= 0.01f) return 99f;
            float v = (float)Math.Sqrt(SimMath.G * dx * dx / denom);
            // the bike's CoM leaves ~0.9 m above the lip and the rear shock kicks a little
            return v * 0.95f;
        }

        /// <summary>
        /// Shared in-air pitch technique: body first, then gas to lift the front or a light,
        /// proportional dab of rear brake to drop it. pitchErr already includes rate damping.
        /// </summary>
        public static void AirPitchControl(float pitchErr, ref BikeInput input)
        {
            input.RiderForeAft = SimMath.Clamp(pitchErr * 4f, -1f, 1f);
            input.Throttle = SimMath.Clamp01(0.25f - pitchErr * 4f);
            input.RearBrake = SimMath.Clamp01((pitchErr - 0.08f) * 2.5f) * 0.5f;
            input.FrontBrake = 0f;
        }

        /// <summary>Speed that keeps the wheels on the ground over a roller crest (v^2 * curvature < g).</summary>
        public static float RollerSpeed(TrackFeature f)
        {
            float crestCurv = f.Height * 0.5f * SimMath.Sqr(2f * (float)Math.PI / f.Wavelength);
            return (float)Math.Sqrt(SimMath.G / Math.Max(crestCurv, 1e-3f)) * 1.15f;
        }

        /// <summary>Ground pitch where a ballistic CoM path meets the ground (for landing setup).</summary>
        float LandingPitch(ISimBody body, Vector3 heading)
        {
            Vector3 p = body.Position, v = body.Velocity;
            for (float t = 0.05f; t < 2.5f; t += 0.05f)
            {
                Vector3 q = p + v * t + new Vector3(0, -0.5f * SimMath.G * t * t, 0);
                if (q.Y - track.HeightAt(q.X, q.Z) < 0.75f)
                {
                    float hA = track.HeightAt(q.X + heading.X, q.Z + heading.Z);
                    float hB = track.HeightAt(q.X - heading.X, q.Z - heading.Z);
                    return (float)Math.Atan((hA - hB) / 2f);
                }
            }
            return 0f;
        }
    }
}
