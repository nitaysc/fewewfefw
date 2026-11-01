using System;
using System.IO;
using RoostMX.Sim.Track;

namespace RoostMX.Tests
{
    /// <summary>dotnet run -c Release -- map : writes out/track.bin (heights, splat, centreline) for tools/render_track.py.</summary>
    public static class MapDump
    {
        public static void Run()
        {
            var t = TrackLayout.CreateDefault();
            t.BuildFields();
            Directory.CreateDirectory("out");
            using var w = new BinaryWriter(File.Create("out/track.bin"));
            w.Write(t.Resolution); w.Write(t.Size);
            foreach (var h in t.Heights) w.Write(h);
            foreach (var s in t.Splat) w.Write(s);
            w.Write(t.Points.Length);
            for (int i = 0; i < t.Points.Length; i++) { w.Write(t.Points[i].X); w.Write(t.Points[i].Z); w.Write(t.Dist[i]); w.Write(t.Bank[i]); w.Write(t.FeatureHeight(t.Dist[i])); }
            Console.WriteLine($"wrote out/track.bin, length {t.Length:F0} m");
        }
    }
}
