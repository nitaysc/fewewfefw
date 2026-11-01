using System;
using System.Numerics;

namespace RoostMX.Sim
{
    /// <summary>
    /// The complete motorcycle + rider simulation. Call Step once per physics tick; it adds
    /// forces/torques to the chassis body and advances its own internal states (wheel spin,
    /// tyre slip, engine, clutch, gearbox, suspension, rider). The owner then integrates the
    /// body (Unity's PhysX, or the test integrator).
    /// </summary>
    public sealed class BikeSim
    {
        public readonly BikeSpec Spec;
        public readonly WheelSystem Front, Rear;
        public readonly EngineSystem Engine;
        public readonly GearboxSystem Gearbox;
        public readonly ClutchSystem Clutch = new ClutchSystem();
        public readonly RiderBody Rider;
        public readonly Assists Assists = new Assists();
        public int Substeps = 4;

        // ---- telemetry / state read by visuals, audio, HUD ----
        public float Speed;          // m/s along heading
        public float Lean;           // rad, + right
        public float LeanRate;
        public float TargetLean;
        public float Pitch;          // rad, + nose up
        public bool Airborne;
        public float AirTime;
        public bool Crashed;
        public string CrashReason = "";
        public bool StandingCmd;
        public BikeInput LastInput;
        public float FrontBrakeCmd, RearBrakeCmd, ThrottleCmd;
        public float WheelieAmount;  // 0..1 front-wheel-up indicator

        float shiftCooldown, thrForShift;
        float stallTimer;
        Vector3 lastHeading = Vector3.UnitZ;
        readonly float upshiftRpm, peakTorqueRpm;

        public BikeSim(BikeSpec spec)
        {
            Spec = spec;
            Front = new WheelSystem(spec.Front, true, spec);
            Rear = new WheelSystem(spec.Rear, false, spec);
            Engine = new EngineSystem(spec.Engine);
            Gearbox = new GearboxSystem(spec);
            Rider = new RiderBody(spec.Rider);

            // auto-shift points from the torque curve
            float bestP = 0f, bestT = 0f, rpmP = spec.Engine.RevLimit, rpmT = 0f;
            for (float r = spec.Engine.IdleRpm; r <= spec.Engine.RevLimit; r += 100f)
            {
                float t = SimMath.Curve(spec.Engine.RpmPoints, spec.Engine.TorquePoints, r);
                if (t * r > bestP) { bestP = t * r; rpmP = r; }
                if (t > bestT) { bestT = t; rpmT = r; }
            }
            upshiftRpm = Math.Min(spec.Engine.RevLimit * 0.97f, rpmP * 1.06f);
            peakTorqueRpm = rpmT;
        }

        /// <summary>Puts the rider on the bike and resets dynamic states (spawn / respawn).</summary>
        public void Reset(ISimBody body)
        {
            Rider.Standing = 0f;
            Rider.TargetLocal = Spec.Rider.SitCom;
            Rider.Place(body);
            Front.Omega = Rear.Omega = 0f;
            Front.DeflLat = Front.DeflLong = Rear.DeflLat = Rear.DeflLong = 0f;
            Front.SteerAngle = 0f;
            Engine.Omega = Spec.Engine.IdleRpm * EngineSystem.RpmToRad;
            Engine.Stalled = false;
            Gearbox.Gear = 1;
            Crashed = false; CrashReason = ""; badAttitudeTime = 0f;
            AirTime = 0f;
        }

