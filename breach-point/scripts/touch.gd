class_name TouchControls
extends Control
## On-screen controls for phones: a floating move stick on the left (push it
## to the top to sprint), drag anywhere on the right to look, and buttons for
## fire (both sides), aim, reload, jump, crouch/slide and inspect. The fire
## button also turns the view while held, so you can shoot and aim together.

signal pause_pressed

const STICK_R := 90.0

var controls: Controls
var _touches := {}          # index -> {role, pos, start}
var _stick_center := Vector2.ZERO
var _stick_pos := Vector2.ZERO
var _stick_active := false
var _buttons := {}
var _font: Font
var shown := false

func setup(c: Controls) -> void:
	controls = c
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	mouse_filter = MOUSE_FILTER_IGNORE
	_font = ThemeDB.fallback_font
	shown = DisplayServer.is_touchscreen_available()
	visible = shown

func _layout() -> void:
	var w := size.x
	var h := size.y
	_buttons = {
		"fire": {"pos": Vector2(w - 200, h - 200), "r": 72.0, "label": "FIRE"},
		"fire_l": {"pos": Vector2(170, h * 0.36), "r": 44.0, "label": "FIRE"},
		"ads": {"pos": Vector2(w - 80, h - 330), "r": 46.0, "label": "AIM"},
		"jump": {"pos": Vector2(w - 85, h - 115), "r": 46.0, "label": "JUMP"},
		"crouch": {"pos": Vector2(w - 340, h - 85), "r": 42.0, "label": "CROUCH"},
		"reload": {"pos": Vector2(w - 345, h - 240), "r": 40.0, "label": "RELOAD"},
		"inspect": {"pos": Vector2(w - 80, h - 445), "r": 32.0, "label": "INSPECT"},
		"pause": {"pos": Vector2(w * 0.5, 42), "r": 28.0, "label": "II"},
	}

func _button_at(p: Vector2) -> String:
	for k in _buttons:
		var b: Dictionary = _buttons[k]
		if p.distance_to(b.pos) <= b.r * 1.2:
			return k
	return ""

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch or event is InputEventScreenDrag:
		if not shown:
			shown = true
			visible = true
	if not visible:
		return
	if event is InputEventScreenTouch:
		_layout()
		var p: Vector2 = event.position
		if event.pressed:
			var b := _button_at(p)
			var role := ""
			if b != "":
				role = b
				_press(b)
			elif p.x < size.x * 0.42:
				role = "stick"
				_stick_active = true
				_stick_center = p
				_stick_pos = p
			else:
				role = "look"
			_touches[event.index] = {"role": role, "pos": p}
		else:
			if _touches.has(event.index):
				_release(_touches[event.index].role)
				_touches.erase(event.index)
		get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag:
		if not _touches.has(event.index):
			return
		var t: Dictionary = _touches[event.index]
		match t.role:
			"stick":
				_stick_pos = event.position
				var v: Vector2 = _stick_pos - _stick_center
				if v.length() > STICK_R * 1.6:
					_stick_center = _stick_pos - v.normalized() * STICK_R * 1.6
					v = _stick_pos - _stick_center
				var mv := (v / STICK_R).limit_length(1.0)
				controls.touch_move = Vector2(mv.x, -mv.y)
				controls.touch_sprint = -v.y > STICK_R * 1.25 and absf(v.x) < -v.y * 0.7
			"look", "fire", "ads":
				var rel: Vector2 = event.relative
				controls.look += Vector2(-rel.x, -rel.y) * controls.touch_sensitivity
		t.pos = event.position
		get_viewport().set_input_as_handled()

func _press(b: String) -> void:
	match b:
		"fire", "fire_l": controls.touch_fire = true
		"ads": controls.touch_ads = not controls.touch_ads
		"jump": controls.jump_pressed = true
		"crouch": controls.crouch_pressed = true
		"reload": controls.reload_pressed = true
		"inspect": controls.inspect_pressed = true
		"pause": pause_pressed.emit()

func _release(role: String) -> void:
	match role:
		"stick":
			_stick_active = false
			controls.touch_move = Vector2.ZERO
			controls.touch_sprint = false
		"fire", "fire_l":
			var still := false
			for t in _touches.values():
				if t.role in ["fire", "fire_l"] and t.role != role:
					still = true
			controls.touch_fire = still

func release_all() -> void:
	_touches.clear()
	_stick_active = false
	controls.touch_move = Vector2.ZERO
	controls.touch_sprint = false
	controls.touch_fire = false

func _process(_d: float) -> void:
	if visible:
		queue_redraw()

func _draw() -> void:
	_layout()
	var held := {}
	for t in _touches.values():
		held[t.role] = true
	for k in _buttons:
		var b: Dictionary = _buttons[k]
		var on: bool = held.has(k) or (k == "ads" and controls.touch_ads)
		var fill := Color(1, 1, 1, 0.28 if on else 0.12)
		if k.begins_with("fire"):
			fill = Color(1, 0.35, 0.25, 0.45 if on else 0.22)
		draw_circle(b.pos, b.r, fill)
		draw_arc(b.pos, b.r, 0, TAU, 48, Color(1, 1, 1, 0.55), 2.0, true)
		var fs := 18 if b.r > 40 else 14
		var ts := _font.get_string_size(b.label, HORIZONTAL_ALIGNMENT_CENTER, -1, fs)
		draw_string(_font, b.pos + Vector2(-ts.x / 2, fs * 0.35), b.label, HORIZONTAL_ALIGNMENT_CENTER, -1, fs, Color(1, 1, 1, 0.85))
	if _stick_active:
		draw_circle(_stick_center, STICK_R, Color(1, 1, 1, 0.1))
		draw_arc(_stick_center, STICK_R, 0, TAU, 48, Color(1, 1, 1, 0.4), 2.0, true)
		var k := _stick_center + (_stick_pos - _stick_center).limit_length(STICK_R)
		draw_circle(k, 38, Color(1, 1, 1, 0.35))
		var sp := _stick_center + Vector2(0, -STICK_R * 1.4)
		var sc := Color(1, 0.85, 0.3, 0.9) if controls.touch_sprint else Color(1, 1, 1, 0.35)
		draw_string(_font, sp + Vector2(-34, 0), "SPRINT", HORIZONTAL_ALIGNMENT_CENTER, -1, 16, sc)
	else:
		var hint := Vector2(200, size.y - 170)
		draw_arc(hint, STICK_R * 0.8, 0, TAU, 48, Color(1, 1, 1, 0.18), 2.0, true)
		draw_string(_font, hint + Vector2(-26, 6), "MOVE", HORIZONTAL_ALIGNMENT_CENTER, -1, 16, Color(1, 1, 1, 0.35))
