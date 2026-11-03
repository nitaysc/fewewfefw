extends CanvasLayer
## On-screen controls for phones. Loaded as the `TouchControls` autoload.
##
## Left side of the screen: a floating move stick (it appears where your thumb lands).
## Right side: drag anywhere to look around.
## Buttons: FIRE (hold to shoot; you can drag on it to aim while firing), JUMP, CROUCH (toggle).
##
## Movement and buttons go through the normal input actions (move_*, shoot, jump,
## crouching), so the player code doesn't need to know where input came from.
## Looking is read by the player with `take_look_delta()`.

## Look speed: radians of turn per pixel dragged (in the 1280x720 base resolution).
@export var look_sensitivity := 0.006
## How far (in pixels) the stick knob can move from its centre.
@export var stick_radius := 80.0

const STICK_DEADZONE := 0.12
# The move_* actions have a 0.5 deadzone; stick output starts just above it so
# a small push already walks slowly instead of doing nothing.
const ACTION_DEADZONE := 0.5

var active := false

var _ui: Control
var _font: Font

# Touch index -> what that finger is doing ("stick", "look", "fire", "jump", "crouch").
var _touches := {}

var _stick_center := Vector2.ZERO
var _stick_knob := Vector2.ZERO
var _stick_vector := Vector2.ZERO

var _look_delta := Vector2.ZERO
var _crouch_on := false


func _ready() -> void:
	layer = 10
	active = DisplayServer.is_touchscreen_available() or OS.get_cmdline_user_args().has("--touch")
	if not active:
		return

	_font = ThemeDB.fallback_font
	_ui = Control.new()
	_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ui.draw.connect(_draw_controls)
	add_child(_ui)
	_reset_stick()
	get_viewport().size_changed.connect(func() -> void:
		if not _touches.values().has("stick"):
			_reset_stick()
		_ui.queue_redraw()
	)


## Returns how far to turn the camera since the last call, in radians (x = yaw, y = pitch).
func take_look_delta() -> Vector2:
	var d := _look_delta
	_look_delta = Vector2.ZERO
	return d


func _screen_size() -> Vector2:
	return _ui.get_viewport_rect().size


# --- Layout -------------------------------------------------------------------------

func _buttons() -> Dictionary:
	var s := _screen_size()
	return {
		"fire": {"pos": Vector2(s.x - 150, s.y - 170), "r": 82.0, "label": "FIRE"},
		"jump": {"pos": Vector2(s.x - 300, s.y - 90), "r": 52.0, "label": "JUMP"},
		"crouch": {"pos": Vector2(s.x - 80, s.y - 330), "r": 46.0, "label": "CROUCH"},
	}


func _button_at(pos: Vector2) -> String:
	var buttons := _buttons()
	for button_name in buttons:
		var b: Dictionary = buttons[button_name]
		# A little extra room around each button so thumbs don't miss.
		if pos.distance_to(b.pos) <= b.r * 1.2:
			return button_name
	return ""


func _stick_rest_position() -> Vector2:
	var s := _screen_size()
	return Vector2(190, s.y - 180)


func _reset_stick() -> void:
	_stick_center = _stick_rest_position()
	_stick_knob = _stick_center
	_set_stick(Vector2.ZERO)


# --- Input --------------------------------------------------------------------------

func _input(event: InputEvent) -> void:
	if not active:
		return

	if event is InputEventScreenTouch:
		if event.pressed:
			_on_touch_down(event.index, event.position)
		else:
			_on_touch_up(event.index)
		get_viewport().set_input_as_handled()
		_ui.queue_redraw()

	elif event is InputEventScreenDrag:
		var role: String = _touches.get(event.index, "")
		match role:
			"stick":
				_move_stick(event.position)
			"look", "fire":
				_look_delta += event.relative * look_sensitivity
		get_viewport().set_input_as_handled()
		_ui.queue_redraw()


