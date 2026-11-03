extends Node
## Forces a KO hit to check the special zoom, and an off-screen fighter for the bubble. Args: out_dir
var out := "/tmp/sz"
var m: Match
var f := 0
var a: Fighter
var b: Fighter
var c: Fighter

func _ready() -> void:
	out = OS.get_cmdline_user_args()[0]
	DirAccess.make_dir_recursive_absolute(out)
	m = Match.new()
	add_child(m)
	m.setup({"mode": "versus", "stage": 1, "stocks": 3, "items": false,
		"players": [{"fighter": 0, "cpu": true, "level": 0}, {"fighter": 1, "cpu": true, "level": 0}, {"fighter": 3, "cpu": true, "level": 0}]})
	a = m.fighters[0]; b = m.fighters[1]; c = m.fighters[2]

func _physics_process(_d: float) -> void:
	f += 1
	if f == 260:
		a.pos = Vector2(300, 0); a.facing = 1.0
		b.pos = Vector2(360, 0); b.damage = 140.0
		c.pos = Vector2(-1150, -300); c.vel = Vector2.ZERO; c.grounded = false; c.state = Fighter.S.AIR
	if f == 262:
		_shot("bubble")
		m.apply_hit(a, b, {"d": 18.0, "b": 9.0, "g": 14.0, "a": 40.0}, b.core_world(), 1.0, 1.0, false)
		print("szoom_t ", m.szoom_t)
	if f in [265, 275, 290, 300, 312]:
		_shot("sz_%03d" % f)
	if f == 330:
		print("RESULT szoom ", "ok" if m.szoom_t == 0 else "stuck")
		get_tree().quit()

func _shot(n: String) -> void:
	get_viewport().get_texture().get_image().save_png(out + "/" + n + ".png")
