extends Node
## Autoload "Game": fonts, saved settings and music.

var font_display: Font
var font_body: Font
var settings := {"fighter": 0, "cpus": 1, "level": 2, "stage": 0, "stocks": 3, "rivals": [1, 2, 3]}
var music: AudioStreamPlayer
var music_name := ""
const SETTINGS_PATH := "user://settings.cfg"


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	font_display = _font("res://fonts/display.woff2")
	font_body = _font("res://fonts/body.woff2")
	music = AudioStreamPlayer.new()
	music.volume_db = -9.0
	add_child(music)
	_load()


func _font(path: String) -> Font:
	if ResourceLoader.exists(path):
		var f: FontFile = load(path)
		f.antialiasing = TextServer.FONT_ANTIALIASING_GRAY
		f.hinting = TextServer.HINTING_LIGHT
		f.generate_mipmaps = true
		return f
	return ThemeDB.fallback_font


func play_music(name: String) -> void:
	if name == music_name:
		return
	music_name = name
	var path := "res://sfx/music_%s.wav" % name
	if not ResourceLoader.exists(path):
		music.stop()
		return
	var s: AudioStreamWAV = load(path)
	s.loop_mode = AudioStreamWAV.LOOP_FORWARD
	s.loop_begin = 0
	s.loop_end = int(s.get_length() * s.mix_rate)
	music.stream = s
	music.play()


func _load() -> void:
	var c := ConfigFile.new()
	if c.load(SETTINGS_PATH) != OK:
		return
	for k in settings:
		settings[k] = c.get_value("s", k, settings[k])


func save() -> void:
	var c := ConfigFile.new()
	for k in settings:
		c.set_value("s", k, settings[k])
	c.save(SETTINGS_PATH)
