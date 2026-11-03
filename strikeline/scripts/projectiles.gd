class_name Projectiles
extends Node2D
## Projectiles (crescent waves, kunai, orbs, shockwaves). Drawn additively.

var arena
var list: Array = []
var t := 0


func _ready() -> void:
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	material = m
	z_index = 4


func spawn(kind: String, owner: Fighter, charge: float) -> void:
	var f := owner.facing
	var hand := owner.joint_world(Rig.J_HF)
	var col: Color = owner.data.accent
	match kind:
		"crescent":
			_add({"kind": kind, "p": owner.core_world() + Vector2(f * 30, -4), "v": Vector2(f * 14.0, 0), "r": 22.0,
				"life": 36, "d": 7.0, "b": 4.0, "g": 6.0, "a": 30.0, "c": col, "owner": owner})
		"kunai":
			for i in 3:
				var ang := deg_to_rad(-9.0 + i * 9.0)
				var v := Vector2(cos(ang) * f, sin(ang)) * 19.0
				_add({"kind": kind, "p": hand, "v": v, "r": 8.0, "life": 28, "d": 3.0, "b": 2.5, "g": 3.0,
					"a": 20.0, "c": col, "owner": owner})
		"orb":
			var r := 12.0 + charge * 16.0
			_add({"kind": kind, "p": hand + Vector2(f * r, 0), "v": Vector2(f * (9.0 + charge * 4.0), 0), "r": r,
				"life": 70, "d": 6.0 + 12.0 * charge, "b": 5.0, "g": 6.0 + 7.0 * charge, "a": 40.0, "c": col, "owner": owner})
		"seed":
			_add({"kind": kind, "p": hand + Vector2(f * 8, -4), "v": Vector2(f * 9.0, -7.0), "r": 9.0,
				"life": 90, "d": 5.0, "b": 4.0, "g": 5.0, "a": 40.0, "c": Color(0.6, 1.0, 0.35), "owner": owner, "bounced": 0})
		"missile":
			# three small missiles fanned upward that curve onto the nearest rival
			for i in 3:
				var ang := deg_to_rad(-40.0 + i * 25.0)
				_add({"kind": kind, "p": hand + Vector2(f * 10, -6), "v": Vector2(cos(ang) * f, sin(ang)) * 9.0, "r": 10.0,
					"life": 90, "d": 4.0, "b": 4.0, "g": 4.0, "a": 50.0, "c": Color(1.0, 0.6, 0.2), "owner": owner})
		"fist":
			_add({"kind": kind, "p": hand + Vector2(f * 16, 0), "v": Vector2(f * 21.0, 0), "r": 18.0,
				"life": 80, "d": 10.0, "b": 7.0, "g": 10.0, "a": 32.0, "c": Color(1.0, 0.55, 0.15), "owner": owner, "back": false})
		"mine":
			_add({"kind": kind, "p": owner.pos + Vector2(f * 26, -10), "v": Vector2(f * 2.0, -3.0), "r": 12.0,
				"life": 360, "d": 13.0, "b": 8.0, "g": 12.0, "a": 75.0, "c": owner.data.accent, "owner": owner, "landed": false})
		"shockwave":
			var pr: Rect2 = arena.stage.plats[owner.plat].rect if owner.plat >= 0 else Rect2(-10000, 0, 20000, 10)
			for d in [-1.0, 1.0]:
				_add({"kind": kind, "p": Vector2(owner.pos.x + d * 30.0, owner.pos.y - 16.0), "v": Vector2(d * 10.0, 0), "r": 20.0,
					"life": 30, "d": 9.0, "b": 6.0, "g": 9.0, "a": 70.0, "c": col, "owner": owner, "bounds": pr})


func _add(p: Dictionary) -> void:
	p.t = 0
	p.hit = {}
	list.append(p)


func count(owner: Fighter, kind: String) -> int:
	var n := 0
	for p in list:
		if p.owner == owner and p.kind == kind:
			n += 1
	return n


