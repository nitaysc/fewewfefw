class_name SelectScreen
extends UiScreen
## Fighter select with animated previews, and the match settings.

const LEVELS := ["EASY", "NORMAL", "HARD"]
const SHOWCASE := ["ftilt", "fsmash", "nair", "usmash", "dsmash", "utilt", "jab3"]

var mode := "versus"
var sel := 0
var sel_t := 0.0


func _ready() -> void:
	sel = Game.settings.fighter


func layout() -> void:
	var vs := get_viewport_rect().size
	var n := Roster.FIGHTERS.size()
	var cw := minf(250.0, (vs.x - 120) / n - 16)
	var total := n * cw + (n - 1) * 16
	var x0 := (vs.x - total) * 0.5
	for i in n:
		btns.append({"id": "f%d" % i, "r": Rect2(x0 + i * (cw + 16), 92, cw, 360), "label": "", "kind": "card", "sub": ""})
	var by := vs.y - 106
	add_btn("back", Rect2(28, by + 18, 120, 56), "BACK", "secondary")
	var s: Dictionary = Game.settings
	var cx := 170.0
	if mode == "versus":
		add_btn("cpus", Rect2(cx, by, 150, 74), "RIVALS", "chip", str(s.cpus))
		add_btn("level", Rect2(cx + 160, by, 170, 74), "CPU LEVEL", "chip", LEVELS[clampi(int(s.level) - 1, 0, 2)])
		var st := int(s.stocks)
		add_btn("stocks", Rect2(cx + 340, by, 130, 74), "RULES", "chip", ("%d STOCK" % st) if st > 0 else ("%d MIN" % -st))
		add_btn("items", Rect2(cx + 480, by, 110, 74), "ITEMS", "chip", "ON" if s.get("items", true) else "OFF")
		add_btn("stage", Rect2(cx + 600, by, 230, 74), "STAGE", "chip", Stage.STAGES[int(s.stage)].name)
	else:
		add_btn("stage", Rect2(cx, by, 280, 74), "STAGE", "chip", Stage.STAGES[int(s.stage)].name)
	add_btn("go", Rect2(vs.x - 270, by - 6, 240, 86), "FIGHT!", "gold")


func on_button(id: String) -> void:
	var s: Dictionary = Game.settings
	if id.begins_with("f"):
		var i := int(id.substr(1))
		if i == sel:
			return
		sel = i
		sel_t = 0.0
		s.fighter = i
		Sfx.play("swing_m", -6)
		return
	match id:
		"back":
			main.show_title_menu()
		"cpus":
			s.cpus = int(s.cpus) % 3 + 1
		"level":
			s.level = int(s.level) % 3 + 1
		"stocks":
			var order := [1, 2, 3, 4, 5, -2, -3]
			s.stocks = order[(order.find(int(s.stocks)) + 1) % order.size()]
		"items":
			s.items = not s.get("items", true)
		"stage":
			s.stage = (int(s.stage) + 1) % Stage.STAGES.size()
		"go", "enter":
			Game.save()
			main.start_match(_config())


func _config() -> Dictionary:
	var s: Dictionary = Game.settings
	var players := [{"fighter": sel, "cpu": false}]
	if mode == "training":
		players.append({"fighter": (sel + 1) % 4, "cpu": true, "level": 0})
	else:
		var pool := [0, 1, 2, 3]
		pool.erase(sel)
		pool.shuffle()
		for i in int(s.cpus):
			var f: int = pool[i % pool.size()] if i < 3 else randi() % 4
			players.append({"fighter": f, "cpu": true, "level": int(s.level)})
	return {"mode": mode, "stage": int(s.stage), "stocks": int(s.stocks), "items": s.get("items", true) and mode != "training", "players": players}


func _process(delta: float) -> void:
	sel_t += delta
	super._process(delta)


