extends Node
## Two-process online test. Args: host|guest  online|lan  code_file
var role := "host"
var kind := "online"
var code_file := "/tmp/strikeline_code"
var t := 0
var m: Match
var phase := "connect"
var x0 := 0.0

func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	for s in a:
		if s in ["host", "guest"]: role = s
		elif s in ["online", "lan"]: kind = s
		elif s.begins_with("/"): code_file = s
	Net.failed.connect(func(msg): print(role, " FAILED: ", msg); get_tree().quit(2))
	Net.closed.connect(func(msg): print(role, " CLOSED: ", msg))
	Net.joined.connect(func(): print(role, " joined lobby, code=", Net.code))
	Net.start.connect(_on_start)
	Net.results.connect(func(r): print(role, " RESULTS winner=", r.winner))
	if role == "host":
		if kind == "online": Net.host_online()
		else: Net.host_lan()
	else:
		var c := ""
		for i in 200:
			if FileAccess.file_exists(code_file):
				c = FileAccess.get_file_as_string(code_file).strip_edges()
				if c != "": break
			await get_tree().create_timer(0.1).timeout
		print("guest joining ", c)
		Net.join(c)

func _on_start(cfg: Dictionary) -> void:
	print(role, " match starting with ", cfg.players.size(), " players")
	m = Match.new()
	add_child(m)
	m.setup(cfg)
	m.finished.connect(func(res): Net.match_over(res))
	phase = "match"

func _process(_d: float) -> void:
	t += 1
	if role == "host" and Net.code != "" and not FileAccess.file_exists(code_file) and Net.lobby.players.size() > 0:
		var f := FileAccess.open(code_file, FileAccess.WRITE)
		f.store_string(Net.code)
		f.close()
	if role == "host" and phase == "connect" and Net.lobby.players.size() >= 2:
		phase = "starting"
		print("host sees ", Net.lobby.players.size(), " players: ", Net.lobby.players.map(func(p): return p.name))
		Net.set_setting("cpus", 1)
		Net.host_start()
	if t > 60 * 60:
		print(role, " TIMEOUT in phase ", phase)
		get_tree().quit(1)

var mt := 0
func _physics_process(_d: float) -> void:
	if phase != "match" or m == null:
		return
	mt += 1
	if role == "guest" and m.pad != null:
		# hold right on the stick after the countdown, then attack
		if mt == 230:
			x0 = _me().pos.x
		if mt == 232: _touch(0, Vector2(200, 500), true)
		if mt == 234: _drag(0, Vector2(290, 500))
		if mt == 300: _touch(0, Vector2(290, 500), false)
		if mt == 320:
			var lay: Dictionary = m.pad._layout()
			_touch(1, lay.atk[0], true)
		if mt == 324:
			var lay: Dictionary = m.pad._layout()
			_touch(1, lay.atk[0], false)
	if mt == 360:
		var me := _me()
		print(role, " frame=", m.frame, " my fighter x=", me.pos.x, " state=", Fighter.S.keys()[me.state], " others=", m.fighters.map(func(f): return int(f.pos.x)))
		if role == "host":
			var g: Fighter = m.fighters[1]
			print("host: guest fighter moved to x=", g.pos.x, " damage=", g.damage, " dealt=", g.st_dealt)
	if mt == 400 and role == "host":
		m._finish()
	if mt == 460:
		print(role, " OK done, snapshots/events working")
		get_tree().quit(0)

func _me() -> Fighter:
	for f in m.fighters:
		if f.peer == Net.my_id(): return f
	return m.fighters[0]


func _touch(idx: int, p: Vector2, down: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = idx; e.position = get_viewport().get_final_transform() * p; e.pressed = down
	Input.parse_input_event(e)

func _drag(idx: int, p: Vector2) -> void:
	var e := InputEventScreenDrag.new()
	e.index = idx; e.position = get_viewport().get_final_transform() * p
	Input.parse_input_event(e)