func destroy_near(c: Vector2, r: float, by: Fighter) -> void:
	for p in list:
		if p.owner != by and (p.p as Vector2).distance_to(c) < r + p.r:
			p.life = 0
			arena.fx.ring(p.p, Color(1, 1, 1), 30.0, 0.25)


func step() -> void:
	t += 1
	var i := 0
	while i < list.size():
		var p: Dictionary = list[i]
		p.t += 1
		p.life -= 1
		p.p += p.v
		if p.kind == "shockwave":
			var b: Rect2 = p.bounds
			if p.p.x < b.position.x - 10.0 or p.p.x > b.end.x + 10.0:
				p.life = 0
		elif p.kind == "kunai":
			p.v.y += 0.12
		elif p.kind == "missile":
			_home(p)
		elif p.kind == "seed":
			p.v.y += 0.5
			var gy: float = arena.stage.ground_below(p.p - p.v)
			if p.v.y > 0.0 and gy != INF and p.p.y >= gy - 6.0:
				p.p.y = gy - 6.0
				p.bounced += 1
				p.v = Vector2(p.v.x * 0.8, -p.v.y * 0.6)
				arena.fx.spark_small(p.p, p.c)
				if p.bounced > 2:
					p.life = 0
		elif p.kind == "fist":
			_fist(p)
		elif p.kind == "mine":
			_mine(p)
		if not p.kind in ["shockwave", "fist", "mine"] and arena.stage.box_hits_solid(Rect2(p.p - Vector2(2, 2), Vector2(4, 4))):
			p.life = 0
			arena.fx.spark_small(p.p, p.c)
		if p.life > 0 and p.kind != "mine":
			_collide(p)
		if p.life <= 0:
			if p.kind == "orb":
				arena.fx.ring(p.p, p.c, p.r * 2.0, 0.3)
			elif p.kind == "missile":
				arena.fx.ring(p.p, Color(1.0, 0.6, 0.2), 26.0, 0.25)
				arena.fx.spark_small(p.p, Color(1.0, 0.7, 0.3))
			elif p.kind == "mine" and p.get("boom", false):
				_mine_blast(p)
			list.remove_at(i)
			continue
		i += 1
	queue_redraw()


func _collide(p: Dictionary) -> void:
	var owner: Fighter = p.owner
	if arena.items.core_hits(p.p, p.r) and not p.hit.has("core"):
		p.hit["core"] = true
		arena.items.hit_core(owner, p.d, p.v)
		if p.kind != "shockwave":
			p.life = 0
			return
	for f in arena.fighters:
		if f == owner or not f.can_be_hit() or p.hit.has(f.port):
			continue
		var c: Vector2 = p.p
		var r: float = p.r
		var touched := false
		if f.state == Fighter.S.SHIELD:
			touched = c.distance_to(f.core_world()) < r + f.shield_radius()
		else:
			touched = f.hurt_test(c, r)
		if touched:
			p.hit[f.port] = true
			var dirx := signf(p.v.x) if absf(p.v.x) > 0.1 else signf(f.pos.x - c.x)
			arena.apply_hit(owner, f, {"d": p.d, "b": p.b, "g": p.g, "a": p.a}, c, dirx, 1.0, true)
			if p.kind == "fist":
				p.back = true
			elif p.kind != "shockwave":
				p.life = 0
			return


