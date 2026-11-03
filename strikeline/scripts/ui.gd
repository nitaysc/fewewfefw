class_name UiScreen
extends Node2D
## Base for the menu screens: slanted buttons with touch/mouse handling and shared drawing helpers.

var main
var btns: Array = []
var pressed_id := ""
var t := 0.0
var enter_t := 0.0
## Per-button feel: spring scale, press depth, ripples and entry order.
var anim := {}   # id -> {s, v, press, rip: [{p, t}], idx}


func _process(delta: float) -> void:
	var dt := delta / maxf(Engine.time_scale, 0.05)
	t += dt
	enter_t = minf(1.0, enter_t + dt * 3.0)
	btns.clear()
	layout()
	var n := 0
	for b in btns:
		if b.kind == "card":
			continue
		var a: Dictionary = anim.get(b.id, {})
		if a.is_empty():
			a = {"s": 1.0, "v": 0.0, "press": 0.0, "rip": [], "idx": n}
			anim[b.id] = a
		n += 1
		var down: bool = pressed_id == b.id
		var target := 0.94 if down else 1.0
		a.v += (target - a.s) * 420.0 * dt
		a.v *= pow(0.0009, dt)
		a.s += a.v * dt
		a.press = move_toward(a.press, 1.0 if down else 0.0, dt * 12.0)
		for r in a.rip:
			r.t += dt
		while a.rip.size() > 0 and a.rip[0].t > 0.5:
			a.rip.pop_front()
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


## Springy release with a ripple from where the finger lifted.
func pop(id: String, at := Vector2.INF) -> void:
	if not anim.has(id):
		return
	var a: Dictionary = anim[id]
	a.v += 3.2
	for b in btns:
		if b.id == id:
			var c: Vector2 = (b.r as Rect2).get_center()
			a.rip.append({"p": (at - c) if at != Vector2.INF else Vector2.ZERO, "t": 0.0})


## Where a button is drawn right now: [centre, scale, alpha] (entry slide, spring, press).
func btn_xform(b: Dictionary) -> Array:
	var r: Rect2 = b.r
	var a: Dictionary = anim.get(b.id, {"s": 1.0, "press": 0.0, "idx": 0})
	var u := clampf((t - 0.04 - a.idx * 0.055) / 0.4, 0.0, 1.0)
	var e := 1.0 + 2.2 * pow(u - 1.0, 3.0) + 1.2 * pow(u - 1.0, 2.0)   # ease-out-back
	var c := r.get_center() + Vector2(0, (1.0 - e) * 60.0 + a.press * 3.0)
	return [c, a.s * (0.85 + 0.15 * e), clampf(u * 2.5, 0.0, 1.0)]


func draw_buttons() -> void:
	for b in btns:
		draw_btn(b)


