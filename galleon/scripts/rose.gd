extends Control
## Wind indicator: the ship points up; the arrow shows where the wind comes from.

var wind_rel := 0.0 ## radians, direction the wind comes FROM relative to the bow (+ = starboard)


func _ready() -> void:
	custom_minimum_size = Vector2(96, 96)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var c := size / 2.0
	var r := minf(size.x, size.y) * 0.5 - 4.0
	draw_circle(c, r, Color(0.03, 0.09, 0.16, 0.55))
	draw_arc(c, r, 0, TAU, 48, Color(1, 0.95, 0.85, 0.35), 1.5, true)
	for k in 8:
		var a := k * PI / 4.0
		var d := Vector2(sin(a), -cos(a))
		draw_line(c + d * r * 0.86, c + d * r * 0.98, Color(1, 1, 1, 0.4), 1.5)
	# ship silhouette
	var hull := PackedVector2Array([c + Vector2(0, -r * 0.42), c + Vector2(r * 0.13, -r * 0.1), c + Vector2(r * 0.12, r * 0.3), c + Vector2(-r * 0.12, r * 0.3), c + Vector2(-r * 0.13, -r * 0.1)])
	draw_colored_polygon(hull, Color(0.96, 0.92, 0.84, 0.9))
	# wind arrow on the rim, pointing inward
	var d := Vector2(sin(wind_rel), -cos(wind_rel))
	var tip := c + d * r * 0.5
	var tail := c + d * r * 0.95
	var side := Vector2(-d.y, d.x)
	draw_line(tail, tip + d * 6.0, Color(0.5, 0.85, 1.0), 4.0, true)
	draw_colored_polygon(PackedVector2Array([tip, tip + d * 12.0 + side * 7.0, tip + d * 12.0 - side * 7.0]), Color(0.5, 0.85, 1.0))
