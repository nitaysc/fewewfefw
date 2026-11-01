class_name PauseMenu
extends UiScreen
## In-match pause overlay.

var arena


func layout() -> void:
	var vs := get_viewport_rect().size
	add_btn("resume", Rect2(vs.x * 0.5 - 150, vs.y * 0.5 - 20, 300, 76), "RESUME", "primary")
	add_btn("quit", Rect2(vs.x * 0.5 - 120, vs.y * 0.5 + 76, 240, 58), "QUIT MATCH", "secondary")


func on_button(id: String) -> void:
	match id:
		"resume", "enter", "back":
			arena.set_paused(false)
		"quit":
			arena.quit_to_menu()


func _draw() -> void:
	var vs := get_viewport_rect().size
	dim(0.7)
	text_shadow("PAUSED", Vector2(0, vs.y * 0.5 - 70), 72, Color(1, 1, 1), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
	draw_buttons()
