class_name FX
extends Node2D
## World-space particles: hit sparks, impact stars, shockwave rings, dust, smoke, KO blasts.
## Glowing things go to an additive child layer, dust and smoke draw normally.

enum { SPARK, DOT, RING, FLASH, STAR, DUST, SMOKE, BEAM, SHARD, SLASH, STARKO, PLUS, LINES, FIRE }

static var tex_glow: Texture2D    # soft radial glow
static var tex_puff: Texture2D    # cloudy smoke puff
static var tex_flare: Texture2D   # thin horizontal lens streak

var parts: Array = []
var glow: Node2D
var recording := false   # host of an online match: emitters are recorded for guests
var rec: Array = []


static func _make_textures() -> void:
	if tex_glow != null:
		return
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.18, 0.5, 1.0])
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.75), Color(1, 1, 1, 0.18), Color(1, 1, 1, 0)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	gt.width = 64
	gt.height = 64
	tex_glow = gt
	# cloudy puff: fractal noise inside a soft round falloff
	var n := FastNoiseLite.new()
	n.seed = 3
	n.frequency = 0.09
	n.fractal_octaves = 3
	var sz := 64
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	for y in sz:
		for x in sz:
			var d := Vector2(x - sz * 0.5 + 0.5, y - sz * 0.5 + 0.5).length() / (sz * 0.5)
			var fall := clampf(1.0 - d, 0.0, 1.0)
			fall = fall * fall * (3.0 - 2.0 * fall)
			var v := 0.55 + 0.45 * n.get_noise_2d(x, y)
			var shade := 0.82 + 0.18 * (1.0 - float(y) / sz)
			img.set_pixel(x, y, Color(shade, shade, shade, clampf(fall * v * 1.6, 0.0, 1.0)))
	tex_puff = ImageTexture.create_from_image(img)
	var fl := Image.create(64, 8, false, Image.FORMAT_RGBA8)
	for y in 8:
		for x in 64:
			var u := absf(x - 31.5) / 32.0
			var w := absf(y - 3.5) / 4.0
			fl.set_pixel(x, y, Color(1, 1, 1, pow(1.0 - u, 2.0) * (1.0 - w * w)))
	tex_flare = ImageTexture.create_from_image(fl)


func _soft(ci: CanvasItem, tex: Texture2D, p: Vector2, r: float, c: Color, rot := 0.0, sx := 1.0) -> void:
	if rot != 0.0:
		ci.draw_set_transform(p, rot, Vector2(sx, 1.0))
		ci.draw_texture_rect(tex, Rect2(-Vector2(r, r), Vector2(r, r) * 2.0), false, c)
		ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	else:
		ci.draw_texture_rect(tex, Rect2(p - Vector2(r * sx, r), Vector2(r * sx, r) * 2.0), false, c)


func _ready() -> void:
	_make_textures()
	glow = Node2D.new()
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	glow.material = m
	glow.z_index = 5
	add_child(glow)
	glow.draw.connect(_draw_glow)


func _add(kind: int, p: Vector2, v: Vector2, life: float, size: float, col: Color, extra := 0.0) -> void:
	if parts.size() > 600:
		parts.pop_front()
	parts.append({"k": kind, "p": p, "v": v, "life": life, "max": life, "s": size, "c": col, "x": extra})


func step() -> void:
	var i := 0
	while i < parts.size():
		var q: Dictionary = parts[i]
		q.life -= 1.0
		if q.life <= 0.0:
			parts.remove_at(i)
			continue
		q.p += q.v
		match q.k:
			SPARK, SHARD:
				q.v *= 0.86
				if q.k == SHARD:
					q.v.y += 0.35
			DOT:
				q.v *= 0.92
				q.v.y += 0.08
			PLUS:
				q.v.y -= 0.02
			DUST:
				q.v *= 0.9
				q.v.y -= 0.03
			SMOKE:
				q.v *= 0.93
				q.v.y -= 0.025
			FIRE:
				q.v *= 0.9
				q.v.y -= 0.06
		i += 1
	queue_redraw()
	glow.queue_redraw()


