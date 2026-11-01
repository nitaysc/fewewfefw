using System;
using System.Collections.Generic;
using System.Numerics;

namespace RoostMX.Sim.Track
{
    public enum FeatureKind { Tabletop, Double, Whoops, Roller, StepUp, BrakingBumps }

    public sealed class TrackFeature
    {
        public FeatureKind Kind;
        public float S;              // start distance along the centreline, m
        public float Height = 2f;    // takeoff / bump height
        public float Face = 7f;      // takeoff face length
        public float Top = 10f;      // table top length, or gap for doubles
        public float Land = 11f;     // landing ramp length
        public float LandHeight = -1f; // doubles/step-ups: landing peak (default = Height)
        public int Count = 8;        // whoops / rollers
        public float Wavelength = 4.5f;
        public const float BackSide = 4f;   // doubles: length of the landing mound's back side

        public float Length
        {
            get
            {
                switch (Kind)
                {
                    case FeatureKind.Tabletop: return Face + Top + Land;
                    case FeatureKind.Double: return Face + Top + BackSide + Land;
                    case FeatureKind.StepUp: return Face + Top + Land;
                    default: return Count * Wavelength;
                }
            }
        }

        /// <summary>
        /// A built jump face: a smooth transition that bends the slope up to the lip angle,
        /// then a straight ramp at that angle for the last part. A constant angle at the lip is
        /// what keeps a jump from "kicking" (pitching the bike nose-down as the rear leaves).
        /// </summary>
        public static float FaceProfile(float x, float face, float height)
        {
            float xt = face * 0.45f;
            float slope = height / (face - 0.5f * xt);
            if (x <= 0f) return 0f;
            if (x < xt) { float u = x / xt; return slope * xt * (u * u * u - 0.5f * u * u * u * u); }
            return slope * (0.5f * xt + Math.Min(x, face) - xt);
        }

        /// <summary>Height above the track bed at distance x from the feature start.</summary>
        public float Profile(float x)
        {
            if (x < 0 || x > Length) return 0f;
            float lh = LandHeight < 0 ? Height : LandHeight;
            switch (Kind)
            {
                case FeatureKind.Tabletop:
                    if (x < Face) return FaceProfile(x, Face, Height);
                    x -= Face;
                    if (x < Top) return Height;
                    x -= Top;
                    return Height * (1f - SimMath.SmoothStep(0f, 1f, x / Land));
                case FeatureKind.Double:
                    if (x < Face) return FaceProfile(x, Face, Height);
                    x -= Face;
                    if (x < Top) return 0f;                                              // the gap
                    x -= Top;
                    if (x < BackSide) return lh * SimMath.SmoothStep(0f, 1f, x / BackSide); // back of the landing mound
                    x -= BackSide;
                    return lh * (1f - SimMath.SmoothStep(0f, 1f, x / Land));
                case FeatureKind.StepUp:
                    if (x < Face) return FaceProfile(x, Face, Height);
                    x -= Face;
                    if (x < Top) return Height + (lh - Height) * SimMath.SmoothStep(0f, 1f, x / Math.Max(1f, Top * 0.4f));
                    x -= Top;
                    return lh * (1f - SimMath.SmoothStep(0f, 1f, x / Land));
                case FeatureKind.Whoops:
                case FeatureKind.Roller:
                {
                    float p = (float)Math.Sin(Math.PI * x / Wavelength);
                    return Height * p * p;
                }
                case FeatureKind.BrakingBumps:
                {
                    // irregular chatter that grows toward the corner entry
                    float grow = x / Length;
                    float p = (float)Math.Sin(2 * Math.PI * x / Wavelength + 0.7 * Math.Sin(x * 1.3));
                    return Height * grow * (0.5f + 0.5f * p);
                }
            }
            return 0f;
        }
    }

    public struct SurfaceRange { public float S0, S1; public SurfaceType Type; }

    /// <summary>
    /// A closed motocross circuit: Catmull-Rom centreline, per-point width, jumps, whoops,
    /// berms from curvature, and surface zones. BuildFields() rasterises it into a height
    /// grid + surface weights that Unity turns into a Terrain and the tests use as ground.
    /// </summary>
    public sealed class TrackLayout
    {
        public float Size = 320f;            // square world area, m
        public int Resolution = 1025;        // height samples per side (Unity: 2^n + 1)
        public int Seed = 7;
        public List<Vector2> Control = new List<Vector2>();
        public List<float> ControlWidth = new List<float>();
        public List<TrackFeature> Features = new List<TrackFeature>();
        public List<SurfaceRange> SurfaceZones = new List<SurfaceRange>();
        public float Shoulder = 7f;

