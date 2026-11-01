using System;
using System.Numerics;

namespace RoostMX.Sim
{
    /// <summary>
    /// The rider as an independent body. Translation: a 75 kg point mass integrated in world
    /// space and pulled toward a target point on the bike by anisotropic spring-dampers (legs
    /// on the pegs, hands on the bars, seat). Rotation: a torso with its own inertia driven
    /// by muscle torques relative to the bike. Every force and torque the rider exerts is
    /// applied, reversed, to the chassis — so moving forward really loads the front tyre,
    /// standing raises the combined centre of mass, and throwing the torso in the air rotates
    /// the bike the other way. The rider's mass is NOT part of the chassis rigid body.
    /// </summary>
    public sealed class RiderBody
    {
        public readonly RiderSpec Spec;

        public Vector3 Position, Velocity;     // world, rider CoM
        public Vector3 TargetLocal;            // chassis frame
        public float Standing;                 // 0 = seated, 1 = standing (blended)
        public Vector3 BodyAngle, BodyRate;    // torso angles relative to the bike (pitch X, yaw Y, roll Z)
        public Vector3 BodyTarget;
        public Vector3 SpringForceOnRider;     // last step, world
        public float Separation;               // |rider - target|, m
        public bool Detached;                  // thrown off

        Vector3 prevBikeOmegaLocal;
        bool initialised;

        public RiderBody(RiderSpec s) { Spec = s; TargetLocal = s.SitCom; }

        public void Place(ISimBody bike)
        {
            Position = bike.Position + SimMath.Rotate(bike.Rotation, TargetLocal);
            Velocity = bike.Velocity;
            BodyAngle = Vector3.Zero; BodyRate = Vector3.Zero;
            Detached = false;
            initialised = true;
        }

        /// <param name="lean">-1..1 lateral body position</param>
        /// <param name="foreAft">-1..1, + toward the bars</param>
        /// <param name="crouch">0..1 extra knee bend (absorbing / pumping)</param>
        public void SetTargets(float standingCmd, float lean, float foreAft, float crouch, Vector3 bodyAngleCmd, float dt)
        {
            Standing = SimMath.MoveTowards(Standing, standingCmd, dt * 2.6f); // ~0.4 s to stand up
            Vector3 baseCom = Vector3.Lerp(Spec.SitCom, Spec.StandCom, Standing);
            float reachScale = SimMath.Lerp(0.55f, 1f, Standing);   // you move much further when standing
            TargetLocal = baseCom + new Vector3(
                lean * Spec.LateralReach * reachScale,
                -crouch * Spec.CrouchDepth * Standing,
                foreAft * Spec.ForeAftReach * reachScale);
            BodyTarget = new Vector3(
                SimMath.Clamp(bodyAngleCmd.X, -1f, 1f) * Spec.BodyRange.X,
                SimMath.Clamp(bodyAngleCmd.Y, -1f, 1f) * Spec.BodyRange.Y,
                SimMath.Clamp(bodyAngleCmd.Z, -1f, 1f) * Spec.BodyRange.Z);
        }

        public void Step(ISimBody bike, float dt)
        {
            if (!initialised) Place(bike);
            Quaternion q = bike.Rotation;
            Quaternion qi = Quaternion.Inverse(q);

            // ---------------- translation ----------------
            Vector3 targetW = bike.Position + SimMath.Rotate(q, TargetLocal);
            Vector3 targetV = bike.Velocity + Vector3.Cross(bike.AngularVelocity, targetW - bike.Position);
            Vector3 force = Vector3.Zero;
            if (!Detached)
            {
                Vector3 k = Vector3.Lerp(Spec.SitStiffness, Spec.StandStiffness, Standing);
                Vector3 dLocal = SimMath.Rotate(qi, targetW - Position);
                Vector3 vLocal = SimMath.Rotate(qi, targetV - Velocity);
                float m = Spec.Mass;
                var c = new Vector3(
                    2f * Spec.DampingRatio * (float)Math.Sqrt(k.X * m),
                    2f * Spec.DampingRatio * (float)Math.Sqrt(k.Y * m),
                    2f * Spec.DampingRatio * (float)Math.Sqrt(k.Z * m));
                Vector3 fLocal = k * dLocal + c * vLocal;
                force = SimMath.Rotate(q, fLocal);
                // the reaction goes into the bike at the rider's attachment point
                bike.AddForceAtPosition(-force, targetW);
            }
            SpringForceOnRider = force;
            Velocity += (force / Spec.Mass - SimMath.Up * SimMath.G) * dt;
            Position += Velocity * dt;
            Separation = (Position - targetW).Length();

            // ---------------- torso rotation ----------------
            Vector3 bikeOmegaLocal = SimMath.Rotate(qi, bike.AngularVelocity);
            Vector3 bikeAlpha = (bikeOmegaLocal - prevBikeOmegaLocal) / dt;
            prevBikeOmegaLocal = bikeOmegaLocal;
            if (!Detached)
            {
                Vector3 kb = Spec.BodyStiffness, I = Spec.BodyInertia;
                var cb = new Vector3(
                    2f * Spec.BodyDampingRatio * (float)Math.Sqrt(kb.X * I.X),
                    2f * Spec.BodyDampingRatio * (float)Math.Sqrt(kb.Y * I.Y),
                    2f * Spec.BodyDampingRatio * (float)Math.Sqrt(kb.Z * I.Z));
                Vector3 tauLocal = kb * (BodyTarget - BodyAngle) - cb * BodyRate;
                // torso angular acceleration in the bike frame = own torque / inertia - bike's acceleration
                Vector3 acc = tauLocal / I - bikeAlpha;
                BodyRate += acc * dt;
                BodyAngle += BodyRate * dt;
                // joint limits: hips and arms can only twist so far
                BodyAngle = Vector3.Clamp(BodyAngle, -Spec.BodyRange * 1.3f, Spec.BodyRange * 1.3f);
                bike.AddTorque(-SimMath.Rotate(q, tauLocal));
            }
        }

        public Vector3 CombinedCom(ISimBody bike) =>
            (bike.Position * bike.Mass + Position * Spec.Mass) / (bike.Mass + Spec.Mass);
    }
}
