using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
#if ROOST_URP
using UnityEngine.Rendering.Universal;
#endif

namespace RoostMX.EditorTools
{
    /// <summary>
    /// Makes a fresh checkout ready to press Play and to build for Android, with no manual
    /// steps: creates the URP pipeline asset, template materials that carry the needed
    /// shaders into player builds, the TestTrack scene, build settings and Android player
    /// settings. Runs automatically when the project opens, and from the menu
    /// Roost MX > Setup Project.
    /// </summary>
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        const string GeneratedDir = "Assets/RoostMX/Generated";
        const string ResourcesDir = "Assets/RoostMX/Resources/RoostMX";
        public const string ScenePath = "Assets/RoostMX/Scenes/TestTrack.unity";

        static ProjectSetup()
        {
            // defer until the asset database is ready
            EditorApplication.delayCall += () =>
            {
                if (!SessionState.GetBool("RoostMX.SetupDone", false))
                {
                    SessionState.SetBool("RoostMX.SetupDone", true);
                    Run(false);
                }
            };
        }

        [MenuItem("Roost MX/Setup Project")]
        public static void RunFromMenu() => Run(true);

        public static void Run(bool verbose)
        {
            Directory.CreateDirectory(GeneratedDir);
            Directory.CreateDirectory(ResourcesDir);
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            EnsurePipeline();
            EnsureMaterials();
            EnsureScene();
            ConfigurePlayer();
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            if (verbose) Debug.Log("Roost MX: project setup complete. Open " + ScenePath + " and press Play.");
        }

        static void EnsurePipeline()
        {
#if ROOST_URP
            const string rendererPath = GeneratedDir + "/RoostMX_Renderer.asset";
            const string pipelinePath = GeneratedDir + "/RoostMX_URP.asset";
            var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(pipelinePath);
            if (pipeline == null)
            {
                var renderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(rendererPath);
                if (renderer == null)
                {
                    renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                    AssetDatabase.CreateAsset(renderer, rendererPath);
                }
                pipeline = UniversalRenderPipelineAsset.Create(renderer);
                pipeline.name = "RoostMX_URP";
                AssetDatabase.CreateAsset(pipeline, pipelinePath);
            }
            // mobile-friendly defaults; GameSettings adjusts scale/shadows at runtime
            pipeline.supportsHDR = false;
            pipeline.msaaSampleCount = 2;
            pipeline.renderScale = 1f;
            pipeline.shadowDistance = 80f;
            pipeline.shadowCascadeCount = 2;
            pipeline.supportsCameraDepthTexture = false;
            pipeline.supportsCameraOpaqueTexture = false;
            EditorUtility.SetDirty(pipeline);
            if (GraphicsSettings.defaultRenderPipeline != pipeline) GraphicsSettings.defaultRenderPipeline = pipeline;
            for (int i = 0; i < QualitySettings.names.Length; i++)
            {
                QualitySettings.SetQualityLevel(i, false);
                QualitySettings.renderPipeline = pipeline;
            }
#else
            Debug.LogWarning("Roost MX: URP package not found; using the built-in pipeline.");
#endif
        }

        static void EnsureMaterials()
        {
            bool urp = GraphicsSettings.defaultRenderPipeline != null;
            Make("Lit", urp ? "Universal Render Pipeline/Lit" : "Standard");
            Make("LitPlain", urp ? "Universal Render Pipeline/Lit" : "Standard");   // keeps the no-normal-map variant in builds
            Make("Unlit", urp ? "Universal Render Pipeline/Unlit" : "Unlit/Color");
            Make("Particle", urp ? "Universal Render Pipeline/Particles/Unlit" : "Particles/Standard Unlit");
            Make("TerrainLit", urp ? "Universal Render Pipeline/Terrain/Lit" : "Nature/Terrain/Standard");
            Make("LitBuiltin", "Standard");
            Make("UnlitBuiltin", "Unlit/Color");
            Make("Sky", "Skybox/Procedural");
        }

        static void Make(string name, string shaderName)
        {
            string path = $"{ResourcesDir}/{name}.mat";
            var shader = Shader.Find(shaderName);
            if (shader == null) { Debug.LogWarning($"Roost MX: shader '{shaderName}' not found for {name}."); return; }
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null) { m = new Material(shader); AssetDatabase.CreateAsset(m, path); }
            else if (m.shader != shader) { m.shader = shader; EditorUtility.SetDirty(m); }
            // keep the keyword variants we enable at runtime
            if (name == "Lit") m.EnableKeyword("_NORMALMAP");
        }

        static void EnsureScene()
        {
            if (!File.Exists(ScenePath))
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                new GameObject("RoostMX").AddComponent<RoostMX.Game.Bootstrap>();
                EditorSceneManager.SaveScene(scene, ScenePath);
            }
            var scenes = EditorBuildSettings.scenes;
            if (scenes.Length == 0 || scenes[0].path != ScenePath)
                EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        }

        static void ConfigurePlayer()
        {
            PlayerSettings.companyName = "Roost MX";
            PlayerSettings.productName = "Roost MX";
#if UNITY_2021_2_OR_NEWER
            PlayerSettings.SetApplicationIdentifier(UnityEditor.Build.NamedBuildTarget.Android, "com.nitaysc.roostmx");
            PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
#else
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.nitaysc.roostmx");
            PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);
#endif
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.Vulkan, GraphicsDeviceType.OpenGLES3 });
            PlayerSettings.gpuSkinning = true;
            PlayerSettings.MTRendering = true;
        }
    }
}