        public void Step(ISimBody body, IGroundProbe ground, BikeInput input, float dt)
        {
            LastInput = input;
            LastDt = dt;
            lastAngularVelocity = body.AngularVelocity;
            Quaternion q = body.Rotation;
            Vector3 fwd = SimMath.Rotate(q, Vector3.UnitZ);
            Vector3 up = SimMath.Rotate(q, Vector3.UnitY);
            Vector3 right = SimMath.Rotate(q, Vector3.UnitX);

            // heading frame (gravity aligned)
            Vector3 heading = SimMath.ProjectOnPlane(fwd, SimMath.Up);
            heading = heading.LengthSquared() > 1e-4f ? Vector3.Normalize(heading) : lastHeading;
            lastHeading = heading;
            Vector3 headRight = Vector3.Cross(SimMath.Up, heading);
            Lean = (float)Math.Atan2(Vector3.Dot(up, headRight), Vector3.Dot(up, SimMath.Up));
            LeanRate = -Vector3.Dot(body.AngularVelocity, heading);
            Pitch = (float)Math.Asin(SimMath.Clamp(Vector3.Dot(fwd, SimMath.Up), -1f, 1f));
            Speed = Vector3.Dot(body.Velocity, heading);

            // ---------------- ground contact & suspension ----------------
            Front.Probe(body, ground, dt);
            Rear.Probe(body, ground, dt);
            bool wasAir = Airborne;
            Airborne = !Front.InContact && !Rear.InContact;
            AirTime = Airborne ? AirTime + dt : 0f;
            WheelieAmount = (!Front.InContact && Rear.InContact) ? SimMath.Clamp01(Pitch / 0.5f) : 0f;

            // ---------------- the virtual rider ----------------
            if (input.Stand != StandingCmd) StandingCmd = input.Stand;
            float steerBefore = Front.SteerAngle;
            frontOffTime = Front.InContact ? 0f : frontOffTime + dt;
            UpdateSteering(input, dt);
            UpdateRiderTargets(input, dt);
            UpdateGearbox(input, dt);

            ThrottleCmd = Crashed ? 0f : SimMath.Clamp01(input.Throttle);
            FrontBrakeCmd = SimMath.Clamp01(input.FrontBrake);
            RearBrakeCmd = SimMath.Clamp01(input.RearBrake);
            ApplyRiderInstincts(dt);

            float clutchEngage = ComputeClutch(input);
            Clutch.Engagement = clutchEngage;

            // ---------------- substepped drivetrain + tyres ----------------
            int n = Math.Max(1, Substeps);
            float h = dt / n;
            float fxF = 0, fyF = 0, fxR = 0, fyR = 0;
            float omegaF0 = Front.Omega, omegaR0 = Rear.Omega, omegaE0 = Engine.Omega;
            float ratio = Gearbox.Shifting ? 0f : Gearbox.Ratio;
            float capacity = Spec.ClutchMaxTorque * clutchEngage * clutchEngage; // plates bite progressively

            for (int i = 0; i < n; i++)
            {
                Front.SuspensionSubstep(h, i * h);
                Rear.SuspensionSubstep(h, i * h);
                var tf = Front.TyreSubstep(h, 1f);
                var tr = Rear.TyreSubstep(h, 1f);

                float rrF = RollingTorque(Front), rrR = RollingTorque(Rear);
                float roadF = -tf.Fx * Front.Spec.Radius + rrF;
                float roadR = -tr.Fx * Rear.Spec.Radius + rrR;

                // engine & clutch
                float te = Engine.ComputeTorque(ThrottleCmd, h, Gearbox.Shifting);
                float tc = Clutch.Solve(Engine.Omega, te, Spec.Engine.Inertia, Rear.Omega, roadR, Rear.Spec.Inertia, ratio, capacity, h);
                Engine.Omega += h * (te - tc) / Spec.Engine.Inertia;
                Rear.Omega += h * (roadR + tc * ratio) / Rear.Spec.Inertia;
                Front.Omega += h * roadF / Front.Spec.Inertia;

                // brakes: friction torque that can stop but never reverse the wheel
                Front.Omega = SimMath.MoveTowards(Front.Omega, 0f, h * Spec.FrontBrakeTorque * FrontBrakeCmd / Front.Spec.Inertia);
                float rearBrake = h * Spec.RearBrakeTorque * RearBrakeCmd / Rear.Spec.Inertia;
                if (ratio > 0f && !Clutch.Slipping)
                {
                    // locked driveline: the brake has to stop the engine too
                    float ieq = Rear.Spec.Inertia + Spec.Engine.Inertia * ratio * ratio;
                    rearBrake = h * Spec.RearBrakeTorque * RearBrakeCmd / ieq;
                    float before = Rear.Omega;
                    Rear.Omega = SimMath.MoveTowards(Rear.Omega, 0f, rearBrake);
                    Engine.Omega += (Rear.Omega - before) * ratio;
                }
                else Rear.Omega = SimMath.MoveTowards(Rear.Omega, 0f, rearBrake);

                // engine can't run backwards; stalls if dragged below stall rpm with the clutch in
                if (Engine.Omega < 0f) Engine.Omega = 0f;

                fxF += tf.Fx; fyF += tf.Fy; fxR += tr.Fx; fyR += tr.Fy;
            }
            fxF /= n; fyF /= n; fxR /= n; fyR /= n;
            Front.FinishSuspension();
            Rear.FinishSuspension();
            UpdateStall(clutchEngage, ratio, dt);

            // ---------------- forces on the chassis ----------------
            ApplyWheelForces(body, Front, fxF, fyF, dt);
            ApplyWheelForces(body, Rear, fxR, fyR, dt);

            // Reaction of spinning parts: speeding a wheel up pushes the chassis the other way
            // (throttle in the air lifts the front, braking in the air drops it), plus the
            // gyroscopic torque of the spinning wheels and crank when the chassis rotates.
            Vector3 axleF = SimMath.Rotate(q, Front.AxleLocal);
            Vector3 axleR = right;
            Vector3 reaction =
                -axleF * (Front.Spec.Inertia * (Front.Omega - omegaF0) / dt)
                - axleR * (Rear.Spec.Inertia * (Rear.Omega - omegaR0) / dt)
                - right * (Spec.Engine.Inertia * (Engine.Omega - omegaE0) / dt);
            Vector3 L = axleF * (Front.Spec.Inertia * Front.Omega) + axleR * (Rear.Spec.Inertia * Rear.Omega)
                      + right * (Spec.Engine.Inertia * Engine.Omega);
            Vector3 gyro = -Vector3.Cross(body.AngularVelocity, L);
            // turning the bars precesses the spinning front wheel: a real roll torque in the air
            Vector3 steerAxisW = SimMath.Rotate(q, Front.AxisLocal);
            float steerRate = (Front.SteerAngle - steerBefore) / dt;
            gyro -= Vector3.Cross(steerAxisW * steerRate, axleF * (Front.Spec.Inertia * Front.Omega));
            body.AddTorque(reaction + gyro);

            // aerodynamic drag on bike + rider
            Vector3 v = body.Velocity;
            float vmag = v.Length();
            if (vmag > 0.1f)
                body.AddForceAtPosition(-v * (0.5f * 1.2f * Spec.DragArea * vmag), body.Position + up * 0.35f);

            // the rider pushes on footpegs and bars; foot down at walking pace
            Rider.Step(body, dt);
            ApplyFootAssist(body, heading, dt);

            Front.FinishStep(fxF, fyF, dt);
            Rear.FinishStep(fxR, fyR, dt);

            if (wasAir && !Airborne) LandingImpact = Math.Max(Front.GroundCompVel, Rear.GroundCompVel);
            DetectCrash(body, up);
        }