func _draw() -> void:
	for q in parts:
		var u: float = q.life / q.max
		match q.k:
			DUST:
				var c: Color = q.c
				c.a *= u * 0.9
				_soft(self, tex_puff, q.p, q.s * (2.2 - u * 0.9), c, q.x + (1.0 - u) * 0.8)
			SMOKE:
				var c: Color = q.c
				c.a *= minf(1.0, u * 1.6) * 0.75
				_soft(self, tex_puff, q.p, q.s * (2.6 - u * 1.2), c, q.x + (1.0 - u) * 1.2)


func _draw_glow() -> void:
	for q in parts:
		var u: float = q.life / q.max
		var c: Color = q.c
		match q.k:
			SLASH:
				c.a = u
				var d: Vector2 = Vector2(cos(q.x), sin(q.x)) * q.s * (1.4 - u * 0.4)
				var n := Vector2(-d.y, d.x).normalized() * 6.0 * u
				glow.draw_colored_polygon(PackedVector2Array([q.p - d, q.p + n, q.p + d, q.p - n]), c)
				glow.draw_line(q.p - d * 0.9, q.p + d * 0.9, Color(1, 1, 1, u), 2.0, true)
			STARKO:
				# a fighter shrinking into the sky, then a twinkle
				var k: float = 1.0 - u
				var pp: Vector2 = q.p + Vector2(sin(k * 6.0) * 30.0, -k * 260.0)
				if k < 0.82:
					var sz := 26.0 * (1.0 - k)
					glow.draw_circle(pp, sz, Color(c.r, c.g, c.b, 0.8))
					glow.draw_circle(pp, sz * 0.5, Color(1, 1, 1, 0.9))
				else:
					var tw := (k - 0.82) / 0.18
					var r := 40.0 * sin(tw * PI)
					var pts := PackedVector2Array()
					for i in 8:
						var rr := r if i % 2 == 0 else r * 0.18
						var a := i * PI / 4.0 + tw
						pts.append(pp + Vector2(cos(a), sin(a)) * rr)
					glow.draw_colored_polygon(pts, Color(1, 1, 0.8, 1))
			PLUS:
				c.a = u
				glow.draw_line(q.p - Vector2(q.s, 0), q.p + Vector2(q.s, 0), c, 3.0, true)
				glow.draw_line(q.p - Vector2(0, q.s), q.p + Vector2(0, q.s), c, 3.0, true)
			SPARK:
				c.a = u
				var d: Vector2 = q.v
				var tail: Vector2 = q.p - d * (2.0 + q.s * 0.25)
				glow.draw_line(tail, q.p, Color(c.r, c.g, c.b, u * 0.3), maxf(2.0, q.s * 0.7 * u + 2.0), true)
				glow.draw_line(tail, q.p, c, maxf(1.0, q.s * 0.22 * u + 1.0), true)
				glow.draw_line(tail.lerp(q.p, 0.5), q.p, Color(1, 1, 1, u), maxf(1.0, q.s * 0.1 * u), true)
			SHARD:
				c.a = u
				var d: Vector2 = q.v.normalized() * q.s
				var n := Vector2(-d.y, d.x) * 0.35
				glow.draw_colored_polygon(PackedVector2Array([q.p + d, q.p + n, q.p - d, q.p - n]), c)
			DOT:
				c.a = u
				_soft(glow, tex_glow, q.p, q.s * 3.2 * (0.5 + 0.5 * u), c)
				glow.draw_circle(q.p, q.s * 0.5 * u + 0.4, Color(1, 1, 1, u))
			RING:
				c.a = u * 0.9
				var r: float = q.s * (1.0 - u * u * 0.85)
				var w: float = q.x if q.x > 0.0 else 4.0
				glow.draw_arc(q.p, r, 0, TAU, 56, Color(c.r, c.g, c.b, c.a * 0.25), (w * u + 1.0) * 4.0, true)
				glow.draw_arc(q.p, r, 0, TAU, 56, c, w * u + 1.0, true)
				glow.draw_arc(q.p, r, 0, TAU, 56, Color(1, 1, 1, c.a * 0.7), maxf(1.0, w * u * 0.35), true)
			FLASH:
				var e := 1.0 - u
				_soft(glow, tex_glow, q.p, q.s * (1.6 + e * 0.8), Color(c.r, c.g, c.b, u * 0.95))
				_soft(glow, tex_glow, q.p, q.s * 0.7 * (0.4 + u), Color(1, 1, 1, u))
				_soft(glow, tex_flare, q.p, q.s * 0.5, Color(1, 1, 1, u * 0.9), 0.0, 6.0 * (0.5 + e))
			LINES:
				# manga impact lines bursting out from the hit
				var e := 1.0 - u
				for k in 14:
					var a: float = q.x + k * TAU / 14.0 + sin(k * 7.3) * 0.15
					var d := Vector2(cos(a), sin(a))
					var r0: float = q.s * (0.35 + e * 0.9) * (0.8 + 0.4 * absf(sin(k * 3.1)))
					var r1: float = r0 + q.s * (0.55 + 0.3 * absf(sin(k * 5.7))) * u
					var nn := Vector2(-d.y, d.x) * (3.5 * u + 0.5)
					glow.draw_colored_polygon(PackedVector2Array([q.p + d * r0 - nn, q.p + d * r1, q.p + d * r0 + nn]), Color(c.r, c.g, c.b, u))
			FIRE:
				var e := 1.0 - u
				var col := Color(1.0, 0.85, 0.45).lerp(Color(1.0, 0.3, 0.08), clampf(e * 1.6, 0.0, 1.0))
				col.a = u * u
				_soft(glow, tex_puff, q.p, q.s * (0.8 + e * 1.2), col, q.x + e)
			STAR:
				c.a = u
				var pts := PackedVector2Array()
				var n := 10
				var rot: float = q.x
				for k in n * 2:
					var rr: float = q.s * (1.0 if k % 2 == 0 else 0.28) * (0.6 + 0.4 * u)
					var a := rot + k * PI / n
					pts.append(q.p + Vector2(cos(a), sin(a)) * rr)
				glow.draw_colored_polygon(pts, c)
			BEAM:
				c.a = u
				var d: Vector2 = q.v.normalized()
				var nrm := Vector2(-d.y, d.x)
				var w: float = q.s * (0.4 + 0.6 * u)
				var far: Vector2 = q.p + d * 2400.0
				glow.draw_colored_polygon(PackedVector2Array([q.p + nrm * w * 0.2, far + nrm * w, far - nrm * w, q.p - nrm * w * 0.2]), c)
				glow.draw_colored_polygon(PackedVector2Array([q.p, far + nrm * w * 0.3, far - nrm * w * 0.3]), Color(1, 1, 1, u))


