class_name UiScreen
extends Node2D
## Base for the menu screens: slanted buttons with touch/mouse handling and shared drawing helpers.

var main
var btns: Array = []
var pressed_id := ""
var t := 0.0
var enter_t := 0.0


func _process(delta: float) -> void:
	t += delta
	enter_t = minf(1.0, enter_t + delta * 3.0)
	btns.clear()
	layout()
	queue_redraw()


func layout() -> void:
	pass


func on_button(_id: String) -> void:
	pass


func add_btn(id: String, r: Rect2, label: String, kind := "primary", sub := "") -> void:
	btns.append({"id": id, "r": r, "label": label, "kind": kind, "sub": sub})


func _hit(p: Vector2) -> String:
	for b in btns:
		if (b.r as Rect2).grow(8).has_point(p):
			return b.id
	return ""


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if event is InputEventScreenTouch:
		if event.pressed:
			pressed_id = _hit(event.position)
			if pressed_id != "":
				Sfx.play("ui_move", -8)
		else:
			var h := _hit(event.position)
			if pressed_id != "" and h == pressed_id:
				var id := pressed_id
				pressed_id = ""
				Sfx.play("ui_ok", -4)
				on_button(id)
			pressed_id = ""
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ENTER or event.keycode == KEY_SPACE:
			on_button("enter")
		elif event.keycode == KEY_ESCAPE:
			on_button("back")


func draw_buttons() -> void:
	for b in btns:
		draw_btn(b)


func draw_btn(b: Dictionary) -> void:
	var r: Rect2 = b.r
	var down: bool = pressed_id == b.id
	var kind: String = b.kind
	var sl := minf(18.0, r.size.y * 0.35)
	if down:
		r = r.grow(-3)
	var pts := PackedVector2Array([r.position + Vector2(sl, 0), Vector2(r.end.x, r.position.y), r.end - Vector2(sl, 0), Vector2(r.position.x, r.end.y)])
	var fill := Color(1.0, 0.25, 0.32)
	var edge := Color(1, 0.75, 0.75)
	var txt := Color(1, 1, 1)
	match kind:
		"secondary":
			fill = Color(0.1, 0.1, 0.17, 0.85)
			edge = Color(1, 1, 1, 0.45)
		"chip":
			fill = Color(0.08, 0.08, 0.14, 0.85)
			edge = Color(0.45, 0.75, 1.0, 0.8)
		"gold":
			fill = Color(1.0, 0.72, 0.15)
			edge = Color(1, 0.95, 0.75)
			txt = Color(0.15, 0.08, 0.02)
	var sh := PackedVector2Array()
	for p in pts:
		sh.append(p + Vector2(5, 6))
	draw_colored_polygon(sh, Color(0, 0, 0, 0.35))
	draw_colored_polygon(pts, fill.lightened(0.15) if down else fill)
	# gloss stripe
	var gl := PackedVector2Array([pts[0], pts[1], pts[1].lerp(pts[2], 0.42), pts[0].lerp(pts[3], 0.42)])
	draw_colored_polygon(gl, Color(1, 1, 1, 0.1))
	draw_polyline(pts + PackedVector2Array([pts[0]]), edge, 2.0, true)
	var fd: Font = Game.font_display
	var fb: Font = Game.font_body
	var size := int(clampf(r.size.y * 0.42, 14, 40))
	var label: String = b.label
	var sub: String = b.sub
	if sub != "":
		var ls := int(size * 0.55)
		draw_string(fb, Vector2(r.position.x, r.position.y + r.size.y * 0.38), label, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, ls, Color(txt, 0.6))
		draw_string(fd, Vector2(r.position.x, r.position.y + r.size.y * 0.8), sub, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, int(size * 0.8), txt)
	else:
		while size > 12 and fd.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x > r.size.x - sl * 2.0 - 8.0:
			size -= 1
		draw_string(fd, Vector2(r.position.x, r.get_center().y + size * 0.36), label, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, size, txt)


func text(s: String, p: Vector2, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT, width := -1.0, display := true) -> void:
	var f: Font = Game.font_display if display else Game.font_body
	draw_string(f, p, s, align, width, size, col)


func text_shadow(s: String, p: Vector2, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT, width := -1.0) -> void:
	var f: Font = Game.font_display
	draw_string(f, p + Vector2(4, 5), s, align, width, size, Color(0, 0, 0, 0.45))
	draw_string(f, p, s, align, width, size, col)


func dim(a: float) -> void:
	draw_rect(Rect2(Vector2.ZERO, get_viewport_rect().size), Color(0.02, 0.02, 0.05, a))


## Draws a fighter preview at `at` (feet position) with scale `s`.
static func draw_fighter(ci: CanvasItem, idx: int, at: Vector2, s: float, pose: PackedFloat32Array, facing := 1.0, alpha := 1.0) -> void:
	var d: Dictionary = Roster.fighter(idx)
	var dims: Dictionary = d.dims.duplicate()
	dims.weapon = d.wlen
	var j := PackedVector2Array()
	Rig.solve(pose, dims, facing, j)
	var root := Vector2(0, -Rig.body_bottom(j, dims.head) - 1.5)
	var body: Color = d.body
	var st := {"body": body, "back": body.darkened(0.35), "line": (d.accent as Color).darkened(0.15),
		"accent": d.accent, "w": d.w, "head": dims.head, "weapon": d.weapon, "facing": facing, "ow": 2.3}
	ci.draw_set_transform(at, 0.0, Vector2(s, s))
	ci.draw_set_transform(at, 0.0, Vector2(s, s))
	# scarf hint
	var head := j[Rig.J_HEAD] + root
	var sc: Color = d.scarf
	sc.a = alpha
	var pts := PackedVector2Array()
	for i in 7:
		var u := i / 6.0
		pts.append(head + Vector2(-facing * (dims.head * 0.9 + u * 34.0), u * 10.0 + sin(Time.get_ticks_msec() * 0.006 + u * 4.0) * 4.0 * u))
	ci.draw_polyline(pts, sc, 5.0, true)
	Rig.draw_body(ci, j, root, st, alpha)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
