using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace RoostMX.Game
{
    /// <summary>
    /// Creates PBR materials for whichever pipeline is active (URP Lit, falling back to the
    /// built-in Standard shader). The editor setup puts template materials in Resources so the
    /// shaders are always included in player builds.
    /// </summary>
    public static class MaterialLibrary
    {
        static readonly Dictionary<string, Material> cache = new Dictionary<string, Material>();
        static Material litTemplate, unlitTemplate, particleTemplate;

        public static bool Urp => GraphicsSettings.currentRenderPipeline != null;

        static Material Template(ref Material slot, string resource, params string[] shaders)
        {
            if (slot != null) return slot;
            var res = Resources.Load<Material>(resource);
            if (res != null && res.shader != null && res.shader.isSupported) { slot = res; return slot; }
            foreach (var name in shaders)
            {
                var sh = Shader.Find(name);
                if (sh != null && sh.isSupported) { slot = new Material(sh); return slot; }
            }
            slot = new Material(Shader.Find("Hidden/InternalErrorShader"));
            Debug.LogWarning("RoostMX: no lit shader found; run Roost MX > Setup Project in the editor.");
            return slot;
        }

        static Material LitBase() => Urp
            ? Template(ref litTemplate, "RoostMX/Lit", "Universal Render Pipeline/Lit", "Standard")
            : Template(ref litTemplate, "RoostMX/LitBuiltin", "Standard");

        public static Material Unlit() => Urp
            ? Template(ref unlitTemplate, "RoostMX/Unlit", "Universal Render Pipeline/Unlit", "Unlit/Color")
            : Template(ref unlitTemplate, "RoostMX/UnlitBuiltin", "Unlit/Color");

        public static Material Particle() => Urp
            ? Template(ref particleTemplate, "RoostMX/Particle", "Universal Render Pipeline/Particles/Unlit", "Particles/Standard Unlit", "Sprites/Default")
            : Template(ref particleTemplate, "RoostMX/ParticleBuiltin", "Particles/Standard Unlit", "Sprites/Default");

        /// <summary>A shared PBR material. Same arguments return the same instance (SRP batcher friendly).</summary>
        public static Material Lit(Color color, float smoothness = 0.35f, float metallic = 0f, Texture2D albedo = null, Texture2D normal = null, Vector2? tiling = null)
        {
            string key = $"{ColorUtility.ToHtmlStringRGBA(color)}_{smoothness:F2}_{metallic:F2}_{(albedo ? albedo.GetInstanceID() : 0)}_{(normal ? normal.GetInstanceID() : 0)}_{tiling}";
            if (cache.TryGetValue(key, out var m) && m != null) return m;
            m = new Material(LitBase());
            SetColor(m, color);
            if (m.HasProperty("_Smoothness")) m.SetFloat("_Smoothness", smoothness);
            if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", smoothness);
            if (m.HasProperty("_Metallic")) m.SetFloat("_Metallic", metallic);
            if (albedo != null)
            {
                if (m.HasProperty("_BaseMap")) m.SetTexture("_BaseMap", albedo);
                if (m.HasProperty("_MainTex")) m.SetTexture("_MainTex", albedo);
            }
            if (normal != null && m.HasProperty("_BumpMap"))
            {
                m.SetTexture("_BumpMap", normal);
                m.EnableKeyword("_NORMALMAP");
            }
            if (tiling.HasValue)
            {
                if (m.HasProperty("_BaseMap")) m.SetTextureScale("_BaseMap", tiling.Value);
                if (m.HasProperty("_MainTex")) m.SetTextureScale("_MainTex", tiling.Value);
                if (m.HasProperty("_BumpMap")) m.SetTextureScale("_BumpMap", tiling.Value);
            }
            m.enableInstancing = true;
            cache[key] = m;
            return m;
        }

        public static Material Emissive(Color color, float intensity)
        {
            var m = new Material(Unlit());
            SetColor(m, color * intensity);
            return m;
        }

        public static void SetColor(Material m, Color c)
        {
            if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", c);
            if (m.HasProperty("_Color")) m.SetColor("_Color", c);
        }
    }
}
