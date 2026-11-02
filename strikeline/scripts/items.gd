class_name Items
extends Node2D
## Items: the Strike Core (break it to unlock a Final Smash), bombs (pick up and throw)
## and food (heals on touch).

var arena
var list: Array = []      # {kind, p, v, held_by, thrown_by, t, fuse, grounded}
var core: Dictionary = {} # empty when there is no Strike Core
var spawn_t := 600
var core_t := 1500
var t := 0


func step() -> void:
	t += 1
	if arena.cfg.get("items", true) and not arena.over:
		spawn_t -= 1
		if spawn_t <= 0:
			spawn_t = randi_range(720, 1200)
			if list.size() < 3:
				_spawn(["bomb", "food", "bomb"][randi() % 3])
		if core.is_empty() and not _anyone_ready():
			core_t -= 1
			if core_t <= 0:
				core_t = randi_range(1800, 2700)
				_spawn_core()
	_step_core()
	var i := 0
	while i < list.size():
		var it: Dictionary = list[i]
		it.t += 1
		if it.held_by != null:
			var h: Fighter = it.held_by
			if not is_instance_valid(h) or not h.alive():
				it.held_by = null
			else:
				it.p = h.joint_world(Rig.J_HF)
				it.v = Vector2.ZERO
		else:
			_physics(it)
			if it.kind == "food":
				for f in arena.fighters:
					if f.alive() and f.state != Fighter.S.RESPAWN and f.core_world().distance_to(it.p) < 40.0:
						var heal := minf(f.damage, 15.0)
						f.damage -= heal
						arena.fx.ring(it.p, Color(0.5, 1.0, 0.6), 40.0, 0.4)
						arena.fx.heal(f.core_world())
						Sfx.play("eat", -2)
						it.dead = true
						break
			elif it.kind == "bomb":
				if it.thrown_by != null:
					for f in arena.fighters:
						if f.can_be_hit() and (f != it.thrown_by or it.t > 25) and f.hurt_test(it.p, 12.0):
							_explode(it)
							break
				if it.get("armed", false) and it.grounded:
					_explode(it)
				if it.t > 900:
					_explode(it)
		if it.get("dead", false) or it.p.y > 900.0:
			if it.held_by != null:
				(it.held_by as Fighter).held_item = {}
			list.remove_at(i)
			continue
		i += 1
	queue_redraw()


func _anyone_ready() -> bool:
	for f in arena.fighters:
		if f.fs_ready:
			return true
	return false


func _spawn(kind: String) -> void:
	var r: Rect2 = arena.stage.main_rect()
	var p := Vector2(randf_range(r.position.x + 60, r.end.x - 60), -520)
	list.append({"kind": kind, "p": p, "v": Vector2(0, 2), "held_by": null, "thrown_by": null, "t": 0, "grounded": false})
	arena.fx.ring(p + Vector2(0, 300), Color(1, 1, 1, 0.4), 30.0, 0.3)


func _spawn_core() -> void:
	core = {"p": Vector2(randf_range(-300, 300), -700), "v": Vector2.ZERO, "hp": 28.0, "t": 0, "goal": Vector2(0, -250), "hit": {}, "flash": 0.0}
	Sfx.play("core_spawn", -2)


func _physics(it: Dictionary) -> void:
	it.v.y = minf(it.v.y + 0.55, 14.0)
	var prev: Vector2 = it.p
	it.p += it.v
	it.grounded = false
	if it.v.y >= 0.0:
		for pl in arena.stage.plats:
			var r: Rect2 = pl.rect
			if prev.y - 8.0 <= r.position.y + 0.5 and it.p.y - 8.0 >= r.position.y and it.p.x >= r.position.x and it.p.x <= r.end.x:
				it.p.y = r.position.y + 8.0
				if absf(it.v.y) > 6.0 and it.thrown_by == null:
					it.v.y = -it.v.y * 0.35
				else:
					it.v.y = 0.0
					it.grounded = true
				it.v.x *= 0.6
				break
	if it.grounded:
		it.v.x = move_toward(it.v.x, 0.0, 0.4)
	for pl in arena.stage.plats:
		if pl.solid and (pl.rect as Rect2).has_point(it.p) and not it.grounded:
			it.v.x = -it.v.x * 0.5
			it.p.x = prev.x


func _explode(it: Dictionary) -> void:
	it.dead = true
	var c: Vector2 = it.p
	arena.fx.explosion(c)
	arena.camera_shake(14.0)
	Sfx.play("explosion", 0)
	var by: Fighter = it.thrown_by if it.thrown_by != null else null
	for f in arena.fighters:
		if f.can_be_hit() and f.core_world().distance_to(c) < 85.0:
			var dirx := signf(f.pos.x - c.x)
			if dirx == 0.0:
				dirx = 1.0
			arena.apply_hit(by if by != null else f, f, {"d": 15.0, "b": 8.0, "g": 12.0, "a": 60.0}, f.core_world(), dirx, 1.0, true)
	if _core_alive() and core.p.distance_to(c) < 100.0 and by != null:
		hit_core(by, 15.0, Vector2(signf(core.p.x - c.x), -1))


## Called when a fighter presses ATTACK on the ground. Returns true if it picked something up.
func try_pickup(f: Fighter) -> bool:
	if not f.held_item.is_empty():
		return false
	for it in list:
		if it.kind == "bomb" and it.held_by == null and (it.thrown_by == null or it.grounded) and it.p.distance_to(f.pos + Vector2(f.facing * 10, -10)) < 55.0:
			it.held_by = f
			it.thrown_by = null
			it.armed = false
			f.held_item = it
			Sfx.play("pickup", -4)
			return true
	return false


