class_name Bot
extends CharacterBody3D
## An enemy soldier: patrols, reacts to sight and gunfire, takes cover-ish
## strafing positions and fires bursts whose accuracy depends on distance and
## on how fast the player moves. Hit boxes for body and head.

signal killed(bot: Bot, headshot: bool)

enum State { PATROL, ENGAGE, SEARCH, DEAD }

const WALK := 2.6
const RUN := 4.6
const SIGHT := 48.0

var target: Player
var map: GameMap
var state := State.PATROL
var health := 100.0
var agent: NavigationAgent3D
var model: Node3D
var legs: Array[Node3D] = []
var arms_node: Node3D
var muzzle: Node3D
var flash: MeshInstance3D
var _flash_t := 0.0
var last_known := Vector3.ZERO
var _seen_time := 0.0
var _since_seen := 99.0
var _burst_left := 0
var _shot_cd := 0.0
var _burst_cd := 1.0
var _strafe := 1.0
var _strafe_t := 0.0
var _walk_phase := 0.0
var _repath := 0.0
var _last_head_hit := false
var _sfx_fire: AudioStreamPlayer3D

static func alert_all(tree: SceneTree, pos: Vector3) -> void:
	for b in tree.get_nodes_in_group("bots"):
		var bot := b as Bot
		if bot.state == State.PATROL and bot.global_position.distance_to(pos) < 40.0:
			bot.last_known = pos
			bot.state = State.SEARCH

func setup(p: Player, m: GameMap, tint: Color) -> void:
	target = p
	map = m
	add_to_group("bots")
	collision_layer = 4
	collision_mask = 1 | 2 | 4
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)
	agent = NavigationAgent3D.new()
	agent.path_desired_distance = 0.6
	agent.target_desired_distance = 1.0
	agent.radius = 0.4
	add_child(agent)
	_build_model(tint)
	_add_hitbox(Vector3(0, 1.05, 0), BoxShape3D.new(), Vector3(0.5, 1.15, 0.32), false)
	_add_hitbox(Vector3(0, 1.68, 0), SphereShape3D.new(), Vector3(0.15, 0, 0), true)
	_sfx_fire = Sfx.player3d("enemy_fire", 2.0)
	_sfx_fire.max_polyphony = 3
	add_child(_sfx_fire)
	_pick_patrol()

func _add_hitbox(pos: Vector3, shape: Shape3D, size: Vector3, head: bool) -> void:
	var a := Area3D.new()
	a.collision_layer = 8
	a.collision_mask = 0
	a.monitoring = false
	a.set_meta("bot", self)
	a.set_meta("head", head)
	var cs := CollisionShape3D.new()
	if shape is BoxShape3D:
		shape.size = size
	elif shape is SphereShape3D:
		shape.radius = size.x
	cs.shape = shape
	a.add_child(cs)
	a.position = pos
	add_child(a)

