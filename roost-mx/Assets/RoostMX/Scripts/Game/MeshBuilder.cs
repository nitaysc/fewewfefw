using System.Collections.Generic;
using UnityEngine;

namespace RoostMX.Game
{
    /// <summary>Small procedural mesh kit for the Stage 1 placeholder bike, rider and props.</summary>
    public sealed class MeshBuilder
    {
        readonly List<Vector3> v = new List<Vector3>();
        readonly List<Vector3> n = new List<Vector3>();
        readonly List<Vector2> uv = new List<Vector2>();
        readonly List<int> t = new List<int>();

        public Mesh Build(string name)
        {
            var m = new Mesh { name = name };
            if (v.Count > 65000) m.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
            m.SetVertices(v); m.SetNormals(n); m.SetUVs(0, uv); m.SetTriangles(t, 0);
            m.RecalculateBounds();
            m.RecalculateTangents();
            return m;
        }

        void Quad(int a, int b, int c, int d) { t.Add(a); t.Add(b); t.Add(c); t.Add(a); t.Add(c); t.Add(d); }

        /// <summary>Torus around local X (a wheel). major = to tube centre, minor = tube radius.</summary>
        public MeshBuilder Torus(float major, float minor, int seg = 40, int side = 12, float knobs = 0f, int knobCount = 0)
        {
            int start = v.Count;
            for (int i = 0; i <= seg; i++)
            {
                float a = i / (float)seg * Mathf.PI * 2f;
                var dir = new Vector3(0, Mathf.Cos(a), Mathf.Sin(a));
                for (int j = 0; j <= side; j++)
                {
                    float b = j / (float)side * Mathf.PI * 2f;
                    Vector3 local = dir * Mathf.Cos(b) + Vector3.right * Mathf.Sin(b);
                    float r = minor;
                    if (knobCount > 0)
                    {
                        // knobby tread: blocks on the crown and shoulders
                        float tread = Mathf.Clamp01(Mathf.Cos(b) * 1.4f);
                        float block = Mathf.Sin(a * knobCount) > 0.15f ? 1f : 0f;
                        float shoulder = Mathf.Abs(Mathf.Sin(b)) > 0.55f && Mathf.Sin(a * knobCount + 1.6f) > 0.3f ? 0.7f : 0f;
                        r += knobs * Mathf.Max(block * tread, shoulder * (1f - tread));
                    }
                    v.Add(dir * major + local * r);
                    n.Add(local);
                    uv.Add(new Vector2(i / (float)seg * 8f, j / (float)side));
                }
            }
            for (int i = 0; i < seg; i++)
                for (int j = 0; j < side; j++)
                {
                    int a0 = start + i * (side + 1) + j, a1 = a0 + side + 1;
                    Quad(a0, a1, a1 + 1, a0 + 1);
                }
            return this;
        }

        /// <summary>Cylinder between two points.</summary>
        public MeshBuilder Tube(Vector3 p0, Vector3 p1, float r0, float r1 = -1f, int seg = 10, bool caps = true)
        {
            if (r1 < 0) r1 = r0;
            Vector3 axis = p1 - p0;
            float len = axis.magnitude;
            if (len < 1e-5f) return this;
            axis /= len;
            Vector3 side = Vector3.Cross(axis, Mathf.Abs(axis.y) < 0.9f ? Vector3.up : Vector3.right).normalized;
            Vector3 up = Vector3.Cross(side, axis);
            int start = v.Count;
            for (int i = 0; i <= seg; i++)
            {
                float a = i / (float)seg * Mathf.PI * 2f;
                Vector3 d = side * Mathf.Cos(a) + up * Mathf.Sin(a);
                v.Add(p0 + d * r0); n.Add(d); uv.Add(new Vector2(i / (float)seg, 0));
                v.Add(p1 + d * r1); n.Add(d); uv.Add(new Vector2(i / (float)seg, len));
            }
            for (int i = 0; i < seg; i++) { int a = start + i * 2; Quad(a, a + 1, a + 3, a + 2); }
            if (caps)
            {
                Cap(p0, -axis, side, up, r0, seg, true);
                Cap(p1, axis, side, up, r1, seg, false);
            }
            return this;
        }