func _draw() -> void:
	var vs := get_viewport_rect().size
	dim(0.62)
	text_shadow("CHOOSE YOUR FIGHTER" if mode == "versus" else "TRAINING  ·  CHOOSE YOUR FIGHTER", Vector2(0, 64), 38, Color(1, 1, 1), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
	for b in btns:
		if b.kind == "card":
			_card(b)
	draw_buttons_except_cards()


func draw_buttons_except_cards() -> void:
	for b in btns:
		if b.kind != "card":
			draw_btn(b)


func _card(b: Dictionary) -> void:
	var i := int((b.id as String).substr(1))
	var r: Rect2 = b.r
	var d: Dictionary = Roster.fighter(i)
	var acc: Color = d.accent
	var on := i == sel
	var e := clampf(enter_t * 1.6 - i * 0.12, 0.0, 1.0)
	r.position.y += (1.0 - e) * 60.0
	var a := e
	if on:
		r = r.grow(6)
	# panel
	var sl := 22.0
	var pts := PackedVector2Array([r.position + Vector2(sl, 0), Vector2(r.end.x, r.position.y), r.end - Vector2(sl, 0), Vector2(r.position.x, r.end.y)])
	var top := Color(acc.r * 0.35, acc.g * 0.35, acc.b * 0.35, 0.95 * a) if on else Color(0.08, 0.08, 0.13, 0.85 * a)
	var bot := Color(0.03, 0.03, 0.06, 0.95 * a)
	draw_polygon(pts, PackedColorArray([top, top, bot, bot]))
	draw_polyline(pts + PackedVector2Array([pts[0]]), Color(acc.r, acc.g, acc.b, (1.0 if on else 0.45) * a), 3.0 if on else 2.0, true)
	# big faded name behind the fighter
	var fd: Font = Game.font_display
	draw_string(fd, Vector2(r.position.x, r.position.y + 150), d.name, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 70, Color(acc.r, acc.g, acc.b, 0.12 * a))
	# floor glow
	var feet := Vector2(r.get_center().x, r.position.y + 228)
	draw_set_transform(feet, 0.0, Vector2(1.0, 0.22))
	draw_circle(Vector2.ZERO, 70.0, Color(acc.r, acc.g, acc.b, (0.35 if on else 0.12) * a))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	# animated fighter
	var pose := _preview_pose(i, on)
	UiScreen.draw_fighter(self, i, feet, 1.45, pose, 1.0, a)
	# name & title
	text(d.name, Vector2(r.position.x, r.position.y + 268), 34, Color(1, 1, 1, a), HORIZONTAL_ALIGNMENT_CENTER, r.size.x)
	text(d.title, Vector2(r.position.x, r.position.y + 290), 14, Color(acc.r, acc.g, acc.b, a), HORIZONTAL_ALIGNMENT_CENTER, r.size.x, false)
	# stats
	var labels := ["POWER", "SPEED", "RECOVERY", "RANGE"]
	var st: Array = d.stats
	for k in 4:
		var y := r.position.y + 300 + k * 13
		text(labels[k], Vector2(r.position.x + 30, y + 9), 10, Color(1, 1, 1, 0.55 * a), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
		for s in 5:
			var cr := Rect2(r.position.x + 110 + s * 22, y + 1, 18, 8)
			draw_rect(cr, Color(acc.r, acc.g, acc.b, a) if s < int(st[k]) else Color(1, 1, 1, 0.12 * a))
	if on:
		var vs := get_viewport_rect().size
		var blurb: String = d.blurb
		text(blurb, Vector2(0, r.end.y + 34), 16, Color(1, 1, 1, 0.8), HORIZONTAL_ALIGNMENT_CENTER, vs.x, false)
		var sp: Array = d.special_names
		text("SPECIALS:  %s  ·  %s  ·  %s  ·  %s" % sp, Vector2(0, r.end.y + 58), 14, Color(acc.r, acc.g, acc.b, 0.9), HORIZONTAL_ALIGNMENT_CENTER, vs.x, false)


func _preview_pose(i: int, on: bool) -> PackedFloat32Array:
	var tt := sel_t if on else t + i * 0.7
	if on and tt > 0.25:
		var cycle := 2.6
		var k := int((tt - 0.25) / cycle)
		var local := fmod(tt - 0.25, cycle)
		var mv := Roster.move(SHOWCASE[(k + i) % SHOWCASE.size()])
		var len: float = mv.len
		var f := local * 60.0
		if f < len + 10.0:
			var p := Roster.sample(mv.anim, minf(f, len))
			if mv.get("air", false):
				p = p.duplicate()
			return p
	var p := Roster.pose("guard").duplicate()
	var b := sin(tt * 4.5)
	p[Rig.LEAN] += b * 0.025
	p[Rig.KF] += (b + 1.0) * 0.06
	p[Rig.KB] += (b + 1.0) * 0.06
	p[Rig.SF] += b * 0.05
	return p