        // centreline samples
        public Vector3[] Points;     // y = track bed elevation (without features)
        public Vector3[] Tangents;
        public float[] Dist, Width, Curv, Bank;
        public float Length;

        // grid
        public float[] Heights;      // world Y per sample, [z * Res + x]
        public float[] Splat;        // 4 weights per sample: grass, hardpack, loose, sand
        public float CellSize => Size / (Resolution - 1);
        public float Origin => -Size * 0.5f;
        public float MinHeight, MaxHeight;

        const float SampleStep = 1.0f;

        public static TrackLayout CreateDefault()
        {
            var t = new TrackLayout();
            void P(float x, float z, float w = 10f) { t.Control.Add(new Vector2(x, z)); t.ControlWidth.Add(w); }
            // Clockwise loop. The start straight runs north along x = -95.
            P(-95, -80, 16); P(-95, -20, 14); P(-95, 40, 11); P(-88, 72);
            P(-68, 88); P(-45, 82); P(-35, 60); P(-35, 20);
            P(-32, -8); P(-15, -22); P(10, -24); P(40, -22);
            P(60, -10); P(66, 12); P(66, 45); P(70, 78);
            P(86, 96); P(104, 90); P(110, 66); P(110, 20);
            P(110, -30); P(106, -72); P(88, -92); P(60, -98);
            P(20, -98); P(-20, -98); P(-55, -100); P(-80, -102);
            P(-93, -95, 14);

            // Jumps & sections, by distance from the start gate (s = 0 at the first point).
            // Everything sits on a straight; corners get berms from the curvature.
            void F(FeatureKind k, float at, float h, float face = 7f, float top = 10f, float land = 11f, float landH = -1f, int count = 8, float wave = 4.5f) =>
                t.Features.Add(new TrackFeature { Kind = k, S = at, Height = h, Face = face, Top = top, Land = land, LandHeight = landH, Count = count, Wavelength = wave });
            // start straight
            F(FeatureKind.Tabletop, 40, 2.0f, 7f, 9f, 11f);
            F(FeatureKind.Roller, 76, 0.6f, count: 2, wave: 12f);
            F(FeatureKind.BrakingBumps, 110, 0.06f, count: 18, wave: 1.0f);
            // after turn 1
            F(FeatureKind.Double, 245, 1.6f, 6f, 11f, 10f);
            F(FeatureKind.StepUp, 335, 1.5f, 6f, 10f, 12f, 2.4f);
            // sand whoops
            F(FeatureKind.Whoops, 420, 0.5f, count: 10, wave: 4.6f);
            // back straight: big table, rhythm, chop into the hairpin
            F(FeatureKind.Tabletop, 555, 2.8f, 8.5f, 14f, 13f);
            F(FeatureKind.Double, 600, 1.2f, 5f, 7f, 7f);
            F(FeatureKind.Double, 622, 1.2f, 5f, 7f, 7f);
            F(FeatureKind.Double, 644, 1.2f, 5f, 7f, 7f);
            F(FeatureKind.BrakingBumps, 668, 0.07f, count: 16, wave: 1.0f);
            // finish straight
            F(FeatureKind.Double, 748, 1.9f, 6.5f, 13f, 11f);
            F(FeatureKind.Roller, 790, 0.55f, count: 3, wave: 11f);
            F(FeatureKind.Tabletop, 830, 2.3f, 7.5f, 11f, 12f);
            F(FeatureKind.BrakingBumps, 866, 0.06f, count: 16, wave: 1.05f);

            t.SurfaceZones.Add(new SurfaceRange { S0 = 405, S1 = 485, Type = SurfaceType.Sand });
            t.SurfaceZones.Add(new SurfaceRange { S0 = 690, S1 = 740, Type = SurfaceType.LooseDirt });
            return t;
        }

        // ------------------------------------------------------------------------------
        static Vector2 CatmullRom(Vector2 p0, Vector2 p1, Vector2 p2, Vector2 p3, float t)
        {
            float t2 = t * t, t3 = t2 * t;
            return 0.5f * ((2f * p1) + (-p0 + p2) * t + (2f * p0 - 5f * p1 + 4f * p2 - p3) * t2 + (-p0 + 3f * p1 - 3f * p2 + p3) * t3);
        }

