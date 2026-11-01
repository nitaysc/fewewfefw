extends Node2D
## Renders the app icon layers. Args: out_dir
var out := "/tmp"
var n := 0
var mode := 0  # 0 full icon, 1 adaptive foreground, 2 adaptive background

func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	if a.size() > 0: out = a[0]

func _process(_d: float) -> void:
	get_viewport().transparent_bg = mode == 1
	n += 1
	queue_redraw()
	if n == 4:
		var img := get_viewport().get_texture().get_image()
		var names := ["icon.png", "icon_fg.png", "icon_bg.png"]
		var sz: int = [512, 432, 432][mode]
		var im := img.get_region(Rect2i(0, 0, 512, 512))
		im.resize(sz, sz, Image.INTERPOLATE_LANCZOS)
		if mode == 1:
			im.convert(Image.FORMAT_RGBA8)
		im.save_png(out + "/" + names[mode])
		mode += 1
		n = 0
		if mode == 3:
			get_tree().quit()

func _bg() -> void:
	var pts := PackedVector2Array([Vector2(0, 0), Vector2(512, 0), Vector2(512, 512), Vector2(0, 512)])
	draw_polygon(pts, PackedColorArray([Color(0.2, 0.06, 0.3), Color(0.35, 0.07, 0.3), Color(0.95, 0.3, 0.35), Color(0.12, 0.03, 0.2)]))
	draw_circle(Vector2(350, 170), 120, Color(1.0, 0.85, 0.9, 0.18))
	draw_circle(Vector2(350, 170), 84, Color(1.0, 0.9, 0.93, 0.9))

func _fg() -> void:
	# slash
	draw_colored_polygon(PackedVector2Array([Vector2(40, 400), Vector2(470, 120), Vector2(480, 140), Vector2(56, 420)]), Color(1, 0.2, 0.3, 0.95))
	draw_colored_polygon(PackedVector2Array([Vector2(80, 425), Vector2(470, 170), Vector2(474, 178), Vector2(86, 433)]), Color(1, 1, 1, 0.8))
	var p := Roster.sample(Roster.move("fsmash").anim, 13.0)
	UiScreen.draw_fighter(self, 0, Vector2(236, 400), 2.7, p, 1.0)

func _draw() -> void:
	match mode:
		0:
			_bg()
			_fg()
		1:
			draw_set_transform(Vector2(72, 72), 0.0, Vector2(0.72, 0.72))
			_fg()
		2:
			_bg()
