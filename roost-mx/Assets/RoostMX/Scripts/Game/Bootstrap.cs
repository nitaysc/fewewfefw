using RoostMX.Sim.Track;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.Rendering;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif

namespace RoostMX.Game
{
    /// <summary>
    /// Builds the whole Stage 1 game at runtime: physics settings, dusk lighting and sky, the
    /// generated motocross track, the bike and rider, camera, controls, HUD and audio. Drop it
    /// on an empty GameObject (the editor setup does this in Assets/RoostMX/Scenes/TestTrack),
    /// or press Play in any empty scene: it creates itself.
    /// </summary>
    public sealed class Bootstrap : MonoBehaviour
    {
        GameSettings settings;
        TrackLayout layout;
        TrackBuilder track;
        BikeController bike;
        CameraController cameraCtl;
        MobileInputManager input;
        GameUI ui;
        LapTimer laps;
        Light sun;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoCreate()
        {
#if UNITY_6000_0_OR_NEWER
            if (FindFirstObjectByType<Bootstrap>() != null) return;
#else
            if (FindObjectOfType<Bootstrap>() != null) return;
#endif
            new GameObject("RoostMX").AddComponent<Bootstrap>();
        }

        void Start()
        {
            settings = GameSettings.Load();
            // 200 Hz physics: the tyre, suspension and rider models are tuned for it
            Time.fixedDeltaTime = 1f / 200f;
            Time.maximumDeltaTime = 1f / 15f;
            Physics.defaultSolverIterations = 8;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Screen.orientation = ScreenOrientation.LandscapeLeft;

            SetupLighting();
            layout = TrackLayout.CreateDefault();
            track = new GameObject("Track").AddComponent<TrackBuilder>();
            track.Build(layout);

            EnsureEventSystem();
            input = new GameObject("Input").AddComponent<MobileInputManager>();
            input.Assists = settings.Assists;
            input.Build();

            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            var cam = camGo.AddComponent<Camera>();
            cam.farClipPlane = 1600f; cam.fieldOfView = 62f;
            cam.clearFlags = CameraClearFlags.Skybox;
            camGo.AddComponent<AudioListener>();
            cameraCtl = camGo.AddComponent<CameraController>();
            cameraCtl.CurrentMode = (CameraController.Mode)settings.CameraMode;
            cameraCtl.DistanceScale = settings.CameraDistance;

            SpawnBike();

            ui = new GameObject("UI").AddComponent<GameUI>();
            ui.Settings = settings;
            ui.Bike = bike;
            ui.Laps = laps;
            ui.Build();
            ui.SettingsChanged += ApplySettings;
            ui.BikeChanged += SpawnBike;
            ui.CameraChanged += () => { cameraCtl.CurrentMode = (CameraController.Mode)settings.CameraMode; cameraCtl.Snap(); };

            input.CameraPressed += () => { cameraCtl.Cycle(); settings.CameraMode = (int)cameraCtl.CurrentMode; settings.Save(); };
            input.ResetPressed += () => { if (bike != null) { bike.RespawnHere(); cameraCtl.Snap(); } };
            input.PausePressed += () => ui.SetPaused(!ui.Paused);
            input.TelemetryPressed += () => ui.ToggleTelemetry();

            ApplySettings();
        }

        void SpawnBike()
        {
            if (bike != null) Destroy(bike.gameObject);
            var go = new GameObject("Bike");
            bike = go.AddComponent<BikeController>();
            bike.InputSource = input;
            bike.Setup(settings.CreateSpec(), layout, settings.Assists, 0);
            var audioGo = new GameObject("EngineAudio");
            audioGo.transform.SetParent(go.transform, false);
            audioGo.AddComponent<AudioSource>();
            audioGo.AddComponent<EngineAudio>().Bike = bike;
            var fx = new GameObject("DirtFx").AddComponent<DirtFx>();
            fx.transform.SetParent(go.transform, false);
            fx.Bike = bike;
            fx.Build();
            cameraCtl.Target = bike;
            cameraCtl.Snap();
            laps = new LapTimer(layout, settings.Bike);
            if (ui != null) { ui.Bike = bike; ui.Laps = laps; }
            Settings_PushAssists();
        }

        void Settings_PushAssists()
        {
            if (bike == null || bike.Sim == null) return;
            var a = settings.Assists; var b = bike.Sim.Assists;
            b.AutoClutch = a.AutoClutch; b.AutoGearbox = a.AutoGearbox; b.BalanceAssist = a.BalanceAssist;
            b.SteeringAssist = a.SteeringAssist; b.BrakeAssist = a.BrakeAssist; b.WheelieAssist = a.WheelieAssist;
        }

        void ApplySettings()
        {
            Settings_PushAssists();
            settings.ApplyQuality(track != null ? track.Terrain : null, sun);
        }

        void Update()
        {
            if (bike != null && laps != null && !(ui != null && ui.Paused))
                laps.Update(bike.transform.position, Time.deltaTime, bike.Sim.Crashed);
        }

        void SetupLighting()
        {
            var sunGo = new GameObject("Sun");
            sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1f, 0.70f, 0.48f);
            sun.intensity = 1.25f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 0.85f;
            sunGo.transform.rotation = Quaternion.Euler(14f, -38f, 0f);   // low evening sun
            RenderSettings.sun = sun;

            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.42f, 0.38f, 0.55f);
            RenderSettings.ambientEquatorColor = new Color(0.50f, 0.38f, 0.36f);
            RenderSettings.ambientGroundColor = new Color(0.16f, 0.13f, 0.12f);
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogColor = new Color(0.55f, 0.42f, 0.48f);
            RenderSettings.fogDensity = 0.0019f;

            var sky = Resources.Load<Material>("RoostMX/Sky");
            if (sky == null)
            {
                var sh = Shader.Find("Skybox/Procedural");
                if (sh != null) sky = new Material(sh);
            }
            if (sky != null)
            {
                if (sky.HasProperty("_SkyTint")) sky.SetColor("_SkyTint", new Color(0.55f, 0.42f, 0.62f));
                if (sky.HasProperty("_GroundColor")) sky.SetColor("_GroundColor", new Color(0.25f, 0.2f, 0.22f));
                if (sky.HasProperty("_AtmosphereThickness")) sky.SetFloat("_AtmosphereThickness", 1.45f);
                if (sky.HasProperty("_Exposure")) sky.SetFloat("_Exposure", 1.1f);
                if (sky.HasProperty("_SunSize")) sky.SetFloat("_SunSize", 0.035f);
                RenderSettings.skybox = sky;
            }
            DynamicGI.UpdateEnvironment();
        }

        static void EnsureEventSystem()
        {
#if UNITY_6000_0_OR_NEWER
            if (FindFirstObjectByType<EventSystem>() != null) return;
#else
            if (FindObjectOfType<EventSystem>() != null) return;
#endif
            var es = new GameObject("EventSystem");
            es.AddComponent<EventSystem>();
#if ENABLE_INPUT_SYSTEM
            es.AddComponent<InputSystemUIInputModule>();
#else
            es.AddComponent<StandaloneInputModule>();
#endif
        }
    }
}
