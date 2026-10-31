class_name Props
## Realistic props (Poly Haven, CC0) and the textured materials used for parts and toys.

const MODELS := "res://assets/models/"
const TEX := "res://assets/textures/"
static var _scenes := {}
static var _mats := {}

## an instance of a Poly Haven model (real-world size in metres)
static func model(id: String) -> Node3D:
	if not _scenes.has(id):
		var dir := MODELS + id + "/"
		var path := dir + id + "_1k.gltf"
		_scenes[id] = load(path) if ResourceLoader.exists(path) else null
	var s: PackedScene = _scenes[id]
	if s == null:
		push_warning("missing model " + id)
		return Node3D.new()
	var n: Node3D = s.instantiate()
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return n

## bounding box of everything visible under n, in n's space
static func aabb(n: Node3D) -> AABB:
	var box := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var tr := Transform3D.IDENTITY
		var p: Node = mi
		while p != n and p != null:
			tr = (p as Node3D).transform * tr
			p = p.get_parent()
		var b: AABB = tr * (mi as MeshInstance3D).get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box

## place a model so it stands on the floor at pos, optionally scaled to a width
static func place(parent: Node3D, id: String, pos: Vector3, yaw_deg := 0.0, width := 0.0) -> Node3D:
	var holder := Node3D.new()
	var m := model(id)
	holder.add_child(m)
	var b := aabb(m)
	var s := 1.0
	if width > 0.0 and maxf(b.size.x, b.size.z) > 0.001:
		s = width / maxf(b.size.x, b.size.z)
	m.scale = Vector3.ONE * s
	m.position = Vector3(-(b.position.x + b.size.x / 2.0) * s, -b.position.y * s, -(b.position.z + b.size.z / 2.0) * s)
	holder.position = pos
	holder.rotation_degrees.y = yaw_deg
	holder.set_meta("height", b.size.y * s)
	holder.set_meta("size", b.size * s)
	parent.add_child(holder)
	return holder

## a PBR material from a Poly Haven texture set, tinted, mapped by world-ish triplanar projection
static func textured(id: String, tint := Color.WHITE, scale := 1.0, rough_mul := 1.0, varnish := 0.0) -> StandardMaterial3D:
	var key := "%s|%s|%.2f|%.2f|%.2f" % [id, tint.to_html(), scale, rough_mul, varnish]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	var dir := TEX + id + "/"
	m.albedo_texture = load(dir + "albedo.jpg")
	m.albedo_color = tint
	if ResourceLoader.exists(dir + "normal.jpg"):
		m.normal_enabled = true
		m.normal_texture = load(dir + "normal.jpg")
		m.normal_scale = 0.8
	if ResourceLoader.exists(dir + "rough.jpg"):
		m.roughness_texture = load(dir + "rough.jpg")
		m.roughness = rough_mul
	m.uv1_triplanar = true
	m.uv1_scale = Vector3.ONE * scale
	if varnish > 0.0:
		m.clearcoat_enabled = true
		m.clearcoat = varnish
		m.clearcoat_roughness = 0.25
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_mats[key] = m
	return m

## wood for a part or toy in a colour: natural wood, or wood painted with a lacquer
static func wood(c: String) -> StandardMaterial3D:
	if c == "wood":
		return textured("fine_grained_wood", Color(1.0, 0.92, 0.82), 3.0, 0.9)
	var col: Color = Data.COLORS[c]
	return textured("fine_grained_wood", col.lerp(Color.WHITE, 0.08) * 1.15, 3.0, 0.55, 0.6)

static func plain(c: Color, rough := 0.5, metal := 0.0) -> StandardMaterial3D:
	var key := "plain|%s|%.2f|%.2f" % [c.to_html(), rough, metal]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	_mats[key] = m
	return m

