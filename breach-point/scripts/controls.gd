class_name Controls
extends Node
## What the player wants to do this frame, from the touch screen or keyboard and mouse.
## The player and the weapon only read from here, so both input methods behave the same.

var move := Vector2.ZERO          # x = right, y = forward, length up to 1
var look := Vector2.ZERO          # accumulated look in degrees since last frame (x = yaw, y = pitch)
var fire := false
var ads := false
var sprint := false
var crouch_held := false

# one-shot presses, cleared after the frame reads them
var jump_pressed := false
var reload_pressed := false
var inspect_pressed := false
var crouch_pressed := false

var mouse_sensitivity := 0.12
var touch_sensitivity := 0.22
var ads_toggle := true            # on touch screens ADS is a toggle, on mouse it is held

var _mouse_ads := false
var _kb_move := Vector2.ZERO
var touch_move := Vector2.ZERO
var touch_sprint := false
var touch_fire := false
var touch_ads := false
var enabled := true

func consume() -> void:
	look = Vector2.ZERO
	jump_pressed = false
	reload_pressed = false
	inspect_pressed = false
	crouch_pressed = false

func _process(_delta: float) -> void:
	_kb_move = Vector2(
		float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)),
		float(Input.is_physical_key_pressed(KEY_W)) - float(Input.is_physical_key_pressed(KEY_S)))
	move = touch_move if touch_move.length() > _kb_move.length() else _kb_move.limit_length(1.0)
	sprint = touch_sprint or (Input.is_physical_key_pressed(KEY_SHIFT) and move.y > 0.3)
	crouch_held = Input.is_physical_key_pressed(KEY_C) or Input.is_physical_key_pressed(KEY_CTRL)
	fire = touch_fire or (Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT))
	ads = touch_ads or _mouse_ads
	if not enabled:
		move = Vector2.ZERO; fire = false; sprint = false

func _unhandled_input(event: InputEvent) -> void:
	if not enabled:
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		look += Vector2(-event.relative.x, -event.relative.y) * mouse_sensitivity
	elif event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_RIGHT:
			_mouse_ads = event.pressed
		elif event.pressed and event.button_index == MOUSE_BUTTON_LEFT and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED and not DisplayServer.is_touchscreen_available():
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_SPACE: jump_pressed = true
			KEY_R: reload_pressed = true
			KEY_F: inspect_pressed = true
			KEY_C, KEY_CTRL: crouch_pressed = true
			KEY_ESCAPE: Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
