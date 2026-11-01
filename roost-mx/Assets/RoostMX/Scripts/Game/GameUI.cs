using System;
using System.Collections.Generic;
using RoostMX.Sim;
using UnityEngine;
using UnityEngine.UI;

namespace RoostMX.Game
{
    /// <summary>Lap timing for Free Ride: a lap counts when the bike crosses the start line after riding most of the track.</summary>
    public sealed class LapTimer
    {
        readonly RoostMX.Sim.Track.TrackLayout track;
        int sample = -1;
        float covered;
        public float Current, Last = -1f, Best = -1f;
        public int Laps;
        public bool Running;
        readonly string key;

        public LapTimer(RoostMX.Sim.Track.TrackLayout t, string bike)
        {
            track = t; key = "rmx.best." + bike;
            Best = PlayerPrefs.GetFloat(key, -1f);
        }

        public void Reset() { sample = -1; covered = 0f; Current = 0f; Running = false; }

        public void Update(Vector3 pos, float dt, bool crashed)
        {
            int m = track.Points.Length;
            int best = sample; float bd = float.MaxValue;
            if (sample < 0) best = track.NearestSample(Conv.N(pos));
            else
                for (int k = -15; k <= 40; k++)
                {
                    int i = (sample + k + m) % m;
                    float dx = track.Points[i].X - pos.x, dz = track.Points[i].Z - pos.z;
                    float d = dx * dx + dz * dz;
                    if (d < bd) { bd = d; best = i; }
                }
            if (sample >= 0)
            {
                int adv = (best - sample + m) % m;
                if (adv < m / 2)
                {
                    covered += adv * track.Length / m;
                    if (best < sample && covered > track.Length * 0.8f)
                    {
                        if (Running)
                        {
                            Last = Current; Laps++;
                            if (Best < 0f || Last < Best) { Best = Last; PlayerPrefs.SetFloat(key, Best); }
                        }
                        Running = true; Current = 0f; covered = 0f;
                    }
                }
                else covered -= (m - adv) * track.Length / m;
            }
            else if (best < 10) Running = true;
            sample = best;
            if (Running) Current += dt;
        }

        public static string Format(float t) => t < 0f ? "--:--.---" : $"{(int)(t / 60f):00}:{t % 60f:00.000}";
    }

    /// <summary>
    /// HUD (speed, gear, rpm, lap times, telemetry) and the pause menu with assists, bike,
    /// camera and graphics options. Built in code with uGUI.
    /// </summary>
    public sealed class GameUI : MonoBehaviour
    {
        public BikeController Bike;
        public LapTimer Laps;
        public GameSettings Settings;
        public event Action SettingsChanged, BikeChanged, CameraChanged;

        Text speedText, gearText, lapText, bestText, infoText, telemetryText, crashText, assistText;
        RectTransform rpmFill;
        GameObject telemetryPanel, pausePanel;
        readonly List<(Text label, Func<string> get)> menuItems = new List<(Text, Func<string>)>();
        public bool Paused => pausePanel != null && pausePanel.activeSelf;

        public void Build()
        {
            var canvasGo = new GameObject("HUD", typeof(RectTransform));
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 5;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 1f;
            canvasGo.AddComponent<GraphicRaycaster>();
            var root = (RectTransform)canvasGo.transform;

            // speed / gear / rpm cluster, lower centre-right like a dash
            var dash = Panel(root, new Vector2(0.5f, 0f), new Vector2(330, 40), new Vector2(420, 150), new Color(0, 0, 0, 0.35f));
            gearText = TextAt(dash, "1", 110, new Vector2(10, 0), new Vector2(120, 150), TextAnchor.MiddleCenter, FontStyle.Bold);
            speedText = TextAt(dash, "000", 72, new Vector2(140, 25), new Vector2(200, 100), TextAnchor.MiddleLeft, FontStyle.Bold);
            TextAt(dash, "KM/H", 24, new Vector2(140, -35), new Vector2(200, 40), TextAnchor.MiddleLeft, FontStyle.Normal);
            var rpmBack = Panel(dash, new Vector2(0f, 0f), new Vector2(140, 10), new Vector2(260, 12), new Color(1, 1, 1, 0.15f));
            rpmBack.pivot = new Vector2(0, 0);
            rpmFill = Panel(rpmBack, new Vector2(0f, 0f), Vector2.zero, new Vector2(0, 12), new Color(1f, 0.45f, 0.1f, 0.95f));
            rpmFill.pivot = new Vector2(0, 0);

            // lap times, lower centre-left
            var laps = Panel(root, new Vector2(0.5f, 0f), new Vector2(-330, 40), new Vector2(420, 110), new Color(0, 0, 0, 0.35f));
            lapText = TextAt(laps, "CURRENT  --:--.---", 34, new Vector2(20, 22), new Vector2(390, 50), TextAnchor.MiddleLeft, FontStyle.Bold);
            bestText = TextAt(laps, "BEST     --:--.---", 34, new Vector2(20, -24), new Vector2(390, 50), TextAnchor.MiddleLeft, FontStyle.Normal);

            infoText = TextAt(root, "", 26, new Vector2(0, -40), new Vector2(900, 40), TextAnchor.UpperCenter, FontStyle.Normal, new Vector2(0.5f, 1f));
            assistText = TextAt(root, "", 22, new Vector2(0, -80), new Vector2(900, 30), TextAnchor.UpperCenter, FontStyle.Normal, new Vector2(0.5f, 1f));
            crashText = TextAt(root, "", 64, new Vector2(0, 120), new Vector2(1200, 90), TextAnchor.MiddleCenter, FontStyle.Bold, new Vector2(0.5f, 0.5f));

            telemetryPanel = Panel(root, new Vector2(1f, 1f), new Vector2(-40, -150), new Vector2(560, 520), new Color(0, 0, 0, 0.55f)).gameObject;
            telemetryText = TextAt((RectTransform)telemetryPanel.transform, "", 22, new Vector2(0, 0), new Vector2(530, 500), TextAnchor.UpperLeft, FontStyle.Normal);
            telemetryText.font = MobileInputManager.UiFont;
            telemetryPanel.SetActive(Settings.Telemetry);

            BuildPause(root);
        }

