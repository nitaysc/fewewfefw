extends Node
## Each stage in 3D with four fighters and every item out. Args: out_dir [stage]
var out := "/tmp/st"
var m: Match
var f := 0
var sid := 0
var only := -1
var thumbs := false   # "thumbs": writes the select-screen stage previews to assets/stages/

func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	out = a[0]
	if a.size() > 1 and a[1] == "thumbs":
		thumbs = true
	elif a.size() > 1:
		only = int(a[1])
		sid = only
	DirAccess.make_dir_recursive_absolute(out)
	_start()

func _start() -> void:
	if m:
		m.queue_free()
	m = Match.new()
	add_child(m)
	m.setup({"mode": "demo" if thumbs else "versus", "stage": sid, "stocks": 3, "items": true,
		"players": [{"fighter": 0, "cpu": true, "level": 3}, {"fighter": 1, "cpu": true, "level": 3},
			{"fighter": 2, "cpu": true, "level": 3}, {"fighter": 3, "cpu": true, "level": 3}]})
	f = 0

func _physics_process(_d: float) -> void:
	f += 1
	if thumbs:
		if f == 2:
			m.cam_zoom = 0.62
		if f == 200:
			var img := get_viewport().get_texture().get_image()
			img.resize(400, 225, Image.INTERPOLATE_LANCZOS)
			DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://assets/stages"))
			img.save_png(ProjectSettings.globalize_path("res://assets/stages/stage_%d.png" % sid))
			print("thumb ", sid)
			if sid == 2:
				get_tree().quit()
			else:
				sid += 1
				_start()
		return
	if f == 150:
		m.items._spawn("bomb")
		m.items._spawn("food")
		m.items._spawn_core()
		m.items.core.p = Vector2(-150, -330)
		m.items.list[0].p = Vector2(-60, -400)
		m.items.list[1].p = Vector2(200, -400)
	if f == 260:
		m.fx.hit(Vector2(-200, -90), Vector2(1, -0.3), 18.0, Color(1, 0.4, 0.3))
		m.fx.explosion(Vector2(250, -60))
		m.fx.dust(Vector2(0, 0), 1.0, 1.2)
	if f == 266:
		_shot("stage%d_a" % sid)
	if f == 420:
		_shot("stage%d_b" % sid)
	if f == 421:
		if only >= 0 or sid == 2:
			get_tree().quit()
		else:
			sid += 1
			_start()

func _shot(n: String) -> void:
	get_viewport().get_texture().get_image().save_png(out + "/" + n + ".png")
	print("shot ", n)
