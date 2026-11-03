extends Node3D
## Each prop (as Stage3D loads it) from the front, side and top. Args: out_png name
var n := 0
func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.25, 0.22, 0.3)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.9, 0.9, 0.95)
	var we := WorldEnvironment.new(); we.environment = env; add_child(we)
	var l := DirectionalLight3D.new(); l.rotation_degrees = Vector3(-35, -30, 0); add_child(l)
	var rots := [Vector3(0, 0, 0), Vector3(0, 90, 0), Vector3(90, 0, 0), Vector3(0, 180, 0)]
	for k in 4:
		var p := Stage3D._load_prop(a[1])
		var box := Stage3D._aabb(p)
		var h := Node3D.new(); add_child(h)
		h.add_child(p)
		var s := 2.0 / maxf(box.size.x, maxf(box.size.y, box.size.z))
		p.scale = Vector3.ONE * s
		p.position = -box.get_center() * s
		h.position = Vector3(-3.6 + k * 2.4, 0, 0)
		h.rotation_degrees = rots[k]
		print(a[1], " aabb ", box)
	var cam := Camera3D.new(); cam.fov = 30; cam.position = Vector3(0, 0, 14); add_child(cam)
func _process(_d: float) -> void:
	n += 1
	if n == 5:
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
		get_tree().quit()
