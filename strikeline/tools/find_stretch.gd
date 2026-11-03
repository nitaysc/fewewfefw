extends SceneTree
## Finds triangles that stretch badly in any animation (weld seams between hands, robes,
## capes and the body) by skinning the mesh on the CPU over samples of every clip.
## Writes assets/meshy/<model>/cut.json with the triangle indices to drop.
const LIMIT := 6.0
## Only these models need it (their hands rest on the robe/skirt in the base pose).
const CUT_MODELS := ["kai_w", "sol_w"]

func _initialize() -> void:
	for id in FighterView3D.MODEL_DIRS.values():
		var inst := (load("res://assets/meshy/%s/rigged.glb" % id) as PackedScene).instantiate()
		root.add_child(inst)
		var mi := inst.find_children("*", "MeshInstance3D", true, false)[0] as MeshInstance3D
		WeaponSkin.apply(id, mi, true)
		var sk := mi.get_node(mi.skeleton) as Skeleton3D
		var skin := mi.skin
		var arr := mi.mesh.surface_get_arrays(0)
		var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var bones: PackedInt32Array = arr[Mesh.ARRAY_BONES]
		var w: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		var per := bones.size() / v.size()
		var nb := skin.get_bind_count()
		var bind_bone := PackedInt32Array()
		for i in nb:
			bind_bone.append(sk.find_bone(skin.get_bind_name(i)))
		var lib: AnimationLibrary = load("res://assets/meshy/%s/anims.res" % id)
		var rest_pos := _skin(v, bones, w, per, _rest_globals(sk), skin, bind_bone)
		var ntri := idx.size() / 3
		var rest_len := PackedFloat32Array()
		rest_len.resize(ntri * 3)
		for t in ntri:
			for e in 3:
				rest_len[t * 3 + e] = maxf(rest_pos[idx[t * 3 + e]].distance_to(rest_pos[idx[t * 3 + (e + 1) % 3]]), 1e-4)
		var clips := []
		for name in lib.get_animation_list():
			var an := lib.get_animation(name)
			for k in 5:
				clips.append(_anim_globals(sk, an, an.length * (k + 0.5) / 5.0))
		var samples := clips.size()
		var worst := _worst(v, bones, w, per, idx, rest_len, clips, skin, bind_bone)
		# pass 2: the hand vertices caught in stretched triangles become pure arm
		var rebind := {}
		if CUT_MODELS.has(id):
			for side in ["Left", "Right"]:
				var hb := -1
				var arm := {}
				var hpos := Vector3.INF
				for i in skin.get_bind_count():
					var bn := skin.get_bind_name(i)
					if bn in [side + "Arm", side + "ForeArm", side + "Hand"]:
						arm[i] = true
					if bn == side + "Hand":
						hpos = skin.get_bind_pose(i).affine_inverse().origin
						hb = i
				if hb < 0:
					continue
				for t in ntri:
					if worst[t] <= LIMIT:
						continue
					for e in 3:
						var vi := idx[t * 3 + e]
						if rebind.has(vi) or v[vi].distance_to(hpos) > 0.15:
							continue
						var share := 0.0
						for k in per:
							if arm.has(bones[vi * per + k]):
								share += w[vi * per + k]
						if share <= 0.0:
							continue
						# mostly hand -> pure arm; mostly body (scarf, robe) -> pure body
						var to_arm := share >= 0.4
						var sum := 0.0
						for k in per:
							if arm.has(bones[vi * per + k]) != to_arm:
								w[vi * per + k] = 0.0
							sum += w[vi * per + k]
						if sum <= 0.0:
							continue
						for k in per:
							w[vi * per + k] /= sum
						rebind[vi] = side if to_arm else "body:" + side
			worst = _worst(v, bones, w, per, idx, rest_len, clips, skin, bind_bone)
		var hist := ""
		for th in [2.0, 3.0, 4.0, 6.0, 10.0, 20.0]:
			var c := 0
			for t in ntri:
				if worst[t] > th:
					c += 1
			hist += " >%.0fx:%d" % [th, c]
		print(id, hist)
		var cut: Array = []
		if CUT_MODELS.has(id):
			for t in ntri:
				if worst[t] > LIMIT:
					cut.append(t)
		var f := FileAccess.open("res://assets/meshy/%s/cut.json" % id, FileAccess.WRITE)
		f.store_string(JSON.stringify({"cut": cut, "rebind": rebind}))
		f.close()
		print("%s: %d poses, rebound %d hand vertices, cut %d of %d triangles over %.1fx" % [id, samples, rebind.size(), cut.size(), ntri, LIMIT])
		inst.queue_free()
	quit()