# ---------------------------------------------------------------- emitters
func hit(p: Vector2, dir: Vector2, power: float, col: Color) -> void:
	if recording:
		rec.append([&"hit", p, dir, power, col])
	var n := int(6 + power * 0.7)
	for i in n:
		var a := dir.angle() + randf_range(-1.1, 1.1)
		var sp := randf_range(5.0, 11.0 + power * 0.5)
		_add(SPARK, p, Vector2(cos(a), sin(a)) * sp, randf_range(9, 16), randf_range(6, 12) + power * 0.3, col.lerp(Color(1, 1, 1), 0.3))
	for i in int(power * 0.4):
		var a := randf() * TAU
		_add(DOT, p, Vector2(cos(a), sin(a)) * randf_range(2, 7), randf_range(14, 28), randf_range(1.5, 3.0), col)
	_add(FLASH, p, Vector2.ZERO, 7, 18 + power * 1.8, col)
	_add(STAR, p, Vector2.ZERO, 6 + power * 0.15, 26 + power * 2.4, Color(1, 1, 1), randf() * TAU)
	_add(RING, p, Vector2.ZERO, 14, 40 + power * 3.0, col, 5.0)
	if power > 9:
		_add(LINES, p, Vector2.ZERO, 10 + power * 0.2, 36 + power * 2.2, col.lerp(Color(1, 1, 1), 0.5), randf() * TAU)
	if power > 20:
		_add(RING, p, Vector2.ZERO, 22, 90 + power * 3.0, Color(1, 1, 1), 3.0)
		_add(STAR, p, Vector2.ZERO, 10, 60 + power * 3.0, col, randf() * TAU)


