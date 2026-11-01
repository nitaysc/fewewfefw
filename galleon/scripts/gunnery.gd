extends Node3D
## Great guns: broadsides, round shot in flight, and everything they do.
## Shot flies with gravity and air drag, can skip off the sea at a shallow angle
## (gunners used this on purpose), splashes, or smashes into a hull (splinters,
## a hole, a leak below the waterline). Every gun fires a cloud of powder smoke
## that hangs and drifts down the wind, and you hear distant guns late, at the
## speed of sound.

const ShipScript := preload("res://scripts/ship.gd")

const V0 := 300.0 ## muzzle velocity, m/s (a reduced charge for a 24-pounder)
const SHOT_MASS := 11.0 ## kg
const DRAG_K := 4.5e-4 ## 0.5 * rho * Cd * A / m, per metre
const GRAVITY := 9.81
const SOUND_SPEED := 343.0
const MAX_DECALS := 30

signal hit(ship, below_waterline: bool)
signal splashed(pos: Vector3, size: float)

var ships: Array = [] ## everything that can be hit
var terrain = null
var listener := Vector3.ZERO ## where the camera is, for sound delay
var balls: Array = [] ## {p, v, owner, node, age, bounces}
var pending: Array = [] ## guns about to go off in a rippling broadside
var sounds: Array = [] ## {t, stream, pos, db}

var _smoke: Array = []
var _flash: Array = []
var _lights: Array = []
var _splash: Array = []
var _splinters: Array = []
var _players: Array = []
var _next := {}
var _ball_mesh: Mesh
var _hole_tex: Texture2D
var _snd := {}
var _time := 0.0


