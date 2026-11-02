extends Node3D
## Look-development preview for 3D fighters. Args: out_dir style(ink|vinyl)
var out := "/tmp/look"
var style := "ink"
var n := 0
var cam: Camera3D
var shots := ["lineup", "action", "closeup"]
var shot_i := 0
var root3: Node3D


func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	if a.size() > 0: out = a[0]
	if a.size() > 1: style = a[1]
	DirAccess.make_dir_recursive_absolute(out)
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.03, 0.02, 0.1)
	sm.sky_horizon_color = Color(0.55, 0.16, 0.38)
	sm.ground_horizon_color = Color(0.3, 0.08, 0.2)
	sm.sky_curve = 0.08
	sm.ground_bottom_color = Color(0.03, 0.02, 0.06)
	sm.sun_angle_max = 20.0
	sky.sky_material = sm
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.4
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.05
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.02
	env.glow_hdr_threshold = 0.9
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SCREEN
	env.fog_enabled = false
	env.fog_light_color = Color(0.55, 0.2, 0.4)
	env.fog_density = 0.012
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-38, -35, 0)
	key.light_color = Color(1.0, 0.86, 0.76)
	key.light_energy = 1.6
	key.shadow_enabled = true
	add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-15, 160, 0)
	rim.light_color = Color(0.45, 0.65, 1.0)
	rim.light_energy = 2.2
	add_child(rim)
	var fill := OmniLight3D.new()
	fill.position = Vector3(0, 2.5, 6)
	fill.light_color = Color(1.0, 0.45, 0.8)
	fill.light_energy = 0.8
	fill.omni_range = 14
	add_child(fill)

	_stage()
	root3 = Node3D.new()
	add_child(root3)
	cam = Camera3D.new()
	cam.fov = 30
	add_child(cam)
	_setup_shot()


