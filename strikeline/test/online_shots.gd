extends Node
## Screenshots of the online screens. Args: out_dir
var out := "/tmp/on"
var f := 0
var main_node
func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	if a.size() > 0: out = a[0]
	DirAccess.make_dir_recursive_absolute(out)
	main_node = load("res://scripts/main.gd").new()
	add_child(main_node)
func _shot(n: String) -> void:
	get_viewport().get_texture().get_image().save_png(out + "/" + n + ".png")
func _process(_d: float) -> void:
	f += 1
	match f:
		60: _shot("o0_title")
		61: main_node.show_online()
		100: _shot("o1_menu")
		101: main_node.screen.on_button("join")
		102:
			for c in "K7QM": main_node.screen.on_button("k" + c)
			Net.lan_rooms["WDAAAASC"] = {"name": "Nova", "n": 2, "t": Time.get_ticks_msec() + 99999}
		130: _shot("o2_keypad")
		131:
			main_node.screen.on_button("back")
			main_node.screen.on_button("wifi")
		170:
			Net.lobby.players.append({"peer": 2, "name": "Comet", "fighter": 2})
			Net.lobby.settings.cpus = 1
		200: _shot("o3_lobby")
		201: get_tree().quit()
