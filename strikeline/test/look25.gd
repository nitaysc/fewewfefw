extends Node3D
## 2.5D look preview with the KayKit characters. Args: out_dir
var out := "/tmp/look25"
var n := 0
var cam: Camera3D
var shots := ["lineup", "action", "air", "closeup"]
var shot_i := 0
var root3: Node3D

const CHARS := {
	"kai": {"file": "Knight", "keep": ["1H_Sword"], "idle": "1H_Melee_Attack_Chop", "accent": Color(1.0, 0.2, 0.3)},
	"bruno": {"file": "Barbarian", "keep": [], "idle": "Unarmed_Idle", "accent": Color(1.0, 0.68, 0.12)},
	"nyx": {"file": "Rogue", "keep": ["Knife", "Knife_Offhand"], "idle": "Idle", "accent": Color(0.72, 0.38, 1.0)},
	"sol": {"file": "Mage", "keep": ["2H_Staff"], "idle": "2H_Melee_Idle", "accent": Color(0.2, 0.9, 1.0)},
}
const WEAPONS := ["1H_Sword", "1H_Sword_Offhand", "2H_Sword", "Badge_Shield", "Rectangle_Shield", "Round_Shield", "Spike_Shield",
	"1H_Axe", "1H_Axe_Offhand", "2H_Axe", "Barbarian_Round_Shield", "Mug", "Knife", "Knife_Offhand", "1H_Crossbow",
	"2H_Crossbow", "Throwable", "Spellbook", "Spellbook_open", "1H_Wand", "2H_Staff"]


func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	if a.size() > 0: out = a[0]
	DirAccess.make_dir_recursive_absolute(out)
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.04, 0.03, 0.14)
	sm.sky_horizon_color = Color(0.62, 0.22, 0.42)
	sm.ground_horizon_color = Color(0.35, 0.1, 0.25)
	sm.ground_bottom_color = Color(0.03, 0.02, 0.06)
	sm.sky_curve = 0.12
	sky.sky_material = sm
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.35
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.9
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_bloom = 0.02
	env.glow_hdr_threshold = 1.0
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-40, -30, 0)
	key.light_color = Color(1.0, 0.9, 0.82)
	key.light_energy = 1.05
	key.shadow_enabled = true
	add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-20, 155, 0)
	rim.light_color = Color(0.5, 0.7, 1.0)
	rim.light_energy = 1.1
	add_child(rim)
	_stage()
	root3 = Node3D.new()
	add_child(root3)
	cam = Camera3D.new()
	cam.fov = 32
	add_child(cam)
	_setup_shot()


