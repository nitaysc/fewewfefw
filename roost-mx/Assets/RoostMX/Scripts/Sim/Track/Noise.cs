using System;

namespace RoostMX.Sim.Track
{
    /// <summary>Deterministic value noise (same result in Unity and in tests).</summary>
    public static class Noise
    {
        static float Hash(int x, int y, int seed)
        {
            unchecked
            {
                uint h = (uint)(x * 374761393 + y * 668265263 + seed * 1442695041);
                h = (h ^ (h >> 13)) * 1274126177u;
                h ^= h >> 16;
                return (h & 0xFFFFFF) / (float)0xFFFFFF;
            }
        }

        public static float Value(float x, float y, int seed)
        {
            int xi = (int)Math.Floor(x), yi = (int)Math.Floor(y);
            float fx = x - xi, fy = y - yi;
            float u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
            float a = Hash(xi, yi, seed), b = Hash(xi + 1, yi, seed);
            float c = Hash(xi, yi + 1, seed), d = Hash(xi + 1, yi + 1, seed);
            return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
        }

        public static float Fbm(float x, float y, int octaves, int seed)
        {
            float sum = 0, amp = 0.5f, freq = 1f, norm = 0;
            for (int i = 0; i < octaves; i++)
            {
                sum += amp * (Value(x * freq, y * freq, seed + i * 17) * 2f - 1f);
                norm += amp; amp *= 0.5f; freq *= 2.03f;
            }
            return sum / norm;
        }
    }
}
