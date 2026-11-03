class_name ResultsScreen
extends UiScreen
## Winner screen with victory pose and match stats.

var res: Dictionary
var bg: StageBG


func setup(r: Dictionary) -> void:
	res = r


func _online() -> bool:
	return res.cfg.get("online", false) and Net.active()


func layout() -> void:
	var vs := get_viewport_rect().size
	if _online() and not Net.is_host:
		add_btn("menu", Rect2(vs.x - 260, vs.y - 100, 220, 64), "LEAVE ROOM", "secondary")
		return
	add_btn("again", Rect2(vs.x - 300, vs.y - 110, 260, 80), "REMATCH", "gold")
	add_btn("menu", Rect2(vs.x - 520, vs.y - 100, 200, 64), "LOBBY" if _online() else "MENU", "secondary")


func on_button(id: String) -> void:
	match id:
		"again", "enter":
			if _online():
				if Net.is_host:
					Net.host_start()
			else:
				main.start_match(res.cfg)
		"menu", "back":
			if _online():
				if Net.is_host:
					Net.back_to_lobby()
				else:
					Net.leave()
					main.show_title()
			else:
				main.show_title()


func _draw() -> void:
	var vs := get_viewport_rect().size
	dim(0.55)
	var w: int = res.winner
	var fs: Array = res.fighters
	var wf: Dictionary = fs[w] if w >= 0 and w < fs.size() else fs[0]
	var d: Dictionary = Roster.fighter(wf.fighter)
	var acc: Color = d.accent
	# "THE WINNER IS..." beat before the reveal, Smash style
	var intro := 0.9
	if t < intro:
		var u := t / intro
		draw_rect(Rect2(0, vs.y * 0.42, vs.x, vs.y * 0.16 * minf(1.0, u * 5.0)), Color(0, 0, 0, 0.7))
		text_shadow("THE WINNER IS...", Vector2(0, vs.y * 0.5 + 22), 54, Color(1, 1, 1, minf(1.0, u * 4.0)), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
		return
	var rt := t - intro
	var e := clampf(rt * 2.5, 0.0, 1.0)
	# winner-coloured slanted panel with sliding stripes
	var px := vs.x * 0.56 * (1.0 - pow(1.0 - e, 3.0))
	var panel := PackedVector2Array([Vector2(0, 0), Vector2(px, 0), Vector2(px - 180, vs.y), Vector2(0, vs.y)])
	draw_colored_polygon(panel, Color(acc.r * 0.55, acc.g * 0.55, acc.b * 0.55, 0.92))
	for k in 14:
		var sx := fmod(k * 90.0 + rt * 60.0, 1300.0) - 300.0
		var st := PackedVector2Array([Vector2(sx, 0), Vector2(sx + 34, 0), Vector2(sx + 34 - 180, vs.y), Vector2(sx - 180, vs.y)])
		var clip := Geometry2D.intersect_polygons(st, panel)
		for poly in clip:
			draw_colored_polygon(poly, Color(1, 1, 1, 0.05))
	draw_polyline(PackedVector2Array([Vector2(px, 0), Vector2(px - 180, vs.y)]), Color(1, 1, 1, 0.8), 4.0, true)
	draw_polyline(PackedVector2Array([Vector2(px + 14, 0), Vector2(px - 166, vs.y)]), Color(acc.r, acc.g, acc.b, 0.9), 3.0, true)
	# giant name behind the fighter
	var fd: Font = Game.font_display
	draw_set_transform(Vector2(vs.x * 0.06, vs.y * 0.96), -PI / 2.0, Vector2.ONE)
	draw_string(fd, Vector2.ZERO, d.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 200, Color(1, 1, 1, 0.13 * e))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	# the winner, sliding in with a floor glow
	var c := Vector2(vs.x * 0.28 - (1.0 - e) * 300.0, vs.y * 0.8)
	draw_set_transform(c, 0.0, Vector2(1.0, 0.2))
	draw_circle(Vector2.ZERO, 200, Color(1, 1, 1, 0.18 * e))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	var vp := "victory_" + str(d.id)
	var pose := Rig.blend(Roster.pose("guard"), Roster.pose(vp), clampf(rt * 2.0, 0.0, 1.0))
	if not draw_portrait("winner", wf.fighter, Portrait3D.VICTORY[str(d.id)], c + Vector2(0, 10), 360.0, e, int(wf.get("costume", 0))):
		UiScreen.draw_fighter(self, wf.fighter, c, 2.6, pose, 1.0, e)
	# title
	var label := "YOU WIN!" if not wf.cpu else "%s WINS!" % d.name
	var tx := vs.x * 0.56
	var big := 84
	while big > 40 and fd.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, big).x > vs.x - tx - 30:
		big -= 2
	text_shadow(label, Vector2(tx + (1.0 - e) * 200.0, 116), big, Color(1, 1, 1, e))
	text(d.title, Vector2(tx + 4, 150), 18, Color(acc.lightened(0.3), e), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
	# placements
	var order := fs.duplicate()
	order.sort_custom(func(a, b):
		if a.port == w: return true
		if b.port == w: return false
		if a.stocks != b.stocks: return a.stocks > b.stocks
		return a.kos > b.kos)
	var x := tx
	var y := 196.0
	text("KOs", Vector2(x + 300, y), 13, Color(1, 1, 1, 0.5), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
	text("FALLS", Vector2(x + 370, y), 13, Color(1, 1, 1, 0.5), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
	text("DAMAGE", Vector2(x + 450, y), 13, Color(1, 1, 1, 0.5), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
	y += 12
	var place_cols := [Color(1.0, 0.82, 0.25), Color(0.8, 0.85, 0.95), Color(0.85, 0.55, 0.3), Color(0.6, 0.6, 0.7)]
	for k in order.size():
		var f: Dictionary = order[k]
		var fdd: Dictionary = Roster.fighter(f.fighter)
		var fa := clampf(rt * 3.0 - 0.4 - k * 0.25, 0.0, 1.0)
		var rr := Rect2(x - 14 + (1.0 - fa) * 120.0, y + k * 62, vs.x - x - 20, 54)
		draw_rect(rr, Color(0.05, 0.05, 0.1, 0.82 * fa))
		draw_rect(Rect2(rr.position, Vector2(5, rr.size.y)), Color(fdd.accent.r, fdd.accent.g, fdd.accent.b, fa))
		# placement number
		var pc: Color = place_cols[mini(k, 3)]
		text_shadow(str(k + 1), Vector2(rr.position.x + 14, rr.position.y + 44), 40, Color(pc, fa))
		# head
		var hc := rr.position + Vector2(76, 27)
		var head := Portrait3D.texture(self, "res%d" % k, f.fighter, "Combat_Stance", 160, true, int(f.get("costume", 0)))
		draw_circle(hc, 23, Color(fdd.accent.r * 0.4, fdd.accent.g * 0.4, fdd.accent.b * 0.4, fa))
		if head != null:
			_circle_tex(head, hc, 22.0, Color(1, 1, 1, fa))
		draw_arc(hc, 23, 0, TAU, 28, Color(fdd.accent.r, fdd.accent.g, fdd.accent.b, fa), 2.0, true)
		var nm := "%s  %s" % [fdd.name, "(CPU)" if f.cpu else "(YOU)"]
		text(nm, Vector2(rr.position.x + 108, rr.position.y + 35), 20, Color(1, 1, 1, fa))
		text(str(f.kos), Vector2(x + 300, rr.position.y + 35), 22, Color(1.0, 0.85, 0.3, fa))
		text(str(f.falls), Vector2(x + 370, rr.position.y + 35), 22, Color(1, 0.5, 0.5, fa))
		text("%d%%" % int(f.dealt), Vector2(x + 450, rr.position.y + 35), 22, Color(0.6, 0.85, 1.0, fa))
	draw_buttons()
	if _online() and not Net.is_host:
		text("Waiting for the host" + ".".repeat(int(t * 2.0) % 4), Vector2(vs.x - 560, vs.y - 60), 20, Color(1.0, 0.85, 0.3), HORIZONTAL_ALIGNMENT_LEFT, -1, false)


func _circle_tex(tex: Texture2D, c: Vector2, r: float, mod := Color.WHITE) -> void:
	var pts := PackedVector2Array()
	var uvs := PackedVector2Array()
	for k in 24:
		var a := k * TAU / 24.0
		var dd := Vector2(cos(a), sin(a))
		pts.append(c + dd * r)
		uvs.append(Vector2(0.5, 0.5) + dd * 0.5)
	draw_colored_polygon(pts, mod, uvs, tex)