func _mat(c: Color, rough := 0.6, metal := 0.0, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m


func _box(size: Vector3, pos: Vector3, m: Material) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = pos
	mi.material_override = m
	add_child(mi)


func _stage() -> void:
	_box(Vector3(20, 0.6, 5), Vector3(0, -0.3, 0), _mat(Color(0.1, 0.09, 0.15), 0.8, 0.2))
	_box(Vector3(20, 0.05, 5), Vector3(0, 0.0, 0), _mat(Color(0.12, 0.11, 0.17), 0.9, 0.05))
	_box(Vector3(20, 0.08, 0.08), Vector3(0, -0.15, 2.52), _mat(Color(1.0, 0.25, 0.85), 0.3, 0.0, 3.0))
	_box(Vector3(19, 14, 4.6), Vector3(0, -7.6, -0.2), _mat(Color(0.08, 0.06, 0.13), 0.9))
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var win_on := _mat(Color(1.0, 0.75, 0.45), 0.5, 0.0, 1.4)
	var win_cy := _mat(Color(0.4, 0.9, 1.0), 0.5, 0.0, 1.4)
	for i in 60:
		_box(Vector3(0.5, 0.42, 0.05), Vector3(rng.randi_range(-9, 9), -rng.randi_range(1, 7) * 1.0 - 0.5, 2.12), win_on if rng.randf() < 0.75 else win_cy)
	for p in [Vector3(-5, 3.2, 0), Vector3(5, 3.2, 0)]:
		_box(Vector3(4.0, 0.25, 2.4), p, _mat(Color(0.25, 0.25, 0.34), 0.5, 0.5))
		_box(Vector3(4.0, 0.05, 0.05), p + Vector3(0, -0.13, 1.22), _mat(Color(0.3, 0.95, 1.0), 0.3, 0.0, 3.0))
	for i in 28:
		var w := rng.randf_range(1.5, 3.2)
		var h := rng.randf_range(6.0, 16.0)
		var x := -30.0 + i * 2.3
		var z := rng.randf_range(-26, -16)
		_box(Vector3(w, h, w), Vector3(x, h * 0.5 - 7.0, z), _mat(Color(0.07, 0.04, 0.13), 0.9))
		for k in 7:
			_box(Vector3(0.3, 0.24, 0.02), Vector3(x + rng.randf_range(-w * 0.35, w * 0.35), rng.randf_range(-6.0, h - 7.5), z + w * 0.5 + 0.02), win_on)
	var moon := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 3.5
	sm.height = 7.0
	moon.mesh = sm
	moon.position = Vector3(18, 12, -70)
	moon.material_override = _mat(Color(1.0, 0.86, 0.92), 0.5, 0.0, 2.0)
	add_child(moon)


func _char(id: String, x: float, y: float, facing: float, anim: String, t: float, turn := 70.0) -> Node3D:
	var c: Dictionary = CHARS[id]
	var scene: PackedScene = load("res://assets/characters/%s.glb" % c.file)
	var inst := scene.instantiate() as Node3D
	root3.add_child(inst)
	inst.position = Vector3(x, y, 0)
	inst.rotation_degrees = Vector3(0, turn * facing, 0)
	for w in WEAPONS:
		var node := inst.find_child(w, true, false)
		if node != null:
			node.visible = (c.keep as Array).has(w)
	var ap := inst.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if ap != null and ap.has_animation(anim):
		ap.play(anim)
		ap.seek(t, true)
		ap.pause()
	# accent rim light that follows the fighter, Smash-style character lighting
	var l := OmniLight3D.new()
	l.light_color = c.accent
	l.light_energy = 1.3
	l.omni_range = 2.4
	l.position = Vector3(-facing * 0.9, 1.8, -1.0)
	inst.add_child(l)
	return inst


func _setup_shot() -> void:
	for ch in root3.get_children():
		ch.queue_free()
	match shots[shot_i]:
		"lineup":
			_char("kai", -4.2, 0, 1.0, "2H_Melee_Idle", 0.3)
			_char("bruno", -1.4, 0, 1.0, "Unarmed_Idle", 0.3)
			_char("nyx", 1.4, 0, -1.0, "Dualwield_Melee_Attack_Stab", 0.05)
			_char("sol", 4.2, 0, -1.0, "2H_Melee_Idle", 0.6)
			cam.position = Vector3(0, 2.4, 13)
			cam.look_at(Vector3(0, 1.2, 0))
		"action":
			_char("kai", -1.3, 0, 1.0, "1H_Melee_Attack_Slice_Horizontal", 0.42)
			_char("bruno", 0.6, 0.15, -1.0, "Hit_A", 0.15)
			_char("sol", 4.0, 0, -1.0, "Spellcast_Shoot", 0.35)
			_char("nyx", -4.6, 1.4, 1.0, "Jump_Idle", 0.2)
			_impact(Vector3(0.1, 1.3, 0.5), Color(1.0, 0.35, 0.4))
			_orb(Vector3(2.8, 1.4, 0.4), Color(0.2, 0.9, 1.0))
			cam.position = Vector3(0, 2.2, 10.5)
			cam.look_at(Vector3(0, 1.3, 0))
		"air":
			_char("nyx", -1.5, 1.8, 1.0, "Unarmed_Melee_Attack_Kick", 0.35)
			_char("kai", 0.4, 2.0, -1.0, "Hit_B", 0.2)
			_char("bruno", 3.2, 0, -1.0, "Unarmed_Melee_Attack_Punch_A", 0.3)
			_char("sol", -4.5, 0, 1.0, "Spellcasting", 0.3)
			_impact(Vector3(-0.5, 2.9, 0.5), Color(0.75, 0.4, 1.0))
			cam.position = Vector3(0, 2.6, 11)
			cam.look_at(Vector3(0, 1.7, 0))
		"closeup":
			_char("kai", -0.75, 0, 1.0, "2H_Melee_Idle", 0.2, 55.0)
			_char("sol", 0.85, 0, -1.0, "Cheer", 0.5, 55.0)
			cam.position = Vector3(0, 1.6, 5.2)
			cam.look_at(Vector3(0, 1.15, 0))


func _impact(at: Vector3, col: Color) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := 12
	for i in pts * 2:
		var r0 := 0.8 if i % 2 == 0 else 0.22
		var r1 := 0.8 if (i + 1) % 2 == 0 else 0.22
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
	m.albedo_color = Color(2.2, 2.2, 2.2)
	mi.material_override = m
	mi.position = at
	root3.add_child(mi)
	var l := OmniLight3D.new()
	l.position = at + Vector3(0, 0, 0.6)
	l.light_color = col
	l.light_energy = 2.5
	l.omni_range = 3.0
	root3.add_child(l)
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 1.0
	tm.outer_radius = 1.06
	ring.mesh = tm
	ring.rotation_degrees = Vector3(90, 0, 0)
	ring.position = at
	ring.material_override = _mat(col, 0.5, 0.0, 3.0)
	root3.add_child(ring)


func _orb(at: Vector3, col: Color) -> void:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.28
	sm.height = 0.56
	mi.mesh = sm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(col.r * 2.5, col.g * 2.5, col.b * 2.5)
	mi.material_override = m
	mi.position = at
	root3.add_child(mi)
	var l := OmniLight3D.new()
	l.position = at
	l.light_color = col
	l.light_energy = 4.0
	l.omni_range = 3.0
	root3.add_child(l)


func _process(_d: float) -> void:
	n += 1
	if n == 8:
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [out, shots[shot_i]])
		shot_i += 1
		n = 0
		if shot_i >= shots.size():
			get_tree().quit()
			return
		_setup_shot()
