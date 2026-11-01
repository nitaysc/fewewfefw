class_name FX
extends Node2D
## World-space particles: hit sparks, impact stars, shockwave rings, dust, smoke, KO blasts.
## Glowing things go to an additive child layer, dust and smoke draw normally.

enum { SPARK, DOT, RING, FLASH, STAR, DUST, SMOKE, BEAM, SHARD }

var parts: Array = []
var glow: Node2D


func _ready() -> void:
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
			DUST:
				q.v *= 0.9
				q.v.y -= 0.03
			SMOKE:
				q.v *= 0.93
		i += 1
	queue_redraw()
	glow.queue_redraw()


func _draw() -> void:
	for q in parts:
		var u: float = q.life / q.max
		match q.k:
			DUST:
				var c: Color = q.c
				c.a *= u * 0.8
				draw_circle(q.p, q.s * (1.6 - u * 0.6), c)
			SMOKE:
				var c: Color = q.c
				c.a *= u * 0.55
				draw_circle(q.p, q.s * (2.0 - u), c)


func _draw_glow() -> void:
	for q in parts:
		var u: float = q.life / q.max
		var c: Color = q.c
		match q.k:
			SPARK:
				c.a = u
				var d: Vector2 = q.v
				var tail: Vector2 = q.p - d * (2.0 + q.s * 0.25)
				glow.draw_line(tail, q.p, c, maxf(1.0, q.s * 0.22 * u + 1.0), true)
				glow.draw_line(tail.lerp(q.p, 0.5), q.p, Color(1, 1, 1, u), maxf(1.0, q.s * 0.1 * u), true)
			SHARD:
				c.a = u
				var d: Vector2 = q.v.normalized() * q.s
				var n := Vector2(-d.y, d.x) * 0.35
				glow.draw_colored_polygon(PackedVector2Array([q.p + d, q.p + n, q.p - d, q.p - n]), c)
			DOT:
				c.a = u
				glow.draw_circle(q.p, q.s * u + 0.5, c)
			RING:
				c.a = u * 0.9
				var r: float = q.s * (1.0 - u * u * 0.85)
				var w: float = q.x if q.x > 0.0 else 4.0
				glow.draw_arc(q.p, r, 0, TAU, 48, c, w * u + 1.0, true)
			FLASH:
				c.a = u * 0.9
				glow.draw_circle(q.p, q.s * (1.2 - u * 0.4), c)
				glow.draw_circle(q.p, q.s * 0.55 * u, Color(1, 1, 1, u))
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
	if power > 20:
		_add(RING, p, Vector2.ZERO, 22, 90 + power * 3.0, Color(1, 1, 1), 3.0)
		_add(STAR, p, Vector2.ZERO, 10, 60 + power * 3.0, col, randf() * TAU)


func shield_hit(p: Vector2, col: Color) -> void:
	_add(RING, p, Vector2.ZERO, 10, 34, col, 4.0)
	for i in 6:
		var a := randf() * TAU
		_add(SPARK, p, Vector2(cos(a), sin(a)) * randf_range(4, 8), 10, 6, Color(1, 1, 1))


func shield_break(p: Vector2, col: Color) -> void:
	for i in 24:
		var a := randf() * TAU
		_add(SHARD, p, Vector2(cos(a), sin(a)) * randf_range(4, 12), randf_range(24, 40), randf_range(5, 10), col)
	_add(RING, p, Vector2.ZERO, 26, 140, col, 8.0)
	_add(FLASH, p, Vector2.ZERO, 12, 70, col)


func spark_small(p: Vector2, col: Color) -> void:
	for i in 3:
		var a := randf() * TAU
		_add(SPARK, p, Vector2(cos(a), sin(a)) * randf_range(2, 5), 10, 5, col)


func ring(p: Vector2, col: Color, radius: float, life_s: float, width := 4.0) -> void:
	_add(RING, p, Vector2.ZERO, life_s * 60.0, radius, col, width)


func dust(p: Vector2, dir: float, size: float) -> void:
	var n := int(3 + size * 4)
	for i in n:
		var d := dir if dir != 0.0 else (1.0 if i % 2 == 0 else -1.0)
		var v := Vector2(d * randf_range(1.0, 4.0) * size, -randf_range(0.3, 1.6))
		_add(DUST, p + Vector2(randf_range(-6, 6), -3), v, randf_range(18, 30), randf_range(4, 8) * size, Color(0.85, 0.85, 0.9, 0.7))


func launch_smoke(p: Vector2, speed: float) -> void:
	_add(SMOKE, p + Vector2(randf_range(-4, 4), randf_range(-4, 4)), Vector2.ZERO, 40, 7 + speed * 0.2, Color(0.9, 0.9, 0.95, 0.9))
	if speed > 24:
		_add(DOT, p, Vector2(randf_range(-1, 1), randf_range(-1, 1)), 18, 3.0, Color(1, 0.6, 0.3))


func smoke(p: Vector2, col: Color) -> void:
	for i in 10:
		var a := randf() * TAU
		_add(SMOKE, p, Vector2(cos(a), sin(a)) * randf_range(1, 3), randf_range(20, 32), randf_range(6, 12), col.darkened(0.4))
	_add(RING, p, Vector2.ZERO, 14, 50, col, 3.0)


func jet(p: Vector2, col: Color) -> void:
	_add(DOT, p, Vector2(randf_range(-1.5, 1.5), randf_range(3, 6)), 16, 4.0, col)
	_add(SPARK, p, Vector2(randf_range(-2, 2), randf_range(5, 9)), 10, 7, Color(1, 1, 1))


func ko_blast(p: Vector2, toward: Vector2, col: Color) -> void:
	_add(BEAM, p, toward, 50, 110, col)
	_add(BEAM, p, toward.rotated(0.18), 40, 50, Color(1, 1, 1))
	_add(BEAM, p, toward.rotated(-0.22), 40, 40, col.lerp(Color(1, 1, 1), 0.5))
	_add(FLASH, p, Vector2.ZERO, 24, 220, col)
	for i in 3:
		_add(RING, p, Vector2.ZERO, 30 + i * 10, 200 + i * 120, col if i != 1 else Color(1, 1, 1), 10.0)
	for i in 40:
		var a := toward.angle() + randf_range(-0.9, 0.9)
		_add(SPARK, p, Vector2(cos(a), sin(a)) * randf_range(10, 34), randf_range(20, 40), randf_range(10, 22), col.lerp(Color(1, 1, 1), randf() * 0.6))
