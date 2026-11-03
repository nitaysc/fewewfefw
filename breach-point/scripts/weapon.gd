class_name Weapon
extends Node3D
## The first-person rifle: model, arms, firing, recoil, aim down sights, reload,
## inspect and all their animations. Animations are procedural (springs and
## tweens), so no rigged model is needed.

signal hit_confirmed(headshot: bool, killed: bool)
signal ammo_changed(mag: int, reserve: int)
signal fired

const MAG_SIZE := 30
const FIRE_INTERVAL := 0.1         # 600 rounds per minute
const DAMAGE := 34.0
const HEAD_MULT := 2.6
const RANGE := 200.0

# poses in camera space (position, rotation in degrees)
const HIP_POS := Vector3(0.11, -0.122, -0.33)
const HIP_ROT := Vector3(1.5, 4.0, -2.0)
const ADS_POS := Vector3(0.0, -0.1205, -0.21)
const ADS_ROT := Vector3(0.0, 0.0, 0.0)
const SPRINT_POS := Vector3(0.05, -0.07, 0.02)
const SPRINT_ROT := Vector3(-14.0, 42.0, 20.0)

# points on the gun model (gun-local, metres)
const MUZZLE := Vector3(0.0, 0.066, -0.47)
const EJECT := Vector3(0.022, 0.095, -0.03)
const MAG_PIVOT := Vector3(0.0, 0.055, 0.0026)
const R_HAND := Vector3(0.004, -0.022, 0.165)
const L_HAND := Vector3(-0.004, 0.028, -0.175)
const L_MAG := Vector3(-0.018, -0.045, -0.035)
const L_HANDLE := Vector3(0.05, 0.088, -0.06)
const MAG_IN_HAND := Vector3(0.018, 0.10, 0.04)

var player: Player
var ads_fov := 52.0
var ads_amount := 0.0
var sprint_amount := 0.0
var look_delta := Vector2.ZERO

var mag := MAG_SIZE
var reserve := MAG_SIZE * 4
var reloading := false
var inspecting := false
var _cooldown := 0.0
var _last_shot := -10.0
var _shots_in_burst := 0
var _bloom := 0.0

# animation state driven by tweens
var anim_pos := Vector3.ZERO
var anim_rot := Vector3.ZERO
var lh := L_HAND
var lh_handle_pull := 0.0
var mag_mode := 0              # 0 in gun, 1 in left hand, 2 hidden
var _tween: Tween

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
var _land := 0.0
var _wall := 0.0

var gun: Node3D
var mag_node: Node3D
var mag_mesh: MeshInstance3D
var flash: Node3D
var flash_light: OmniLight3D
var _flash_t := 0.0
var fp_arms: FpArms
var sfx := {}

func setup(p: Player) -> void:
	player = p
	gun = Node3D.new()
	add_child(gun)
	var body := MeshInstance3D.new()
	body.mesh = load("res://assets/models/ak_body.obj")
	body.set_surface_override_material(0, Mats.vm_gun_metal())
	body.set_surface_override_material(1, Mats.vm_gun_wood())
	body.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	gun.add_child(body)
	mag_node = Node3D.new()
	mag_node.position = MAG_PIVOT
	gun.add_child(mag_node)
	mag_mesh = MeshInstance3D.new()
	mag_mesh.mesh = load("res://assets/models/ak_mag.obj")
	mag_mesh.material_override = Mats.vm_gun_mag()
	mag_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mag_node.add_child(mag_mesh)
	_build_flash()
	fp_arms = FpArms.new()
	fp_arms.position = Vector3(0, -0.16, 0.0)
	fp_arms.scale = Vector3.ONE * 1.15
	add_child(fp_arms)
	fp_arms.setup()
	for n in ["ak_fire", "dry_fire", "mag_out", "mag_in", "bolt", "inspect", "hitmarker", "headshot"]:
		var s := Sfx.player(n, -2.0 if n == "ak_fire" else -3.0)
		s.max_polyphony = 6 if n == "ak_fire" else 2
		add_child(s)
		sfx[n] = s
	reset()

