using RoostMX.Sim;
using UnityEngine;

namespace RoostMX.Game
{
    /// <summary>
    /// Stage 1 PLACEHOLDER motorcycle, built from procedural meshes so the project runs with no
    /// imported art. Every moving part is driven by the simulation state: steering assembly,
    /// fork lowers sliding with compression, wheels spinning at their simulated speed,
    /// swingarm and shock following the rear hub. Stage 4 swaps the meshes for a licensed,
    /// detailed model; the bone names below are the integration points.
    /// </summary>
    public sealed class BikeVisual : MonoBehaviour
    {
        BikeSim sim;
        BikeSpec spec;
        Transform steerAssembly, forkLowers, frontWheel, rearWheel, swingarm, shockBody, shockShaft, chain;
        Vector3 shockFrameMount;
        float steerPivotHeight;

        public struct Palette
        {
            public Color Plastic, PlasticDark, Frame, Seat, Graphic;
        }

        public static Palette PaletteFor(string bike) => bike == "250F"
            ? new Palette { Plastic = new Color(0.10f, 0.32f, 0.80f), PlasticDark = new Color(0.06f, 0.10f, 0.22f), Frame = new Color(0.12f, 0.13f, 0.15f), Seat = new Color(0.07f, 0.08f, 0.10f), Graphic = new Color(0.95f, 0.95f, 0.97f) }
            : new Palette { Plastic = new Color(0.92f, 0.36f, 0.06f), PlasticDark = new Color(0.12f, 0.12f, 0.13f), Frame = new Color(0.70f, 0.32f, 0.08f), Seat = new Color(0.08f, 0.08f, 0.09f), Graphic = new Color(0.97f, 0.97f, 0.97f) };

