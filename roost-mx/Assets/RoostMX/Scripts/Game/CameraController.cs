using UnityEngine;

namespace RoostMX.Game
{
    /// <summary>
    /// Chase, close chase and helmet cameras. The chase cameras follow the bike's heading (not
    /// its lean) with speed-dependent distance and field of view, and pull in when terrain is
    /// between them and the rider. The helmet camera rides on the simulated rider's head so
    /// it moves with the rider's body, leans and landings.
    /// </summary>
    public sealed class CameraController : MonoBehaviour
    {
        public enum Mode { Chase, CloseChase, Helmet }
        public Mode CurrentMode = Mode.Chase;
        public BikeController Target;
        public float DistanceScale = 1f;
        Camera cam;
        Vector3 smoothedPos, vel;
        Vector3 heading = Vector3.forward;
        float fov;

        void Awake()
        {
            cam = GetComponent<Camera>();
            fov = cam.fieldOfView;
        }

        public void Cycle()
        {
            CurrentMode = (Mode)(((int)CurrentMode + 1) % 3);
            snap = true;
        }

        bool snap = true;

        void LateUpdate()
        {
            if (Target == null || Target.Sim == null) return;
            Transform t = Target.CameraTarget;
            var sim = Target.Sim;
            float speed = Mathf.Abs(sim.Speed);

            Vector3 fwd = Target.transform.forward;
            Vector3 flat = Vector3.ProjectOnPlane(fwd, Vector3.up);
            if (flat.sqrMagnitude > 0.01f && !sim.Crashed)
                heading = Vector3.Slerp(heading, flat.normalized, 1f - Mathf.Exp(-Time.deltaTime * (sim.Airborne ? 1.2f : 3.5f)));

            if (CurrentMode == Mode.Helmet && !sim.Crashed)
            {
                Vector3 com = sim.Rider.Position.ToU();
                Vector3 up = Target.transform.up;
                Quaternion torso = Target.transform.rotation * Quaternion.Euler(sim.Rider.BodyAngle.X * Mathf.Rad2Deg * 0.5f, sim.Rider.BodyAngle.Y * Mathf.Rad2Deg * 0.6f, 0f);
                Vector3 headPos = com + up * Mathf.Lerp(0.55f, 0.62f, sim.Rider.Standing) + Target.transform.forward * Mathf.Lerp(0.12f, 0.28f, sim.Rider.Standing);
                transform.position = headPos;
                // the neck keeps the horizon steadier than the bike: partial lean compensation
                Quaternion bikeRot = torso;
                Quaternion level = Quaternion.LookRotation(Target.transform.forward, Vector3.up);
                transform.rotation = Quaternion.Slerp(bikeRot, level, 0.55f) * Quaternion.Euler(12f, 0, 0);
                cam.fieldOfView = Mathf.Lerp(cam.fieldOfView, 78f + speed * 0.15f, Time.deltaTime * 3f);
                cam.nearClipPlane = 0.05f;
                return;
            }
            cam.nearClipPlane = 0.2f;

            float dist = (CurrentMode == Mode.Chase ? 5.2f : 3.4f) * DistanceScale + speed * 0.04f;
            float height = CurrentMode == Mode.Chase ? 1.9f : 1.45f;
            Vector3 focus = t.position + Vector3.up * 0.7f;
            Vector3 desired = focus - heading * dist + Vector3.up * height;

            // keep the camera out of the ground and berms
            Vector3 toCam = desired - focus;
            if (Physics.SphereCast(focus, 0.25f, toCam.normalized, out var hit, toCam.magnitude, ~(1 << Target.gameObject.layer), QueryTriggerInteraction.Ignore))
                desired = focus + toCam.normalized * Mathf.Max(1.2f, hit.distance - 0.2f);
            if (Target.Track != null)
            {
                float gy = Target.Track.HeightAt(desired.x, desired.z) + 0.6f;
                if (desired.y < gy) desired.y = gy;
            }

            if (snap) { smoothedPos = desired; vel = Vector3.zero; snap = false; }
            smoothedPos = Vector3.SmoothDamp(smoothedPos, desired, ref vel, sim.Airborne ? 0.18f : 0.10f);
            transform.position = smoothedPos;
            Vector3 look = focus + heading * Mathf.Lerp(2f, 6f, speed / 25f) - Vector3.up * 0.3f;
            Quaternion want = Quaternion.LookRotation(look - transform.position, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, want, 1f - Mathf.Exp(-Time.deltaTime * 10f));
            cam.fieldOfView = Mathf.Lerp(cam.fieldOfView, fov + Mathf.Clamp(speed - 8f, 0f, 20f) * 0.6f, Time.deltaTime * 2f);
        }

        public void Snap() => snap = true;
    }
}
