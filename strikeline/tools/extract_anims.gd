extends SceneTree
## Pulls the animation clips out of Meshy's per-batch GLBs (each one repeats the whole
## character mesh) into one small AnimationLibrary per fighter: assets/meshy/<id>/anims.res
func _initialize() -> void:
	for id in ["kai", "bruno", "nyx", "sol"]:
		var lib := AnimationLibrary.new()
		for f in ["anim_common", "anim_common2", "anim_" + id, "anim_run"]:
			var path := "res://assets/meshy/%s/%s.glb" % [id, f]
			if not ResourceLoader.exists(path):
				continue
			var inst := (load(path) as PackedScene).instantiate()
			var ap := inst.find_child("AnimationPlayer", true, false) as AnimationPlayer
			for n in ap.get_animation_list():
				var clip := n.get_slice("/", n.get_slice_count("/") - 1)
				if f == "anim_run":
					clip = "Running"
				if not lib.has_animation(clip):
					var a: Animation = ap.get_animation(n).duplicate(true)
					_strip_root_motion(a)
					lib.add_animation(clip, a)
			inst.free()
		var out := "res://assets/meshy/%s/anims.res" % id
		ResourceSaver.save(lib, out)
		print(id, ": ", lib.get_animation_list().size(), " clips -> ", out)
	quit()


## The game moves the fighters; keep the hips over the feet by removing the clip's
## horizontal travel (vertical motion like jumps and crouches stays).
func _strip_root_motion(a: Animation) -> void:
	for ti in a.get_track_count():
		if a.track_get_type(ti) != Animation.TYPE_POSITION_3D:
			continue
		if not String(a.track_get_path(ti)).ends_with(":Hips"):
			continue
		if a.track_get_key_count(ti) == 0:
			continue
		var p0: Vector3 = a.track_get_key_value(ti, 0)
		for k in a.track_get_key_count(ti):
			var p: Vector3 = a.track_get_key_value(ti, k)
			a.track_set_key_value(ti, k, Vector3(p0.x, p.y, p0.z))
