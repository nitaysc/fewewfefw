class_name Cinematic
extends Node3D
## Final Smash cutscene: the stage gives way to a swirling backdrop in the attacker's
## colour, the camera cuts between dramatic shots of the attacker and the caught fighters,
## and every hit lands with 3D bursts and slashes. Purely visual: the fight logic keeps
## running underneath (everyone else is frozen in hitlag meanwhile).

const PXU := 48.0
const LEN := 2.4   # seconds, matches the Final Smash's hit phase

var arena
var att: Fighter
var victims: Array = []
var t := 0.0
var active := false
var dome: MeshInstance3D
var dome_mat: StandardMaterial3D
var light: OmniLight3D
var bursts: Array = []   # {node, mat, t, life, grow}
var shot := -1
var shake := 0.0
static var _streaks: Texture2D


func setup(a) -> void:
	arena = a
	dome = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 40.0
	sm.height = 80.0
	sm.radial_segments = 32
	sm.rings = 16
	dome.mesh = sm
	dome_mat = StandardMaterial3D.new()
	dome_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dome_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	dome_mat.disable_fog = true
	dome_mat.albedo_texture = _streak_tex()
	dome_mat.uv1_scale = Vector3(3, 1, 1)
	dome.material_override = dome_mat
	dome.visible = false
	add_child(dome)
	light = OmniLight3D.new()
	light.omni_range = 9.0
	light.light_energy = 0.0
	add_child(light)


static func _streak_tex() -> Texture2D:
	if _streaks != null:
		return _streaks
	var w := 256
	var h := 128
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 9
	var cols := PackedFloat32Array()
	for x in w:
		cols.append(rng.randf())
	for y in h:
		var v := float(y) / h
		var base := 0.16 + 0.5 * pow(1.0 - absf(v - 0.5) * 2.0, 2.0)
		for x in w:
			var c := cols[x]
			var streak := 0.0
			if c > 0.82:
				streak = (c - 0.82) * 4.5 * (0.5 + 0.5 * sin(v * 9.0 + c * 40.0))
			var k := clampf(base + streak, 0.0, 1.0)
			img.set_pixel(x, y, Color(k, k, k))
	img.generate_mipmaps()
	_streaks = ImageTexture.create_from_image(img)
	return _streaks


static func w3(p: Vector2, z := 0.0) -> Vector3:
	return Vector3(p.x / PXU, -p.y / PXU, z)


func start(a: Fighter, vs: Array) -> void:
	att = a
	victims = vs.duplicate()
	t = 0.0
	shot = -1
	active = true
	var c: Color = a.data.accent
	dome_mat.albedo_color = Color(c.r * 0.9 + 0.1, c.g * 0.9 + 0.1, c.b * 0.9 + 0.15)
	dome.visible = true
	light.light_color = c
	_set_world_visible(false)
	if arena.hud:
		arena.hud.cine_title(a)


func stop() -> void:
	if not active:
		return
	active = false
	dome.visible = false
	light.light_energy = 0.0
	for b in bursts:
		(b.node as Node3D).queue_free()
	bursts.clear()
	_set_world_visible(true)


func _set_world_visible(v: bool) -> void:
	# the 2D layers (backdrop, stage art, effects) and the 3D stage step aside
	for n in [arena.bg_layer, arena.stage_layer]:
		if n:
			n.visible = v
	if arena.world:
		arena.world.visible = v
	if arena.stage3d:
		arena.stage3d.visible = v
	if arena.pad:
		arena.pad.visible = v
	for f in arena.fighters:
		if f.view3d and f != att and not victims.has(f):
			f.view3d.cine_hidden = not v


## A hit lands on `v`: flash, burst and slash at the victim, in 3D.
func hit(v: Fighter) -> void:
	if not active:
		return
	var p := w3(v.core_world(), 0.2) + Vector3(randf_range(-0.3, 0.3), randf_range(-0.3, 0.4), randf_range(-0.2, 0.3))
	var c: Color = att.data.accent
	_burst(p, Color(1, 1, 1), 0.55, 0.12, 0.0)
	_burst(p, c, 1.05, 0.2, 0.0)
	_slash(p, c)
	shake = 0.12
	light.position = p + Vector3(0, 0, 1.2)
	light.light_energy = 6.0