        void Cap(Vector3 c, Vector3 normal, Vector3 side, Vector3 up, float r, int seg, bool flip)
        {
            int centre = v.Count;
            v.Add(c); n.Add(normal); uv.Add(new Vector2(0.5f, 0.5f));
            for (int i = 0; i <= seg; i++)
            {
                float a = i / (float)seg * Mathf.PI * 2f;
                Vector3 d = side * Mathf.Cos(a) + up * Mathf.Sin(a);
                v.Add(c + d * r); n.Add(normal); uv.Add(new Vector2(0.5f + Mathf.Cos(a) * 0.5f, 0.5f + Mathf.Sin(a) * 0.5f));
            }
            for (int i = 0; i < seg; i++)
            {
                if (flip) { t.Add(centre); t.Add(centre + i + 1); t.Add(centre + i + 2); }
                else { t.Add(centre); t.Add(centre + i + 2); t.Add(centre + i + 1); }
            }
        }

        /// <summary>Oriented box (centre, half extents, rotation).</summary>
        public MeshBuilder Box(Vector3 c, Vector3 half, Quaternion rot)
        {
            Vector3[] dirs = { Vector3.right, Vector3.left, Vector3.up, Vector3.down, Vector3.forward, Vector3.back };
            foreach (var d in dirs)
            {
                Vector3 a = Mathf.Abs(d.y) > 0.5f ? Vector3.right : Vector3.up;
                Vector3 b = Vector3.Cross(d, a);
                a = Vector3.Cross(b, d);
                int s = v.Count;
                for (int k = 0; k < 4; k++)
                {
                    float sx = (k == 0 || k == 3) ? -1 : 1, sy = k < 2 ? -1 : 1;
                    Vector3 p = Vector3.Scale(d + a * sx + b * sy, half);
                    v.Add(c + rot * p); n.Add(rot * d); uv.Add(new Vector2(sx * 0.5f + 0.5f, sy * 0.5f + 0.5f));
                }
                t.Add(s); t.Add(s + 1); t.Add(s + 2); t.Add(s); t.Add(s + 2); t.Add(s + 3);
            }
            return this;
        }

        /// <summary>Capsule-ish ellipsoid (helmet, body parts).</summary>
        public MeshBuilder Ellipsoid(Vector3 c, Vector3 radii, int seg = 16, int rings = 10)
        {
            int start = v.Count;
            for (int r = 0; r <= rings; r++)
            {
                float phi = r / (float)rings * Mathf.PI;
                for (int s = 0; s <= seg; s++)
                {
                    float th = s / (float)seg * Mathf.PI * 2f;
                    var d = new Vector3(Mathf.Sin(phi) * Mathf.Cos(th), Mathf.Cos(phi), Mathf.Sin(phi) * Mathf.Sin(th));
                    v.Add(c + Vector3.Scale(d, radii));
                    n.Add(new Vector3(d.x / radii.x, d.y / radii.y, d.z / radii.z).normalized);
                    uv.Add(new Vector2(s / (float)seg, r / (float)rings));
                }
            }
            for (int r = 0; r < rings; r++)
                for (int s = 0; s < seg; s++)
                {
                    int a = start + r * (seg + 1) + s, b = a + seg + 1;
                    Quad(a, a + 1, b + 1, b);
                }
            return this;
        }

        /// <summary>Flat disc in the YZ plane facing ±X (brake rotor, number plate backing).</summary>
        public MeshBuilder Disc(Vector3 c, float rOuter, float rInner, float thickness, int seg = 24)
        {
            for (int i = 0; i < seg; i++)
            {
                float a0 = i / (float)seg * Mathf.PI * 2f, a1 = (i + 1) / (float)seg * Mathf.PI * 2f;
                float am = (a0 + a1) * 0.5f;
                var dir = new Vector3(0, Mathf.Cos(am), Mathf.Sin(am));
                float w = (rOuter - rInner) * 0.5f;
                float l = rOuter * (a1 - a0) * 0.5f;
                Box(c + dir * (rInner + w), new Vector3(thickness * 0.5f, w, l), Quaternion.LookRotation(Vector3.Cross(dir, Vector3.right), dir));
            }
            return this;
        }

        public static GameObject Part(string name, Transform parent, Mesh mesh, Material mat, Vector3 localPos = default, Quaternion? localRot = null)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = localPos;
            go.transform.localRotation = localRot ?? Quaternion.identity;
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat;
            return go;
        }
    }
}
