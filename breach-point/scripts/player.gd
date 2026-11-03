class_name Player
extends CharacterBody3D
## First-person movement: walk, sprint, crouch, slide, jump, plus health that
## regenerates after a few seconds out of fire.

signal died
signal damaged(amount: float, from: Vector3)

const WALK := 4.6
const SPRINT := 7.2
const CROUCH := 2.4
const ADS_SPEED := 2.9
const JUMP := 6.2
const GRAVITY := 19.0
const STAND_EYE := 1.62
const CROUCH_EYE := 1.0
const SLIDE_EYE := 0.8
const BASE_FOV := 80.0

var controls: Controls
var head: Node3D
var camera: Camera3D
var weapon: Weapon
var shape: CollisionShape3D

var health := 100.0
var alive := true
var yaw := 0.0
var pitch := 0.0
var crouching := false
var sliding := false
var slide_time := 0.0
var slide_dir := Vector3.ZERO
var eye := STAND_EYE
var bob_time := 0.0
var step_accum := 0.0
var last_hit_time := -100.0
var recoil := Vector2.ZERO        # degrees applied on top of yaw/pitch, recovers over time
var recoil_target := Vector2.ZERO
var tilt := 0.0
var landing := 0.0
var was_on_floor := true
var fov_kick := 0.0
var sfx_step: AudioStreamPlayer
var sfx_hurt: AudioStreamPlayer

func setup(c: Controls) -> void:
	controls = c
	collision_layer = 2
	collision_mask = 1 | 4
	floor_max_angle = deg_to_rad(46)
	floor_snap_length = 0.3
	shape = CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.8
	shape.shape = cap
	shape.position.y = 0.9
	add_child(shape)
	head = Node3D.new()
	head.position.y = STAND_EYE
	add_child(head)
	camera = Camera3D.new()
	camera.fov = BASE_FOV
	camera.near = 0.02
	camera.far = 250.0
	camera.current = true
	head.add_child(camera)
	weapon = Weapon.new()
	camera.add_child(weapon)
	weapon.setup(self)
	sfx_step = Sfx.player("step", -10)
	add_child(sfx_step)
	sfx_hurt = Sfx.player("hurt", -4)
	add_child(sfx_hurt)

func respawn(at: Vector3, face_yaw: float) -> void:
	global_position = at
	velocity = Vector3.ZERO
	yaw = face_yaw
	pitch = 0.0
	health = 100.0
	alive = true
	recoil = Vector2.ZERO
	recoil_target = Vector2.ZERO
	shape.disabled = false
	weapon.reset()

func add_recoil(up: float, side: float) -> void:
	recoil_target += Vector2(side, up)

func take_damage(amount: float, from: Vector3) -> void:
	if not alive:
		return
	health -= amount
	last_hit_time = Time.get_ticks_msec() / 1000.0
	sfx_hurt.pitch_scale = randf_range(0.9, 1.1)
	sfx_hurt.play()
	damaged.emit(amount, from)
	if health <= 0:
		health = 0
		alive = false
		died.emit()

