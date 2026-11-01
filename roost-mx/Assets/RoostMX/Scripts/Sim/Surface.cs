namespace RoostMX.Sim
{
    public enum SurfaceType { Hardpack = 0, LooseDirt = 1, Sand = 2, Grass = 3, Mud = 4 }

    /// <summary>
    /// How a ground surface interacts with a knobby tyre. Peak slips are larger on loose
    /// ground because the knobs have to dig before they bite; sliding retains more grip on
    /// dirt than on tarmac; sand adds a large rolling (ploughing) resistance.
    /// </summary>
    public struct SurfaceProps
    {
        public float Mu;              // peak friction coefficient
        public float SlipRatioPeak;   // longitudinal slip at peak force
        public float SlipAnglePeak;   // tan(slip angle) at peak lateral force
        public float SlideRetention;  // force at full slide / peak force (shape factor)
        public float RollingResistance;
        public float CamberThrust;    // lateral force per unit load per radian of camber

        public static SurfaceProps Get(SurfaceType t)
        {
            switch (t)
            {
                case SurfaceType.Hardpack:
                    return new SurfaceProps { Mu = 0.90f, SlipRatioPeak = 0.14f, SlipAnglePeak = 0.25f, SlideRetention = 0.86f, RollingResistance = 0.030f, CamberThrust = 0.75f };
                case SurfaceType.LooseDirt:
                    return new SurfaceProps { Mu = 0.80f, SlipRatioPeak = 0.20f, SlipAnglePeak = 0.30f, SlideRetention = 0.90f, RollingResistance = 0.055f, CamberThrust = 0.65f };
                case SurfaceType.Sand:
                    return new SurfaceProps { Mu = 0.68f, SlipRatioPeak = 0.30f, SlipAnglePeak = 0.38f, SlideRetention = 0.93f, RollingResistance = 0.13f, CamberThrust = 0.45f };
                case SurfaceType.Grass:
                    return new SurfaceProps { Mu = 0.62f, SlipRatioPeak = 0.16f, SlipAnglePeak = 0.26f, SlideRetention = 0.75f, RollingResistance = 0.045f, CamberThrust = 0.55f };
                default: // Mud
                    return new SurfaceProps { Mu = 0.48f, SlipRatioPeak = 0.25f, SlipAnglePeak = 0.34f, SlideRetention = 0.80f, RollingResistance = 0.10f, CamberThrust = 0.40f };
            }
        }
    }
}
