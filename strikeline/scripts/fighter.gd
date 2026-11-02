class_name Fighter
extends Node2D
## One stickman fighter: input handling, state machine, physics, animation and drawing.

enum S { IDLE, RUN, CROUCH, SQUAT, AIR, LAND, ATTACK, HITSTUN, SHIELD, ROLL, SPOT, AIRDODGE,
	LEDGE, CLIMB, HELPLESS, KNOCKDOWN, GETUP, DIZZY, DEAD, OUT, RESPAWN, GRABBING, GRABBED }

const SHIELD_MAX := 60.0
const GROUND_STATES := [S.IDLE, S.RUN, S.CROUCH, S.SQUAT, S.LAND, S.SHIELD, S.ROLL, S.SPOT,
	S.KNOCKDOWN, S.GETUP, S.DIZZY, S.RESPAWN]

var arena  # Match
var port := 0
var data: Dictionary
var dims: Dictionary
var scale_k := 1.0
var is_cpu := false
var brain  # AiBrain or null
var tag_color := Color.WHITE
var tag_text := "P1"

# physics
var pos := Vector2.ZERO
var vel := Vector2.ZERO
var kvel := Vector2.ZERO
var facing := 1.0
var grounded := false
var plat := -1
var jumps_left := 2
var fastfall := false
var drop_timer := 0
var no_grav := false
var hw := 15.0
var hh := 82.0

# state
var state := S.AIR
var sframe := 0
var damage := 0.0
var stocks := 3
var hitstun := 0
var tumble := false
var hitlag := 0
var intangible := 0
var invincible := 0
var shield_hp := SHIELD_MAX
var shieldstun := 0
var airdodge_ok := true
var air_once := {}
var ledge_cd := 0
var ledge_id := -1
var ledge_regrabs := 0
var land_lag := 0
var dizzy_t := 0
var dead_t := 0
var roll_dir := 1.0
var flip_t := 0
var flip_dir := 1.0
var spin_rot := 0.0
var last_hitter := -1
var last_hitter_t := 0
var respawn_plat_t := 0
var eliminated := false

# move
var mv: Dictionary = {}
var mf := 0.0
var mf_prev := 0.0
var charge_ct := 0
var charging := false
var move_inst := 0
var hit_landed := false
var counter_on := false
var armor := false
var hit_log := {}

# input
var inp: Dictionary = {}
var buf := {"atk": 0, "spc": 0, "jmp": 0, "shd": 0}

# animation
var cur := PackedFloat32Array()
var joints := PackedVector2Array()
var root := Vector2(0, -46)
var run_ph := 0.0
var t := 0
var flash := 0.0
var shake := Vector2.ZERO
var alpha := 1.0
var trail: Array = []
var ghosts: Array = []
var scarf: Array = []
var scarf_prev: Array = []
var style := {}

# smash systems
var grab_victim: Fighter = null
var grab_holder: Fighter = null
var grab_t := 0
var held_item: Dictionary = {}
var fs_ready := false
var fs_victims: Array = []
var parry_t := 0
var squash := 0.0
var intro_t := 0
var combo := 0
var climb_attack := false
var pose_vel := PackedFloat32Array()
var score := 0

# stats
var st_kos := 0
var st_falls := 0
var st_dealt := 0.0


func setup(p_arena, p_port: int, fighter_idx: int, cpu: bool, level: int) -> void:
	arena = p_arena
	port = p_port
	data = Roster.fighter(fighter_idx)
	dims = data.dims.duplicate()
	dims.weapon = data.wlen
	scale_k = dims.torso / 30.0
	hw = 15.0 * scale_k
	hh = 84.0 * scale_k
	is_cpu = cpu
	if cpu:
		brain = AiBrain.new(self, level)
	jumps_left = data.jumps
	cur = Roster.pose("guard").duplicate()
	joints.resize(Rig.NJ)
	var body: Color = data.body
	style = {
		"body": body, "back": body.darkened(0.35), "line": (data.accent as Color).darkened(0.15),
		"accent": data.accent, "w": data.w, "head": dims.head, "weapon": data.weapon, "facing": 1.0,
		"ow": 2.3,
	}
	for i in 8:
		scarf.append(Vector2.ZERO)
		scarf_prev.append(Vector2.ZERO)
	_solve()


func place(p: Vector2, face: float) -> void:
	pos = p
	facing = face
	vel = Vector2.ZERO
	kvel = Vector2.ZERO
	position = pos
	_solve()
	var anchor: Vector2 = pos + root + joints[Rig.J_HEAD]
	for i in scarf.size():
		scarf[i] = anchor + Vector2(-facing * i * 5.0, i * 2.0)
		scarf_prev[i] = scarf[i]


# ------------------------------------------------------------------ helpers
func is_ground_state() -> bool:
	return state in GROUND_STATES or (state == S.ATTACK and grounded)


func alive() -> bool:
	return state != S.DEAD and state != S.OUT


func can_be_hit() -> bool:
	return alive() and intangible <= 0 and invincible <= 0 and state != S.RESPAWN


func core_world() -> Vector2:
	return pos + root + joints[Rig.J_CORE]


func joint_world(j: int) -> Vector2:
	return pos + root + joints[j]


func shield_radius() -> float:
	return 44.0 * scale_k * (0.4 + 0.6 * shield_hp / SHIELD_MAX)


func move_name() -> String:
	return mv.get("id", "") if state == S.ATTACK else ""


func _set_state(s: int) -> void:
	state = s
	sframe = 0
	if s != S.ATTACK:
		counter_on = false
		armor = false
		no_grav = false
		charging = false


func _sfx(n: String, vol := 0.0) -> void:
	Sfx.play(n, vol)


# ------------------------------------------------------------------ main tick
func tick(i: Dictionary) -> void:
	inp = i
	t += 1
	for k in buf:
		if buf[k] > 0:
			buf[k] -= 1
	if i.get("atk", false): buf.atk = 6
	if i.get("spc", false): buf.spc = 6
	if i.get("jmp", false): buf.jmp = 6
	if i.get("shd_p", false): buf.shd = 8

	flash = maxf(0.0, flash - 0.12)
	squash *= 0.8
	if hitlag > 0:
		hitlag -= 1
		if state == S.HITSTUN:
			shake = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * 3.5
		position = pos + shake
		_update_fx_only()
		queue_redraw()
		return
	shake = Vector2.ZERO

	if intangible > 0: intangible -= 1
	if invincible > 0: invincible -= 1
	if parry_t > 0: parry_t -= 1
	if intro_t > 0:
		intro_t -= 1
		if intro_t == 1:
			squash = 1.0
			arena.fx.ring(pos + Vector2(0, -4), data.accent, 70.0, 0.5, 6.0)
			arena.fx.dust(pos, 0, 1.6)
			_sfx("land_heavy", -6)
	if state != S.HITSTUN and state != S.GRABBED:
		combo = 0
	if ledge_cd > 0: ledge_cd -= 1
	if drop_timer > 0: drop_timer -= 1
	if last_hitter_t > 0:
		last_hitter_t -= 1
		if last_hitter_t == 0:
			last_hitter = -1
	if state != S.SHIELD:
		shield_hp = minf(SHIELD_MAX, shield_hp + 0.11)
	sframe += 1

	match state:
		S.IDLE, S.RUN, S.CROUCH:
			_ground_control()
		S.SQUAT:
			_st_squat()
		S.AIR:
			_air_control(true)
		S.HELPLESS:
			_air_control(false)
		S.LAND:
			vel.x = move_toward(vel.x, 0, 1.0)
			if sframe >= land_lag:
				_set_state(S.IDLE)
				_ground_control()
		S.ATTACK:
			_st_attack()
		S.HITSTUN:
			_st_hitstun()
		S.SHIELD:
			_st_shield()
		S.ROLL:
			_st_roll()
		S.SPOT:
			vel.x = move_toward(vel.x, 0, 1.5)
			if sframe >= int(22 * data.spd):
				_set_state(S.IDLE)
		S.AIRDODGE:
			_st_airdodge()
		S.LEDGE:
			_st_ledge()
		S.CLIMB:
			_st_climb()
		S.KNOCKDOWN:
			vel.x = move_toward(vel.x, 0, 0.8)
			if sframe > 8 and buf.atk > 0:
				buf.atk = 0
				intangible = 10
				_begin("getup_atk")
			elif sframe >= 28 or (sframe > 8 and (absf(inp.x) > 0.5 or buf.jmp > 0)):
				_set_state(S.GETUP)
				intangible = 14
		S.GETUP:
			if sframe >= 14:
				_set_state(S.IDLE)
		S.DIZZY:
			vel.x = move_toward(vel.x, 0, 0.8)
			dizzy_t -= 1
			if dizzy_t <= 0:
				_set_state(S.IDLE)
				shield_hp = SHIELD_MAX * 0.4
		S.DEAD:
			_st_dead()
		S.RESPAWN:
			_st_respawn()
		S.OUT:
			pass
		S.GRABBING:
			_st_grabbing()
		S.GRABBED:
			_st_grabbed()

	if state != S.DEAD and state != S.OUT and state != S.LEDGE and state != S.CLIMB and state != S.RESPAWN and state != S.GRABBED:
		_physics()
	_animate()
	position = pos + shake
	queue_redraw()


