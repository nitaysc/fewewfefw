extends Node
## Staged movement: double-jump backflip frames, ledge hang, crouch, run. Args: out_dir
var out := "/tmp/mv"
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
	m.setup({"mode": "training", "stage": 2, "stocks": 3, "items": false,
		"players": [{"fighter": 0, "cpu": false}, {"fighter": 2, "cpu": true, "level": 0}, {"fighter": 3, "cpu": true, "level": 0}]})
	m.countdown = 1
	a = m.fighters[0]; b = m.fighters[1]; c = m.fighters[2]
	for g in m.fighters: g.intro_t = 0

func _shot(n: String) -> void:
	get_viewport().get_texture().get_image().save_png(out + "/" + n + ".png")

func _physics_process(_d: float) -> void:
	f += 1
	if f == 20:
		a.pos = Vector2(-80, -60); a.grounded = false; a.plat = -1; a.state = Fighter.S.AIR; a.vel = Vector2(0, -6)
		b.pos = Vector2(60, 0); b.state = Fighter.S.CROUCH; b.grounded = true; b.plat = 0
		c.pos = Vector2(-560, 104); c._grab_ledge(0)
	if f == 24:
		a._double_jump()
	if f in [26, 30, 34, 38, 42]:
		_shot("dj_%02d" % (f - 24))
	if f == 60:
		get_tree().quit()
