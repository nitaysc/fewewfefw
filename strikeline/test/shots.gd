extends Node
## Renders screenshots of each screen for visual review. Args after "--": out_dir
var out := "/tmp/shots"
var f := 0
var main_node
var m: Match
var plan := []

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		out = args[0]
	DirAccess.make_dir_recursive_absolute(out)
	main_node = load("res://scripts/main.gd").new()
	add_child(main_node)

func _shot(name: String) -> void:
	var img := get_viewport().get_texture().get_image()
	img.save_png(out + "/" + name + ".png")
	print("shot ", name)

func _process(_d: float) -> void:
	f += 1
	match f:
		90: _shot("01_title")
		100: main_node.screen.on_button("help")
		130: _shot("02_help")
		131: main_node.screen.on_button("close")
		140: main_node.show_select("versus")
		200: _shot("03_select")
		230: _shot("03b_select_anim")
		240:
			Game.settings.cpus = 3
			Game.settings.stage = 0
			main_node.start_match(main_node.screen._config())
		300: _shot("04_countdown")
		420: _make_cpu_human()
		520: _shot("05_fight_a")
		700: _shot("06_fight_b")
		900: _shot("07_fight_c")
		1100: _shot("08_fight_d")
		1300: _shot("09_fight_e")
		1301:
			Game.settings.stage = 1
			Game.settings.cpus = 1
			main_node.start_match(main_node.screen_cfg_hack())
		1500: _shot("10_shrine_a")
		1700: _shot("11_shrine_b")
		1701:
			Game.settings.stage = 2
			main_node.start_match({"mode": "versus", "stage": 2, "stocks": 3, "players": [{"fighter": 2, "cpu": true, "level": 3}, {"fighter": 3, "cpu": true, "level": 3}]})
		1900: _shot("12_line_a")
		2100: _shot("13_line_b")
		2101:
			main_node.show_results({"winner": 0, "cfg": {"mode": "versus", "stage": 1, "stocks": 3, "players": []},
				"fighters": [{"port": 0, "fighter": 0, "cpu": false, "kos": 3, "falls": 1, "dealt": 312.0, "stocks": 2},
				{"port": 1, "fighter": 1, "cpu": true, "kos": 1, "falls": 3, "dealt": 201.0, "stocks": 0}]})
		2200: _shot("14_results")
		2210: get_tree().quit()

func _make_cpu_human() -> void:
	pass
