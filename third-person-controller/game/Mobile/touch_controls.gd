extends Control
class_name TouchControls

## On-screen controls for phones and tablets.
##
## Everything is handled from raw InputEventScreenTouch / InputEventScreenDrag
## so several fingers work at once (move + look + jump). The controls drive the
## same input actions the keyboard uses, so player.gd needs almost no changes.
##
## Left side of the screen: a floating joystick (put your thumb anywhere there).
## Right side: drag anywhere that is not a button to turn the camera.

signal menu_requested

const LOOK_SENSITIVITY := 0.0045   # radians per viewport pixel
const STICK_RADIUS := 150.0
const KNOB_RADIUS := 62.0
const STICK_ZONE := 0.45           # left fraction of the screen used by the stick

const COL_FILL := Color(0.08, 0.09, 0.12, 0.45)
const COL_FILL_DOWN := Color(1.0, 1.0, 1.0, 0.35)
const COL_FILL_ON := Color(0.30, 0.70, 1.0, 0.45)
const COL_EDGE := Color(1, 1, 1, 0.55)
const COL_TEXT := Color(1, 1, 1, 0.92)

var player: Node = null

# Buttons: name -> {pos, r, label, action, mode, finger, on, visible}
#   mode "hold":   action held while the finger is down
#   mode "toggle": tap to turn the action on/off (stays held while on)
#   mode "tap":    calls a function
var buttons: Dictionary = {}

var stick_finger := -1
var stick_center := Vector2.ZERO
var stick_vec := Vector2.ZERO
var look_fingers: Dictionary = {}   # finger index -> last position
var emotes_open := false
var safe := Rect2()                 # safe drawing area in viewport coords


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_strip_mouse_bindings()
	get_viewport().size_changed.connect(_layout)
	_layout()


# Taps are also turned into fake mouse clicks by Android so the menus work.
# In game those fake clicks would punch / aim / zoom, so take the mouse
# buttons off those actions while the touch controls are on screen.
func _strip_mouse_bindings() -> void:
	for action in ["attack", "right_mouse", "scroll_up", "scroll_down"]:
		if not InputMap.has_action(action): continue
		for ev in InputMap.action_get_events(action):
			if ev is InputEventMouseButton:
				InputMap.action_erase_event(action, ev)


func _layout() -> void:
	var size_v := get_viewport_rect().size
	size = size_v
	# Keep away from notches and rounded corners.
	var m := Vector2(40, 30)
	var win := Vector2(DisplayServer.window_get_size())
	var sa := Rect2(DisplayServer.get_display_safe_area())
	if win.x > 0 and win.y > 0 and sa.size.x > 0:
		var k := size_v / win
		var left := maxf(sa.position.x * k.x, 0.0)
		var top := maxf(sa.position.y * k.y, 0.0)
		var right := maxf((win.x - sa.end.x) * k.x, 0.0)
		var bottom := maxf((win.y - sa.end.y) * k.y, 0.0)
		safe = Rect2(Vector2(left, top) + m, size_v - Vector2(left + right, top + bottom) - m * 2)
	else:
		safe = Rect2(m, size_v - m * 2)

	var br := safe.end
	var jump := br - Vector2(130, 130)
	var old := buttons
	buttons = {}
	_add("jump", jump, 100, "JUMP", "jump", "hold")
	_add("attack", jump + _arc(230, 180), 74, "PUNCH", "attack", "hold")
	_add("roll", jump + _arc(230, 135), 66, "ROLL", "roll", "hold")
	_add("crouch", jump + _arc(230, 90), 66, "CROUCH", "crouch", "hold")
	_add("interact", jump + _arc(425, 180), 60, "GRAB", "interact", "hold")
	_add("slide", jump + _arc(425, 150), 60, "SLIDE", "slide", "hold")
	_add("aim", jump + _arc(425, 120), 60, "AIM", "right_mouse", "hold")
	_add("run", jump + _arc(425, 90), 60, "RUN", "sprint", "toggle")

	var tl := safe.position
	_add("menu", tl + Vector2(50, 50), 46, "MENU", "", "tap")
	var tr := Vector2(safe.end.x, safe.position.y)
	_add("zoom_in", tr + Vector2(-50, 50), 42, "+", "", "tap")
	_add("zoom_out", tr + Vector2(-150, 50), 42, "−", "", "tap")
	_add("emotes", tr + Vector2(-260, 50), 46, "EMOTE", "", "tap")
	var labels := ["YES", "NO", "WAVE", "WAVE 2"]
	for i in 4:
		_add("emote_%d" % (i + 1), tr + Vector2(-260 - 110 * (3 - i), 160), 46, labels[i], "emote_%d" % (i + 1), "hold")
		buttons["emote_%d" % (i + 1)].visible = emotes_open

	# Keep the run toggle on across rotations / resizes.
	if old.has("run") and old["run"].on:
		buttons["run"].on = true
	queue_redraw()


func _arc(dist: float, deg: float) -> Vector2:
	return Vector2(cos(deg_to_rad(deg)), -sin(deg_to_rad(deg))) * dist


func _add(id: String, pos: Vector2, r: float, label: String, action: String, mode: String) -> void:
	buttons[id] = {"pos": pos, "r": r, "label": label, "action": action, "mode": mode,
		"finger": -1, "on": false, "visible": true}


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree(): return
	if event is InputEventScreenTouch:
		if event.pressed:
			_touch_down(event.index, event.position)
		else:
			_touch_up(event.index)
		queue_redraw()
	elif event is InputEventScreenDrag:
		_touch_drag(event.index, event.position, event.relative)