func throw_item(f: Fighter, d: Vector2) -> void:
	var it: Dictionary = f.held_item
	if it.is_empty():
		return
	f.held_item = {}
	it.held_by = null
	it.thrown_by = f
	it.t = 0
	it.armed = true
	if d.y > 0.5:
		it.v = Vector2(0, 6)
	elif d.y < -0.5:
		it.v = Vector2(0, -17)
	else:
		it.v = Vector2(f.facing * 17.0, -4.5)
	it.p = f.joint_world(Rig.J_HF)
	it.grounded = false


func drop(f: Fighter) -> void:
	var it: Dictionary = f.held_item
	if it.is_empty():
		return
	f.held_item = {}
	it.held_by = null
	it.v = Vector2(randf_range(-3, 3), -5)
	it.armed = false


# ---------------------------------------------------------------- strike core
func _core_alive() -> bool:
	return not core.is_empty()


func _step_core() -> void:
	if core.is_empty():
		return
	core.t += 1
	core.flash = maxf(0.0, core.flash - 0.1)
	if core.t % 150 == 1:
		var r: Rect2 = arena.stage.main_rect()
		core.goal = Vector2(randf_range(r.position.x + 40, r.end.x - 40), randf_range(-420, -90))
	var to: Vector2 = core.goal - core.p
	core.v = core.v.lerp(to.normalized() * minf(3.2, to.length() * 0.05), 0.05)
	core.p += core.v + Vector2(0, sin(core.t * 0.06) * 0.6)
	if core.t > 1500:
		core.goal = Vector2(core.p.x, -1400)
	if core.p.y < -1300 and core.t > 1500:
		core = {}


func core_hits(c: Vector2, r: float) -> bool:
	return not core.is_empty() and (core.p as Vector2).distance_to(c) < r + 26.0


func hit_core(by: Fighter, dmg: float, dir: Vector2) -> void:
	if core.is_empty():
		return
	core.hp -= dmg
	core.flash = 1.0
	core.v += dir.normalized() * (4.0 + dmg * 0.4)
	arena.fx.hit(core.p, dir, 6.0, Color(1, 0.85, 0.4))
	Sfx.play("core_hit", -2)
	if core.hp <= 0.0:
		arena.fx.core_break(core.p)
		Sfx.play("core_break", 0)
		arena.camera_shake(10.0)
		by.fs_ready = true
		if arena.hud:
			arena.hud.flash(0.3)
		core = {}


# ---------------------------------------------------------------- drawing
func _draw() -> void:
	for it in list:
		var p: Vector2 = it.p
		match it.kind:
			"bomb":
				var blink: bool = it.get("armed", false) or (it.t > 700 and (it.t / 6) % 2 == 0)
				draw_circle(p, 13, Color(0.05, 0.05, 0.08))
				draw_circle(p, 11, Color(0.18, 0.18, 0.24) if not blink else Color(0.9, 0.25, 0.2))
				draw_circle(p + Vector2(-4, -4), 3.5, Color(1, 1, 1, 0.5))
				draw_rect(Rect2(p + Vector2(-4, -17), Vector2(8, 5)), Color(0.4, 0.4, 0.45))
				draw_line(p + Vector2(0, -17), p + Vector2(5, -24), Color(0.7, 0.6, 0.4), 2.0, true)
				var sp := p + Vector2(5, -24)
				draw_circle(sp, 2.5 + sin(t * 0.8) * 1.0, Color(1, 0.8, 0.3))
			"food":
				var bob := sin(t * 0.08 + p.x) * 2.0 if it.grounded else 0.0
				var q := p + Vector2(0, bob)
				draw_circle(q, 16, Color(0.4, 1.0, 0.5, 0.15))
				draw_colored_polygon(PackedVector2Array([q + Vector2(-12, 8), q + Vector2(12, 8), q + Vector2(0, -12)]), Color(0.97, 0.97, 0.95))
				draw_rect(Rect2(q + Vector2(-8, 2), Vector2(16, 6)), Color(0.12, 0.18, 0.12))
				draw_circle(q + Vector2(-3, -3), 2, Color(1, 1, 1))
	if not core.is_empty():
		var c: Vector2 = core.p
		var pulse := 1.0 + 0.1 * sin(core.t * 0.2)
		for k in 3:
			var hue := fmod(core.t * 0.01 + k * 0.33, 1.0)
			draw_circle(c, (40.0 - k * 8.0) * pulse, Color.from_hsv(hue, 0.6, 1.0, 0.12))
		draw_circle(c, 24, Color(0.08, 0.04, 0.12))
		draw_circle(c, 21, Color(1.0, 0.75, 0.25).lerp(Color(1, 1, 1), core.flash))
		# the emblem: a slash through a ring
		draw_arc(c, 13, 0, TAU, 28, Color(0.6, 0.1, 0.2), 3.5, true)
		draw_line(c + Vector2(-15, 9), c + Vector2(15, -9), Color(0.95, 0.15, 0.3), 5.0, true)
		draw_line(c + Vector2(-15, 9), c + Vector2(15, -9), Color(1, 1, 1, 0.7), 1.5, true)
		draw_arc(c, 21, -2.4, -1.2, 10, Color(1, 1, 1, 0.8), 3.0, true)
		for k in 4:
			var a: float = core.t * 0.05 + k * TAU / 4.0
			draw_circle(c + Vector2(cos(a), sin(a)) * 34.0 * pulse, 2.5, Color(1, 1, 1, 0.8))
