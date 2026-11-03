extends Node
## Frames of the screen wipe, button entry and a button press. Args: out_dir
var out := ""
var f := 0
var main_node
func _ready() -> void:
	out = OS.get_cmdline_user_args()[0]
	DirAccess.make_dir_recursive_absolute(out)
	main_node = load("res://scripts/main.gd").new()
	add_child(main_node)
func _process(_d: float) -> void:
	f += 1
	if f == 80:
		main_node.show_select("versus")
	if f in [82, 86, 90, 96, 104]:
		get_viewport().get_texture().get_image().save_png(out + "/w_%03d.png" % f)
	if f == 120:
		main_node.screen.on_button("f5")
		main_node.screen.on_button("cos3")
	if f == 135:
		get_viewport().get_texture().get_image().save_png(out + "/costume.png")
	if f == 140:
		main_node.screen.pressed_id = "go"
	if f == 150:
		get_viewport().get_texture().get_image().save_png(out + "/press.png")
		main_node.screen.pressed_id = ""
		main_node.screen.pop("go", Vector2(1100, 650))
	if f == 156:
		get_viewport().get_texture().get_image().save_png(out + "/release.png")
		get_tree().quit()