func _mat(c: Color, rough := 0.5, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m


func _box(size: Vector3, pos: Vector3, m: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = pos
	mi.material_override = m
	add_child(mi)
	return mi


func _stage() -> void:
	# rooftop slab with a neon trim
	_box(Vector3(18.5, 0.5, 4.0), Vector3(0, -0.25, 0), _mat(Color(0.16, 0.14, 0.22), 0.55, 0.3))
	_box(Vector3(18.5, 0.06, 4.0), Vector3(0, 0.0, 0), _mat(Color(0.12, 0.11, 0.16), 0.75, 0.2))
	_box(Vector3(18.5, 0.07, 0.07), Vector3(0, -0.12, 2.02), _mat(Color(1.0, 0.25, 0.85), 0.3, 0.0, 3.0))
	_box(Vector3(17.5, 12, 3.6), Vector3(0, -6.5, -0.1), _mat(Color(0.06, 0.05, 0.11), 0.8))
	var win_on := _mat(Color(1.0, 0.75, 0.45), 0.5, 0.0, 1.6)
	var win_cy := _mat(Color(0.4, 0.9, 1.0), 0.5, 0.0, 1.6)
	var rng := RandomNumberGenerator.new()
	rng.seed = 3
	for i in 70:
		var x := rng.randi_range(-8, 8) * 1.0
		var y := -rng.randi_range(1, 7) * 0.9 - 0.4
		_box(Vector3(0.45, 0.38, 0.05), Vector3(x, y, 1.72), win_on if rng.randf() < 0.75 else win_cy)
	# floating platforms
	for p in [Vector3(-4.5, 2.8, 0), Vector3(4.5, 2.8, 0)]:
		_box(Vector3(3.8, 0.22, 2.2), p, _mat(Color(0.22, 0.22, 0.3), 0.4, 0.6))
		_box(Vector3(3.8, 0.04, 0.05), p + Vector3(0, -0.12, 1.1), _mat(Color(0.3, 0.95, 1.0), 0.3, 0.0, 3.0))
	# skyline
	for i in 26:
		var w := rng.randf_range(1.2, 2.8)
		var h := rng.randf_range(4.0, 13.0)
		var x := -26.0 + i * 2.1
		var z := rng.randf_range(-22, -14)
		_box(Vector3(w, h, w), Vector3(x, h * 0.5 - 6.0, z), _mat(Color(0.05, 0.03, 0.1), 0.9))
		for k in 6:
			_box(Vector3(0.25, 0.2, 0.02), Vector3(x + rng.randf_range(-w * 0.35, w * 0.35), rng.randf_range(-5.0, h - 6.5), z + w * 0.5 + 0.02), win_on)
	var moon := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 3.0
	sm.height = 6.0
	moon.mesh = sm
	moon.position = Vector3(16, 9, -60)
	moon.material_override = _mat(Color(1.0, 0.85, 0.9), 0.5, 0.0, 2.2)
	add_child(moon)


func _fighter(idx: int, feet: Vector2, pose: PackedFloat32Array, facing: float) -> Fighter3D:
	var f := Fighter3D.new()
	f.build(idx, style)
	root3.add_child(f)
	f.apply(pose, facing, feet)
	return f


func _setup_shot() -> void:
	for c in root3.get_children():
		c.queue_free()
	match shots[shot_i]:
		"lineup":
			for i in 4:
				var p := Roster.pose("guard").duplicate()
				_fighter(i, Vector2(-270 + i * 180, 0), p, 1.0 if i < 2 else -1.0)
			cam.position = Vector3(0, 2.0, 11.0)
			cam.look_at(Vector3(0, 1.0, 0))
		"action":
			var p := Roster.sample(Roster.move("fsmash").anim, 12.5)
			_fighter(0, Vector2(-60, 0), p, 1.0)
			var hurt := Roster.pose("tumble").duplicate()
			hurt[Rig.ROT] = -0.6
			var b := _fighter(1, Vector2(95, -70), hurt, -1.0)
			_fighter(3, Vector2(-330, -150), Roster.sample(Roster.move("nair").anim, 9.0), 1.0)
			_fighter(2, Vector2(330, 0), Roster.sample(Roster.move("ftilt").anim, 4.0), -1.0)
			_impact(Vector3(0.95, 1.65, 0.35), Color(1.0, 0.35, 0.4))
			_trail(0)
			cam.position = Vector3(0.0, 2.2, 9.5)
			cam.look_at(Vector3(0, 1.2, 0))
		"closeup":
			var p := Roster.pose("guard").duplicate()
			_fighter(0, Vector2(-45, 0), p, 1.0)
			_fighter(3, Vector2(70, 0), Roster.pose("victory_sol"), -1.0)
			cam.position = Vector3(0.3, 1.5, 4.6)
			cam.look_at(Vector3(0.2, 1.05, 0))


func _impact(at: Vector3, col: Color) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := 12
	for i in pts * 2:
		var r0 := 0.75 if i % 2 == 0 else 0.22
		var r1 := 0.75 if (i + 1) % 2 == 0 else 0.22
		var a0 := i * PI / pts
		var a1 := (i + 1) * PI / pts
		st.set_color(Color(1, 1, 1))
		st.add_vertex(Vector3.ZERO)
		st.set_color(col)
		st.add_vertex(Vector3(cos(a0) * r0, sin(a0) * r0, 0))
		st.add_vertex(Vector3(cos(a1) * r1, sin(a1) * r1, 0))
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.albedo_color = Color(2.5, 2.5, 2.5)
	mi.material_override = m
	mi.position = at
	root3.add_child(mi)
	var l := OmniLight3D.new()
	l.position = at + Vector3(0, 0, 0.4)
	l.light_color = col
	l.light_energy = 6.0
	l.omni_range = 3.5
	root3.add_child(l)
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.95
	tm.outer_radius = 1.02
	ring.mesh = tm
	ring.rotation_degrees = Vector3(90, 0, 0)
	ring.position = at
	var rm := StandardMaterial3D.new()
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rm.albedo_color = Color(col.r * 2.0, col.g * 2.0, col.b * 2.0)
	ring.material_override = rm
	root3.add_child(ring)


func _trail(idx: int) -> void:
	# sword smear from the swing's previous frames
	var d: Dictionary = Roster.fighter(idx)
	var dims: Dictionary = d.dims.duplicate()
	dims.weapon = d.wlen
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	var j := PackedVector2Array()
	for k in 7:
		var f := 9.0 + k * 0.6
		var p := Roster.sample(Roster.move("fsmash").anim, f)
		Rig.solve(p, dims, 1.0, j)
		var root := Vector2(-60, -Rig.body_bottom(j, dims.head) - 1.5)
		var a := (j[Rig.J_HF] + root) * Fighter3D.PX
		var b := (j[Rig.J_WT] + root) * Fighter3D.PX
		var u := k / 6.0
		st.set_color(Color(1.0, 0.3, 0.4, 0.0))
		st.add_vertex(Vector3(a.x, -a.y, 0.26).lerp(Vector3(b.x, -b.y, 0.26), 0.3))
		st.set_color(Color(1.0, 0.8, 0.85, u * 0.9))
		st.add_vertex(Vector3(b.x, -b.y, 0.26))
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	root3.add_child(mi)


func _process(_d: float) -> void:
	n += 1
	if n == 6:
		get_viewport().get_texture().get_image().save_png("%s/%s_%s.png" % [out, style, shots[shot_i]])
		shot_i += 1
		n = 0
		if shot_i >= shots.size():
			get_tree().quit()
			return
		_setup_shot()
