using System;
using System.Numerics;

namespace RoostMX.Sim
{
    /// <summary>
    /// One wheel: suspension (spring, progressive rate, digressive two-stage damping, bump
    /// stop, tyre carcass), ground contact and tyre slip state with relaxation lengths, and
    /// spin. The tyre is a torus: contact is found by sweeping a sphere the size of the
    /// tyre's cross-section from the point of the rim circle nearest the ground, so a leaned
    /// wheel touches down on its shoulder, not under the hub.
    /// </summary>
    public sealed class WheelSystem
    {
        public readonly WheelSpec Spec;
        public readonly bool IsFront;

        // suspension
        public float Compression;        // m, 0 = topped out
        public float CompressionVel;     // m/s, + compressing
        public float SpringForce;        // N along the suspension axis
        public bool Bottomed;

        // contact
        public bool InContact;
        public GroundHit Hit;
        public Vector3 ContactPoint, Normal, LongDir, LatDir;
        public float Load;               // tyre normal load, N
        public float Camber;             // rad
        public float Vx, Vy;             // contact patch velocity in the tyre frame
        public SurfaceProps Surface;
        public SurfaceType SurfaceType;

        // tyre slip state
        public float DeflLong, DeflLat;  // relaxation deflections, m
        public float SlipRatio, TanSlipAngle, Rho;
        public float Fx, Fy;             // averaged tyre forces of the last step
        float prevFx, prevFy;

        // spin
        public float Omega;              // rad/s, + rolling forward
        public float SpinAngle;          // for visuals
        public float SteerAngle;         // front only

        // geometry in chassis frame for the current steer angle
        public Vector3 HubLocal, AxleLocal, AxisLocal;
        readonly Vector3 extHub;         // hub at top-out, unsteered
        readonly Vector3 steerPivot;     // a point on the steering axis (front)
        readonly Vector3 offsetVec;      // perpendicular from steering axis to axle (front)

        public WheelSystem(WheelSpec spec, bool front, BikeSpec bike)
        {
            Spec = spec; IsFront = front;
            if (front)
            {
                float rk = bike.RakeRad;
                spec.Axis = new Vector3(0f, (float)Math.Cos(rk), -(float)Math.Sin(rk));
                var perp = new Vector3(0f, (float)Math.Sin(rk), (float)Math.Cos(rk)); // forward-up, normal to fork
                offsetVec = perp * bike.ForkOffset;
                Vector3 hubSag = bike.FrontAxleAtSag;
                steerPivot = hubSag - offsetVec - spec.Axis * spec.SagCompression;
                extHub = hubSag - spec.Axis * spec.SagCompression;
            }
            else
            {
                extHub = bike.RearAxleAtSag - spec.Axis * spec.SagCompression;
            }
            AxisLocal = spec.Axis;
            Compression = spec.SagCompression;
            UpdateGeometry();
        }

        public Vector3 HubAt(float compression)
        {
            if (!IsFront) return extHub + AxisLocal * compression;
            var q = SimMath.AngleAxis(SteerAngle, AxisLocal);
            return steerPivot + AxisLocal * compression + SimMath.Rotate(q, offsetVec);
        }

        void UpdateGeometry()
        {
            if (IsFront)
            {
                var q = SimMath.AngleAxis(SteerAngle, AxisLocal);
                AxleLocal = SimMath.Rotate(q, Vector3.UnitX);
            }
            else AxleLocal = Vector3.UnitX;
            HubLocal = HubAt(Compression);
        }

        // ground (from the cast): the compression at which the undeformed tyre would touch
        public bool HasGround;
        public float GroundComp, GroundCompVel;
        public float TyreDeflection;
        public float ChassisAxisForce;      // averaged force the suspension puts into the chassis
        float hubAccelAxis, prevHubVelAxis, groundVelFiltered;
        float upDotAxis;
        float sumAxis, sumLoad; int nSub;
        Vector3 axisWorld;

        /// <summary>
        /// Casts for the ground and prepares this step's contact frame. The wheel itself is a
        /// small mass (wheel, tyre, brake, fork legs / swingarm end) that moves along the
        /// suspension axis between the suspension spring-damper above and the tyre carcass
        /// spring below; it is integrated in SuspensionSubstep.
        /// </summary>
        public float LastStepDt = 1f / 200f;

