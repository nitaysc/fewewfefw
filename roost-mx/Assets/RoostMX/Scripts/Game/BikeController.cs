using RoostMX.Sim;
using RoostMX.Sim.Track;
using UnityEngine;
#if UNITY_6000_0_OR_NEWER
using PhysicsMaterialType = UnityEngine.PhysicsMaterial;
#else
using PhysicsMaterialType = UnityEngine.PhysicMaterial;
#endif

namespace RoostMX.Game
{
    /// <summary>
    /// Owns one motorcycle: a Rigidbody chassis (bike mass minus the separately simulated
    /// wheels), its BikeSim, visuals and the crash / respawn cycle. All riding forces come
    /// from BikeSim; this class never moves the bike directly except to respawn it.
    /// </summary>
    [DefaultExecutionOrder(-50)]
    public sealed class BikeController : MonoBehaviour
    {
        public const int BikeLayer = 8;   // excluded from the wheel casts (falls back to Ignore Raycast)

        public BikeSim Sim { get; private set; }
        public Rigidbody Body { get; private set; }
        public TrackLayout Track;
        public MobileInputManager InputSource;
        public System.Func<BikeInput> AiInput;   // set for AI riders
        public BikeVisual Visual { get; private set; }
        public RiderVisual RiderVisual { get; private set; }
        public float CrashTimer { get; private set; }
        public bool Frozen;                        // countdown / pause

        UnityBody body;
        UnityGround ground;
        GameObject crashDummy;
        int layer;

        public void Setup(BikeSpec spec, TrackLayout track, Assists assists, int sample = 0)
        {
            Track = track;
            Sim = new BikeSim(spec);
            if (assists != null)
            {
                Sim.Assists.AutoClutch = assists.AutoClutch; Sim.Assists.AutoGearbox = assists.AutoGearbox;
                Sim.Assists.BalanceAssist = assists.BalanceAssist; Sim.Assists.SteeringAssist = assists.SteeringAssist;
                Sim.Assists.BrakeAssist = assists.BrakeAssist; Sim.Assists.WheelieAssist = assists.WheelieAssist;
            }
            layer = string.IsNullOrEmpty(LayerMask.LayerToName(BikeLayer)) ? 2 : BikeLayer;
            gameObject.layer = layer;

            Body = gameObject.GetComponent<Rigidbody>();
            if (Body == null) Body = gameObject.AddComponent<Rigidbody>();
            Body.mass = spec.SprungMass;
#if UNITY_6000_0_OR_NEWER
            Body.linearDamping = 0f; Body.angularDamping = 0f;
            Body.automaticCenterOfMass = false; Body.automaticInertiaTensor = false;
#else
            Body.drag = 0f; Body.angularDrag = 0f;
#endif
            Body.useGravity = true;
            Body.interpolation = RigidbodyInterpolation.Interpolate;
            Body.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
            Body.maxAngularVelocity = 60f;
            Body.maxDepenetrationVelocity = 3f;

            // frame/engine box: only touches the ground when bottoming or crashing
            var box = gameObject.GetComponent<BoxCollider>();
            if (box == null) box = gameObject.AddComponent<BoxCollider>();
            box.center = spec.ChassisColliderCenter.ToU();
            box.size = spec.ChassisColliderSize.ToU();
            box.sharedMaterial = SlideMaterial();
            Body.centerOfMass = Vector3.zero;
            Body.inertiaTensor = spec.Inertia.ToU();
            Body.inertiaTensorRotation = Quaternion.identity;

            body = new UnityBody(Body);
            ground = new UnityGround(track, layer);

            Visual = new GameObject("BikeVisual").AddComponent<BikeVisual>();
            Visual.transform.SetParent(transform, false);
            Visual.Build(Sim, BikeVisual.PaletteFor(spec.Name));
            RiderVisual = new GameObject("RiderVisual").AddComponent<RiderVisual>();
            RiderVisual.transform.SetParent(transform, false);
            RiderVisual.Build(Sim, transform, RiderVisual.DefaultKit);
            SetLayerRecursive(gameObject, layer);
            Respawn(sample);
        }

