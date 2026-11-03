class_name Wipe
extends Node2D
## Smash-style screen transition: slanted coloured panels that start over the screen
## and slide away, revealing the new one.

const LEN := 0.5
var t := 0.0
var col := Color(1.0, 0.25, 0.32)


static func play(parent: Node, c := Color(1.0, 0.25, 0.32)) -> void:
	var layer := CanvasLayer.new()
	layer.layer = 40
	parent.add_child(layer)
	var w := Wipe.new()
	w.col = c
	layer.add_child(w)


func _process(delta: float) -> void:
	t += delta / maxf(Engine.time_scale, 0.05)
	if t > LEN:
		get_parent().queue_free()
		return
	queue_redraw()


func _draw() -> void:
	var vs := get_viewport_rect().size
	var sk := vs.y * 0.35
	var bands := [[0.0, Color(0.05, 0.04, 0.09)], [0.05, col], [0.1, Color(1, 1, 1)], [0.13, Color(0.05, 0.04, 0.09)]]
	for i in bands.size():
		var delay: float = bands[i][0]
		var u := clampf((t - delay) / (LEN - 0.15), 0.0, 1.0)
		u = u * u * (3.0 - 2.0 * u)
		# each band covers [x0, x1] and slides right off the screen
		var w := vs.x + sk * 2.0
		var x0 := -sk + u * (w + sk)
		var thick: float = [w, 60.0, 14.0, 34.0][i]
		var left := x0 if i == 0 else x0 - thick
		var right := vs.x + sk * 2.0 if i == 0 else x0
		if i > 0 and u >= 1.0:
			continue
		if i == 0:
			left = x0
		var c: Color = bands[i][1]
		draw_colored_polygon(PackedVector2Array([Vector2(left + sk, 0), Vector2(right + sk, 0), Vector2(right, vs.y), Vector2(left, vs.y)]), c)
	# logo slash on the main panel while it covers the screen
	if t < 0.09:
		var a := 1.0 - t / 0.09
		var fd: Font = Game.font_display
		draw_string(fd, Vector2(0, vs.y * 0.5 + 24), "STRIKELINE", HORIZONTAL_ALIGNMENT_CENTER, vs.x, 64, Color(1, 1, 1, 0.5 * a))
