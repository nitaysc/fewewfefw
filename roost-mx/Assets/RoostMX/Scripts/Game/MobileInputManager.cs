using RoostMX.Sim;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace RoostMX.Game
{
    /// <summary>A UI rectangle that tracks one finger (or the mouse) and reports its position.</summary>
    public sealed class TouchZone : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public bool Pressed;
        public Vector2 Local, DownLocal;   // in the rect's local space, origin at its centre
        public Vector2 Size => ((RectTransform)transform).rect.size;
        public int PressCount;             // increments on every touch-down (read as taps)
        int pointer = int.MinValue;

        public void OnPointerDown(PointerEventData e)
        {
            if (Pressed) return;
            pointer = e.pointerId; Pressed = true; PressCount++;
            Local = DownLocal = ToLocal(e);
        }
        public void OnDrag(PointerEventData e) { if (e.pointerId == pointer) Local = ToLocal(e); }
        public void OnPointerUp(PointerEventData e) { if (e.pointerId == pointer) { Pressed = false; pointer = int.MinValue; } }
        void OnDisable() { Pressed = false; pointer = int.MinValue; }

        Vector2 ToLocal(PointerEventData e)
        {
            RectTransformUtility.ScreenPointToLocalPointInRectangle((RectTransform)transform, e.position, e.pressEventCamera, out var p);
            return p;
        }
    }

    /// <summary>
    /// Merges touch, gamepad and keyboard into one BikeInput. Touch layout (landscape):
    /// left thumb steers (drag left/right from wherever you touch) with a rider-weight stick
    /// above it; right thumb has an analog throttle strip and the brakes; gear, clutch, stand,
    /// camera, respawn and pause buttons along the edges.
    /// </summary>
    public sealed class MobileInputManager : MonoBehaviour
    {
        public Assists Assists;
        TouchZone steer, rider, throttle, frontBrake, rearBrake, clutch, gearUp, gearDown, stand, cam, reset, pause, telemetry;
        RectTransform steerKnob, riderKnob, throttleFill, clutchFill;
        Image standImg;
        float kbThrottle, kbBrake, kbSteer;
        bool standToggled;
        bool latchUp, latchDown, latchCam, latchReset, latchPause, latchTelemetry;
        public bool ShowManualControls = false;
        GameObject manualGroup;

        public event System.Action CameraPressed, ResetPressed, PausePressed, TelemetryPressed;

        public Canvas Build()
        {
            var canvasGo = new GameObject("TouchControls", typeof(RectTransform));
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920, 1080);
            scaler.matchWidthOrHeight = 1f;
            canvasGo.AddComponent<GraphicRaycaster>();
            var root = (RectTransform)canvasGo.transform;

            Color pad = new Color(1f, 1f, 1f, 0.10f), padEdge = new Color(1f, 1f, 1f, 0.22f), accent = new Color(1f, 0.45f, 0.1f, 0.85f);
            steer = Zone(root, "Steer", new Vector2(0, 0), new Vector2(60, 50), new Vector2(620, 300), pad);
            Label(steer.transform, "STEER / LEAN");
            steerKnob = Knob(steer.transform, 90, padEdge);
            rider = Zone(root, "Rider", new Vector2(0, 0), new Vector2(80, 390), new Vector2(240, 240), pad);
            Label(rider.transform, "BODY");
            riderKnob = Knob(rider.transform, 70, padEdge);

            throttle = Zone(root, "Throttle", new Vector2(1, 0), new Vector2(-60, 50), new Vector2(190, 430), pad);
            throttleFill = Fill(throttle.transform, accent);
            Label(throttle.transform, "GAS");
            frontBrake = Zone(root, "FrontBrake", new Vector2(1, 0), new Vector2(-280, 230), new Vector2(190, 160), new Color(1f, 0.2f, 0.2f, 0.18f));
            Label(frontBrake.transform, "FRONT\nBRAKE");
            rearBrake = Zone(root, "RearBrake", new Vector2(1, 0), new Vector2(-280, 50), new Vector2(190, 160), new Color(1f, 0.2f, 0.2f, 0.12f));
            Label(rearBrake.transform, "REAR\nBRAKE");
            stand = Zone(root, "Stand", new Vector2(1, 0), new Vector2(-500, 50), new Vector2(170, 120), pad);
            standImg = stand.GetComponent<Image>();
            Label(stand.transform, "STAND");

            manualGroup = new GameObject("Manual", typeof(RectTransform));
            manualGroup.transform.SetParent(root, false);
            var mg = (RectTransform)manualGroup.transform;
            mg.anchorMin = Vector2.zero; mg.anchorMax = Vector2.one; mg.offsetMin = mg.offsetMax = Vector2.zero;
            gearUp = Zone(mg, "GearUp", new Vector2(1, 0), new Vector2(-500, 360), new Vector2(150, 110), pad); Label(gearUp.transform, "GEAR +");
            gearDown = Zone(mg, "GearDown", new Vector2(1, 0), new Vector2(-500, 200), new Vector2(150, 110), pad); Label(gearDown.transform, "GEAR -");
            clutch = Zone(mg, "Clutch", new Vector2(0, 0), new Vector2(360, 390), new Vector2(130, 240), pad); Label(clutch.transform, "CLUTCH");
            clutchFill = Fill(clutch.transform, new Color(0.3f, 0.7f, 1f, 0.8f));

            cam = Zone(root, "Camera", new Vector2(1, 1), new Vector2(-40, -40), new Vector2(150, 90), pad); Label(cam.transform, "CAM");
            reset = Zone(root, "Reset", new Vector2(1, 1), new Vector2(-210, -40), new Vector2(150, 90), pad); Label(reset.transform, "RESET");
            pause = Zone(root, "Pause", new Vector2(0, 1), new Vector2(40, -40), new Vector2(110, 90), pad); Label(pause.transform, "II");
            telemetry = Zone(root, "Telemetry", new Vector2(0, 1), new Vector2(170, -40), new Vector2(110, 90), pad); Label(telemetry.transform, "DATA");
            return canvas;
        }

        TouchZone Zone(RectTransform parent, string name, Vector2 anchor, Vector2 offset, Vector2 size, Color c)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = anchor;
            rt.pivot = anchor;
            rt.anchoredPosition = offset;
            rt.sizeDelta = size;
            var img = go.AddComponent<Image>();
            img.color = c;
            return go.AddComponent<TouchZone>();
        }

        RectTransform Knob(Transform parent, float size, Color c)
        {
            var go = new GameObject("Knob", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = new Vector2(size, size);
            var img = go.AddComponent<Image>(); img.color = c; img.raycastTarget = false;
            return rt;
        }

        RectTransform Fill(Transform parent, Color c)
        {
            var go = new GameObject("Fill", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = new Vector2(0, 0); rt.anchorMax = new Vector2(1, 0); rt.pivot = new Vector2(0.5f, 0);
            rt.sizeDelta = new Vector2(0, 0);
            var img = go.AddComponent<Image>(); img.color = c; img.raycastTarget = false;
            return rt;
        }

        public static Text Label(Transform parent, string text, int size = 26, TextAnchor anchor = TextAnchor.MiddleCenter)
        {
            var go = new GameObject("Label", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = rt.offsetMax = Vector2.zero;
            var t = go.AddComponent<Text>();
            t.font = UiFont;
            t.text = text; t.fontSize = size; t.alignment = anchor;
            t.color = new Color(1f, 1f, 1f, 0.85f);
            t.raycastTarget = false;
            return t;
        }

        static Font uiFont;
        public static Font UiFont
        {
            get
            {
                if (uiFont != null) return uiFont;
                foreach (var name in new[] { "LegacyRuntime.ttf", "Arial.ttf" })
                {
                    try { uiFont = Resources.GetBuiltinResource<Font>(name); } catch (System.Exception) { }
                    if (uiFont != null) break;
                }
                if (uiFont == null) uiFont = Font.CreateDynamicFontFromOSFont("Roboto", 32);
                return uiFont;
            }
        }

        // ------------------------------------------------------------------------------
        void Update()
        {
            if (manualGroup != null && Assists != null)
                manualGroup.SetActive(!Assists.AutoGearbox || !Assists.AutoClutch || ShowManualControls);
            if (Tapped(gearUp, ref seenUp)) latchUp = true;
            if (Tapped(gearDown, ref seenDown)) latchDown = true;
            if (Tapped(stand, ref seenStand)) standToggled = !standToggled;
            if (Tapped(cam, ref seenCam)) latchCam = true;
            if (Tapped(reset, ref seenReset)) latchReset = true;
            if (Tapped(pause, ref seenPause)) latchPause = true;
            if (Tapped(telemetry, ref seenTelemetry)) latchTelemetry = true;
            PollDevices();
            if (latchCam) { latchCam = false; CameraPressed?.Invoke(); }
            if (latchReset) { latchReset = false; ResetPressed?.Invoke(); }
            if (latchPause) { latchPause = false; PausePressed?.Invoke(); }
            if (latchTelemetry) { latchTelemetry = false; TelemetryPressed?.Invoke(); }
            if (standImg != null) standImg.color = standToggled ? new Color(1f, 0.45f, 0.1f, 0.45f) : new Color(1f, 1f, 1f, 0.10f);
        }

        int seenUp, seenDown, seenStand, seenCam, seenReset, seenPause, seenTelemetry;
        static bool Tapped(TouchZone z, ref int seen)
        {
            if (z == null || z.PressCount == seen) return false;
            seen = z.PressCount; return true;
        }

        // device state sampled in Update, consumed in FixedUpdate
        float devThrottle, devFront, devRear, devClutch, devSteer, devLean, devForeAft;
        bool devStandHold;

        void PollDevices()
        {
            float dt = Time.unscaledDeltaTime;
            devThrottle = devFront = devRear = devClutch = devSteer = devLean = devForeAft = 0f;
#if ENABLE_INPUT_SYSTEM
            var kb = Keyboard.current;
            if (kb != null)
            {
                bool up = kb.wKey.isPressed || kb.upArrowKey.isPressed;
                bool down = kb.sKey.isPressed || kb.downArrowKey.isPressed;
                float steerK = (kb.dKey.isPressed || kb.rightArrowKey.isPressed ? 1f : 0f) - (kb.aKey.isPressed || kb.leftArrowKey.isPressed ? 1f : 0f);
                kbThrottle = Mathf.MoveTowards(kbThrottle, up ? 1f : 0f, dt * 6f);
                kbBrake = Mathf.MoveTowards(kbBrake, down ? 1f : 0f, dt * 6f);
                kbSteer = Mathf.MoveTowards(kbSteer, steerK, dt * 4f);
                devThrottle = kbThrottle; devFront = kbBrake; devSteer = kbSteer;
                if (kb.spaceKey.isPressed) devRear = 1f;
                if (kb.leftShiftKey.isPressed) devClutch = 1f;
                devForeAft = (kb.iKey.isPressed ? 1f : 0f) - (kb.kKey.isPressed ? 1f : 0f);
                devLean = (kb.lKey.isPressed ? 1f : 0f) - (kb.jKey.isPressed ? 1f : 0f);
                if (kb.eKey.wasPressedThisFrame) latchUp = true;
                if (kb.qKey.wasPressedThisFrame) latchDown = true;
                if (kb.leftCtrlKey.wasPressedThisFrame) standToggled = !standToggled;
                if (kb.cKey.wasPressedThisFrame) latchCam = true;
                if (kb.rKey.wasPressedThisFrame) latchReset = true;
                if (kb.escapeKey.wasPressedThisFrame) latchPause = true;
                if (kb.tKey.wasPressedThisFrame) latchTelemetry = true;
            }
            var gp = Gamepad.current;
            if (gp != null)
            {
                devThrottle = Mathf.Max(devThrottle, gp.rightTrigger.ReadValue());
                devFront = Mathf.Max(devFront, gp.leftTrigger.ReadValue());
                if (gp.buttonWest.isPressed) devRear = 1f;
                if (gp.leftShoulder.isPressed) devClutch = 1f;
                Vector2 ls = gp.leftStick.ReadValue(), rs = gp.rightStick.ReadValue();
                if (Mathf.Abs(ls.x) > Mathf.Abs(devSteer)) devSteer = ls.x;
                if (rs.sqrMagnitude > 0.01f) { devLean = rs.x; devForeAft = rs.y; }
                devStandHold = gp.buttonSouth.isPressed;
                if (gp.buttonNorth.wasPressedThisFrame) latchUp = true;
                if (gp.buttonEast.wasPressedThisFrame) latchDown = true;
                if (gp.selectButton.wasPressedThisFrame) latchCam = true;
                if (gp.startButton.wasPressedThisFrame) latchPause = true;
                if (gp.rightShoulder.wasPressedThisFrame) standToggled = !standToggled;
            }
#elif ENABLE_LEGACY_INPUT_MANAGER
            bool up = Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow);
            bool down = Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow);
            float steerK = (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow) ? 1f : 0f) - (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow) ? 1f : 0f);
            kbThrottle = Mathf.MoveTowards(kbThrottle, up ? 1f : 0f, dt * 6f);
            kbBrake = Mathf.MoveTowards(kbBrake, down ? 1f : 0f, dt * 6f);
            kbSteer = Mathf.MoveTowards(kbSteer, steerK, dt * 4f);
            devThrottle = kbThrottle; devFront = kbBrake; devSteer = kbSteer;
            if (Input.GetKey(KeyCode.Space)) devRear = 1f;
            if (Input.GetKey(KeyCode.LeftShift)) devClutch = 1f;
            devForeAft = (Input.GetKey(KeyCode.I) ? 1f : 0f) - (Input.GetKey(KeyCode.K) ? 1f : 0f);
            devLean = (Input.GetKey(KeyCode.L) ? 1f : 0f) - (Input.GetKey(KeyCode.J) ? 1f : 0f);
            if (Input.GetKeyDown(KeyCode.E)) latchUp = true;
            if (Input.GetKeyDown(KeyCode.Q)) latchDown = true;
            if (Input.GetKeyDown(KeyCode.LeftControl)) standToggled = !standToggled;
            if (Input.GetKeyDown(KeyCode.C)) latchCam = true;
            if (Input.GetKeyDown(KeyCode.R)) latchReset = true;
            if (Input.GetKeyDown(KeyCode.Escape)) latchPause = true;
            if (Input.GetKeyDown(KeyCode.T)) latchTelemetry = true;