        public float LandingImpact;
        public float LastDt = 1f / 200f;  // compression speed at the last touchdown, for audio/camera

        float RollingTorque(WheelSystem w)
        {
            if (!w.InContact) return -w.Omega * 0.02f; // bearing drag in the air
            float s = (float)Math.Tanh(w.Omega * w.Spec.Radius / 0.3f);
            return -s * w.Surface.RollingResistance * w.Load * w.Spec.Radius;
        }

        void ApplyWheelForces(ISimBody body, WheelSystem w, float fx, float fy, float dt)
        {
            Quaternion q = body.Rotation;
            Vector3 axis = SimMath.Rotate(q, w.AxisLocal);
            Vector3 hub = body.Position + SimMath.Rotate(q, w.HubLocal);
            // Along the axis the chassis only feels the suspension; across it the fork /
            // swingarm is rigid and passes the tyre force straight through. The bushings carry
            // moments too, so both act through the contact patch.
            Vector3 wheelWeight = -SimMath.Up * (w.Spec.UnsprungMass * SimMath.G);
            body.AddForceAtPosition(wheelWeight - axis * Vector3.Dot(wheelWeight, axis), hub);
            if (!w.InContact) { body.AddForceAtPosition(axis * w.ChassisAxisForce, hub); return; }
            Vector3 f = w.Normal * w.Load + w.LongDir * fx + w.LatDir * fy;
            body.AddForceAtPosition(f - axis * Vector3.Dot(f, axis) + axis * w.ChassisAxisForce, w.ContactPoint);
        }