func reset() -> void:
	if _tween:
		_tween.kill()
	mag = MAG_SIZE
	reserve = MAG_SIZE * 4
	reloading = false
	inspecting = false
	mag_mode = 0
	lh = L_HAND
	lh_handle_pull = 0.0
	ammo_changed.emit(mag, reserve)
	# raise the weapon into view
	anim_pos = Vector3(0, -0.25, 0.05)
	anim_rot = Vector3(-35, 10, 0)
	_tween = create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_tween.tween_property(self, "anim_pos", Vector3.ZERO, 0.45)
	_tween.parallel().tween_property(self, "anim_rot", Vector3.ZERO, 0.45)

func is_firing_recently() -> bool:
	return Time.get_ticks_msec() / 1000.0 - _last_shot < 0.25

func move_state(speed: float, sprinting: bool, on_floor: bool, sliding: bool, crouching: bool, bob_time: float) -> void:
	_move_speed = speed
	_sprinting = sprinting
	_on_floor = on_floor
	_sliding = sliding
	_crouching = crouching
	_bob_time = bob_time

func kick_land() -> void:
	_rpos_v += Vector3(0, -0.6, 0)
	_rrot_v += Vector3(-30, 0, 0)

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
	_update_arms()

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

	match mag_mode:
		0:
			mag_node.visible = true
			mag_node.position = MAG_PIVOT
		1:
			mag_node.visible = true
			mag_node.position = lh + MAG_IN_HAND - Vector3(0, 0.05, 0)
		2:
			mag_node.visible = false

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
	_rpos_v += Vector3(randf_range(-0.05, 0.05), 0.12, 0.9) * aim
	_rrot_v += Vector3(randf_range(90, 130), randf_range(-35, 35), randf_range(-60, 60)) * aim
	# view recoil: climbs and drifts sideways
	var up := randf_range(0.55, 0.8) * lerpf(1.0, 0.7, ads_amount)
	var side := randf_range(-0.35, 0.45) * lerpf(1.0, 0.7, ads_amount)
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
	var empty := mag == 0
	if _tween:
		_tween.kill()
	var tw := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_tween = tw
	# tilt the rifle to show the magazine well
	tw.tween_property(self, "anim_rot", Vector3(10, -8, -32), 0.28)
	tw.parallel().tween_property(self, "anim_pos", Vector3(0.0, -0.02, 0.03), 0.28)
	tw.parallel().tween_property(self, "lh", L_MAG, 0.26).set_delay(0.1)
	tw.tween_callback(func():
		sfx["mag_out"].play()
		mag_mode = 1)
	# pull the old magazine out and drop it
	tw.tween_property(self, "lh", L_MAG + Vector3(-0.03, -0.12, 0.02), 0.16)
	tw.parallel().tween_property(self, "anim_rot", Vector3(14, -8, -36), 0.16)
	tw.tween_callback(func():
		Fx.drop_mag(self, mag_node.global_transform, mag_mesh.mesh, Mats.gun_mag(), player.velocity)
		mag_mode = 2)
	tw.tween_property(self, "lh", L_MAG + Vector3(-0.06, -0.32, 0.06), 0.18)
	tw.tween_interval(0.12)
	# bring a fresh one up
	tw.tween_callback(func(): mag_mode = 1)
	tw.tween_property(self, "lh", L_MAG + Vector3(-0.01, -0.07, 0.0), 0.32).set_ease(Tween.EASE_OUT)
	tw.tween_property(self, "lh", L_MAG + Vector3(0, -0.01, 0.0), 0.1)
	tw.tween_callback(func():
		mag_mode = 0
		sfx["mag_in"].play()
		_rrot_v += Vector3(-60, 0, 25)
		_rpos_v += Vector3(0, 0.25, 0)
		var take: int = min(MAG_SIZE - mag, reserve)
		mag += take
		reserve -= take
		ammo_changed.emit(mag, reserve))
	tw.tween_interval(0.08)
	if empty:
		# rack the bolt
		tw.tween_property(self, "anim_rot", Vector3(4, -18, 18), 0.25)
		tw.parallel().tween_property(self, "anim_pos", Vector3(-0.03, 0.0, 0.0), 0.25)
		tw.parallel().tween_property(self, "lh", L_HANDLE, 0.25)
		tw.tween_callback(func(): sfx["bolt"].play())
		tw.tween_property(self, "lh", L_HANDLE + Vector3(0.004, 0, 0.075), 0.1)
		tw.tween_callback(func(): _rrot_v += Vector3(-40, 20, 0))
		tw.tween_property(self, "lh", L_HANDLE + Vector3(0.03, -0.02, 0.06), 0.1)
	tw.tween_property(self, "lh", L_HAND, 0.3)
	tw.parallel().tween_property(self, "anim_rot", Vector3.ZERO, 0.35)
	tw.parallel().tween_property(self, "anim_pos", Vector3.ZERO, 0.35)
	tw.tween_callback(func(): reloading = false)

