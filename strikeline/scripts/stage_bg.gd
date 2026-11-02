class_name StageBG
extends Node2D
## Screen-space parallax backdrop for each stage.

var id := 0
var cam_pos := Vector2.ZERO
var cam_zoom := 1.0
var t := 0.0
var rng := RandomNumberGenerator.new()
var layers: Array = []   # [{f, polys:[{pts, col}], rects:[...]}]
var stars: Array = []
var motes: Array = []
var clouds: Array = []


func setup(stage_id: int) -> void:
	id = stage_id
	rng.seed = 99 + id
	layers.clear()
	match id:
		0: _build_city()
		1: _build_mountains()
		_: _build_void()


func _build_city() -> void:
	var cols := [Color(0.22, 0.12, 0.33), Color(0.15, 0.08, 0.24), Color(0.1, 0.05, 0.17)]
	var factors := [0.12, 0.25, 0.42]
	for li in 3:
		var rects: Array = []
		var lights: Array = []
		var x := -2600.0
		while x < 2600.0:
			var w := rng.randf_range(70, 170) * (1.0 + li * 0.3)
			var h := rng.randf_range(160, 520) * (1.0 + li * 0.25)
			var base := 260.0 + li * 70.0
			rects.append(Rect2(x, base - h, w, h + 900))
			if li >= 1:
				var nx := int(w / 22)
				var ny := int(h / 30)
				for ix in nx:
					for iy in ny:
						if rng.randf() < 0.28:
							lights.append(Rect2(x + 8 + ix * 22, base - h + 12 + iy * 30, 9, 12))
			if rng.randf() < 0.25:
				rects.append(Rect2(x + w * 0.45, base - h - 60, 4, 60))
			x += w + rng.randf_range(4, 40)
		layers.append({"f": factors[li], "col": cols[li], "rects": rects, "lights": lights})
	for i in 120:
		stars.append(Vector3(rng.randf_range(-1, 1), rng.randf_range(0, 0.5), rng.randf_range(0.5, 2.0)))
	for i in 70:
		motes.append(Vector3(rng.randf_range(0, 1), rng.randf_range(0, 1), rng.randf_range(0.6, 1.4)))


func _build_mountains() -> void:
	var cols := [Color(0.85, 0.48, 0.5), Color(0.62, 0.3, 0.42), Color(0.42, 0.18, 0.33)]
	var factors := [0.1, 0.22, 0.38]
	for li in 3:
		var pts := PackedVector2Array()
		var base := 180.0 + li * 90.0
		pts.append(Vector2(-3000, 1600))
		var x := -3000.0
		var ph := rng.randf() * 10.0
		while x <= 3000.0:
			var h := 160.0 + sin(x * 0.0021 + ph) * 120.0 + sin(x * 0.0067 + ph * 2.0) * 60.0 + rng.randf_range(-12, 12)
			h *= (1.0 + li * 0.2)
			pts.append(Vector2(x, base - h))
			x += 60.0
		pts.append(Vector2(3000, 1600))
		layers.append({"f": factors[li], "col": cols[li], "poly": pts})
	for i in 14:
		clouds.append(Vector4(rng.randf_range(-2400, 2400), rng.randf_range(-300, 200), rng.randf_range(120, 300), rng.randf_range(0.15, 0.5)))
	for i in 50:
		motes.append(Vector3(rng.randf_range(0, 1), rng.randf_range(0, 1), rng.randf_range(0.6, 1.4)))


func _build_void() -> void:
	for i in 220:
		stars.append(Vector3(rng.randf_range(-1, 1), rng.randf_range(0, 1), rng.randf_range(0.5, 2.2)))


func _process(delta: float) -> void:
	t += delta
	queue_redraw()


func _layer_xform(f: float) -> void:
	var vs := get_viewport_rect().size
	var s := lerpf(1.0, cam_zoom, f) * (vs.y / 720.0)
	var off := vs * 0.5 - cam_pos * f * s
	draw_set_transform(off, 0.0, Vector2(s, s))


func _gradient(top: Color, mid: Color, bottom: Color) -> void:
	var vs := get_viewport_rect().size
	var pts := PackedVector2Array([Vector2(0, 0), Vector2(vs.x, 0), Vector2(vs.x, vs.y * 0.6), Vector2(0, vs.y * 0.6)])
	draw_polygon(pts, PackedColorArray([top, top, mid, mid]))
	var pts2 := PackedVector2Array([Vector2(0, vs.y * 0.6), Vector2(vs.x, vs.y * 0.6), Vector2(vs.x, vs.y), Vector2(0, vs.y)])
	draw_polygon(pts2, PackedColorArray([mid, mid, bottom, bottom]))


