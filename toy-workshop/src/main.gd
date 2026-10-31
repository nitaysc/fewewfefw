extends Node
## Puts the workshop and the interface together.

func _ready() -> void:
	var w: Node3D = preload("res://src/world.gd").new()
	add_child(w)
	var h: CanvasLayer = preload("res://src/hud.gd").new()
	add_child(h)
	h.bind(w)
	# for automatic screenshots: godot -- shot=<file> wait=<seconds> [fresh] [skip] [act=...]
	var args := {}
	for a in OS.get_cmdline_user_args():
		var kv := a.split("=")
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	if args.has("shot"):
		_shoot(args, w, h)
	if args.has("icon"):
		var im := IconMaker.new()
		im.SIZE = 512
		add_child(im)
		var tex := im.toy("car", "red")
		await get_tree().create_timer(1.5).timeout
		tex.get_image().save_png(args.icon)
		get_tree().quit()

func _shoot(args: Dictionary, w: Node3D, h: CanvasLayer) -> void:
	if args.has("skip"):
		h._close_modal()
	for i in int(args.get("acts", "0")):
		pass
	var steps: Array = String(args.get("act", "")).split(",", false)
	for st in steps:
		await get_tree().create_timer(float(args.get("gap", "1.0"))).timeout
		match st:
			"select": w.select(Vector2i(5, 2))
			"drawer": h.open_drawer()
			"build": h._start("saw")
			"level": Game.add_xp(Data.xp_for(Game.level))
			"rich": Game.coins += 2000
	await get_tree().create_timer(float(args.get("wait", "3"))).timeout
	get_viewport().get_texture().get_image().save_png(args.shot)
	print("SHOT ", args.shot)
	get_tree().quit()
