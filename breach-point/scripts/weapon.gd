class_name Weapon
extends Node3D
## The first-person weapon: a Kriss Vector held by gloved hands, both animated
## by hand ("Kriss Vector Animated (Free)" by BarcodeGames, CC-BY 4.0). The
## model's own clips do draw, shoot and reload; on top of them procedural
## springs add recoil, sway, walk bob, sprint and aim-down-sights poses, and
## inspect turns the whole weapon towards the camera.

signal hit_confirmed(headshot: bool, killed: bool)
signal ammo_changed(mag: int, reserve: int)
signal fired

const MAG_SIZE := 30
const FIRE_INTERVAL := 0.075       # 800 rounds per minute
const DAMAGE := 28.0
const HEAD_MULT := 2.8
const RANGE := 200.0

# the model's clips live on one timeline: [start, end] in seconds
const RELOAD := [0.034, 3.333]
const SHOOT := [3.367, 3.567]
const DRAW := [4.167, 4.667]
const RELOAD_SPEED := 1.12
const T_MAG_OUT := 1.03
const T_MAG_IN := 2.14
const T_BOLT := 2.78

# the model is in centimetres, faces +Z, and its gun (bone main_j) sits here
const MODEL_GUN := Vector3(-12.2, 135.1, -1.6)
const MODEL_SIGHT_Y := 148.6

# poses of the gun in camera space (position, rotation in degrees)
const HIP_POS := Vector3(0.135, -0.12, -0.3)
const HIP_ROT := Vector3(0.0, 0.0, 0.0)
const ADS_POS := Vector3(0.0, -0.142, -0.2)
const ADS_ROT := Vector3(0.0, 0.0, 0.0)
const SPRINT_POS := Vector3(-0.03, -0.06, 0.03)
const SPRINT_ROT := Vector3(-16.0, 38.0, 14.0)

# points on the gun (gun-local, metres)
const MUZZLE := Vector3(0.0, -0.005, -0.44)
const EJECT := Vector3(0.03, 0.04, -0.06)

var player: Player
var ads_fov := 54.0
var ads_amount := 0.0
var sprint_amount := 0.0
var look_delta := Vector2.ZERO

var mag := MAG_SIZE
var reserve := MAG_SIZE * 5
var reloading := false
var inspecting := false
var _cooldown := 0.0
var _last_shot := -10.0
var _shots_in_burst := 0
var _bloom := 0.0

# procedural offsets driven by tweens (inspect, raise)
var anim_pos := Vector3.ZERO
var anim_rot := Vector3.ZERO
var _tween: Tween
var _reload_id := 0

# springs
var _rpos := Vector3.ZERO
var _rpos_v := Vector3.ZERO
var _rrot := Vector3.ZERO
var _rrot_v := Vector3.ZERO
var _sway := Vector3.ZERO
var _move_speed := 0.0
var _bob_time := 0.0
var _on_floor := true
var _sliding := false
var _crouching := false
var _sprinting := false
var _wall := 0.0

var gun: Node3D
var anim: AnimationPlayer
var flash: Node3D
var flash_light: OmniLight3D
var _flash_t := 0.0
var sfx := {}

func setup(p: Player) -> void:
	player = p
	gun = Node3D.new()
	add_child(gun)
	# turn the model to face -Z, scale cm to m, and put its gun on the pivot
	var rig := Node3D.new()
	rig.rotation_degrees.y = 180.0
	rig.scale = Vector3.ONE * 0.01
	rig.position = -(Basis(Vector3.UP, PI) * MODEL_GUN * 0.01)
	gun.add_child(rig)
	var model: Node3D = load("res://assets/models/kriss/scene.gltf").instantiate()
	rig.add_child(model)
	for mi: MeshInstance3D in model.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.extra_cull_margin = 50.0
		for i in mi.mesh.get_surface_count():
			var m := mi.get_active_material(i)
			var tex: Texture2D = m.albedo_texture if m is BaseMaterial3D else null
			mi.set_surface_override_material(i, Mats.vm_textured(tex, mi.name + str(i)))
	anim = model.find_children("*", "AnimationPlayer", true, false)[0]
	anim.playback_default_blend_time = 0.08
	_build_flash()
	for n in ["ak_fire", "dry_fire", "mag_out", "mag_in", "bolt", "inspect", "hitmarker", "headshot"]:
		var s := Sfx.player(n, -2.0 if n == "ak_fire" else -3.0)
		s.max_polyphony = 6 if n == "ak_fire" else 2
		add_child(s)
		sfx[n] = s
	reset()

