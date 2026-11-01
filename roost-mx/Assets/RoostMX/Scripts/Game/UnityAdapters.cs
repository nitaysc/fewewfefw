// Bridges between the engine-independent physics core (System.Numerics) and Unity.
using RoostMX.Sim;
using RoostMX.Sim.Track;
using UnityEngine;
using NVec3 = System.Numerics.Vector3;
using NQuat = System.Numerics.Quaternion;

namespace RoostMX.Game
{
    public static class Conv
    {
        public static Vector3 U(NVec3 v) => new Vector3(v.X, v.Y, v.Z);
        public static NVec3 N(Vector3 v) => new NVec3(v.x, v.y, v.z);
        public static Quaternion U(NQuat q) => new Quaternion(q.X, q.Y, q.Z, q.W);
        public static NQuat N(Quaternion q) => new NQuat(q.x, q.y, q.z, q.w);
    }

    /// <summary>The bike chassis Rigidbody seen through the core's ISimBody interface.</summary>
    public sealed class UnityBody : ISimBody
    {
        readonly Rigidbody rb;
        public UnityBody(Rigidbody rb) { this.rb = rb; }

        public NVec3 Position => Conv.N(rb.worldCenterOfMass);
        public NQuat Rotation => Conv.N(rb.rotation);
#if UNITY_6000_0_OR_NEWER
        public NVec3 Velocity => Conv.N(rb.linearVelocity);
#else
        public NVec3 Velocity => Conv.N(rb.velocity);
#endif
        public NVec3 AngularVelocity => Conv.N(rb.angularVelocity);
        public float Mass => rb.mass;

        public void AddForceAtPosition(NVec3 force, NVec3 worldPoint) =>
            rb.AddForceAtPosition(Conv.U(force), Conv.U(worldPoint), ForceMode.Force);
        public void AddForce(NVec3 force) => rb.AddForce(Conv.U(force), ForceMode.Force);
        public void AddTorque(NVec3 torque) => rb.AddTorque(Conv.U(torque), ForceMode.Force);
    }

    /// <summary>
    /// Sphere casts against everything except the bike itself. Surfaces come from the track
    /// layout's splat map on the terrain, and from a SurfaceTag on any other collider.
    /// </summary>
    public sealed class UnityGround : IGroundProbe
    {
        readonly int mask;
        readonly TrackLayout track;

        public UnityGround(TrackLayout track, int ignoreLayer)
        {
            this.track = track;
            mask = ~((1 << ignoreLayer) | (1 << 2)); // never hit the bike (or Ignore Raycast)
        }

        public bool SphereCast(NVec3 origin, float radius, NVec3 direction, float maxDistance, out GroundHit hit)
        {
            hit = default;
            if (!Physics.SphereCast(Conv.U(origin), radius, Conv.U(direction), out RaycastHit h, maxDistance, mask, QueryTriggerInteraction.Ignore))
                return false;
            hit.Point = Conv.N(h.point);
            hit.Normal = Conv.N(h.normal);
            hit.Distance = h.distance;
            var tag = h.collider.GetComponent<SurfaceTag>();
            if (tag != null) hit.Surface = tag.Surface;
            else if (track != null && h.collider is TerrainCollider) hit.Surface = track.SurfaceAt(h.point.x, h.point.z);
            else hit.Surface = SurfaceType.Hardpack;
            return true;
        }
    }

    /// <summary>Marks a non-terrain collider (ramp, start gate pad) with a surface type.</summary>
    public sealed class SurfaceTag : MonoBehaviour
    {
        public SurfaceType Surface = SurfaceType.Hardpack;
    }
}
