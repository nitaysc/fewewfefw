extends Node
## Sounds, music and phone vibration.

var players: Array[AudioStreamPlayer] = []
var streams := {}
var music: AudioStreamPlayer
var muted := false
var last := {}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for n in ["click", "pop", "place", "remove", "coin", "ding", "levelup", "error", "whoosh", "saw", "tap"]:
		streams[n] = load("res://sfx/%s.wav" % n)
	for i in 8:
		var p := AudioStreamPlayer.new()
		add_child(p)
		players.append(p)
	music = AudioStreamPlayer.new()
	music.stream = load("res://sfx/music.wav")
	music.volume_db = -9.0
	add_child(music)
	music.finished.connect(func(): if not muted: music.play())
	music.play()

func play(n: String, vol := 0.0, pitch := 1.0) -> void:
	if muted or not streams.has(n):
		return
	# the same sound many times in a moment just gets loud; skip repeats
	var now := Time.get_ticks_msec()
	if now - int(last.get(n, -1000)) < 45:
		return
	last[n] = now
	for p in players:
		if not p.playing:
			p.stream = streams[n]
			p.volume_db = vol
			p.pitch_scale = pitch * randf_range(0.96, 1.04)
			p.play()
			return

func buzz(ms := 18) -> void:
	if not muted:
		Input.vibrate_handheld(ms)

func set_muted(m: bool) -> void:
	muted = m
	if m:
		music.stop()
	else:
		music.play()