# ------------------------------------------------------------------ ground
func _ground_control() -> void:
	var x: float = inp.x
	var y: float = inp.y
	# actions first
	if _try_ground_actions():
		return
	if state == S.CROUCH:
		vel.x = move_toward(vel.x, 0, 1.2)
		if y < 0.45:
			_set_state(S.IDLE)
		elif inp.get("down", false) and arena.stage.is_soft(plat):
			_drop_through()
		return
	if y > 0.65 and absf(x) < 0.55:
		if inp.get("down", false) and arena.stage.is_soft(plat):
			_drop_through()
			return
		_set_state(S.CROUCH)
		return
	if absf(x) > 0.22:
		var d := signf(x)
		if d != facing:
			facing = d
			if state == S.RUN and absf(vel.x) > 4.0:
				arena.fx.dust(pos + Vector2(-d * 6, 0), d, 1.0)
				vel.x *= 0.35
		if state != S.RUN:
			_set_state(S.RUN)
			if absf(vel.x) < 2.0:
				arena.fx.dust(pos + Vector2(-d * 8, 0), -d, 0.7)
		var target: float = x * data.run
		vel.x = move_toward(vel.x, target, 1.4 if signf(vel.x) == d else 2.2)
		if t % 16 == 0 and absf(vel.x) > data.run * 0.7:
			arena.fx.dust(pos + Vector2(-d * 10, 0), -d, 0.45)
	else:
		vel.x = move_toward(vel.x, 0, 1.1)
		if state == S.RUN and absf(vel.x) < 2.0:
			_set_state(S.IDLE)


func _try_ground_actions() -> bool:
	if buf.spc > 0 and fs_ready:
		buf.spc = 0
		_begin("final")
		return true
	if buf.atk > 0 and not held_item.is_empty():
		buf.atk = 0
		_begin("item_throw")
		return true
	if buf.atk > 0 and inp.get("shd", false):
		buf.atk = 0
		_begin("grab")
		return true
	if buf.atk > 0 and arena.items.try_pickup(self):
		buf.atk = 0
		return true
	if buf.jmp > 0:
		buf.jmp = 0
		_set_state(S.SQUAT)
		return true
	if inp.get("shd", false) and state != S.SQUAT:
		_set_state(S.SHIELD)
		_sfx("shield_up", -10)
		return true
	if buf.spc > 0:
		buf.spc = 0
		_start_special()
		return true
	if buf.atk > 0:
		buf.atk = 0
		_start_ground_attack()
		return true
	return false


func _drop_through() -> void:
	grounded = false
	plat = -1
	drop_timer = 14
	pos.y += 3.0
	vel.y = 2.0
	jumps_left = data.jumps - 1
	_set_state(S.AIR)


func _st_squat() -> void:
	vel.x = move_toward(vel.x, 0, 0.6)
	if sframe >= 3:
		var full: bool = inp.get("jmp_h", true)
		vel.y = -data.jump * (1.0 if full else 0.7)
		vel.x = clampf(vel.x * 0.85 + inp.x * 2.0, -data.air * 1.1, data.air * 1.1)
		grounded = false
		plat = -1
		jumps_left = data.jumps - 1
		_set_state(S.AIR)
		arena.fx.dust(pos, 0, 1.0)
		squash = -0.8
		_sfx("jump", -6)


# ------------------------------------------------------------------ air
func _air_control(actions: bool) -> void:
	var x: float = inp.x
	if flip_t > 0:
		flip_t -= 1
	if actions:
		if buf.jmp > 0 and jumps_left > 0:
			buf.jmp = 0
			_double_jump()
			return
		if buf.spc > 0 and fs_ready:
			buf.spc = 0
			_begin("final")
			return
		if buf.spc > 0:
			buf.spc = 0
			_start_special()
			return
		if buf.atk > 0 and not held_item.is_empty():
			buf.atk = 0
			_begin("item_throw")
			return
		if buf.atk > 0:
			buf.atk = 0
			_start_air_attack()
			return
		if buf.shd > 0 and airdodge_ok:
			buf.shd = 0
			_start_airdodge()
			return
	_air_drift(x)
	_fastfall_check()
	_try_ledge()


func _air_drift(x: float) -> void:
	if absf(x) > 0.15:
		vel.x = move_toward(vel.x, x * data.air, data.air_acc)
	else:
		vel.x = move_toward(vel.x, 0, 0.14)


func _fastfall_check() -> void:
	if not fastfall and vel.y > -3.0 and inp.get("down", false):
		fastfall = true
		vel.y = maxf(vel.y, data.fall * 1.5)
		arena.fx.spark_small(core_world(), Color(1, 1, 1, 0.6))


func _double_jump() -> void:
	jumps_left -= 1
	vel.y = -data.djump
	vel.x = inp.x * data.air * 0.95
	fastfall = false
	flip_t = 22
	squash = -0.5
	flip_dir = 1.0 if inp.x * facing >= -0.2 else -1.0
	arena.fx.ring(pos + Vector2(0, -6), data.accent, 26.0, 0.45)
	_sfx("djump", -6)


func _start_airdodge() -> void:
	airdodge_ok = false
	_set_state(S.AIRDODGE)
	intangible = 20
	var d := Vector2(inp.x, inp.y)
	if d.length() > 0.4:
		vel = d.normalized() * 13.0
		no_grav = true
	_sfx("dodge", -8)


func _st_airdodge() -> void:
	if sframe < 10 and no_grav:
		vel *= 0.86
	elif sframe == 10:
		no_grav = false
	if sframe >= 30:
		_set_state(S.AIR)
		return
	if not no_grav:
		_air_drift(inp.x * 0.5)
	_try_ledge()


func _try_ledge() -> void:
	if ledge_cd > 0 or (vel.y + kvel.y) < -7.0:
		return
	var best := -1
	for li in arena.stage.ledges.size():
		var l: Dictionary = arena.stage.ledges[li]
		if arena.ledge_owner.get(li, null) != null:
			continue
		var c: Vector2 = l.pos
		var side: float = l.side
		var dx := (pos.x - c.x) * side
		var dy := pos.y - c.y
		if dx > -6.0 and dx < 44.0 and dy > 25.0 and dy < 120.0 * scale_k:
			best = li
			break
	if best >= 0:
		_grab_ledge(best)


func _grab_ledge(li: int) -> void:
	var l: Dictionary = arena.stage.ledges[li]
	ledge_id = li
	arena.ledge_owner[li] = self
	_set_state(S.LEDGE)
	facing = -l.side
	vel = Vector2.ZERO
	kvel = Vector2.ZERO
	fastfall = false
	jumps_left = data.jumps - 1
	airdodge_ok = true
	air_once.clear()
	pos = l.pos + Vector2(l.side * 12.0 * scale_k, 104.0 * scale_k)
	if ledge_regrabs < 1:
		intangible = 40
	ledge_regrabs += 1
	_sfx("ledge", -6)


func _release_ledge() -> void:
	if ledge_id >= 0:
		arena.ledge_owner.erase(ledge_id)
	ledge_id = -1
	ledge_cd = 30


func _st_ledge() -> void:
	var l: Dictionary = arena.stage.ledges[ledge_id]
	var toward: float = -l.side
	if sframe > 6:
		if buf.jmp > 0 or inp.y < -0.6:
			buf.jmp = 0
			_release_ledge()
			vel = Vector2(toward * 3.0, -data.jump * 1.05)
			pos.y -= 30.0
			jumps_left = data.jumps - 1
			_set_state(S.AIR)
			_sfx("jump", -6)
			return
		if inp.x * toward > 0.6 or buf.atk > 0:
			climb_attack = buf.atk > 0
			buf.atk = 0
			_set_state(S.CLIMB)
			intangible = maxi(intangible, 22)
			return
		if inp.y > 0.6 or inp.x * toward < -0.6:
			_release_ledge()
			_set_state(S.AIR)
			vel = Vector2(-toward * 1.5, 1.0)
			return
	if sframe > 300:
		_release_ledge()
		_set_state(S.AIR)


