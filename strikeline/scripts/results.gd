class_name ResultsScreen
extends UiScreen
## Winner screen with victory pose and match stats.

var res: Dictionary
var bg: StageBG


func setup(r: Dictionary) -> void:
	res = r


func layout() -> void:
	var vs := get_viewport_rect().size
	add_btn("again", Rect2(vs.x - 300, vs.y - 110, 260, 80), "REMATCH", "gold")
	add_btn("menu", Rect2(vs.x - 520, vs.y - 100, 200, 64), "MENU", "secondary")


func on_button(id: String) -> void:
	match id:
		"again", "enter":
			main.start_match(res.cfg)
		"menu", "back":
			main.show_title()


func _draw() -> void:
	var vs := get_viewport_rect().size
	dim(0.55)
	var w: int = res.winner
	var fs: Array = res.fighters
	var wf: Dictionary = fs[w] if w >= 0 and w < fs.size() else fs[0]
	var d: Dictionary = Roster.fighter(wf.fighter)
	var acc: Color = d.accent
	# spotlight
	var c := Vector2(vs.x * 0.28, vs.y * 0.78)
	draw_colored_polygon(PackedVector2Array([c + Vector2(-60, -600), c + Vector2(60, -600), c + Vector2(220, 0), c + Vector2(-220, 0)]), Color(acc.r, acc.g, acc.b, 0.12))
	draw_set_transform(c, 0.0, Vector2(1.0, 0.2))
	draw_circle(Vector2.ZERO, 200, Color(acc.r, acc.g, acc.b, 0.3))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	var e := enter_t
	var vp := "victory_" + str(d.id)
	var pose := Rig.blend(Roster.pose("guard"), Roster.pose(vp), clampf(t * 2.0, 0.0, 1.0))
	pose[Rig.LEAN] += sin(t * 2.0) * 0.02
	pose[Rig.SB] += sin(t * 3.0) * 0.1
	UiScreen.draw_fighter(self, wf.fighter, c, 2.6, pose, 1.0, 1.0)
	var label := "YOU WIN!" if not wf.cpu else "%s WINS" % d.name
	var big := 84
	text_shadow(label, Vector2(vs.x * 0.5 - 40, 120 - (1.0 - e) * 40.0), big, Color(1, 1, 1))
	text(d.title, Vector2(vs.x * 0.5 - 36, 152), 18, acc, HORIZONTAL_ALIGNMENT_LEFT, -1, false)
	# stats table
	var x := vs.x * 0.5 - 40
	var y := 210.0
	text("FIGHTER", Vector2(x, y), 14, Color(1, 1, 1, 0.5), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
	text("KOs", Vector2(x + 250, y), 14, Color(1, 1, 1, 0.5), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
	text("FALLS", Vector2(x + 330, y), 14, Color(1, 1, 1, 0.5), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
	text("DAMAGE", Vector2(x + 420, y), 14, Color(1, 1, 1, 0.5), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
	y += 14
	var order := fs.duplicate()
	order.sort_custom(func(a, b): return a.port == w or (b.port != w and a.kos > b.kos))
	for k in order.size():
		var f: Dictionary = order[k]
		var fd: Dictionary = Roster.fighter(f.fighter)
		var rr := Rect2(x - 14, y + k * 54, 560, 46)
		var fa := clampf(e * 2.0 - k * 0.3, 0.0, 1.0)
		draw_rect(rr, Color(0.05, 0.05, 0.1, 0.8 * fa))
		draw_rect(Rect2(rr.position, Vector2(5, rr.size.y)), Color(fd.accent.r, fd.accent.g, fd.accent.b, fa))
		var nm := "%s  %s" % [fd.name, "(CPU)" if f.cpu else "(YOU)"]
		text(nm, Vector2(x, rr.position.y + 31), 22, Color(1, 1, 1, fa))
		text(str(f.kos), Vector2(x + 250, rr.position.y + 31), 22, Color(1.0, 0.85, 0.3, fa))
		text(str(f.falls), Vector2(x + 330, rr.position.y + 31), 22, Color(1, 0.5, 0.5, fa))
		text("%d%%" % int(f.dealt), Vector2(x + 420, rr.position.y + 31), 22, Color(0.6, 0.85, 1.0, fa))
		if f.port == w:
			text("WINNER", Vector2(x + 470, rr.position.y - 2), 11, Color(1.0, 0.85, 0.3, fa), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
	draw_buttons()