func _ready() -> void:
	var noise := NoiseTexture2D.new()
	noise.seamless = true
	noise.width = 256
	noise.height = 256
	var fnl := FastNoiseLite.new()
	fnl.frequency = 0.02
	fnl.fractal_octaves = 4
	noise.noise = fnl
	var smoke_shader: Shader = load("res://shaders/smoke.gdshader")
	var wind: Vector3 = Waves.wind()
	for i in 18:
		var p := _emitter(26, 9.0, 0.92)
		var m: ParticleProcessMaterial = p.process_material
		m.spread = 16.0
		m.initial_velocity_min = 8.0
		m.initial_velocity_max = 26.0
		m.damping_min = 9.0
		m.damping_max = 16.0
		m.gravity = Vector3.ZERO
		m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
		m.emission_sphere_radius = 0.6
		m.angle_min = -180.0
		m.angle_max = 180.0
		m.scale_min = 2.2
		m.scale_max = 3.6
		m.scale_curve = _curve([Vector2(0, 0.6), Vector2(0.25, 1.6), Vector2(1, 3.4)])
		var q := QuadMesh.new()
		var sm := ShaderMaterial.new()
		sm.shader = smoke_shader
		sm.set_shader_parameter("noise_tex", noise)
		sm.set_shader_parameter("drift", wind * 0.55)
		sm.set_shader_parameter("lifetime", p.lifetime)
		q.material = sm
		p.draw_pass_1 = q
		_smoke.append(p)

	var flash_shader: Shader = load("res://shaders/muzzle_flash.gdshader")
	for i in 12:
		var p := _emitter(6, 0.14, 1.0)
		var m: ParticleProcessMaterial = p.process_material
		m.spread = 10.0
		m.initial_velocity_min = 10.0
		m.initial_velocity_max = 30.0
		m.gravity = Vector3.ZERO
		m.scale_min = 1.2
		m.scale_max = 2.6
		var q := QuadMesh.new()
		var fm := ShaderMaterial.new()
		fm.shader = flash_shader
		q.material = fm
		p.draw_pass_1 = q
		_flash.append(p)
	for i in 3:
		var l := OmniLight3D.new()
		l.light_color = Color(1.0, 0.62, 0.3)
		l.omni_range = 30.0
		l.light_energy = 0.0
		l.shadow_enabled = false
		add_child(l)
		_lights.append(l)

	# splashes: a column of water thrown up and falling back, with drifting mist
	var drop_shader: Shader = load("res://shaders/spray_droplet.gdshader")
	var mist_shader: Shader = load("res://shaders/bow_spray.gdshader")
	var spray_tex: Texture2D = load("res://ocean_fft/sea_spray.png")
	for i in 10:
		var col := _emitter(90, 2.6, 0.97)
		col.transform_align = GPUParticles3D.TRANSFORM_ALIGN_Z_BILLBOARD_Y_TO_VELOCITY
		var m: ParticleProcessMaterial = col.process_material
		m.direction = Vector3.UP
		m.spread = 9.0
		m.initial_velocity_min = 4.0
		m.initial_velocity_max = 15.0
		m.gravity = Vector3(0, -9.8, 0)
		m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
		m.emission_sphere_radius = 0.5
		m.scale_min = 0.8
		m.scale_max = 2.2
		var q := QuadMesh.new()
		q.size = Vector2(0.18, 0.9)
		var dm := ShaderMaterial.new()
		dm.shader = drop_shader
		q.material = dm
		col.draw_pass_1 = q
		var mist := _emitter(16, 3.2, 0.9)
		var mm: ParticleProcessMaterial = mist.process_material
		mm.direction = Vector3.UP
		mm.spread = 25.0
		mm.initial_velocity_min = 2.0
		mm.initial_velocity_max = 9.0
		mm.gravity = Vector3(0, -2.5, 0)
		mm.damping_min = 1.0
		mm.damping_max = 2.5
		mm.scale_min = 2.5
		mm.scale_max = 5.0
		mm.angle_min = -180.0
		mm.angle_max = 180.0
		mm.scale_curve = _curve([Vector2(0, 0.5), Vector2(1, 1.8)])
		var mq := QuadMesh.new()
		var mmat := ShaderMaterial.new()
		mmat.shader = mist_shader
		mmat.set_shader_parameter("albedo_texture", spray_tex)
		mmat.set_shader_parameter("dissolve_texture", noise)
		mmat.set_shader_parameter("max_alpha", 0.45)
		mq.material = mmat
		mist.draw_pass_1 = mq
		_splash.append([col, mist])

	# splinters: the real killer in a sea fight
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.42, 0.3, 0.19)
	wood.roughness = 0.9
	for i in 6:
		var p := _emitter(50, 2.8, 1.0)
		p.transform_align = GPUParticles3D.TRANSFORM_ALIGN_Z_BILLBOARD_Y_TO_VELOCITY
		p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var m: ParticleProcessMaterial = p.process_material
		m.spread = 55.0
		m.initial_velocity_min = 5.0
		m.initial_velocity_max = 19.0
		m.gravity = Vector3(0, -9.8, 0)
		m.scale_min = 0.4
		m.scale_max = 1.6
		var bm := BoxMesh.new()
		bm.size = Vector3(0.06, 0.45, 0.06)
		bm.material = wood
		p.draw_pass_1 = bm
		_splinters.append(p)

	var sphere := SphereMesh.new()
	sphere.radius = 0.09
	sphere.height = 0.18
	sphere.radial_segments = 8
	sphere.rings = 4
	var iron := StandardMaterial3D.new()
	iron.albedo_color = Color(0.05, 0.05, 0.05)
	iron.roughness = 0.45
	iron.metallic = 0.6
	sphere.material = iron
	_ball_mesh = sphere
	_hole_tex = _make_hole_texture()

	for k in ["cannon", "cannon_far", "splash", "impact"]:
		var path := "res://assets/audio/%s.wav" % k
		if ResourceLoader.exists(path):
			_snd[k] = load(path)
	for i in 14:
		var a := AudioStreamPlayer3D.new()
		a.unit_size = 40.0
		a.max_db = 6.0
		a.attenuation_model = AudioStreamPlayer3D.ATTENUATION_LOGARITHMIC
		a.doppler_tracking = AudioStreamPlayer3D.DOPPLER_TRACKING_DISABLED
		add_child(a)
		_players.append(a)