func _st_climb() -> void:
	var l: Dictionary = arena.stage.ledges[ledge_id]
	var u := clampf(sframe / 20.0, 0.0, 1.0)
	var from: Vector2 = l.pos + Vector2(l.side * 12.0 * scale_k, 104.0 * scale_k)
	var to: Vector2 = l.pos + Vector2(-l.side * 34.0, 0)
	pos = Vector2(lerpf(from.x, to.x, u * u), lerpf(from.y, to.y, sqrt(u)))
	if sframe >= 20:
		_release_ledge()
		pos = to
		grounded = true
		plat = l.plat
		vel = Vector2.ZERO
		_set_state(S.IDLE)
		if climb_attack:
			climb_attack = false
			_begin("ledge_atk")


# ------------------------------------------------------------------ attacks
func _start_ground_attack() -> void:
	var x: float = inp.x
	var y: float = inp.y
	var smash: bool = inp.get("smash", false)
	var name := "jab1"
	if state == S.RUN and absf(vel.x) > data.run * 0.55 and not smash:
		name = "dash"
	elif smash and Vector2(x, y).length() > 0.45:
		if y < -0.5 and absf(y) > absf(x):
			name = "usmash"
		elif y > 0.5 and absf(y) > absf(x):
			name = "dsmash"
		else:
			name = "fsmash"
			facing = signf(x) if absf(x) > 0.1 else facing
	elif y < -0.5 and absf(y) > absf(x) * 0.8:
		name = "utilt"
	elif y > 0.5 and absf(y) > absf(x) * 0.8:
		name = "dtilt"
	elif absf(x) > 0.3:
		name = "ftilt"
		facing = signf(x)
	_begin(name)


func _start_air_attack() -> void:
	var x: float = inp.x
	var y: float = inp.y
	var name := "nair"
	if y < -0.5 and absf(y) > absf(x) * 0.8:
		name = "uair"
	elif y > 0.5 and absf(y) > absf(x) * 0.8:
		name = "dair"
	elif absf(x) > 0.3:
		name = "fair" if signf(x) == facing else "bair"
	_begin(name)


func _start_special() -> void:
	var x: float = inp.x
	var y: float = inp.y
	var key := "nb"
	if y < -0.5 and absf(y) > absf(x) * 0.7:
		key = "ub"
	elif y > 0.5 and absf(y) > absf(x) * 0.7:
		key = "db"
	elif absf(x) > 0.35:
		key = "sb"
		facing = signf(x)
	var name: String = data.specials[key]
	var m := Roster.move(name)
	var once: String = m.get("air_once", "")
	if once != "" and not grounded:
		if air_once.get(once, false):
			# already used this airtime: fall back to a neutral special
			name = data.specials.nb
			m = Roster.move(name)
		else:
			air_once[once] = true
	if name == "bruno_db" and not grounded:
		name = "bruno_plunge"
	_begin(name)


func _begin(name: String) -> void:
	mv = Roster.move(name)
	_set_state(S.ATTACK)
	mf = 0.0
	mf_prev = -1.0
	charge_ct = 0
	charging = false
	move_inst += 1
	hit_landed = false
	hit_log.clear()
	trail.clear()
	if mv.get("logic", "") == "dive" and grounded:
		vel.y = -10.0
		grounded = false
		plat = -1
	if mv.get("logic", "") == "vanish":
		pass


func _crossed(f: float) -> bool:
	return mf_prev < f and mf >= f


func _st_attack() -> void:
	var spd: float = data.spd
	mf_prev = mf
	var cf: float = mv.get("charge", -1)
	var held := false
	if cf >= 0 and mf >= cf and charge_ct < int(mv.get("charge_max", 60)):
		var btn: String = mv.get("charge_btn", "atk")
		held = inp.get(btn + "_h", false)
		if charge_ct == 0 and mf_prev < cf:
			held = held  # first frame at the charge point
		if held:
			charging = true
			charge_ct += 1
			mf = cf
			if charge_ct % 6 == 0:
				arena.fx.spark_small(joint_world(Rig.J_HF), data.accent)
			if charge_ct == 1:
				_sfx("charge", -10)
		else:
			charging = false
	if not held:
		charging = false
		mf += 1.0 / spd

	# sounds
	for s in mv.get("sfx", []):
		if _crossed(float(s[0])):
			_sfx(s[1], -4)
	# impulses
	for p in mv.get("push", []):
		if _crossed(float(p[0])):
			vel.x += facing * p[1]
	# projectiles
	var sp: Array = mv.get("spawn", [])
	if sp.size() > 0 and _crossed(float(sp[0])):
		arena.spawn_projectile(sp[1], self, charge_ct / 60.0)
	# trails
	var tr: Array = mv.get("trail", [])
	if tr.size() > 0 and mf >= tr[0] and mf <= tr[1]:
		_push_trail(tr[2])

	_special_logic()
	if state != S.ATTACK:
		return

	# jab chaining
	var nx: String = mv.get("next", "")
	if nx != "" and buf.atk > 0 and grounded and mf >= mv.next_win[0] and Vector2(inp.x, inp.y).length() < 0.5:
		buf.atk = 0
		_begin(nx)
		return

	# movement during the move
	if grounded:
		if not mv.has("logic"):
			vel.x = move_toward(vel.x, 0, 0.35 if mv.get("slide", false) else 0.9)
	elif not no_grav and mv.get("logic", "") not in ["plunge", "dive", "jet"]:
		_air_drift(inp.x * 0.8)
		_fastfall_check()

	if mf >= float(mv.len):
		_end_move()


func _end_move() -> void:
	var helpless: bool = mv.get("helpless", false)
	var was: String = mv.get("id", "")
	mv = {}
	no_grav = false
	if was == "pummel" and grab_victim != null and is_instance_valid(grab_victim) and grab_victim.state == S.GRABBED:
		state = S.GRABBING
		sframe = 5
		return
	if was == "final":
		intangible = 30
	if grounded:
		_set_state(S.CROUCH if inp.y > 0.65 else S.IDLE)
	elif helpless:
		_set_state(S.HELPLESS)
	else:
		_set_state(S.AIR)