        // ------------------------------------------------------------------------------
        void UpdateSteering(BikeInput input, float dt)
        {
            float v = Math.Max(Math.Abs(Speed), 0.1f);
            // How far the bike can lean is set by grip and by the banking under the wheels:
            // on a flat turn the tyres must supply tan(lean) * load sideways, a berm helps.
            float mu = 0.5f * (Front.InContact ? Front.Surface.Mu : 0.8f) + 0.5f * (Rear.InContact ? Rear.Surface.Mu : 0.8f);
            Vector3 n = Front.InContact ? Front.Normal : (Rear.InContact ? Rear.Normal : SimMath.Up);
            Vector3 headRight = Vector3.Cross(SimMath.Up, lastHeading);
            float bank = (float)Math.Atan2(Vector3.Dot(n, headRight), Vector3.Dot(n, SimMath.Up));
            float gripLean = (float)Math.Atan(mu * 0.92f);
            float speedLean = SimMath.Lerp(14f, 52f, SimMath.SmoothStep(1.5f, 10f, v)) * SimMath.Deg2Rad;
            float steerIn = SimMath.Clamp(input.Steer, -1f, 1f);
            float side = steerIn >= 0f ? 1f : -1f;
            float maxLean = Math.Min(speedLean, Math.Max(0.1f, gripLean + side * bank));
            TargetLean = steerIn * maxLean;
            float L = Spec.Wheelbase;
            float cosRake = (float)Math.Cos(Spec.RakeRad);
            float target;

            if (Crashed) { target = 0f; leanIntegral = 0f; }
            else if (frontOffTime > 0.25f)
            {
                // front has been off the ground a while (air, wheelie): centre the bars for the landing
                target = 0f;
                leanIntegral *= 1f - SimMath.LagFactor(dt, 0.3f);
            }
            else
            {
                float vv = Math.Max(v * v, 9f);
                // steady-turn steer that balances the current lean (what trail does for you)
                float selfSteer = L * SimMath.G * (float)Math.Tan(SimMath.Clamp(Lean, -1.2f, 1.2f)) / vv;
                if (Assists.SteeringAssist)
                {
                    // lean controller: counter-steer to start a lean, then hold it
                    float e = Lean - TargetLean;
                    if (Math.Abs(e) < 0.08f) leanIntegral = SimMath.Clamp(leanIntegral + e * dt, -0.05f, 0.05f);
                    else leanIntegral *= 1f - SimMath.LagFactor(dt, 0.25f);
                    // past the grip limit the rider stands the bike up hard
                    float over = Math.Max(0f, Math.Abs(Lean) - gripLean - (Lean > 0 ? bank : -bank));
                    float kp = LeanKp + over * 25f;
                    float a = selfSteer + L / vv * (kp * e + LeanKd * LeanRate + LeanKi * leanIntegral * SimMath.G);
                    target = (float)Math.Atan(a) / cosRake;
                }
                else
                {
                    // raw: bars follow the bike's own self-steer; input is a counter-steer push
                    float a = selfSteer + L / vv * (3f * LeanRate) - input.Steer * 0.9f * L / vv * 6f;
                    target = (float)Math.Atan(a) / cosRake;
                }
                if (Speed < -0.3f) target = -input.Steer * 0.5f; // pushing backwards
            }
            target = SimMath.Clamp(target, -Spec.MaxSteerRad, Spec.MaxSteerRad);
            // a rider feels the front push: once the front tyre is past its peak, adding more
            // bar in the same direction only washes it out, so they stop adding
            if (Assists.SteeringAssist && Front.InContact && Front.Rho > 1.0f)
            {
                float cur = Front.SteerAngle;
                bool adding = Math.Abs(target) > Math.Abs(cur) && Math.Sign(target) == Math.Sign(cur);
                if (adding) target = cur + (target - cur) * SimMath.Clamp01(1.6f - Front.Rho);
            }
            Front.SteerAngle = SimMath.MoveTowards(Front.SteerAngle, target, Spec.MaxSteerRateRad * dt);
        }

        float leanIntegral, frontOffTime;
        Vector3 lastAngularVelocity;
        public static float LeanKp = 30f, LeanKd = 7f, LeanKi = 6f;
        float brakeEase = 1f, throttleEase = 1f;

