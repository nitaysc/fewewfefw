using System.Numerics;

namespace RoostMX.Sim
{
    /// <summary>
    /// The motorcycle chassis as a rigid body. In Unity this wraps a Rigidbody; in the
    /// test harness it is a small semi-implicit integrator. Forces are accumulated during a
    /// step and integrated by the owner after BikeSim.Step returns.
    /// </summary>
    public interface ISimBody
    {
        Vector3 Position { get; }          // world position of the centre of mass
        Quaternion Rotation { get; }
        Vector3 Velocity { get; }
        Vector3 AngularVelocity { get; }   // world space, rad/s
        float Mass { get; }
        void AddForceAtPosition(Vector3 force, Vector3 worldPoint);
        void AddForce(Vector3 force);
        void AddTorque(Vector3 torque);
    }

    public struct GroundHit
    {
        public Vector3 Point;
        public Vector3 Normal;
        public float Distance;
        public SurfaceType Surface;
    }

    /// <summary>Sphere cast against the world (terrain, ramps, props).</summary>
    public interface IGroundProbe
    {
        bool SphereCast(Vector3 origin, float radius, Vector3 direction, float maxDistance, out GroundHit hit);
    }
}