func shield_hit(p: Vector2, col: Color) -> void:
	if recording:
		rec.append([&"shield_hit", p, col])
	_add(RING, p, Vector2.ZERO, 10, 34, col, 4.0)
	for i in 6:
		var a := randf() * TAU
		_add(SPARK, p, Vector2(cos(a), sin(a)) * randf_range(4, 8), 10, 6, Color(1, 1, 1))


func shield_break(p: Vector2, col: Color) -> void:
	if recording:
		rec.append([&"shield_break", p, col])
	for i in 24:
		var a := randf() * TAU
		_add(SHARD, p, Vector2(cos(a), sin(a)) * randf_range(4, 12), randf_range(24, 40), randf_range(5, 10), col)
	_add(RING, p, Vector2.ZERO, 26, 140, col, 8.0)
	_add(FLASH, p, Vector2.ZERO, 12, 70, col)


func spark_small(p: Vector2, col: Color) -> void:
	if recording:
		rec.append([&"spark_small", p, col])
	for i in 3:
		var a := randf() * TAU
		_add(SPARK, p, Vector2(cos(a), sin(a)) * randf_range(2, 5), 10, 5, col)


func ring(p: Vector2, col: Color, radius: float, life_s: float, width := 4.0) -> void:
	if recording:
		rec.append([&"ring", p, col, radius, life_s, width])
	_add(RING, p, Vector2.ZERO, life_s * 60.0, radius, col, width)


func dust(p: Vector2, dir: float, size: float) -> void:
	if recording:
		rec.append([&"dust", p, dir, size])
	var n := int(3 + size * 4)
	for i in n:
		var d := dir if dir != 0.0 else (1.0 if i % 2 == 0 else -1.0)
		var v := Vector2(d * randf_range(1.0, 4.0) * size, -randf_range(0.3, 1.6))
		_add(DUST, p + Vector2(randf_range(-6, 6), -3), v, randf_range(20, 34), randf_range(4, 8) * size, Color(0.92, 0.9, 0.88, 0.8), randf() * TAU)


func launch_smoke(p: Vector2, speed: float) -> void:
	if recording:
		rec.append([&"launch_smoke", p, speed])
	_add(SMOKE, p + Vector2(randf_range(-4, 4), randf_range(-4, 4)), Vector2.ZERO, 40, 7 + speed * 0.2, Color(0.95, 0.95, 1.0, 0.85), randf() * TAU)
	if speed > 24:
		_add(DOT, p, Vector2(randf_range(-1, 1), randf_range(-1, 1)), 18, 3.0, Color(1, 0.6, 0.3))


func smoke(p: Vector2, col: Color) -> void:
	if recording:
		rec.append([&"smoke", p, col])
	for i in 10:
		var a := randf() * TAU
		_add(SMOKE, p, Vector2(cos(a), sin(a)) * randf_range(1, 3), randf_range(20, 32), randf_range(6, 12), col.darkened(0.4), randf() * TAU)
	_add(RING, p, Vector2.ZERO, 14, 50, col, 3.0)


func jet(p: Vector2, col: Color) -> void:
	if recording:
		rec.append([&"jet", p, col])
	_add(DOT, p, Vector2(randf_range(-1.5, 1.5), randf_range(3, 6)), 16, 4.0, col)
	_add(SPARK, p, Vector2(randf_range(-2, 2), randf_range(5, 9)), 10, 7, Color(1, 1, 1))


