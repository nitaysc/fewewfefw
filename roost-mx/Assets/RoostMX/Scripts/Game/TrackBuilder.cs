using RoostMX.Sim.Track;
using UnityEngine;

namespace RoostMX.Game
{
    /// <summary>
    /// Turns the engine-independent TrackLayout into a Unity Terrain (heights + four splat
    /// layers matching the physics surfaces) and dresses it with Stage 1 placeholder props:
    /// course tape and stakes, start gate, light towers, trees, paddock tents, distant hills.
    /// </summary>
    public sealed class TrackBuilder : MonoBehaviour
    {
        public TrackLayout Layout { get; private set; }
        public Terrain Terrain { get; private set; }

        public void Build(TrackLayout layout)
        {
            Layout = layout;
            if (layout.Heights == null) layout.BuildFields();
            BuildTerrain();
            BuildCourseMarkers();
            BuildStartGate();
            BuildLightTowers();
            BuildTrees();
            BuildPaddock();
            BuildDistantHills();
        }

        // ------------------------------------------------------------------------------
        void BuildTerrain()
        {
            var t = Layout;
            int R = t.Resolution;
            float range = Mathf.Max(1f, t.MaxHeight - t.MinHeight + 2f);
            var data = new TerrainData { heightmapResolution = R };
            data.size = new Vector3(t.Size, range, t.Size);
            var h = new float[R, R];
            for (int z = 0; z < R; z++)
                for (int x = 0; x < R; x++)
                    h[z, x] = (t.Heights[z * R + x] - t.MinHeight) / range;
            data.SetHeights(0, 0, h);

            var dirt = ProceduralTextures.Dirt; var loose = ProceduralTextures.Loose;
            var sand = ProceduralTextures.Sand; var grass = ProceduralTextures.Grass;
            data.terrainLayers = new[]
            {
                Layer(grass, 6f, 0.05f), Layer(dirt, 3.2f, 0.18f), Layer(loose, 2.6f, 0.08f), Layer(sand, 4f, 0.05f),
            };
            int A = 512;
            data.alphamapResolution = A;
            var a = new float[A, A, 4];
            for (int z = 0; z < A; z++)
                for (int x = 0; x < A; x++)
                {
                    int gx = Mathf.RoundToInt(x / (float)(A - 1) * (R - 1));
                    int gz = Mathf.RoundToInt(z / (float)(A - 1) * (R - 1));
                    int i = (gz * R + gx) * 4;
                    for (int k = 0; k < 4; k++) a[z, x, k] = t.Splat[i + k];
                }
            data.SetAlphamaps(0, 0, a);

            var go = Terrain.CreateTerrainGameObject(data);
            go.name = "Terrain";
            go.transform.SetParent(transform, false);
            go.transform.position = new Vector3(t.Origin, t.MinHeight, t.Origin);
            Terrain = go.GetComponent<Terrain>();
            Terrain.heightmapPixelError = 4f;
            Terrain.basemapDistance = 140f;
            Terrain.drawInstanced = true;
            Terrain.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
            var terrainMat = Resources.Load<Material>("RoostMX/TerrainLit");
            if (terrainMat == null && MaterialLibrary.Urp)
            {
                var sh = Shader.Find("Universal Render Pipeline/Terrain/Lit");
                if (sh != null) terrainMat = new Material(sh);
            }
            if (terrainMat != null) Terrain.materialTemplate = terrainMat;
        }

        static TerrainLayer Layer(ProceduralTextures.Set s, float tile, float smooth)
        {
            return new TerrainLayer
            {
                diffuseTexture = s.Albedo, normalMapTexture = s.Normal, tileSize = new Vector2(tile, tile),
                smoothness = smooth, metallic = 0f, normalScale = 1f,
            };
        }

        float Ground(float x, float z) => Layout.HeightAt(x, z);

