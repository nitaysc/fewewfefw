class_name Stage
extends Node2D
## Stage geometry (platforms, ledges, blast zones) and its foreground art.

const STAGES := [
	{"name": "NEON SKYLINE", "sub": "Rooftop over a city that never sleeps"},
	{"name": "SUNSET SHRINE", "sub": "A floating island above the clouds"},
	{"name": "THE LINE", "sub": "No platforms. No excuses."},
]

var id := 0
var plats: Array = []      # {rect: Rect2, solid: bool}
var ledges: Array = []     # {pos: Vector2, side: float, plat: int}
var blast := Rect2(-1250, -1000, 2500, 1620)
var spawns: Array = []
var t := 0.0
var rng := RandomNumberGenerator.new()
var windows: Array = []
var deco: Array = []


func setup(stage_id: int) -> void:
	id = stage_id
	plats.clear()
	ledges.clear()
	rng.seed = 7 + id
	match id:
		0:
			_solid(Rect2(-470, 0, 940, 1400))
			_soft(Rect2(-340, -150, 210, 14))
			_soft(Rect2(130, -150, 210, 14))
			_soft(Rect2(-105, -290, 210, 14))
			spawns = [Vector2(-300, 0), Vector2(300, 0), Vector2(-120, 0), Vector2(120, 0)]
			for i in 220:
				var col := rng.randi_range(0, 17)
				var row := rng.randi_range(0, 26)
				windows.append(Vector2(-440 + col * 50 + 8, 70 + row * 46))
		1:
			_solid(Rect2(-520, 0, 1040, 64))
			_soft(Rect2(-360, -140, 200, 14))
			_soft(Rect2(160, -140, 200, 14))
			spawns = [Vector2(-320, 0), Vector2(320, 0), Vector2(-120, 0), Vector2(120, 0)]
			var pts := PackedVector2Array()
			pts.append(Vector2(-528, 20))
			var n := 22
			for i in range(n + 1):
				var u := float(i) / n
				var x := lerpf(-520, 520, u)
				var depth := 60.0 + sin(u * PI) * 300.0 + rng.randf_range(-30, 30)
				pts.append(Vector2(x, depth))
			pts.append(Vector2(528, 20))
			deco = [pts]
		_:
			_solid(Rect2(-560, 0, 1120, 46))
			spawns = [Vector2(-320, 0), Vector2(320, 0), Vector2(-120, 0), Vector2(120, 0)]
	for i in plats.size():
		var p: Dictionary = plats[i]
		if p.solid:
			var r: Rect2 = p.rect
			ledges.append({"pos": Vector2(r.position.x, r.position.y), "side": -1.0, "plat": i})
			ledges.append({"pos": Vector2(r.end.x, r.position.y), "side": 1.0, "plat": i})


func _solid(r: Rect2) -> void:
	plats.append({"rect": r, "solid": true})


func _soft(r: Rect2) -> void:
	plats.append({"rect": r, "solid": false})


func is_soft(i: int) -> bool:
	return i >= 0 and i < plats.size() and not plats[i].solid


func box_hits_solid(b: Rect2) -> bool:
	for p in plats:
		if p.solid and (p.rect as Rect2).grow(-1.0).intersects(b):
			return true
	return false


func ground_below(p: Vector2) -> float:
	var best := INF
	for pl in plats:
		var r: Rect2 = pl.rect
		if p.x >= r.position.x and p.x <= r.end.x and r.position.y >= p.y - 1.0 and r.position.y < best:
			best = r.position.y
	return best


func respawn_point(port: int) -> Vector2:
	var xs := [-160.0, 160.0, -60.0, 60.0]
	return Vector2(xs[port % 4], -360.0)


func main_rect() -> Rect2:
	return plats[0].rect


func _process(delta: float) -> void:
	t += delta
	queue_redraw()


func _draw() -> void:
	match id:
		0: _draw_rooftop()
		1: _draw_island()
		_: _draw_line_stage()


