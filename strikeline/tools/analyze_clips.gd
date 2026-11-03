extends SceneTree
## Measures every fighter clip: length, the moment each limb moves fastest (the "impact"),
## and how far the hips travel. Writes assets/meshy/clipinfo.json.
const LIMBS := ["RightHand", "LeftHand", "RightFoot", "LeftFoot"]

func _initialize() -> void:
	var info := {}
	for id in FighterView3D.MODEL_DIRS.values():
		var inst := (load("res://assets/meshy/%s/rigged.glb" % id) as PackedScene).instantiate() as Node3D
		root.add_child(inst)
		var ap := AnimationPlayer.new()
		inst.add_child(ap)
		ap.add_animation_library("m", load("res://assets/meshy/%s/anims.res" % id))
		var sk := inst.find_child("Skeleton3D", true, false) as Skeleton3D
		var scale := (sk.get_parent() as Node3D).scale.x
		var fi := {}
		for name in ap.get_animation_list():
			var a := ap.get_animation(name)
			# map tracks to bones
			var tr := {}
			for ti in a.get_track_count():
				var path := String(a.track_get_path(ti))
				var bone := path.get_slice(":", 1)
				var bi := sk.find_bone(bone)
				if bi < 0:
					continue
				if not tr.has(bi):
					tr[bi] = {}
				match a.track_get_type(ti):
					Animation.TYPE_POSITION_3D: tr[bi].pos = ti
					Animation.TYPE_ROTATION_3D: tr[bi].rot = ti
					Animation.TYPE_SCALE_3D: tr[bi].scl = ti
			var prev := {}
			var best := {}
			var hips0 := Vector3.ZERO
			var hips_max := 0.0
			var n := int(a.length * 60.0)
			for k in n + 1:
				var t := minf(k / 60.0, a.length)
				var g := []
				g.resize(sk.get_bone_count())
				for bi in sk.get_bone_count():
					var rest := sk.get_bone_rest(bi)
					var pos := rest.origin
					var rot := rest.basis.get_rotation_quaternion()
					var scl := rest.basis.get_scale()
					if tr.has(bi):
						if tr[bi].has("pos"): pos = a.position_track_interpolate(tr[bi].pos, t)
						if tr[bi].has("rot"): rot = a.rotation_track_interpolate(tr[bi].rot, t)
						if tr[bi].has("scl"): scl = a.scale_track_interpolate(tr[bi].scl, t)
					var local := Transform3D(Basis(rot).scaled(scl), pos)
					var par := sk.get_bone_parent(bi)
					g[bi] = (g[par] as Transform3D) * local if par >= 0 else local
				for l in LIMBS:
					var p: Vector3 = (g[sk.find_bone(l)] as Transform3D).origin * scale
					if prev.has(l):
						var sp: float = (p - prev[l]).length() * 60.0
						if sp > best.get(l, [0.0, 0.0])[0]:
							best[l] = [sp, t]
					prev[l] = p
				var hp: Vector3 = (g[sk.find_bone("Hips")] as Transform3D).origin * scale
				if k == 0:
					hips0 = hp
				hips_max = maxf(hips_max, Vector2(hp.x - hips0.x, hp.z - hips0.z).length())
			var top := ""
			for l in best:
				if top == "" or best[l][0] > best[top][0]:
					top = l
			fi[name.trim_prefix("m/")] = {"len": a.length, "impact": best[top][1] if top != "" else a.length * 0.4,
				"limb": top, "limbs": best, "hips_travel": hips_max}
		info[id] = fi
		inst.queue_free()
	var f := FileAccess.open("res://assets/meshy/clipinfo.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(info, "  "))
	f.close()
	for id in info:
		for c in info[id]:
			var d: Dictionary = info[id][c]
			print("%-6s %-34s len %.2f impact %.2f %-9s hips %.2f" % [id, c, d.len, d.impact, d.limb, d.hips_travel])
	quit()