func _special_logic() -> void:
	var lg: String = mv.get("logic", "")
	if lg == "":
		return
	var f := mf
	match lg:
		"pummel":
			_hold_victim()
			if _crossed(4) and grab_victim != null:
				grab_victim.damage += 1.6 * data.dmg
				grab_victim.flash = 0.8
				st_dealt += 1.6 * data.dmg
				arena.fx.spark_small(grab_victim.core_world(), data.accent)
				_sfx("hit_l", -6)
		"throw":
			var th: Dictionary = mv.throw
			vel.x = move_toward(vel.x, 0, 1.0)
			if grab_victim == null or not is_instance_valid(grab_victim):
				return
			if f < th.at:
				_hold_victim()
			elif _crossed(th.at):
				var v := grab_victim
				grab_victim = null
				v.grab_holder = null
				arena.throw_hit(self, v, th, facing * th.dir)
		"item_throw":
			if _crossed(7):
				arena.items.throw_item(self, Vector2(inp.x, inp.y))
		"final":
			_final_logic(f)
		"flash_step":
			if f >= 8 and f < 18:
				vel = Vector2(facing * 24.0, 0)
				no_grav = true
				if t % 2 == 0:
					_ghost()
			elif _crossed(18):
				vel.x = facing * 5.0
				no_grav = false
			else:
				no_grav = false
				if grounded:
					vel.x = move_toward(vel.x, 0, 0.8)
		"rise":
			if _crossed(4):
				vel.y = -18.5
				vel.x = inp.x * 4.0
				grounded = false
				plat = -1
				arena.fx.ring(pos, data.accent, 34.0, 0.5)
			if f > 4 and f < 24:
				vel.x = move_toward(vel.x, inp.x * 4.0, 0.3)
		"counter":
			counter_on = f >= 3 and f <= 27
			if grounded:
				vel.x = move_toward(vel.x, 0, 1.0)
		"haymaker":
			if _crossed(13):
				vel.x += facing * (4.0 + 8.0 * charge_ct / 60.0)
			if grounded:
				vel.x = move_toward(vel.x, 0, 0.6)
		"rush":
			if f >= 6 and f < 30:
				armor = true
				if hit_landed:
					vel.x = move_toward(vel.x, 0, 2.0)
				else:
					vel.x = facing * 14.0
				if not grounded:
					vel.y = minf(vel.y, 2.0)
				if t % 4 == 0 and grounded:
					arena.fx.dust(pos + Vector2(-facing * 10, 0), -facing, 0.6)
			else:
				armor = false
				vel.x = move_toward(vel.x, 0, 1.0)
		"uppercut":
			if _crossed(6):
				vel.y = -19.5
				vel.x = facing * 2.5 + inp.x * 2.0
				grounded = false
				plat = -1
				arena.fx.dust(pos, 0, 1.2)
			if f > 6:
				vel.x = move_toward(vel.x, inp.x * 3.0, 0.2)
		"quake":
			vel.x = move_toward(vel.x, 0, 1.2)
			if _crossed(15) and grounded:
				arena.spawn_projectile("shockwave", self, 0.0)
				arena.camera_shake(10.0)
				arena.fx.dust(pos + Vector2(26, 0), 1, 1.6)
				arena.fx.dust(pos + Vector2(-26, 0), -1, 1.6)
		"plunge":
			if f >= 8:
				vel = Vector2(inp.x * 2.0, 21.0)
				no_grav = true
			else:
				vel *= 0.8
				no_grav = true
		"shadow":
			if f >= 6 and f < 14:
				vel = Vector2(facing * 30.0, 0)
				no_grav = true
				intangible = maxi(intangible, 2)
				_ghost()
			elif f >= 14:
				no_grav = false
				vel.x = move_toward(vel.x, 0, 2.5)
		"vanish":
			if f < 10:
				vel *= 0.7
				no_grav = true
				if f >= 4:
					intangible = maxi(intangible, 2)
			if _crossed(10):
				var d := Vector2(inp.x, inp.y)
				if d.length() < 0.3:
					d = Vector2(0, -1)
				d = d.normalized()
				arena.fx.smoke(core_world(), data.accent)
				_teleport(d * 235.0)
				arena.fx.smoke(core_world(), data.accent)
				vel = d * 3.0
				no_grav = false
				grounded = false
				plat = -1
				_sfx("vanish", -4)
		"dive":
			if f >= 6:
				if hit_landed:
					vel = Vector2(-facing * 3.0, -11.0)
					no_grav = false
					_end_move()
					return
				vel = Vector2(facing * 14.0, 15.0)
				no_grav = true
				_try_ledge()
		"lance":
			if f >= 9 and f <= 20:
				vel.x = facing * 10.0
				if not grounded:
					vel.y = 0
					no_grav = true
				if t % 3 == 0:
					arena.fx.spark_small(joint_world(Rig.J_WT), data.accent)
			else:
				no_grav = false
				vel.x = move_toward(vel.x, 0, 1.0)
		"jet":
			if f >= 5 and f < 45:
				var target := Vector2(inp.x * 8.0, -9.5 + maxf(inp.y, 0.0) * 6.0)
				vel = vel.lerp(target, 0.2)
				no_grav = true
				grounded = false
				plat = -1
				if t % 2 == 0:
					arena.fx.jet(joint_world(Rig.J_FF), data.accent)
				_try_ledge()
			else:
				no_grav = false
		"static":
			if grounded:
				vel.x = move_toward(vel.x, 0, 1.0)
			if _crossed(9):
				arena.fx.ring(core_world(), data.accent, 80.0, 0.35, 6.0)
				arena.fx.ring(core_world(), Color(1, 1, 1), 60.0, 0.25, 3.0)
			if f >= 9 and f <= 13:
				arena.destroy_projectiles_near(core_world(), 95.0, self)


# ------------------------------------------------------------------ grabs
func start_grab(v: Fighter) -> void:
	grab_victim = v
	v.grab_holder = self
	mv = {}
	_set_state(S.GRABBING)
	grab_t = int(80 + v.damage * 0.8)
	vel = Vector2.ZERO
	if v.ledge_id >= 0:
		v._release_ledge()
	if not v.held_item.is_empty():
		arena.items.drop(v)
	v.mv = {}
	v._set_state(S.GRABBED)
	v.vel = Vector2.ZERO
	v.kvel = Vector2.ZERO
	v.facing = -facing
	_hold_victim()
	_sfx("grab", -2)


func _hold_victim() -> void:
	var v := grab_victim
	if v == null or not is_instance_valid(v):
		return
	v.pos = joint_world(Rig.J_HF) - (v.root + v.joints[Rig.J_CORE]) + Vector2(facing * 6.0, 0)
	if v.grounded or grounded:
		v.pos.y = minf(v.pos.y, pos.y)
	v.position = v.pos


func release_grab(_push := true) -> void:
	var v := grab_victim
	grab_victim = null
	if v != null and is_instance_valid(v) and v.state == S.GRABBED:
		v.grab_holder = null
		v._set_state(S.IDLE if v.grounded else S.AIR)
		v.vel.x = facing * 7.0
		v.intangible = 10
	if state == S.GRABBING:
		_set_state(S.IDLE if grounded else S.AIR)
		vel.x = -facing * 5.0


func _st_grabbing() -> void:
	vel.x = move_toward(vel.x, 0, 1.0)
	var v := grab_victim
	if v == null or not is_instance_valid(v) or v.state != S.GRABBED:
		grab_victim = null
		_set_state(S.IDLE if grounded else S.AIR)
		return
	_hold_victim()
	grab_t -= 1
	if grab_t <= 0:
		release_grab()
		_sfx("dodge", -6)
		return
	if sframe < 6:
		return
	if absf(inp.x) > 0.6 or absf(inp.y) > 0.6:
		var name := ""
		if absf(inp.y) > absf(inp.x):
			name = "throw_u" if inp.y < 0.0 else "throw_d"
		else:
			name = "throw_f" if signf(inp.x) == facing else "throw_b"
		_begin(name)
	elif buf.atk > 0:
		buf.atk = 0
		_begin("pummel")


func _st_grabbed() -> void:
	var h := grab_holder
	if h == null or not is_instance_valid(h) or h.grab_victim != self:
		grab_holder = null
		_set_state(S.IDLE if grounded else S.AIR)
		return
	if buf.atk > 0 or buf.spc > 0 or buf.jmp > 0 or inp.get("flick_x", false):
		buf.atk = 0
		buf.spc = 0
		buf.jmp = 0
		h.grab_t -= 6
		shake = Vector2(randf_range(-2, 2), 0)


# ------------------------------------------------------------------ final smash
func _final_logic(f: float) -> void:
	intangible = maxi(intangible, 2)
	if _crossed(1):
		fs_ready = false
		fs_victims.clear()
		arena.start_final(self)
	if f < 64:
		vel *= 0.8
		no_grav = true
		if t % 3 == 0:
			arena.fx.spark_small(core_world() + Vector2(randf_range(-30, 30), randf_range(-40, 30)), data.accent)
		return
	var r: Rect2 = arena.stage.main_rect()
	match data.id:
		"kai":
			no_grav = true
			if f < 78:
				vel = Vector2(facing * 36.0, 0)
				_ghost()
				arena.final_catch(self, Rect2(pos.x - 90, pos.y - 230, 180, 290))
				if pos.x < r.position.x - 60.0 or pos.x > r.end.x + 60.0:
					pos.x = clampf(pos.x, r.position.x - 60.0, r.end.x + 60.0)
			else:
				vel = Vector2.ZERO
		"bruno":
			if _crossed(64):
				vel = Vector2(facing * 4.0, -21.0)
				grounded = false
				plat = -1
			no_grav = f >= 82 and has_meta("fs_slam")
			if not has_meta("fs_slam"):
				if f > 70 and vel.y > -4.0:
					vel = Vector2(0, 30.0)
				if (grounded and f > 70) or f >= 110:
					set_meta("fs_slam", true)
					arena.final_catch(self, Rect2(pos.x - 480, pos.y - 320, 960, 380))
					arena.fx.explosion(pos + Vector2(0, -10))
					arena.fx.ring(pos, data.accent, 500.0, 0.6, 12.0)
					arena.camera_shake(26.0)
					_sfx("slam", 0)
		"nyx":
			no_grav = true
			if _crossed(64):
				arena.final_catch(self, Rect2(pos.x - 1100, pos.y - 900, 2200, 1400))
				arena.fx.smoke(core_world(), data.accent)
		"sol":
			no_grav = true
			vel = Vector2.ZERO
			if f < 120:
				var x0 := pos.x
				var x1 := pos.x + facing * 1600.0
				arena.final_catch(self, Rect2(minf(x0, x1), pos.y - 230, absf(x1 - x0), 300))
				if int(f) % 6 == 0:
					arena.fx.beam(joint_world(Rig.J_WT), Vector2(facing, 0), data.accent)
	# phase B: rapid hits on everyone caught
	if f >= 76 and f < 140 and int(f) % 6 == 0:
		for v in fs_victims:
			arena.final_tick(self, v)
	if _crossed(140):
		arena.final_launch(self)
		if has_meta("fs_slam"):
			remove_meta("fs_slam")