        // ------------------------------------------------------------------------------
        void BuildCourseMarkers()
        {
            var t = Layout;
            var posts = new MeshBuilder();
            var tape = new MeshBuilder();
            var flags = new MeshBuilder();
            int n = t.Points.Length;
            const int every = 6;
            Vector3[] prev = new Vector3[2];
            bool have = false;
            for (int i = 0; i <= n; i += every)
            {
                int k = i % n;
                var p = t.Points[k]; var tg = t.Tangents[k];
                Vector3 right = new Vector3(tg.Z, 0f, -tg.X);
                float off = t.Width[k] * 0.5f + 2.2f;
                for (int s = 0; s < 2; s++)
                {
                    float side = s == 0 ? -1f : 1f;
                    float x = p.X + right.x * off * side, z = p.Z + right.z * off * side;
                    var b = new Vector3(x, Ground(x, z), z);
                    posts.Tube(b, b + Vector3.up * 0.9f, 0.02f, -1f, 5, false);
                    if (have)
                    {
                        Vector3 a = prev[s] + Vector3.up * 0.75f, c = b + Vector3.up * 0.75f;
                        Vector3 mid = (a + c) * 0.5f; Vector3 d = c - a;
                        if (d.sqrMagnitude > 0.01f)
                            tape.Box(mid, new Vector3(0.004f, 0.035f, d.magnitude * 0.5f), Quaternion.LookRotation(d.normalized, Vector3.up));
                        // pennants under the line on the outside of corners
                        if (Mathf.Abs(t.Curv[k]) > 0.02f && (t.Curv[k] > 0 ? side < 0 : side > 0))
                            for (int f = 0; f < 3; f++)
                            {
                                Vector3 fp = Vector3.Lerp(a, c, (f + 0.5f) / 3f) - Vector3.up * 0.12f;
                                flags.Box(fp, new Vector3(0.003f, 0.09f, 0.11f), Quaternion.LookRotation(d.normalized, Vector3.up) * Quaternion.Euler(0, 0, 0));
                            }
                    }
                    prev[s] = b;
                }
                have = true;
            }
            var root = new GameObject("CourseMarkers").transform;
            root.SetParent(transform, false);
            MeshBuilder.Part("Stakes", root, posts.Build("stakes"), MaterialLibrary.Lit(new Color(0.85f, 0.85f, 0.85f), 0.3f));
            MeshBuilder.Part("Tape", root, tape.Build("tape"), MaterialLibrary.Lit(new Color(0.85f, 0.12f, 0.10f), 0.4f));
            MeshBuilder.Part("Pennants", root, flags.Build("pennants"), MaterialLibrary.Lit(new Color(0.95f, 0.95f, 0.95f), 0.3f));
        }

        void BuildStartGate()
        {
            var t = Layout;
            var p = t.Points[0]; var tg = t.Tangents[0];
            Vector3 fwd = new Vector3(tg.X, 0, tg.Z), right = new Vector3(tg.Z, 0, -tg.X);
            Vector3 c = new Vector3(p.X, 0, p.Z) - fwd * 3f;
            var gate = new MeshBuilder();
            var frame = new MeshBuilder();
            float w = t.Width[0] - 1f;
            int slots = 10;
            for (int i = 0; i < slots; i++)
            {
                float u = (i + 0.5f) / slots - 0.5f;
                Vector3 b = c + right * (u * w);
                b.y = Ground(b.x, b.z);
                gate.Box(b + Vector3.up * 0.28f + fwd * 0.05f, new Vector3(w / slots * 0.45f, 0.26f, 0.02f), Quaternion.LookRotation(fwd) * Quaternion.Euler(-12f, 0, 0));
            }
            Vector3 l = c - right * (w * 0.5f + 0.3f), r = c + right * (w * 0.5f + 0.3f);
            l.y = Ground(l.x, l.z); r.y = Ground(r.x, r.z);
            frame.Tube(l + Vector3.up * 0.05f, r + Vector3.up * 0.05f, 0.05f);
            frame.Tube(l, l + Vector3.up * 0.7f, 0.05f); frame.Tube(r, r + Vector3.up * 0.7f, 0.05f);
            // banner arch over the start straight
            Vector3 al = c + fwd * 25f - right * (w * 0.5f + 1.5f), ar = c + fwd * 25f + right * (w * 0.5f + 1.5f);
            al.y = Ground(al.x, al.z); ar.y = Ground(ar.x, ar.z);
            frame.Tube(al, al + Vector3.up * 5.5f, 0.12f); frame.Tube(ar, ar + Vector3.up * 5.5f, 0.12f);
            var banner = new MeshBuilder();
            Vector3 mid = (al + ar) * 0.5f + Vector3.up * 5.0f;
            banner.Box(mid, new Vector3((ar - al).magnitude * 0.5f, 0.55f, 0.05f), Quaternion.LookRotation(fwd));
            var root = new GameObject("StartGate").transform;
            root.SetParent(transform, false);
            MeshBuilder.Part("Gates", root, gate.Build("gates"), MaterialLibrary.Lit(new Color(0.75f, 0.76f, 0.78f), 0.5f, 0.8f));
            MeshBuilder.Part("Frame", root, frame.Build("gateframe"), MaterialLibrary.Lit(new Color(0.15f, 0.15f, 0.16f), 0.4f, 0.6f));
            MeshBuilder.Part("Banner", root, banner.Build("banner"), MaterialLibrary.Lit(new Color(0.92f, 0.36f, 0.06f), 0.4f));
        }

