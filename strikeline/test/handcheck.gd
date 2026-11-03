extends Node3D
## Close-ups of one fighter in several clips (model + anims.res, with WeaponSkin). Args: out_png fighter clip1,clip2,... [nofix]
var n := 0
func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	var fid: String = a[1]
	var clips: PackedStringArray = a[2].split(",")
	var fix := not (a.size() > 3 and a[3] == "nofix")
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.25, 0.22, 0.3)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.85, 0.85, 0.95)
	env.ambient_light_energy = 0.8
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var l := DirectionalLight3D.new(); l.rotation_degrees = Vector3(-35, -30, 0); l.light_energy = 1.2; add_child(l)
	var dir: String = FighterView3D.MODEL_DIRS[fid]
	for k in clips.size():
		var inst := (load("res://assets/meshy/%s/rigged.glb" % dir) as PackedScene).instantiate() as Node3D
		add_child(inst)
		inst.position = Vector3(-1.5 * (clips.size() - 1) * 0.5 + k * 1.5, 0, 0)
		inst.rotation_degrees = Vector3(0, -35, 0)
		if fix:
			for mi in inst.find_children("*", "MeshInstance3D", true, false):
				WeaponSkin.apply(dir, mi)
		var ap := AnimationPlayer.new()
		inst.add_child(ap)
		ap.add_animation_library("m", load("res://assets/meshy/%s/anims.res" % dir))
		var parts := clips[k].split("@")
		var name := "m/" + parts[0]
		var frac := float(parts[1]) if parts.size() > 1 else 0.5
		ap.play(name)
		ap.seek(ap.get_animation(name).length * frac, true)
		ap.pause()
	var cam := Camera3D.new(); cam.fov = 30; cam.position = Vector3(0, 1.0, 1.2 + clips.size() * 1.25); add_child(cam); cam.look_at(Vector3(0, 0.95, 0))
func _process(_d: float) -> void:
	n += 1
	if n == 6:
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
		get_tree().quit()
