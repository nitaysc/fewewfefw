using System;
using System.Numerics;
using RoostMX.Sim;

namespace RoostMX.Tests
{
    /// <summary>dotnet run -c Release -- tune : sweeps lean-controller gains (dev tool).</summary>
    public static class Tune
    {
        public static void Run()
        {
            foreach (float kp in new[] { 20f, 28f, 38f, 50f })
            foreach (float kd in new[] { 3f, 5f, 7f })
            {
                BikeSim.LeanKp = kp; BikeSim.LeanKd = kd;
                float worstOver = 0, worstRise = 0; bool crash = false;
                foreach (float v in new[] { 6f, 12f, 20f })
                {
                    var r = new TestRig(BikeSpec.Create450F(), HeightfieldGround.Flat(), Vector3.Zero, Vector3.UnitZ, v);
                    float rise = -1, peak = 0;
                    for (int i = 0; i < 200 * 3; i++)
                    {
                        float thr = SimMath.Clamp01(0.35f + (v - r.Sim.Speed) * 0.3f);
                        r.Step(new BikeInput { Throttle = thr, Steer = 0.75f });
                        float t = r.Sim.TargetLean;
                        if (rise < 0 && r.Sim.Lean > 0.9f * t) rise = r.Time;
                        peak = Math.Max(peak, r.Sim.Lean / t);
                        if (r.Sim.Crashed) crash = true;
                    }
                    Console.Write($"  v{v}: rise {rise:F2} over {(peak - 1) * 100:F0}% end {r.Sim.Lean * SimMath.Rad2Deg:F1}/{r.Sim.TargetLean * SimMath.Rad2Deg:F1}");
                    worstOver = Math.Max(worstOver, peak - 1f);
                    worstRise = Math.Max(worstRise, rise < 0 ? 9f : rise);
                }
                Console.WriteLine($"kp {kp,4} kd {kd,4}: rise90 {worstRise:F2}s overshoot {worstOver * 100:F0}% {(crash ? "CRASH" : "")}");
            }
        }
    }
}
