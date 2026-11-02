class_name Hud
extends Node2D
## Damage cards, countdown, KO popups, screen flash and the GAME! banner.

var arena
var bumps := {}
var flash_a := 0.0
var popups: Array = []
var game_t := -1.0
var t := 0.0
var shown_dmg := {}
var game_text := "GAME!"
var banner: Dictionary = {}
var sudden_t := -1.0


func flash(a: float) -> void:
	arena.net_rec([&"hud_flash", a])
	flash_a = maxf(flash_a, a)


func bump(port: int) -> void:
	arena.net_rec([&"hud_bump", port])
	bumps[port] = 1.0


func ko_popup(f: Fighter) -> void:
	arena.net_rec([&"hud_ko", f.port])
	popups.append({"port": f.port, "t": 0.0})


func game_set(txt := "GAME!") -> void:
	arena.net_rec([&"hud_game", txt])
	game_text = txt
	game_t = 0.0


func fs_banner(f: Fighter) -> void:
	arena.net_rec([&"hud_fs", f.port])
	var names := {"kai": "CRIMSON ECLIPSE", "bruno": "TITAN'S WRATH", "nyx": "THOUSAND SHADOWS", "sol": "STORMBREAKER"}
	banner = {"name": f.data.name, "move": names.get(f.data.id, "FINAL STRIKE"), "c": f.data.accent, "t": 0.0}


func sudden_death() -> void:
	arena.net_rec([&"hud_sudden"])
	sudden_t = 0.0


func _process(delta: float) -> void:
	t += delta
	var rd := delta / maxf(Engine.time_scale, 0.05)
	flash_a = maxf(0.0, flash_a - rd * 2.5)
	for k in bumps:
		bumps[k] = maxf(0.0, bumps[k] - rd * 3.0)
	for p in popups:
		p.t += rd
	while popups.size() > 0 and popups[0].t > 1.6:
		popups.pop_front()
	if game_t >= 0.0:
		game_t += rd
	if not banner.is_empty():
		banner.t += rd
		if banner.t > 1.8:
			banner = {}
	if sudden_t >= 0.0:
		sudden_t += rd
	queue_redraw()


static func dmg_color(d: float) -> Color:
	if d < 50.0:
		return Color(1, 1, 1).lerp(Color(1, 0.9, 0.45), d / 50.0)
	if d < 100.0:
		return Color(1, 0.9, 0.45).lerp(Color(1, 0.5, 0.2), (d - 50.0) / 50.0)
	if d < 160.0:
		return Color(1, 0.5, 0.2).lerp(Color(0.95, 0.12, 0.12), (d - 100.0) / 60.0)
	return Color(0.95, 0.12, 0.12).lerp(Color(0.55, 0.0, 0.05), clampf((d - 160.0) / 80.0, 0, 1))