#endif
        }

        /// <summary>Called from FixedUpdate. Edge inputs (gear shifts) are delivered once.</summary>
        public BikeInput Read()
        {
            var i = new BikeInput();
            float touchSteer = 0f, touchThr = 0f;
            if (steer != null && steer.Pressed)
            {
                float radius = steer.Size.x * 0.28f;
                touchSteer = Mathf.Clamp((steer.Local.x - steer.DownLocal.x) / radius, -1f, 1f);
                steerKnob.anchoredPosition = new Vector2(steer.DownLocal.x + touchSteer * radius, steer.DownLocal.y);
            }
            else if (steerKnob != null) steerKnob.anchoredPosition = Vector2.zero;
            if (rider != null && rider.Pressed)
            {
                Vector2 v = rider.Local / (rider.Size.x * 0.4f);
                v = Vector2.ClampMagnitude(v, 1f);
                i.RiderLean = v.x; i.RiderForeAft = v.y;
                riderKnob.anchoredPosition = v * rider.Size.x * 0.4f;
            }
            else if (riderKnob != null) riderKnob.anchoredPosition = Vector2.zero;
            if (throttle != null && throttle.Pressed)
            {
                float h = throttle.Size.y;
                touchThr = Mathf.Clamp01((throttle.Local.y + h * 0.5f) / h * 1.15f - 0.08f);
            }
            if (throttleFill != null) throttleFill.sizeDelta = new Vector2(0, throttle.Size.y * Mathf.Max(touchThr, devThrottle));
            float clutchTouch = 0f;
            if (clutch != null && clutch.Pressed && clutch.gameObject.activeInHierarchy)
                clutchTouch = Mathf.Clamp01((clutch.Local.y + clutch.Size.y * 0.5f) / clutch.Size.y);
            if (clutchFill != null) clutchFill.sizeDelta = new Vector2(0, clutch.Size.y * Mathf.Max(clutchTouch, devClutch));

            i.Throttle = Mathf.Max(touchThr, devThrottle);
            i.FrontBrake = Mathf.Max(frontBrake != null && frontBrake.Pressed ? 1f : 0f, devFront);
            i.RearBrake = Mathf.Max(rearBrake != null && rearBrake.Pressed ? 1f : 0f, devRear);
            i.Clutch = Mathf.Max(clutchTouch, devClutch);
            i.Steer = Mathf.Abs(touchSteer) > Mathf.Abs(devSteer) ? touchSteer : devSteer;
            if (Mathf.Abs(devLean) > Mathf.Abs(i.RiderLean)) i.RiderLean = devLean;
            if (Mathf.Abs(devForeAft) > Mathf.Abs(i.RiderForeAft)) i.RiderForeAft = devForeAft;
            i.Stand = standToggled ^ devStandHold;
            i.ShiftUp = latchUp; i.ShiftDown = latchDown;
            latchUp = latchDown = false;
            return i;
        }

        public void SetStanding(bool s) => standToggled = s;
    }
}