        public void Probe(ISimBody body, IGroundProbe ground, float dt)
        {
            LastStepDt = dt;
            Quaternion q = body.Rotation;
            UpdateGeometry();
            Vector3 axisW = SimMath.Rotate(q, AxisLocal);
            Vector3 axleW = SimMath.Rotate(q, AxleLocal);
            axisWorld = axisW;
            upDotAxis = Vector3.Dot(SimMath.Up, axisW);

            Vector3 nGuess = HasGround ? Normal : SimMath.Up;
            Vector3 down = SimMath.SafeNormalize(-nGuess + axleW * Vector3.Dot(nGuess, axleW), -axisW);

            const float margin = 0.45f;   // start well above the tyre so a deep hit never begins inside the ground
            float rimOffset = Spec.Radius - Spec.CrownRadius;
            Vector3 hubTopW = body.Position + SimMath.Rotate(q, HubAt(Spec.Travel));
            Vector3 origin = hubTopW + axisW * margin + down * rimOffset;
            float castLen = Spec.Travel + margin;

            // chassis acceleration at the hub along the axis (the wheel lags behind it)
            Vector3 vHub = PointVelocity(body, hubTopW);
            float vAxis = Vector3.Dot(vHub, axisW);
            hubAccelAxis = SimMath.Clamp((vAxis - prevHubVelAxis) / dt, -400f, 400f);
            prevHubVelAxis = vAxis;

            bool had = HasGround;
            float prevGround = GroundComp;
            if (ground.SphereCast(origin, Spec.CrownRadius, -axisW, castLen + 0.02f, out var hit) && hit.Distance <= castLen)
            {
                HasGround = true;
                Hit = hit;
                Normal = hit.Normal;
                ContactPoint = hit.Point;
                SurfaceType = hit.Surface;
                Surface = SurfaceProps.Get(hit.Surface);
                GroundComp = Spec.Travel + margin - hit.Distance;
                // The tyre's contact patch averages out texture smaller than itself, so the
                // rate the ground pushes into the wheel is filtered (raw differences of the cast
                // over rough, triangulated ground would otherwise spike the carcass damping).
                float raw;
                if (had) raw = (GroundComp - prevGround) / dt;
                else
                {
                    float closing = -Vector3.Dot(vHub, Normal);
                    raw = closing / Math.Max(0.3f, Vector3.Dot(Normal, axisW));
                    groundVelFiltered = raw;
                }
                raw = SimMath.Clamp(raw, -12f, 12f);
                groundVelFiltered += (raw - groundVelFiltered) * SimMath.LagFactor(dt, 0.012f);
                GroundCompVel = groundVelFiltered;
            }
            else
            {
                HasGround = false;
                GroundComp = -1f; GroundCompVel = 0f;
            }
            InContact = HasGround && GroundComp - Compression > -0.01f;

            if (HasGround)
            {
                Vector3 n = Normal;
                LatDir = SimMath.SafeNormalize(SimMath.ProjectOnPlane(axleW, n), SimMath.Rotate(q, Vector3.UnitX));
                LongDir = Vector3.Normalize(Vector3.Cross(LatDir, n));   // forward along the ground
                if (Vector3.Dot(LongDir, SimMath.Rotate(q, Vector3.UnitZ)) < 0f) LongDir = -LongDir;
                // camber: + when the wheel leans toward +lateral (bike leaned right => thrust to the right)
                Camber = -(float)Math.Asin(SimMath.Clamp(Vector3.Dot(axleW, n), -1f, 1f));
                Vector3 vc = PointVelocity(body, ContactPoint);
                Vx = Vector3.Dot(vc, LongDir);
                Vy = Vector3.Dot(vc, LatDir);
            }
            else { Vx = Vy = 0f; }
            sumAxis = 0f; sumLoad = 0f; nSub = 0;
        }

        public float SuspensionForce(float s, float v)
        {
            float xr = s / Spec.Travel;
            float spring = Spec.SpringRate * (s + Spec.Preload) * (1f + Spec.Progression * xr * xr);
            float bump = s > Spec.BumpStopStart ? Spec.BumpStopRate * SimMath.Sqr(s - Spec.BumpStopStart) / (Spec.Travel - Spec.BumpStopStart) : 0f;
            float damper;
            if (v >= 0f)
                damper = v < Spec.DampKnee ? Spec.CompLow * v : Spec.CompLow * Spec.DampKnee + Spec.CompHigh * (v - Spec.DampKnee);
            else
            {
                float a = -v;
                damper = -(a < Spec.DampKnee ? Spec.ReboundLow * a : Spec.ReboundLow * Spec.DampKnee + Spec.ReboundHigh * (a - Spec.DampKnee));
            }
            return spring + bump + damper;
        }