        public float BaseTerrain(float x, float z)
        {
            float n = Noise.Fbm(x / 110f, z / 110f, 4, Seed) * 2.6f;
            // hills only around the border of the property, the circuit sits in the valley
            float r = Math.Max(Math.Abs(x), Math.Abs(z)) / (Size * 0.5f);
            float hills = SimMath.SmoothStep(0.86f, 1.0f, r) * (12f + 10f * Noise.Value(x / 40f, z / 40f, Seed + 5));
            return n + hills;
        }

        public void BuildCentreline()
        {
            int n = Control.Count;
            var pts = new List<Vector2>();
            var wid = new List<float>();
            const int sub = 40;
            for (int i = 0; i < n; i++)
            {
                Vector2 p0 = Control[(i - 1 + n) % n], p1 = Control[i], p2 = Control[(i + 1) % n], p3 = Control[(i + 2) % n];
                float w1 = ControlWidth[i], w2 = ControlWidth[(i + 1) % n];
                for (int k = 0; k < sub; k++)
                {
                    float t = k / (float)sub;
                    pts.Add(CatmullRom(p0, p1, p2, p3, t));
                    wid.Add(w1 + (w2 - w1) * SimMath.SmoothStep(0f, 1f, t));
                }
            }
            // resample at constant spacing
            var cum = new float[pts.Count + 1];
            for (int i = 1; i <= pts.Count; i++) cum[i] = cum[i - 1] + Vector2.Distance(pts[i - 1], pts[i % pts.Count]);
            Length = cum[pts.Count];
            int m = (int)(Length / SampleStep);
            Points = new Vector3[m]; Tangents = new Vector3[m]; Dist = new float[m]; Width = new float[m]; Curv = new float[m]; Bank = new float[m];
            int j = 0;
            for (int i = 0; i < m; i++)
            {
                float s = i * Length / m;
                while (j < pts.Count - 1 && cum[j + 1] < s) j++;
                float f = (s - cum[j]) / Math.Max(1e-5f, cum[j + 1] - cum[j]);
                Vector2 a = pts[j], b = pts[(j + 1) % pts.Count];
                Vector2 p = a + (b - a) * f;
                Points[i] = new Vector3(p.X, 0f, p.Y);
                Width[i] = wid[j] + (wid[(j + 1) % wid.Count] - wid[j]) * f;
                Dist[i] = s;
            }
            for (int i = 0; i < m; i++)
            {
                Vector3 d = Points[(i + 1) % m] - Points[(i - 1 + m) % m];
                Tangents[i] = Vector3.Normalize(new Vector3(d.X, 0, d.Z));
            }
            // signed curvature (+ = turning right), smoothed
            var raw = new float[m];
            for (int i = 0; i < m; i++)
            {
                Vector3 a = Tangents[(i - 2 + m) % m], b = Tangents[(i + 2) % m];
                raw[i] = (a.Z * b.X - a.X * b.Z) / (4f * Length / m);
            }
            Curv = Smooth(raw, 6);
            for (int i = 0; i < m; i++)
            {
                float k = Math.Abs(Curv[i]);
                Bank[i] = SimMath.Clamp((k - 0.018f) * 38f, 0f, 1.7f);
            }
            Bank = Smooth(Bank, 8);

            // bed elevation follows the land, smoothed so the track is rideable
            var elev = new float[m];
            for (int i = 0; i < m; i++) elev[i] = BaseTerrain(Points[i].X, Points[i].Z);
            elev = Smooth(elev, 25);
            elev = Smooth(elev, 25);
            for (int i = 0; i < m; i++) Points[i].Y = elev[i];
        }

        static float[] Smooth(float[] a, int radius)
        {
            int m = a.Length;
            var o = new float[m];
            for (int i = 0; i < m; i++)
            {
                float sum = 0; int c = 0;
                for (int k = -radius; k <= radius; k++) { sum += a[(i + k + m) % m]; c++; }
                o[i] = sum / c;
            }
            return o;
        }

        public float FeatureHeight(float s)
        {
            float h = 0f;
            foreach (var f in Features) h += f.Profile(s - f.S);
            return h;
        }

        public SurfaceType ZoneSurface(float s, SurfaceType fallback)
        {
            foreach (var z in SurfaceZones) if (s >= z.S0 && s <= z.S1) return z.Type;
            return fallback;
        }

