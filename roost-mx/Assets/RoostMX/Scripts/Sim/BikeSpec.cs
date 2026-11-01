using System.Numerics;

namespace RoostMX.Sim
{
    /// <summary>
    /// Every number that defines a motorcycle. All positions are in the chassis frame:
    /// origin at the bike's own centre of mass (without rider), measured with the bike
    /// sitting at static "race sag" with a seated 75 kg rider. Units: SI (m, kg, N, s, rad).
    /// </summary>
    public sealed class BikeSpec
    {
        public string Name;

        // ---- chassis -------------------------------------------------------------
        public float Mass;                 // bike only, wet
        public Vector3 Inertia;            // principal (pitch X, yaw Y, roll Z) about the bike CoM
        public float DragArea;             // Cd*A of bike+rider, m^2
        public Vector3 ChassisColliderCenter;
        public Vector3 ChassisColliderSize;

        // ---- geometry --------------------------------------------------------------
        public Vector3 FrontAxleAtSag;
        public Vector3 RearAxleAtSag;
        public float RakeRad;              // steering axis angle from vertical
        public float ForkOffset;           // perpendicular distance steering axis -> front axle
        public float MaxSteerRad;
        public float MaxSteerRateRad;      // how fast a rider can turn the bars
        public Vector3 SwingarmPivot;
        public Vector3 SeatPoint, PegPoint, BarPoint;  // for rider attachment and IK visuals

        // ---- wheels & suspension ------------------------------------------------------
        public WheelSpec Front, Rear;

        // ---- engine & drivetrain ----------------------------------------------------
        public EngineSpec Engine;
        public float PrimaryRatio;
        public float[] GearRatios;
        public float FinalRatio;
        public float ShiftTime;            // torque interruption on a shift, s
        public float ClutchMaxTorque;      // crank-side capacity when fully engaged, N*m
        public float FrontBrakeTorque;     // at the wheel, full lever
        public float RearBrakeTorque;

        // ---- rider -------------------------------------------------------------------
        public RiderSpec Rider;

        public float Wheelbase => FrontAxleAtSag.Z - RearAxleAtSag.Z;
        /// <summary>Mass carried by the chassis rigid body (the wheels are simulated separately).</summary>
        public float SprungMass => Mass - Front.UnsprungMass - Rear.UnsprungMass;
        public float GearTotal(int gear) => gear <= 0 ? 0f : PrimaryRatio * GearRatios[gear - 1] * FinalRatio;
        public int GearCount => GearRatios.Length;

        // Shared by both presets: a modern full-size motocross chassis.
        static BikeSpec BaseChassis()
        {
            var s = new BikeSpec();
            s.DragArea = 0.55f;
            s.RakeRad = 27f * SimMath.Deg2Rad;
            s.ForkOffset = 0.055f;          // gives ~114 mm trail with the 21" front
            s.MaxSteerRad = 38f * SimMath.Deg2Rad;
            s.MaxSteerRateRad = 4.5f;
            s.FrontAxleAtSag = new Vector3(0f, -0.270f, 0.694f);
            s.RearAxleAtSag = new Vector3(0f, -0.285f, -0.786f);
            s.SwingarmPivot = new Vector3(0f, -0.150f, -0.205f);
            s.SeatPoint = new Vector3(0f, 0.330f, -0.200f);
            s.PegPoint = new Vector3(0f, -0.215f, -0.090f);
            s.BarPoint = new Vector3(0f, 0.445f, 0.430f);
            s.ChassisColliderCenter = new Vector3(0f, 0.05f, -0.02f);
            s.ChassisColliderSize = new Vector3(0.32f, 0.42f, 0.95f);
            s.ShiftTime = 0.075f;

            s.Front = new WheelSpec
            {
                Radius = 0.350f, CrownRadius = 0.055f, Inertia = 0.42f,
                RelaxLong = 0.12f, RelaxLat = 0.25f,
                Travel = 0.310f, SagCompression = 0.070f,
                SpringRate = 6300f, Preload = 0.020f, Progression = 1.6f,
                CompLow = 1150f, CompHigh = 650f, ReboundLow = 1350f, ReboundHigh = 900f, DampKnee = 0.45f,
                BumpStopStart = 0.27f, BumpStopRate = 160000f,
                TyreRate = 170000f, TyreDamping = 350f, UnsprungMass = 15f,
            };
            s.Rear = new WheelSpec
            {
                Radius = 0.335f, CrownRadius = 0.060f, Inertia = 0.62f,
                RelaxLong = 0.12f, RelaxLat = 0.25f,
                Travel = 0.315f, SagCompression = 0.105f,
                SpringRate = 5350f, Preload = 0.020f, Progression = 1.6f,
                CompLow = 1300f, CompHigh = 750f, ReboundLow = 1600f, ReboundHigh = 1050f, DampKnee = 0.45f,
                BumpStopStart = 0.275f, BumpStopRate = 160000f,
                TyreRate = 190000f, TyreDamping = 400f, UnsprungMass = 19f,
                // rear wheel moves on the swingarm arc: up and slightly back
                Axis = Vector3.Normalize(new Vector3(0f, 0.981f, -0.193f)),
            };
            s.Rider = RiderSpec.Default();
            return s;
        }

