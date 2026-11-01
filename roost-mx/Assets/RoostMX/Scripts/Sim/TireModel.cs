using System;

namespace RoostMX.Sim
{
    /// <summary>
    /// Combined-slip tyre force model. Each slip is normalised by the surface's peak slip so
    /// that rho = |(kappa_n, alpha_n)| = 1 is the friction limit, then a Pacejka "magic
    /// formula" shape sin(C*atan(B*rho)) gives the total force, which is split back along
    /// the slip direction. This reproduces the behaviour that matters on a dirt bike:
    ///  - braking or spinning the wheel uses up grip that cornering needs (friction circle),
    ///  - past the peak the force drops (a locked front tucks, a spinning rear steps out),
    ///  - camber (lean) generates lateral thrust before any slip angle is needed.
    /// </summary>
    public static class TireModel
    {
        public struct Result
        {
            public float Fx, Fy;        // longitudinal (+ forward) and lateral (+ along tyre's lateral axis)
            public float Rho;           // combined normalised slip; > 1 means sliding
        }

        // Shape factor C from the slide retention: sin(C*pi/2) = retention.
        static float ShapeC(float retention)
        {
            retention = SimMath.Clamp(retention, 0.5f, 0.99f);
            return 2f - (float)(Math.Asin(retention) / (Math.PI / 2.0)); // C in (1, 1.67)
        }

        /// <param name="kappa">longitudinal slip ratio (relaxed), + when the tyre drives</param>
        /// <param name="tanAlpha">tan of the (relaxed) slip angle, + pushes along +lateral</param>
        /// <param name="camber">wheel inclination to the ground normal, rad, + pushes along +lateral</param>
        public static Result Evaluate(float fz, float kappa, float tanAlpha, float camber, in SurfaceProps s, float gripScale = 1f)
        {
            var r = new Result();
            if (fz <= 0f) return r;

            float C = ShapeC(s.SlideRetention);
            float B = (float)Math.Tan(Math.PI / (2.0 * C));      // peak exactly at rho = 1
            float slope = B * C;                                  // d(shape)/d(rho) at rho = 0
            float mu = s.Mu * gripScale;

            float kn = kappa / s.SlipRatioPeak;
            // camber thrust expressed as an equivalent normalised slip angle
            float camberEq = s.CamberThrust * camber / (mu * slope);
            float an = tanAlpha / s.SlipAnglePeak + camberEq;

            float rho = (float)Math.Sqrt(kn * kn + an * an);
            float g; // shape(rho) / rho
            if (rho < 1e-4f) g = slope;
            else g = (float)Math.Sin(C * Math.Atan(B * rho)) / rho;

            float f = mu * fz * g;
            r.Fx = f * kn;
            r.Fy = f * an;
            r.Rho = rho;
            return r;
        }
    }
}
