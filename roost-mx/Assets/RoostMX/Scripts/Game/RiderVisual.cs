using RoostMX.Sim;
using UnityEngine;

namespace RoostMX.Game
{
    /// <summary>
    /// Stage 1 PLACEHOLDER rider mannequin. Its pose is computed from the rider simulation
    /// every frame: pelvis at the simulated rider mass, torso from the simulated torso angles,
    /// hands IK'd to the (steered) grips and feet to the pegs with two-bone IK. Stage 4
    /// replaces the meshes with a rigged character, cloth and animation layers driven by the
    /// same state.
    /// </summary>
    public sealed class RiderVisual : MonoBehaviour
    {
        BikeSim sim;
        Transform bike;
        Transform[] bones;
        Transform helmet, chestT, pelvisT;
        Vector3 head, barRel, peg;

        static Mesh tube, ball;

        public struct Kit { public Color Jersey, JerseyAccent, Pants, Boots, Gloves, Helmet, Visor; }

        public static Kit DefaultKit => new Kit
        {
            Jersey = new Color(0.95f, 0.95f, 0.96f), JerseyAccent = new Color(0.10f, 0.25f, 0.75f),
            Pants = new Color(0.12f, 0.20f, 0.55f), Boots = new Color(0.92f, 0.92f, 0.94f),
            Gloves = new Color(0.95f, 0.95f, 0.95f), Helmet = new Color(0.98f, 0.82f, 0.10f), Visor = new Color(0.05f, 0.05f, 0.06f),
        };

        // bone indices
        const int UpperArmL = 0, ForeArmL = 1, UpperArmR = 2, ForeArmR = 3, ThighL = 4, ShinL = 5, ThighR = 6, ShinR = 7, Torso = 8, Neck = 9;

        public void Build(BikeSim simulation, Transform bikeRoot, Kit kit)
        {
            sim = simulation; bike = bikeRoot;
            if (tube == null) tube = new MeshBuilder().Tube(Vector3.zero, Vector3.forward, 1f, -1f, 10).Build("unit_tube");
            if (ball == null) ball = new MeshBuilder().Ellipsoid(Vector3.zero, Vector3.one, 14, 8).Build("unit_ball");
            foreach (Transform c in transform) Destroy(c.gameObject);

            var jersey = MaterialLibrary.Lit(kit.Jersey, 0.25f);
            var accent = MaterialLibrary.Lit(kit.JerseyAccent, 0.3f);
            var pants = MaterialLibrary.Lit(kit.Pants, 0.3f);
            var boots = MaterialLibrary.Lit(kit.Boots, 0.5f);
            var gloves = MaterialLibrary.Lit(kit.Gloves, 0.3f);
            var helmetM = MaterialLibrary.Lit(kit.Helmet, 0.8f);
            var visor = MaterialLibrary.Lit(kit.Visor, 0.9f);

            bones = new Transform[10];
            bones[UpperArmL] = Part("UpperArmL", tube, accent);
            bones[ForeArmL] = Part("ForeArmL", tube, jersey);
            bones[UpperArmR] = Part("UpperArmR", tube, accent);
            bones[ForeArmR] = Part("ForeArmR", tube, jersey);
            bones[ThighL] = Part("ThighL", tube, pants);
            bones[ShinL] = Part("ShinL", tube, boots);
            bones[ThighR] = Part("ThighR", tube, pants);
            bones[ShinR] = Part("ShinR", tube, boots);
            bones[Torso] = Part("Torso", tube, jersey);
            bones[Neck] = Part("Neck", tube, accent);
            pelvisT = Part("Pelvis", ball, pants);
            pelvisT.localScale = new Vector3(0.17f, 0.11f, 0.12f);
            chestT = Part("Chest", ball, jersey);
            chestT.localScale = new Vector3(0.21f, 0.15f, 0.13f);
            helmet = Part("Helmet", ball, helmetM);
            helmet.localScale = new Vector3(0.135f, 0.14f, 0.16f);
            var goggles = Part("Goggles", ball, visor); goggles.SetParent(helmet, false);
            goggles.localPosition = new Vector3(0, -0.05f, 0.55f); goggles.localScale = new Vector3(0.75f, 0.32f, 0.5f);
            var peak = Part("Peak", ball, helmetM); peak.SetParent(helmet, false);
            peak.localPosition = new Vector3(0, 0.45f, 0.75f); peak.localScale = new Vector3(0.8f, 0.12f, 0.55f);
            var chin = Part("Chin", ball, helmetM); chin.SetParent(helmet, false);
            chin.localPosition = new Vector3(0, -0.55f, 0.55f); chin.localScale = new Vector3(0.55f, 0.35f, 0.5f);
            foreach (string n in new[] { "GloveL", "GloveR", "BootL", "BootR" })
            {
                var t = Part(n, ball, n.StartsWith("Glove") ? gloves : boots);
                t.localScale = n.StartsWith("Glove") ? Vector3.one * 0.05f : new Vector3(0.06f, 0.06f, 0.14f);
            }

            var spec = sim.Spec;
            Vector3 axis = sim.Front.AxisLocal.ToU();
            head = spec.FrontAxleAtSag.ToU() + axis * 0.78f - new Vector3(0f, 0f, 0.055f);
            barRel = spec.BarPoint.ToU() - head + new Vector3(0f, 0.02f, -0.03f);
            peg = spec.PegPoint.ToU();
        }

