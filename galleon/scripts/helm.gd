extends Control
## Ship's wheel: drag it round to steer. It stays where you leave it;
## double-tap to centre. Up to one and a half turns each way.

signal changed(value: float)

const MAX_DEG := 540.0
var angle := 0.0
var _last := INF
var _last_tap := 0


func _ready() -> void:
	custom_minimum_size = Vector2(190, 190)
	mouse_filter = Control.MOUSE_FILTER_STOP


func value() -> float:
	return angle / MAX_DEG


func set_angle(a: float) -> void:
	angle = clampf(a, -MAX_DEG, MAX_DEG)
	queue_redraw()
	changed.emit(value())


func _gui_input(e: InputEvent) -> void:
	var c := size / 2.0
	if e is InputEventScreenTouch or e is InputEventMouseButton:
		var pressed: bool = e.pressed
		if pressed:
			_last = rad_to_deg((e.position - c).angle())
			var now := Time.get_ticks_msec()
			if now - _last_tap < 300:
				set_angle(0.0)
			_last_tap = now
		else:
			_last = INF
		accept_event()
	elif (e is InputEventScreenDrag or e is InputEventMouseMotion) and _last != INF:
		var a := rad_to_deg((e.position - c).angle())
		var d := wrapf(a - _last, -180.0, 180.0)
		_last = a
		set_angle(angle + d)
		accept_event()


func _draw() -> void:
	var c := size / 2.0
	var r := minf(size.x, size.y) * 0.5 - 6.0
	var rot := deg_to_rad(angle)
	var wood := Color(0.42, 0.26, 0.13)
	var wood_l := Color(0.55, 0.36, 0.18)
	var gold := Color(0.85, 0.66, 0.3)
	draw_circle(c + Vector2(3, 5), r * 0.72, Color(0, 0, 0, 0.25))
	for k in 8:
		var a := rot + k * PI / 4.0
		var dir := Vector2(cos(a), sin(a))
		draw_line(c + dir * r * 0.18, c + dir * r * 0.86, wood, 7.0, true)
		draw_line(c + dir * r * 0.8, c + dir * r, wood_l, 12.0, true)
		draw_circle(c + dir * r, 6.5, wood_l)
	draw_arc(c, r * 0.68, 0, TAU, 64, wood_l, 11.0, true)
	draw_arc(c, r * 0.68, 0, TAU, 64, gold, 2.0, true)
	draw_circle(c, r * 0.17, wood_l)
	draw_arc(c, r * 0.17, 0, TAU, 32, gold, 2.5, true)
	# king spoke marks the centre position
	var top := Vector2(cos(rot - PI / 2), sin(rot - PI / 2))
	draw_circle(c + top * r, 7.5, gold)