        /// <summary>
        /// Beginner assists: what an experienced rider does by reflex. They only scale the
        /// rider's lever inputs; the physics underneath is unchanged.
        /// </summary>
        void ApplyRiderInstincts(float dt)
        {
            float totalLoad = Front.Load + Rear.Load;
            float rearShare = totalLoad > 1f ? Rear.Load / totalLoad : 0.5f;
            float wantBrake = 1f;
            if (Assists.BrakeAssist && Front.InContact && FrontBrakeCmd > 0f)
            {
                if (!Rear.InContact || rearShare < 0.08f || Pitch < -0.12f) wantBrake = 0.35f;
                else if (Front.SlipRatio < -0.35f) wantBrake = 0.7f;
            }
            brakeEase = wantBrake < brakeEase ? wantBrake : SimMath.MoveTowards(brakeEase, wantBrake, dt * 2.5f);
            FrontBrakeCmd *= brakeEase;

            float wantThr = 1f;
            if (Assists.WheelieAssist && Rear.InContact && !Front.InContact)
            {
                // look ahead with the pitch rate: catch it before it goes past the balance point
                float pitchRate = -Vector3.Dot(lastAngularVelocity, Vector3.Cross(SimMath.Up, lastHeading));
                float predicted = Pitch + Math.Max(0f, pitchRate) * 0.3f;
                wantThr = 1f - SimMath.SmoothStep(0.10f, 0.32f, predicted);
            }
            throttleEase = wantThr < throttleEase ? wantThr : SimMath.MoveTowards(throttleEase, wantThr, dt * 3f);
            ThrottleCmd *= throttleEase;
        }

        void UpdateRiderTargets(BikeInput input, float dt)
        {
            float stand = StandingCmd ? 1f : 0f;
            float foreAft = SimMath.Clamp(input.RiderForeAft, -1f, 1f);
            float lean = SimMath.Clamp(input.RiderLean, -1f, 1f);
            // riders naturally drop the inside shoulder in a turn; the player adds to it
            lean = SimMath.Clamp(lean + 0.35f * (float)Math.Sin(Lean) * (1f - Math.Abs(input.RiderLean)), -1f, 1f);
            // braking hard: rider moves back to keep weight off the bars
            foreAft = SimMath.Clamp(foreAft - 0.25f * FrontBrakeCmd * (1f - Math.Abs(input.RiderForeAft)), -1f, 1f);

            Vector3 bodyCmd;
            if (Airborne)
                // in the air the torso is the only lever: pitch with fore/aft, whip with steer
                bodyCmd = new Vector3(-input.RiderForeAft, input.Steer, -input.RiderLean * 0.6f);
            else
                bodyCmd = new Vector3(-input.RiderForeAft * 0.4f, 0f, -input.RiderLean * 0.3f);
            float crouch = Airborne ? 0.2f : 0f;
            Rider.SetTargets(stand, lean, foreAft, crouch, bodyCmd, dt);
        }

        void UpdateGearbox(BikeInput input, float dt)
        {
            Gearbox.Update(dt);
            shiftCooldown -= dt;
            if (input.ShiftUp) Gearbox.RequestShift(+1);
            if (input.ShiftDown) Gearbox.RequestShift(-1);
            if (!Assists.AutoGearbox || Gearbox.Shifting || shiftCooldown > 0f) return;
            if (Gearbox.Gear == 0) { Gearbox.RequestShift(+1); shiftCooldown = 0.3f; return; }

            // Shift schedule follows the throttle like a rider: short-shift when cruising,
            // rev it out when pinned. Uses wheel-speed rpm so wheelspin doesn't trigger shifts.
            thrForShift += (ThrottleCmd - thrForShift) * SimMath.LagFactor(dt, 0.4f);
            float up = upshiftRpm * SimMath.Lerp(0.62f, 1f, thrForShift * 1.25f);
            float roadOmega = Math.Abs(Speed) / Rear.Spec.Radius;
            float roadRpm = roadOmega * Gearbox.Ratio / EngineSystem.RpmToRad;
            if (Gearbox.Gear < Spec.GearCount && roadRpm > up && Rear.InContact)
            {
                Gearbox.RequestShift(+1); shiftCooldown = 0.45f;
            }
            else if (Gearbox.Gear > 1)
            {
                float lowerRpm = roadOmega * Spec.GearTotal(Gearbox.Gear - 1) / EngineSystem.RpmToRad;
                float floor = SimMath.Lerp(0.42f, 0.62f, thrForShift) * upshiftRpm;
                if (roadRpm < floor && lowerRpm < up * 0.92f)
                {
                    Gearbox.RequestShift(-1); shiftCooldown = 0.35f;
                }
            }
        }

