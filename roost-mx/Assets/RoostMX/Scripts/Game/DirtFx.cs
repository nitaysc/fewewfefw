using RoostMX.Sim;
using UnityEngine;

namespace RoostMX.Game
{
    /// <summary>
    /// Roost and dust from the contact patches, driven by the tyre model: the rear throws dirt
    /// in proportion to how fast it spins against the ground, both wheels kick up dust when
    /// sliding sideways, and landings puff. Colour follows the surface under the tyre.
    /// Stage 1 effect; Stage 4 adds ruts, decals and dirt build-up on bike and rider.
    /// </summary>
    public sealed class DirtFx : MonoBehaviour
    {
        public BikeController Bike;
        ParticleSystem clods, dust;
        float rearAcc, frontAcc, dustAcc;

        public void Build()
        {
            clods = Make("Roost", 500, 0.04f, 0.13f, 0.5f, 1.1f, 1.0f);
            dust = Make("Dust", 300, 0.6f, 1.6f, 1.2f, 2.4f, -0.02f);
        }

        ParticleSystem Make(string name, int max, float sizeMin, float sizeMax, float lifeMin, float lifeMax, float gravity)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.loop = false; main.playOnAwake = false;
            main.maxParticles = max;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.startSize = new ParticleSystem.MinMaxCurve(sizeMin, sizeMax);
            main.startLifetime = new ParticleSystem.MinMaxCurve(lifeMin, lifeMax);
            main.gravityModifier = gravity;
            var em = ps.emission; em.enabled = false;
            var shape = ps.shape; shape.enabled = false;
            var col = ps.colorOverLifetime; col.enabled = true;
            var g = new Gradient();
            g.SetKeys(new[] { new GradientColorKey(Color.white, 0f), new GradientColorKey(Color.white, 1f) },
                      new[] { new GradientAlphaKey(gravity > 0 ? 1f : 0.35f, 0f), new GradientAlphaKey(0f, 1f) });
            col.color = g;
            if (gravity < 0f) { var sz = ps.sizeOverLifetime; sz.enabled = true; sz.size = new ParticleSystem.MinMaxCurve(1f, AnimationCurve.Linear(0, 0.5f, 1, 2f)); }
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = MaterialLibrary.Particle();
            r.renderMode = ParticleSystemRenderMode.Billboard;
            ps.Play();
            return ps;
        }

        static Color SurfaceColor(SurfaceType s)
        {
            switch (s)
            {
                case SurfaceType.Sand: return new Color(0.78f, 0.68f, 0.50f);
                case SurfaceType.Grass: return new Color(0.35f, 0.33f, 0.20f);
                case SurfaceType.LooseDirt: return new Color(0.55f, 0.43f, 0.32f);
                default: return new Color(0.45f, 0.35f, 0.26f);
            }
        }

        void Update()
        {
            if (Bike == null || Bike.Sim == null || clods == null) return;
            var s = Bike.Sim;
            float dt = Time.deltaTime;
            var r = s.Rear; var f = s.Front;
            Vector3 back = -Bike.transform.forward;
            if (r.InContact)
            {
                float spin = Mathf.Max(0f, r.Omega * r.Spec.Radius - r.Vx);       // m/s of wheelspin
                float side = Mathf.Abs(r.Vy);
                float loose = r.SurfaceType == SurfaceType.Hardpack ? 0.6f : 1.2f;
                rearAcc += (spin * 14f + side * 6f + Mathf.Abs(s.Speed) * 0.4f * s.ThrottleCmd) * loose * dt;
                Emit(clods, ref rearAcc, r.ContactPoint.ToU(), back * (2f + spin * 0.8f) + Vector3.up * (1.5f + spin * 0.35f), 1.6f, SurfaceColor(r.SurfaceType));
                dustAcc += (spin * 2f + side * 3f + Mathf.Abs(s.Speed) * 0.08f) * dt;
                Emit(dust, ref dustAcc, r.ContactPoint.ToU() + Vector3.up * 0.2f, back * 1.2f + Vector3.up * 0.6f, 1.0f, SurfaceColor(r.SurfaceType) * 1.15f);
            }
            if (f.InContact)
            {
                float side = Mathf.Abs(f.Vy) + Mathf.Max(0f, -f.SlipRatio) * Mathf.Abs(f.Vx) * 0.5f;
                frontAcc += side * 8f * dt;
                Emit(clods, ref frontAcc, f.ContactPoint.ToU(), Bike.transform.right * Mathf.Sign(f.Vy) * -2f + Vector3.up * 1.2f, 1.2f, SurfaceColor(f.SurfaceType));
            }
        }

        static void Emit(ParticleSystem ps, ref float acc, Vector3 pos, Vector3 vel, float spread, Color c)
        {
            int n = (int)acc;
            if (n <= 0) return;
            acc -= n;
            n = Mathf.Min(n, 30);
            var p = new ParticleSystem.EmitParams { applyShapeToPosition = false };
            for (int i = 0; i < n; i++)
            {
                p.position = pos + Random.insideUnitSphere * 0.08f;
                p.velocity = vel + Random.insideUnitSphere * spread;
                p.startColor = c * Random.Range(0.8f, 1.1f);
                ps.Emit(p, 1);
            }
        }
    }
}
