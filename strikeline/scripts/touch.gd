class_name TouchPad
extends Node2D
## On-screen controls: floating stick on the left half, four buttons on the right,
## pause in the top-right corner. Also reads the keyboard (for desktop testing).

const R_STICK := 86.0

var arena
var stick_id := -1
var stick_base := Vector2.ZERO
var stick_pos := Vector2.ZERO
var stick := Vector2.ZERO
var btn_touch := {}
var held := {"atk": false, "spc": false, "jmp": false, "shd": false}
var presses := {"atk": 0, "spc": 0, "jmp": 0, "shd": 0}
var hist: Array = []
var smash_t := 0
var prev_keys := {}
var flash := {"atk": 0.0, "spc": 0.0, "jmp": 0.0, "shd": 0.0}
var t := 0.0


func _layout() -> Dictionary:
	var vs := get_viewport_rect().size
	return {
		"atk": [Vector2(vs.x - 150, vs.y - 128), 68.0, "ATTACK"],
		"spc": [Vector2(vs.x - 305, vs.y - 92), 56.0, "SPECIAL"],
		"jmp": [Vector2(vs.x - 112, vs.y - 292), 56.0, "JUMP"],
		"shd": [Vector2(vs.x - 268, vs.y - 248), 46.0, "SHIELD"],
		"pause": [Vector2(vs.x - 48, 44), 28.0, ""],
	}


func reset() -> void:
	stick_id = -1
	stick = Vector2.ZERO
	btn_touch.clear()
	for k in held:
		held[k] = false
		presses[k] = 0


func _button_at(p: Vector2) -> String:
	var lay := _layout()
	var best := ""
	var bd := INF
	for k in lay:
		var c: Vector2 = lay[k][0]
		var r: float = lay[k][1]
		var d := p.distance_to(c)
		if d < r * 1.3 and d < bd:
			bd = d
			best = k
	return best


func _input(event: InputEvent) -> void:

	if arena == null or arena.paused or arena.menu_open:
		return
	var vs := get_viewport_rect().size
	if event is InputEventScreenTouch:
		var idx: int = event.index
		var p: Vector2 = event.position
		if event.pressed:
			var b := _button_at(p)
			if b == "pause":
				arena.set_paused(true)
				return
			if b != "":
				btn_touch[idx] = b
				held[b] = true
				presses[b] += 1
				flash[b] = 1.0
			elif p.x < vs.x * 0.55 and stick_id == -1:
				stick_id = idx
				stick_base = p
				stick_pos = p
		else:
			if idx == stick_id:
				stick_id = -1
				stick = Vector2.ZERO
			if btn_touch.has(idx):
				var b: String = btn_touch[idx]
				btn_touch.erase(idx)
				if not btn_touch.values().has(b):
					held[b] = false
	elif event is InputEventScreenDrag:
		var idx: int = event.index
		if idx == stick_id:
			stick_pos = event.position
			var d := stick_pos - stick_base
			if d.length() > R_STICK * 1.25:
				stick_base = stick_pos - d.normalized() * R_STICK * 1.25
		elif btn_touch.has(idx):
			# sliding a thumb onto another button presses it
			var b := _button_at(event.position)
			var old: String = btn_touch[idx]
			if b != "" and b != old and b != "pause":
				btn_touch[idx] = b
				if not btn_touch.values().has(old):
					held[old] = false
				held[b] = true
				presses[b] += 1
				flash[b] = 1.0


func _key(k: Key) -> bool:
	return Input.is_physical_key_pressed(k)


func _key_edge(name: String, down: bool) -> bool:
	var was: bool = prev_keys.get(name, false)
	prev_keys[name] = down
	return down and not was


