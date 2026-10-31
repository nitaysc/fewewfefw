extends Node3D
func _ready():
	var cam := Camera3D.new(); add_child(cam); cam.position = Vector3(0, 1.3, 3.2); cam.look_at(Vector3(0, 1.0, 0)); cam.fov = 40
	var l := DirectionalLight3D.new(); add_child(l); l.rotation_degrees = Vector3(-40, 30, 0); l.shadow_enabled = true
	var we := WorldEnvironment.new(); var env := Environment.new(); env.background_mode = Environment.BG_COLOR; env.background_color = Color(0.5, 0.45, 0.4)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; env.ambient_light_color = Color(0.8, 0.75, 0.7); env.ambient_light_energy = 0.6; env.tonemap_mode = Environment.TONE_MAPPER_ACES
	we.environment = env; add_child(we)
	var a := Toymaker.new().build(false); add_child(a); a.position.x = -0.6; a.play(OS.get_cmdline_user_args()[1] if OS.get_cmdline_user_args().size() > 1 else "Idle")
	var b := Toymaker.new().build(true, "Hair_Buns"); add_child(b); b.position.x = 0.6; b.rotation_degrees.y = -20; b.play("Walk_Carry")
	await get_tree().create_timer(1.2).timeout
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	get_tree().quit()