func _part(parent: Node3D, mesh: Mesh, mat: Material, pos: Vector3, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position = pos
	mi.rotation_degrees = rot
	parent.add_child(mi)
	return mi

func _box(s: Vector3) -> BoxMesh:
	var b := BoxMesh.new()
	b.size = s
	return b

func _build_model(tint: Color) -> void:
	model = Node3D.new()
	add_child(model)
	var uniform := Mats.cloth(tint, "enemy_%s" % tint.to_html())
	var vest := Mats.cloth(tint.darkened(0.45), "vest_%s" % tint.to_html())
	var skin := Mats.flat(Color(0.62, 0.45, 0.34), 0.8)
	var dark := Mats.flat(Color(0.08, 0.08, 0.08), 0.6, 0.4)
	var helmet_m := Mats.cloth(tint.darkened(0.25), "helmet_%s" % tint.to_html())
	for s in [-1, 1]:
		var hip := Node3D.new()
		hip.position = Vector3(s * 0.12, 0.92, 0)
		model.add_child(hip)
		_part(hip, _box(Vector3(0.17, 0.48, 0.2)), uniform, Vector3(0, -0.24, 0))
		_part(hip, _box(Vector3(0.15, 0.44, 0.17)), uniform, Vector3(0, -0.68, 0))
		_part(hip, _box(Vector3(0.16, 0.1, 0.28)), dark, Vector3(0, -0.88, -0.04))
		legs.append(hip)
	_part(model, _box(Vector3(0.44, 0.6, 0.26)), uniform, Vector3(0, 1.22, 0))
	_part(model, _box(Vector3(0.48, 0.46, 0.32)), vest, Vector3(0, 1.26, 0))
	_part(model, _box(Vector3(0.42, 0.12, 0.28)), dark, Vector3(0, 0.95, 0))
	var head := Node3D.new()
	head.position = Vector3(0, 1.68, 0)
	model.add_child(head)
	var hs := SphereMesh.new()
	hs.radius = 0.12
	hs.height = 0.26
	_part(head, hs, skin, Vector3.ZERO)
	var hm := SphereMesh.new()
	hm.radius = 0.145
	hm.height = 0.2
	hm.is_hemisphere = true
	_part(head, hm, helmet_m, Vector3(0, 0.03, 0.0))
	_part(head, _box(Vector3(0.2, 0.05, 0.03)), dark, Vector3(0, 0.02, -0.115))
	_part(model, _box(Vector3(0.12, 0.08, 0.12)), skin, Vector3(0, 1.55, 0))
	# arms holding a rifle, pivot at the shoulders so they follow aim pitch
	arms_node = Node3D.new()
	arms_node.position = Vector3(0, 1.42, 0)
	model.add_child(arms_node)
	_part(arms_node, _box(Vector3(0.12, 0.12, 0.42)), uniform, Vector3(0.24, -0.08, -0.14), Vector3(10, 10, 0))
	_part(arms_node, _box(Vector3(0.12, 0.12, 0.46)), uniform, Vector3(-0.2, -0.08, -0.22), Vector3(10, -25, 0))
	var gun := Node3D.new()
	gun.position = Vector3(0.1, -0.1, -0.35)
	arms_node.add_child(gun)
	_part(gun, _box(Vector3(0.06, 0.1, 0.7)), dark, Vector3(0, 0, -0.1))
	_part(gun, _box(Vector3(0.05, 0.18, 0.06)), dark, Vector3(0, -0.12, -0.12), Vector3(-15, 0, 0))
	_part(gun, _box(Vector3(0.05, 0.12, 0.22)), Mats.gun_wood(), Vector3(0, -0.02, 0.32))
	muzzle = Node3D.new()
	muzzle.position = Vector3(0, 0.01, -0.48)
	gun.add_child(muzzle)
	flash = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.35, 0.35)
	flash.mesh = q
	var fm := Mats.glow(Color(1, 0.75, 0.4), 5.0)
	fm.albedo_texture = Fx.flash_texture()
	fm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	flash.material_override = fm
	flash.visible = false
	muzzle.add_child(flash)
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

func hit(damage: float, dir: Vector3) -> bool:
	if state == State.DEAD:
		return false
	health -= damage
	velocity += dir * 0.6
	last_known = target.global_position
	if state != State.ENGAGE:
		state = State.ENGAGE
		_seen_time = 0.25
	if health <= 0:
		_die(dir, damage > 60.0)
		return true
	return false

func _die(dir: Vector3, headshot: bool) -> void:
	state = State.DEAD
	remove_from_group("bots")
	collision_layer = 0
	for a in find_children("*", "Area3D", false, false):
		a.queue_free()
	killed.emit(self, headshot)
	flash.visible = false
	var side := 1.0 if randf() < 0.5 else -1.0
	var tw := create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_property(model, "rotation_degrees", Vector3(-88 * signf(dir.dot(-global_basis.z) + 0.01) , randf_range(-20, 20), side * 10), 0.55)
	tw.parallel().tween_property(model, "position", Vector3(0, 0.12, 0), 0.55)
	tw.tween_interval(4.0)
	tw.tween_property(model, "position", Vector3(0, -0.6, 0), 1.0)
	tw.tween_callback(queue_free)

func _pick_patrol() -> void:
	if map.patrol_points.size() > 0:
		agent.target_position = map.patrol_points.pick_random()