        /// <summary>450cc four-stroke: heavier, big low-end torque, strong engine braking.</summary>
        public static BikeSpec Create450F()
        {
            var s = BaseChassis();
            s.Name = "450F";
            s.Mass = 111f;
            s.Inertia = new Vector3(21f, 19f, 7.2f);
            s.Engine = new EngineSpec
            {
                RpmPoints = new float[] { 1500, 3000, 5000, 6500, 7500, 8500, 9500, 10500, 11000 },
                TorquePoints = new float[] { 24, 37, 45, 49, 50.5f, 48.5f, 44, 37, 33 },
                IdleRpm = 1800f, RevLimit = 11000f, StallRpm = 700f,
                Inertia = 0.0070f,
                FrictionTorque = 3.2f, FrictionPerKRpm = 1.05f,   // strong engine braking
                ThrottleResponse = 0.035f,
                SoundFiringOrder = 1,
            };
            s.PrimaryRatio = 2.652f;
            s.GearRatios = new float[] { 1.833f, 1.428f, 1.173f, 1.000f, 0.869f };
            s.FinalRatio = 52f / 13f;
            s.ClutchMaxTorque = 95f;
            s.FrontBrakeTorque = 640f;
            s.RearBrakeTorque = 400f;
            return s;
        }

        /// <summary>250cc four-stroke: lighter, revs much higher, little low-end, soft engine braking.</summary>
        public static BikeSpec Create250F()
        {
            var s = BaseChassis();
            s.Name = "250F";
            s.Mass = 104f;
            s.Inertia = new Vector3(19.5f, 17.5f, 6.6f);
            s.Engine = new EngineSpec
            {
                RpmPoints = new float[] { 2000, 4000, 6000, 8000, 9500, 10500, 11500, 12500, 13500, 14000 },
                TorquePoints = new float[] { 10, 15.5f, 19.5f, 23.5f, 25.8f, 27, 26.6f, 25, 22, 20 },
                IdleRpm = 2000f, RevLimit = 14000f, StallRpm = 800f,
                Inertia = 0.0045f,
                FrictionTorque = 1.6f, FrictionPerKRpm = 0.55f,
                ThrottleResponse = 0.025f,
                SoundFiringOrder = 1,
            };
            s.PrimaryRatio = 3.353f;
            s.GearRatios = new float[] { 2.142f, 1.750f, 1.444f, 1.200f, 1.042f };
            s.FinalRatio = 48f / 13f;
            s.ClutchMaxTorque = 55f;
            s.FrontBrakeTorque = 620f;
            s.RearBrakeTorque = 380f;
            // lighter bike + same rider: slightly softer springs for the same sag
            s.Front.SpringRate = 6100f;
            s.Rear.SpringRate = 5150f;
            return s;
        }
    }