        void BuildLightTowers()
        {
            var t = Layout;
            var poles = new MeshBuilder();
            var lamps = new MeshBuilder();
            int n = t.Points.Length;
            for (int i = 0; i < n; i += 70)
            {
                var p = t.Points[i]; var tg = t.Tangents[i];
                Vector3 right = new Vector3(tg.Z, 0, -tg.X);
                float side = (i / 70) % 2 == 0 ? 1f : -1f;
                Vector3 b = new Vector3(p.X, 0, p.Z) + right * side * (t.Width[i] * 0.5f + 9f);
                b.y = Ground(b.x, b.z);
                Vector3 top = b + Vector3.up * 16f;
                poles.Tube(b, top, 0.16f, 0.10f, 8);
                Vector3 toTrack = (-right * side);
                lamps.Box(top + toTrack * 0.3f, new Vector3(0.9f, 0.25f, 0.12f), Quaternion.LookRotation(toTrack) * Quaternion.Euler(25f, 0, 0));
            }
            var root = new GameObject("LightTowers").transform;
            root.SetParent(transform, false);
            MeshBuilder.Part("Poles", root, poles.Build("poles"), MaterialLibrary.Lit(new Color(0.3f, 0.3f, 0.32f), 0.4f, 0.7f));
            MeshBuilder.Part("Lamps", root, lamps.Build("lamps"), MaterialLibrary.Emissive(new Color(1f, 0.95f, 0.85f), 3f));
        }

        void BuildTrees()
        {
            var t = Layout;
            var trunks = new MeshBuilder();
            var crowns = new MeshBuilder();
            var crownsDry = new MeshBuilder();
            var rng = new System.Random(5);
            int placed = 0;
            for (int tries = 0; tries < 4000 && placed < 160; tries++)
            {
                float x = (float)(rng.NextDouble() - 0.5) * t.Size * 0.94f;
                float z = (float)(rng.NextDouble() - 0.5) * t.Size * 0.94f;
                if (DistanceToTrack(x, z) < 16f) continue;
                if (Noise.Value(x / 35f, z / 35f, 3) < 0.45f) continue; // clumps
                float y = Ground(x, z);
                float hgt = 5f + (float)rng.NextDouble() * 6f;
                var b = new Vector3(x, y, z);
                trunks.Tube(b - Vector3.up * 0.3f, b + Vector3.up * hgt * 0.55f, 0.18f, 0.12f, 6, false);
                var crownC = b + Vector3.up * hgt * 0.72f;
                var rad = new Vector3(1f, 1.25f, 1f) * (hgt * 0.28f);
                (rng.NextDouble() < 0.3 ? crownsDry : crowns).Ellipsoid(crownC, rad, 9, 6);
                placed++;
            }
            var root = new GameObject("Trees").transform;
            root.SetParent(transform, false);
            MeshBuilder.Part("Trunks", root, trunks.Build("trunks"), MaterialLibrary.Lit(new Color(0.25f, 0.18f, 0.12f), 0.2f));
            MeshBuilder.Part("Crowns", root, crowns.Build("crowns"), MaterialLibrary.Lit(new Color(0.17f, 0.25f, 0.12f), 0.15f));
            MeshBuilder.Part("CrownsDry", root, crownsDry.Build("crownsdry"), MaterialLibrary.Lit(new Color(0.33f, 0.32f, 0.17f), 0.15f));
        }

