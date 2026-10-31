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

# ---------------------------------------------------------------- produce
## one piece of produce (a real scanned onion, potato, flower, apple...)
static func produce(t: String) -> Node3D:
	var id: String = Data.CROPS[t].model if Data.CROPS.has(t) else Data.FRUIT[t].model
	var holder := Node3D.new()
	var w := 0.13 if Data.CROPS.has(t) and not t in ["gazania", "ursinia"] else (0.22 if t in ["gazania", "ursinia"] else 0.09)
	place(holder, id, Vector3.ZERO, 0.0, w)
	return holder

## a wicker basket holding what you carry
static func basket(it: Dictionary) -> Node3D:
	var n := Node3D.new()
	place(n, "wicker_basket_02", Vector3.ZERO, 0.0, 0.42)
	var k: int = mini(int(it.get("n", 1)), 6)
	for i in k:
		var p := produce(it.t)
		p.position = Vector3(-0.1 + (i % 3) * 0.1, 0.06 + int(i / 3) * 0.05, -0.05 + int(i / 3) * 0.08)
		p.rotation.y = i * 1.3
		n.add_child(p)
	return n