        public void Build(BikeSim simulation, Palette pal)
        {
            sim = simulation; spec = sim.Spec;
            foreach (Transform c in transform) if (c.name == "Visual") Destroy(c.gameObject);
            var root = new GameObject("Visual").transform;
            root.SetParent(transform, false);

            var plastic = MaterialLibrary.Lit(pal.Plastic, 0.55f);
            var dark = MaterialLibrary.Lit(pal.PlasticDark, 0.4f);
            var frameM = MaterialLibrary.Lit(pal.Frame, 0.6f, 0.6f);
            var alu = MaterialLibrary.Lit(new Color(0.72f, 0.73f, 0.75f), 0.7f, 0.9f);
            var anod = MaterialLibrary.Lit(new Color(0.85f, 0.62f, 0.15f), 0.75f, 0.9f);
            var rubber = MaterialLibrary.Lit(new Color(0.06f, 0.06f, 0.06f), 0.15f);
            var seatM = MaterialLibrary.Lit(pal.Seat, 0.25f);
            var engineM = MaterialLibrary.Lit(new Color(0.22f, 0.22f, 0.24f), 0.45f, 0.7f);
            var pipeM = MaterialLibrary.Lit(new Color(0.55f, 0.45f, 0.38f), 0.6f, 0.95f);
            var white = MaterialLibrary.Lit(pal.Graphic, 0.5f);

            Vector3 rearAxle = spec.RearAxleAtSag.ToU(), frontAxle = spec.FrontAxleAtSag.ToU();
            Vector3 pivot = spec.SwingarmPivot.ToU();
            Vector3 forkAxis = sim.Front.AxisLocal.ToU();
            Vector3 peg = spec.PegPoint.ToU(), seat = spec.SeatPoint.ToU(), barPoint = spec.BarPoint.ToU();
            // steering head: up the fork axis from the front axle
            Vector3 head = frontAxle + forkAxis * 0.78f - new Vector3(0f, 0f, 0.055f);
            steerPivotHeight = 0.78f;

            // ---------------- frame (rigid with the chassis) ----------------
            var fb = new MeshBuilder();
            Vector3 headLow = head - forkAxis * 0.16f;
            Vector3 pegMount = new Vector3(0f, peg.y + 0.06f, peg.z + 0.05f);
            Vector3 seatRailEnd = new Vector3(0f, seat.y - 0.02f, rearAxle.z + 0.05f);
            foreach (float side in new[] { -1f, 1f })
            {
                Vector3 s = new Vector3(side * 0.11f, 0f, 0f);
                fb.Tube(head + s * 0.3f, new Vector3(side * 0.13f, 0.12f, -0.10f), 0.022f);           // main spar
                fb.Tube(new Vector3(side * 0.13f, 0.12f, -0.10f), pivot + s * 1.0f + new Vector3(0, 0.05f, 0), 0.022f);
                fb.Tube(headLow + s * 0.25f, new Vector3(side * 0.09f, -0.24f, 0.22f), 0.017f);       // down tubes
                fb.Tube(new Vector3(side * 0.09f, -0.24f, 0.22f), pegMount + s * 0.85f, 0.017f);      // cradle
                fb.Tube(pegMount + s * 0.85f, pivot + s * 1.0f, 0.017f);
                fb.Tube(new Vector3(side * 0.12f, 0.15f, -0.15f), seatRailEnd + s * 0.7f, 0.012f);    // subframe
                fb.Tube(pivot + s * 1.0f + new Vector3(0, 0.06f, 0), seatRailEnd + s * 0.7f, 0.011f);
                // foot pegs
                fb.Box(new Vector3(side * 0.20f, peg.y, peg.z), new Vector3(0.05f, 0.012f, 0.025f), Quaternion.identity);
            }
            fb.Tube(head + forkAxis * 0.06f, head - forkAxis * 0.18f, 0.028f);                         // head tube
            MeshBuilder.Part("Frame", root, fb.Build("frame"), frameM);

            // engine, radiators, airbox
            var eb = new MeshBuilder();
            eb.Box(new Vector3(0f, -0.13f, 0.02f), new Vector3(0.105f, 0.13f, 0.16f), Quaternion.Euler(-8f, 0, 0));     // cases
            eb.Box(new Vector3(0f, 0.05f, 0.08f), new Vector3(0.07f, 0.11f, 0.08f), Quaternion.Euler(-20f, 0, 0));      // cylinder + head
            eb.Tube(new Vector3(-0.11f, -0.13f, 0.02f), new Vector3(-0.13f, -0.13f, 0.02f), 0.075f, -1f, 16);           // clutch cover
            eb.Tube(new Vector3(0.11f, -0.15f, -0.04f), new Vector3(0.13f, -0.15f, -0.04f), 0.06f, -1f, 16);            // ignition cover
            MeshBuilder.Part("Engine", root, eb.Build("engine"), engineM);
            var rb = new MeshBuilder();
            foreach (float side in new[] { -1f, 1f })
                rb.Box(new Vector3(side * 0.15f, 0.12f, 0.24f), new Vector3(0.025f, 0.12f, 0.08f), Quaternion.Euler(0, 0, side * 6f));
            MeshBuilder.Part("Radiators", root, rb.Build("radiators"), alu);

            // plastics: tank/shrouds, side panels, rear fender, seat
            var pb = new MeshBuilder();
            pb.Box(new Vector3(0f, 0.28f, 0.10f), new Vector3(0.12f, 0.07f, 0.16f), Quaternion.Euler(-6f, 0, 0));         // tank
            foreach (float side in new[] { -1f, 1f })
            {
                pb.Box(new Vector3(side * 0.165f, 0.20f, 0.22f), new Vector3(0.012f, 0.14f, 0.14f), Quaternion.Euler(-28f, side * -8f, 0));   // shrouds
                pb.Box(new Vector3(side * 0.13f, 0.20f, -0.34f), new Vector3(0.012f, 0.09f, 0.20f), Quaternion.Euler(-6f, side * 4f, 0));     // number boards
            }
            pb.Box(new Vector3(0f, 0.30f, -0.62f), new Vector3(0.11f, 0.012f, 0.30f), Quaternion.Euler(10f, 0, 0));      // rear fender
            MeshBuilder.Part("Plastics", root, pb.Build("plastics"), plastic);
            var gb = new MeshBuilder();
            foreach (float side in new[] { -1f, 1f })
                gb.Box(new Vector3(side * 0.143f, 0.21f, -0.34f), new Vector3(0.002f, 0.06f, 0.11f), Quaternion.Euler(-6f, side * 4f, 0)); // plate field
            MeshBuilder.Part("PlateFields", root, gb.Build("plates"), white);
            var sb = new MeshBuilder();
            sb.Box(new Vector3(0f, seat.y + 0.005f, -0.16f), new Vector3(0.09f, 0.035f, 0.36f), Quaternion.Euler(2f, 0, 0));
            MeshBuilder.Part("Seat", root, sb.Build("seat"), seatM);

            // exhaust
            var xb = new MeshBuilder();
            Vector3 port = new Vector3(0.03f, 0.05f, 0.17f);
            Vector3 p1 = new Vector3(0.12f, -0.05f, 0.26f), p2 = new Vector3(0.16f, -0.10f, 0.02f), p3 = new Vector3(0.15f, 0.12f, -0.30f);
            xb.Tube(port, p1, 0.022f); xb.Tube(p1, p2, 0.024f); xb.Tube(p2, p3, 0.026f);
            MeshBuilder.Part("Header", root, xb.Build("header"), pipeM);
            var mb = new MeshBuilder();
            mb.Tube(p3, new Vector3(0.15f, 0.24f, -0.72f), 0.05f, 0.045f, 14);
            MeshBuilder.Part("Muffler", root, mb.Build("muffler"), alu);

            // ---------------- steering assembly ----------------
            steerAssembly = new GameObject("SteerAssembly").transform;
            steerAssembly.SetParent(root, false);
            var sa = new MeshBuilder();
            Vector3 up = forkAxis;
            // positions relative to the steering head (assembly origin), unsteered
            Vector3 clampTop = up * 0.05f + new Vector3(0, 0, 0.055f);
            Vector3 clampBot = -up * 0.17f + new Vector3(0, 0, 0.055f);
            foreach (float side in new[] { -1f, 1f })
                sa.Tube(clampTop + new Vector3(side * 0.09f, 0, 0), clampBot - up * 0.18f + new Vector3(side * 0.09f, 0, 0), 0.026f); // stanchions
            sa.Box(clampTop, new Vector3(0.12f, 0.012f, 0.035f), Quaternion.FromToRotation(Vector3.up, up));
            sa.Box(clampBot, new Vector3(0.12f, 0.016f, 0.04f), Quaternion.FromToRotation(Vector3.up, up));
            MeshBuilder.Part("Clamps", steerAssembly, sa.Build("clamps"), alu);
            var bars = new MeshBuilder();
            Vector3 barC = barPoint - head;
            bars.Tube(barC + new Vector3(-0.40f, 0.02f, -0.03f), barC + new Vector3(0.40f, 0.02f, -0.03f), 0.012f, -1f, 8);
            bars.Tube(clampTop, barC, 0.014f);
            MeshBuilder.Part("Bars", steerAssembly, bars.Build("bars"), anod);
            var grips = new MeshBuilder();
            foreach (float side in new[] { -1f, 1f })
                grips.Tube(barC + new Vector3(side * 0.30f, 0.02f, -0.03f), barC + new Vector3(side * 0.41f, 0.02f, -0.03f), 0.017f, -1f, 8);
            MeshBuilder.Part("Grips", steerAssembly, grips.Build("grips"), rubber);
            var ff = new MeshBuilder();
            ff.Box(clampBot - up * 0.05f + new Vector3(0, 0, 0.18f), new Vector3(0.075f, 0.01f, 0.24f), Quaternion.FromToRotation(Vector3.up, up) * Quaternion.Euler(14f, 0, 0)); // fender
            ff.Box(clampTop + new Vector3(0, -0.02f, 0.12f), new Vector3(0.12f, 0.10f, 0.01f), Quaternion.Euler(-18f, 0, 0)); // number plate
            MeshBuilder.Part("FrontPlastics", steerAssembly, ff.Build("frontplastics"), plastic);
            steerAssembly.localPosition = head;

            // fork lowers + front wheel (positioned from the simulated hub every frame)
            forkLowers = new GameObject("ForkLowers").transform;
            forkLowers.SetParent(root, false);
            var fl = new MeshBuilder();
            foreach (float side in new[] { -1f, 1f })
                fl.Tube(new Vector3(side * 0.09f, 0.03f, -0.01f), new Vector3(side * 0.09f, 0.40f, -0.01f), 0.031f);
            MeshBuilder.Part("Lowers", forkLowers, fl.Build("lowers"), MaterialLibrary.Lit(new Color(0.15f, 0.15f, 0.17f), 0.6f, 0.5f));
            frontWheel = BuildWheel("FrontWheel", forkLowers, spec.Front, rubber, alu, anod, true);

            // swingarm, rear wheel, shock, chain
            swingarm = new GameObject("Swingarm").transform;
            swingarm.SetParent(root, false);
            swingarm.localPosition = pivot;
            var sw = new MeshBuilder();
            float armLen = (rearAxle - pivot).magnitude;
            foreach (float side in new[] { -1f, 1f })
                sw.Box(new Vector3(side * 0.085f, 0f, armLen * 0.5f), new Vector3(0.018f, 0.035f, armLen * 0.5f), Quaternion.identity);
            sw.Box(new Vector3(0, 0, 0.10f), new Vector3(0.085f, 0.03f, 0.03f), Quaternion.identity);
            MeshBuilder.Part("Arm", swingarm, sw.Build("swingarm"), alu);
            rearWheel = BuildWheel("RearWheel", root, spec.Rear, rubber, alu, anod, false);
            shockFrameMount = new Vector3(0f, 0.15f, -0.18f);
            shockBody = MeshBuilder.Part("ShockBody", root, new MeshBuilder().Tube(Vector3.zero, Vector3.forward * 0.2f, 0.03f, -1f, 12).Build("shock"), MaterialLibrary.Lit(new Color(0.9f, 0.75f, 0.1f), 0.5f, 0.3f)).transform;
            shockShaft = MeshBuilder.Part("ShockShaft", root, new MeshBuilder().Tube(Vector3.zero, Vector3.forward, 0.009f, -1f, 8).Build("shaft"), alu).transform;
            chain = MeshBuilder.Part("Chain", root, new MeshBuilder().Box(new Vector3(0, 0, 0.5f), new Vector3(0.006f, 0.008f, 0.5f), Quaternion.identity).Build("chain"), engineM).transform;
            LateUpdate();
        }

