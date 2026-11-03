extends Node
## Running and falling poses for every fighter. Args: out_dir
var out := "/tmp/loco"
var m: Match
var f := 0

func _ready() -> void:
	out = OS.get_cmdline_user_args()[0]
	DirAccess.make_dir_recursive_absolute(out)
	m = Match.new()
	add_child(m)
	m.setup({"mode": "training", "stage": 2, "stocks": 3, "items": false,
		"players": [{"fighter": 0, "cpu": false}, {"fighter": 1, "cpu": true, "level": 0}, {"fighter": 2, "cpu": true, "level": 0}, {"fighter": 3, "cpu": true, "level": 0}]})
	m.countdown = 1
	for g in m.fighters: g.intro_t = 0

func _physics_process(_d: float) -> void:
	f += 1
	if f < 10:
		return
	for i in 4:
		var g: Fighter = m.fighters[i]
		if f < 140:
			g.pos = Vector2(-330 + i * 190 + ((f - 10) % 60) * 0.0, 0)
			g.grounded = true; g.plat = 0; g.facing = 1.0
			g.state = Fighter.S.RUN; g.vel = Vector2(g.data.run, 0)
		else:
			g.pos = Vector2(-330 + i * 190, -260)
			g.grounded = false; g.plat = -1; g.facing = 1.0; g.flip_t = 0
			g.state = Fighter.S.AIR; g.vel = Vector2(0, 4)
	if f in [100, 104, 108, 112]:
		_shot("run_%d" % f)
	if f in [200, 210]:
		_shot("fall_%d" % f)
	if f == 212:
		get_tree().quit()

func _shot(n: String) -> void:
	get_viewport().get_texture().get_image().save_png(out + "/" + n + ".png")