func _teleport(offset: Vector2) -> void:
	# step toward the target so we never end up inside a solid platform
	var steps := 24
	var step := offset / steps
	for i in steps:
		var np := pos + step
		if arena.stage.box_hits_solid(Rect2(np.x - hw, np.y - hh, hw * 2, hh)):
			break
		pos = np


func _ghost() -> void:
	ghosts.append({"j": joints.duplicate(), "o": pos + root, "a": 0.6, "f": facing})


func _push_trail(jname: String) -> void:
	var outer_j: int = Rig.JOINT_NAMES.get(jname, Rig.J_HF)
	var inner_j := Rig.J_EF
	if jname == "hf":
		if data.weapon in ["sword", "staff", "knives"]:
			outer_j = Rig.J_WT
			inner_j = Rig.J_HF
	elif jname == "wt":
		inner_j = Rig.J_HF
	elif jname == "hb":
		inner_j = Rig.J_EB
	elif jname == "ff":
		inner_j = Rig.J_KF
	elif jname == "fb":
		inner_j = Rig.J_KB
	elif jname == "core":
		return
	var o := joint_world(outer_j)
	var inn := joint_world(inner_j)
	trail.append({"o": o, "i": inn.lerp(o, 0.35), "a": 1.0})
	if trail.size() > 9:
		trail.pop_front()


## Active hitboxes this frame as [{c, r, hit}].
func active_hitboxes() -> Array:
	var out: Array = []
	if state != S.ATTACK or mv.is_empty():
		return out
	for h in mv.hits:
		var fr: Array = h.f
		if mf < fr[0] or mf > fr[1]:
			continue
		var jn: String = h.j
		var r: float = h.r * data.reach if data.weapon == "fists" else h.r
		if jn == "hf" and data.weapon in ["sword", "staff"]:
			out.append({"c": joint_world(Rig.J_WM), "r": r * 0.9, "hit": h})
			out.append({"c": joint_world(Rig.J_WT), "r": r * 0.95, "hit": h})
			out.append({"c": joint_world(Rig.J_HF), "r": r * 0.7, "hit": h})
		elif jn == "hf" and data.weapon == "knives":
			out.append({"c": joint_world(Rig.J_WT), "r": r, "hit": h})
			out.append({"c": joint_world(Rig.J_HF), "r": r * 0.8, "hit": h})
		elif jn == "hb" and data.weapon == "knives":
			out.append({"c": joint_world(Rig.J_WB), "r": r, "hit": h})
		else:
			out.append({"c": joint_world(Rig.JOINT_NAMES.get(jn, Rig.J_CORE)), "r": r * scale_k, "hit": h})
	return out