# ----------------------------------------------------------------- neon rooftop
func _draw_rooftop() -> void:
	var r: Rect2 = plats[0].rect
	# tower body
	var body := Rect2(r.position.x + 14, r.position.y + 26, r.size.x - 28, 1400)
	draw_rect(body, Color(0.07, 0.06, 0.12))
	for w in windows:
		var on := fmod(w.x * 0.37 + w.y * 0.11 + floor(t * 0.2 + w.x) * 0.0, 3.0) < 1.6
		var c := Color(1.0, 0.78, 0.45, 0.55) if on else Color(0.18, 0.2, 0.35, 0.6)
		if int(w.x + w.y) % 7 == 0:
			c = Color(0.4, 0.9, 1.0, 0.5)
		var fade := clampf(1.0 - (w.y - 60.0) / 1200.0, 0.0, 1.0)
		c.a *= fade
		draw_rect(Rect2(w, Vector2(26, 22)), c)
	# vertical light strips
	for x in [-300.0, 0.0, 300.0]:
		draw_rect(Rect2(x - 3, 30, 6, 1300), Color(0.9, 0.2, 0.9, 0.12))
	# roof slab
	draw_rect(Rect2(r.position.x, r.position.y, r.size.x, 28), Color(0.16, 0.15, 0.24))
	draw_rect(Rect2(r.position.x, r.position.y, r.size.x, 5), Color(0.55, 0.55, 0.75))
	var glow := 0.75 + 0.25 * sin(t * 3.0)
	draw_rect(Rect2(r.position.x, r.position.y + 24, r.size.x, 4), Color(1.0, 0.25, 0.85, glow))
	draw_rect(Rect2(r.position.x, r.position.y + 28, r.size.x, 10), Color(1.0, 0.25, 0.85, 0.15 * glow))
	# neon sign on the facade
	var sx := -120.0
	draw_rect(Rect2(sx, 70, 240, 64), Color(0.05, 0.03, 0.09))
	var flick := 1.0 if fmod(t, 4.3) > 0.12 else 0.3
	var font: Font = Game.font_display
	draw_string(font, Vector2(sx, 120), "STRIKE", HORIZONTAL_ALIGNMENT_CENTER, 240, 44, Color(0.3, 0.95, 1.0, 0.9 * flick))
	draw_rect(Rect2(sx, 70, 240, 64), Color(0.3, 0.95, 1.0, 0.5 * flick), false, 2.0)
	# soft platforms: hanging steel grates
	for i in range(1, plats.size()):
		var p: Rect2 = plats[i].rect
		draw_line(p.position + Vector2(10, 0), p.position + Vector2(10, -600), Color(0.3, 0.3, 0.4, 0.5), 2.0)
		draw_line(Vector2(p.end.x - 10, p.position.y), Vector2(p.end.x - 10, p.position.y - 600), Color(0.3, 0.3, 0.4, 0.5), 2.0)
		draw_rect(Rect2(p.position, Vector2(p.size.x, 12)), Color(0.2, 0.2, 0.3))
		draw_rect(Rect2(p.position, Vector2(p.size.x, 3)), Color(0.7, 0.7, 0.85))
		for k in range(0, int(p.size.x), 18):
			draw_line(p.position + Vector2(k, 3), p.position + Vector2(k + 9, 12), Color(0.1, 0.1, 0.16), 2.0)
		draw_rect(Rect2(p.position + Vector2(0, 12), Vector2(p.size.x, 3)), Color(0.3, 0.95, 1.0, 0.85))
		draw_rect(Rect2(p.position + Vector2(0, 15), Vector2(p.size.x, 10)), Color(0.3, 0.95, 1.0, 0.12))
	# roof props
	_ac_unit(Vector2(-430, 0))
	_ac_unit(Vector2(380, 0))


func _ac_unit(at: Vector2) -> void:
	draw_rect(Rect2(at + Vector2(0, -26), Vector2(50, 26)), Color(0.12, 0.12, 0.19))
	draw_rect(Rect2(at + Vector2(0, -26), Vector2(50, 3)), Color(0.4, 0.4, 0.55))
	draw_circle(at + Vector2(25, -13), 9, Color(0.07, 0.07, 0.12))
	var a := t * 9.0
	draw_line(at + Vector2(25, -13) + Vector2(cos(a), sin(a)) * 8, at + Vector2(25, -13) - Vector2(cos(a), sin(a)) * 8, Color(0.35, 0.35, 0.5), 2.0)


