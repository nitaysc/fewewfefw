using RoostMX.Sim.Track;
using UnityEngine;

namespace RoostMX.Game
{
    /// <summary>
    /// Stage 1 surface textures generated at startup (albedo + normal map), so the project
    /// needs no imported art. Stage 4 replaces these with scanned/authored PBR sets.
    /// </summary>
    public static class ProceduralTextures
    {
        public struct Set { public Texture2D Albedo, Normal; }

        static Set? dirt, loose, sand, grass;

        public static Set Dirt => dirt ??= Make(512, 11, new Color(0.47f, 0.36f, 0.27f), new Color(0.30f, 0.22f, 0.16f), 1.0f, ripples: true, pebbles: 0.05f);
        public static Set Loose => loose ??= Make(256, 23, new Color(0.56f, 0.44f, 0.33f), new Color(0.36f, 0.27f, 0.20f), 1.3f, ripples: false, pebbles: 0.12f);
        public static Set Sand => sand ??= Make(256, 37, new Color(0.80f, 0.70f, 0.52f), new Color(0.62f, 0.52f, 0.37f), 0.6f, ripples: true, pebbles: 0.01f);
        public static Set Grass => grass ??= MakeGrass(256, 41);

        static float Fbm(float x, float y, int oct, int seed) => Noise.Fbm(x, y, oct, seed) * 0.5f + 0.5f;

        static Set Make(int size, int seed, Color light, Color dark, float bumpiness, bool ripples, float pebbles)
        {
            var h = new float[size * size];
            var alb = new Color[size * size];
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float u = x / (float)size, v = y / (float)size;
                // tileable-ish: sample a torus-wrapped domain
                float a = u * 6.2831853f, b = v * 6.2831853f;
                float nx = Mathf.Cos(a) * 1.6f, ny = Mathf.Sin(a) * 1.6f, nz = Mathf.Cos(b) * 1.6f + Mathf.Sin(b) * 0.7f;
                float n = Fbm(nx + nz * 3.1f, ny + nz * 1.7f + seed, 5, seed);
                float clods = Mathf.Pow(Fbm(nx * 4f + 7, ny * 4f + nz * 2f, 3, seed + 3), 3f);
                float height = n * 0.6f + clods * 0.8f;
                if (ripples)
                {
                    // tyre-dragged ripples running across the texture's v axis
                    float r = Mathf.Sin(v * 6.2831853f * 9f + n * 4f) * 0.5f + 0.5f;
                    height += r * r * 0.35f;
                }
                float peb = Fbm(nx * 11f, ny * 11f + nz * 5f, 2, seed + 9);
                bool isPebble = peb > 1f - pebbles;
                if (isPebble) height += 0.5f;
                h[y * size + x] = height;
                float t = Mathf.Clamp01(height * 0.8f);
                Color c = Color.Lerp(dark, light, t);
                if (isPebble) c = Color.Lerp(c, new Color(0.66f, 0.62f, 0.56f), 0.6f);
                c *= 0.9f + 0.2f * Fbm(nx * 20f, ny * 20f, 1, seed + 13);
                c.a = 1f;
                alb[y * size + x] = c;
            }
            return new Set { Albedo = ToTex(alb, size, false), Normal = NormalFromHeight(h, size, bumpiness * 4f) };
        }

        static Set MakeGrass(int size, int seed)
        {
            var h = new float[size * size];
            var alb = new Color[size * size];
            var dark = new Color(0.20f, 0.28f, 0.12f);
            var light = new Color(0.42f, 0.48f, 0.22f);
            var dry = new Color(0.55f, 0.50f, 0.32f);
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float u = x / (float)size * 6.2831853f, v = y / (float)size * 6.2831853f;
                float nx = Mathf.Cos(u) * 2f, ny = Mathf.Sin(u) * 2f, nz = Mathf.Cos(v) * 2f + Mathf.Sin(v);
                float n = Fbm(nx + nz * 2f, ny + nz, 4, seed);
                float blades = Fbm(nx * 18f + nz * 9f, ny * 18f, 2, seed + 5);
                float height = n * 0.4f + blades * 0.8f;
                h[y * size + x] = height;
                Color c = Color.Lerp(dark, light, blades);
                c = Color.Lerp(c, dry, Mathf.SmoothStep(0.55f, 0.8f, n) * 0.6f);
                c.a = 1f;
                alb[y * size + x] = c;
            }
            return new Set { Albedo = ToTex(alb, size, false), Normal = NormalFromHeight(h, size, 2f) };
        }

        static Texture2D ToTex(Color[] px, int size, bool linear)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, true, linear) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear, anisoLevel = 4 };
            t.SetPixels(px);
            t.Apply(true, true);
            return t;
        }

        /// <summary>Normal map from a height field. R=x, G=y, B=z, A=1 decodes correctly with both the RGB and DXT5nm unpackers.</summary>
        static Texture2D NormalFromHeight(float[] h, int size, float strength)
        {
            var px = new Color[size * size];
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float l = h[y * size + (x - 1 + size) % size], r = h[y * size + (x + 1) % size];
                float d = h[((y - 1 + size) % size) * size + x], u = h[((y + 1) % size) * size + x];
                var n = new Vector3((l - r) * strength, (d - u) * strength, 1f).normalized;
                px[y * size + x] = new Color(n.x * 0.5f + 0.5f, n.y * 0.5f + 0.5f, n.z * 0.5f + 0.5f, 1f);
            }
            return ToTex(px, size, true);
        }

        /// <summary>Vertical sky gradient for the dusk look (used when no skybox shader is available).</summary>
        public static Texture2D Gradient(Color top, Color mid, Color bottom, int height = 128)
        {
            var t = new Texture2D(1, height, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int i = 0; i < height; i++)
            {
                float k = i / (float)(height - 1);
                t.SetPixel(0, i, k < 0.5f ? Color.Lerp(bottom, mid, k * 2f) : Color.Lerp(mid, top, (k - 0.5f) * 2f));
            }
            t.Apply();
            return t;
        }
    }
}
