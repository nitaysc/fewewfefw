extends Node3D
## Every fighter in every costume. Args: out_png
var n := 0
func _ready() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.22, 0.2, 0.28)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.85, 0.85, 0.95)
	env.ambient_light_energy = 0.7
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var l := DirectionalLight3D.new(); l.rotation_degrees = Vector3(-35, -25, 0); l.light_energy = 1.2; add_child(l)
	var ids: Array = FighterView3D.MODEL_DIRS.keys()
	for row in ids.size():
		var dir: String = FighterView3D.MODEL_DIRS[ids[row]]
		for k in Costume.count():
			var inst := (load("res://assets/meshy/%s/rigged.glb" % dir) as PackedScene).instantiate() as Node3D
			add_child(inst)
			inst.position = Vector3(-1.2 * 3.5 + k * 1.2, -row * 2.05 + 4.0, 0)
			for mi in inst.find_children("*", "MeshInstance3D", true, false):
				WeaponSkin.apply(dir, mi)
			Costume.apply(inst, k)
			var ap := AnimationPlayer.new()
			inst.add_child(ap)
			ap.add_animation_library("m", load("res://assets/meshy/%s/anims.res" % dir))
			ap.play("m/Combat_Stance")
			ap.seek(0.3, true)
			ap.pause()
	var cam := Camera3D.new(); cam.fov = 30; cam.position = Vector3(0, 0.8, 21.0); add_child(cam)
func _process(_d: float) -> void:
	n += 1
	if n == 8:
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
		get_tree().quit()