func _on_touch_down(index: int, pos: Vector2) -> void:
	var button := _button_at(pos)
	if button != "":
		_touches[index] = button
		match button:
			"fire":
				Input.action_press("shoot")
			"jump":
				Input.action_press("jump")
			"crouch":
				_crouch_on = not _crouch_on
				if _crouch_on:
					Input.action_press("crouching")
				else:
					Input.action_release("crouching")
		return

	if pos.x < _screen_size().x * 0.45 and not _touches.values().has("stick"):
		_touches[index] = "stick"
		_stick_center = pos
		_stick_knob = pos
		_set_stick(Vector2.ZERO)
	else:
		_touches[index] = "look"


func _on_touch_up(index: int) -> void:
	var role: String = _touches.get(index, "")
	_touches.erase(index)
	match role:
		"stick":
			_reset_stick()
		"fire":
			if not _touches.values().has("fire"):
				Input.action_release("shoot")
		"jump":
			Input.action_release("jump")


func _move_stick(pos: Vector2) -> void:
	var offset := pos - _stick_center
	if offset.length() > stick_radius:
		# Drag the stick along with the thumb so it never feels stuck at the edge.
		_stick_center = pos - offset.limit_length(stick_radius)
		offset = offset.limit_length(stick_radius)
	_stick_knob = _stick_center + offset
	_set_stick(offset / stick_radius)


func _set_stick(v: Vector2) -> void:
	_stick_vector = v
	var length := v.length()
	var out := Vector2.ZERO
	if length > STICK_DEADZONE:
		var t := clampf((length - STICK_DEADZONE) / (1.0 - STICK_DEADZONE), 0.0, 1.0)
		out = v.normalized() * lerpf(ACTION_DEADZONE + 0.01, 1.0, t)
	_apply_axis("move_left", "move_right", out.x)
	_apply_axis("move_forward", "move_backward", out.y)


func _apply_axis(negative: String, positive: String, value: float) -> void:
	if value < 0.0:
		Input.action_press(negative, -value)
		Input.action_release(positive)
	elif value > 0.0:
		Input.action_press(positive, value)
		Input.action_release(negative)
	else:
		Input.action_release(negative)
		Input.action_release(positive)


func _notification(what: int) -> void:
	# Don't leave the player running or firing if the app goes to the background.
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and active:
		_touches.clear()
		_reset_stick()
		Input.action_release("shoot")
		Input.action_release("jump")
		_ui.queue_redraw()


# --- Drawing ------------------------------------------------------------------------

func _draw_controls() -> void:
	var pressed: Array = _touches.values()

	# Move stick
	var stick_used := pressed.has("stick")
	_ui.draw_circle(_stick_center, stick_radius, Color(1, 1, 1, 0.12 if stick_used else 0.07))
	_ui.draw_arc(_stick_center, stick_radius, 0, TAU, 48, Color(1, 1, 1, 0.45), 3.0, true)
	_ui.draw_circle(_stick_knob, stick_radius * 0.42, Color(1, 1, 1, 0.55 if stick_used else 0.35))

	# Buttons
	var buttons := _buttons()
	for button_name in buttons:
		var b: Dictionary = buttons[button_name]
		var down: bool = pressed.has(button_name) or (button_name == "crouch" and _crouch_on)
		var fill := Color(1, 1, 1, 0.1)
		if button_name == "fire":
			fill = Color(1.0, 0.35, 0.3, 0.45 if down else 0.25)
		elif down:
			fill = Color(1, 1, 1, 0.35)
		_ui.draw_circle(b.pos, b.r, fill)
		_ui.draw_arc(b.pos, b.r, 0, TAU, 48, Color(1, 1, 1, 0.6), 3.0, true)
		var font_size := 22 if button_name == "fire" else 16
		var text_size := _font.get_string_size(b.label, HORIZONTAL_ALIGNMENT_CENTER, -1, font_size)
		_ui.draw_string(_font, b.pos + Vector2(-text_size.x / 2.0, font_size * 0.35), b.label,
				HORIZONTAL_ALIGNMENT_CENTER, -1, font_size, Color(1, 1, 1, 0.9))
