class_name AiBrain
extends RefCounted
## CPU opponent. Produces the same input dictionary a human would.
## level 0 = training dummy, 1 = easy, 2 = normal, 3 = hard.

const S := Fighter.S

var me: Fighter
var level := 2
var react := 12
var timer := 0
var jump_cd := 0
var hold := {"atk": 0, "spc": 0, "shd": 0, "jmp": 0}
var dir_hold := Vector2.ZERO
var dir_t := 0
var smash_t := 0
var ledge_wait := -1
var approach_bias := 0.0
var rng := RandomNumberGenerator.new()
var grab_wait := 0


func _init(f: Fighter, lvl: int) -> void:
	me = f
	level = clampi(lvl, 0, 3)
	react = [999, 24, 13, 6][level]
	rng.randomize()
	approach_bias = rng.randf_range(-40, 40)


func _press(out: Dictionary, k: String, frames := 1) -> void:
	match k:
		"atk": out.atk = true
		"spc": out.spc = true
		"jmp": out.jmp = true
		"shd": out.shd_p = true
	hold[k] = frames


func think() -> Dictionary:
	var out := {"x": 0.0, "y": 0.0}
	for k in hold:
		if hold[k] > 0:
			hold[k] -= 1
			out[k + "_h"] = true
	out.shd = hold.shd > 0
	if timer > 0: timer -= 1
	if jump_cd > 0: jump_cd -= 1
	if dir_t > 0:
		dir_t -= 1
		out.x = dir_hold.x
		out.y = dir_hold.y
	if smash_t > 0:
		smash_t -= 1
		out.smash = true

	var st: Stage = me.arena.stage
	var main: Rect2 = st.main_rect()

	if me.state == S.LEDGE:
		_ledge(out, main)
		return out
	if me.state == S.GRABBED:
		if level > 0 and rng.randf() < 0.07 * level:
			out.atk = true
		return out
	if me.state == S.GRABBING:
		_throw(out, main)
		return out
	if me.state == S.HITSTUN:
		out.x = -signf(me.pos.x) * (0.0 if level < 2 else 1.0)
		if me.tumble and level >= 2 and rng.randf() < (0.08 if level == 3 else 0.03):
			out.shd_p = true
		return out

	var offstage := not me.grounded and (me.pos.x < main.position.x - 4.0 or me.pos.x > main.end.x + 4.0 or me.pos.y > main.position.y + 10.0)
	if offstage:
		_recover(out, main)
		return out
	if level == 0:
		return out

	var tgt := _target()
	if tgt == null:
		return out
	# Final Smash as soon as someone is close enough
	if me.fs_ready and timer <= 0 and me.is_ground_state() or (me.fs_ready and me.state == S.AIR):
		if tgt.pos.distance_to(me.pos) < 500.0:
			me.facing = signf(tgt.pos.x - me.pos.x) if absf(tgt.pos.x - me.pos.x) > 1.0 else me.facing
			out.x = 0.0
			out.y = 0.0
			_press(out, "spc")
			return out
	# holding an item: throw it at the target
	if not me.held_item.is_empty():
		var ddx: float = tgt.pos.x - me.pos.x
		if absf(ddx) < 420.0 and absf(tgt.pos.y - me.pos.y) < 120.0 and timer <= 0:
			me.facing = signf(ddx) if absf(ddx) > 1.0 else me.facing
			out.x = 0.0
			_press(out, "atk")
			timer = react
			return out
	# go for the Strike Core / items
	var goal := _item_goal()
	if goal != Vector2.INF and me.state in [S.IDLE, S.RUN, S.AIR, S.CROUCH, S.LAND]:
		var gd := goal - me.pos
		out.x = signf(gd.x) if absf(gd.x) > 25.0 else 0.0
		if me.grounded and gd.y < -110.0 and absf(gd.x) < 200.0 and jump_cd <= 0:
			_press(out, "jmp", 10)
			jump_cd = 30
		elif not me.grounded and gd.y < -60.0 and me.jumps_left > 0 and me.vel.y > 0 and jump_cd <= 0:
			_press(out, "jmp", 10)
			jump_cd = 20
		if gd.length() < 70.0 and timer <= 0:
			timer = react
			out.x = 0.0
			if gd.y < -40.0:
				out.y = -1.0
			_press(out, "atk")
		return out
	var dx: float = tgt.pos.x - me.pos.x
	var dy: float = tgt.pos.y - me.pos.y
	var adx := absf(dx)
	var face := signf(dx) if adx > 1.0 else me.facing
	var reach: float = 70.0 + me.data.wlen * 0.7 + (25.0 if me.data.weapon == "fists" else 0.0)
	var tgt_off := not tgt.grounded and (tgt.pos.x < main.position.x or tgt.pos.x > main.end.x)

	# keep out of shield when the target is far, release it when nothing is coming
	if me.state == S.SHIELD and hold.shd <= 0:
		out.shd = false

	# defend
	if me.is_ground_state() and me.state != S.SHIELD and tgt.state == S.ATTACK and tgt.mf < 8.0 and adx < reach + 60.0 and absf(dy) < 120.0 and timer <= 0:
		var p: float = [0.0, 0.08, 0.22, 0.42][level]
		if rng.randf() < p:
			if rng.randf() < 0.65:
				_press(out, "shd", rng.randi_range(10, 22))
				out.shd = true
			else:
				dir_hold = Vector2(-face, 0)
				dir_t = 3
				out.x = -face
				_press(out, "shd", 4)
				out.shd = true
				out.flick_x = true
			timer = react
			return out

	if me.state == S.ATTACK or hold.atk > 0 or hold.spc > 0:
		# drift a bit while attacking in the air, keep holding charge buttons
		if not me.grounded:
			out.x = face * 0.6
		return out

	if me.grounded:
		# edge-guard: don't walk off after an opponent who is off-stage
		var edge_l := main.position.x + 40.0
		var edge_r := main.end.x - 40.0
		var walk := face
		if adx < reach * 0.75 + approach_bias * 0.2 and absf(dy) < 60:
			walk = 0.0
		if tgt_off:
			if (me.pos.x < edge_l and walk < 0) or (me.pos.x > edge_r and walk > 0):
				walk = 0.0
		out.x = walk * (1.0 if adx > 160 else 0.7)
		if timer <= 0:
			timer = react + rng.randi_range(0, react)
			_ground_decision(out, tgt, dx, dy, adx, face, reach, tgt_off)
		# chase onto platforms
		if dy < -100.0 and adx < 170.0 and jump_cd <= 0 and rng.randf() < 0.08:
			_press(out, "jmp", 8)
			jump_cd = 40
		# drop down to a target below
		if dy > 100.0 and me.arena.stage.is_soft(me.plat) and adx < 220 and rng.randf() < 0.06:
			out.y = 1.0
			out.down = true
			out.down_h = true
			out.x = 0.0
	else:
		out.x = face if adx > 30 else 0.0
		if timer <= 0 and me.state == S.AIR:
			var d := Vector2(dx, dy - 10.0)
			if d.length() < reach + 35.0:
				timer = react + rng.randi_range(0, react / 2)
				_aerial(out, dx, dy, face)
			elif jump_cd <= 0 and me.jumps_left > 0 and dy < -80 and rng.randf() < 0.3:
				_press(out, "jmp", 8)
				jump_cd = 30
		if me.vel.y > 0 and dy > 60 and adx < 120 and rng.randf() < 0.05 * level:
			out.y = 1.0
			out.down = true
	return out