        Transform Part(string name, Mesh mesh, Material mat)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat;
            return go.transform;
        }

        void Bone(int i, Vector3 a, Vector3 b, float radius)
        {
            var t = bones[i];
            Vector3 d = b - a;
            float len = Mathf.Max(0.001f, d.magnitude);
            t.localPosition = a;
            t.localRotation = Quaternion.LookRotation(d / len, Vector3.up);
            t.localScale = new Vector3(radius, radius, len);
        }

        static Vector3 SolveIK(Vector3 root, Vector3 target, float l1, float l2, Vector3 pole)
        {
            Vector3 d = target - root;
            float dist = Mathf.Clamp(d.magnitude, 0.01f, (l1 + l2) * 0.999f);
            Vector3 dir = d.normalized;
            float a = (l1 * l1 - l2 * l2 + dist * dist) / (2f * dist);
            float h = Mathf.Sqrt(Mathf.Max(0f, l1 * l1 - a * a));
            Vector3 bend = Vector3.ProjectOnPlane(pole, dir).normalized;
            return root + dir * a + bend * h;
        }

        void LateUpdate()
        {
            if (sim == null) return;
            bool show = !sim.Rider.Detached;
            foreach (Transform c in transform) if (c.gameObject.activeSelf != show) c.gameObject.SetActive(show);
            if (!show) return;

            var r = sim.Rider;
            Vector3 com = bike.InverseTransformPoint(r.Position.ToU());
            float stand = r.Standing;
            Vector3 hip = com + new Vector3(0f, -Mathf.Lerp(0.13f, 0.22f, stand), Mathf.Lerp(-0.03f, -0.10f, stand));
            float pitch = Mathf.Lerp(18f, 40f, stand) + r.BodyAngle.X * Mathf.Rad2Deg;
            Quaternion torsoRot = Quaternion.Euler(pitch, r.BodyAngle.Y * Mathf.Rad2Deg, r.BodyAngle.Z * Mathf.Rad2Deg);
            Vector3 up = torsoRot * Vector3.up, right = torsoRot * Vector3.right, fwd = torsoRot * Vector3.forward;
            Vector3 chest = hip + up * 0.46f;
            Vector3 neckTop = chest + up * 0.13f;
            Vector3 headC = neckTop + up * 0.10f + fwd * 0.03f;

            pelvisT.localPosition = hip; pelvisT.localRotation = torsoRot;
            chestT.localPosition = chest - up * 0.06f; chestT.localRotation = torsoRot;
            Bone(Torso, hip, chest, 0.12f);
            Bone(Neck, chest, neckTop, 0.05f);
            helmet.localPosition = headC;
            helmet.localRotation = Quaternion.Euler(Mathf.Lerp(-10f, -25f, stand) + pitch * 0.4f, r.BodyAngle.Y * Mathf.Rad2Deg * 0.5f, 0f) ;

            // hands on the steered grips
            Quaternion steer = Quaternion.AngleAxis(sim.Front.SteerAngle * Mathf.Rad2Deg, sim.Front.AxisLocal.ToU());
            for (int s = 0; s < 2; s++)
            {
                float side = s == 0 ? -1f : 1f;
                Vector3 shoulder = chest + right * (0.19f * side) - up * 0.02f;
                Vector3 grip = head + steer * (barRel + new Vector3(0.35f * side, 0f, 0f));
                Vector3 elbow = SolveIK(shoulder, grip, 0.31f, 0.30f, right * side * 0.8f - up * 0.6f - Vector3.forward * 0.3f);
                Bone(s == 0 ? UpperArmL : UpperArmR, shoulder, elbow, 0.048f);
                Bone(s == 0 ? ForeArmL : ForeArmR, elbow, grip, 0.042f);
                transform.Find(s == 0 ? "GloveL" : "GloveR").localPosition = grip;

                Vector3 hipJ = hip + right * (0.10f * side);
                Vector3 foot = new Vector3(0.20f * side, peg.y + 0.04f, peg.z);
                Vector3 knee = SolveIK(hipJ, foot, 0.45f, 0.46f, Vector3.forward * 0.9f + Vector3.right * side * 0.35f);
                Bone(s == 0 ? ThighL : ThighR, hipJ, knee, 0.075f);
                Bone(s == 0 ? ShinL : ShinR, knee, foot, 0.058f);
                var boot = transform.Find(s == 0 ? "BootL" : "BootR");
                boot.localPosition = foot + Vector3.forward * 0.04f;
            }
        }
    }
}
