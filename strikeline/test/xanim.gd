extends Node3D
## Plays one rig's clips on another model. Args: out_png model_dir anim_dir clip@frac,...
var n := 0
func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.25, 0.22, 0.3)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.85, 0.85, 0.95)
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var l := DirectionalLight3D.new(); l.rotation_degrees = Vector3(-35, -30, 0); add_child(l)
	var clips: PackedStringArray = a[3].split(",")
	for row in 2:
		var src: String = a[2] if row == 0 else a[1]
		for k in clips.size():
			var inst := (load("res://assets/meshy/%s/rigged.glb" % a[1]) as PackedScene).instantiate() as Node3D
			add_child(inst)
			inst.position = Vector3(-1.5 * (clips.size() - 1) * 0.5 + k * 1.5, -row * 2.1, 0)
			inst.rotation_degrees = Vector3(0, -35, 0)
			for mi in inst.find_children("*", "MeshInstance3D", true, false):
				WeaponSkin.apply(a[1], mi)
			var ap := AnimationPlayer.new()
			inst.add_child(ap)
			ap.add_animation_library("m", load("res://assets/meshy/%s/anims.res" % src))
			var parts := clips[k].split("@")
			var nm := "m/" + parts[0]
			if not ap.has_animation(nm):
				continue
			ap.play(nm)
			ap.seek(ap.get_animation(nm).length * float(parts[1]), true)
			ap.pause()
	var cam := Camera3D.new(); cam.fov = 30; cam.position = Vector3(0, -0.1, 3.0 + clips.size() * 1.5); add_child(cam)
func _process(_d: float) -> void:
	n += 1
	if n == 6:
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
		get_tree().quit()
