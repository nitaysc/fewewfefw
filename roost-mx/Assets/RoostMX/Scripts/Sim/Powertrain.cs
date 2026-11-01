using System;

namespace RoostMX.Sim
{
    /// <summary>Crankshaft state, torque curve, engine braking and rev limiter.</summary>
    public sealed class EngineSystem
    {
        public readonly EngineSpec Spec;
        public float Omega;            // crank rad/s
        public float ThrottleActual;   // after intake lag
        public bool LimiterCut;
        public float LastTorque;       // net crank torque produced by combustion/friction
        public bool Stalled;

        public const float RpmToRad = (float)(2.0 * Math.PI / 60.0);
        public float Rpm => Omega / RpmToRad;

        public EngineSystem(EngineSpec spec)
        {
            Spec = spec;
            Omega = spec.IdleRpm * RpmToRad;
        }

        /// <summary>Net torque on the crank for this substep (before the clutch).</summary>
        public float ComputeTorque(float throttleCmd, float dt, bool torqueCut)
        {
            ThrottleActual += (throttleCmd - ThrottleActual) * SimMath.LagFactor(dt, Spec.ThrottleResponse);
            float rpm = Rpm;

            // Rev limiter with hysteresis: cuts ignition, which is what makes it "bounce".
            if (rpm > Spec.RevLimit) LimiterCut = true;
            else if (rpm < Spec.RevLimit - 250f) LimiterCut = false;

            // Idle control: the idle circuit opens the throttle a little below idle rpm.
            float idleOpen = SimMath.Clamp01((Spec.IdleRpm + 150f - rpm) / 600f) * 0.22f;
            float thr = Math.Max(ThrottleActual, idleOpen);

            float full = SimMath.Curve(Spec.RpmPoints, Spec.TorquePoints, rpm);
            // Part-throttle: torque rises quickly with opening (small throttle bodies on MX bikes).
            float shape = (float)Math.Pow(thr, 0.75);
            float combustion = (LimiterCut || torqueCut || Stalled) ? 0f : full * shape;
            // Pumping + friction losses, largest with the throttle closed: engine braking.
            float friction = (Spec.FrictionTorque + Spec.FrictionPerKRpm * rpm * 0.001f) * (1f - 0.85f * thr);
            if (Omega <= 0f) friction = 0f;
            LastTorque = combustion - friction;
            return LastTorque;
        }
    }

    public sealed class GearboxSystem
    {
        readonly BikeSpec spec;
        public int Gear = 1;           // 0 = neutral
        public float ShiftTimer;       // > 0 while a shift interrupts drive
        int pendingGear = -1;

        public GearboxSystem(BikeSpec s) { spec = s; }
        public float Ratio => spec.GearTotal(Gear);
        public bool Shifting => ShiftTimer > 0f;

        public void RequestShift(int delta)
        {
            int target = Math.Max(0, Math.Min(spec.GearCount, Gear + delta));
            if (target == Gear || Shifting) return;
            pendingGear = target;
            ShiftTimer = spec.ShiftTime;
        }

        public void Update(float dt)
        {
            if (ShiftTimer <= 0f) return;
            ShiftTimer -= dt;
            // the dogs engage halfway through the interruption
            if (pendingGear >= 0 && ShiftTimer < spec.ShiftTime * 0.5f) { Gear = pendingGear; pendingGear = -1; }
            if (ShiftTimer <= 0f) ShiftTimer = 0f;
        }
    }

    /// <summary>
    /// Friction clutch between crank and gearbox. Each substep it transmits whatever torque
    /// would lock the two sides together, limited by its capacity (lever position).
    /// </summary>
    public sealed class ClutchSystem
    {
        public float Engagement = 1f;   // 0 = lever pulled in, 1 = fully engaged
        public float LastTorque;        // crank-side torque transmitted
        public bool Slipping;

        public float Solve(float omegaEngine, float engineTorque, float engineInertia,
                           float omegaWheel, float wheelTorque, float wheelInertia,
                           float ratio, float capacity, float dt)
        {
            if (ratio <= 0f || capacity <= 0f) { LastTorque = 0f; Slipping = ratio > 0f; return 0f; }
            // predicted speeds without clutch torque
            float we = omegaEngine + dt * engineTorque / engineInertia;
            float ww = omegaWheel + dt * wheelTorque / wheelInertia;
            float slip = we - ww * ratio;
            float invI = 1f / engineInertia + ratio * ratio / wheelInertia;
            float lockTorque = slip / (dt * invI);
            float t = SimMath.Clamp(lockTorque, -capacity, capacity);
            Slipping = Math.Abs(lockTorque) > capacity;
            LastTorque = t;
            return t;
        }
    }
}