func _emitter(amount: int, life: float, explosive: float) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = amount
	p.lifetime = life
	p.one_shot = true
	p.explosiveness = explosive
	p.emitting = false
	p.local_coords = false
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.visibility_aabb = AABB(Vector3(-80, -20, -80), Vector3(160, 80, 160))
	p.process_material = ParticleProcessMaterial.new()
	add_child(p)
	return p


func _curve(points: Array) -> CurveTexture:
	var c := Curve.new()
	c.max_value = 4.0
	for pt in points:
		c.add_point(pt)
	var t := CurveTexture.new()
	t.curve = c
	return t


func _pool(list: Array, key: String):
	var i: int = _next.get(key, 0)
	_next[key] = (i + 1) % list.size()
	return list[i]


func _burst(p: GPUParticles3D, at: Vector3, dir := Vector3.UP) -> void:
	p.global_position = at
	(p.process_material as ParticleProcessMaterial).direction = dir
	p.restart()
	p.emitting = true


## A ragged, splintered shot hole for the hull decals.
func _make_hole_texture() -> Texture2D:
	var n := 64
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var spikes := []
	for i in 14:
		spikes.append(rng.randf_range(0.75, 1.35))
	for y in n:
		for x in n:
			var c := Vector2(x + 0.5, y + 0.5) / n * 2.0 - Vector2.ONE
			var ang := atan2(c.y, c.x)
			var k := (ang / TAU + 0.5) * spikes.size()
			var i0 := int(k) % spikes.size()
			var i1 := (i0 + 1) % spikes.size()
			var rr := lerpf(spikes[i0], spikes[i1], k - floorf(k))
			var d := c.length() / rr
			var hole := 1.0 - smoothstep(0.32, 0.4, d)
			var burn := 1.0 - smoothstep(0.4, 0.95, d)
			var col := Color(0.02, 0.015, 0.01).lerp(Color(0.16, 0.1, 0.06), 1.0 - hole)
			img.set_pixel(x, y, Color(col.r, col.g, col.b, maxf(hole, burn * 0.85)))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


# ------------------------------------------------------------------ ballistics
## Horizontal range of a shot fired at this elevation from 2 m above the sea.
static func range_at(elev: float) -> float:
	var p := Vector2(0.0, 2.0)
	var v := Vector2(cos(elev), sin(elev)) * V0
	var h := 1.0 / 60.0
	for i in 900:
		var sp := v.length()
		v += (Vector2(0.0, -GRAVITY) - v * sp * DRAG_K) * h
		p += v * h
		if p.y < 0.0:
			return p.x
	return p.x


## How to lay one side's guns on a target: [elevation, train], or [] if it doesn't bear.
static func lay(ship, side: float, target_pos: Vector3, arc := deg_to_rad(15.0)) -> Array:
	var to: Vector3 = target_pos - ship.position
	to.y = 0.0
	var rel := wrapf(atan2(to.x, to.z) - ship.heading(), -PI, PI) # +90° = port beam
	if signf(rel) != side:
		return []
	var off := absf(rel) - PI * 0.5 # + = abaft the beam
	if absf(off) > arc:
		return []
	return [aim_elevation(to.length()), -off]


## Elevation (rad) that drops a shot at this range, or the highest the guns go.
static func aim_elevation(dist: float) -> float:
	var lo := -0.03
	var hi := 0.2
	if range_at(hi) < dist:
		return hi
	for i in 22:
		var mid := (lo + hi) * 0.5
		if range_at(mid) < dist:
			lo = mid
		else:
			hi = mid
	return (lo + hi) * 0.5


const MAX_TRAIN := deg_to_rad(12.0) ## how far the crews can lever the guns fore and aft


