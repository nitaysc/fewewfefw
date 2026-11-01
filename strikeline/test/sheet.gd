extends Node2D
## Draws every move of one fighter as a pose strip, then saves a PNG. Args: out_png fighter_idx
var moves := ["jab1", "jab2", "jab3", "ftilt", "utilt", "dtilt", "dash", "fsmash", "usmash", "dsmash", "nair", "fair", "bair", "uair", "dair"]
var out := "/tmp/sheet.png"
var fi := 0
var n := 0

func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	if a.size() > 0: out = a[0]
	if a.size() > 1: fi = int(a[1])
	if a.size() > 2 and a[2] == "specials":
		var d: Dictionary = Roster.fighter(fi)
		moves = [d.specials.nb, d.specials.sb, d.specials.ub, d.specials.db]
		for extra in ["kai_counter", "bruno_plunge"]:
			if extra.begins_with(d.id): moves.append(extra)
		moves.append_array(["@guard", "@crouch", "@air_t", "@air_fall", "@shield", "@hurt", "@tumble", "@lying", "@ledge", "@dizzy", "@victory", "@ball"])

func _process(_d: float) -> void:
	n += 1
	queue_redraw()
	if n == 5:
		get_viewport().get_texture().get_image().save_png(out)
		get_tree().quit()

func _draw() -> void:
	draw_rect(Rect2(0, 0, 2000, 2000), Color(0.75, 0.78, 0.85))
	var cols := 8
	for r in moves.size():
		var name: String = moves[r]
		var y := 20 + r * 66 if moves.size() > 10 else 40 + r * 120
		var sc := 0.55 if moves.size() > 10 else 0.9
		draw_string(ThemeDB.fallback_font, Vector2(4, y + 30), name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0, 0, 0))
		if name.begins_with("@"):
			UiScreen.draw_fighter(self, fi, Vector2(140, y + 55), sc, Roster.pose(name.substr(1)), 1.0)
			continue
		var mv := Roster.move(name)
		var len: float = mv.len
		for c in cols:
			var f := len * c / (cols - 1)
			var p := Roster.sample(mv.anim, f)
			var x := 140 + c * 110
			UiScreen.draw_fighter(self, fi, Vector2(x, y + (55 if moves.size() > 10 else 100)), sc, p, 1.0)
			# mark hit frames
			for h in mv.hits:
				if f >= h.f[0] and f <= h.f[1]:
					draw_circle(Vector2(x - 40, y + 8), 4, Color(1, 0, 0))
