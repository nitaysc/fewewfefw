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