func _burst(p: Vector3, c: Color, size: float, life: float, _x: float) -> void:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 0.5
	s.height = 1.0
	s.radial_segments = 12
	s.rings = 6
	mi.mesh = s
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.disable_fog = true
	m.albedo_color = c
	mi.material_override = m
	mi.position = p
	mi.scale = Vector3.ONE * 0.1
	add_child(mi)
	bursts.append({"node": mi, "mat": m, "t": 0.0, "life": life, "grow": size, "c": c})


func _slash(p: Vector3, c: Color) -> void:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = Vector3(3.2, 0.07, 0.07)
	mi.mesh = b
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.disable_fog = true
	m.albedo_color = c.lightened(0.4)
	mi.material_override = m
	mi.position = p
	mi.rotation = Vector3(randf_range(-0.6, 0.6), randf_range(-0.6, 0.6), randf_range(-PI, PI))
	add_child(mi)
	bursts.append({"node": mi, "mat": m, "t": 0.0, "life": 0.18, "grow": -1.0, "c": c.lightened(0.4)})


## Drives the camera while the cutscene runs. Returns false when it isn't running.
func update(delta: float, cam: Camera3D) -> bool:
	if not active:
		return false
	t += delta
	dome.position = w3(att.core_world())
	dome.rotate_y(delta * 0.5)
	light.light_energy = move_toward(light.light_energy, 1.2, delta * 30.0)
	shake = maxf(0.0, shake - delta)
	for b in bursts:
		b.t += delta
		var u: float = b.t / b.life
		var n: Node3D = b.node
		if b.grow > 0.0:
			n.scale = Vector3.ONE * lerpf(0.1, b.grow, 1.0 - pow(1.0 - minf(u, 1.0), 3.0))
		else:
			n.scale = Vector3(lerpf(0.2, 1.0, minf(u * 3.0, 1.0)), 1.0, 1.0)
		var c: Color = b.c
		(b.mat as StandardMaterial3D).albedo_color = Color(c.r, c.g, c.b, clampf(1.0 - u, 0.0, 1.0))
	while bursts.size() > 0 and bursts[0].t > bursts[0].life:
		(bursts[0].node as Node3D).queue_free()
		bursts.pop_front()
	# shots
	var a3 := w3(att.core_world())
	var vc := Vector3.ZERO
	var nv := 0
	for v in victims:
		if is_instance_valid(v) and v.alive():
			vc += w3(v.core_world())
			nv += 1
	vc = vc / nv if nv > 0 else a3 + Vector3(att.facing * 2.0, 0, 0)
	var side := signf(vc.x - a3.x) if absf(vc.x - a3.x) > 0.1 else att.facing
	var mid := (a3 + vc) * 0.5
	var spread := maxf(2.5, a3.distance_to(vc) + 1.5)
	var pos: Vector3
	var look: Vector3
	var fov := 40.0
	if t < 0.6:
		# 1: low close-up on the attacker, pushing in
		var u := t / 0.6
		pos = a3 + Vector3(side * 1.5, -0.3 + u * 0.15, 3.2 - u * 0.7)
		look = a3 + Vector3(0, 0.35, 0)
		fov = 34.0
	elif t < 1.35:
		# 2: sweeping wide shot round both of them
		var u := (t - 0.6) / 0.75
		var ang := lerpf(-0.75, 0.55, u) * side
		pos = mid + Vector3(sin(ang) * spread * 0.95, 0.7, cos(ang) * spread * 0.95)
		look = mid + Vector3(0, 0.2, 0)
		fov = 45.0
	elif t < 2.0:
		# 3: over the attacker's shoulder onto the victims
		var u := (t - 1.35) / 0.65
		pos = a3 + Vector3(-side * 1.1, 1.0 - u * 0.2, 1.8)
		look = vc + Vector3(0, 0.2, 0)
		fov = 38.0 - u * 6.0
	else:
		# 4: fast pull-back for the finisher
		var u := minf((t - 2.0) / 0.4, 1.0)
		pos = mid + Vector3(0, 0.5 + u * 0.8, 3.0 + u * u * 5.0)
		look = mid
		fov = 40.0 + u * 10.0
	var sh := Vector3(randf_range(-1, 1), randf_range(-1, 1), 0) * shake * 0.6
	cam.position = pos + sh
	cam.fov = fov
	cam.look_at(look + sh * 0.5)
	var s := 0 if t < 0.6 else (1 if t < 1.35 else (2 if t < 2.0 else 3))
	if s != shot:
		shot = s
		if arena.hud:
			arena.hud.flash(0.25 if s > 0 else 0.0)
	return true
