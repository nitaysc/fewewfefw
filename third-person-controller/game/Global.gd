extends Node

var multiplayer_type : String = "None"
var ip_address : String = ""

func _input(_event: InputEvent) -> void:
	# Toggle between fullscreen and maximized window modes when "fullscreen" action is pressed
	if Input.is_action_just_pressed("fullscreen"):
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN if DisplayServer.window_get_mode() != DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_MAXIMIZED)


# True on phones/tablets (or when started with --touch to try the controls on a PC).
func touch_mode() -> bool:
	return OS.has_feature("mobile") or DisplayServer.is_touchscreen_available() \
		or "--touch" in OS.get_cmdline_user_args()


func back_to_menu() -> void:
	if multiplayer.multiplayer_peer and not multiplayer.multiplayer_peer is OfflineMultiplayerPeer:
		multiplayer.multiplayer_peer.close()
		multiplayer.multiplayer_peer = null
	multiplayer_type = "None"
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().change_scene_to_file("res://Menu/menu.tscn")


# Android back button: leave the level, or quit from the menu.
func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		var scene := get_tree().current_scene
		if scene and scene.scene_file_path == "res://World/world.tscn":
			back_to_menu()
		else:
			get_tree().quit()