func _draw() -> void:
	var vs := get_viewport_rect().size
	var fd: Font = Game.font_display
	var fb: Font = Game.font_body
	var fs: Array = arena.fighters
	var n := fs.size()
	var cw := 210.0
	var gap := 14.0
	var total := n * cw + (n - 1) * gap
	var x0 := (vs.x - total) * 0.5
	for i in n:
		var f: Fighter = fs[i]
		var x := x0 + i * (cw + gap)
		var y := 12.0
		var col: Color = arena.PORT_COLORS[i % 4]
		var acc: Color = f.data.accent
		var out := f.state == Fighter.S.OUT
		var a := 0.35 if out else 1.0
		# panel
		var panel := PackedVector2Array([Vector2(x + 14, y), Vector2(x + cw, y), Vector2(x + cw - 14, y + 78), Vector2(x, y + 78)])
		draw_colored_polygon(panel, Color(0.04, 0.04, 0.08, 0.72 * a))
		draw_polyline(panel + PackedVector2Array([panel[0]]), Color(col.r, col.g, col.b, 0.85 * a), 2.0, true)
		draw_rect(Rect2(x + 14, y, cw - 14, 4), Color(col.r, col.g, col.b, a))
		# portrait
		var pc := Vector2(x + 46, y + 42)
		draw_circle(pc, 27, Color(acc.r, acc.g, acc.b, 0.25 * a))
		draw_arc(pc, 27, 0, TAU, 40, Color(acc.r, acc.g, acc.b, 0.9 * a), 2.5, true)
		draw_circle(pc + Vector2(0, -3), 11, Color(f.data.body.r, f.data.body.g, f.data.body.b, a))
		draw_arc(pc + Vector2(0, -3), 11, 0, TAU, 24, Color(acc.r, acc.g, acc.b, a), 2.0, true)
		draw_line(pc + Vector2(-1, -5), pc + Vector2(8, -5), Color(1, 1, 1, a), 3.0, true)
		draw_line(pc + Vector2(0, 8), pc + Vector2(0, 22), Color(acc.r, acc.g, acc.b, a), 4.0, true)
		# name
		draw_string(fb, Vector2(x + 80, y + 24), f.data.name, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1, 1, 1, 0.85 * a))
		var tag := "CPU %d" % f.brain.level if f.is_cpu else "P%d" % (i + 1)
		draw_string(fb, Vector2(x + cw - 72, y + 24), tag, HORIZONTAL_ALIGNMENT_RIGHT, 50, 13, Color(col.r, col.g, col.b, a))
		# damage
		if not out:
			var d: float = f.damage
			var sd: float = shown_dmg.get(i, 0.0)
			sd = lerpf(sd, d, 0.35) if absf(sd - d) > 0.5 else d
			shown_dmg[i] = sd
			var b: float = bumps.get(i, 0.0)
			var off := Vector2(randf_range(-1, 1), randf_range(-1, 1)) * b * 6.0
			var dc := dmg_color(sd)
			var txt := "%d" % int(round(sd))
			var size := 40 + int(b * 10)
			var pos := Vector2(x + 80, y + 66) + off
			draw_string(fd, pos + Vector2(2, 3), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(0, 0, 0, 0.6))
			draw_string(fd, pos, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size, dc)
			var tw := fd.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
			draw_string(fd, pos + Vector2(tw + 3, 0), "%", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, dc)
			# stocks
			if arena.timed:
				draw_string(fb, Vector2(x + 26, y + 96), "SCORE %+d" % f.score, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1, 1, 1, 0.8))
			elif not arena.training:
				for s in mini(f.stocks, 8):
					var sc := Vector2(x + 26 + s * 14, y + 90)
					draw_circle(sc, 5.5, Color(acc.r, acc.g, acc.b))
					draw_arc(sc, 5.5, 0, TAU, 14, Color(1, 1, 1, 0.8), 1.2, true)
		else:
			draw_string(fd, Vector2(x + 80, y + 64), "OUT", HORIZONTAL_ALIGNMENT_LEFT, -1, 30, Color(0.7, 0.7, 0.75, 0.6))

	# KO popups at the side the fighter flew out
	for p in popups:
		var u: float = p.t
		var f: Fighter = fs[p.port]
		var s := 1.0 + maxf(0.0, 0.4 - u) * 2.0
		var aa := clampf(1.6 - u, 0.0, 1.0)
		var txt := "KO!"
		var c := Vector2(vs.x * 0.5, vs.y * 0.42)
		var size := int(64 * s)
		var tw := fd.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
		var col: Color = f.data.accent
		draw_string(fd, c + Vector2(-tw * 0.5 + 4, 5), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(0, 0, 0, 0.5 * aa))
		draw_string(fd, c + Vector2(-tw * 0.5, 0), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(col.r, col.g, col.b, aa))
		var nm: String = f.data.name
		var nw := fb.get_string_size(nm, HORIZONTAL_ALIGNMENT_LEFT, -1, 22).x
		draw_string(fb, c + Vector2(-nw * 0.5, 34), nm, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(1, 1, 1, aa * 0.8))

	# countdown
	if arena.countdown > 0:
		var cd: int = arena.countdown
		var txt := ""
		var u := 0.0
		if cd > 170:
			txt = "READY"
			u = (200 - cd) / 30.0
		elif cd > 120:
			txt = "3"
			u = (170 - cd) / 50.0
		elif cd > 70:
			txt = "2"
			u = (120 - cd) / 50.0
		elif cd > 20:
			txt = "1"
			u = (70 - cd) / 50.0
		else:
			txt = "GO!"
			u = (20 - cd) / 20.0
		_big_text(txt, Vector2(vs.x * 0.5, vs.y * 0.5), u, Color(1, 1, 1))
	elif arena.frame < 230 and arena.frame > 0 and not arena.training:
		var u: float = (arena.frame + 0.0) / 30.0
		if u < 1.0:
			_big_text("GO!", Vector2(vs.x * 0.5, vs.y * 0.5), 1.0 + u, Color(1, 0.85, 0.3))
	if arena.training:
		draw_string(fb, Vector2(24, vs.y - 24), "TRAINING  -  KO the dummy as often as you like", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1, 1, 1, 0.45))

	# GAME!
	if game_t >= 0.0:
		var u: float = game_t
		var s := 1.0 + maxf(0.0, 0.25 - u) * 4.0
		var cy := vs.y * 0.45
		var band := clampf(u * 4.0, 0.0, 1.0)
		draw_rect(Rect2(0, cy - 70 * band, vs.x, 140 * band), Color(0, 0, 0, 0.55))
		draw_rect(Rect2(0, cy - 72 * band, vs.x, 4), Color(1, 0.85, 0.3, 0.9))
		draw_rect(Rect2(0, cy + 68 * band, vs.x, 4), Color(1, 0.85, 0.3, 0.9))
		var size := int(110 * s)
		var txt := game_text
		var tw := fd.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
		draw_string(fd, Vector2(vs.x * 0.5 - tw * 0.5 + 6, cy + size * 0.36 + 6), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(0.8, 0.2, 0.1, 0.8))
		draw_string(fd, Vector2(vs.x * 0.5 - tw * 0.5, cy + size * 0.36), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(1, 0.95, 0.85))

	# timer (time mode)
	if arena.timed or arena.sudden:
		var txt := "SUDDEN DEATH" if arena.sudden else "%d:%02d" % [arena.time_left / 3600, (arena.time_left / 60) % 60]
		var col := Color(1, 0.4, 0.35) if (arena.sudden or arena.time_left < 600) else Color(1, 1, 1)
		var size := 30
		var tw := fd.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
		draw_rect(Rect2(vs.x * 0.5 - tw * 0.5 - 16, 104, tw + 32, 42), Color(0, 0, 0, 0.5))
		draw_string(fd, Vector2(vs.x * 0.5 - tw * 0.5, 136), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)
	if sudden_t >= 0.0 and sudden_t < 2.5:
		_big_text("SUDDEN DEATH", Vector2(vs.x * 0.5, vs.y * 0.45), sudden_t * 0.5, Color(1, 0.35, 0.3))

	# Final Smash ready badges
	for i in n:
		var f: Fighter = fs[i]
		if f.fs_ready:
			var x := x0 + i * (cw + gap)
			var hue := fmod(t * 0.4, 1.0)
			draw_rect(Rect2(x + 14, 12 + 78, cw - 28, 4), Color.from_hsv(hue, 0.6, 1.0))
			draw_string(fb, Vector2(x + 80, 12 + 104), "FINAL SMASH READY!", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.from_hsv(hue, 0.4, 1.0))

	# combo counter (training)
	if arena.training:
		for f in fs:
			if f.is_cpu and f.combo >= 2:
				var txt := "%d HIT COMBO!" % f.combo
				draw_string(fd, Vector2(vs.x * 0.5 - 140, vs.y * 0.3 + 3), txt, HORIZONTAL_ALIGNMENT_CENTER, 280, 34, Color(0, 0, 0, 0.5))
				draw_string(fd, Vector2(vs.x * 0.5 - 142, vs.y * 0.3), txt, HORIZONTAL_ALIGNMENT_CENTER, 280, 34, Color(1, 0.85, 0.3))

	# final smash cinematic: dark vignette + name banner
	if arena.focus != null:
		draw_rect(Rect2(Vector2.ZERO, vs), Color(0, 0, 0, 0.35))
	if not banner.is_empty():
		var u: float = banner.t
		var slide := clampf(u * 4.0, 0.0, 1.0)
		var fade := clampf((1.8 - u) * 3.0, 0.0, 1.0)
		var by := vs.y * 0.3
		var c: Color = banner.c
		var w := vs.x * slide
		draw_colored_polygon(PackedVector2Array([Vector2(vs.x - w, by - 50), Vector2(vs.x, by - 50), Vector2(vs.x, by + 46), Vector2(vs.x - w - 40, by + 46)]), Color(0, 0, 0, 0.75 * fade))
		draw_rect(Rect2(vs.x - w, by - 54, w, 5), Color(c.r, c.g, c.b, fade))
		draw_rect(Rect2(vs.x - w - 40, by + 44, w + 40, 5), Color(c.r, c.g, c.b, fade))
		draw_string(fb, Vector2(vs.x - w + 60, by - 18), banner.name + "'S FINAL SMASH", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(c.r, c.g, c.b, fade))
		draw_string(fd, Vector2(vs.x - w + 60, by + 30), banner.move, HORIZONTAL_ALIGNMENT_LEFT, -1, 46, Color(1, 1, 1, fade))

	if flash_a > 0.0:
		draw_rect(Rect2(Vector2.ZERO, vs), Color(1, 1, 1, flash_a * 0.6))


func _big_text(txt: String, c: Vector2, u: float, col: Color) -> void:
	var fd: Font = Game.font_display
	var s := 1.0 + maxf(0.0, 0.3 - u) * 3.0
	var a := clampf(1.6 - u, 0.0, 1.0)
	var size := int(120 * s)
	var tw := fd.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var p := c + Vector2(-tw * 0.5, size * 0.36)
	draw_string(fd, p + Vector2(5, 6), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(0, 0, 0, 0.5 * a))
	draw_string_outline(fd, p, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 10, Color(0.1, 0.05, 0.15, a))
	draw_string(fd, p, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(col.r, col.g, col.b, a))
