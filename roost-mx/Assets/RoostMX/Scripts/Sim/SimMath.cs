// Roost MX physics core. Engine-independent: uses System.Numerics so the same code runs
// inside Unity and in the headless .NET test harness (roost-mx/Tests).
// Axes follow Unity: +X right, +Y up, +Z forward.
using System;
using System.Numerics;

namespace RoostMX.Sim
{
    public static class SimMath
    {
        public const float Deg2Rad = (float)(Math.PI / 180.0);
        public const float Rad2Deg = (float)(180.0 / Math.PI);
        public const float G = 9.81f;
        public static readonly Vector3 Up = Vector3.UnitY;

        public static float Clamp(float v, float lo, float hi) => v < lo ? lo : (v > hi ? hi : v);
        public static float Clamp01(float v) => Clamp(v, 0f, 1f);
        public static float Lerp(float a, float b, float t) => a + (b - a) * Clamp01(t);
        public static float InverseLerp(float a, float b, float v) => Math.Abs(b - a) < 1e-9f ? 0f : Clamp01((v - a) / (b - a));
        public static float SmoothStep(float a, float b, float v) { float t = InverseLerp(a, b, v); return t * t * (3f - 2f * t); }
        public static float MoveTowards(float cur, float target, float maxDelta)
        {
            if (Math.Abs(target - cur) <= maxDelta) return target;
            return cur + Math.Sign(target - cur) * maxDelta;
        }
        public static float Sign(float v) => v > 0 ? 1f : (v < 0 ? -1f : 0f);
        public static float Sqr(float v) => v * v;

        public static Vector3 Rotate(Quaternion q, Vector3 v) => Vector3.Transform(v, q);

        public static Vector3 SafeNormalize(Vector3 v, Vector3 fallback)
        {
            float l = v.Length();
            return l > 1e-6f ? v / l : fallback;
        }

        public static Vector3 ProjectOnPlane(Vector3 v, Vector3 n) => v - n * Vector3.Dot(v, n);

        public static Quaternion AngleAxis(float radians, Vector3 axis) =>
            Quaternion.CreateFromAxisAngle(Vector3.Normalize(axis), radians);

        /// <summary>Exponential approach factor for a first-order lag with time constant tau.</summary>
        public static float LagFactor(float dt, float tau) => tau <= 1e-6f ? 1f : 1f - (float)Math.Exp(-dt / tau);

        /// <summary>Piecewise-linear lookup in (x, y) pairs sorted by x.</summary>
        public static float Curve(float[] xs, float[] ys, float x)
        {
            if (x <= xs[0]) return ys[0];
            int n = xs.Length;
            if (x >= xs[n - 1]) return ys[n - 1];
            for (int i = 1; i < n; i++)
            {
                if (x <= xs[i])
                {
                    float t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
                    return ys[i - 1] + (ys[i] - ys[i - 1]) * t;
                }
            }
            return ys[n - 1];
        }
    }
}
