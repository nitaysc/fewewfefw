using RoostMX.Sim;
using UnityEngine;

namespace RoostMX.Game
{
    /// <summary>Player settings, persisted with PlayerPrefs.</summary>
    public sealed class GameSettings
    {
        public string Bike = "450F";
        public Assists Assists = new Assists();
        public int Quality = 2;            // 0 Low, 1 Medium, 2 High, 3 Ultra
        public int TargetFps = 60;
        public int CameraMode = 0;
        public bool Telemetry = false;
        public float CameraDistance = 1f;

        public static readonly string[] QualityNames = { "LOW", "MEDIUM", "HIGH", "ULTRA" };

        public static GameSettings Load()
        {
            var s = new GameSettings();
            s.Bike = PlayerPrefs.GetString("rmx.bike", s.Bike);
            s.Assists.AutoClutch = PlayerPrefs.GetInt("rmx.autoClutch", 1) == 1;
            s.Assists.AutoGearbox = PlayerPrefs.GetInt("rmx.autoGearbox", 1) == 1;
            s.Assists.BalanceAssist = PlayerPrefs.GetInt("rmx.balance", 1) == 1;
            s.Assists.SteeringAssist = PlayerPrefs.GetInt("rmx.steerAssist", 1) == 1;
            s.Assists.BrakeAssist = PlayerPrefs.GetInt("rmx.brakeAssist", 1) == 1;
            s.Assists.WheelieAssist = PlayerPrefs.GetInt("rmx.wheelieAssist", 1) == 1;
            s.Quality = PlayerPrefs.GetInt("rmx.quality", DefaultQuality());
            s.TargetFps = PlayerPrefs.GetInt("rmx.fps", 60);
            s.CameraMode = PlayerPrefs.GetInt("rmx.camera", 0);
            s.Telemetry = PlayerPrefs.GetInt("rmx.telemetry", 0) == 1;
            s.CameraDistance = PlayerPrefs.GetFloat("rmx.camDist", 1f);
            return s;
        }

        public void Save()
        {
            PlayerPrefs.SetString("rmx.bike", Bike);
            PlayerPrefs.SetInt("rmx.autoClutch", Assists.AutoClutch ? 1 : 0);
            PlayerPrefs.SetInt("rmx.autoGearbox", Assists.AutoGearbox ? 1 : 0);
            PlayerPrefs.SetInt("rmx.balance", Assists.BalanceAssist ? 1 : 0);
            PlayerPrefs.SetInt("rmx.steerAssist", Assists.SteeringAssist ? 1 : 0);
            PlayerPrefs.SetInt("rmx.brakeAssist", Assists.BrakeAssist ? 1 : 0);
            PlayerPrefs.SetInt("rmx.wheelieAssist", Assists.WheelieAssist ? 1 : 0);
            PlayerPrefs.SetInt("rmx.quality", Quality);
            PlayerPrefs.SetInt("rmx.fps", TargetFps);
            PlayerPrefs.SetInt("rmx.camera", CameraMode);
            PlayerPrefs.SetInt("rmx.telemetry", Telemetry ? 1 : 0);
            PlayerPrefs.SetFloat("rmx.camDist", CameraDistance);
            PlayerPrefs.Save();
        }

        static int DefaultQuality()
        {
            // a rough first guess from the device; the player can change it
            int mem = SystemInfo.systemMemorySize, gpu = SystemInfo.graphicsMemorySize;
            if (Application.isMobilePlatform) return mem >= 7000 ? 2 : mem >= 4000 ? 1 : 0;
            return gpu >= 3000 ? 3 : 2;
        }

        public BikeSpec CreateSpec() => Bike == "250F" ? BikeSpec.Create250F() : BikeSpec.Create450F();

        /// <summary>Applies render quality. URP settings are adjusted when URP is active.</summary>
        public void ApplyQuality(Terrain terrain, Light sun)
        {
            Application.targetFrameRate = TargetFps;
            QualitySettings.vSyncCount = 0;
            float[] shadowDist = { 0f, 45f, 80f, 140f };
            float[] renderScale = { 0.7f, 0.85f, 1f, 1f };
            int[] msaa = { 1, 1, 2, 4 };
            float[] pixelError = { 9f, 6f, 4f, 2f };
            QualitySettings.shadowDistance = shadowDist[Quality];
            QualitySettings.lodBias = new[] { 0.6f, 0.9f, 1.2f, 2f }[Quality];
#if ROOST_URP
            if (UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline is UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset urp)
            {
                urp.renderScale = renderScale[Quality];
                urp.shadowDistance = shadowDist[Quality];
                urp.msaaSampleCount = msaa[Quality];
            }
#endif
            if (terrain != null)
            {
                terrain.heightmapPixelError = pixelError[Quality];
                terrain.basemapDistance = new[] { 60f, 100f, 140f, 220f }[Quality];
                terrain.shadowCastingMode = Quality >= 2 ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
            }
            if (sun != null) sun.shadows = Quality == 0 ? LightShadows.None : LightShadows.Soft;
        }
    }
}