func _draw() -> void:
	match id:
		0: _draw_city()
		1: _draw_sunset()
		_: _draw_void()
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_city() -> void:
	var vs := get_viewport_rect().size
	_gradient(Color(0.07, 0.03, 0.16), Color(0.42, 0.12, 0.42), Color(0.95, 0.35, 0.45))
	for s in stars:
		var a := 0.4 + 0.4 * sin(t * s.z * 2.0 + s.x * 30.0)
		draw_circle(Vector2((s.x * 0.5 + 0.5) * vs.x, s.y * vs.y), s.z * 0.8, Color(1, 1, 1, a * 0.7))
	# moon
	_layer_xform(0.05)
	draw_circle(Vector2(420, -230), 150, Color(1.0, 0.5, 0.75, 0.08))
	draw_circle(Vector2(420, -230), 100, Color(1.0, 0.6, 0.8, 0.12))
	draw_circle(Vector2(420, -230), 72, Color(1.0, 0.88, 0.92))
	draw_circle(Vector2(445, -250), 16, Color(0.95, 0.78, 0.86))
	draw_circle(Vector2(395, -205), 10, Color(0.95, 0.78, 0.86))
	# searchlights sweeping behind the skyline
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	for k in 2:
		var base := Vector2(vs.x * (0.25 + k * 0.5), vs.y)
		var a := -PI / 2 + sin(t * 0.35 + k * 2.0) * 0.5
		var d := Vector2(cos(a), sin(a))
		var n := Vector2(-d.y, d.x)
		var far := base + d * vs.y * 1.3
		draw_colored_polygon(PackedVector2Array([base - n * 6.0, base + n * 6.0, far + n * 90.0, far - n * 90.0]), Color(0.8, 0.85, 1.0, 0.05))
	for li in layers.size():
		var L: Dictionary = layers[li]
		_layer_xform(L.f)
		var c: Color = L.col
		if li == 1:
			# hover-car traffic between the skyline layers
			for lane in 3:
				var y := -120.0 + lane * 70.0
				for car in 5:
					var spd := 120.0 + lane * 50.0
					var dirc := 1.0 if lane % 2 == 0 else -1.0
					var x := fmod(t * spd * dirc + car * 900.0 + lane * 333.0, 5000.0)
					if x < 0.0:
						x += 5000.0
					x -= 2500.0
					draw_rect(Rect2(x - 14, y - 4, 28, 8), Color(0.1, 0.06, 0.16))
					draw_circle(Vector2(x + 14 * dirc, y), 3.0, Color(1, 0.95, 0.8, 0.9))
					draw_circle(Vector2(x - 14 * dirc, y), 2.0, Color(1, 0.2, 0.3, 0.9))
		for r in L.rects:
			draw_rect(r, c)
		var lc := Color(1.0, 0.75, 0.45, 0.35 + li * 0.15)
		for r in L.lights:
			draw_rect(r, lc if int(r.position.x) % 5 != 0 else Color(0.4, 0.9, 1.0, 0.5))
		# fog band
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		var fog := Color(0.9, 0.3, 0.5, 0.06)
		draw_rect(Rect2(0, vs.y * (0.55 + li * 0.08), vs.x, vs.y), fog)
	# flying lights
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	for i in 4:
		var x := fmod(t * (40.0 + i * 25.0) + i * 400.0, vs.x + 200.0) - 100.0
		var y := vs.y * (0.18 + i * 0.06)
		var blink := 1.0 if fmod(t * 2.0 + i, 1.0) < 0.5 else 0.3
		draw_circle(Vector2(x, y), 2.5, Color(1.0, 0.3, 0.3, blink))
		draw_circle(Vector2(x - 14, y), 1.8, Color(1, 1, 1, 0.6))
	# drifting embers / rain streaks
	for m in motes:
		var y := fmod(m.y * vs.y + t * 160.0 * m.z, vs.y)
		var x := fmod(m.x * vs.x - t * 40.0 * m.z + vs.x * 4.0, vs.x)
		draw_line(Vector2(x, y), Vector2(x - 3, y + 14 * m.z), Color(0.75, 0.8, 1.0, 0.18), 1.2)