    public sealed class WheelSpec
    {
        public float Radius;          // outer tyre radius
        public float CrownRadius;     // tyre cross-section radius (the "torus" tube)
        public float Inertia;         // spin inertia, kg*m^2
        public float RelaxLong, RelaxLat; // tyre relaxation lengths, m
        public float Travel;          // wheel travel, m
        public float SagCompression;  // compression at the reference (sag) geometry
        public float SpringRate;      // wheel rate, N/m
        public float Preload;         // m of spring preload at top-out
        public float Progression;     // extra stiffness at full travel (air volume / linkage)
        public float CompLow, CompHigh, ReboundLow, ReboundHigh; // N*s/m, below/above knee
        public float DampKnee;        // m/s where low-speed damping hands over to high-speed
        public float BumpStopStart;   // compression where the bottoming cone engages
        public float BumpStopRate;
        public float TyreRate;        // tyre carcass stiffness along the suspension axis, N/m
        public float TyreDamping;
        public float UnsprungMass;    // wheel, tyre, brake, fork lowers / swingarm share, kg
        public Vector3 Axis = Vector3.UnitY; // compression direction in chassis frame (front: fork axis, set at runtime)
    }

    public sealed class EngineSpec
    {
        public float[] RpmPoints, TorquePoints;  // full-throttle crank torque curve
        public float IdleRpm, RevLimit, StallRpm;
        public float Inertia;          // crank + flywheel + clutch basket, kg*m^2
        public float FrictionTorque;   // N*m of pumping/friction at zero rpm (closed throttle)
        public float FrictionPerKRpm;  // extra N*m per 1000 rpm
        public float ThrottleResponse; // s, intake/throttle-body lag
        public int SoundFiringOrder;
    }

    /// <summary>
    /// The rider is a separate 75 kg body: a point mass held to the bike by stiff-but-soft
    /// "legs and arms" (spring-dampers per chassis axis) plus a rotating torso. The rider's
    /// muscles move the targets; the bike feels the rider through those springs only.
    /// </summary>
    public sealed class RiderSpec
    {
        public float Mass;
        public Vector3 SitCom, StandCom;         // centre of mass targets, chassis frame
        public Vector3 SitStiffness, StandStiffness; // N/m along chassis X (lateral), Y, Z (fore-aft)
        public float DampingRatio;
        public float ForeAftReach, LateralReach, CrouchDepth; // how far the rider can move their CoM
        public Vector3 BodyInertia;              // pitch, yaw, roll of the torso about its own CoM
        public Vector3 BodyStiffness;            // N*m/rad, muscle stiffness of the torso joint
        public float BodyDampingRatio;
        public Vector3 BodyRange;                // max torso angles relative to bike, rad
        public float ThrowDistance;              // CoM separation that means the rider is off the bike

        public static RiderSpec Default() => new RiderSpec
        {
            Mass = 75f,
            SitCom = new Vector3(0f, 0.47f, -0.15f),
            StandCom = new Vector3(0f, 0.63f, -0.02f),
            SitStiffness = new Vector3(14000f, 38000f, 18000f),
            StandStiffness = new Vector3(9000f, 21000f, 11000f),
            DampingRatio = 0.75f,
            ForeAftReach = 0.24f, LateralReach = 0.20f, CrouchDepth = 0.16f,
            BodyInertia = new Vector3(9f, 5f, 9f),
            BodyStiffness = new Vector3(900f, 420f, 700f),
            BodyDampingRatio = 0.8f,
            BodyRange = new Vector3(0.55f, 0.65f, 0.45f),
            ThrowDistance = 0.75f,
        };
    }
}
