extends Node
## Puts the workshop and the interface together.

func _ready() -> void:
	var w: Node3D = preload("res://src/farm.gd").new()
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
			"demo":
				Game.level = 3
				Game.fields = 2
				Game.coins = 300
				Game.wood = 6
				Game.seeds = {"onion": 5, "potato": 4, "gazania": 3}
				Game.owned = {"farmhand": true}
				var ps: Array = w.plots
				var states := [["ripe", "onion"], ["ripe", "potato"], ["planted", "gazania"], ["tilled", ""], ["planted", "onion"], ["ripe", "gazania"], ["grass", ""], ["planted", "potato"], ["tilled", ""]]
				for i in ps.size():
					var st2: Array = states[i % states.size()]
					ps[i].state = st2[0]
					ps[i].crop = st2[1]
					ps[i].growth = 1.0 if st2[0] == "ripe" else 0.5
					ps[i].wet = i % 2 == 0
					w._plot_visual(ps[i])
				w.spawn_helper()
				w.player.hold({"t": "potato", "n": 4})
			"dig":
				w.player.position = w.plots[0].global_position + Vector3(0, 0, 0.8)
				w.player.yaw_goal = PI
				await get_tree().create_timer(0.3).timeout
				w.press()
			"night":
				Game.clock = 0.9
			"shop":
				h._shop()
	await get_tree().create_timer(float(args.get("wait", "3"))).timeout
	get_viewport().get_texture().get_image().save_png(args.shot)
	print("SHOT ", args.shot)
	get_tree().quit()