func reset() -> void:
	if _tween:
		_tween.kill()
	_reload_id += 1
	mag = MAG_SIZE
	reserve = MAG_SIZE * 5
	reloading = false
	inspecting = false
	anim_pos = Vector3.ZERO
	anim_rot = Vector3.ZERO
	ammo_changed.emit(mag, reserve)
	anim.play_section("Draw", DRAW[0], DRAW[1], 0.0)

func is_firing_recently() -> bool:
	return Time.get_ticks_msec() / 1000.0 - _last_shot < 0.25

func move_state(speed: float, sprinting: bool, on_floor: bool, sliding: bool, crouching: bool, bob_time: float) -> void:
	_move_speed = speed
	_sprinting = sprinting
	_on_floor = on_floor
	_sliding = sliding
	_crouching = crouching
	_bob_time = bob_time

func tick(delta: float) -> void:
	var c := player.controls
	var busy := reloading or inspecting
	var want_ads := c.ads and not _sprinting and player.alive and not inspecting
	ads_amount = move_toward(ads_amount, 1.0 if want_ads else 0.0, delta / 0.18)
	var want_sprint := _sprinting and not busy
	sprint_amount = move_toward(sprint_amount, 1.0 if want_sprint else 0.0, delta / 0.22)

	if c.reload_pressed and not busy and mag < MAG_SIZE and reserve > 0:
		reload()
	if c.inspect_pressed and not busy and ads_amount < 0.1:
		inspect()
	if inspecting and (c.fire or c.ads or c.reload_pressed):
		_cancel_inspect()

	_cooldown -= delta
	if c.fire and player.alive and not reloading and not inspecting and sprint_amount < 0.35:
		if _cooldown <= 0.0:
			if mag > 0:
				_shoot()
				_cooldown += FIRE_INTERVAL
			else:
				sfx["dry_fire"].play()
				_cooldown = 0.3
				if reserve > 0:
					reload()
	else:
		_cooldown = maxf(_cooldown, 0.0)
		if Time.get_ticks_msec() / 1000.0 - _last_shot > 0.2:
			_shots_in_burst = 0
	_bloom = move_toward(_bloom, 0.0, delta * 4.0)
	_flash_t -= delta
	flash.visible = _flash_t > 0.0
	flash_light.visible = _flash_t > -0.01 and _flash_t > 0.0

	_update_pose(delta)

func _update_pose(delta: float) -> void:
	# recoil springs
	var k := 260.0
	var d := 20.0
	_rpos_v += (-_rpos * k - _rpos_v * d) * delta
	_rpos += _rpos_v * delta
	_rrot_v += (-_rrot * (k * 0.7) - _rrot_v * (d * 0.9)) * delta
	_rrot += _rrot_v * delta
	# sway follows look input, lags behind the view
	var sway_target := Vector3(look_delta.y * 0.9, look_delta.x * 0.9, look_delta.x * 1.2).limit_length(6.0)
	sway_target *= lerpf(1.0, 0.25, ads_amount)
	_sway = _sway.lerp(sway_target, minf(1.0, delta * 10.0))
	# walk bob
	var bobk := clampf(_move_speed / 5.0, 0.0, 1.4) * lerpf(1.0, 0.15, ads_amount)
	if not _on_floor or _sliding:
		bobk = 0.0
	var bob_pos := Vector3(sin(_bob_time) * 0.012, -abs(cos(_bob_time)) * 0.012, 0) * bobk
	var bob_rot := Vector3(abs(cos(_bob_time)) * 1.2, sin(_bob_time) * 1.0, sin(_bob_time) * 1.6) * bobk
	if sprint_amount > 0:
		bob_pos += Vector3(sin(_bob_time) * 0.03, -abs(cos(_bob_time)) * 0.03, 0) * sprint_amount
		bob_rot += Vector3(abs(cos(_bob_time)) * 4.0, sin(_bob_time) * 5.0, 0) * sprint_amount
	# idle breathing
	var t := Time.get_ticks_msec() / 1000.0
	var breathe := Vector3(sin(t * 1.3) * 0.0015, sin(t * 2.0) * 0.002, 0) * lerpf(1.0, 0.3, ads_amount)
	# pull back when facing a wall
	var space := player.get_world_3d().direct_space_state
	var cam := player.camera
	var q := PhysicsRayQueryParameters3D.create(cam.global_position, cam.global_position - cam.global_basis.z * 0.75, 1)
	var hit := space.intersect_ray(q)
	var wall_target := 0.0
	if hit:
		wall_target = 1.0 - cam.global_position.distance_to(hit.position) / 0.75
	_wall = lerpf(_wall, wall_target, minf(1.0, delta * 10.0))
	var crouch_off := Vector3(-0.01, 0.01, 0) * (1.0 if _crouching else 0.0) * (1.0 - ads_amount)

	var pos := HIP_POS.lerp(ADS_POS, ads_amount)
	var rot := HIP_ROT.lerp(ADS_ROT, ads_amount)
	pos = pos.lerp(pos + SPRINT_POS, sprint_amount)
	rot = rot.lerp(rot + SPRINT_ROT, sprint_amount)
	if _sliding:
		rot += Vector3(0, 0, 12) * (1.0 - ads_amount)
	pos += Vector3(0, -0.06, 0.12) * _wall
	rot += Vector3(30, 20, 0) * _wall
	pos += anim_pos + _rpos + bob_pos + breathe + crouch_off
	rot += anim_rot + _rrot + _sway + bob_rot
	gun.position = pos
	gun.rotation_degrees = rot

