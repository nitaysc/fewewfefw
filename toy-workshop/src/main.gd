extends Node
## Puts the workshop and the interface together.

func _ready() -> void:
	var w: Node3D = preload("res://src/workshop.gd").new()
	var h: CanvasLayer = preload("res://src/hud.gd").new()
	add_child(w)
	add_child(h)
	h.bind(w)
	# automatic screenshots: godot -- shot=<file> wait=<s> act=start,demo,...
	var args := {}
	for a in OS.get_cmdline_user_args():
		var kv := a.split("=")
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	if args.has("shot"):
		_shoot(args, w, h)

func _shoot(args: Dictionary, w: Node3D, h: CanvasLayer) -> void:
	for st in String(args.get("act", "")).split(",", false):
		await get_tree().create_timer(0.6).timeout
		match st:
			"start":
				Game.seen_intro = true
				h.close_modal()
				h._begin()
			"demo":
				Game.level = 3
				Game.owned = {"sawyer": true, "turner": true, "painter": true}
				w.spawn_helpers()
				var s: Dictionary = w.stations
				s.saw.put({"t": "lumber", "c": "wood"})
				s.saw.items.append_array([{"t": "block", "c": "wood"}, {"t": "block", "c": "wood"}])
				s.saw._refresh()
				s.lathe.items = [{"t": "wheel", "c": "wood"}, {"t": "wheel", "c": "wood"}, {"t": "peg", "c": "wood"}]
				s.lathe._refresh()
				s.paint.items = [{"t": "block", "c": "red"}, {"t": "wheel", "c": "blue"}]
				s.paint._refresh()
				s.bench.items = [{"t": "block", "c": "yellow"}, {"t": "wheel", "c": "wood"}, {"t": "wheel", "c": "wood"}]
				s.bench._refresh()
				w.player.hold({"t": "car", "c": "red"})
				w.player.position = Vector3(1.2, 0, 0.4)
			"near":
				w.player.position = Vector3(-2.7, 0, -3.1)
				w.player.yaw_goal = PI
			"zoom":
				w.zoom = 0.6
			"work":
				w.player.hold({})
				w.player.position = Vector3(-2.7, 0, -3.15)
				w.player.yaw_goal = PI
				w.stations.saw.items = [{"t": "lumber", "c": "wood"}]
				w.stations.saw._refresh()
				await get_tree().create_timer(0.3).timeout
				w.press()
			"dayover":
				Game.time_left = 0.5
			"shop":
				h._shop()
	await get_tree().create_timer(float(args.get("wait", "3"))).timeout
	get_viewport().get_texture().get_image().save_png(args.shot)
	print("SHOT ", args.shot)
	get_tree().quit()
