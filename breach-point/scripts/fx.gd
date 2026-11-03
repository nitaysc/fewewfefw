class_name Fx
## Short-lived effects: bullet holes, sparks, dust, blood, tracers, shell casings,
## dropped magazines. Old ones are removed so the count stays bounded on phones.

const MAX_HOLES := 40
const MAX_SHELLS := 24

static var _flash_tex: ImageTexture
static var _hole_tex: ImageTexture
static var _holes: Array = []
static var _shells: Array = []

static func _scene(n: Node) -> Node:
	return n.get_tree().current_scene

static func flash_texture() -> ImageTexture:
	if _flash_tex:
		return _flash_tex
	var s := 64
	var img := Image.create(s, s, false, Image.FORMAT_RGBA8)
	for y in s:
		for x in s:
			var p := Vector2(x - s / 2.0 + 0.5, y - s / 2.0 + 0.5) / (s / 2.0)
			var r := p.length()
			var a := atan2(p.y, p.x)
			var spikes := pow(absf(cos(a * 3.0)), 8.0) * 0.6 + pow(absf(cos(a * 2.0 + 0.4)), 16.0) * 0.4
			var v := clampf(1.0 - r / (0.35 + spikes * 0.65), 0.0, 1.0)
			v = pow(v, 1.5)
			var core := clampf(1.0 - r / 0.25, 0.0, 1.0)
			img.set_pixel(x, y, Color(1.0, 0.8 + core * 0.2, 0.5 + core * 0.5, clampf(v + core, 0, 1)))
	_flash_tex = ImageTexture.create_from_image(img)
	return _flash_tex

static func _hole_texture() -> ImageTexture:
	if _hole_tex:
		return _hole_tex
	var s := 32
	var img := Image.create(s, s, false, Image.FORMAT_RGBA8)
	for y in s:
		for x in s:
			var r := Vector2(x - s / 2.0 + 0.5, y - s / 2.0 + 0.5).length() / (s / 2.0)
			var a := clampf(1.0 - pow(r, 1.6), 0.0, 1.0)
			var dark := 0.05 if r < 0.35 else 0.18
			img.set_pixel(x, y, Color(dark, dark, dark, a * (1.0 if r < 0.35 else 0.55)))
	_hole_tex = ImageTexture.create_from_image(img)
	return _hole_tex

static func _burst(n: Node, pos: Vector3, normal: Vector3, color: Color, amount: int, speed: float, size: float, life: float, gravity := 9.8, glow := false) -> void:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.emitting = false
	p.amount = amount
	p.lifetime = life
	p.explosiveness = 1.0
	p.direction = normal
	p.spread = 35.0
	p.initial_velocity_min = speed * 0.5
	p.initial_velocity_max = speed
	p.gravity = Vector3(0, -gravity, 0)
	p.scale_amount_min = 0.5
	p.scale_amount_max = 1.0
	var mesh := QuadMesh.new()
	mesh.size = Vector2(size, size)
	var m: StandardMaterial3D
	if glow:
		m = Mats.glow(color, 3.0)
	else:
		m = StandardMaterial3D.new()
		m.albedo_color = color
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	mesh.material = m
	p.mesh = mesh
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 1, 1, 1))
	grad.set_color(1, Color(1, 1, 1, 0))
	p.color_ramp = grad
	_scene(n).add_child(p)
	p.global_position = pos + normal * 0.02
	p.emitting = true
	p.finished.connect(p.queue_free)

static func impact(n: Node, pos: Vector3, normal: Vector3) -> void:
	_burst(n, pos, normal, Color(1.0, 0.7, 0.3), 6, 5.0, 0.025, 0.25, 12.0, true)
	_burst(n, pos, normal, Color(0.55, 0.52, 0.48, 0.7), 5, 1.2, 0.14, 0.6, 0.5)
	var hole := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.045, 0.045)
	hole.mesh = q
	var m := StandardMaterial3D.new()
	m.albedo_texture = _hole_texture()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = 1.0
	hole.material_override = m
	hole.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_scene(n).add_child(hole)
	var up := Vector3.UP if absf(normal.y) < 0.95 else Vector3.FORWARD
	hole.global_transform = Transform3D(Basis.looking_at(-normal, up), pos + normal * 0.004)
	hole.rotate_object_local(Vector3.FORWARD, randf() * TAU)
	_holes.append(hole)
	if _holes.size() > MAX_HOLES:
		var old = _holes.pop_front()
		if is_instance_valid(old):
			old.queue_free()
	Sfx.at(n, "impact", pos, -6.0, randf_range(0.8, 1.2))