        Transform BuildWheel(string name, Transform parent, WheelSpec w, Material rubber, Material alu, Material anod, bool front)
        {
            var t = new GameObject(name).transform;
            t.SetParent(parent, false);
            float r = w.Radius, cr = w.CrownRadius;
            var tyre = new MeshBuilder().Torus(r - cr, cr * 0.92f, 72, 10, 0.012f, front ? 34 : 30);
            MeshBuilder.Part("Tyre", t, tyre.Build("tyre"), rubber);
            float rimR = r - cr * 1.9f;
            MeshBuilder.Part("Rim", t, new MeshBuilder().Torus(rimR, 0.012f, 48, 6).Build("rim"), anod);
            var spokes = new MeshBuilder();
            for (int i = 0; i < 18; i++)
            {
                float a = i / 18f * Mathf.PI * 2f;
                float side = (i % 2 == 0) ? 0.04f : -0.04f;
                var outer = new Vector3(0, Mathf.Cos(a), Mathf.Sin(a)) * (rimR - 0.01f);
                var inner = new Vector3(side, Mathf.Cos(a + 0.5f), Mathf.Sin(a + 0.5f)) * 0.045f;
                inner.x = side;
                spokes.Tube(inner, outer, 0.0025f, -1f, 4, false);
            }
            spokes.Tube(new Vector3(-0.055f, 0, 0), new Vector3(0.055f, 0, 0), 0.04f, -1f, 12);
            MeshBuilder.Part("Spokes", t, spokes.Build("spokes"), alu);
            var disc = new MeshBuilder().Disc(new Vector3(front ? -0.06f : 0.06f, 0, 0), front ? 0.135f : 0.12f, 0.09f, 0.004f, 28);
            MeshBuilder.Part("Rotor", t, disc.Build("rotor"), alu);
            return t;
        }