func ko_blast(p: Vector2, toward: Vector2, col: Color) -> void:
	if recording:
		rec.append([&"ko_blast", p, toward, col])
	_add(BEAM, p, toward, 50, 110, col)
	_add(BEAM, p, toward.rotated(0.18), 40, 50, Color(1, 1, 1))
	_add(BEAM, p, toward.rotated(-0.22), 40, 40, col.lerp(Color(1, 1, 1), 0.5))
	_add(FLASH, p, Vector2.ZERO, 24, 220, col)
	for i in 3:
		_add(RING, p, Vector2.ZERO, 30 + i * 10, 200 + i * 120, col if i != 1 else Color(1, 1, 1), 10.0)
	for i in 40:
		var a := toward.angle() + randf_range(-0.9, 0.9)
		_add(SPARK, p, Vector2(cos(a), sin(a)) * randf_range(10, 34), randf_range(20, 40), randf_range(10, 22), col.lerp(Color(1, 1, 1), randf() * 0.6))


func slash(p: Vector2, col: Color) -> void:
	if recording:
		rec.append([&"slash", p, col])
	_add(SLASH, p, Vector2.ZERO, 10, randf_range(50, 90), col, randf() * TAU)


func star_ko(p: Vector2, col: Color) -> void:
	if recording:
		rec.append([&"star_ko", p, col])
	_add(STARKO, p, Vector2.ZERO, 80, 1.0, col)


func heal(p: Vector2) -> void:
	if recording:
		rec.append([&"heal", p])
	for i in 8:
		_add(PLUS, p + Vector2(randf_range(-24, 24), randf_range(-30, 20)), Vector2(0, -1.2), randf_range(30, 45), 6, Color(0.4, 1.0, 0.5))


func explosion(p: Vector2) -> void:
	if recording:
		rec.append([&"explosion", p])
	_add(FLASH, p, Vector2.ZERO, 14, 110, Color(1.0, 0.55, 0.15))
	_add(RING, p, Vector2.ZERO, 22, 130, Color(1.0, 0.75, 0.3), 10.0)
	for i in 30:
		var a := randf() * TAU
		_add(SPARK, p, Vector2(cos(a), sin(a)) * randf_range(6, 18), randf_range(14, 26), randf_range(8, 16), Color(1.0, randf_range(0.4, 0.8), 0.2))
	for i in 12:
		var a := randf() * TAU
		_add(FIRE, p + Vector2(cos(a), sin(a)) * randf_range(0, 24), Vector2(cos(a), sin(a)) * randf_range(1.5, 5), randf_range(22, 36), randf_range(26, 40), Color.WHITE, randf() * TAU)
	for i in 14:
		var a := randf() * TAU
		_add(SMOKE, p + Vector2(cos(a), sin(a)) * 20.0, Vector2(cos(a), sin(a)) * randf_range(1, 3), randf_range(40, 64), randf_range(14, 24), Color(0.3, 0.26, 0.26, 1), randf() * TAU)


func core_break(p: Vector2) -> void:
	if recording:
		rec.append([&"core_break", p])
	_add(FLASH, p, Vector2.ZERO, 26, 200, Color(1.0, 0.85, 0.4))
	for i in 3:
		_add(RING, p, Vector2.ZERO, 26 + i * 8, 160 + i * 90, Color.from_hsv(i * 0.3, 0.6, 1.0), 8.0)
	for i in 40:
		var a := randf() * TAU
		_add(SHARD, p, Vector2(cos(a), sin(a)) * randf_range(5, 16), randf_range(30, 50), randf_range(6, 11), Color.from_hsv(randf(), 0.6, 1.0))


func beam(p: Vector2, dir: Vector2, col: Color) -> void:
	if recording:
		rec.append([&"beam", p, dir, col])
	_add(BEAM, p, dir, 14, 120, col)
	_add(BEAM, p, dir, 10, 50, Color(1, 1, 1))
	_add(FLASH, p, Vector2.ZERO, 8, 60, col)