# ----------------------------------------------------------------- floating island
func _draw_island() -> void:
	var r: Rect2 = plats[0].rect
	var rock: PackedVector2Array = deco[0]
	draw_colored_polygon(rock, Color(0.24, 0.13, 0.16))
	# rock strata
	for k in 4:
		var y := 70.0 + k * 50.0
		var w := 470.0 - k * 95.0
		draw_line(Vector2(-w, y), Vector2(w, y + 8), Color(0.33, 0.18, 0.2), 4.0)
	# hanging roots & glow crystals
	for k in 9:
		var x := -400.0 + k * 100.0
		var len := 60.0 + fmod(k * 37.0, 80.0)
		draw_line(Vector2(x, 60), Vector2(x + sin(t + k) * 6.0, 60 + len), Color(0.2, 0.35, 0.2), 2.0)
	for k in 5:
		var c := Vector2(-260.0 + k * 130.0, 140.0 + fmod(k * 53.0, 90.0))
		var gl := 0.6 + 0.4 * sin(t * 2.0 + k)
		draw_circle(c, 16, Color(1.0, 0.6, 0.3, 0.12 * gl))
		draw_colored_polygon(PackedVector2Array([c + Vector2(0, -12), c + Vector2(6, 0), c + Vector2(0, 12), c + Vector2(-6, 0)]), Color(1.0, 0.7, 0.4, 0.9))
	# top surface
	draw_rect(Rect2(r.position.x, r.position.y, r.size.x, 22), Color(0.5, 0.36, 0.3))
	draw_rect(Rect2(r.position.x, r.position.y, r.size.x, 6), Color(0.45, 0.65, 0.3))
	draw_rect(Rect2(r.position.x, r.position.y + 6, r.size.x, 3), Color(0.28, 0.42, 0.2))
	for k in range(0, int(r.size.x), 64):
		draw_line(Vector2(r.position.x + k, 9), Vector2(r.position.x + k, 22), Color(0.36, 0.25, 0.22), 2.0)
	# lanterns at the edges
	for x in [r.position.x + 30.0, r.end.x - 30.0]:
		draw_line(Vector2(x, 0), Vector2(x, -70), Color(0.2, 0.1, 0.1), 4.0)
		var gl := 0.8 + 0.2 * sin(t * 4.0 + x)
		draw_circle(Vector2(x, -78), 22, Color(1.0, 0.55, 0.2, 0.18 * gl))
		draw_rect(Rect2(x - 9, -90, 18, 22), Color(0.85, 0.2, 0.15))
		draw_rect(Rect2(x - 6, -86, 12, 14), Color(1.0, 0.8, 0.4, gl))
		draw_rect(Rect2(x - 11, -92, 22, 4), Color(0.2, 0.1, 0.1))
	# wooden soft platforms
	for i in range(1, plats.size()):
		var p: Rect2 = plats[i].rect
		draw_line(p.position + Vector2(8, 4), p.position + Vector2(-20, 140), Color(0.5, 0.4, 0.3, 0.6), 2.0)
		draw_line(Vector2(p.end.x - 8, p.position.y + 4), Vector2(p.end.x + 20, p.position.y + 140), Color(0.5, 0.4, 0.3, 0.6), 2.0)
		draw_rect(Rect2(p.position, Vector2(p.size.x, 12)), Color(0.55, 0.33, 0.2))
		draw_rect(Rect2(p.position, Vector2(p.size.x, 3)), Color(0.85, 0.6, 0.4))
		for k in range(0, int(p.size.x), 25):
			draw_line(p.position + Vector2(k, 2), p.position + Vector2(k, 12), Color(0.35, 0.2, 0.12), 2.0)


# ----------------------------------------------------------------- the line
func _draw_line_stage() -> void:
	var r: Rect2 = plats[0].rect
	var pts := PackedVector2Array([
		Vector2(r.position.x, 0), Vector2(r.end.x, 0), Vector2(r.end.x - 30, r.size.y),
		Vector2(r.end.x - 160, r.size.y + 60), Vector2(r.position.x + 160, r.size.y + 60), Vector2(r.position.x + 30, r.size.y)])
	draw_colored_polygon(pts, Color(0.06, 0.07, 0.12))
	var pulse := 0.7 + 0.3 * sin(t * 2.0)
	draw_polyline(pts + PackedVector2Array([pts[0]]), Color(0.3, 0.9, 1.0, 0.6 * pulse), 2.0, true)
	draw_rect(Rect2(r.position.x, 0, r.size.x, 4), Color(0.85, 1.0, 1.0))
	draw_rect(Rect2(r.position.x, 4, r.size.x, 8), Color(0.3, 0.9, 1.0, 0.25 * pulse))
	for k in range(1, 8):
		var x := lerpf(r.position.x + 60, r.end.x - 60, k / 8.0)
		draw_line(Vector2(x, 14), Vector2(x * 0.8, r.size.y + 50), Color(0.3, 0.9, 1.0, 0.1), 1.5)
	draw_circle(Vector2(0, 0), 5, Color(1, 1, 1, 0.8))