        static PhysicsMaterialType slideMat;
        static PhysicsMaterialType SlideMaterial()
        {
            if (slideMat != null) return slideMat;
            slideMat = new PhysicsMaterialType("BikeFrame") { dynamicFriction = 0.45f, staticFriction = 0.5f, bounciness = 0.05f };
            return slideMat;
        }

        static void SetLayerRecursive(GameObject g, int l)
        {
            g.layer = l;
            foreach (Transform c in g.transform) SetLayerRecursive(c.gameObject, l);
        }

        /// <summary>Puts the bike back on the track at (or before) a centreline sample, at rest.</summary>
        public void Respawn(int sample)
        {
            if (crashDummy != null) Destroy(crashDummy);
            Vector3 pos, fwd;
            if (Track != null)
            {
                Track.SpawnPose(sample, out var p, out var f);
                pos = p.ToU(); fwd = f.ToU();
            }
            else { pos = Vector3.zero; fwd = Vector3.forward; }
            float comHeight = Sim.Spec.Rear.Radius - Sim.Spec.RearAxleAtSag.Y;
            Body.position = pos + Vector3.up * (comHeight + 0.02f);
            Body.rotation = Quaternion.LookRotation(fwd, Vector3.up);
            transform.SetPositionAndRotation(Body.position, Body.rotation);
#if UNITY_6000_0_OR_NEWER
            Body.linearVelocity = Vector3.zero;
#else
            Body.velocity = Vector3.zero;
#endif
            Body.angularVelocity = Vector3.zero;
            Sim.Reset(body);
            CrashTimer = 0f;
        }

        public void RespawnHere()
        {
            int s = Track != null ? Track.NearestSample(Conv.N(Body.position)) : 0;
            Respawn(s);
        }

        void FixedUpdate()
        {
            if (Sim == null) return;
            BikeInput input = default;
            if (!Frozen)
            {
                if (AiInput != null) input = AiInput();
                else if (InputSource != null) input = InputSource.Read();
            }
            else input.FrontBrake = input.RearBrake = 1f;
            Sim.Step(body, ground, input, Time.fixedDeltaTime);

            if (Sim.Crashed)
            {
                if (CrashTimer == 0f) SpawnCrashDummy();
                CrashTimer += Time.fixedDeltaTime;
                if (CrashTimer > 2.8f) RespawnHere();
            }
        }

        /// <summary>The rider leaves the bike: a simple physical body until Stage 2's ragdoll.</summary>
        void SpawnCrashDummy()
        {
            crashDummy = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            crashDummy.name = "CrashedRider";
            crashDummy.transform.position = Sim.Rider.Position.ToU();
            crashDummy.transform.rotation = transform.rotation * Quaternion.Euler(70f, 0, 0);
            crashDummy.transform.localScale = new Vector3(0.45f, 0.85f, 0.45f);
            crashDummy.GetComponent<MeshRenderer>().sharedMaterial = MaterialLibrary.Lit(RiderVisual.DefaultKit.Jersey, 0.3f);
            var rb = crashDummy.AddComponent<Rigidbody>();
            rb.mass = Sim.Spec.Rider.Mass;
#if UNITY_6000_0_OR_NEWER
            rb.linearVelocity = Sim.Rider.Velocity.ToU();
            rb.linearDamping = 0.2f;
#else
            rb.velocity = Sim.Rider.Velocity.ToU();
            rb.drag = 0.2f;
#endif
            rb.angularVelocity = Random.insideUnitSphere * 4f;
            crashDummy.GetComponent<Collider>().sharedMaterial = SlideMaterial();
            var helmet = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            Destroy(helmet.GetComponent<Collider>());
            helmet.transform.SetParent(crashDummy.transform, false);
            helmet.transform.localPosition = new Vector3(0, 0.62f, 0);
            helmet.transform.localScale = new Vector3(0.62f, 0.33f, 0.62f);
            helmet.GetComponent<MeshRenderer>().sharedMaterial = MaterialLibrary.Lit(RiderVisual.DefaultKit.Helmet, 0.8f);
        }

        public Transform CameraTarget => crashDummy != null ? crashDummy.transform : transform;

        void OnDestroy() { if (crashDummy != null) Destroy(crashDummy); }
    }
}