        float ComputeClutch(BikeInput input)
        {
            if (Gearbox.Gear == 0) return 0f;
            if (!Assists.AutoClutch) return 1f - SimMath.Clamp01(input.Clutch);
            float idle = Spec.Engine.IdleRpm;
            float wheelRpm = Rear.Omega * Gearbox.Ratio / EngineSystem.RpmToRad;
            // launch: plates bite as the revs rise; rolling: fully in once the wheel can carry idle
            float launch = SimMath.SmoothStep(idle + 400f, idle + 2600f, Engine.Rpm);
            float rolling = SimMath.SmoothStep(idle * 0.95f, idle * 1.35f, wheelRpm);
            float e = Math.Max(launch, rolling);
            if (RearBrakeCmd > 0.5f && wheelRpm < idle * 1.2f) e = 0f; // stall prevention
            // off the throttle with the rear locking from engine braking: fan the clutch
            if (Rear.InContact && ThrottleCmd < 0.15f)
                e *= 1f - 0.8f * SimMath.SmoothStep(0.12f, 0.35f, -Rear.SlipRatio);
            return e;
        }

        void UpdateStall(float engagement, float ratio, float dt)
        {
            if (!Engine.Stalled && Engine.Rpm < Spec.Engine.StallRpm && engagement > 0.5f && ratio > 0f)
            {
                Engine.Stalled = true; stallTimer = 0f;
            }
            if (Engine.Stalled)
            {
                Engine.Omega *= 1f - SimMath.LagFactor(dt, 0.15f);
                // electric start once the clutch is in or the gearbox in neutral
                if (engagement < 0.2f || ratio == 0f)
                {
                    stallTimer += dt;
                    if (stallTimer > 0.6f)
                    {
                        Engine.Stalled = false;
                        Engine.Omega = Spec.Engine.IdleRpm * EngineSystem.RpmToRad;
                    }
                }
            }
        }

        /// <summary>
        /// At walking pace a real rider dabs a foot or paddles. That is an external force from
        /// the ground, modelled as a roll torque that fades out with speed.
        /// </summary>
        void ApplyFootAssist(ISimBody body, Vector3 heading, float dt)
        {
            if (Crashed || Airborne) return;
            float upTo = Assists.BalanceAssist ? 4.5f : 1.6f;
            float k = 1f - SimMath.SmoothStep(upTo * 0.5f, upTo, Math.Abs(Speed));
            if (k <= 0f) return;
            float mTot = Spec.Mass + Spec.Rider.Mass;
            float stiff = mTot * SimMath.G * 0.95f * 1.6f;
            float damp = 2f * 0.9f * (float)Math.Sqrt(stiff * mTot * 0.8f);
            float tau = -(stiff * Lean + damp * LeanRate) * k;
            // roll right is negative rotation about heading
            body.AddTorque(-heading * tau);
        }

        float badAttitudeTime;

        void DetectCrash(ISimBody body, Vector3 up)
        {
            if (Crashed) return;
            // lying on its side or lid for a while, wheels touching or not
            bool bad = Math.Abs(Lean) > 72f * SimMath.Deg2Rad || Vector3.Dot(up, SimMath.Up) < 0f;
            badAttitudeTime = bad ? badAttitudeTime + LastDt : 0f;
            if (badAttitudeTime > 0.6f) { Crash("down"); return; }
            if (Rider.Separation > Spec.Rider.ThrowDistance) Crash("thrown off");
            else if (Math.Abs(Lean) > 72f * SimMath.Deg2Rad && !Airborne) Crash("laid it down");
            else if (Vector3.Dot(up, SimMath.Up) < -0.2f && !Airborne) Crash("upside down");
            else if (Math.Abs(Pitch) > 72f * SimMath.Deg2Rad && !Airborne) Crash(Pitch > 0 ? "looped out" : "went over the bars");
        }

        void Crash(string why)
        {
            Crashed = true; CrashReason = why;
            Rider.Detached = true;
        }
    }
}