        /// <summary>Rasterises the track into Heights and Splat.</summary>
        public void BuildFields()
        {
            if (Points == null) BuildCentreline();
            int R = Resolution;
            float cs = CellSize, org = Origin;
            var best = new float[R * R];
            var lat = new float[R * R];
            var sAt = new float[R * R];
            var segIdx = new int[R * R];
            for (int i = 0; i < best.Length; i++) { best[i] = float.MaxValue; segIdx[i] = -1; }

            int m = Points.Length;
            for (int i = 0; i < m; i++)
            {
                Vector3 a = Points[i], b = Points[(i + 1) % m];
                float hw = Width[i] * 0.5f;
                float reach = hw + Shoulder + 2f;
                int x0 = Math.Max(0, (int)((Math.Min(a.X, b.X) - reach - org) / cs));
                int x1 = Math.Min(R - 1, (int)((Math.Max(a.X, b.X) + reach - org) / cs) + 1);
                int z0 = Math.Max(0, (int)((Math.Min(a.Z, b.Z) - reach - org) / cs));
                int z1 = Math.Min(R - 1, (int)((Math.Max(a.Z, b.Z) + reach - org) / cs) + 1);
                float abx = b.X - a.X, abz = b.Z - a.Z, len2 = abx * abx + abz * abz;
                for (int z = z0; z <= z1; z++)
                {
                    float pz = org + z * cs;
                    for (int x = x0; x <= x1; x++)
                    {
                        float px = org + x * cs;
                        float t = SimMath.Clamp01(((px - a.X) * abx + (pz - a.Z) * abz) / len2);
                        float cx = a.X + abx * t, cz = a.Z + abz * t;
                        float dx = px - cx, dz = pz - cz;
                        float d2 = dx * dx + dz * dz;
                        int idx = z * R + x;
                        if (d2 < best[idx])
                        {
                            best[idx] = d2;
                            Vector3 tg = Tangents[i];
                            // right of travel direction = Cross(Up, T) = (T.z, 0, -T.x)
                            lat[idx] = dx * tg.Z - dz * tg.X;
                            sAt[idx] = Dist[i] + t * (Length / m);
                            segIdx[idx] = i;
                        }
                    }
                }
            }

            Heights = new float[R * R];
            Splat = new float[R * R * 4];
            MinHeight = float.MaxValue; MaxHeight = float.MinValue;
            for (int z = 0; z < R; z++)
            {
                float pz = org + z * cs;
                for (int x = 0; x < R; x++)
                {
                    float px = org + x * cs;
                    int idx = z * R + x;
                    float baseH = BaseTerrain(px, pz);
                    float h = baseH;
                    float wGrass = 1f, wHard = 0f, wLoose = 0f, wSand = 0f;
                    int si = segIdx[idx];
                    if (si >= 0)
                    {
                        float d = lat[idx];
                        float ad = (float)Math.Sqrt(best[idx]);
                        float s = sAt[idx];
                        float hw = Width[si] * 0.5f;
                        float bed = Points[si].Y + (Points[(si + 1) % m].Y - Points[si].Y) * SimMath.Clamp01((s - Dist[si]) / (Length / m));
                        float feat = FeatureHeight(s);
                        // jumps taper at their sides so the faces don't end in walls
                        float featSide = 1f - SimMath.SmoothStep(hw * 0.85f, hw + 3.5f, ad);
                        float bank = Bank[si];
                        float outward = -d * Math.Sign(Curv[si]);          // + toward the outside of the turn
                        float tb = SimMath.Clamp((outward / hw + 1f) * 0.5f, 0f, 1.25f);
                        float bermH = bank * tb * tb;
                        // ruts and chop in the bed
                        float chop = (Noise.Fbm(px / 2.2f, pz / 2.2f, 2, Seed + 31) * 0.035f);
                        float trackH = bed + feat * featSide + bermH + chop;
                        float edgeLip = 0.35f * (1f - SimMath.Clamp01(Math.Abs(ad - hw - 1.0f) / 1.2f)); // windrow at the edge
                        if (ad <= hw)
                        {
                            h = trackH;
                        }
                        else
                        {
                            float k = SimMath.SmoothStep(hw, hw + Shoulder, ad);
                            float edgeH = Math.Max(trackH, bed + bermH + feat * featSide) + edgeLip;
                            h = edgeH + (baseH - edgeH) * k;
                        }

                        // surfaces
                        float inTrack = 1f - SimMath.SmoothStep(hw, hw + 1.6f, ad);
                        float line = 1f - SimMath.SmoothStep(hw * 0.35f, hw * 0.95f, ad);
                        float bermLoose = SimMath.Clamp01(bank * tb * 0.8f);
                        wHard = inTrack * line * (1f - bermLoose);
                        wLoose = inTrack - wHard;
                        // loose spoil on the shoulder blends into grass
                        float shoulderDirt = (1f - SimMath.SmoothStep(hw + 1f, hw + 4f, ad)) * (1f - inTrack);
                        wLoose += shoulderDirt;
                        var zone = ZoneSurface(s, SurfaceType.Hardpack);
                        if (zone == SurfaceType.Sand) { wSand = wHard + wLoose * 0.7f; wHard = 0f; wLoose *= 0.3f; }
                        else if (zone == SurfaceType.LooseDirt) { wLoose += wHard; wHard = 0f; }
                        wGrass = Math.Max(0f, 1f - wHard - wLoose - wSand);
                    }
                    Heights[idx] = h;
                    if (h < MinHeight) MinHeight = h;
                    if (h > MaxHeight) MaxHeight = h;
                    float sum = wGrass + wHard + wLoose + wSand;
                    Splat[idx * 4 + 0] = wGrass / sum;
                    Splat[idx * 4 + 1] = wHard / sum;
                    Splat[idx * 4 + 2] = wLoose / sum;
                    Splat[idx * 4 + 3] = wSand / sum;
                }
            }
        }