func _can_see() -> bool:
	if not target.alive:
		return false
	var eye := global_position + Vector3(0, 1.65, 0)
	var to := target.global_position + Vector3(0, target.eye * 0.9, 0)
	if eye.distance_to(to) > SIGHT:
		return false
	var fwd := -global_basis.z
	var dir := (to - eye).normalized()
	if state == State.PATROL and fwd.dot(dir) < 0.2:
		return false
	var q := PhysicsRayQueryParameters3D.create(eye, to, 1 | 2)
	q.exclude = [get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return hit and hit.collider == target

func _physics_process(delta: float) -> void:
	if state == State.DEAD:
		return
	_flash_t -= delta
	flash.visible = _flash_t > 0
	var sees := _can_see()
	if sees:
		_since_seen = 0.0
		last_known = target.global_position
		if state != State.ENGAGE:
			state = State.ENGAGE
			_seen_time = 0.0
			_burst_cd = randf_range(0.45, 0.8)   # reaction time
	else:
		_since_seen += delta
		if state == State.ENGAGE and _since_seen > 1.5:
			state = State.SEARCH
	if not target.alive and state != State.PATROL:
		state = State.PATROL
		_pick_patrol()

	var move_dir := Vector3.ZERO
	var speed := WALK
	match state:
		State.PATROL:
			if agent.is_navigation_finished():
				_pick_patrol()
			move_dir = _nav_dir(delta)
		State.SEARCH:
			speed = RUN
			agent.target_position = last_known
			move_dir = _nav_dir(delta)
			if agent.is_navigation_finished() or global_position.distance_to(last_known) < 1.5:
				state = State.PATROL
				_pick_patrol()
		State.ENGAGE:
			_seen_time += delta
			var to_t := target.global_position - global_position
			to_t.y = 0
			var dist := to_t.length()
			_strafe_t -= delta
			if _strafe_t <= 0:
				_strafe_t = randf_range(0.8, 2.0)
				_strafe = [-1.0, 1.0, 0.0].pick_random()
			var side := to_t.normalized().cross(Vector3.UP) * _strafe
			if dist > 20:
				agent.target_position = target.global_position
				move_dir = _nav_dir(delta) * 0.8 + side * 0.3
			elif dist < 7:
				move_dir = -to_t.normalized() * 0.6 + side * 0.5
			else:
				move_dir = side * 0.7
			speed = WALK
			if sees:
				_combat(delta, dist)
			else:
				agent.target_position = last_known
				move_dir = _nav_dir(delta)
				speed = RUN

	var face := Vector3.ZERO
	if state == State.ENGAGE:
		face = target.global_position - global_position
	elif move_dir.length() > 0.1:
		face = move_dir
	face.y = 0
	if face.length() > 0.01:
		var want := atan2(-face.x, -face.z)
		rotation.y = lerp_angle(rotation.y, want, minf(1.0, delta * (9.0 if state == State.ENGAGE else 5.0)))
	# aim the arms up and down at the player
	if state == State.ENGAGE:
		var d := target.global_position + Vector3(0, 1.2, 0) - (global_position + Vector3(0, 1.42, 0))
		var p := atan2(d.y, Vector2(d.x, d.z).length())
		arms_node.rotation.x = lerpf(arms_node.rotation.x, p, delta * 8.0)
	else:
		arms_node.rotation.x = lerpf(arms_node.rotation.x, -0.35, delta * 4.0)

	var hv := move_dir.limit_length(1.0) * speed
	velocity.x = move_toward(velocity.x, hv.x, 18 * delta)
	velocity.z = move_toward(velocity.z, hv.z, 18 * delta)
	if not is_on_floor():
		velocity.y -= 19.0 * delta
	else:
		velocity.y = -0.5
	move_and_slide()

	var hs := Vector2(velocity.x, velocity.z).length()
	_walk_phase += delta * hs * 2.4
	var swing := sin(_walk_phase) * clampf(hs / 3.0, 0.0, 1.0) * 0.6
	legs[0].rotation.x = swing
	legs[1].rotation.x = -swing

func _nav_dir(_delta: float) -> Vector3:
	if agent.is_navigation_finished():
		return Vector3.ZERO
	var next := agent.get_next_path_position()
	var d := next - global_position
	d.y = 0
	return d.normalized() if d.length() > 0.05 else Vector3.ZERO

func _combat(delta: float, dist: float) -> void:
	_shot_cd -= delta
	_burst_cd -= delta
	if _burst_left <= 0:
		if _burst_cd <= 0:
			_burst_left = randi_range(3, 6)
		return
	if _shot_cd > 0:
		return
	_shot_cd = 0.12
	_burst_left -= 1
	if _burst_left <= 0:
		_burst_cd = randf_range(0.7, 1.5)
	_fire(dist)

func _fire(dist: float) -> void:
	_flash_t = 0.05
	flash.rotation.z = randf() * TAU
	_sfx_fire.pitch_scale = randf_range(0.92, 1.08)
	_sfx_fire.play()
	var player_speed := Vector2(target.velocity.x, target.velocity.z).length()
	var chance := 0.55 - dist * 0.012 - player_speed * 0.035 + minf(_seen_time, 3.0) * 0.06
	if target.crouching:
		chance -= 0.08
	chance = clampf(chance, 0.08, 0.7)
	var from := muzzle.global_position
	var aim := target.global_position + Vector3(0, target.eye * 0.75, 0)
	if randf() < chance:
		target.take_damage(randf_range(8.0, 12.0), global_position)
		Fx.tracer(self, from, aim)
	else:
		var miss := aim + Vector3(randf_range(-1, 1), randf_range(-0.6, 1.0), randf_range(-1, 1)).normalized() * randf_range(0.6, 1.6)
		var dir := (miss - from).normalized()
		var q := PhysicsRayQueryParameters3D.create(from, from + dir * 80.0, 1)
		var hit := get_world_3d().direct_space_state.intersect_ray(q)
		var end := from + dir * 80.0
		if hit:
			end = hit.position
			if hit.position.distance_to(target.global_position) < 6.0:
				Fx.impact(self, hit.position, hit.normal)
		Fx.tracer(self, from, end)
