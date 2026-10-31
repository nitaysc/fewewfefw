class_name Toymaker
extends Node3D
## A person from the Quaternius Universal Base Characters (CC0): a base body, work clothes and
## hair on one skeleton, with walking, carrying and working animations from the Universal
## Animation Library.

const PEOPLE := "res://assets/people/"
static var _anims: AnimationLibrary

var body: Node3D
var skel: Skeleton3D
var anim: AnimationPlayer
var current := ""

func build(female := false, hair := "Hair_SimpleParted", beard := true) -> Toymaker:
	body = load(PEOPLE + ("Superhero_Female.glb" if female else "Superhero_Male.glb")).instantiate()
	add_child(body)
	skel = body.find_children("*", "Skeleton3D", true, false)[0]
	var parts := [("Female_Peasant" if female else "Male_Peasant"), hair]
	if beard and not female:
		parts.append("Hair_Beard")
	for p in parts:
		var o: Node = load(PEOPLE + p + ".glb").instantiate()
		for mi in o.find_children("*", "MeshInstance3D", true, false):
			mi.owner = null
			mi.get_parent().remove_child(mi)
			skel.add_child(mi)
			mi.skeleton = NodePath("..")
		o.free()
	# the base body is under the clothes: keep only its head, neck and hands so it can't show through
	for mi in skel.get_children():
		if mi is MeshInstance3D and mi.mesh and mi.mesh.get_surface_count() > 0 and String(mi.mesh.surface_get_material(0).resource_name).begins_with("MI_Superhero"):
			_trim(mi, female)
	_hair_textures()
	anim = AnimationPlayer.new()
	body.add_child(anim)
	anim.add_animation_library("", library())
	return self

func _trim(mi: MeshInstance3D, female: bool) -> void:
	var keep := {}
	for i in skel.get_bone_count():
		var n := skel.get_bone_name(i).to_lower()
		var k := false
		for w in ["head", "neck", "eye", "jaw", "hand", "finger", "thumb", "index", "middle", "ring", "pinky"]:
			if w in n:
				k = true
		if female and ("arm" in n or "elbow" in n):
			k = true
		keep[i] = k
	var src: Mesh = mi.mesh
	var out := ArrayMesh.new()
	for si in src.get_surface_count():
		var arrs := src.surface_get_arrays(si)
		var bones: PackedInt32Array = arrs[Mesh.ARRAY_BONES]
		var weights: PackedFloat32Array = arrs[Mesh.ARRAY_WEIGHTS]
		var idx: PackedInt32Array = arrs[Mesh.ARRAY_INDEX]
		var per := bones.size() / maxi(1, (arrs[Mesh.ARRAY_VERTEX] as PackedVector3Array).size())
		var vkeep := PackedByteArray()
		vkeep.resize((arrs[Mesh.ARRAY_VERTEX] as PackedVector3Array).size())
		for v in vkeep.size():
			var best := 0
			var bw := -1.0
			for j in per:
				if weights[v * per + j] > bw:
					bw = weights[v * per + j]
					best = bones[v * per + j]
			vkeep[v] = 1 if keep.get(best, false) else 0
		var ni := PackedInt32Array()
		for t in range(0, idx.size(), 3):
			if vkeep[idx[t]] or vkeep[idx[t + 1]] or vkeep[idx[t + 2]]:
				ni.append_array([idx[t], idx[t + 1], idx[t + 2]])
		arrs[Mesh.ARRAY_INDEX] = ni
		out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrs, [], {}, src.surface_get_format(si) & ~Mesh.ARRAY_FORMAT_INDEX | Mesh.ARRAY_FORMAT_INDEX)
		out.surface_set_material(si, src.surface_get_material(si))
	mi.mesh = out

func _hair_textures() -> void:
	# the hair files don't carry their pictures; give them the pack's hair textures
	for mi in skel.get_children():
		if not mi is MeshInstance3D:
			continue
		for si in mi.mesh.get_surface_count():
			var m = mi.mesh.surface_get_material(si)
			if m is StandardMaterial3D and String(m.resource_name).begins_with("MI_Hair") and m.albedo_texture == null:
				var nm: StandardMaterial3D = m.duplicate()
				nm.albedo_texture = load(PEOPLE + ("T_Hair_2_BaseColor.png" if "2" in m.resource_name else "T_Hair_1_BaseColor.png"))
				nm.albedo_color = hair_color
				mi.set_surface_override_material(si, nm)

var hair_color := Color(0.42, 0.27, 0.17)

static func library() -> AnimationLibrary:
	if _anims:
		return _anims
	_anims = AnimationLibrary.new()
	for f in ["UAL1.glb", "UAL2.glb"]:
		var s: Node = load(PEOPLE + f).instantiate()
		var src: AnimationPlayer = s.find_children("*", "AnimationPlayer", true, false)[0]
		for n in src.get_animation_list():
			var a: Animation = src.get_animation(n).duplicate()
			_anims.add_animation(n, a)
		s.free()
	return _anims

func play(n: String, blend := 0.2, speed := 1.0) -> void:
	anim.speed_scale = speed
	if n == current:
		return
	current = n
	anim.play(n, blend)
