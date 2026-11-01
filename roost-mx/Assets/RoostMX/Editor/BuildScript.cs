using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace RoostMX.EditorTools
{
    /// <summary>
    /// Command-line Android build (used by .github/workflows/build-roost-mx.yml through
    /// game-ci/unity-builder, or locally):
    ///   Unity -batchmode -quit -projectPath roost-mx -buildTarget Android
    ///         -executeMethod RoostMX.EditorTools.BuildScript.BuildAndroid
    ///         [-customBuildPath out/roost-mx.apk] [-versionCode 12]
    /// </summary>
    public static class BuildScript
    {
        [MenuItem("Roost MX/Build Android APK")]
        public static void BuildAndroidMenu() => BuildAndroidTo("Builds/roost-mx.apk", 1);

        public static void BuildAndroid()
        {
            string path = Arg("-customBuildPath") ?? "Builds/roost-mx.apk";
            if (!path.EndsWith(".apk")) path = Path.Combine(path, "roost-mx.apk");
            int code = int.TryParse(Arg("-androidVersionCode") ?? Arg("-versionCode") ?? Environment.GetEnvironmentVariable("ROOST_VERSION_CODE"), out var c) ? c : 1;
            BuildAndroidTo(path, code);
        }

        static void BuildAndroidTo(string path, int versionCode)
        {
            ProjectSetup.Run(true);
            PlayerSettings.Android.bundleVersionCode = versionCode;
            PlayerSettings.bundleVersion = $"0.1.{versionCode}";
            EditorUserBuildSettings.buildAppBundle = false;

            // a committed keystore so every CI build installs over the previous one
            string ks = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "android-signing", "roostmx-debug.keystore"));
            if (File.Exists(ks))
            {
                PlayerSettings.Android.useCustomKeystore = true;
                PlayerSettings.Android.keystoreName = ks;
                PlayerSettings.Android.keystorePass = "roostmx-debug";
                PlayerSettings.Android.keyaliasName = "roostmx";
                PlayerSettings.Android.keyaliasPass = "roostmx-debug";
            }

            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
            var options = new BuildPlayerOptions
            {
                scenes = new[] { ProjectSetup.ScenePath },
                locationPathName = path,
                target = BuildTarget.Android,
                options = BuildOptions.None,
            };
            BuildReport report = BuildPipeline.BuildPlayer(options);
            Debug.Log($"Roost MX build: {report.summary.result}, {report.summary.totalSize / (1024 * 1024)} MB, {report.summary.totalErrors} errors -> {path}");
            if (Application.isBatchMode) EditorApplication.Exit(report.summary.result == BuildResult.Succeeded ? 0 : 1);
        }

        static string Arg(string name)
        {
            var args = Environment.GetCommandLineArgs();
            for (int i = 0; i < args.Length - 1; i++) if (args[i] == name) return args[i + 1];
            return null;
        }
    }
}