        // ------------------------------------------------------------------------------
        public float HeightAt(float x, float z)
        {
            int R = Resolution;
            float fx = (x - Origin) / CellSize, fz = (z - Origin) / CellSize;
            fx = SimMath.Clamp(fx, 0, R - 1.001f); fz = SimMath.Clamp(fz, 0, R - 1.001f);
            int ix = (int)fx, iz = (int)fz;
            float tx = fx - ix, tz = fz - iz;
            // same triangle split as Unity's terrain (diagonal from (0,0) to (1,1))
            float h00 = Heights[iz * R + ix], h10 = Heights[iz * R + ix + 1];
            float h01 = Heights[(iz + 1) * R + ix], h11 = Heights[(iz + 1) * R + ix + 1];
            if (tx >= tz) return h00 + (h10 - h00) * tx + (h11 - h10) * tz;
            return h00 + (h11 - h01) * tx + (h01 - h00) * tz;
        }

        public Vector3 NormalAt(float x, float z)
        {
            float e = CellSize;
            float hx = HeightAt(x + e, z) - HeightAt(x - e, z);
            float hz = HeightAt(x, z + e) - HeightAt(x, z - e);
            return Vector3.Normalize(new Vector3(-hx, 2f * e, -hz));
        }

        public SurfaceType SurfaceAt(float x, float z)
        {
            int R = Resolution;
            int ix = (int)Math.Round((x - Origin) / CellSize), iz = (int)Math.Round((z - Origin) / CellSize);
            if (ix < 0 || iz < 0 || ix >= R || iz >= R) return SurfaceType.Grass;
            int idx = (iz * R + ix) * 4;
            int bestK = 0; float bestW = -1f;
            for (int k = 0; k < 4; k++) if (Splat[idx + k] > bestW) { bestW = Splat[idx + k]; bestK = k; }
            switch (bestK)
            {
                case 1: return SurfaceType.Hardpack;
                case 2: return SurfaceType.LooseDirt;
                case 3: return SurfaceType.Sand;
                default: return SurfaceType.Grass;
            }
        }

        /// <summary>Nearest centreline sample to a world position (for respawn and lap timing).</summary>
        public int NearestSample(Vector3 p)
        {
            int bestI = 0; float bestD = float.MaxValue;
            for (int i = 0; i < Points.Length; i++)
            {
                float dx = Points[i].X - p.X, dz = Points[i].Z - p.Z;
                float d = dx * dx + dz * dz;
                if (d < bestD) { bestD = d; bestI = i; }
            }
            return bestI;
        }

        /// <summary>Spawn pose on the track bed at a centreline sample, facing along the track.</summary>
        public void SpawnPose(int sample, out Vector3 position, out Vector3 forward)
        {
            int i = ((sample % Points.Length) + Points.Length) % Points.Length;
            // step back until there is a clear run-up: no feature under the wheels or in the next 40 m
            int n = Points.Length;
            for (int k = 0; k < 200; k++)
            {
                bool clear = true;
                for (int a = 0; a <= 40 && clear; a += 2) if (FeatureHeight(Dist[(i + a) % n]) > 0.05f) clear = false;
                if (clear) break;
                i = (i - 1 + n) % n;
            }
            Vector3 p = Points[i];
            forward = Tangents[i];
            position = new Vector3(p.X, HeightAt(p.X, p.Z), p.Z);
        }
    }
}