static func blood(n: Node, pos: Vector3, normal: Vector3) -> void:
	_burst(n, pos, normal, Color(0.45, 0.02, 0.02, 0.9), 10, 2.5, 0.06, 0.4, 9.0)

static func tracer(n: Node, from: Vector3, to: Vector3) -> void:
	var length := from.distance_to(to)
	if length < 1.0:
		return
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	var seg := minf(length, 6.0)
	bm.size = Vector3(0.012, 0.012, seg)
	mi.mesh = bm
	var m := Mats.glow(Color(1.0, 0.8, 0.45), 5.0)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_scene(n).add_child(mi)
	var dir := (to - from).normalized()
	var up := Vector3.UP if absf(dir.y) < 0.95 else Vector3.RIGHT
	var start := from + dir * (seg * 0.5 + 0.5)
	mi.global_transform = Transform3D(Basis.looking_at(dir, up), start)
	var tw := mi.create_tween()
	var travel := maxf(length - seg - 0.5, 0.0)
	tw.tween_property(mi, "global_position", start + dir * travel, travel / 400.0 + 0.02)
	tw.tween_callback(mi.queue_free)

static func shell(n: Node, pos: Vector3, cam_basis: Basis, carrier_velocity: Vector3) -> void:
	var b := RigidBody3D.new()
	b.collision_layer = 0
	b.collision_mask = 1
	b.mass = 0.02
	var cs := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = 0.006
	shape.height = 0.04
	cs.shape = shape
	b.add_child(cs)
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.0045
	cm.bottom_radius = 0.0055
	cm.height = 0.039
	cm.radial_segments = 8
	mi.mesh = cm
	mi.material_override = _brass()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	b.add_child(mi)
	_scene(n).add_child(b)
	b.global_position = pos
	b.rotation = Vector3(randf() * TAU, randf() * TAU, 0)
	b.linear_velocity = carrier_velocity + cam_basis * Vector3(randf_range(2.2, 3.2), randf_range(1.6, 2.6), randf_range(0.2, 0.9))
	b.angular_velocity = Vector3(randf_range(-30, 30), randf_range(-30, 30), randf_range(-30, 30))
	_shells.append(b)
	if _shells.size() > MAX_SHELLS:
		var old = _shells.pop_front()
		if is_instance_valid(old):
			old.queue_free()
	var t := n.get_tree().create_timer(0.45)
	t.timeout.connect(func():
		if is_instance_valid(b):
			Sfx.at(b, "shell", b.global_position, -8.0, randf_range(0.9, 1.15)))
	n.get_tree().create_timer(4.0).timeout.connect(func():
		if is_instance_valid(b):
			b.queue_free())

static var _brass_mat: StandardMaterial3D
static func _brass() -> StandardMaterial3D:
	if not _brass_mat:
		_brass_mat = Mats.flat(Color(0.78, 0.58, 0.25), 0.3, 0.9)
	return _brass_mat

static func drop_mag(n: Node, xf: Transform3D, mesh: Mesh, mat: Material, carrier_velocity: Vector3) -> void:
	var b := RigidBody3D.new()
	b.collision_layer = 0
	b.collision_mask = 1
	b.mass = 0.4
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = Vector3(0.03, 0.17, 0.09)
	cs.shape = shape
	cs.position = Vector3(0, -0.08, -0.03)
	b.add_child(cs)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	b.add_child(mi)
	_scene(n).add_child(b)
	b.global_transform = xf
	b.linear_velocity = carrier_velocity + Vector3(0, -1.0, 0)
	b.angular_velocity = Vector3(randf_range(-3, 3), 0, randf_range(-3, 3))
	n.get_tree().create_timer(0.5).timeout.connect(func():
		if is_instance_valid(b):
			Sfx.at(b, "mag_drop", b.global_position, -4.0))
	n.get_tree().create_timer(8.0).timeout.connect(func():
		if is_instance_valid(b):
			b.queue_free())
