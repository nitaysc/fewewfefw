extends Node
## Bolt's specials (screenshots) and the anti-spam limits. Args: out_dir
var out := ""
var m: Match
var f := 0
var bolt: Fighter
var sol: Fighter
var dummy: Fighter
var orbs := 0
var seen := {}

func _ready() -> void:
	out = OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() > 0 else ""
	if out != "":
		DirAccess.make_dir_recursive_absolute(out)
	m = Match.new()
	add_child(m)
	m.setup({"mode": "training", "stage": 2, "stocks": 3, "items": false,
		"players": [{"fighter": 4, "cpu": false}, {"fighter": 3, "cpu": true, "level": 0}, {"fighter": 1, "cpu": true, "level": 0}]})
	m.countdown = 1
	bolt = m.fighters[0]; sol = m.fighters[1]; dummy = m.fighters[2]
	for g in m.fighters: g.intro_t = 0

func _fire(g: Fighter, x: float, y: float) -> void:
	g.state = Fighter.S.IDLE
	g.inp = {"x": x, "y": y}
	g._start_special()

func _physics_process(_d: float) -> void:
	f += 1
	if f == 5:
		bolt.pos = Vector2(-300, 0); bolt.facing = 1.0
		dummy.pos = Vector2(150, 0)
		sol.pos = Vector2(-450, 0); sol.facing = -1.0
	# Sol mashes neutral special for two seconds
	if f >= 10 and f < 130 and f % 4 == 0 and sol.state != Fighter.S.ATTACK:
		_fire(sol, 0, 0)
	for p in m.proj.list:
		if p.kind == "orb" and not p.has("counted"):
			p.counted = true
			orbs += 1
	if f == 20: _fire(bolt, 0, 0)
	if f == 50: _shot("missiles")
	if f == 100: _fire(bolt, 1, 0)
	if f == 112: _shot("fist_out")
	if f == 128: _shot("fist_back")
	if f == 160: _fire(bolt, 0, 1)
	if f == 200:
		dummy.pos = Vector2(-160, 0)
		_shot("mine")
	if f == 240: _fire(bolt, 0, -1)
	if f == 252: _shot("rocket")
	if f == 300:
		print("RESULT orbs_in_2s=", orbs, " dummy_dmg=", dummy.damage, " bolt_cd=", bolt.cd.keys())
		get_tree().quit()

func _shot(n: String) -> void:
	if out != "":
		get_viewport().get_texture().get_image().save_png(out + "/" + n + ".png")
