extends Control

# On-screen controls for phones and tablets (Godot 3).
#
# Everything is read from raw InputEventScreenTouch / InputEventScreenDrag so
# several fingers work at once (move + look + shoot). The controls press the
# same input actions the keyboard and gamepad use.
#
# Left part of the screen: a floating joystick (put your thumb anywhere there).
# Elsewhere: drag on anything that is not a button to turn the camera.

# Sizes are for a 1080 px tall view; `k` scales them to the real view height
# (the game can render at 540/720/1080 or native resolution).
const LOOK_SENSITIVITY = 0.0042    # radians per 1080p pixel
const AIM_LOOK_FACTOR = 0.55       # slower camera while aiming
const STICK_RADIUS_1080 = 150.0
const KNOB_RADIUS_1080 = 62.0
const STICK_ZONE = 0.42            # left fraction of the screen used by the stick

const COL_FILL = Color(0.05, 0.07, 0.10, 0.45)
const COL_FILL_DOWN = Color(1.0, 1.0, 1.0, 0.35)
const COL_FILL_ON = Color(0.95, 0.35, 0.25, 0.50)
const COL_EDGE = Color(1, 1, 1, 0.6)
const COL_TEXT = Color(1, 1, 1, 0.92)

var player = null

# id -> {pos, r, label, action, finger}
var buttons = {}

var stick_finger = -1
var stick_center = Vector2()
var stick_vec = Vector2()
var look_fingers = {}
var safe = Rect2()
var fonts = {}
var k = 1.0
var stick_radius = STICK_RADIUS_1080


func _ready():
	set_anchors_and_margins_preset(Control.PRESET_WIDE)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_strip_mouse_bindings()
	get_viewport().connect("size_changed", self, "_layout")
	_layout()


# Android also turns each tap into a fake mouse click so the menus work. In game
# those clicks would shoot and aim, so take the mouse buttons off those actions.
func _strip_mouse_bindings():
	for action in ["shoot", "aim"]:
		for ev in InputMap.get_action_list(action):
			if ev is InputEventMouseButton:
				InputMap.action_erase_event(action, ev)


func _font(size):
	if not fonts.has(size):
		var f = DynamicFont.new()
		f.font_data = preload("res://menu/font/PT_Sans-Web-Bold.ttf")
		f.size = size
		fonts[size] = f
	return fonts[size]


func _layout():
	var vs = get_viewport_rect().size
	rect_size = vs
	k = vs.y / 1080.0
	stick_radius = STICK_RADIUS_1080 * k
	var m = Vector2(40, 30) * k
	var win = OS.window_size
	var sa = OS.get_window_safe_area()
	if win.x > 0 and win.y > 0 and sa.size.x > 0:
		var w2v = vs / win
		var left = max(sa.position.x * w2v.x, 0.0)
		var top = max(sa.position.y * w2v.y, 0.0)
		var right = max((win.x - sa.end.x) * w2v.x, 0.0)
		var bottom = max((win.y - sa.end.y) * w2v.y, 0.0)
		safe = Rect2(Vector2(left, top) + m, vs - Vector2(left + right, top + bottom) - m * 2)
	else:
		safe = Rect2(m, vs - m * 2)

	var br = safe.end
	var shoot = br - Vector2(140, 150) * k
	buttons = {}
	_add("shoot", shoot, 110 * k, "SHOOT", "shoot")
	_add("jump", shoot + _arc(250 * k, 180), 80 * k, "JUMP", "jump")
	_add("aim", shoot + _arc(250 * k, 95), 80 * k, "AIM", "aim")
	_add("menu", safe.position + Vector2(50, 50) * k, 46 * k, "MENU", "")
	update()


func _arc(dist, deg):
	return Vector2(cos(deg2rad(deg)), -sin(deg2rad(deg))) * dist


func _add(id, pos, r, label, action):
	buttons[id] = {"pos": pos, "r": r, "label": label, "action": action, "finger": -1}


func _input(event):
	if not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		if event.pressed:
			_touch_down(event.index, event.position)
		else:
			_touch_up(event.index)
		update()
	elif event is InputEventScreenDrag:
		_touch_drag(event.index, event.position, event.relative)


func _button_at(p):
	for id in buttons:
		var b = buttons[id]
		if p.distance_to(b.pos) <= b.r * 1.15:
			return id
	return ""


