using System;
using System.Numerics;
using RoostMX.Sim;
using RoostMX.Sim.Track;

namespace RoostMX.Tests
{
    /// <summary>
    /// A rigid body integrated like PhysX integrates a Unity Rigidbody: forces accumulated
    /// during the tick, then semi-implicit Euler on linear and angular velocity, inertia
    /// tensor rotated into world space. Also a crude penalty contact for the frame box so a
    /// crash in the test looks like a crash rather than falling through the world.
    /// </summary>
    public sealed class TestBody : ISimBody
    {
        public Vector3 Position { get; set; }
        public Quaternion Rotation { get; set; } = Quaternion.Identity;
        public Vector3 Velocity { get; set; }
        public Vector3 AngularVelocity { get; set; }
        public float Mass { get; }
        public Vector3 Inertia;
        Vector3 force, torque;
        public bool FrameTouched;
        public Func<float, float, float> GroundHeight;
        public Vector3 BoxCenter, BoxHalf;

        public TestBody(float mass, Vector3 inertia) { Mass = mass; Inertia = inertia; }

        public void AddForceAtPosition(Vector3 f, Vector3 p)
        {
            force += f;
            torque += Vector3.Cross(p - Position, f);
        }
        public void AddForce(Vector3 f) => force += f;
        public void AddTorque(Vector3 t) => torque += t;

        public void Integrate(float dt)
        {
            // frame contact (penalty springs at the box corners)
            FrameTouched = false;
            if (GroundHeight != null)
            {
                for (int i = 0; i < 8; i++)
                {
                    var c = new Vector3((i & 1) == 0 ? -1 : 1, (i & 2) == 0 ? -1 : 1, (i & 4) == 0 ? -1 : 1) * BoxHalf + BoxCenter;
                    Vector3 p = Position + Vector3.Transform(c, Rotation);
                    float pen = GroundHeight(p.X, p.Z) - p.Y;
                    if (pen > 0)
                    {
                        FrameTouched = true;
                        Vector3 v = Velocity + Vector3.Cross(AngularVelocity, p - Position);
                        Vector3 f = new Vector3(-v.X * 400f, pen * 60000f - Math.Min(0, v.Y) * 3000f, -v.Z * 400f);
                        AddForceAtPosition(f, p);
                    }
                }
            }

            Velocity += (force / Mass + new Vector3(0, -SimMath.G, 0)) * dt;
            // world inverse inertia: R * I^-1 * R^T
            Vector3 tl = Vector3.Transform(torque, Quaternion.Inverse(Rotation));
            Vector3 wl = Vector3.Transform(AngularVelocity, Quaternion.Inverse(Rotation));
            Vector3 dwl = tl / Inertia;
            wl += dwl * dt;
            AngularVelocity = Vector3.Transform(wl, Rotation);
            Position += Velocity * dt;
            float w = AngularVelocity.Length();
            if (w > 1e-6f)
            {
                var dq = Quaternion.CreateFromAxisAngle(AngularVelocity / w, w * dt);
                Rotation = Quaternion.Normalize(dq * Rotation);
            }
            force = Vector3.Zero; torque = Vector3.Zero;
        }
    }

    /// <summary>Sphere cast against a height function by marching and bisection.</summary>
    public sealed class HeightfieldGround : IGroundProbe
    {
        readonly Func<float, float, float> height;
        readonly Func<float, float, Vector3> normal;
        readonly Func<float, float, SurfaceType> surface;

        public HeightfieldGround(Func<float, float, float> h, Func<float, float, Vector3> n, Func<float, float, SurfaceType> s)
        { height = h; normal = n; surface = s; }

        public static HeightfieldGround Flat(SurfaceType s = SurfaceType.Hardpack) =>
            new HeightfieldGround((x, z) => 0f, (x, z) => Vector3.UnitY, (x, z) => s);

        public static HeightfieldGround FromTrack(TrackLayout t) =>
            new HeightfieldGround(t.HeightAt, t.NormalAt, t.SurfaceAt);

        public float Height(float x, float z) => height(x, z);
        public static int StartInside, Misses;

        float Gap(Vector3 c, float r)
        {
            Vector3 n = normal(c.X, c.Z);
            return (c.Y - height(c.X, c.Z)) * n.Y - r;
        }

        public bool SphereCast(Vector3 origin, float radius, Vector3 dir, float maxDistance, out GroundHit hit)
        {
            hit = default;
            const float step = 0.02f;
            if (Gap(origin, radius) <= 0f) { StartInside++; return false; }   // starts inside: like PhysX, no hit
            float prev = 0f;
            for (float t = step; t <= maxDistance + step; t += step)
            {
                float tt = Math.Min(t, maxDistance);
                if (Gap(origin + dir * tt, radius) <= 0f)
                {
                    float lo = prev, hi = tt;
                    for (int k = 0; k < 12; k++)
                    {
                        float mid = 0.5f * (lo + hi);
                        if (Gap(origin + dir * mid, radius) <= 0f) hi = mid; else lo = mid;
                    }
                    Vector3 c = origin + dir * hi;
                    Vector3 n = normal(c.X, c.Z);
                    hit.Distance = hi;
                    hit.Normal = n;
                    hit.Point = c - n * radius;
                    hit.Surface = surface(c.X, c.Z);
                    return true;
                }
                prev = tt;
                if (tt >= maxDistance) break;
            }
            Misses++;
            return false;
        }
    }

    /// <summary>A bike placed in a test world.</summary>
    public sealed class TestRig
    {
        public readonly BikeSim Sim;
        public readonly TestBody Body;
        public readonly HeightfieldGround Ground;
        public float Time;
        public const float Dt = 1f / 200f;

        public TestRig(BikeSpec spec, HeightfieldGround ground, Vector3 groundPos, Vector3 forward, float speed = 0f)
        {
            Sim = new BikeSim(spec);
            Ground = ground;
            Body = new TestBody(spec.SprungMass, spec.Inertia)
            {
                GroundHeight = ground.Height,
                BoxCenter = spec.ChassisColliderCenter,
                BoxHalf = spec.ChassisColliderSize * 0.5f,
            };
            forward = Vector3.Normalize(new Vector3(forward.X, 0, forward.Z));
            float yaw = (float)Math.Atan2(forward.X, forward.Z);
            Body.Rotation = Quaternion.CreateFromAxisAngle(Vector3.UnitY, yaw);
            // CoM height at sag: rear axle sits Radius above ground
            float comHeight = spec.Rear.Radius - spec.RearAxleAtSag.Y;
            Body.Position = groundPos + new Vector3(0, comHeight + 0.01f, 0);
            Body.Velocity = forward * speed;
            Sim.Reset(Body);
            Sim.Front.Omega = speed / spec.Front.Radius;
            Sim.Rear.Omega = speed / spec.Rear.Radius;
            if (speed > 3f)
            {
                // pick a gear that suits the speed
                for (int g = spec.GearCount; g >= 1; g--)
                {
                    float rpm = Sim.Rear.Omega * spec.GearTotal(g) / EngineSystem.RpmToRad;
                    if (rpm > spec.Engine.RevLimit * 0.55f || g == 1) { Sim.Gearbox.Gear = g; Sim.Engine.Omega = Math.Max(rpm, spec.Engine.IdleRpm) * EngineSystem.RpmToRad; break; }
                }
            }
        }

        public void Step(BikeInput input)
        {
            Sim.Step(Body, Ground, input, Dt);
            Body.Integrate(Dt);
            Time += Dt;
        }

        public float SpeedKmh => Sim.Speed * 3.6f;
    }
}
