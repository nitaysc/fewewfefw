extends SceneTree
## Pulls the animation clips out of Meshy's per-batch GLBs (each one repeats the whole
## character mesh) into one small AnimationLibrary per fighter: assets/meshy/<id>/anims.res
## Fighters without their own animation batches borrow clips from others (all Meshy rigs
## share one skeleton): later sources only add clips the earlier ones don't have.
## Bodies far from the source's proportions (Pip is a chibi) get their clips retargeted:
## rotations applied relative to each rig's rest pose, hip height scaled to the new body.
const RETARGET := {"pip": true}
const BORROW := {"bolt": ["bruno", "sol_w"], "pip": ["nyx_w", "bruno"]}


func _initialize() -> void:
	for id in FighterView3D.MODEL_DIRS.values():
		if BORROW.has(id):
			continue
		_extract(id)
	for id in BORROW:
		var lib := _extract(id, false)   # its own clips first (if any were made for it)
		var tgt := _rest(id)
		for src in BORROW[id]:
			var sl: AnimationLibrary = load("res://assets/meshy/%s/anims.res" % src)
			var srest := _rest(src)
			for n in sl.get_animation_list():
				if not lib.has_animation(n):
					var a: Animation = sl.get_animation(n).duplicate(true)
					if RETARGET.has(id):
						_retarget(a, srest, tgt)
					lib.add_animation(n, a)
		ResourceSaver.save(lib, "res://assets/meshy/%s/anims.res" % id)
		print(id, ": ", lib.get_animation_list().size(), " clips (own + borrowed from ", BORROW[id], ")")
	quit()


func _extract(id: String, save := true) -> AnimationLibrary:
	if true:
		var lib := AnimationLibrary.new()
		for f in ["anim_common", "anim_common2", "anim_" + id.get_slice("_", 0), "anim_move", "anim_move2", "anim_run"]:
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
		if save:
			ResourceSaver.save(lib, out)
			print(id, ": ", lib.get_animation_list().size(), " clips -> ", out)
		return lib
	return null


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


## bone name -> local rest Transform3D
func _rest(dir: String) -> Dictionary:
	var inst := (load("res://assets/meshy/%s/rigged.glb" % dir) as PackedScene).instantiate()
	var out := {}
	for sk in inst.find_children("*", "Skeleton3D", true, false):
		for b in sk.get_bone_count():
			out[sk.get_bone_name(b)] = sk.get_bone_rest(b)
	inst.free()
	return out


func _retarget(a: Animation, src: Dictionary, dst: Dictionary) -> void:
	var hs: float = (src["Hips"] as Transform3D).origin.y
	var hd: float = (dst["Hips"] as Transform3D).origin.y
	for ti in a.get_track_count():
		var bone := String(a.track_get_path(ti)).get_slice(":", 1)
		if not src.has(bone) or not dst.has(bone):
			continue
		var rs: Transform3D = src[bone]
		var rd: Transform3D = dst[bone]
		match a.track_get_type(ti):
			Animation.TYPE_ROTATION_3D:
				var qs := rs.basis.get_rotation_quaternion()
				var qd := rd.basis.get_rotation_quaternion()
				for k in a.track_get_key_count(ti):
					var q: Quaternion = a.track_get_key_value(ti, k)
					a.track_set_key_value(ti, k, (qd * qs.inverse() * q).normalized())
			Animation.TYPE_POSITION_3D:
				for k in a.track_get_key_count(ti):
					var p: Vector3 = a.track_get_key_value(ti, k)
					if bone == "Hips":
						a.track_set_key_value(ti, k, rd.origin + (p - rs.origin) * (hd / hs))
					else:
						a.track_set_key_value(ti, k, rd.origin)
