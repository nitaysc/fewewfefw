extends Node
## Screen flow: title (over a live CPU battle) -> select -> match -> results.

var demo: Match
var ui_layer: CanvasLayer
var screen: UiScreen


func _ready() -> void:
	randomize()
	get_tree().root.set_meta("main", self)
	show_title()


func _clear() -> void:
	Engine.time_scale = 1.0
	for c in get_children():
		c.queue_free()
	demo = null
	screen = null


func _ensure_demo() -> void:
	if demo != null and is_instance_valid(demo):
		return
	var fighters := [0, 1, 2, 3]
	fighters.shuffle()
	var players := []
	for i in 4:
		players.append({"fighter": fighters[i], "cpu": true, "level": 3})
	demo = Match.new()
	add_child(demo)
	demo.setup({"mode": "demo", "stage": randi() % Stage.STAGES.size(), "stocks": 3, "players": players})
	ui_layer = CanvasLayer.new()
	ui_layer.layer = 15
	add_child(ui_layer)


func _set_screen(s: UiScreen) -> void:
	if screen != null and is_instance_valid(screen):
		screen.queue_free()
	screen = s
	s.main = self
	ui_layer.add_child(s)


func show_title() -> void:
	_clear()
	_ensure_demo()
	show_title_menu()


func show_title_menu() -> void:
	_ensure_demo()
	_set_screen(TitleScreen.new())
	Game.play_music("menu")


func show_select(mode: String) -> void:
	_ensure_demo()
	var s := SelectScreen.new()
	s.mode = mode
	_set_screen(s)


func start_match(cfg: Dictionary) -> void:
	_clear()
	var m := Match.new()
	add_child(m)
	m.setup(cfg)
	m.finished.connect(_on_finished)


func screen_cfg_hack() -> Dictionary:
	return {"mode": "versus", "stage": int(Game.settings.stage), "stocks": 3, "players": [{"fighter": 1, "cpu": true, "level": 3}, {"fighter": 3, "cpu": true, "level": 3}]}


func _on_finished(res: Dictionary) -> void:
	if res.has("quit"):
		call_deferred("show_title")
	else:
		call_deferred("show_results", res)


func show_results(res: Dictionary) -> void:
	_clear()
	var bgl := CanvasLayer.new()
	bgl.layer = -10
	add_child(bgl)
	var bg := StageBG.new()
	bg.setup(res.cfg.stage)
	bg.cam_pos = Vector2(0, -150)
	bg.cam_zoom = 0.8
	bgl.add_child(bg)
	ui_layer = CanvasLayer.new()
	ui_layer.layer = 15
	add_child(ui_layer)
	var r := ResultsScreen.new()
	r.setup(res)
	_set_screen(r)
	Game.play_music("menu")
	Sfx.play("game", -6)
