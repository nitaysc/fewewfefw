extends Node
## Staged scenario: Kai fsmashes a dummy at high % — capture hit, launch and KO frames.
var out := "/tmp/fx"
var m: Match
var f := 0
var hit_f := -1
var a: Fighter
var b: Fighter

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0: out = args[0]
	DirAccess.make_dir_recursive_absolute(out)
	m = Match.new()
	add_child(m)
	m.setup({"mode": "versus", "stage": int(args[1]) if args.size() > 1 else 0, "stocks": 3, "players": [{"fighter": 0, "cpu": false}, {"fighter": 1, "cpu": true, "level": 0}, {"fighter": 3, "cpu": true, "level": 0}]})
	m.countdown = 1
	a = m.fighters[0]
	b = m.fighters[1]

func _shot(n: String) -> void:
	get_viewport().get_texture().get_image().save_png(out + "/" + n + ".png")

func _physics_process(_d: float) -> void:
	f += 1
	if f == 30:
		a.pos = Vector2(100, 0); a.facing = 1.0
		b.pos = Vector2(175, 0); b.facing = -1.0
		b.damage = 125.0
		_shot("fx00_before")
	if f == 40:
		a._begin("fsmash")
	if f > 40 and f < 120 and b.state == Fighter.S.HITSTUN and hit_f < 0:
		hit_f = f
	if hit_f > 0:
		var d := f - hit_f
		if d in [0, 3, 8, 16, 24, 32]:
			_shot("fx_hit_%02d" % d)
	if f > 40 and b.state == Fighter.S.DEAD and not has_meta("ko"):
		set_meta("ko", f)
	if has_meta("ko"):
		var d: int = f - int(get_meta("ko"))
		if d in [1, 6, 14]:
			_shot("fx_ko_%02d" % d)
	if f == 260:
		# up special + nair poses mid-air
		a.pos = Vector2(-200, -200); a.vel = Vector2.ZERO; a.grounded = false; a.state = Fighter.S.AIR
		a._begin("kai_ub")
	if f == 272: _shot("fx_upb")
	if f == 300:
		var c: Fighter = m.fighters[2]
		c._begin("sol_nb")
	if f == 316: _shot("fx_orb")
	if f == 330: get_tree().quit()