func _draw() -> void:
	for p in list:
		var c: Color = p.c
		var pos: Vector2 = p.p
		match p.kind:
			"crescent":
				var d := signf(p.v.x)
				var fade := clampf(p.life / 8.0, 0.0, 1.0)
				for k in 3:
					var off := Vector2(-d * k * 12.0, 0)
					var a := (0.9 - k * 0.3) * fade
					_crescent(pos + off, p.r * (1.0 - k * 0.12), d, Color(c.r, c.g, c.b, a))
				_crescent(pos + Vector2(d * 3, 0), p.r * 0.8, d, Color(1, 1, 1, 0.8 * fade))
			"kunai":
				var d: Vector2 = (p.v as Vector2).normalized()
				var n := Vector2(-d.y, d.x)
				draw_line(pos - d * 26.0, pos, Color(c.r, c.g, c.b, 0.5), 3.0, true)
				draw_colored_polygon(PackedVector2Array([pos + d * 8.0, pos + n * 3.0 - d * 4.0, pos - n * 3.0 - d * 4.0]), Color(1, 1, 1, 0.95))
			"orb":
				var r: float = p.r
				var pulse := 1.0 + 0.08 * sin(p.t * 0.6)
				draw_circle(pos, r * 1.8 * pulse, Color(c.r, c.g, c.b, 0.15))
				draw_circle(pos, r * 1.2 * pulse, Color(c.r, c.g, c.b, 0.35))
				draw_circle(pos, r * 0.8, Color(c.r, c.g, c.b, 0.8))
				draw_circle(pos, r * 0.45, Color(1, 1, 1, 0.95))
				for k in 3:
					var a: float = p.t * 0.25 + k * TAU / 3.0
					draw_arc(pos, r * 1.15, a, a + 1.2, 10, Color(1, 1, 1, 0.6), 2.0, true)
				draw_line(pos, pos - (p.v as Vector2) * 3.0, Color(c.r, c.g, c.b, 0.3), r * 0.9, true)
			"seed":
				var rot: float = p.t * 0.4
				draw_circle(pos, 12.0, Color(c.r, c.g, c.b, 0.22))
				draw_set_transform(pos, rot, Vector2(1.0, 0.7))
				draw_circle(Vector2.ZERO, 8.0, Color(0.75, 0.5, 0.25, 0.95))
				draw_circle(Vector2(-2, -2), 3.0, Color(1, 1, 0.8, 0.8))
				draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
			"missile":
				var d: Vector2 = (p.v as Vector2).normalized()
				var n := Vector2(-d.y, d.x)
				draw_line(pos - d * 30.0, pos, Color(1.0, 0.5, 0.15, 0.45), 6.0, true)
				draw_colored_polygon(PackedVector2Array([pos + d * 10.0, pos + n * 4.0 - d * 6.0, pos - n * 4.0 - d * 6.0]), Color(1, 0.95, 0.85))
				draw_circle(pos - d * 7.0, 4.5, Color(1.0, 0.6, 0.2, 0.9))
			"fist":
				var d: Vector2 = (p.v as Vector2).normalized()
				var n := Vector2(-d.y, d.x)
				draw_line(pos - d * 44.0, pos - d * 8.0, Color(1.0, 0.5, 0.12, 0.4), 16.0, true)
				draw_circle(pos, 19.0, Color(1.0, 0.55, 0.15, 0.25))
				# knuckles: a rounded block with three bumps
				draw_circle(pos, 13.0, Color(0.95, 0.97, 1.0, 0.9))
				for k in 3:
					draw_circle(pos + d * 9.0 + n * (k - 1) * 7.0, 5.0, Color(1, 1, 1, 0.95))
				draw_arc(pos, 15.0, 0, TAU, 24, Color(0.4, 1.0, 0.9, 0.8), 2.5, true)
			"mine":
				var armed: bool = p.landed and p.t > 30
				var blink: bool = armed and (int(p.t) / 6) % 2 == 0
				draw_circle(pos, 13.0, Color(0.35, 0.35, 0.4, 0.6))
				draw_circle(pos, 9.0, Color(1.0, 0.2, 0.15, 0.95) if blink else Color(c.r, c.g, c.b, 0.8))
				if armed:
					draw_arc(pos, 58.0, 0, TAU, 40, Color(1.0, 0.3, 0.2, 0.12 + 0.1 * float(blink)), 2.0, true)
			"shockwave":
				var d := signf(p.v.x)
				var u: float = 1.0 - float(p.t) / 30.0
				var h := 46.0 * (0.6 + 0.4 * sin(p.t * 0.9))
				var base: Vector2 = pos + Vector2(0, 16)
				var pts := PackedVector2Array([base + Vector2(-d * 30, 0), base + Vector2(-d * 12, -h * 0.6), base + Vector2(0, -h),
					base + Vector2(d * 10, -h * 0.5), base + Vector2(d * 26, 0)])
				draw_colored_polygon(pts, Color(c.r, c.g, c.b, 0.55 * u + 0.2))
				draw_polyline(pts, Color(1, 1, 1, 0.8 * u + 0.1), 2.0, true)


