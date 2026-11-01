extends Node
## Autoload "Sfx": a small pool of players for the synthesized sound effects.

const NAMES := ["hit_l", "hit_m", "hit_h", "hit_crit", "swing_l", "swing_m", "swing_h", "jump", "djump",
	"land", "land_heavy", "shield_up", "shield_hit", "shield_break", "dodge", "ledge", "ko", "beep", "go",
	"game", "dash", "charge", "counter", "counter_ready", "throw", "orb", "zap", "jet", "vanish", "slam",
	"bounce", "tech", "respawn", "ui_move", "ui_ok", "ui_back"]

var streams := {}
var players: Array = []
var next := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for n in NAMES:
		var p := "res://sfx/%s.wav" % n
		if ResourceLoader.exists(p):
			streams[n] = load(p)
	for i in 14:
		var a := AudioStreamPlayer.new()
		add_child(a)
		players.append(a)


func play(n: String, vol := 0.0, pitch_var := 0.07) -> void:
	if not streams.has(n):
		return
	var a: AudioStreamPlayer = null
	for i in players.size():
		var p: AudioStreamPlayer = players[(next + i) % players.size()]
		if not p.playing:
			a = p
			break
	if a == null:
		a = players[next]
	next = (next + 1) % players.size()
	a.stream = streams[n]
	a.volume_db = vol
	a.pitch_scale = 1.0 + randf_range(-pitch_var, pitch_var)
	a.play()