        RectTransform Panel(RectTransform parent, Vector2 anchor, Vector2 pos, Vector2 size, Color c)
        {
            var go = new GameObject("Panel", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = anchor; rt.pivot = anchor;
            rt.anchoredPosition = pos; rt.sizeDelta = size;
            var img = go.AddComponent<Image>(); img.color = c; img.raycastTarget = false;
            return rt;
        }

        Text TextAt(RectTransform parent, string s, int size, Vector2 pos, Vector2 box, TextAnchor anchor, FontStyle style, Vector2? anchorPt = null)
        {
            var go = new GameObject("Text", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            Vector2 a = anchorPt ?? new Vector2(0f, 0.5f);
            rt.anchorMin = rt.anchorMax = a; rt.pivot = a;
            rt.anchoredPosition = pos; rt.sizeDelta = box;
            var t = go.AddComponent<Text>();
            t.font = MobileInputManager.UiFont; t.fontSize = size; t.alignment = anchor; t.fontStyle = style;
            t.color = Color.white; t.text = s; t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow;
            var sh = go.AddComponent<Shadow>(); sh.effectColor = new Color(0, 0, 0, 0.6f); sh.effectDistance = new Vector2(2, -2);
            return t;
        }

        void BuildPause(RectTransform root)
        {
            var p = Panel(root, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(900, 900), new Color(0.04f, 0.04f, 0.06f, 0.92f));
            pausePanel = p.gameObject;
            TextAt(p, "ROOST MX  -  PAUSED", 48, new Vector2(0, -50), new Vector2(860, 70), TextAnchor.MiddleCenter, FontStyle.Bold, new Vector2(0.5f, 1f));
            var a = Settings.Assists;
            float y = -140;
            void Item(string name, Func<string> get, Action act)
            {
                var b = Panel(p, new Vector2(0.5f, 1f), new Vector2(0, y), new Vector2(760, 64), new Color(1, 1, 1, 0.08f));
                var img = b.GetComponent<Image>(); img.raycastTarget = true;
                var btn = b.gameObject.AddComponent<Button>();
                var label = TextAt(b, "", 30, new Vector2(0, 0), new Vector2(740, 60), TextAnchor.MiddleCenter, FontStyle.Normal, new Vector2(0.5f, 0.5f));
                menuItems.Add((label, () => $"{name}: {get()}"));
                btn.onClick.AddListener(() => { act(); Settings.Save(); RefreshMenu(); });
                y -= 72;
            }
            string OnOff(bool v) => v ? "ON" : "OFF";
            Item("RESUME", () => "", () => SetPaused(false));
            Item("BIKE", () => Settings.Bike, () => { Settings.Bike = Settings.Bike == "450F" ? "250F" : "450F"; BikeChanged?.Invoke(); });
            Item("AUTO GEARBOX", () => OnOff(a.AutoGearbox), () => { a.AutoGearbox = !a.AutoGearbox; SettingsChanged?.Invoke(); });
            Item("AUTO CLUTCH", () => OnOff(a.AutoClutch), () => { a.AutoClutch = !a.AutoClutch; SettingsChanged?.Invoke(); });
            Item("STEERING ASSIST (LEAN CONTROL)", () => OnOff(a.SteeringAssist), () => { a.SteeringAssist = !a.SteeringAssist; SettingsChanged?.Invoke(); });
            Item("BALANCE ASSIST", () => OnOff(a.BalanceAssist), () => { a.BalanceAssist = !a.BalanceAssist; SettingsChanged?.Invoke(); });
            Item("BRAKE ASSIST", () => OnOff(a.BrakeAssist), () => { a.BrakeAssist = !a.BrakeAssist; SettingsChanged?.Invoke(); });
            Item("WHEELIE ASSIST", () => OnOff(a.WheelieAssist), () => { a.WheelieAssist = !a.WheelieAssist; SettingsChanged?.Invoke(); });
            Item("GRAPHICS", () => GameSettings.QualityNames[Settings.Quality], () => { Settings.Quality = (Settings.Quality + 1) % 4; SettingsChanged?.Invoke(); });
            Item("FRAME RATE", () => Settings.TargetFps + " FPS", () => { Settings.TargetFps = Settings.TargetFps == 60 ? 30 : 60; SettingsChanged?.Invoke(); });
            Item("CAMERA", () => ((CameraController.Mode)Settings.CameraMode).ToString().ToUpper(), () => { Settings.CameraMode = (Settings.CameraMode + 1) % 3; CameraChanged?.Invoke(); });
            RefreshMenu();
            pausePanel.SetActive(false);
        }

        void RefreshMenu()
        {
            foreach (var (label, get) in menuItems) label.text = get();
        }

        public void SetPaused(bool p)
        {
            pausePanel.SetActive(p);
            Time.timeScale = p ? 0f : 1f;
            AudioListener.pause = p;
            RefreshMenu();
        }

        public void ToggleTelemetry()
        {
            Settings.Telemetry = !Settings.Telemetry;
            telemetryPanel.SetActive(Settings.Telemetry);
            Settings.Save();
        }

        void Update()
        {
            if (Bike == null || Bike.Sim == null) return;
            var s = Bike.Sim;
            speedText.text = Mathf.RoundToInt(Mathf.Abs(s.Speed) * 3.6f).ToString("000");
            gearText.text = s.Gearbox.Gear == 0 ? "N" : s.Gearbox.Gear.ToString();
            float rpmFrac = Mathf.Clamp01(s.Engine.Rpm / s.Spec.Engine.RevLimit);
            rpmFill.sizeDelta = new Vector2(260f * rpmFrac, 12f);
            rpmFill.GetComponent<Image>().color = rpmFrac > 0.92f ? new Color(1f, 0.15f, 0.1f) : new Color(1f, 0.45f, 0.1f, 0.95f);
            if (Laps != null)
            {
                lapText.text = "CURRENT  " + LapTimer.Format(Laps.Running ? Laps.Current : -1f);
                bestText.text = "BEST     " + LapTimer.Format(Laps.Best);
            }
            infoText.text = $"FREE RIDE   {s.Spec.Name}   LAP {(Laps != null ? Laps.Laps + 1 : 1)}";
            var a = s.Assists;
            assistText.text = (a.AutoGearbox ? "AUTO-SHIFT " : "MANUAL ") + (a.AutoClutch ? "" : "CLUTCH ") + (a.SteeringAssist ? "" : "RAW-STEER ") + (s.StandingCmd ? "  STANDING" : "  SEATED");
            crashText.text = s.Crashed ? $"CRASH - {s.CrashReason.ToUpper()}" : (s.Engine.Stalled ? "STALLED - PULL THE CLUTCH" : "");

            if (telemetryPanel.activeSelf)
            {
                var f = s.Front; var r = s.Rear;
                telemetryText.text =
                    $"rpm {s.Engine.Rpm,6:0}  thr {s.ThrottleCmd:0.00}  clutch {s.Clutch.Engagement:0.00}{(s.Clutch.Slipping ? " slip" : "")}\n" +
                    $"lean {s.Lean * Mathf.Rad2Deg,5:0.0}  want {s.TargetLean * Mathf.Rad2Deg,5:0.0}  pitch {s.Pitch * Mathf.Rad2Deg,5:0.0}\n" +
                    $"steer {f.SteerAngle * Mathf.Rad2Deg,5:0.0} deg  air {(s.Airborne ? s.AirTime.ToString("0.00") + " s" : "-")}\n" +
                    $"            FRONT        REAR\n" +
                    $"load N   {f.Load,7:0}    {r.Load,7:0}\n" +
                    $"comp mm  {f.Compression * 1000f,7:0}    {r.Compression * 1000f,7:0}\n" +
                    $"slip     {f.SlipRatio,7:0.00}    {r.SlipRatio,7:0.00}\n" +
                    $"alpha    {Mathf.Atan(f.TanSlipAngle) * Mathf.Rad2Deg,7:0.0}    {Mathf.Atan(r.TanSlipAngle) * Mathf.Rad2Deg,7:0.0}\n" +
                    $"grip use {f.Rho,7:0.00}    {r.Rho,7:0.00}\n" +
                    $"surface  {f.SurfaceType,7}    {r.SurfaceType,7}\n" +
                    $"wheel    {f.Omega * f.Spec.Radius * 3.6f,7:0} km/h {r.Omega * r.Spec.Radius * 3.6f,4:0} km/h\n" +
                    $"rider standing {s.Rider.Standing:0.00}\n" +
                    $"torso  p {s.Rider.BodyAngle.X * Mathf.Rad2Deg,5:0} y {s.Rider.BodyAngle.Y * Mathf.Rad2Deg,5:0} r {s.Rider.BodyAngle.Z * Mathf.Rad2Deg,5:0}\n" +
                    $"fps {1f / Mathf.Max(1e-4f, Time.smoothDeltaTime),4:0}";
            }
        }
    }
}
