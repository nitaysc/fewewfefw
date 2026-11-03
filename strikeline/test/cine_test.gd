extends Node
## Triggers a Final Smash with fighters in range and captures the cutscene. Args: out_dir [fighter idx]
var out := ""
var m: Match
var f := 0
var who := 0
var shots := 0

func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	out = a[0]
	if a.size() > 1:
		who = int(a[1])
	DirAccess.make_dir_recursive_absolute(out)
	m = Match.new()
	add_child(m)
	var others := [0, 1, 2, 3]
	others.erase(who)
	m.setup({"mode": "versus", "stage": 0, "stocks": 3, "items": false,
		"players": [{"fighter": who, "cpu": true, "level": 0}, {"fighter": others[0], "cpu": true, "level": 0}, {"fighter": others[1], "cpu": true, "level": 0}]})

func _physics_process(_d: float) -> void:
	f += 1
	if f == 250:
		var a: Fighter = m.fighters[0]
		a.pos = Vector2(-250, 0); a.facing = 1.0; a.grounded = true; a.plat = 0
		m.fighters[1].pos = Vector2(-150, 0)
		m.fighters[2].pos = Vector2(-60, 0)
		for g in m.fighters:
			g.vel = Vector2.ZERO
			g.state = Fighter.S.IDLE
		a.fs_ready = true
		a._begin("final")
	if f > 250 and f % 14 == 0 and shots < 16:
		shots += 1
		get_viewport().get_texture().get_image().save_png(out + "/c_%03d.png" % f)
	if f == 520:
		print("RESULT cine ", "ended" if not m.cine.active else "stuck", " dmg ", m.fighters[1].damage, " ", m.fighters[2].damage)
		get_tree().quit()