## Builds this frame's input for the human fighter.
func poll() -> Dictionary:
	if stick_id >= 0:
		var d := (stick_pos - stick_base) / R_STICK
		if d.length() > 1.0:
			d = d.normalized()
		stick = d if d.length() > 0.2 else Vector2.ZERO
	var kx := float(_key(KEY_D) or _key(KEY_RIGHT)) - float(_key(KEY_A) or _key(KEY_LEFT))
	var ky := float(_key(KEY_S) or _key(KEY_DOWN)) - float(_key(KEY_W) or _key(KEY_UP))
	var v := stick
	if kx != 0.0 or ky != 0.0:
		v = Vector2(kx, ky)
		if v.length() > 1.0:
			v = v.normalized()
	# flick detection (fast stick push = smash input / drop / fast fall)
	var flick := false
	var down := false
	var flick_x := false
	if hist.size() >= 2:
		for i in range(maxi(0, hist.size() - 5), hist.size()):
			var h: Vector2 = hist[i]
			if h.length() < 0.35 and v.length() > 0.82:
				flick = true
			if h.y < 0.35 and v.y > 0.75:
				down = true
			if absf(h.x) < 0.35 and absf(v.x) > 0.75:
				flick_x = true
	var last_y: float = hist[hist.size() - 1].y if hist.size() > 0 else 0.0
	if not (last_y < 0.75 and v.y >= 0.75):
		down = false
	hist.append(v)
	if hist.size() > 8:
		hist.pop_front()
	if flick:
		smash_t = 9
	elif smash_t > 0:
		smash_t -= 1

	var ka := _key_edge("atk", _key(KEY_J) or _key(KEY_Z))
	var ks := _key_edge("spc", _key(KEY_K) or _key(KEY_X))
	var kj := _key_edge("jmp", _key(KEY_SPACE) or _key(KEY_I) or _key(KEY_C))
	var kd := _key_edge("shd", _key(KEY_L) or _key(KEY_V))
	var shift := _key(KEY_SHIFT)
	var out := {
		"x": v.x, "y": v.y,
		"atk": presses.atk > 0 or ka,
		"spc": presses.spc > 0 or ks,
		"jmp": presses.jmp > 0 or kj,
		"shd_p": presses.shd > 0 or kd,
		"atk_h": held.atk or _key(KEY_J) or _key(KEY_Z),
		"spc_h": held.spc or _key(KEY_K) or _key(KEY_X),
		"jmp_h": held.jmp or _key(KEY_SPACE) or _key(KEY_I) or _key(KEY_C),
		"shd": held.shd or _key(KEY_L) or _key(KEY_V),
		"smash": smash_t > 0 or shift,
		"down": down, "down_h": v.y > 0.75, "flick_x": flick_x,
	}
	for k in presses:
		presses[k] = 0
	return out


func _process(delta: float) -> void:
	t += delta
	for k in flash:
		flash[k] = maxf(0.0, flash[k] - delta * 4.0)
	queue_redraw()