func _button_at(p: Vector2) -> String:
	for id in buttons:
		var b = buttons[id]
		if b.visible and p.distance_to(b.pos) <= b.r * 1.15:
			return id
	return ""


func _touch_down(finger: int, p: Vector2) -> void:
	var id := _button_at(p)
	if id != "":
		var b = buttons[id]
		b.finger = finger
		match b.mode:
			"hold":
				Input.action_press(b.action)
			"toggle":
				b.on = !b.on
				if b.on: Input.action_press(b.action)
				else: Input.action_release(b.action)
			"tap":
				_tap(id)
		return

	if p.x < size.x * STICK_ZONE and p.y > safe.position.y + 110 and stick_finger == -1:
		stick_finger = finger
		stick_center = p
		stick_vec = Vector2.ZERO
		_apply_stick()
		return

	look_fingers[finger] = p


func _touch_up(finger: int) -> void:
	if finger == stick_finger:
		stick_finger = -1
		stick_vec = Vector2.ZERO
		_apply_stick()
	look_fingers.erase(finger)
	for id in buttons:
		var b = buttons[id]
		if b.finger == finger:
			b.finger = -1
			if b.mode == "hold":
				Input.action_release(b.action)


func _touch_drag(finger: int, p: Vector2, rel: Vector2) -> void:
	if finger == stick_finger:
		var d := p - stick_center
		if d.length() > STICK_RADIUS:
			# Let the stick follow the thumb so it never gets "stuck" at the edge.
			stick_center = p - d.limit_length(STICK_RADIUS)
			d = p - stick_center
		stick_vec = d / STICK_RADIUS
		_apply_stick()
		queue_redraw()
	elif look_fingers.has(finger):
		look_fingers[finger] = p
		if player and player.has_method("touch_look"):
			player.touch_look(rel * LOOK_SENSITIVITY)


func _apply_stick() -> void:
	var v := stick_vec.limit_length(1.0)
	_set_axis("right", maxf(v.x, 0.0))
	_set_axis("left", maxf(-v.x, 0.0))
	_set_axis("backward", maxf(v.y, 0.0))
	_set_axis("forward", maxf(-v.y, 0.0))


func _set_axis(action: String, strength: float) -> void:
	if strength > 0.0:
		Input.action_press(action, strength)
	else:
		Input.action_release(action)


func _tap(id: String) -> void:
	match id:
		"menu":
			menu_requested.emit()
		"zoom_in":
			if player: player.camera_pivot.spring_length = clampf(player.camera_pivot.spring_length - 0.75, 1, 10)
		"zoom_out":
			if player: player.camera_pivot.spring_length = clampf(player.camera_pivot.spring_length + 0.75, 1, 10)
		"emotes":
			emotes_open = !emotes_open
			buttons["emotes"].on = emotes_open
			for i in 4:
				buttons["emote_%d" % (i + 1)].visible = emotes_open


func release_all() -> void:
	stick_finger = -1
	stick_vec = Vector2.ZERO
	_apply_stick()
	look_fingers.clear()
	for id in buttons:
		var b = buttons[id]
		b.finger = -1
		if b.action != "" and (b.mode == "hold" or b.on):
			Input.action_release(b.action)
		if b.mode == "toggle": b.on = false
	queue_redraw()


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_EXIT_TREE \
			or what == NOTIFICATION_APPLICATION_PAUSED:
		release_all()


func _draw() -> void:
	var font := ThemeDB.fallback_font

	# Joystick
	var base := stick_center if stick_finger != -1 else Vector2(safe.position.x + 210, safe.end.y - 200)
	var alpha := 1.0 if stick_finger != -1 else 0.55
	draw_circle(base, STICK_RADIUS, Color(COL_FILL, COL_FILL.a * alpha))
	draw_arc(base, STICK_RADIUS, 0, TAU, 64, Color(COL_EDGE, COL_EDGE.a * alpha), 4.0, true)
	var knob := base + stick_vec.limit_length(1.0) * STICK_RADIUS
	draw_circle(knob, KNOB_RADIUS, Color(1, 1, 1, 0.45 * alpha))
	draw_arc(knob, KNOB_RADIUS, 0, TAU, 48, Color(1, 1, 1, 0.8 * alpha), 3.0, true)
	if stick_finger == -1:
		_draw_label(font, base + Vector2(0, STICK_RADIUS + 30), "MOVE", 26, Color(1, 1, 1, 0.5))

	# Buttons
	for id in buttons:
		var b = buttons[id]
		if not b.visible: continue
		var fill := COL_FILL
		if b.on: fill = COL_FILL_ON
		if b.finger != -1: fill = COL_FILL_DOWN
		draw_circle(b.pos, b.r, fill)
		draw_arc(b.pos, b.r, 0, TAU, 48, COL_EDGE, 3.0, true)
		var fs := int(clampf(b.r * 0.42, 20, 36))
		if b.label in ["+", "−"]: fs = 48
		_draw_label(font, b.pos, b.label, fs, COL_TEXT)


func _draw_label(font: Font, center: Vector2, text: String, fs: int, col: Color) -> void:
	var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var asc := font.get_ascent(fs)
	var desc := font.get_descent(fs)
	draw_string(font, center + Vector2(-w / 2.0, (asc - desc) / 2.0), text,
		HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)