        float DistanceToTrack(float x, float z)
        {
            float best = float.MaxValue;
            var pts = Layout.Points;
            for (int i = 0; i < pts.Length; i += 3)
            {
                float dx = pts[i].X - x, dz = pts[i].Z - z;
                float d = dx * dx + dz * dz;
                if (d < best) best = d;
            }
            return Mathf.Sqrt(best);
        }

        void BuildPaddock()
        {
            var t = Layout;
            var p = t.Points[0]; var tg = t.Tangents[0];
            Vector3 fwd = new Vector3(tg.X, 0, tg.Z), right = new Vector3(tg.Z, 0, -tg.X);
            var tents = new MeshBuilder();
            var trucks = new MeshBuilder();
            for (int i = 0; i < 5; i++)
            {
                Vector3 b = new Vector3(p.X, 0, p.Z) - right * 24f + fwd * (10f + i * 14f);
                b.y = Ground(b.x, b.z);
                tents.Box(b + Vector3.up * 2.6f, new Vector3(2.6f, 0.08f, 2.6f), Quaternion.LookRotation(fwd));
                foreach (var c in new[] { new Vector2(-1, -1), new Vector2(1, -1), new Vector2(1, 1), new Vector2(-1, 1) })
                {
                    Vector3 leg = b + right * c.x * 2.5f + fwd * c.y * 2.5f;
                    trucks.Tube(leg, leg + Vector3.up * 2.6f, 0.04f, -1f, 4, false);
                }
                Vector3 tb = b - right * 7f;
                trucks.Box(tb + Vector3.up * 1.9f, new Vector3(1.3f, 1.9f, 4.5f), Quaternion.LookRotation(fwd));
            }
            var root = new GameObject("Paddock").transform;
            root.SetParent(transform, false);
            MeshBuilder.Part("Canopies", root, tents.Build("canopies"), MaterialLibrary.Lit(new Color(0.85f, 0.85f, 0.15f), 0.3f));
            MeshBuilder.Part("Trucks", root, trucks.Build("trucks"), MaterialLibrary.Lit(new Color(0.8f, 0.8f, 0.82f), 0.5f, 0.3f));
        }

        void BuildDistantHills()
        {
            var mb = new MeshBuilder();
            // a ring of ridges well outside the property; fog blends them into the dusk sky
            const int seg = 128;
            var verts = new System.Collections.Generic.List<Vector3>();
            for (int i = 0; i <= seg; i++)
            {
                float a = i / (float)seg * Mathf.PI * 2f;
                float n = Noise.Fbm(Mathf.Cos(a) * 3f, Mathf.Sin(a) * 3f, 4, 77) * 0.5f + 0.5f;
                float rad = 650f + 150f * Noise.Value(Mathf.Cos(a) * 2f + 9, Mathf.Sin(a) * 2f, 78);
                float hgt = 40f + 170f * n * n;
                Vector3 baseP = new Vector3(Mathf.Cos(a) * rad, -5f, Mathf.Sin(a) * rad);
                Vector3 topP = new Vector3(Mathf.Cos(a) * (rad + 120f), hgt, Mathf.Sin(a) * (rad + 120f));
                if (i > 0)
                {
                    Vector3 pb = verts[verts.Count - 2], pt = verts[verts.Count - 1];
                    AddQuad(mb, pb, baseP, topP, pt);
                }
                verts.Add(baseP); verts.Add(topP);
            }
            var go = MeshBuilder.Part("DistantHills", transform, mb.Build("hills"), MaterialLibrary.Lit(new Color(0.17f, 0.13f, 0.17f), 0.05f));
            go.GetComponent<MeshRenderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        static void AddQuad(MeshBuilder mb, Vector3 a, Vector3 b, Vector3 c, Vector3 d)
        {
            // one flattened box per ridge segment: cheap, and closed so it looks solid from any side
            Vector3 centre = (a + b + c + d) * 0.25f;
            Vector3 u = (b - a + c - d) * 0.5f, v = (d - a + c - b) * 0.5f;
            Vector3 nrm = Vector3.Cross(u, v).normalized;
            var rot = Quaternion.LookRotation(nrm, v.normalized);
            mb.Box(centre, new Vector3(u.magnitude * 0.5f + 0.5f, v.magnitude * 0.5f, 0.5f), rot);
        }
    }
}