func _worst(v: PackedVector3Array, bones: PackedInt32Array, w: PackedFloat32Array, per: int, idx: PackedInt32Array,
		rest_len: PackedFloat32Array, clips: Array, skin: Skin, bind_bone: PackedInt32Array) -> PackedFloat32Array:
	var ntri := idx.size() / 3
	var worst := PackedFloat32Array()
	worst.resize(ntri)
	for g in clips:
		var p := _skin(v, bones, w, per, g, skin, bind_bone)
		for t in ntri:
			for e in 3:
				var r := p[idx[t * 3 + e]].distance_to(p[idx[t * 3 + (e + 1) % 3]]) / rest_len[t * 3 + e]
				if r > worst[t]:
					worst[t] = r
	return worst


func _rest_globals(sk: Skeleton3D) -> Array:
	var g := []
	g.resize(sk.get_bone_count())
	for b in sk.get_bone_count():
		var par := sk.get_bone_parent(b)
		g[b] = (g[par] as Transform3D) * sk.get_bone_rest(b) if par >= 0 else sk.get_bone_rest(b)
	return g


func _anim_globals(sk: Skeleton3D, a: Animation, t: float) -> Array:
	var tr := {}
	for ti in a.get_track_count():
		var bi := sk.find_bone(String(a.track_get_path(ti)).get_slice(":", 1))
		if bi < 0:
			continue
		if not tr.has(bi):
			tr[bi] = {}
		match a.track_get_type(ti):
			Animation.TYPE_POSITION_3D: tr[bi].pos = ti
			Animation.TYPE_ROTATION_3D: tr[bi].rot = ti
			Animation.TYPE_SCALE_3D: tr[bi].scl = ti
	var g := []
	g.resize(sk.get_bone_count())
	for b in sk.get_bone_count():
		var rest := sk.get_bone_rest(b)
		var pos := rest.origin
		var rot := rest.basis.get_rotation_quaternion()
		var scl := rest.basis.get_scale()
		if tr.has(b):
			if tr[b].has("pos"): pos = a.position_track_interpolate(tr[b].pos, t)
			if tr[b].has("rot"): rot = a.rotation_track_interpolate(tr[b].rot, t)
			if tr[b].has("scl"): scl = a.scale_track_interpolate(tr[b].scl, t)
		var local := Transform3D(Basis(rot).scaled(scl), pos)
		var par := sk.get_bone_parent(b)
		g[b] = (g[par] as Transform3D) * local if par >= 0 else local
	return g


func _skin(v: PackedVector3Array, bones: PackedInt32Array, w: PackedFloat32Array, per: int, g: Array, skin: Skin, bind_bone: PackedInt32Array) -> PackedVector3Array:
	var mats := []
	for i in skin.get_bind_count():
		mats.append((g[bind_bone[i]] as Transform3D) * skin.get_bind_pose(i))
	var out := PackedVector3Array()
	out.resize(v.size())
	for i in v.size():
		var p := Vector3.ZERO
		for k in per:
			var x := w[i * per + k]
			if x > 0.0:
				p += (mats[bones[i * per + k]] as Transform3D) * v[i] * x
		out[i] = p
	return out