# --- firing ---------------------------------------------------------------

func _shoot() -> void:
	mag -= 1
	_shots_in_burst += 1
	_last_shot = Time.get_ticks_msec() / 1000.0
	ammo_changed.emit(mag, reserve)
	var s: AudioStreamPlayer = sfx["ak_fire"]
	s.pitch_scale = randf_range(0.95, 1.05)
	s.play()
	fired.emit()

	# visual kick: back, up, a little random roll; less when aiming
	var aim := lerpf(1.0, 0.45, ads_amount)
	_rpos_v += Vector3(randf_range(-0.04, 0.04), 0.08, 0.7) * aim
	_rrot_v += Vector3(randf_range(60, 95), randf_range(-25, 25), randf_range(-45, 45)) * aim
	anim.play_section("Shoot", SHOOT[0], SHOOT[1], 0.0, 2.2)
	# view recoil: climbs and drifts sideways
	var up := randf_range(0.42, 0.62) * lerpf(1.0, 0.7, ads_amount)
	var side := randf_range(-0.3, 0.38) * lerpf(1.0, 0.7, ads_amount)
	if _shots_in_burst > 8:
		side *= 1.5
	player.add_recoil(up, side)

	_flash_t = 0.045
	flash.rotation.z = randf() * TAU
	flash.scale = Vector3.ONE * randf_range(0.8, 1.25)

	# where the bullet goes
	var cam := player.camera
	var spread := lerpf(2.4, 0.12, ads_amount) + _bloom
	spread += clampf(_move_speed / 5.0, 0.0, 1.5) * lerpf(1.8, 0.3, ads_amount)
	if not _on_floor:
		spread += 3.0
	_bloom = minf(_bloom + lerpf(0.35, 0.05, ads_amount), 3.0)
	var dir := -cam.global_basis.z
	var rnd := Vector2.from_angle(randf() * TAU) * sqrt(randf()) * deg_to_rad(spread)
	dir = (dir + cam.global_basis.x * tan(rnd.x) + cam.global_basis.y * tan(rnd.y)).normalized()
	var from := cam.global_position
	var q := PhysicsRayQueryParameters3D.create(from, from + dir * RANGE, 1 | 8)
	q.collide_with_areas = true
	var hit := player.get_world_3d().direct_space_state.intersect_ray(q)
	var end := from + dir * RANGE
	var muzzle_world := gun.global_transform * MUZZLE
	if hit:
		end = hit.position
		var col: Object = hit.collider
		if col is Area3D and col.has_meta("bot"):
			var bot: Bot = col.get_meta("bot")
			var head: bool = col.get_meta("head", false)
			var killed := bot.hit(DAMAGE * (HEAD_MULT if head else 1.0), dir)
			Fx.blood(self, hit.position, hit.normal)
			if head:
				sfx["headshot"].play()
			else:
				sfx["hitmarker"].play()
			hit_confirmed.emit(head, killed)
		else:
			Fx.impact(self, hit.position, hit.normal)
	if _shots_in_burst % 2 == 1:
		Fx.tracer(self, muzzle_world, end)
	Fx.shell(self, gun.global_transform * EJECT, cam.global_basis, player.velocity)
	Bot.alert_all(get_tree(), player.global_position)


