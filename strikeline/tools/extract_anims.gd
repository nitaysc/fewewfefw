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
					lib.add_animation(clip, ap.get_animation(n).duplicate(true))
			inst.free()
		var out := "res://assets/meshy/%s/anims.res" % id
		ResourceSaver.save(lib, out)
		print(id, ": ", lib.get_animation_list().size(), " clips -> ", out)
	quit()