func inspect() -> void:
	inspecting = true
	if _tween:
		_tween.kill()
	sfx["inspect"].play()
	var tw := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_tween = tw
	# roll it over to look at the left side
	tw.tween_property(self, "anim_pos", Vector3(-0.09, 0.05, 0.04), 0.45)
	tw.parallel().tween_property(self, "anim_rot", Vector3(8, 32, 62), 0.45)
	tw.tween_property(self, "anim_rot", Vector3(12, 38, 66), 0.9)
	# then turn it to see the right side and the bolt
	tw.tween_callback(func(): sfx["inspect"].play())
	tw.tween_property(self, "anim_pos", Vector3(-0.05, 0.03, 0.02), 0.5)
	tw.parallel().tween_property(self, "anim_rot", Vector3(-6, -38, -30), 0.5)
	tw.tween_property(self, "anim_rot", Vector3(-10, -42, -34), 0.8)
	tw.parallel().tween_property(self, "lh", L_HANDLE + Vector3(0, -0.01, 0.01), 0.3)
	tw.tween_property(self, "lh", L_HAND, 0.3)
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
	tw.parallel().tween_property(self, "lh", L_HAND, 0.2)

# --- building the model ---------------------------------------------------

func _build_flash() -> void:
	flash = Node3D.new()
	flash.position = MUZZLE + Vector3(0, 0, -0.03)
	gun.add_child(flash)
	var tex := Fx.flash_texture()
	var m := Mats.vm_glow(tex, Color(1.0, 0.75, 0.4), 6.0)
	var front := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(0.16, 0.16)
	front.mesh = qm
	front.material_override = m
	flash.add_child(front)
	for i in 2:
		var side := MeshInstance3D.new()
		var sm := QuadMesh.new()
		sm.size = Vector2(0.09, 0.24)
		side.mesh = sm
		side.material_override = m
		side.rotation_degrees = Vector3(90, 0, 90 * i)
		side.position.z = -0.08
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

# where the wrists sit relative to the hand points, and how the hands are turned
const R_WRIST_OFF := Vector3(0.04, 0.005, 0.035)
const L_WRIST_OFF := Vector3(0.062, -0.03, 0.04)

func _update_arms() -> void:
	var g := gun.transform
	var b := g.basis
	fp_arms.solve("R", g * (R_HAND + R_WRIST_OFF), b * Vector3(-1.0, -0.25, -0.45), b * Vector3(0, 1, 0.2),
		Vector3(0.6, -1.0, 0.2), {"all": 75.0, "index": 30.0, "thumb": 45.0})
	var knuck := Vector3(-0.8, 0.4, -0.35)
	var lcurl := {"all": 60.0, "thumb": 30.0}
	if lh.distance_to(L_HAND) > 0.03:
		knuck = Vector3(-0.2, 0.6, -0.7)
		lcurl = {"all": 50.0, "thumb": 40.0}
	fp_arms.solve("L", g * (lh + L_WRIST_OFF), b * knuck, b * Vector3(0, 0.1, -1.0), Vector3(-0.8, -1.0, 0.1), lcurl)
