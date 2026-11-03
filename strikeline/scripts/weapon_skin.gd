class_name WeaponSkin
extends RefCounted
## Meshy's auto-rig spreads a held weapon's vertices over nearby bones (a staff's crest
## follows the neck, its shaft the thigh). This re-binds each weapon rigidly to its hand:
## every vertex inside the weapon's measured region gets 100% hand weight.

## Per model: weapon regions measured on the rest-pose meshes (metres, model space).
## "seg": [hand, Vector2 a, Vector2 b, radius in the front view, AABB filter (min, max)].
## "box": [hand, AABB min, AABB max].
const RULES := {
	"kai_w": [
		["seg", "RightHand", Vector2(-0.50, 1.33), Vector2(-0.25, 1.37), 0.03, Vector3(-0.6, 1.2, -0.4), Vector3(-0.24, 1.5, 0.4)],
		["seg", "LeftHand", Vector2(0.27, 1.09), Vector2(0.50, 0.81), 0.028, Vector3(0.30, 0.7, -0.4), Vector3(0.55, 1.15, 0.4)],
	],
	"nyx_w": [
		["seg", "LeftHand", Vector2(0.275, 1.44), Vector2(0.357, 1.66), 0.024, Vector3(0.2, 1.43, -0.2), Vector3(0.45, 1.7, 0.45)],
	],
	"sol_w": [
		["box", "RightHand", Vector3(-0.285, 0.66, -0.2), Vector3(-0.20, 1.02, 0.2)],
		["box", "RightHand", Vector3(-0.255, 0.58, -0.07), Vector3(-0.195, 0.66, 0.02)],
		["box", "RightHand", Vector3(-0.39, 1.14, -0.25), Vector3(-0.175, 1.76, 0.25)],
	],
}

static var _done := {}
static var _tips := {}   # model id -> {hand bone name: tip position in that bone's space}


## The weapon tip held in `hand` (bone space), or INF.
static func tip(model_id: String, hand: String) -> Vector3:
	return _tips.get(model_id, {}).get(hand, Vector3.INF)


## Fixes the weights of `mesh_instance`'s mesh in place (cached per model id).
static func apply(model_id: String, mi: MeshInstance3D) -> void:
	if not RULES.has(model_id):
		return
	if _done.has(model_id):
		mi.mesh = _done[model_id]
		return
	var mesh: ArrayMesh = mi.mesh
	var arr := mesh.surface_get_arrays(0)
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var bones: PackedInt32Array = arr[Mesh.ARRAY_BONES]
	var w: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
	var per := bones.size() / v.size()
	var skin := mi.skin
	var bind := {}
	for i in skin.get_bind_count():
		bind[skin.get_bind_name(i)] = i
	# dominant bone of every vertex before the fix
	var dom := PackedInt32Array()
	dom.resize(v.size())
	for i in v.size():
		var best := 0
		for k in per:
			if w[i * per + k] > w[i * per + best]:
				best = k
		dom[i] = bones[i * per + best]
	var weapon := PackedByteArray()
	weapon.resize(v.size())
	var arm_bones := {}
	for rule in RULES[model_id]:
		var hand: int = bind.get(rule[1], -1)
		if hand < 0:
			continue
		var side: String = "Left" if String(rule[1]).begins_with("Left") else "Right"
		for bn in [side + "Hand", side + "ForeArm"]:
			if bind.has(bn):
				arm_bones[bind[bn]] = true
		var hpos: Vector3 = skin.get_bind_pose(hand).affine_inverse().origin
		var far := -1.0
		var tip_v := Vector3.ZERO
		for i in _select(v, rule):
			if v[i].distance_to(hpos) > far:
				far = v[i].distance_to(hpos)
				tip_v = v[i]
			weapon[i] = 1
			for k in per:
				bones[i * per + k] = hand if k == 0 else 0
				w[i * per + k] = 1.0 if k == 0 else 0.0
		if far > 0.0:
			if not _tips.has(model_id):
				_tips[model_id] = {}
			var key: String = rule[1] + "_len"
			if far > float(_tips[model_id].get(key, 0.0)):
				_tips[model_id][key] = far
				_tips[model_id][rule[1]] = skin.get_bind_pose(hand) * tip_v
	# cut the triangles that weld the weapon to the body (they would stretch into strands)
	if arr[Mesh.ARRAY_INDEX] != null:
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		var kept := PackedInt32Array()
		for t in range(0, idx.size(), 3):
			var a := idx[t]
			var b := idx[t + 1]
			var c := idx[t + 2]
			var nw := int(weapon[a]) + int(weapon[b]) + int(weapon[c])
			if nw > 0 and nw < 3:
				var bad := false
				for q in [a, b, c]:
					if weapon[q] == 0 and not arm_bones.has(dom[q]):
						bad = true
				if bad:
					continue
			kept.append(a)
			kept.append(b)
			kept.append(c)
		arr[Mesh.ARRAY_INDEX] = kept
	arr[Mesh.ARRAY_BONES] = bones
	arr[Mesh.ARRAY_WEIGHTS] = w
	var out := ArrayMesh.new()
	var flags := mesh.surface_get_format(0)
	out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, [], {}, flags)
	out.surface_set_material(0, mesh.surface_get_material(0))
	_done[model_id] = out
	mi.mesh = out


## Vertex indices that belong to each weapon (for checking the regions).
static func selected(model_id: String, v: PackedVector3Array) -> Dictionary:
	var out := {}
	for rule in RULES.get(model_id, []):
		for i in _select(v, rule):
			out[i] = rule[1]
	return out


static func _select(v: PackedVector3Array, rule: Array) -> PackedInt32Array:
	var sel: PackedInt32Array = []
	if rule[0] == "box":
		var box := AABB(rule[2], rule[3] - rule[2])
		for i in v.size():
			if box.has_point(v[i]):
				sel.append(i)
		return sel
	var a: Vector2 = rule[2]
	var b: Vector2 = rule[3]
	var r: float = rule[4]
	var box := AABB(rule[5], rule[6] - rule[5])
	for i in v.size():
		if box.has_point(v[i]) and _seg_dist2(Vector2(v[i].x, v[i].y), a, b) < r:
			sel.append(i)
	return sel


static func _seg_dist2(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var u := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 1e-6), 0.0, 1.0)
	return p.distance_to(a + ab * u)


static func _along2(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	return smoothstep(0.75, 1.0, clampf((p - a).dot(ab) / maxf(ab.length_squared(), 1e-6), 0.0, 1.0))
