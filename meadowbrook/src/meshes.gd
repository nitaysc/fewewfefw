class_name Meshes
## Builds every model in the game from soft rounded shapes: machines, parts, toys, decor.
## Each model's origin sits on the floor at the middle of its cell; machines face +x (east).

static var _mats := {}
static var _meshes := {}

# ---------------------------------------------------------------- materials
static func mat(c: Color, rough := 0.62, metal := 0.0, rim := 0.25) -> StandardMaterial3D:
	var key := "%s|%.2f|%.2f|%.2f" % [c.to_html(), rough, metal, rim]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if rim > 0.0:
		m.rim_enabled = true
		m.rim = rim
		m.rim_tint = 0.6
	_mats[key] = m
	return m

static func glow(c: Color, strength := 1.0) -> StandardMaterial3D:
	var key := "glow|%s|%.2f" % [c.to_html(), strength]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = strength
	_mats[key] = m
	return m

static func clear_mat(c: Color, alpha := 0.45) -> StandardMaterial3D:
	var key := "clear|%s|%.2f" % [c.to_html(), alpha]
	if _mats.has(key):
		return _mats[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(c, alpha)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = 0.1
	m.metallic_specular = 0.9
	m.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
	_mats[key] = m
	return m

# ---------------------------------------------------------------- meshes
## a box with rounded edges (radius r), so everything looks soft and toy-like
static func rbox(size: Vector3, r: float, k := 3) -> ArrayMesh:
	var key := "rbox|%.3f|%.3f|%.3f|%.3f|%d" % [size.x, size.y, size.z, r, k]
	if _meshes.has(key):
		return _meshes[key]
	var h := size * 0.5
	r = minf(r, minf(h.x, minf(h.y, h.z)) * 0.98)
	var inner := h - Vector3(r, r, r)
	# coordinates along each axis: tightly packed in the rounded band, open in the middle
	var axis := func(hh: float, ii: float) -> Array:
		var a := []
		for i in k + 1:
			a.append(-hh + (hh - ii) * float(i) / k)
		for i in k + 1:
			a.append(ii + (hh - ii) * float(i) / k)
		return a
	var ax: Array = axis.call(h.x, inner.x)
	var ay: Array = axis.call(h.y, inner.y)
	var az: Array = axis.call(h.z, inner.z)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var faces := [
		[Vector3(1, 0, 0), ay, az, 0], [Vector3(-1, 0, 0), ay, az, 0],
		[Vector3(0, 1, 0), ax, az, 1], [Vector3(0, -1, 0), ax, az, 1],
		[Vector3(0, 0, 1), ax, ay, 2], [Vector3(0, 0, -1), ax, ay, 2],
	]
	for f in faces:
		var n: Vector3 = f[0]
		var us: Array = f[1]
		var vs: Array = f[2]
		var grid := []
		for i in us.size():
			var row := []
			for j in vs.size():
				var p := Vector3()
				match f[3]:
					0: p = Vector3(h.x * n.x, us[i], vs[j])
					1: p = Vector3(us[i], h.y * n.y, vs[j])
					2: p = Vector3(us[i], vs[j], h.z * n.z)
				var c := p.clamp(-inner, inner)
				var d := (p - c)
				var nn := d.normalized() if d.length() > 0.00001 else n
				row.append([c + nn * r, nn])
			grid.append(row)
		for i in us.size() - 1:
			for j in vs.size() - 1:
				var a = grid[i][j]
				var b = grid[i + 1][j]
				var cc = grid[i + 1][j + 1]
				var d = grid[i][j + 1]
				var tri := [a, b, cc, a, cc, d]
				var fn: Vector3 = (b[0] - a[0]).cross(cc[0] - a[0])
				if fn.length() < 1e-9:
					fn = (cc[0] - a[0]).cross(d[0] - a[0])
				if fn.dot(n) > 0:
					tri = [a, cc, b, a, d, cc]
				for v in tri:
					st.set_normal(v[1])
					st.set_uv(Vector2(v[0].x + v[0].z, v[0].y + v[0].z))
					st.add_vertex(v[0])
	var m := st.commit()
	_meshes[key] = m
	return m

static func cyl(rt: float, rb: float, hh: float, seg := 24) -> CylinderMesh:
	var key := "cyl|%.3f|%.3f|%.3f|%d" % [rt, rb, hh, seg]
	if _meshes.has(key):
		return _meshes[key]
	var c := CylinderMesh.new()
	c.top_radius = rt
	c.bottom_radius = rb
	c.height = hh
	c.radial_segments = seg
	c.rings = 1
	_meshes[key] = c
	return c

static func sphere(r: float, hh := -1.0) -> SphereMesh:
	var key := "sph|%.3f|%.3f" % [r, hh]
	if _meshes.has(key):
		return _meshes[key]
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0 if hh < 0 else hh
	s.radial_segments = 24
	s.rings = 12
	_meshes[key] = s
	return s

static func torus(r_in: float, r_out: float) -> TorusMesh:
	var key := "tor|%.3f|%.3f" % [r_in, r_out]
	if _meshes.has(key):
		return _meshes[key]
	var t := TorusMesh.new()
	t.inner_radius = r_in
	t.outer_radius = r_out
	t.rings = 24
	t.ring_segments = 12
	_meshes[key] = t
	return t

## add a mesh to parent at pos with rotation (degrees)
static func put(parent: Node3D, mesh: Mesh, m: Material, pos := Vector3.ZERO, rot := Vector3.ZERO, scl := Vector3.ONE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	mi.position = pos
	mi.rotation_degrees = rot
	mi.scale = scl
	parent.add_child(mi)
	return mi

static func group(parent: Node3D, name: String, pos := Vector3.ZERO) -> Node3D:
	var n := Node3D.new()
	n.name = name
	n.position = pos
	parent.add_child(n)
	return n

# ---------------------------------------------------------------- palette
const WOOD := Color("d9a066")
const WOOD_D := Color("a8703f")
const WOOD_L := Color("ecc58f")
const CREAM := Color("fff3df")
const STEEL := Color("c9d2da")
const STEEL_D := Color("7b8794")
const INK := Color("3b2f3a")
const TEAL := Color("5bb5a8")
const CORAL := Color("ff7f6b")
const MINT := Color("9fe0c6")
const SUN := Color("ffc857")

# ---------------------------------------------------------------- parts and toys
static func item(it: Dictionary) -> Node3D:
	var n := Node3D.new()
	var c: Color = Data.COLORS.get(it.get("c", "wood"), WOOD)
	var painted: bool = it.get("c", "wood") != "wood"
	var body := mat(c, 0.5 if painted else 0.7)
	var dark := mat(INK, 0.5)
	match it.t:
		"log":
			put(n, cyl(0.085, 0.085, 0.34, 16), mat(WOOD_D, 0.8), Vector3(0, 0.09, 0), Vector3(0, 0, 90))
			for s in [-1, 1]:
				put(n, cyl(0.07, 0.07, 0.01, 16), mat(WOOD_L, 0.7), Vector3(0.171 * s, 0.09, 0), Vector3(0, 0, 90))
		"metal":
			put(n, rbox(Vector3(0.34, 0.09, 0.14), 0.025), mat(STEEL, 0.25, 0.8), Vector3(0, 0.05, 0))
		"cloth":
			put(n, rbox(Vector3(0.3, 0.1, 0.22), 0.045), mat(Color("ff9fbf"), 0.9), Vector3(0, 0.06, 0))
			put(n, rbox(Vector3(0.31, 0.02, 0.06), 0.01), mat(CREAM, 0.9), Vector3(0, 0.11, 0))
		"block":
			put(n, rbox(Vector3(0.24, 0.18, 0.2), 0.04), body, Vector3(0, 0.09, 0))
		"wheel":
			put(n, cyl(0.1, 0.1, 0.06, 20), body, Vector3(0, 0.1, 0), Vector3(90, 0, 0))
			put(n, cyl(0.035, 0.035, 0.075, 12), mat(c.darkened(0.3), 0.6), Vector3(0, 0.1, 0), Vector3(90, 0, 0))
		"peg":
			put(n, cyl(0.035, 0.035, 0.2, 12), body, Vector3(0, 0.035, 0), Vector3(0, 0, 90))
			put(n, sphere(0.05), body, Vector3(0.11, 0.04, 0))
		"tube":
			put(n, cyl(0.07, 0.07, 0.3, 18), mat(c if painted else STEEL, 0.35, 0.0 if painted else 0.7), Vector3(0, 0.075, 0), Vector3(0, 0, 90))
		"fluff":
			put(n, sphere(0.11, 0.18), mat(c if painted else Color("fff8f0"), 0.95), Vector3(0, 0.09, 0))
		"car":
			put(n, rbox(Vector3(0.38, 0.13, 0.22), 0.05), body, Vector3(0, 0.12, 0))
			put(n, rbox(Vector3(0.19, 0.12, 0.19), 0.05), body, Vector3(-0.03, 0.22, 0))
			put(n, rbox(Vector3(0.2, 0.07, 0.2), 0.03), mat(Color("bfe6ff"), 0.15), Vector3(-0.03, 0.225, 0), Vector3.ZERO, Vector3(0.9, 1, 1.02))
			for x in [-0.12, 0.12]:
				for z in [-0.115, 0.115]:
					put(n, cyl(0.06, 0.06, 0.04, 16), dark, Vector3(x, 0.06, z), Vector3(90, 0, 0))
		"top":
			put(n, cyl(0.17, 0.0, 0.16, 24), body, Vector3(0, 0.11, 0), Vector3(180, 0, 0))
			put(n, cyl(0.17, 0.17, 0.04, 24), mat(c.lightened(0.25), 0.5), Vector3(0, 0.2, 0))
			put(n, cyl(0.03, 0.03, 0.14, 12), mat(WOOD_D, 0.6), Vector3(0, 0.28, 0))
		"train":
			put(n, cyl(0.09, 0.09, 0.26, 18), body, Vector3(0.05, 0.15, 0), Vector3(0, 0, 90))
			put(n, rbox(Vector3(0.15, 0.2, 0.2), 0.04), body, Vector3(-0.13, 0.18, 0))
			put(n, rbox(Vector3(0.19, 0.04, 0.24), 0.02), dark, Vector3(-0.13, 0.29, 0))
			put(n, cyl(0.035, 0.05, 0.1, 12), dark, Vector3(0.12, 0.27, 0))
			for x in [-0.12, 0.0, 0.12]:
				for z in [-0.1, 0.1]:
					put(n, cyl(0.055, 0.055, 0.035, 14), dark, Vector3(x, 0.055, z), Vector3(90, 0, 0))
		"rocket":
			put(n, cyl(0.085, 0.085, 0.26, 20), body, Vector3(0, 0.17, 0))
			put(n, cyl(0.0, 0.085, 0.13, 20), mat(CORAL, 0.5), Vector3(0, 0.365, 0))
			put(n, sphere(0.04), mat(Color("bfe6ff"), 0.1), Vector3(0.075, 0.22, 0))
			for a in [0, 120, 240]:
				var f := put(n, rbox(Vector3(0.13, 0.12, 0.02), 0.01), mat(CORAL, 0.5), Vector3(0, 0.08, 0), Vector3(0, a, 0))
				f.position = Vector3(cos(deg_to_rad(a)) * 0.09, 0.08, -sin(deg_to_rad(a)) * 0.09)
		"teddy":
			var fur := mat(c if painted else Color("c98b55"), 0.95)
			put(n, sphere(0.12, 0.2), fur, Vector3(0, 0.11, 0))
			put(n, sphere(0.1), fur, Vector3(0, 0.29, 0))
			for s in [-1, 1]:
				put(n, sphere(0.04), fur, Vector3(0, 0.37, 0.07 * s))
				put(n, sphere(0.045), fur, Vector3(0.02, 0.07, 0.1 * s))
				put(n, sphere(0.014), dark, Vector3(0.088, 0.31, 0.035 * s))
			put(n, sphere(0.04, 0.05), mat(CREAM, 0.9), Vector3(0.09, 0.27, 0))
			put(n, sphere(0.014), dark, Vector3(0.125, 0.28, 0))
		"robot":
			put(n, rbox(Vector3(0.2, 0.2, 0.2), 0.04), body, Vector3(0, 0.13, 0))
			put(n, rbox(Vector3(0.16, 0.13, 0.16), 0.04), mat(STEEL, 0.35, 0.6), Vector3(0, 0.3, 0))
			for s in [-1, 1]:
				put(n, sphere(0.022), glow(Color("7fe3ff"), 2.0), Vector3(0.08, 0.31, 0.04 * s))
				put(n, cyl(0.025, 0.025, 0.14, 10), mat(STEEL_D, 0.4, 0.5), Vector3(0, 0.13, 0.13 * s))
			put(n, cyl(0.008, 0.008, 0.08, 6), dark, Vector3(0, 0.4, 0))
			put(n, sphere(0.022), glow(CORAL, 1.5), Vector3(0, 0.45, 0))
	return n

# ---------------------------------------------------------------- machines
static func base(n: Node3D, col: Color) -> void:
	put(n, rbox(Vector3(0.94, 0.1, 0.94), 0.045), mat(col.darkened(0.15), 0.7), Vector3(0, 0.05, 0))
	# an arrow on the floor plate shows which way things come out
	put(n, cyl(0.0, 0.07, 0.11, 3), mat(SUN, 0.5), Vector3(0.4, 0.1, 0), Vector3(0, 0, -90), Vector3(1, 1, 0.35))

static func machine(kind: String, extra := {}) -> Node3D:
	var n := Node3D.new()
	var steel := mat(STEEL, 0.3, 0.6)
	var dark := mat(INK, 0.5)
	match kind:
		"belt":
			pass
		"crate_wood", "crate_metal", "crate_cloth":
			var col: Color = {"crate_wood": WOOD, "crate_metal": Color("8fb3cf"), "crate_cloth": Color("f6a5c0")}[kind]
			base(n, Color("8c7a6b"))
			var box := group(n, "box")
			put(box, rbox(Vector3(0.72, 0.42, 0.72), 0.05), mat(col, 0.75), Vector3(0, 0.31, 0))
			for y in [0.2, 0.42]:
				put(box, rbox(Vector3(0.75, 0.05, 0.75), 0.02), mat(col.darkened(0.25), 0.8), Vector3(0, y, 0))
			var load := group(n, "load", Vector3(0, 0.52, 0))
			var stuff: String = {"crate_wood": "log", "crate_metal": "metal", "crate_cloth": "cloth"}[kind]
			for i in 3:
				var it := item({"t": stuff})
				it.position = Vector3(-0.12 + i * 0.12, -0.04 + (i % 2) * 0.04, -0.12 + i * 0.1)
				it.rotation_degrees = Vector3(0, 15 + i * 35, 0)
				load.add_child(it)
		"saw":
			base(n, Color("7f8fa6"))
			put(n, rbox(Vector3(0.78, 0.3, 0.66), 0.06), mat(CREAM, 0.6), Vector3(0, 0.25, 0))
			put(n, rbox(Vector3(0.82, 0.05, 0.7), 0.02), mat(TEAL, 0.5), Vector3(0, 0.42, 0))
			var spin := group(n, "spin", Vector3(0.02, 0.47, 0))
			put(spin, cyl(0.22, 0.22, 0.02, 32), mat(Color("e6ecf2"), 0.2, 0.9), Vector3.ZERO, Vector3(90, 0, 0))
			put(spin, cyl(0.05, 0.05, 0.04, 12), mat(CORAL, 0.4), Vector3.ZERO, Vector3(90, 0, 0))
			put(n, rbox(Vector3(0.3, 0.14, 0.12), 0.05), mat(CORAL, 0.5), Vector3(0.02, 0.62, 0))
			put(n, rbox(Vector3(0.12, 0.22, 0.12), 0.04), mat(SUN, 0.5), Vector3(-0.28, 0.55, -0.22))
		"lathe":
			base(n, Color("7f8fa6"))
			put(n, rbox(Vector3(0.82, 0.12, 0.34), 0.04), mat(STEEL_D, 0.5, 0.4), Vector3(0, 0.36, 0))
			for x in [-0.3, 0.3]:
				put(n, rbox(Vector3(0.12, 0.26, 0.26), 0.04), mat(CREAM, 0.6), Vector3(x, 0.2, 0))
			put(n, rbox(Vector3(0.2, 0.3, 0.32), 0.06), mat(CORAL, 0.5), Vector3(-0.3, 0.55, 0))
			put(n, rbox(Vector3(0.12, 0.2, 0.2), 0.05), mat(TEAL, 0.5), Vector3(0.32, 0.52, 0))
			var spin := group(n, "spin", Vector3(0.02, 0.55, 0))
			put(spin, cyl(0.07, 0.07, 0.42, 16), mat(WOOD_L, 0.6), Vector3.ZERO, Vector3(0, 0, 90))
			for x in [-0.1, 0.06]:
				put(spin, torus(0.07, 0.085), mat(WOOD_D, 0.6), Vector3(x, 0, 0), Vector3(0, 0, 90))
		"painter":
			base(n, Color("7f8fa6"))
			put(n, rbox(Vector3(0.74, 0.62, 0.7), 0.08), mat(MINT, 0.55), Vector3(0, 0.41, 0))
			put(n, rbox(Vector3(0.4, 0.3, 0.05), 0.04), mat(Color("2d3a4a"), 0.2), Vector3(0.3, 0.42, 0), Vector3(0, 90, 0))
			put(n, rbox(Vector3(0.78, 0.06, 0.74), 0.03), mat(Color("ffffff"), 0.5), Vector3(0, 0.74, 0))
			var can := group(n, "can", Vector3(-0.12, 0.84, -0.1))
			var pc: Color = Data.COLORS.get(extra.get("color", "red"), CORAL)
			put(can, cyl(0.11, 0.11, 0.17, 20), mat(pc, 0.45), Vector3.ZERO).name = "paint"
			put(can, cyl(0.115, 0.115, 0.03, 20), steel, Vector3(0, 0.09, 0))
			var arm := group(n, "bob", Vector3(0.15, 0.82, 0.12))
			put(arm, cyl(0.03, 0.03, 0.16, 10), steel, Vector3(0, 0.05, 0))
			put(arm, cyl(0.06, 0.03, 0.08, 12), dark, Vector3(0, -0.04, 0))
		"assembler":
			base(n, Color("7f8fa6"))
			put(n, rbox(Vector3(0.84, 0.08, 0.7), 0.03), mat(WOOD, 0.6), Vector3(0, 0.42, 0))
			for x in [-0.33, 0.33]:
				for z in [-0.26, 0.26]:
					put(n, rbox(Vector3(0.07, 0.34, 0.07), 0.02), mat(WOOD_D, 0.7), Vector3(x, 0.22, z))
			put(n, rbox(Vector3(0.7, 0.05, 0.08), 0.02), mat(WOOD_D, 0.7), Vector3(0, 0.12, 0))
			var stand := put(n, rbox(Vector3(0.08, 0.5, 0.08), 0.03), mat(CORAL, 0.5), Vector3(-0.3, 0.69, -0.25))
			stand.name = "stand"
			var arm := group(n, "hammer", Vector3(-0.3, 0.9, -0.25))
			put(arm, rbox(Vector3(0.36, 0.05, 0.05), 0.02), mat(SUN, 0.5), Vector3(0.18, 0, 0.08))
			put(arm, rbox(Vector3(0.1, 0.1, 0.16), 0.03), steel, Vector3(0.36, -0.02, 0.08))
			var prev := group(n, "preview", Vector3(0.05, 0.47, 0.05))
			var toy := item({"t": extra.get("toy", "car")})
			toy.scale = Vector3.ONE * 0.9
			prev.add_child(toy)
		"dock":
			base(n, Color("7f8fa6"))
			var cb := Color("d6a46b")
			put(n, rbox(Vector3(0.74, 0.5, 0.74), 0.03), mat(cb, 0.85), Vector3(0, 0.35, 0))
			put(n, rbox(Vector3(0.66, 0.02, 0.66), 0.01), mat(cb.darkened(0.35), 0.9), Vector3(0, 0.595, 0))
			put(n, rbox(Vector3(0.76, 0.06, 0.12), 0.01), mat(Color("f0e2c8"), 0.7), Vector3(0, 0.4, 0))
			for s in [-1, 1]:
				var f := group(n, "flap%d" % (s + 1), Vector3(0, 0.6, 0.37 * s))
				put(f, rbox(Vector3(0.74, 0.02, 0.3), 0.01), mat(cb.lightened(0.08), 0.85), Vector3(0, 0, 0.15 * s))
				f.rotation_degrees = Vector3(-35 * s, 0, 0)
			var flag := group(n, "flag", Vector3(-0.33, 0.6, -0.33))
			put(flag, cyl(0.012, 0.012, 0.4, 8), dark, Vector3(0, 0.2, 0))
			put(flag, rbox(Vector3(0.16, 0.1, 0.01), 0.005), mat(CORAL, 0.5), Vector3(0.08, 0.34, 0))
		"press":
			base(n, Color("7f8fa6"))
			put(n, rbox(Vector3(0.7, 0.24, 0.6), 0.05), mat(Color("8fb3cf"), 0.5), Vector3(0, 0.22, 0))
			for z in [-0.26, 0.26]:
				put(n, rbox(Vector3(0.08, 0.7, 0.08), 0.03), steel, Vector3(0, 0.6, z))
			put(n, rbox(Vector3(0.5, 0.12, 0.66), 0.04), mat(CORAL, 0.5), Vector3(0, 0.98, 0))
			var head := group(n, "head", Vector3(0, 0.72, 0))
			put(head, rbox(Vector3(0.44, 0.14, 0.42), 0.04), mat(SUN, 0.45), Vector3.ZERO)
		"loom":
			base(n, Color("7f8fa6"))
			put(n, rbox(Vector3(0.72, 0.3, 0.62), 0.06), mat(Color("c7b3f0"), 0.6), Vector3(0, 0.25, 0))
			for z in [-0.22, 0.22]:
				put(n, rbox(Vector3(0.06, 0.36, 0.06), 0.02), mat(WOOD_D, 0.7), Vector3(0, 0.55, z))
			var spin := group(n, "spin", Vector3(0, 0.66, 0))
			put(spin, sphere(0.17), mat(Color("ff9fbf"), 0.95), Vector3.ZERO)
			put(spin, torus(0.16, 0.18), mat(Color("ffd1e0"), 0.9), Vector3.ZERO, Vector3(90, 0, 0))
	return n

## the conveyor belt: a frame with rollers and a moving surface (shader)
static func belt(belt_mat: Material) -> Node3D:
	var n := Node3D.new()
	var frame := mat(Color("5d6b7a"), 0.5, 0.3)
	for s in [-1, 1]:
		put(n, rbox(Vector3(1.0, 0.12, 0.08), 0.03), frame, Vector3(0, 0.08, 0.37 * s))
	put(n, rbox(Vector3(1.0, 0.06, 0.66), 0.02), mat(Color("3d4652"), 0.6), Vector3(0, 0.06, 0))
	var top := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(1.0, 0.66)
	top.mesh = q
	top.material_override = belt_mat
	top.rotation_degrees = Vector3(-90, 0, 0)
	top.position = Vector3(0, 0.095, 0)
	n.add_child(top)
	for s in [-1, 1]:
		for x in [-0.32, 0.32]:
			put(n, rbox(Vector3(0.08, 0.05, 0.05), 0.015), mat(SUN, 0.5), Vector3(x, 0.14, 0.37 * s))
	return n

static func coin() -> Node3D:
	var n := Node3D.new()
	put(n, cyl(0.2, 0.2, 0.05, 32), mat(SUN, 0.25, 0.7), Vector3.ZERO, Vector3(90, 0, 0))
	put(n, cyl(0.14, 0.14, 0.06, 32), mat(Color("ffde8a"), 0.2, 0.6), Vector3.ZERO, Vector3(90, 0, 0))
	return n

static func hammer() -> Node3D:
	var n := Node3D.new()
	put(n, rbox(Vector3(0.07, 0.5, 0.07), 0.03), mat(WOOD, 0.6), Vector3(0, 0, 0))
	put(n, rbox(Vector3(0.32, 0.13, 0.14), 0.04), mat(CORAL, 0.45), Vector3(0, 0.26, 0))
	return n