# --- reload and inspect ---------------------------------------------------

func reload() -> void:
	if reloading or reserve <= 0 or mag >= MAG_SIZE:
		return
	if inspecting:
		_cancel_inspect()
	reloading = true
	_reload_id += 1
	var id := _reload_id
	anim.play_section("Reload", RELOAD[0], RELOAD[1], 0.1, RELOAD_SPEED)
	_at(T_MAG_OUT, id, func(): sfx["mag_out"].play())
	_at(T_MAG_IN, id, func():
		sfx["mag_in"].play()
		var take: int = min(MAG_SIZE - mag, reserve)
		mag += take
		reserve -= take
		ammo_changed.emit(mag, reserve))
	_at(T_BOLT, id, func(): sfx["bolt"].play())
	_at(RELOAD[1] - 0.05, id, func():
		reloading = false
		_idle())

## runs f at a time (seconds into the model's reload clip) unless the reload was interrupted
func _at(t: float, id: int, f: Callable) -> void:
	get_tree().create_timer((t - RELOAD[0]) / RELOAD_SPEED, false).timeout.connect(func():
		if id == _reload_id:
			f.call())

func _idle() -> void:
	anim.play_section("Reload", RELOAD[0], RELOAD[0] + 0.01, 0.15)

func inspect() -> void:
	inspecting = true
	if _tween:
		_tween.kill()
	sfx["inspect"].play()
	var tw := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_tween = tw
	# bring it in and tilt it to show the right side
	tw.tween_property(self, "anim_pos", Vector3(-0.045, 0.025, 0.0), 0.5)
	tw.parallel().tween_property(self, "anim_rot", Vector3(5, -22, -18), 0.5)
	tw.tween_property(self, "anim_rot", Vector3(7, -25, -20), 0.9)
	# roll it over to the left side
	tw.tween_callback(func(): sfx["inspect"].play())
	tw.tween_property(self, "anim_pos", Vector3(-0.04, 0.02, 0.0), 0.55)
	tw.parallel().tween_property(self, "anim_rot", Vector3(12, 18, 34), 0.55)
	tw.tween_property(self, "anim_rot", Vector3(14, 20, 36), 0.8)
	tw.tween_property(self, "anim_pos", Vector3.ZERO, 0.45)
	tw.parallel().tween_property(self, "anim_rot", Vector3.ZERO, 0.45)
	tw.tween_callback(func(): inspecting = false)

func _cancel_inspect() -> void:
	if _tween:
		_tween.kill()
	inspecting = false
	var tw := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_tween = tw
	tw.tween_property(self, "anim_pos", Vector3.ZERO, 0.2)
	tw.parallel().tween_property(self, "anim_rot", Vector3.ZERO, 0.2)

# --- muzzle flash ---------------------------------------------------------

func _build_flash() -> void:
	flash = Node3D.new()
	flash.position = MUZZLE + Vector3(0, 0, -0.03)
	gun.add_child(flash)
	var m := Mats.vm_glow(Fx.flash_texture(), Color(1.0, 0.75, 0.4), 6.0)
	var front := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(0.14, 0.14)
	front.mesh = qm
	front.material_override = m
	flash.add_child(front)
	for i in 2:
		var side := MeshInstance3D.new()
		var sm := QuadMesh.new()
		sm.size = Vector2(0.08, 0.2)
		side.mesh = sm
		side.material_override = m
		side.rotation_degrees = Vector3(90, 0, 90 * i)
		side.position.z = -0.07
		flash.add_child(side)
	for mi in flash.get_children():
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	flash_light = OmniLight3D.new()
	flash_light.light_color = Color(1.0, 0.7, 0.35)
	flash_light.light_energy = 3.0
	flash_light.omni_range = 5.0
	flash_light.position = MUZZLE + Vector3(0, 0.05, -0.1)
	gun.add_child(flash_light)
	flash.visible = false
	flash_light.visible = false

func kick_land() -> void:
	_rpos_v += Vector3(0, -0.5, 0)
	_rrot_v += Vector3(-25, 0, 0)