## Fire one side: +1 = port, -1 = starboard. The guns ripple from bow to stern.
## train: radians the guns are levered toward the bow (+) or stern (-) of the beam.
func fire(ship, side: float, elevation: float, train := 0.0) -> bool:
	var k := 0 if side > 0.0 else 1
	if ship.reload[k] > 0.0 or ship.sinking:
		return false
	ship.reload[k] = ship.RELOAD_TIME
	var mz: Array = ShipScript.muzzles(side)
	var order := range(mz.size())
	order.reverse()
	var t := 0.0
	for i in order:
		pending.append({"t": _time + t, "ship": ship, "m": mz[i], "side": side, "elev": elevation, "train": clampf(train, -MAX_TRAIN, MAX_TRAIN)})
		t += randf_range(0.09, 0.22)
	return true


func _shoot(ship, m: Vector3, side: float, elev: float, train: float) -> void:
	var b: Basis = ship.transform.basis
	var at: Vector3 = ship.transform * m
	var spread := Vector2(randf_range(-1, 1), randf_range(-1, 1)) * deg_to_rad(0.7)
	var th := side * PI * 0.5 - side * train + spread.x
	var e := elev + spread.y
	var dl := Vector3(sin(th) * cos(e), sin(e), cos(th) * cos(e))
	var dir: Vector3 = (b * dl).normalized()
	var node := MeshInstance3D.new()
	node.mesh = _ball_mesh
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(node)
	node.global_position = at
	balls.append({"p": at, "v": ship.vel + dir * V0, "owner": ship, "node": node, "age": 0.0, "bounces": 0})
	ship.apply_impulse(at, -dir * SHOT_MASS * V0 * 3.0)
	_burst(_pool(_smoke, "smoke"), at + dir * 1.5, dir)
	_burst(_pool(_flash, "flash"), at + dir * 0.6, dir)
	var l: OmniLight3D = _pool(_lights, "light")
	l.global_position = at + dir * 2.0
	l.light_energy = 9.0
	_sound("cannon", at, 2.0)


func _sound(name: String, at: Vector3, db: float) -> void:
	if not _snd.has(name):
		return
	var d := at.distance_to(listener)
	var stream: AudioStream = _snd[name]
	if name == "cannon" and d > 350.0 and _snd.has("cannon_far"):
		stream = _snd["cannon_far"]
	sounds.append({"t": _time + d / SOUND_SPEED, "s": stream, "p": at, "db": db + randf_range(-1.5, 1.5)})


func _process(delta: float) -> void:
	var dt := minf(delta, 0.05)
	_time += dt
	for l in _lights:
		l.light_energy = maxf(0.0, l.light_energy - dt * 80.0)

	var i := 0
	while i < pending.size():
		var g: Dictionary = pending[i]
		if _time >= g.t:
			pending.remove_at(i)
			if is_instance_valid(g.ship) and not g.ship.sinking:
				_shoot(g.ship, g.m, g.side, g.elev, g.train)
		else:
			i += 1

	i = 0
	while i < sounds.size():
		var s: Dictionary = sounds[i]
		if _time >= s.t:
			sounds.remove_at(i)
			var a: AudioStreamPlayer3D = _pool(_players, "snd")
			a.stream = s.s
			a.global_position = s.p
			a.volume_db = s.db
			a.pitch_scale = randf_range(0.9, 1.08)
			a.play()
		else:
			i += 1

	i = 0
	while i < balls.size():
		if _fly(balls[i], dt):
			i += 1
		else:
			balls[i].node.queue_free()
			balls.remove_at(i)