func _touch_down(finger, p):
	var id = _button_at(p)
	if id != "":
		var b = buttons[id]
		b.finger = finger
		if id == "menu":
			_send_action("quit")
		elif id == "shoot":
			# Shooting only works while aiming: start aiming (as a toggle,
			# like a quick tap on AIM) so a single button is enough.
			if player and not player.aiming:
				player.toggled_aim = true
			Input.action_press("shoot")
		else:
			Input.action_press(b.action)
		# A finger on SHOOT can also steer the camera while it is held.
		if id == "shoot":
			look_fingers[finger] = p
		return

	if p.x < rect_size.x * STICK_ZONE and p.y > safe.position.y + 110 * k and stick_finger == -1:
		stick_finger = finger
		stick_center = p
		stick_vec = Vector2()
		_apply_stick()
		return

	look_fingers[finger] = p


func _touch_up(finger):
	if finger == stick_finger:
		stick_finger = -1
		stick_vec = Vector2()
		_apply_stick()
	look_fingers.erase(finger)
	for id in buttons:
		var b = buttons[id]
		if b.finger == finger:
			b.finger = -1
			if b.action != "":
				Input.action_release(b.action)


func _touch_drag(finger, p, rel):
	if finger == stick_finger:
		var d = p - stick_center
		if d.length() > stick_radius:
			# Let the stick follow the thumb so it never gets stuck at the edge.
			stick_center = p - d.clamped(stick_radius)
			d = p - stick_center
		stick_vec = d / stick_radius
		_apply_stick()
		update()
	elif look_fingers.has(finger):
		look_fingers[finger] = p
		if player:
			var s = LOOK_SENSITIVITY / k
			if player.aiming:
				s *= AIM_LOOK_FACTOR
			player.rotate_camera(rel * s)


func _apply_stick():
	var v = stick_vec.clamped(1.0)
	_set_axis("move_right", max(v.x, 0.0))
	_set_axis("move_left", max(-v.x, 0.0))
	_set_axis("move_back", max(v.y, 0.0))
	_set_axis("move_forward", max(-v.y, 0.0))


func _set_axis(action, strength):
	if strength > 0.0:
		Input.action_press(action, strength)
	else:
		Input.action_release(action)


func _send_action(action):
	var ev = InputEventAction.new()
	ev.action = action
	ev.pressed = true
	Input.parse_input_event(ev)


func release_all():
	stick_finger = -1
	stick_vec = Vector2()
	_apply_stick()
	look_fingers.clear()
	for id in buttons:
		var b = buttons[id]
		b.finger = -1
		if b.action != "":
			Input.action_release(b.action)
	update()


func _notification(what):
	if what == NOTIFICATION_WM_FOCUS_OUT or what == NOTIFICATION_EXIT_TREE \
			or what == MainLoop.NOTIFICATION_APP_PAUSED:
		release_all()
	elif what == MainLoop.NOTIFICATION_WM_GO_BACK_REQUEST:
		_send_action("quit")


func _draw():
	# Joystick
	var base = stick_center if stick_finger != -1 else Vector2(safe.position.x + 210 * k, safe.end.y - 200 * k)
	var a = 1.0 if stick_finger != -1 else 0.55
	var knob_r = KNOB_RADIUS_1080 * k
	draw_circle(base, stick_radius, Color(COL_FILL.r, COL_FILL.g, COL_FILL.b, COL_FILL.a * a))
	draw_arc(base, stick_radius, 0, TAU, 64, Color(1, 1, 1, COL_EDGE.a * a), max(4.0 * k, 1.5), true)
	var knob = base + stick_vec.clamped(1.0) * stick_radius
	draw_circle(knob, knob_r, Color(1, 1, 1, 0.45 * a))
	draw_arc(knob, knob_r, 0, TAU, 48, Color(1, 1, 1, 0.8 * a), max(3.0 * k, 1.5), true)
	if stick_finger == -1:
		_label(base + Vector2(0, stick_radius + 30 * k), "MOVE", int(26 * k), Color(1, 1, 1, 0.55))

	# Buttons
	for id in buttons:
		var b = buttons[id]
		var fill = COL_FILL
		if id == "aim" and player and player.aiming:
			fill = COL_FILL_ON
		if b.finger != -1:
			fill = COL_FILL_DOWN
		draw_circle(b.pos, b.r, fill)
		draw_arc(b.pos, b.r, 0, TAU, 48, COL_EDGE, max(3.0 * k, 1.5), true)
		_label(b.pos, b.label, int(clamp(b.r * 0.4, 10, 40)), COL_TEXT)


func _process(_delta):
	# Keeps the AIM button colour in step with toggled aiming.
	update()


func _label(center, text, size, col):
	var f = _font(size)
	var s = f.get_string_size(text)
	draw_string(f, center + Vector2(-s.x / 2.0, f.get_ascent() - s.y / 2.0), text, col)