func _target() -> Fighter:
	var best: Fighter = null
	var bd := INF
	for f in me.arena.fighters:
		if f == me or not f.alive() or f.state == S.RESPAWN:
			continue
		var d: float = f.pos.distance_to(me.pos)
		if not f.is_cpu:
			d *= 0.8
		if d < bd:
			bd = d
			best = f
	return best


func _ground_decision(out: Dictionary, tgt: Fighter, dx: float, dy: float, adx: float, face: float, reach: float, tgt_off: bool) -> void:
	var r := rng.randf()
	var in_range := adx < reach and absf(dy) < 60.0
	var kill := tgt.damage > rng.randf_range(85.0, 130.0)
	if in_range:
		if kill and r < 0.55:
			# smash attack toward the target, sometimes charged
			dir_hold = Vector2(face, 0)
			if dy < -30.0:
				dir_hold = Vector2(0, -1)
			elif rng.randf() < 0.25:
				dir_hold = Vector2(0, 1)
			dir_t = 2
			out.x = dir_hold.x
			out.y = dir_hold.y
			smash_t = 2
			out.smash = true
			_press(out, "atk", rng.randi_range(1, 22) if level >= 2 else 1)
		elif r < 0.3:
			out.x = 0.0
			_press(out, "atk")
		elif r < 0.58:
			out.x = face
			_press(out, "atk")
		elif r < 0.72:
			out.x = 0.0
			out.y = 1.0
			_press(out, "atk")
		elif r < 0.8:
			_press(out, "jmp", 3)
			jump_cd = 20
		elif r < 0.9 or tgt.state == S.SHIELD:
			# grab (shield + attack)
			out.shd = true
			me.facing = face
			_press(out, "atk")
		else:
			# special up close
			out.y = 1.0 if me.data.id in ["sol", "kai"] else 0.0
			out.x = 0.0 if out.y != 0.0 else face
			_press(out, "spc", rng.randi_range(1, 20))
		return
	if dy < -70.0 and adx < 70.0:
		if r < 0.5:
			out.x = 0.0
			out.y = -1.0
			_press(out, "atk")
		else:
			_press(out, "jmp", 8)
			jump_cd = 25
		return
	if adx > 320.0 and r < 0.35 and me.data.id in ["kai", "nyx", "sol"]:
		out.x = 0.0
		out.y = 0.0
		me.facing = face
		_press(out, "spc", rng.randi_range(1, 30) if me.data.id == "sol" else 1)
		return
	if adx > 160.0 and adx < 300.0 and r < 0.2:
		# dash attack approach
		dir_hold = Vector2(face, 0)
		dir_t = 18
		return
	if adx > 120.0 and adx < 260.0 and r < 0.18 and me.data.id in ["kai", "nyx", "bruno"] and not tgt_off:
		out.x = face
		_press(out, "spc")
		return
	if adx < 260.0 and r < 0.3:
		_press(out, "jmp", 3 if r < 0.15 else 8)
		jump_cd = 20