func _physics_process(delta: float) -> void:
	if not controls:
		return
	var now := Time.get_ticks_msec() / 1000.0
	if alive and now - last_hit_time > 4.0:
		health = minf(100.0, health + 30.0 * delta)

	# looking (recoil is a separate offset so the view settles back after firing)
	var sens_scale := 1.0
	if weapon.ads_amount > 0.5:
		sens_scale = 0.6
	yaw += controls.look.x * sens_scale
	pitch = clampf(pitch + controls.look.y * sens_scale, -86.0, 86.0)
	recoil = recoil.lerp(recoil_target, minf(1.0, delta * 24.0))
	recoil_target = recoil_target.lerp(Vector2.ZERO, minf(1.0, delta * (6.0 if not controls.fire else 2.2)))
	rotation_degrees.y = yaw + recoil.x
	head.rotation_degrees.x = clampf(pitch + recoil.y, -88.0, 88.0)
	weapon.look_delta = controls.look * sens_scale

	if not alive:
		velocity.x = move_toward(velocity.x, 0, 20 * delta)
		velocity.z = move_toward(velocity.z, 0, 20 * delta)
		velocity.y -= GRAVITY * delta
		move_and_slide()
		eye = lerpf(eye, 0.3, delta * 4.0)
		head.position.y = eye
		tilt = lerpf(tilt, 30.0, delta * 3.0)
		camera.rotation_degrees.z = tilt
		controls.consume()
		return

	var on_floor := is_on_floor()
	var input := controls.move
	var wish := (transform.basis * Vector3(input.x, 0, -input.y))
	wish.y = 0
	var sprinting := controls.sprint and input.y > 0.2 and not crouching and weapon.ads_amount < 0.3 and not weapon.is_firing_recently()

	# crouch / slide
	if controls.crouch_pressed:
		if sprinting and on_floor and not sliding:
			sliding = true
			slide_time = 0.75
			slide_dir = wish.normalized() if wish.length() > 0.1 else -transform.basis.z
			velocity = slide_dir * 10.5 + Vector3(0, velocity.y, 0)
			crouching = true
			fov_kick = 6.0
		else:
			crouching = not crouching
	if controls.crouch_held and not crouching:
		crouching = true
	if crouching and controls.jump_pressed:
		crouching = false
		controls.jump_pressed = false if not sliding else controls.jump_pressed
	if crouching and sprinting and not sliding:
		crouching = false

	var speed := WALK
	if sprinting:
		speed = SPRINT
	if crouching:
		speed = CROUCH
	if weapon.ads_amount > 0.5:
		speed = minf(speed, ADS_SPEED)

	if sliding:
		slide_time -= delta
		var hv := Vector3(velocity.x, 0, velocity.z).move_toward(Vector3.ZERO, 9.0 * delta)
		velocity.x = hv.x
		velocity.z = hv.z
		if slide_time <= 0 or hv.length() < 3.0 or not on_floor:
			sliding = false
	else:
		var target := wish * speed
		var accel := 60.0 if on_floor else 9.0
		if wish.length() < 0.05 and on_floor:
			accel = 40.0
		var hv := Vector3(velocity.x, 0, velocity.z).move_toward(target, accel * delta)
		velocity.x = hv.x
		velocity.z = hv.z

	if on_floor:
		if controls.jump_pressed:
			velocity.y = JUMP
			if sliding:
				sliding = false
				velocity += slide_dir * 1.5
			crouching = false
	else:
		velocity.y -= GRAVITY * delta

	move_and_slide()
	on_floor = is_on_floor()
	if on_floor and not was_on_floor:
		landing = 1.0
		weapon.kick_land()
		sfx_step.play()
	was_on_floor = on_floor

	# eye height, camera tilt, head bob, footsteps
	var target_eye := STAND_EYE
	if sliding:
		target_eye = SLIDE_EYE
	elif crouching:
		target_eye = CROUCH_EYE
	eye = lerpf(eye, target_eye, minf(1.0, delta * 12.0))
	landing = lerpf(landing, 0.0, delta * 8.0)
	var hspeed := Vector2(velocity.x, velocity.z).length()
	var bob := Vector2.ZERO
	if on_floor and hspeed > 0.5 and not sliding:
		var freq := 1.6 if hspeed < 5.5 else 2.2
		bob_time += delta * freq * TAU * 0.5 * (hspeed / maxf(speed, 0.1)) * 1.6
		var amp := 0.035 if hspeed < 5.5 else 0.06
		if weapon.ads_amount > 0.5:
			amp *= 0.25
		bob = Vector2(cos(bob_time) * amp * 0.6, abs(sin(bob_time)) * amp)
		step_accum += hspeed * delta
		var stride := 2.0 if hspeed < 5.5 else 2.6
		if step_accum > stride:
			step_accum = 0
			sfx_step.pitch_scale = randf_range(0.85, 1.15)
			sfx_step.volume_db = -10 if not crouching else -20
			sfx_step.play()
	else:
		bob_time = lerpf(bob_time, round(bob_time / PI) * PI, delta * 4.0)
	head.position = Vector3(bob.x, eye - bob.y - landing * 0.08, 0)
	var strafe := -input.x * 1.2
	var target_tilt := strafe + (-6.0 if sliding else 0.0)
	tilt = lerpf(tilt, target_tilt, minf(1.0, delta * 8.0))
	camera.rotation_degrees.z = tilt

	fov_kick = lerpf(fov_kick, 0.0, delta * 3.0)
	var fov := BASE_FOV + (6.0 if sprinting else 0.0) + fov_kick
	fov = lerpf(fov, weapon.ads_fov, weapon.ads_amount)
	camera.fov = lerpf(camera.fov, fov, minf(1.0, delta * 14.0))

	weapon.move_state(hspeed, sprinting and hspeed > 4.0, on_floor, sliding, crouching, bob_time)
	weapon.tick(delta)
	controls.consume()