static func _seg_dist(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var l2 := ab.length_squared()
	if l2 < 0.001:
		return p.distance_to(a)
	var u := clampf((p - a).dot(ab) / l2, 0.0, 1.0)
	return p.distance_to(a + ab * u)


func hurt_test(c: Vector2, r: float) -> bool:
	var o := pos + root
	var w: float = data.w
	if c.distance_to(o + joints[Rig.J_HEAD]) < r + dims.head + 3.0:
		return true
	if _seg_dist(c, o + joints[Rig.J_HIP], o + joints[Rig.J_NECK]) < r + w + 6.0:
		return true
	if _seg_dist(c, o + joints[Rig.J_HIP], o + joints[Rig.J_KF]) < r + w * 0.6 + 4.0:
		return true
	if _seg_dist(c, o + joints[Rig.J_KF], o + joints[Rig.J_FF]) < r + w * 0.6 + 3.0:
		return true
	if _seg_dist(c, o + joints[Rig.J_HIP], o + joints[Rig.J_KB]) < r + w * 0.6 + 4.0:
		return true
	if _seg_dist(c, o + joints[Rig.J_KB], o + joints[Rig.J_FB]) < r + w * 0.6 + 3.0:
		return true
	if _seg_dist(c, o + joints[Rig.J_SH], o + joints[Rig.J_HF]) < r + w * 0.6 + 2.0:
		return true
	return false


# ------------------------------------------------------------------ getting hit
## Called by the arena. Returns "hit", "shield", "counter", "armor".
func take_hit(att: Fighter, dmg: float, kb: float, angle_deg: float, dir_x: float, lag: int) -> String:
	if state == S.ATTACK and counter_on and att != null:
		return "counter"
	if parry_t > 0 and att != null and att != self:
		parry_t = 0
		flash = 0.8
		return "parry"
	if state == S.HITSTUN or state == S.GRABBED:
		combo += 1
	else:
		combo = 1
	if state == S.GRABBING or move_name().begins_with("throw"):
		release_grab()
	if not held_item.is_empty() and state != S.SHIELD:
		arena.items.drop(self)
	if state == S.SHIELD:
		shield_hp -= dmg * 1.15
		hitlag = lag
		shieldstun = int(dmg * 0.7) + 3
		vel.x = dir_x * minf(9.0, 2.0 + dmg * 0.45)
		flash = 0.3
		if shield_hp <= 0.0:
			_shield_break()
		return "shield"
	damage = minf(999.0, damage + dmg)
	flash = 1.0
	if att != null:
		last_hitter = att.port
		last_hitter_t = 600
	if armor and kb < 26.0:
		hitlag = lag
		return "armor"
	if state == S.LEDGE or state == S.CLIMB:
		_release_ledge()
	if state == S.GRABBED:
		grab_holder = null
	hitlag = lag
	var a := deg_to_rad(angle_deg)
	if grounded and angle_deg < 0.0:
		a = -a * 0.6
	kvel = Vector2(cos(a) * dir_x, -sin(a)) * kb
	vel = Vector2.ZERO
	hitstun = int(kb * 1.15) + 2
	tumble = kb > 14.0
	spin_rot = 0.0
	if dir_x != 0:
		facing = -dir_x
	if kvel.y < -1.0 or kb > 9.0:
		grounded = false
		plat = -1
	fastfall = false
	if mv.size() > 0 and state == S.ATTACK:
		mv = {}
	_set_state(S.HITSTUN)
	airdodge_ok = true
	return "hit"


func _shield_break() -> void:
	shield_hp = 0.0
	_set_state(S.DIZZY)
	dizzy_t = 170
	vel = Vector2(0, -12)
	grounded = false
	plat = -1
	arena.fx.shield_break(core_world(), data.accent)
	_sfx("shield_break", 0)
	arena.camera_shake(8.0)


func _st_hitstun() -> void:
	hitstun -= 1
	if hitstun <= 0:
		if grounded:
			_set_state(S.IDLE)
		else:
			_set_state(S.AIR)
		return
	if tumble:
		spin_rot += clampf(kvel.length() * 0.025, 0.04, 0.45) * signf(kvel.x * facing + 0.01) * -1.0
	vel.x = move_toward(vel.x, inp.x * 2.5, 0.12)
	if kvel.length() > 14.0 and t % 2 == 0:
		arena.fx.launch_smoke(core_world(), kvel.length())
	_try_ledge_in_hitstun()


func _try_ledge_in_hitstun() -> void:
	if hitstun < 8 and kvel.length() < 6.0:
		_try_ledge()


func _st_shield() -> void:
	vel.x = move_toward(vel.x, 0, 1.0)
	if shieldstun > 0:
		shieldstun -= 1
		return
	shield_hp -= 0.16
	if shield_hp <= 0.0:
		_shield_break()
		return
	if buf.jmp > 0:
		buf.jmp = 0
		_set_state(S.SQUAT)
		return
	if buf.atk > 0:
		buf.atk = 0
		_begin("grab")
		return
	if absf(inp.x) > 0.6 and (inp.get("flick_x", false) or sframe <= 2):
		roll_dir = signf(inp.x)
		_set_state(S.ROLL)
		intangible = 0
		_sfx("dodge", -8)
		return
	if inp.y > 0.6 and (inp.get("down", false) or sframe <= 2):
		_set_state(S.SPOT)
		intangible = int(14 * data.spd)
		_sfx("dodge", -8)
		return
	if not inp.get("shd", false):
		land_lag = 5
		parry_t = 6
		_set_state(S.LAND)


func _st_roll() -> void:
	var n := int(24 * data.spd)
	var u := float(sframe) / n
	if sframe == 3:
		intangible = int(14 * data.spd)
	vel.x = roll_dir * 9.2 * sin(PI * clampf(u, 0.0, 1.0)) * 1.15
	if sframe >= n:
		facing = -roll_dir
		vel.x = 0
		_set_state(S.IDLE)


# ------------------------------------------------------------------ death & respawn
func ko() -> void:
	if state == S.DEAD or state == S.OUT:
		return
	if grab_victim != null:
		release_grab()
	if grab_holder != null and is_instance_valid(grab_holder):
		grab_holder.grab_victim = null
		grab_holder = null
	if not held_item.is_empty():
		arena.items.drop(self)
	for v in fs_victims:
		if is_instance_valid(v):
			v.hitlag = 0
			v.hitstun = 10
	fs_victims.clear()
	fs_ready = false
	if ledge_id >= 0:
		_release_ledge()
	stocks -= 1
	st_falls += 1
	var kp: Array = get_meta("ko_pcts", [])
	kp.append(int(damage))
	set_meta("ko_pcts", kp)
	_set_state(S.DEAD)
	dead_t = 0
	mv = {}
	vel = Vector2.ZERO
	kvel = Vector2.ZERO
	visible = false


func _st_dead() -> void:
	dead_t += 1
	if dead_t >= 80:
		if stocks <= 0:
			eliminated = true
			_set_state(S.OUT)
		else:
			_respawn()


func _respawn() -> void:
	visible = true
	damage = 0.0
	var sp: Vector2 = arena.stage.respawn_point(port)
	place(sp, 1.0 if sp.x < 0 else -1.0)
	_set_state(S.RESPAWN)
	respawn_plat_t = 0
	invincible = 150
	grounded = true
	plat = -1
	jumps_left = data.jumps
	airdodge_ok = true
	air_once.clear()
	ledge_regrabs = 0
	arena.fx.ring(pos + Vector2(0, -40), data.accent, 60.0, 0.6, 5.0)
	_sfx("respawn", -4)


func _st_respawn() -> void:
	respawn_plat_t += 1
	var leave: bool = absf(inp.x) > 0.3 or buf.jmp > 0 or buf.atk > 0 or buf.spc > 0 or inp.y > 0.6
	if respawn_plat_t > 200 or (respawn_plat_t > 20 and leave):
		_set_state(S.AIR)
		grounded = false
		jumps_left = data.jumps
		invincible = maxi(invincible, 60)


# ------------------------------------------------------------------ physics
func _physics() -> void:
	if state == S.HITSTUN:
		kvel = kvel.move_toward(Vector2.ZERO, 0.5)
	else:
		kvel = kvel.move_toward(Vector2.ZERO, 1.2)
	if not grounded and not no_grav:
		var g: float = data.grav
		if state == S.HITSTUN and kvel.length() > 4.0:
			g *= 0.3
		vel.y += g
		var cap: float = data.fall * (1.5 if fastfall else 1.0)
		if vel.y > cap:
			vel.y = cap
	var motion := vel + kvel
	var prev := pos
	var st: Stage = arena.stage

	# horizontal
	pos.x += motion.x
	for i in st.plats.size():
		var p: Dictionary = st.plats[i]
		if not p.solid:
			continue
		var r: Rect2 = p.rect
		if pos.y - 2.0 > r.position.y and pos.y - hh < r.end.y and pos.x + hw > r.position.x and pos.x - hw < r.end.x:
			if prev.x <= r.get_center().x:
				pos.x = r.position.x - hw - 0.01
			else:
				pos.x = r.end.x + hw + 0.01
			vel.x = 0
			if state == S.HITSTUN and absf(kvel.x) > 8.0:
				kvel.x = -kvel.x * 0.6
				arena.fx.ring(Vector2(pos.x, pos.y - hh * 0.5), Color(1, 1, 1), 30.0, 0.3)
				_sfx("bounce", -4)
			else:
				kvel.x = 0

	if grounded:
		var p: Dictionary = st.plats[plat] if plat >= 0 else {}
		if plat >= 0:
			var r: Rect2 = p.rect
			if pos.x < r.position.x - 1.0 or pos.x > r.end.x + 1.0:
				grounded = false
				plat = -1
				jumps_left = data.jumps - 1
				if state in [S.IDLE, S.RUN, S.CROUCH, S.LAND, S.SHIELD, S.SPOT, S.KNOCKDOWN, S.GETUP]:
					_set_state(S.AIR)
				elif state == S.ROLL:
					_set_state(S.AIR)
			else:
				pos.y = r.position.y
				if motion.y < -0.5:
					grounded = false
					plat = -1
		return_if_grounded()
	if grounded:
		return

	# vertical
	pos.y += motion.y
	if motion.y >= 0.0:
		var best := -1
		var best_top := INF
		for i in st.plats.size():
			var p: Dictionary = st.plats[i]
			var r: Rect2 = p.rect
			if not p.solid and (drop_timer > 0 or (state in [S.AIR, S.HELPLESS] and inp.y > 0.7 and drop_timer > -1 and inp.get("down_h", false))):
				continue
			if prev.y <= r.position.y + 0.5 and pos.y >= r.position.y and pos.x >= r.position.x - 2.0 and pos.x <= r.end.x + 2.0:
				if r.position.y < best_top:
					best_top = r.position.y
					best = i
		if best >= 0:
			pos.y = best_top
			_land(best, motion)
	else:
		for i in st.plats.size():
			var p: Dictionary = st.plats[i]
			if not p.solid:
				continue
			var r: Rect2 = p.rect
			var top_prev := prev.y - hh
			var top_now := pos.y - hh
			if top_prev >= r.end.y - 0.5 and top_now < r.end.y and pos.x + hw > r.position.x and pos.x - hw < r.end.x:
				pos.y = r.end.y + hh
				vel.y = 0
				kvel.y = absf(kvel.y) * 0.3


func return_if_grounded() -> void:
	pass


func _land(pi: int, motion: Vector2) -> void:
	if state == S.HITSTUN:
		var sp := motion.length()
		if tumble and buf.shd > 0:
			# tech
			buf.shd = 0
			grounded = true
			plat = pi
			vel = Vector2.ZERO
			kvel = Vector2.ZERO
			_set_state(S.GETUP)
			intangible = 18
			arena.fx.ring(pos, Color(1, 1, 1), 30.0, 0.3)
			_sfx("tech", -4)
			_on_ground_reset()
			return
		if tumble and sp > 7.0:
			kvel.y = -absf(kvel.y) * 0.55
			vel.y = -absf(vel.y) * 0.45 - 2.0
			pos.y -= 1.0
			arena.fx.dust(pos, 0, 1.4)
			arena.camera_shake(4.0)
			_sfx("bounce", -4)
			return
		grounded = true
		plat = pi
		vel.y = 0
		kvel.y = 0
		_on_ground_reset()
		if tumble:
			_set_state(S.KNOCKDOWN)
			arena.fx.dust(pos, 0, 1.2)
			_sfx("land_heavy", -6)
		return
	grounded = true
	plat = pi
	vel.y = 0
	kvel.y = 0
	_on_ground_reset()
	arena.fx.dust(pos, 0, 0.6 + minf(motion.y / 15.0, 1.0) * 0.6)
	squash = clampf(motion.y / 14.0, 0.25, 1.0)
	match state:
		S.ATTACK:
			var lg: String = mv.get("logic", "")
			if lg == "plunge":
				arena.spawn_projectile("shockwave", self, 0.0)
				arena.camera_shake(12.0)
				arena.fx.dust(pos + Vector2(26, 0), 1, 1.8)
				arena.fx.dust(pos + Vector2(-26, 0), -1, 1.8)
				_sfx("slam", 0)
				mv = {}
				land_lag = 18
				_set_state(S.LAND)
			elif mv.get("air", false):
				land_lag = int(mv.get("land", 6) * data.spd)
				mv = {}
				_set_state(S.LAND)
				_sfx("land", -10)
			elif mv.get("helpless", false) or lg in ["dive", "jet", "vanish"]:
				mv = {}
				land_lag = 12
				_set_state(S.LAND)
				_sfx("land", -8)
			elif mv.get("special", false) and lg in ["flash_step", "rush", "lance", "shadow"]:
				pass  # keep sliding on the ground
			else:
				mv = {}
				land_lag = 6
				_set_state(S.LAND)
		S.HELPLESS:
			land_lag = 14
			_set_state(S.LAND)
			_sfx("land", -8)
		S.AIRDODGE:
			land_lag = 8
			_set_state(S.LAND)
			vel.x *= 0.5
		S.DIZZY:
			pass
		_:
			land_lag = 4
			_set_state(S.LAND)
			_sfx("land", -12)


func _on_ground_reset() -> void:
	jumps_left = data.jumps
	fastfall = false
	airdodge_ok = true
	air_once.clear()
	ledge_regrabs = 0
	no_grav = false
	flip_t = 0


# ------------------------------------------------------------------ animation
func _target_pose() -> PackedFloat32Array:
	var p: PackedFloat32Array
	match state:
		S.IDLE, S.RESPAWN:
			p = Roster.pose("guard").duplicate()
			var b := sin(t * 0.075)
			p[Rig.LEAN] += b * 0.025
			p[Rig.SF] += b * 0.05
			p[Rig.SB] += b * 0.04
			p[Rig.KF] += (b + 1.0) * 0.06
			p[Rig.KB] += (b + 1.0) * 0.06
			p[Rig.HF] += (b + 1.0) * 0.03
		S.RUN:
			var spd := absf(vel.x)
			run_ph += 0.06 + spd * 0.034
			var s := sin(run_ph)
			var c := cos(run_ph)
			var k := clampf(spd / data.run, 0.25, 1.0)
			p = Rig.P([0.22 + 0.22 * k, -0.15 * k, 0.45 - s * 1.0 * k, 1.5, 0.45 + s * 1.0 * k, 1.5,
				0.2 + s * 0.95 * k, 0.25 + maxf(0.0, c) * 1.7 * k, 0.2 - s * 0.95 * k, 0.25 + maxf(0.0, -c) * 1.7 * k,
				0, 0, 0.3])
			if data.weapon == "sword" or data.weapon == "staff":
				p[Rig.SF] = -0.5 - s * 0.25 * k
				p[Rig.EF] = 0.5
				p[Rig.WA] = 1.6 if data.weapon == "sword" else 1.3
		S.CROUCH, S.GETUP:
			p = Roster.pose("crouch").duplicate()
		S.SQUAT:
			p = Roster.pose("squat").duplicate()
		S.LAND:
			p = Roster.pose("land").duplicate()
		S.AIR, S.AIRDODGE:
			var fall_k := clampf((vel.y + 4.0) / 12.0, 0.0, 1.0)
			p = Rig.blend(Roster.pose("air_t"), Roster.pose("air_fall"), fall_k)
			p[Rig.LEAN] += clampf(vel.x * facing * 0.025, -0.2, 0.25)
			if flip_t > 0:
				var u := 1.0 - flip_t / 22.0
				p = Rig.blend(p, Roster.pose("ball"), sin(u * PI) * 0.9)
				p[Rig.ROT] = u * TAU * flip_dir
		S.HELPLESS:
			p = Roster.pose("air_fall").duplicate()
			p[Rig.SF] += sin(t * 0.5) * 0.4
			p[Rig.SB] += cos(t * 0.5) * 0.4
		S.ATTACK:
			p = Roster.sample(mv.anim, mf)
			if charging:
				p = p.duplicate()
				p[Rig.LEAN] += sin(t * 1.3) * 0.02
		S.HITSTUN:
			if tumble:
				p = Roster.pose("tumble").duplicate()
				p[Rig.ROT] = spin_rot
			else:
				p = Roster.pose("hurt").duplicate()
		S.SHIELD:
			p = Roster.pose("shield").duplicate()
		S.ROLL:
			var u := clampf(float(sframe) / (24.0 * data.spd), 0.0, 1.0)
			p = Rig.blend(Roster.pose("crouch"), Roster.pose("ball"), sin(u * PI))
			p[Rig.ROT] = u * TAU * roll_dir * facing
		S.SPOT:
			p = Roster.pose("crouch").duplicate()
			p[Rig.LEAN] = -0.3
		S.LEDGE:
			p = Roster.pose("ledge").duplicate()
			p[Rig.HF] += sin(t * 0.06) * 0.12
			p[Rig.HB] += sin(t * 0.06 + 1.0) * 0.12
		S.CLIMB:
			p = Rig.blend(Roster.pose("ledge"), Roster.pose("crouch"), clampf(sframe / 14.0, 0.0, 1.0))
		S.KNOCKDOWN:
			p = Roster.pose("lying").duplicate()
		S.DIZZY:
			p = Roster.pose("dizzy").duplicate()
			p[Rig.LEAN] += sin(t * 0.09) * 0.25
			p[Rig.HEAD] += sin(t * 0.13) * 0.3
		S.GRABBING:
			p = Roster.pose("hold").duplicate()
		S.GRABBED:
			p = Roster.pose("grabbed").duplicate()
			p[Rig.HF] += sin(t * 0.4) * 0.5
			p[Rig.HB] += cos(t * 0.4) * 0.5
		_:
			p = Roster.pose("guard").duplicate()
	return p


func _animate() -> void:
	var target := _target_pose()
	var k := 0.38
	match state:
		S.ATTACK:
			k = 0.6 if mf < 2.0 else 0.85
		S.HITSTUN:
			k = 0.55
		S.RUN:
			k = 0.5
		S.AIR:
			k = 0.3 if flip_t <= 0 else 0.6
		S.ROLL, S.LEDGE, S.CLIMB, S.KNOCKDOWN:
			k = 0.55
	var springy := state in [S.IDLE, S.RUN, S.AIR, S.LAND, S.SQUAT, S.CROUCH, S.SHIELD, S.HELPLESS, S.LEDGE, S.GETUP, S.DIZZY, S.GRABBING, S.GRABBED, S.RESPAWN] and flip_t <= 0
	if pose_vel.size() != Rig.NP:
		pose_vel.resize(Rig.NP)
	if springy:
		var stiff := 0.24 if state != S.RUN else 0.34
		for i in Rig.NP:
			var diff := target[i] - cur[i]
			if i == Rig.ROT:
				diff = wrapf(diff, -PI, PI)
			pose_vel[i] = pose_vel[i] * 0.6 + diff * stiff
			cur[i] += pose_vel[i]
	else:
		pose_vel.fill(0.0)
		Rig.approach(cur, target, k)
	if (state == S.HITSTUN and tumble) or (state == S.AIR and flip_t > 0) or state == S.ROLL:
		cur[Rig.ROT] = target[Rig.ROT]
	_solve()
	_update_fx_only()


func _solve() -> void:
	Rig.solve(cur, dims, facing, joints)
	style.facing = facing
	var target_root := Vector2.ZERO
	var ground_like := is_ground_state() or state == S.CLIMB
	if state == S.LEDGE and ledge_id >= 0:
		var l: Dictionary = arena.stage.ledges[ledge_id]
		var hand_mid := (joints[Rig.J_HF] + joints[Rig.J_HB]) * 0.5
		root = (l.pos - pos) - hand_mid + Vector2(0, 2)
		return
	if state == S.KNOCKDOWN or state == S.ROLL:
		target_root.y = -Rig.body_bottom(joints, dims.head) - 1.0
	elif ground_like:
		target_root.y = -Rig.foot_bottom(joints) - 1.5
	else:
		target_root.y = -(dims.th + dims.sh) * 1.05 - cur[Rig.HY]
	if state == S.HITSTUN and tumble:
		target_root.y = -hh * 0.5
	var kk := 0.55 if ground_like else 0.3
	root.x = lerpf(root.x, target_root.x, 0.5)
	root.y = lerpf(root.y, target_root.y, kk)


func _update_fx_only() -> void:
	# trails fade
	for tr in trail:
		tr.a -= 0.16
	while trail.size() > 0 and trail[0].a <= 0.0:
		trail.pop_front()
	for g in ghosts:
		g.a -= 0.06
	while ghosts.size() > 0 and ghosts[0].a <= 0.0:
		ghosts.pop_front()
	# scarf (verlet)
	if scarf.size() == 0:
		return
	var o := pos + root
	var head: Vector2 = o + joints[Rig.J_HEAD]
	var hv := (joints[Rig.J_HEAD] - joints[Rig.J_NECK]).normalized()
	var side := Vector2(-hv.y, hv.x) * facing
	var anchor: Vector2 = head - side * dims.head * 0.95 + hv * dims.head * 0.15
	scarf[0] = anchor
	scarf_prev[0] = anchor
	var motion := vel + kvel
	for i in range(1, scarf.size()):
		var p: Vector2 = scarf[i]
		var v: Vector2 = (p - scarf_prev[i]) * 0.86
		scarf_prev[i] = p
		p += v + Vector2(0, 0.32) - motion * 0.035 + Vector2(-facing * 0.12, sin(t * 0.21 + i) * 0.12)
		scarf[i] = p
	var seg := 6.0 * scale_k
	for _it in 2:
		for i in range(1, scarf.size()):
			var a: Vector2 = scarf[i - 1]
			var b: Vector2 = scarf[i]
			var d := b - a
			var l := d.length()
			if l > 0.001:
				scarf[i] = a + d * (seg / l)


# ------------------------------------------------------------------ drawing
func _draw() -> void:
	if not visible:
		return
	var o := root + shake * 0.0
	var a := alpha
	if state in [S.ROLL, S.SPOT, S.AIRDODGE] and intangible > 0:
		a = 0.45
	if move_name() == "nyx_ub":
		a = clampf(absf(mf - 10.0) / 6.0, 0.08, 1.0)
	if invincible > 0 and (t / 4) % 2 == 0:
		a *= 0.55

	# ground shadow
	var gy: float = arena.stage.ground_below(pos)
	if gy < INF and intro_t <= 0:
		var hgt := gy - pos.y
		var sc := clampf(1.0 - hgt / 400.0, 0.2, 1.0)
		draw_set_transform(Vector2(0, gy - pos.y), 0.0, Vector2(1.0, 0.22))
		draw_circle(Vector2.ZERO, 26.0 * sc * scale_k, Color(0, 0, 0, 0.28 * sc * a))
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

	# respawn halo platform
	if state == S.RESPAWN:
		var c: Color = data.accent
		draw_set_transform(Vector2(0, 2), 0.0, Vector2(1.0, 0.25))
		draw_circle(Vector2.ZERO, 44.0, Color(c.r, c.g, c.b, 0.35))
		draw_arc(Vector2.ZERO, 44.0, 0, TAU, 40, Color(1, 1, 1, 0.8), 3.0, true)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

	# afterimages
	for g in ghosts:
		var gst := style.duplicate()
		var ac: Color = data.accent
		gst.body = Color(ac.r, ac.g, ac.b, 1.0).darkened(0.3)
		gst.back = gst.body
		gst.line = ac
		gst.facing = g.f
		Rig.draw_body(self, g.j, (g.o as Vector2) - pos, gst, g.a * 0.5)

	# weapon / limb smear
	if trail.size() >= 2:
		var acc: Color = data.accent
		for i in range(1, trail.size()):
			var t0: Dictionary = trail[i - 1]
			var t1: Dictionary = trail[i]
			var c0 := Color(acc.r, acc.g, acc.b, clampf(t0.a, 0, 1) * 0.55 * a)
			var c1 := Color(1.0, 1.0, 1.0, clampf(t1.a, 0, 1) * 0.75 * a)
			var pts := PackedVector2Array([(t0.i as Vector2) - pos, (t0.o as Vector2) - pos, (t1.o as Vector2) - pos, (t1.i as Vector2) - pos])
			var ci0 := Color(c0, 0.0)
			var ci1 := Color(c1, 0.0)
			draw_primitive(PackedVector2Array([pts[0], pts[1], pts[2]]), PackedColorArray([ci0, c0, c1]), PackedVector2Array())
			draw_primitive(PackedVector2Array([pts[0], pts[2], pts[3]]), PackedColorArray([ci0, c1, ci1]), PackedVector2Array())

	# scarf (tapered ribbon drawn as round-capped strokes, no polygon triangulation)
	if scarf.size() > 1 and intro_t <= 0:
		var sc: Color = data.scarf
		sc.a = a
		var dark := Color(0, 0, 0, 0.45 * a)
		var n := scarf.size()
		for pass_i in 2:
			for i in range(1, n):
				var p0: Vector2 = scarf[i - 1] - pos
				var p1: Vector2 = scarf[i] - pos
				var wdt := lerpf(8.0, 2.5, float(i) / (n - 1)) * scale_k
				if pass_i == 0:
					draw_line(p0, p1, dark, wdt + 3.0, true)
				else:
					draw_line(p0, p1, sc, wdt, true)
					draw_circle(p1, wdt * 0.5, sc)

	var fl := flash
	if charging:
		fl = maxf(fl, 0.25 + 0.25 * sin(t * 0.9))
	if fs_ready:
		var cc := joints[Rig.J_CORE] + o
		for k in 3:
			var hue := fmod(t * 0.012 + k * 0.33, 1.0)
			draw_circle(cc, (58.0 - k * 12.0 + sin(t * 0.2 + k) * 4.0) * scale_k, Color.from_hsv(hue, 0.7, 1.0, 0.12 * a))
		fl = maxf(fl, 0.12 + 0.12 * sin(t * 0.3))
	var intro_off := 0.0
	if intro_t > 0:
		var u := intro_t / 70.0
		intro_off = -u * u * 650.0
		var c: Color = data.accent
		draw_rect(Rect2(-14, -900, 28, 900 + intro_off), Color(c.r, c.g, c.b, 0.18 * u))
		draw_rect(Rect2(-4, -900, 8, 900 + intro_off), Color(1, 1, 1, 0.35 * u))
	var sq := clampf(squash, -1.0, 1.0)
	draw_set_transform(Vector2(0, intro_off), 0.0, Vector2(1.0 + sq * 0.16, 1.0 - sq * 0.16))
	style.ko = state == S.DIZZY or (state == S.HITSTUN and tumble and kvel.length() > 12.0)
	Rig.draw_body(self, joints, o, style, a, fl)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

	# shield bubble
	if state == S.SHIELD:
		var c: Color = data.accent
		var cc := joints[Rig.J_CORE] + o
		var r := shield_radius()
		draw_circle(cc, r, Color(c.r, c.g, c.b, 0.22))
		draw_arc(cc, r, 0, TAU, 48, Color(c.r, c.g, c.b, 0.85), 3.0, true)
		draw_arc(cc, r * 0.82, -2.2, -1.2, 12, Color(1, 1, 1, 0.5), 3.0, true)

	# counter stance shimmer
	if counter_on:
		var cc := joints[Rig.J_CORE] + o
		draw_arc(cc, 40.0 + sin(t * 0.8) * 3.0, 0, TAU, 40, Color(1, 1, 1, 0.55), 2.0, true)

	# dizzy stars
	if state == S.DIZZY:
		var hc := joints[Rig.J_HEAD] + o + Vector2(0, -dims.head - 10)
		for i in 3:
			var ang := t * 0.12 + i * TAU / 3.0
			var sp := hc + Vector2(cos(ang) * 18.0, sin(ang) * 5.0)
			_star(sp, 5.0, Color(1, 0.95, 0.4))

	# player tag
	if alive() and state != S.DEAD and intro_t <= 0:
		var hp := joints[Rig.J_HEAD] + o
		var top := Vector2(0, minf(hp.y, o.y + joints[Rig.J_NECK].y) - dims.head - 22.0)
		var tri := PackedVector2Array([top + Vector2(-7, -9), top + Vector2(7, -9), top + Vector2(0, 0)])
		draw_colored_polygon(tri, tag_color)
		var font: Font = Game.font_body
		draw_string(font, top + Vector2(-20, -13), tag_text, HORIZONTAL_ALIGNMENT_CENTER, 40, 15, tag_color)


func _star(c: Vector2, r: float, col: Color) -> void:
	var pts := PackedVector2Array()
	for i in 10:
		var rr := r if i % 2 == 0 else r * 0.45
		var ang := -PI / 2 + i * PI / 5.0
		pts.append(c + Vector2(cos(ang), sin(ang)) * rr)
	draw_colored_polygon(pts, col)