func _aerial(out: Dictionary, dx: float, dy: float, face: float) -> void:
	if dy < -45.0 and absf(dx) < 60.0:
		out.x = 0.0
		out.y = -1.0
	elif dy > 45.0 and absf(dx) < 60.0:
		out.x = 0.0
		out.y = 1.0
	elif signf(dx) == me.facing:
		out.x = me.facing
		out.y = 0.0
	elif absf(dx) > 20.0:
		out.x = -me.facing
		out.y = 0.0
	_press(out, "atk")


func _recover(out: Dictionary, main: Rect2) -> void:
	var left := me.pos.x < 0.0
	var edge := Vector2(main.position.x if left else main.end.x, main.position.y)
	var dir := 1.0 if left else -1.0
	out.x = dir
	var below := me.pos.y > edge.y - 30.0
	var far := absf(me.pos.x - edge.x)
	if me.state != S.AIR:
		if me.state == S.ATTACK and me.mv.get("logic", "") == "jet":
			out.y = -1.0
		elif me.state == S.ATTACK and me.mv.get("logic", "") == "dive":
			pass
		return
	if (me.vel.y > -1.0 or below) and jump_cd <= 0 and me.jumps_left > 0:
		if below or far > 180.0 or me.vel.y > 4.0:
			_press(out, "jmp", 10)
			jump_cd = 18 if level >= 2 else 26
			return
	if me.jumps_left == 0 and me.vel.y > 0.0 and me.state == S.AIR:
		var need_up := me.pos.y > edge.y - 60.0
		if need_up or far > 220.0:
			if me.data.id == "nyx":
				var d := (edge + Vector2(dir * 30.0, -50.0) - me.pos).normalized()
				out.x = d.x
				out.y = d.y
				dir_hold = d
				dir_t = 12
			elif far > 260.0 and not me.air_once.get("sb", false) and me.data.id in ["kai", "bruno", "sol"] and not need_up:
				out.y = 0.0
				out.x = dir
				_press(out, "spc")
				return
			else:
				out.y = -1.0
				out.x = dir * 0.6
			_press(out, "spc")


func _ledge(out: Dictionary, main: Rect2) -> void:
	if ledge_wait < 0:
		ledge_wait = rng.randi_range(8, 40) if level > 0 else rng.randi_range(20, 60)
	ledge_wait -= 1
	if ledge_wait <= 0:
		ledge_wait = -1
		var toward := 1.0 if me.pos.x < 0 else -1.0
		if rng.randf() < 0.5:
			out.x = toward
		else:
			_press(out, "jmp", 8)


func _throw(out: Dictionary, main: Rect2) -> void:
	if grab_wait <= 0:
		grab_wait = rng.randi_range(6, 18)
	grab_wait -= 1
	if grab_wait > 1:
		if rng.randf() < 0.15:
			out.atk = true
		return
	var v := me.grab_victim
	var to_left: float = me.pos.x - main.position.x
	var to_right: float = main.end.x - me.pos.x
	if v != null and v.damage > 110.0 and rng.randf() < 0.5:
		out.y = -1.0
	elif v != null and v.damage < 40.0 and rng.randf() < 0.4:
		out.y = 1.0
	else:
		out.x = -1.0 if to_left < to_right else 1.0


func _item_goal() -> Vector2:
	if level == 0:
		return Vector2.INF
	var items = me.arena.items
	if not items.core.is_empty():
		var c: Vector2 = items.core.p
		if c.distance_to(me.pos) < 650.0 and c.y > -500.0:
			return c + Vector2(0, 60)
	if not me.held_item.is_empty():
		return Vector2.INF
	for it in items.list:
		if it.held_by != null or not it.grounded:
			continue
		var p: Vector2 = it.p
		if p.distance_to(me.pos) > 380.0:
			continue
		if it.kind == "food" and me.damage > 35.0:
			return p
		if it.kind == "bomb" and level >= 2:
			return p
	return Vector2.INF