func _draw() -> void:
	var vs := get_viewport_rect().size
	var font: Font = Game.font_display
	var small: Font = Game.font_body
	# stick
	var base := stick_base if stick_id >= 0 else Vector2(190, vs.y - 170)
	var knob := base + stick * R_STICK
	var act := stick_id >= 0
	draw_circle(base, R_STICK + 10, Color(0, 0, 0, 0.22 if act else 0.12))
	draw_arc(base, R_STICK, 0, TAU, 64, Color(1, 1, 1, 0.45 if act else 0.18), 3.0, true)
	for k in 4:
		var a := k * PI / 2.0
		var p := base + Vector2(cos(a), sin(a)) * (R_STICK - 14)
		draw_colored_polygon(PackedVector2Array([p + Vector2(cos(a), sin(a)) * 8, p + Vector2(cos(a + 2.2), sin(a + 2.2)) * 6, p + Vector2(cos(a - 2.2), sin(a - 2.2)) * 6]), Color(1, 1, 1, 0.3 if act else 0.15))
	draw_circle(knob, 40, Color(1, 1, 1, 0.16 if act else 0.08))
	draw_circle(knob, 34, Color(0.95, 0.95, 1.0, 0.55 if act else 0.22))
	draw_arc(knob, 34, 0, TAU, 40, Color(1, 1, 1, 0.8 if act else 0.3), 2.0, true)
	if smash_t > 0 and act:
		draw_arc(base, R_STICK + 6, 0, TAU, 64, Color(1, 0.6, 0.2, 0.7), 4.0, true)

	var lay := _layout()
	var cols := {"atk": Color(1.0, 0.32, 0.32), "spc": Color(0.35, 0.65, 1.0), "jmp": Color(0.35, 1.0, 0.55), "shd": Color(1.0, 0.85, 0.3)}
	for k in ["atk", "spc", "jmp", "shd"]:
		var c: Vector2 = lay[k][0]
		var r: float = lay[k][1]
		var col: Color = cols[k]
		var on: bool = held[k]
		var rr := r * (0.92 if on else 1.0)
		draw_circle(c, rr + 6, Color(0, 0, 0, 0.25))
		draw_circle(c, rr, Color(col.r, col.g, col.b, 0.42 if on else 0.2))
		draw_arc(c, rr, 0, TAU, 56, Color(col.r, col.g, col.b, 0.95 if on else 0.65), 3.5, true)
		if flash[k] > 0.0:
			draw_arc(c, rr + 14.0 * (1.0 - flash[k]), 0, TAU, 56, Color(col.r, col.g, col.b, flash[k]), 3.0, true)
		_icon(k, c, rr, Color(1, 1, 1, 0.95 if on else 0.75))
		var lbl: String = lay[k][2]
		draw_string(small, c + Vector2(-60, rr + 20), lbl, HORIZONTAL_ALIGNMENT_CENTER, 120, 13, Color(1, 1, 1, 0.55))
	# pause
	var pc: Vector2 = lay.pause[0]
	draw_circle(pc, 26, Color(0, 0, 0, 0.35))
	draw_arc(pc, 26, 0, TAU, 40, Color(1, 1, 1, 0.6), 2.0, true)
	draw_rect(Rect2(pc + Vector2(-8, -10), Vector2(5, 20)), Color(1, 1, 1, 0.85))
	draw_rect(Rect2(pc + Vector2(3, -10), Vector2(5, 20)), Color(1, 1, 1, 0.85))


func _icon(k: String, c: Vector2, r: float, col: Color) -> void:
	match k:
		"atk":
			# fist burst
			var pts := PackedVector2Array()
			for i in 16:
				var rr := r * (0.5 if i % 2 == 0 else 0.26)
				var a := -PI / 2 + i * TAU / 16.0
				pts.append(c + Vector2(cos(a), sin(a)) * rr)
			draw_colored_polygon(pts, col)
		"spc":
			var pts := PackedVector2Array()
			for i in 10:
				var rr := r * (0.5 if i % 2 == 0 else 0.22)
				var a := -PI / 2 + i * TAU / 10.0
				pts.append(c + Vector2(cos(a), sin(a)) * rr)
			draw_colored_polygon(pts, col)
		"jmp":
			draw_colored_polygon(PackedVector2Array([c + Vector2(0, -r * 0.48), c + Vector2(r * 0.42, 0), c + Vector2(r * 0.16, 0),
				c + Vector2(r * 0.16, r * 0.42), c + Vector2(-r * 0.16, r * 0.42), c + Vector2(-r * 0.16, 0), c + Vector2(-r * 0.42, 0)]), col)
		"shd":
			var pts := PackedVector2Array([c + Vector2(-r * 0.4, -r * 0.42), c + Vector2(r * 0.4, -r * 0.42), c + Vector2(r * 0.4, 0),
				c + Vector2(0, r * 0.48), c + Vector2(-r * 0.4, 0)])
			draw_colored_polygon(pts, col)