func _draw_sunset() -> void:
	var vs := get_viewport_rect().size
	_gradient(Color(0.25, 0.15, 0.42), Color(0.98, 0.5, 0.42), Color(1.0, 0.8, 0.5))
	_layer_xform(0.04)
	var sun := Vector2(-240, 40)
	draw_circle(sun, 260, Color(1.0, 0.8, 0.5, 0.12))
	draw_circle(sun, 170, Color(1.0, 0.85, 0.55, 0.2))
	draw_circle(sun, 110, Color(1.0, 0.93, 0.7))
	for k in 5:
		draw_rect(Rect2(sun.x - 120, sun.y + 20 + k * 18, 240, 5 + k), Color(0.98, 0.55, 0.45, 0.85))
	for li in layers.size():
		var L: Dictionary = layers[li]
		_layer_xform(L.f)
		if li == 1:
			# a shrine gate on the far ridge
			var gx := 520.0
			var gy := 30.0
			var gc := Color(0.55, 0.16, 0.24)
			draw_rect(Rect2(gx - 60, gy - 110, 12, 110), gc)
			draw_rect(Rect2(gx + 48, gy - 110, 12, 110), gc)
			draw_rect(Rect2(gx - 80, gy - 118, 160, 12), gc)
			draw_rect(Rect2(gx - 66, gy - 92, 132, 8), gc)
		draw_colored_polygon(L.poly, L.col)
		if li == 0:
			for c in clouds:
				var cx := fmod(c.x + t * 12.0 + 2400.0, 4800.0) - 2400.0
				_cloud(Vector2(cx, c.y), c.z, Color(1.0, 0.85, 0.8, c.w))
	_layer_xform(0.6)
	for c in clouds:
		var cx := fmod(c.x * 1.3 - t * 20.0 + 3000.0, 6000.0) - 3000.0
		_cloud(Vector2(cx, 420 + c.y * 0.3), c.z * 1.4, Color(1.0, 0.9, 0.85, c.w * 0.6))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	# birds
	for b in 5:
		var bx := fmod(t * (30.0 + b * 6.0) + b * 260.0, vs.x + 200.0) - 100.0
		var by := vs.y * 0.2 + sin(t * 0.5 + b) * 20.0 + b * 14.0
		var flap := sin(t * 8.0 + b) * 4.0
		draw_polyline(PackedVector2Array([Vector2(bx - 8, by - flap), Vector2(bx, by), Vector2(bx + 8, by - flap)]), Color(0.25, 0.12, 0.2, 0.7), 2.0, true)
	for m in motes:
		var y := fmod(m.y * vs.y + t * 25.0 * m.z, vs.y)
		var x := fmod(m.x * vs.x + t * 50.0 * m.z + sin(t + m.x * 10.0) * 20.0, vs.x)
		draw_circle(Vector2(x, y), 2.4 * m.z, Color(1.0, 0.7, 0.75, 0.6))


func _cloud(c: Vector2, w: float, col: Color) -> void:
	# soft puffy cloud: overlapping circles over a rounded base
	var base_h := w * 0.18
	draw_line(c + Vector2(-w * 0.5, base_h), c + Vector2(w * 0.5, base_h), col, base_h * 2.0, true)
	draw_circle(c + Vector2(-w * 0.5, base_h), base_h, col)
	draw_circle(c + Vector2(w * 0.5, base_h), base_h, col)
	draw_circle(c + Vector2(-w * 0.22, 0), w * 0.26, col)
	draw_circle(c + Vector2(w * 0.12, -w * 0.08), w * 0.32, col)
	draw_circle(c + Vector2(w * 0.38, w * 0.06), w * 0.2, col)


func _draw_void() -> void:
	var vs := get_viewport_rect().size
	_gradient(Color(0.01, 0.02, 0.05), Color(0.03, 0.05, 0.12), Color(0.08, 0.03, 0.15))
	for s in stars:
		var a := 0.3 + 0.5 * sin(t * s.z + s.x * 40.0)
		var x := fmod((s.x * 0.5 + 0.5) * vs.x - cam_pos.x * 0.02 * s.z + vs.x * 3.0, vs.x)
		draw_circle(Vector2(x, s.y * vs.y), s.z * 0.7, Color(0.7, 0.9, 1.0, a))
	# synth grid
	var hy := vs.y * 0.62
	var cx := vs.x * 0.5 - cam_pos.x * 0.3
	for i in range(-24, 25):
		var x0 := cx + i * 40.0
		var x1 := cx + i * 260.0
		draw_line(Vector2(x0, hy), Vector2(x1, vs.y), Color(0.7, 0.2, 1.0, 0.25), 1.5)
	for k in 12:
		var u := fmod(k / 12.0 + t * 0.08, 1.0)
		var y := hy + (vs.y - hy) * u * u
		draw_line(Vector2(0, y), Vector2(vs.x, y), Color(0.7, 0.2, 1.0, 0.1 + 0.35 * u), 1.5)
	draw_rect(Rect2(0, hy - 2, vs.x, 3), Color(1.0, 0.4, 0.9, 0.6))
	_layer_xform(0.05)
	draw_circle(Vector2(0, -60), 150, Color(1.0, 0.3, 0.7, 0.1))
	draw_arc(Vector2(0, -60), 120, PI, TAU, 48, Color(1.0, 0.45, 0.8, 0.8), 3.0, true)
