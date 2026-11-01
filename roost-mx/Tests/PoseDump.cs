using System;
using System.Globalization;
using System.IO;
using System.Numerics;
using System.Text;
using RoostMX.Sim;
using RoostMX.Sim.Track;

namespace RoostMX.Tests
{
    /// <summary>
    /// dotnet run -c Release -- pose : simulates a few riding moments and writes the state the
    /// Unity visuals read (hubs, steer, spin, rider mass, torso, orientation) to out/poses.json,
    /// for tools/preview (a browser render of the placeholder bike and rider).
    /// </summary>
    public static class PoseDump
    {
        static string F(float v) => v.ToString("0.#####", CultureInfo.InvariantCulture);
        static string V(Vector3 v) => $"[{F(v.X)},{F(v.Y)},{F(v.Z)}]";
        static string Q(Quaternion q) => $"[{F(q.X)},{F(q.Y)},{F(q.Z)},{F(q.W)}]";

        static string Pose(string name, TestRig r)
        {
            var s = r.Sim; var qi = Quaternion.Inverse(r.Body.Rotation);
            Vector3 riderLocal = Vector3.Transform(s.Rider.Position - r.Body.Position, qi);
            return "{" + $"\"name\":\"{name}\",\"bike\":\"{s.Spec.Name}\",\"rot\":{Q(r.Body.Rotation)}," +
                $"\"frontHub\":{V(s.Front.HubLocal)},\"frontAxis\":{V(s.Front.AxisLocal)},\"steer\":{F(s.Front.SteerAngle)}," +
                $"\"rearHub\":{V(s.Rear.HubLocal)},\"spinF\":{F(s.Front.SpinAngle)},\"spinR\":{F(s.Rear.SpinAngle)}," +
                $"\"rider\":{V(riderLocal)},\"body\":{V(s.Rider.BodyAngle)},\"standing\":{F(s.Rider.Standing)}," +
                $"\"pos\":{V(r.Body.Position)},\"lean\":{F(s.Lean)},\"pitch\":{F(s.Pitch)},\"speed\":{F(s.Speed)}" + "}";
        }

        static string Spec(BikeSpec s) =>
            "{" + $"\"frontAxle\":{V(s.FrontAxleAtSag)},\"rearAxle\":{V(s.RearAxleAtSag)},\"pivot\":{V(s.SwingarmPivot)}," +
            $"\"peg\":{V(s.PegPoint)},\"seat\":{V(s.SeatPoint)},\"bar\":{V(s.BarPoint)}," +
            $"\"rF\":{F(s.Front.Radius)},\"crF\":{F(s.Front.CrownRadius)},\"rR\":{F(s.Rear.Radius)},\"crR\":{F(s.Rear.CrownRadius)}" + "}";

        public static void Run()
        {
            var sb = new StringBuilder("{\"poses\":[");
            var spec = BikeSpec.Create450F();
            var flat = HeightfieldGround.Flat();

            var a = new TestRig(spec, flat, Vector3.Zero, Vector3.UnitZ);
            for (int i = 0; i < 400; i++) a.Step(new BikeInput());
            sb.Append(Pose("Parked, seated", a)).Append(',');

            var b = new TestRig(spec, flat, Vector3.Zero, Vector3.UnitZ, 12f);
            for (int i = 0; i < 200 * 4; i++) b.Step(new BikeInput { Throttle = SimMath.Clamp01(0.4f + (12f - b.Sim.Speed) * 0.3f), Steer = -0.8f, Stand = true, RiderForeAft = 0.6f });
            sb.Append(Pose("Standing, leaned into a left turn", b)).Append(',');

            var c = new TestRig(spec, flat, Vector3.Zero, Vector3.UnitZ, 4f);
            for (int i = 0; i < 200 * 2; i++) c.Step(new BikeInput { Throttle = 1f, RiderForeAft = -1f });
            sb.Append(Pose("Seated back, wheelie on the gas", c)).Append(',');

            var f = new TrackFeature { Kind = FeatureKind.Tabletop, S = 30f, Height = 2.2f, Face = 7f, Top = 10f, Land = 12f };
            var g = new HeightfieldGround((x, z) => f.Profile(z - f.S),
                (x, z) => { float e = 0.05f; float d = (f.Profile(z + e - f.S) - f.Profile(z - e - f.S)) / (2 * e); return Vector3.Normalize(new Vector3(0, 1, -d)); },
                (x, z) => SurfaceType.Hardpack);
            var d2 = new TestRig(spec, g, Vector3.Zero, Vector3.UnitZ, TrackPilot.JumpSpeed(f));
            for (int i = 0; i < 200 * 7; i++)
            {
                var inp = new BikeInput { Throttle = 0.6f, Stand = true };
                if (d2.Sim.Airborne) inp.RiderForeAft = -0.6f;
                d2.Step(inp);
                if (d2.Sim.Airborne && d2.Sim.AirTime > 0.3f) break;
            }
            sb.Append(Pose("Airborne off the tabletop", d2));
            sb.Append("],\"spec\":").Append(Spec(spec)).Append('}');
            Directory.CreateDirectory("out");
            File.WriteAllText("out/poses.json", sb.ToString());
            Console.WriteLine("wrote out/poses.json");
        }
    }
}
