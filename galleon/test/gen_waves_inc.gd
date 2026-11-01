extends SceneTree
## Writes shaders/waves.gdshaderinc from scripts/waves.gd (run after changing the wave table):
##   godot --headless --script res://test/gen_waves_inc.gd
func _init() -> void:
	var w = load("res://scripts/waves.gd").new()
	var f := FileAccess.open("res://shaders/waves.gdshaderinc", FileAccess.WRITE)
	f.store_string("// Generated from scripts/waves.gd by test/gen_waves_inc.gd. Do not edit.\n" + w.glsl_constants())
	f.close()
	print("wrote shaders/waves.gdshaderinc")
	quit()
