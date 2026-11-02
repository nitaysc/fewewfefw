extends Node
## Timed match with a forced tie: must go to sudden death and still produce a winner.
var m: Match
var f := 0
func _ready() -> void:
	m = Match.new()
	add_child(m)
	m.setup({"mode": "versus", "stage": 2, "stocks": -2, "items": false, "players": [{"fighter": 0, "cpu": true, "level": 3}, {"fighter": 1, "cpu": true, "level": 3}]})
	m.finished.connect(func(r): print("RESULT winner=", r.winner, " sudden=", m.sudden); get_tree().quit(0))
	m.countdown = 1
	m.time_left = 240
func _physics_process(_d: float) -> void:
	f += 1
	if f == 2:
		print("timed=", m.timed, " time_left=", m.time_left)
	if f == 250:
		print("after time: sudden=", m.sudden, " stocks=", m.fighters.map(func(x): return x.stocks))
	if f > 20000:
		print("RESULT TIMEOUT")
		get_tree().quit(1)