func _home(p: Dictionary) -> void:
	# fly out for a moment, then steer toward the closest rival
	if p.t < 10:
		p.v *= 0.97
		return
	var best: Fighter = null
	var bd := INF
	for f in arena.fighters:
		if f == p.owner or not f.can_be_hit():
			continue
		var d: float = f.core_world().distance_to(p.p)
		if d < bd:
			bd = d
			best = f
	var sp := minf(13.0, (p.v as Vector2).length() + 0.5)
	if best != null:
		var want: Vector2 = (best.core_world() - p.p).normalized() * sp
		p.v = (p.v as Vector2).lerp(want, 0.09)
	p.v = (p.v as Vector2).normalized() * sp
	if p.t % 2 == 0:
		arena.fx.jet(p.p, Color(1.0, 0.6, 0.2))


func _fist(p: Dictionary) -> void:
	var owner: Fighter = p.owner
	if not p.back:
		p.v *= 0.93
		if p.t > 20 or (p.v as Vector2).length() < 4.0 or arena.stage.box_hits_solid(Rect2(p.p - Vector2(4, 4), Vector2(8, 8))):
			p.back = true
	if p.back:
		if not is_instance_valid(owner) or not owner.alive():
			p.life = 0
			return
		var to: Vector2 = owner.core_world() - p.p
		p.v = (p.v as Vector2).lerp(to.normalized() * 19.0, 0.25)
		if to.length() < 34.0:
			p.life = 0
	if p.t % 2 == 0:
		arena.fx.jet(p.p - (p.v as Vector2).normalized() * 14.0, Color(1.0, 0.55, 0.15))


func _mine(p: Dictionary) -> void:
	if not p.landed:
		p.v.y = minf(p.v.y + 0.6, 14.0)
		p.v.x *= 0.96
		var gy: float = arena.stage.ground_below(p.p - p.v)
		if p.v.y > 0.0 and gy != INF and p.p.y >= gy - 6.0:
			p.p.y = gy - 6.0
			p.v = Vector2.ZERO
			p.landed = true
			Sfx.play("land", -10)
		if p.p.y > 900.0:
			p.life = 0
		return
	p.v = Vector2.ZERO
	# armed after half a second: anyone stepping close sets it off
	if p.t > 30:
		for f in arena.fighters:
			if f != p.owner and f.can_be_hit() and f.core_world().distance_to(p.p) < 58.0:
				p.boom = true
				p.life = 0
				return
	if p.life <= 1:
		p.boom = true


func _mine_blast(p: Dictionary) -> void:
	var c: Vector2 = p.p
	arena.fx.explosion(c)
	arena.camera_shake(10.0)
	Sfx.play("explosion", -2)
	for f in arena.fighters:
		if f != p.owner and f.can_be_hit() and f.core_world().distance_to(c) < 90.0:
			var dirx := signf(f.pos.x - c.x)
			if dirx == 0.0:
				dirx = 1.0
			arena.apply_hit(p.owner, f, {"d": p.d, "b": p.b, "g": p.g, "a": p.a}, f.core_world(), dirx, 1.0, true)


func _crescent(c: Vector2, r: float, d: float, col: Color) -> void:
	var pts := PackedVector2Array()
	var n := 14
	for i in n + 1:
		var a := lerpf(-1.25, 1.25, float(i) / n)
		pts.append(c + Vector2(cos(a) * d, sin(a)) * r)
	for i in range(n, -1, -1):
		var a := lerpf(-1.25, 1.25, float(i) / n)
		pts.append(c + Vector2(d * r * 0.28, 0) + Vector2(cos(a) * d, sin(a)) * r * 0.68)
	draw_colored_polygon(pts, col)
