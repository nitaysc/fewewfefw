extends Node
## Headless smoke test: CPU-only matches on every stage must finish with a winner.

var m: Match
var frames := 0
var stage := 0
var results := []
var max_frames := 60 * 60 * 4

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
	results.append(res)
	m.queue_free()
	stage += 1
	if stage >= 3:
		print("ALL DONE")
		get_tree().quit(0)
	else:
		call_deferred("_start")

func _physics_process(_d: float) -> void:
	frames += 1
	if frames % 1800 == 0 and m and is_instance_valid(m):
		var s := "  t=%ds" % (frames / 60)
		for f in m.fighters:
			s += " %s:%s %.0f%% st%d (%.0f,%.0f)" % [f.data.name, Fighter.S.keys()[f.state], f.damage, f.stocks, f.pos.x, f.pos.y]
		print(s)
	if frames > max_frames:
		print("TIMEOUT on stage %d" % stage)
		get_tree().quit(1)