        /// <summary>
        /// Integrates the unsprung mass for one substep (time tau into the step) and sets the
        /// tyre load used by the tyre model in the same substep.
        /// </summary>
        public void SuspensionSubstep(float h, float tau)
        {
            float g = HasGround ? GroundComp + GroundCompVel * (tau - LastStepDt) : -1f; // reaches the cast value at the end of the step
            float defl = HasGround ? g - Compression : -1f;
            float tyreAxis = 0f;
            if (defl > 0f)
                tyreAxis = Math.Max(0f, Spec.TyreRate * defl + Spec.TyreDamping * (GroundCompVel - CompressionVel));
            float fs = SuspensionForce(Compression, CompressionVel);
            float m = Spec.UnsprungMass;
            // wheel along the axis: tyre pushes up, suspension pushes down, gravity, and the
            // chassis accelerating away from (or into) the wheel
            float acc = (tyreAxis - fs) / m - SimMath.G * upDotAxis - hubAccelAxis;
            CompressionVel += acc * h;
            Compression += CompressionVel * h;
            float chassis = fs;
            if (Compression <= 0f)
            {
                // topped out: the stop holds the wheel, so the chassis only feels what the ground pushes
                Compression = 0f; if (CompressionVel < 0f) CompressionVel = 0f;
                chassis = Math.Min(fs, tyreAxis);
            }
            if (Compression >= Spec.Travel)
            {
                // metal-to-metal: what the tyre pushes goes straight into the chassis
                Compression = Spec.Travel;
                if (CompressionVel > 0f) CompressionVel = 0f;
                chassis = Math.Max(fs, tyreAxis);
            }
            TyreDeflection = Math.Max(0f, defl);

            // tyre normal load: the axis force carried through the tyre, less friction's share
            float nu = Math.Max(0.3f, Vector3.Dot(Normal, axisWorld));
            float fricAlongAxis = Vector3.Dot(LongDir * prevFx + LatDir * prevFy, axisWorld);
            Load = tyreAxis > 0f ? Math.Max(0f, (tyreAxis - fricAlongAxis) / nu) : 0f;
            sumAxis += Math.Max(0f, chassis); sumLoad += Load; nSub++;
        }

        public void FinishSuspension()
        {
            ChassisAxisForce = nSub > 0 ? sumAxis / nSub : 0f;
            Load = nSub > 0 ? sumLoad / nSub : 0f;
            SpringForce = ChassisAxisForce;
            InContact = HasGround && Load > 0f;
            Bottomed = Compression > Spec.BumpStopStart;
            HubLocal = HubAt(Compression);
            if (!InContact) { DeflLong *= 0.9f; DeflLat *= 0.9f; }
        }

        static Vector3 PointVelocity(ISimBody b, Vector3 p) => b.Velocity + Vector3.Cross(b.AngularVelocity, p - b.Position);

        /// <summary>
        /// One tyre substep: updates relaxation deflections and returns the tyre forces.
        /// </summary>
        public TireModel.Result TyreSubstep(float h, float gripScale)
        {
            if (!InContact || Load <= 0f)
            {
                DeflLong *= 1f - SimMath.LagFactor(h, 0.05f);
                DeflLat *= 1f - SimMath.LagFactor(h, 0.05f);
                SlipRatio = 0f; TanSlipAngle = 0f; Rho = 0f;
                return default;
            }
            float R = Spec.Radius;
            float absVx = Math.Abs(Vx);
            float vSlip = Omega * R - Vx;
            // relaxation: d(defl)/dt = slipVel - |Vx| * defl / sigma (exact exponential update)
            DeflLong = Relax(DeflLong, vSlip, absVx, Spec.RelaxLong, h);
            DeflLat = Relax(DeflLat, -Vy, absVx, Spec.RelaxLat, h);
            float maxLong = Spec.RelaxLong * 1.2f, maxLat = Spec.RelaxLat * 1.0f;
            DeflLong = SimMath.Clamp(DeflLong, -maxLong, maxLong);
            DeflLat = SimMath.Clamp(DeflLat, -maxLat, maxLat);
            SlipRatio = DeflLong / Spec.RelaxLong;
            TanSlipAngle = DeflLat / Spec.RelaxLat;

            var r = TireModel.Evaluate(Load, SlipRatio, TanSlipAngle, Camber, Surface, gripScale);
            Rho = r.Rho;
            // Near standstill the carcass spring would oscillate; the tread damps it.
            float low = 1f - SimMath.SmoothStep(0.5f, 3f, absVx);
            if (low > 0f)
            {
                r.Fx += low * 2.2f * Load * vSlip / Math.Max(1f, R * 3f);
                r.Fy += low * 2.2f * Load * -Vy;
                float cap = Surface.Mu * gripScale * Load;
                r.Fx = SimMath.Clamp(r.Fx, -cap, cap);
                r.Fy = SimMath.Clamp(r.Fy, -cap, cap);
            }
            return r;
        }

        static float Relax(float d, float slipVel, float absVx, float sigma, float h)
        {
            float k = absVx / sigma;
            if (k < 1e-4f) return d + slipVel * h;
            float ss = slipVel / k;           // steady-state deflection
            return ss + (d - ss) * (float)Math.Exp(-k * h);
        }

        public void FinishStep(float fxAvg, float fyAvg, float dt)
        {
            Fx = fxAvg; Fy = fyAvg;
            prevFx = fxAvg; prevFy = fyAvg;
            SpinAngle += Omega * dt;
            if (SpinAngle > 1000f || SpinAngle < -1000f) SpinAngle %= (float)(Math.PI * 2);
        }
    }
}
