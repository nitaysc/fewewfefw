// Minimal signatures of Unity *package* APIs used by Roost MX (uGUI, Input System, URP), so
// the scripts can be compile-checked outside Unity. Never shipped: Unity uses the real packages.
#pragma warning disable
using System;
using UnityEngine;

namespace UnityEngine.EventSystems
{
    public class UIBehaviour : MonoBehaviour { }
    public class EventSystem : UIBehaviour { }
    public class BaseInputModule : UIBehaviour { }
    public class StandaloneInputModule : BaseInputModule { }
    public class BaseEventData { }
    public class PointerEventData : BaseEventData { public int pointerId; public Vector2 position; public Camera pressEventCamera; }
    public interface IEventSystemHandler { }
    public interface IPointerDownHandler : IEventSystemHandler { void OnPointerDown(PointerEventData eventData); }
    public interface IPointerUpHandler : IEventSystemHandler { void OnPointerUp(PointerEventData eventData); }
    public interface IDragHandler : IEventSystemHandler { void OnDrag(PointerEventData eventData); }
}

namespace UnityEngine.UI
{
    public class Graphic : EventSystems.UIBehaviour { public Color color; public bool raycastTarget; }
    public class MaskableGraphic : Graphic { }
    public class Image : MaskableGraphic { }
    public class Text : MaskableGraphic
    {
        public Font font; public string text; public int fontSize; public TextAnchor alignment; public FontStyle fontStyle;
        public HorizontalWrapMode horizontalOverflow; public VerticalWrapMode verticalOverflow;
    }
    public class CanvasScaler : EventSystems.UIBehaviour
    {
        public enum ScaleMode { ConstantPixelSize, ScaleWithScreenSize, ConstantPhysicalSize }
        public ScaleMode uiScaleMode; public Vector2 referenceResolution; public float matchWidthOrHeight;
    }
    public class GraphicRaycaster : EventSystems.UIBehaviour { }
    public class BaseMeshEffect : EventSystems.UIBehaviour { }
    public class Shadow : BaseMeshEffect { public Color effectColor; public Vector2 effectDistance; }
    public class Selectable : EventSystems.UIBehaviour { }
    public class Button : Selectable
    {
        public class ButtonClickedEvent { public void AddListener(Action a) { } }
        public ButtonClickedEvent onClick = new ButtonClickedEvent();
    }
}

namespace UnityEngine.InputSystem
{
    namespace Controls
    {
        public class ButtonControl { public bool isPressed; public bool wasPressedThisFrame; public float ReadValue() => 0f; }
        public class KeyControl : ButtonControl { }
        public class StickControl { public Vector2 ReadValue() => default; }
    }
    public class InputDevice { }
    public class Keyboard : InputDevice
    {
        public static Keyboard current;
        public Controls.KeyControl wKey, aKey, sKey, dKey, eKey, qKey, iKey, jKey, kKey, lKey, cKey, rKey, tKey,
            upArrowKey, downArrowKey, leftArrowKey, rightArrowKey, spaceKey, leftShiftKey, leftCtrlKey, escapeKey;
    }
    public class Gamepad : InputDevice
    {
        public static Gamepad current;
        public Controls.ButtonControl rightTrigger, leftTrigger, buttonWest, buttonEast, buttonNorth, buttonSouth,
            leftShoulder, rightShoulder, selectButton, startButton;
        public Controls.StickControl leftStick, rightStick;
    }
    namespace UI { public class InputSystemUIInputModule : EventSystems.BaseInputModule { } }
}

namespace UnityEngine.Rendering.Universal
{
    public abstract class ScriptableRendererData : ScriptableObject { }
    public class UniversalRendererData : ScriptableRendererData { }
    public class UniversalRenderPipelineAsset : UnityEngine.Rendering.RenderPipelineAsset
    {
        public float renderScale; public float shadowDistance; public int msaaSampleCount; public bool supportsHDR;
        public int shadowCascadeCount; public bool supportsCameraDepthTexture; public bool supportsCameraOpaqueTexture;
        public static UniversalRenderPipelineAsset Create(ScriptableRendererData rendererData = null) => null;
        protected override UnityEngine.Rendering.RenderPipeline CreatePipeline() => null;
    }
}
