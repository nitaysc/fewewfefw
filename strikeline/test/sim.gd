extends Node
## Headless smoke test: CPU-only matches on every stage must finish with a winner.

var m: Match
var frames := 0
var stage := 0
var results := []
var max_frames := 60 * 60 * 4
var counts := {}
var prev := {}

func _ready() -> void:
	_start()

func _start() -> void:
	var players := []
	for i in 4:
		players.append({"fighter": (i + stage) % 4, "cpu": true, "level": 3})
	m = Match.new()
	add_child(m)
	m.setup({"mode": "versus", "stage": stage, "stocks": 2, "players": players})
	m.finished.connect(_done)
	frames = 0

func _done(res: Dictionary) -> void:
	var line := "stage %d: winner=%d frames=%d " % [stage, res.winner, frames]
	var kp := []
	for f in m.fighters:
		kp.append_array(f.get_meta("ko_pcts", []))
	line += " ko%%=%s " % str(kp)
	for f in res.fighters:
		line += "[%s kos=%d falls=%d dealt=%d] " % [Roster.fighter(f.fighter).name, f.kos, f.falls, f.dealt]
	print(line)
	print("  systems: ", counts)
	counts = {}
	results.append(res)
	m.queue_free()
	stage += 1
	if stage >= 3:
		print("ALL DONE")
		get_tree().quit(0)
	else:
		call_deferred("_start")

func _count(k: String) -> void:
	counts[k] = counts.get(k, 0) + 1

func _physics_process(_d: float) -> void:
	frames += 1
	if m and is_instance_valid(m):
		for f in m.fighters:
			var key: String = str(f.state) + f.move_name()
			if prev.get(f.port, "") != key:
				if f.state == Fighter.S.GRABBING: _count("grab")
				if f.move_name().begins_with("throw"): _count(f.move_name())
				if f.move_name() == "final": _count("final")
				if f.move_name() == "item_throw": _count("item_throw")
				if f.move_name() == "pummel": _count("pummel")
			prev[f.port] = key
		if not m.items.core.is_empty() and not has_meta("core_seen"):
			set_meta("core_seen", true)
			_count("core_spawn")
		if m.items.core.is_empty():
			remove_meta("core_seen") if has_meta("core_seen") else null
	if frames % 1800 == 0 and m and is_instance_valid(m):
		var s := "  t=%ds" % (frames / 60)
		for f in m.fighters:
			s += " %s:%s %.0f%% st%d (%.0f,%.0f)" % [f.data.name, Fighter.S.keys()[f.state], f.damage, f.stocks, f.pos.x, f.pos.y]
		print(s)
	if frames > max_frames:
		print("TIMEOUT on stage %d" % stage)
		get_tree().quit(1)