# ---------------------------------------------------------------- parts and toys
static func item(it: Dictionary) -> Node3D:
	var n := Node3D.new()
	var c: String = it.get("c", "wood")
	var w := wood(c)
	var dark := plain(Color("2b2321"), 0.45)
	var put := func(mesh: Mesh, m: Material, pos: Vector3, rot := Vector3.ZERO) -> MeshInstance3D:
		return Meshes.put(n, mesh, m, pos, rot)
	match it.t:
		"lumber":
			put.call(Meshes.rbox(Vector3(0.62, 0.09, 0.16), 0.012, 2), textured("oak_wood_planks", Color(1, 0.95, 0.9), 2.0), Vector3(0, 0.045, 0))
		"block":
			put.call(Meshes.rbox(Vector3(0.2, 0.13, 0.13), 0.018, 2), w, Vector3(0, 0.065, 0))
		"wheel":
			put.call(Meshes.cyl(0.075, 0.075, 0.045, 28), w, Vector3(0, 0.075, 0), Vector3(90, 0, 0))
			put.call(Meshes.cyl(0.022, 0.022, 0.055, 12), dark, Vector3(0, 0.075, 0), Vector3(90, 0, 0))
		"peg":
			put.call(Meshes.cyl(0.022, 0.022, 0.16, 14), w, Vector3(0, 0.022, 0), Vector3(0, 0, 90))
			put.call(Meshes.sphere(0.035), w, Vector3(0.085, 0.03, 0))
		"car":
			put.call(Meshes.rbox(Vector3(0.28, 0.09, 0.15), 0.025, 2), w, Vector3(0, 0.09, 0))
			put.call(Meshes.rbox(Vector3(0.13, 0.08, 0.13), 0.025, 2), w, Vector3(-0.02, 0.165, 0))
			for x in [-0.09, 0.09]:
				for z in [-0.085, 0.085]:
					put.call(Meshes.cyl(0.045, 0.045, 0.03, 20), dark, Vector3(x, 0.045, z), Vector3(90, 0, 0))
		"top":
			put.call(Meshes.cyl(0.12, 0.0, 0.12, 28), w, Vector3(0, 0.07, 0), Vector3(180, 0, 0))
			put.call(Meshes.cyl(0.12, 0.12, 0.03, 28), w, Vector3(0, 0.145, 0))
			put.call(Meshes.cyl(0.02, 0.02, 0.11, 12), wood("wood"), Vector3(0, 0.21, 0))
		"plane":
			put.call(Meshes.rbox(Vector3(0.3, 0.08, 0.08), 0.03, 2), w, Vector3(0, 0.1, 0))
			put.call(Meshes.rbox(Vector3(0.09, 0.015, 0.36), 0.008, 2), w, Vector3(0.02, 0.12, 0))
			put.call(Meshes.rbox(Vector3(0.05, 0.08, 0.012), 0.006, 2), w, Vector3(-0.13, 0.16, 0))
			put.call(Meshes.rbox(Vector3(0.012, 0.13, 0.025), 0.004, 2), wood("wood"), Vector3(0.155, 0.1, 0))
			put.call(Meshes.cyl(0.03, 0.03, 0.02, 14), dark, Vector3(0.02, 0.035, 0.05), Vector3(90, 0, 0))
			put.call(Meshes.cyl(0.03, 0.03, 0.02, 14), dark, Vector3(0.02, 0.035, -0.05), Vector3(90, 0, 0))
		"train":
			put.call(Meshes.cyl(0.065, 0.065, 0.2, 22), w, Vector3(0.04, 0.12, 0), Vector3(0, 0, 90))
			put.call(Meshes.rbox(Vector3(0.12, 0.16, 0.15), 0.02, 2), w, Vector3(-0.1, 0.14, 0))
			put.call(Meshes.rbox(Vector3(0.15, 0.025, 0.18), 0.01, 2), dark, Vector3(-0.1, 0.23, 0))
			put.call(Meshes.cyl(0.025, 0.035, 0.08, 12), dark, Vector3(0.1, 0.21, 0))
			for x in [-0.1, 0.0, 0.1]:
				for z in [-0.08, 0.08]:
					put.call(Meshes.cyl(0.04, 0.04, 0.025, 16), dark, Vector3(x, 0.04, z), Vector3(90, 0, 0))
	return n
