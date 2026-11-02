extends Node
## Staged: grab + throw, Strike Core + items on screen, then each Final Smash.
var out := "/tmp/fx2"
var m: Match
var f := 0
var a: Fighter
var b: Fighter
var c: Fighter

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0: out = args[0]
	DirAccess.make_dir_recursive_absolute(out)
	m = Match.new()
	add_child(m)
	var fi := int(args[1]) if args.size() > 1 else 0
	m.setup({"mode": "versus", "stage": int(args[2]) if args.size() > 2 else 1, "stocks": 3, "items": true,
		"players": [{"fighter": fi, "cpu": false}, {"fighter": (fi + 1) % 4, "cpu": true, "level": 0}, {"fighter": (fi + 2) % 4, "cpu": true, "level": 0}]})
	m.countdown = 1
	a = m.fighters[0]; b = m.fighters[1]; c = m.fighters[2]
	for g in m.fighters: g.intro_t = 0

func _shot(n: String) -> void:
	get_viewport().get_texture().get_image().save_png(out + "/" + n + ".png")

func _physics_process(_d: float) -> void:
	f += 1
	match f:
		20:
			a.pos = Vector2(-60, 0); a.facing = 1.0
			b.pos = Vector2(-10, 0); b.facing = -1.0; b.damage = 60
			c.pos = Vector2(250, 0)
			a._begin("grab")
		34: _shot("g1_grab")
		40: a._begin("throw_b")
		46: _shot("g2_throw")
		52: _shot("g3_thrown")
		120:
			m.items._spawn_core()
			m.items.core.p = Vector2(100, -200)
			m.items._spawn("bomb"); m.items._spawn("food")
		200: _shot("i1_items_core")
		240:
			b.pos = Vector2(80, 0); b.state = Fighter.S.IDLE; b.grounded = true; b.plat = 0; b.vel = Vector2.ZERO; b.kvel = Vector2.ZERO; b.damage = 80
			c.pos = Vector2(220, 0); c.state = Fighter.S.IDLE; c.grounded = true; c.plat = 0; c.vel = Vector2.ZERO; c.kvel = Vector2.ZERO
			a.pos = Vector2(-150, 0); a.state = Fighter.S.IDLE; a.grounded = true; a.plat = 0; a.facing = 1.0
			a.fs_ready = true
		255: _shot("f0_ready")
		260: a._begin("final")
		290: _shot("f1_banner")
		330: _shot("f2_action")
		360: _shot("f3_hits")
		398: _shot("f4_launch")
		410: _shot("f5_after")
		420: get_tree().quit()