func draw_btn(b: Dictionary) -> void:
	var xf := btn_xform(b)
	var cen: Vector2 = xf[0]
	var sc: float = xf[1]
	var al: float = xf[2]
	if al <= 0.0:
		return
	var a: Dictionary = anim.get(b.id, {"press": 0.0, "rip": []})
	var press: float = a.press
	var size: Vector2 = (b.r as Rect2).size
	var r := Rect2(-size * 0.5, size)
	draw_set_transform(cen, 0.0, Vector2(sc, sc))
	var kind: String = b.kind
	var sl := minf(18.0, r.size.y * 0.35)
	var pts := PackedVector2Array([r.position + Vector2(sl, 0), Vector2(r.end.x, r.position.y), r.end - Vector2(sl, 0), Vector2(r.position.x, r.end.y)])
	var fill := Color(1.0, 0.25, 0.32)
	var edge := Color(1, 0.75, 0.75)
	var txt := Color(1, 1, 1)
	match kind:
		"secondary":
			fill = Color(0.13, 0.13, 0.22)
			edge = Color(1, 1, 1, 0.45)
		"chip":
			fill = Color(0.09, 0.1, 0.17)
			edge = Color(0.45, 0.75, 1.0, 0.8)
		"gold":
			fill = Color(1.0, 0.72, 0.15)
			edge = Color(1, 0.95, 0.75)
			txt = Color(0.15, 0.08, 0.02)
	var lip := 7.0 * (1.0 - press)
	# drop shadow and the 3D lip under the face (the face sinks onto it when pressed)
	var sh := PackedVector2Array()
	var lp := PackedVector2Array()
	for p in pts:
		sh.append(p + Vector2(6, 9 + lip))
		lp.append(p + Vector2(0, lip))
	draw_colored_polygon(sh, Color(0, 0, 0, 0.32 * al))
	draw_colored_polygon(lp, Color(fill.darkened(0.5), (0.95 if kind != "chip" else 0.85) * al))
	# face: vertical gradient
	var top := fill.lightened(0.18 + 0.1 * press)
	var bot := fill.darkened(0.12)
	var fa := (0.97 if kind in ["primary", "gold"] else 0.9) * al
	draw_polygon(pts, PackedColorArray([Color(top, fa), Color(top, fa), Color(bot, fa), Color(bot, fa)]))
	# gloss on the upper half
	var gl := PackedVector2Array([pts[0], pts[1], pts[1].lerp(pts[2], 0.45), pts[0].lerp(pts[3], 0.45)])
	draw_colored_polygon(gl, Color(1, 1, 1, 0.12 * al))
	# shine sweeping across the main buttons every few seconds
	if kind in ["primary", "gold"]:
		var ph := fmod(t * 0.55 + a.get("idx", 0) * 0.3, 2.2)
		if ph < 1.0:
			var sx := lerpf(r.position.x - 60.0, r.end.x + 60.0, ph)
			var band := PackedVector2Array([Vector2(sx, r.position.y), Vector2(sx + 26, r.position.y), Vector2(sx + 6, r.end.y), Vector2(sx - 20, r.end.y)])
			var cl := Geometry2D.intersect_polygons(band, pts)
			for poly in cl:
				draw_colored_polygon(poly, Color(1, 1, 1, 0.28 * al))
		# soft breathing glow
		var gw := 0.5 + 0.5 * sin(t * 2.4)
		draw_polyline(pts + PackedVector2Array([pts[0]]), Color(fill.lightened(0.4), 0.25 * gw * al), 7.0, true)
	draw_polyline(pts + PackedVector2Array([pts[0]]), Color(edge, edge.a * al), 2.0, true)
	draw_line(pts[0] + Vector2(2, 2), pts[1] + Vector2(-2, 2), Color(1, 1, 1, 0.35 * al), 1.5, true)
	# ripples
	for rp in a.get("rip", []):
		var u: float = rp.t / 0.5
		var rad := lerpf(10.0, size.x * 0.7, 1.0 - pow(1.0 - u, 3.0))
		draw_arc(rp.p, rad, 0, TAU, 40, Color(1, 1, 1, 0.45 * (1.0 - u) * al), 3.0 * (1.0 - u) + 1.0, true)
	if press > 0.0:
		draw_colored_polygon(pts, Color(1, 1, 1, 0.12 * press * al))
	# label
	var fd: Font = Game.font_display
	var fb: Font = Game.font_body
	var tsz := int(clampf(r.size.y * 0.42, 14, 40))
	var label: String = b.label
	var sub: String = b.sub
	if sub != "":
		var ls := int(tsz * 0.55)
		draw_string(fb, Vector2(r.position.x, r.position.y + r.size.y * 0.38), label, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, ls, Color(txt, 0.6 * al))
		var ss := int(tsz * 0.8)
		while ss > 12 and fd.get_string_size(sub, HORIZONTAL_ALIGNMENT_LEFT, -1, ss).x > r.size.x - sl * 2.0:
			ss -= 1
		draw_string(fd, Vector2(r.position.x, r.position.y + r.size.y * 0.8), sub, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, ss, Color(txt, al))
	else:
		while tsz > 12 and fd.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, tsz).x > r.size.x - sl * 2.0 - 8.0:
			tsz -= 1
		var tp := Vector2(r.position.x, tsz * 0.36)
		if kind != "gold":
			draw_string(fd, tp + Vector2(2, 3), label, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, tsz, Color(0, 0, 0, 0.35 * al))
		draw_string(fd, tp, label, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, tsz, Color(txt, al))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func text(s: String, p: Vector2, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT, width := -1.0, display := true) -> void:
	var f: Font = Game.font_display if display else Game.font_body
	draw_string(f, p, s, align, width, size, col)


func text_shadow(s: String, p: Vector2, size: int, col: Color, align := HORIZONTAL_ALIGNMENT_LEFT, width := -1.0) -> void:
	var f: Font = Game.font_display
	draw_string(f, p + Vector2(4, 5), s, align, width, size, Color(0, 0, 0, 0.45))
	draw_string(f, p, s, align, width, size, col)


func dim(a: float) -> void:
	draw_rect(Rect2(Vector2.ZERO, get_viewport_rect().size), Color(0.02, 0.02, 0.05, a))


## Draws a live 3D portrait with its feet at `feet`, about `height` pixels tall.
## Returns false when the 3D models aren't available (callers fall back to the stickman).
func draw_portrait(key: String, idx: int, clip: String, feet: Vector2, height: float, alpha := 1.0) -> bool:
	var tex := Portrait3D.texture(self, key, idx, clip)
	if tex == null:
		return false
	var s := height / 0.76
	draw_texture_rect(tex, Rect2(feet - Vector2(s * 0.5, s * 0.913), Vector2(s, s)), false, Color(1, 1, 1, alpha))
	return true


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
