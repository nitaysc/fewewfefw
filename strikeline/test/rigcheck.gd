extends Node3D
## Renders one animation GLB at several moments side by side. Args: out_png glb_path turn
var n := 0
func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	var path: String = a[1]
	var turn := float(a[2]) if a.size() > 2 else 60.0
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.25, 0.22, 0.3)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.8, 0.8, 0.9)
	env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var l := DirectionalLight3D.new(); l.rotation_degrees = Vector3(-35, -30, 0); l.light_energy = 1.3; add_child(l)
	for k in 3:
		var inst := (load(path) as PackedScene).instantiate() as Node3D
		add_child(inst)
		inst.position = Vector3(-1.8 + k * 1.8, 0, 0)
		inst.rotation_degrees = Vector3(0, turn, 0)
		if a.size() > 3:
			for mi in inst.find_children("*", "MeshInstance3D", true, false):
				WeaponSkin.apply(a[3], mi)
		var ap := inst.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if ap and ap.get_animation_list().size() > 0:
			var an: String = ap.get_animation_list()[0]
			ap.play(an)
			ap.seek(ap.get_animation(an).length * (0.2 + k * 0.17), true)
			ap.pause()
	var cam := Camera3D.new(); cam.fov = 35; cam.position = Vector3(0, 1.1, 5.0); add_child(cam); cam.look_at(Vector3(0, 1.0, 0))
func _process(_d: float) -> void:
	n += 1
	if n == 6:
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
		get_tree().quit()
