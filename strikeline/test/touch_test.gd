extends Node
## Injects touch events and checks the human fighter reacts.
var m: Match
var f := 0
var me: Fighter
var log := []

func _ready() -> void:
	m = Match.new()
	add_child(m)
	m.setup({"mode": "training", "stage": 2, "stocks": 3, "players": [{"fighter": 0, "cpu": false}, {"fighter": 1, "cpu": true, "level": 0}]})
	m.countdown = 1
	me = m.fighters[0]

func _touch(idx: int, p: Vector2, down: bool) -> void:
	var e := InputEventScreenTouch.new()
	e.index = idx; e.position = _w(p); e.pressed = down
	Input.parse_input_event(e)

func _drag(idx: int, p: Vector2) -> void:
	var e := InputEventScreenDrag.new()
	e.index = idx; e.position = _w(p)
	Input.parse_input_event(e)

func _w(p: Vector2) -> Vector2:
	# canvas -> window coordinates (the headless window is tiny)
	return get_viewport().get_final_transform() * p

func _check(name: String, ok: bool) -> void:
	print(("PASS " if ok else "FAIL ") + name)
	log.append(ok)

func _physics_process(_d: float) -> void:
	f += 1
	var lay: Dictionary = m.pad._layout()
	var start_x := me.pos.x
	match f:
		10:
			set_meta("x0", me.pos.x)
			_touch(0, Vector2(200, 500), true)
		12: _drag(0, Vector2(280, 500))
		40:
			_check("stick moves right", me.pos.x > float(get_meta("x0")) + 40.0)
			_drag(0, Vector2(200, 500))
			_touch(0, Vector2(200, 500), false)
		60: _touch(1, lay.jmp[0], true)
		64: _touch(1, lay.jmp[0], false)
		70: _check("jump button jumps", not me.grounded and me.pos.y < -20.0)
		130: _touch(1, lay.atk[0], true)
		132:
			_touch(1, lay.atk[0], false)
			_check("attack button attacks", me.state == Fighter.S.ATTACK)
		180: _touch(1, lay.spc[0], true)
		182:
			_touch(1, lay.spc[0], false)
			_check("special button: neutral special", me.move_name() == "kai_nb")
		240: _touch(1, lay.shd[0], true)
		244: _check("shield held", me.state == Fighter.S.SHIELD)
		250: _touch(1, lay.shd[0], false)
		300:
			# flick right + attack = forward smash
			_touch(0, Vector2(200, 500), true)
		301: _drag(0, Vector2(300, 500))
		302: _touch(1, lay.atk[0], true)
		304: _check("flick + attack = smash", me.move_name() == "fsmash")
		330:
			_touch(1, lay.atk[0], false)
			_touch(0, Vector2(300, 500), false)
		400:
			_touch(2, lay.pause[0], true)
		402:
			_check("pause button pauses", m.paused)
			m.set_paused(false)
		420:
			var all_ok := not log.has(false)
			print("RESULT ", "OK" if all_ok else "FAILED")
			get_tree().quit(0 if all_ok else 1)