        void LateUpdate()
        {
            if (sim == null) return;
            // steering assembly turns about the fork axis
            Quaternion steer = Quaternion.AngleAxis(sim.Front.SteerAngle * Mathf.Rad2Deg, Conv.U(sim.Front.AxisLocal));
            steerAssembly.localRotation = steer;

            // front: lowers and wheel at the simulated hub, sliding along the (steered) fork
            Vector3 hubF = Conv.U(sim.Front.HubLocal);
            Vector3 axisF = Conv.U(sim.Front.AxisLocal);
            forkLowers.localPosition = hubF;
            forkLowers.localRotation = steer * Quaternion.FromToRotation(Vector3.up, axisF);
            frontWheel.localPosition = Vector3.zero;
            frontWheel.localRotation = Quaternion.Inverse(Quaternion.FromToRotation(Vector3.up, axisF)) * Quaternion.AngleAxis(sim.Front.SpinAngle * Mathf.Rad2Deg, Vector3.right);

            // rear: swingarm points at the hub, wheel spins
            Vector3 hubR = Conv.U(sim.Rear.HubLocal);
            Vector3 arm = hubR - spec.SwingarmPivot.ToU();
            swingarm.localRotation = Quaternion.LookRotation(arm.normalized, Vector3.up);
            rearWheel.localPosition = hubR;
            rearWheel.localRotation = Quaternion.AngleAxis(sim.Rear.SpinAngle * Mathf.Rad2Deg, Vector3.right);

            // shock between the frame and a point on the swingarm
            Vector3 armMount = spec.SwingarmPivot.ToU() + arm * 0.32f + Vector3.up * 0.03f;
            Vector3 d = armMount - shockFrameMount;
            shockBody.localPosition = shockFrameMount;
            shockBody.localRotation = Quaternion.LookRotation(d.normalized, Vector3.forward);
            shockShaft.localPosition = shockFrameMount;
            shockShaft.localRotation = shockBody.localRotation;
            shockShaft.localScale = new Vector3(1f, 1f, d.magnitude);

            // chain from the countershaft to the rear sprocket
            Vector3 cs = new Vector3(-0.10f, -0.12f, -0.06f), sp = hubR + new Vector3(-0.10f, 0f, 0f);
            chain.localPosition = cs;
            chain.localRotation = Quaternion.LookRotation((sp - cs).normalized, Vector3.up);
            chain.localScale = new Vector3(1f, 1f, (sp - cs).magnitude);
        }
    }

    public static class VecExt
    {
        public static Vector3 ToU(this System.Numerics.Vector3 v) => new Vector3(v.X, v.Y, v.Z);
    }
}
