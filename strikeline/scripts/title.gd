class_name TitleScreen
extends UiScreen
## Title: logo over a live CPU battle, main buttons and the how-to-play sheet.

var help := false


func layout() -> void:
	var vs := get_viewport_rect().size
	if help:
		add_btn("close", Rect2(vs.x * 0.5 - 120, vs.y - 96, 240, 62), "GOT IT", "gold")
		return
	var x := vs.x * 0.5 - 170
	var y := vs.y * 0.56
	add_btn("fight", Rect2(x, y, 340, 78), "FIGHT", "primary")
	add_btn("training", Rect2(x + 10, y + 94, 155, 56), "TRAINING", "secondary")
	add_btn("help", Rect2(x + 175, y + 94, 155, 56), "HOW TO PLAY", "secondary")


func on_button(id: String) -> void:
	match id:
		"fight", "enter":
			if help:
				help = false
			else:
				main.show_select("versus")
		"training":
			main.show_select("training")
		"help":
			help = true
		"close", "back":
			help = false


func _draw() -> void:
	var vs := get_viewport_rect().size
	# vignette
	draw_rect(Rect2(Vector2.ZERO, vs), Color(0.02, 0.02, 0.06, 0.35))
	var top := PackedVector2Array([Vector2(0, 0), Vector2(vs.x, 0), Vector2(vs.x, vs.y * 0.5), Vector2(0, vs.y * 0.5)])
	draw_polygon(top, PackedColorArray([Color(0, 0, 0, 0.55), Color(0, 0, 0, 0.55), Color(0, 0, 0, 0), Color(0, 0, 0, 0)]))
	if help:
		_draw_help(vs)
		draw_buttons()
		return
	var e := enter_t
	var cx := vs.x * 0.5
	var ly := vs.y * 0.3
	# logo slash
	var sw := 560.0 * e
	var slash := PackedVector2Array([Vector2(cx - sw, ly + 26), Vector2(cx + sw, ly - 30), Vector2(cx + sw, ly - 18), Vector2(cx - sw, ly + 34)])
	draw_colored_polygon(slash, Color(1.0, 0.25, 0.32, 0.9))
	var slash2 := PackedVector2Array([Vector2(cx - sw * 0.8, ly + 42), Vector2(cx + sw * 0.9, ly - 8), Vector2(cx + sw * 0.9, ly - 3), Vector2(cx - sw * 0.8, ly + 46)])
	draw_colored_polygon(slash2, Color(1, 1, 1, 0.6))
	var fd: Font = Game.font_display
	var size := 118
	var title := "STRIKELINE"
	var tw := fd.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var p := Vector2(cx - tw * 0.5, ly + 38)
	draw_string(fd, p + Vector2(7, 9), title, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(0, 0, 0, 0.6))
	draw_string_outline(fd, p, title, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 14, Color(0.08, 0.04, 0.1))
	draw_string(fd, p, title, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(1, 1, 1))
	# glint sweeping across the logo
	var gx := fmod(t * 0.45, 2.2) - 0.6
	if gx > 0.0 and gx < 1.0:
		var gxx := p.x + tw * gx
		draw_colored_polygon(PackedVector2Array([Vector2(gxx, ly - 70), Vector2(gxx + 22, ly - 70), Vector2(gxx - 8, ly + 48), Vector2(gxx - 30, ly + 48)]), Color(1, 1, 1, 0.22))
	text("STICK  BRAWL", Vector2(0, ly + 82), 28, Color(1.0, 0.82, 0.4), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
	draw_buttons()
	text("v1.1  ·  4 fighters  ·  3 stages  ·  Final Smashes", Vector2(0, vs.y - 18), 14, Color(1, 1, 1, 0.4), HORIZONTAL_ALIGNMENT_CENTER, vs.x, false)


func _draw_help(vs: Vector2) -> void:
	var r := Rect2(vs.x * 0.5 - 520, 28, 1040, vs.y - 140)
	draw_rect(r, Color(0.04, 0.04, 0.09, 0.93))
	draw_rect(Rect2(r.position, Vector2(r.size.x, 5)), Color(1.0, 0.25, 0.32))
	text_shadow("HOW TO PLAY", r.position + Vector2(36, 62), 40, Color(1, 1, 1))
	text("Rack up damage, then launch rivals past the edge of the screen. The higher the %, the further they fly.",
		r.position + Vector2(36, 96), 16, Color(1, 1, 1, 0.75), HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 72, false)
	var rows := [
		["STICK", "Run, crouch, aim your attacks. Push down on a thin platform to drop through, flick down in the air to fast-fall."],
		["ATTACK", "Tap for jab or a tilt in the stick's direction. In the air: neutral, forward, back, up and down aerials."],
		["SMASH", "Flick the stick and press ATTACK at the same time. Hold ATTACK to charge it for a bigger hit."],
		["SPECIAL", "Neutral, side, up and down specials. UP + SPECIAL is your recovery when you're knocked off the stage."],
		["JUMP", "Jump, then jump again in the air (Nyx gets three). Grab ledges automatically when you're close."],
		["SHIELD", "Hold to block. Shield + left/right rolls, + down dodges in place, in the air it's an air dodge."],
		["GRAB", "SHIELD + ATTACK grabs. ATTACK to pummel, push the stick to throw. Mash buttons to escape a grab."],
		["FINAL", "Break the glowing Strike Core, then press SPECIAL to unleash your Final Smash!"],
		["ITEMS", "ATTACK near a bomb to pick it up, ATTACK again to throw. Touch food to heal."],
		["TECH", "SHIELD just before landing while tumbling to recover. Drop SHIELD right before a hit to parry."],
	]
	var y := r.position.y + 140
	var cols := [Color(1, 1, 1), Color(1.0, 0.35, 0.35), Color(1.0, 0.6, 0.25), Color(0.4, 0.7, 1.0), Color(0.4, 1.0, 0.6), Color(1.0, 0.85, 0.3), Color(1.0, 0.5, 0.8), Color(1.0, 0.8, 0.4), Color(0.6, 1.0, 0.8), Color(0.8, 0.6, 1.0)]
	for i in rows.size():
		var row: Array = rows[i]
		text(row[0], Vector2(r.position.x + 36, y + 20), 20, cols[i])
		text(row[1], Vector2(r.position.x + 180, y + 20), 15, Color(1, 1, 1, 0.85), HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 220, false)
		y += minf(54.0, (r.size.y - 160) / rows.size())
