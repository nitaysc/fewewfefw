extends Node2D
## Large close-up of all fighters for checking the model detail. Args: out_png
var n := 0
func _process(_d: float) -> void:
	n += 1
	queue_redraw()
	if n == 5:
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
		get_tree().quit()
func _draw() -> void:
	draw_rect(Rect2(0, 0, 1280, 720), Color(0.55, 0.45, 0.6))
	var poses := ["guard", "victory"]
	for i in 4:
		UiScreen.draw_fighter(self, i, Vector2(160 + i * 320, 330), 2.6, Roster.pose("guard"), 1.0)
		var mv := Roster.move(["fsmash", "fair", "nair", "usmash"][i])
		UiScreen.draw_fighter(self, i, Vector2(160 + i * 320, 680), 2.2, Roster.sample(mv.anim, 12.0), 1.0)