## Advance one shot; false when it is spent.
func _fly(ball: Dictionary, dt: float) -> bool:
	ball.age += dt
	if ball.age > 9.0:
		return false
	var n := 6
	var h := dt / n
	for k in n:
		var v: Vector3 = ball.v
		var sp := v.length()
		ball.v = v + (Vector3(0.0, -GRAVITY, 0.0) - v * sp * DRAG_K) * h
		ball.p += ball.v * h
		var p: Vector3 = ball.p
		for s in ships:
			if s == ball.owner or not is_instance_valid(s) or p.distance_squared_to(s.position) > 900.0:
				continue
			if ShipScript.inside_hull(s.transform.affine_inverse() * p):
				_strike(s, ball)
				return false
		if terrain and terrain.height(p.x, p.z) > p.y:
			_splash_at(p, 0.7, true)
			return false
		var water: float = Waves.height_at(p.x, p.z)
		if p.y < water:
			var hv := Vector2(ball.v.x, ball.v.z).length()
			# a shallow, fast shot skips like a stone
			if ball.v.y > -0.13 * hv and hv > 90.0 and ball.bounces < 3:
				ball.bounces += 1
				ball.v = Vector3(ball.v.x * 0.62, -ball.v.y * 0.45 + 2.0, ball.v.z * 0.62)
				ball.p.y = water + 0.05
				_splash_at(Vector3(p.x, water, p.z), 0.55, false)
			else:
				_splash_at(Vector3(p.x, water, p.z), 1.0, false)
				return false
	var node: MeshInstance3D = ball.node
	var vel: Vector3 = ball.v
	node.global_position = ball.p
	# stretch along the flight path: the eye sees a fast shot as a short dark streak
	var stretch := clampf(vel.length() * dt / 0.18, 1.0, 40.0) * 0.6
	var fwd := vel.normalized()
	var up := Vector3.UP if absf(fwd.y) < 0.99 else Vector3.RIGHT
	var look := Basis.looking_at(fwd, up)
	node.global_transform = Transform3D(look * Basis.from_scale(Vector3(1, 1, stretch)), ball.p)
	return true


func _splash_at(p: Vector3, size: float, ground: bool) -> void:
	var pair: Array = _pool(_splash, "splash")
	var col: GPUParticles3D = pair[0]
	var mist: GPUParticles3D = pair[1]
	var m: ParticleProcessMaterial = col.process_material
	m.initial_velocity_max = 15.0 * size
	m.initial_velocity_min = 4.0 * size
	_burst(col, p)
	_burst(mist, p)
	if not ground:
		splashed.emit(p, size)
	_sound("splash", p, -4.0 + size * 4.0)


func _strike(s, ball: Dictionary) -> void:
	var p: Vector3 = ball.p
	var dir: Vector3 = ball.v.normalized()
	var below: bool = s.take_hit(p, dir, SHOT_MASS * ball.v.length())
	_burst(_pool(_splinters, "splinter"), p, -dir)
	var puff: GPUParticles3D = _pool(_smoke, "smoke")
	_burst(puff, p, -dir)
	_sound("impact", p, 4.0)
	_add_hole(s, p, dir)
	if below:
		_splash_at(Vector3(p.x, Waves.height_at(p.x, p.z), p.z), 0.6, false)
	hit.emit(s, below)


func _add_hole(s, p: Vector3, dir: Vector3) -> void:
	var holes: Array = s.get_meta("holes", [])
	if holes.size() >= MAX_DECALS:
		holes.pop_front().queue_free()
	var d := Decal.new()
	d.texture_albedo = _hole_tex
	d.size = Vector3(1.1, 1.6, 1.1)
	d.upper_fade = 0.2
	d.lower_fade = 0.2
	d.cull_mask = 1
	s.add_child(d)
	var local: Vector3 = s.transform.affine_inverse() * p
	var out := Vector3(signf(local.x), 0.0, 0.0)
	# a decal projects along its own -Y: point +Y out of the hull
	var x := Vector3(0, 0, 1)
	d.transform = Transform3D(Basis(x, out, x.cross(out)).orthonormalized().rotated(out, randf() * TAU), local)
	holes.append(d)
	s.set_meta("holes", holes)
