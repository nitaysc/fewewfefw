class_name Stage3D
extends Node3D
## The 3D look of a stage: platforms built from Meshy props (or modelled here), 3D scenery
## in the distance, soft contact shadows under the fighters and the 3D item models.
## Gameplay still runs on the 2D Stage rects; this only follows them.

const PXU := 48.0
const PROPS := "res://assets/meshy/props/%s.glb"

var stage   # Stage
var arena
var plat_nodes := {}      # plat index -> Node3D following that platform's rect
var plat_off := {}        # plat index -> Vector3 offset from the rect's top-left corner
var shadows: Array = []   # one per fighter
var item_nodes := {}      # item dictionary id -> Node3D
var core_node: Node3D
var blinkers: Array = []  # [{mat, base: Color, rate, phase}]
var spinners: Array = []  # [{node, axis, speed}]
var t := 0.0
static var _fit_cache := {}
static var _crop_cache := {}
## Parts of a prop to keep, as a band of its height (drops the stands and stray bits Meshy adds).
## Colour grading per prop so it sits in its stage's light.
const TINT := {"island2": Color(0.95, 0.8, 0.68), "island": Color(0.95, 0.8, 0.68)}
## "main" keeps the biggest high piece and whatever sits inside it.
const CROP := {"bomb": [0.14, 1.01], "core": [0.3, 1.01], "plank": [-0.01, 0.5], "island": "main", "island2": [-0.01, 0.8]}
static var _win_tex: Texture2D
static var _shadow_mat: StandardMaterial3D


static func has_props() -> bool:
	return ResourceLoader.exists(PROPS % "hover")


static func w(p: Vector2, z := 0.0) -> Vector3:
	return Vector3(p.x / PXU, -p.y / PXU, z)


func setup(a, s) -> void:
	arena = a
	stage = s
	match stage.id:
		0: _build_rooftop()
		1: _build_island()
		_: _build_line()
	for f in arena.fighters:
		var sh := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.size = Vector2(1.5, 1.5)
		q.orientation = PlaneMesh.FACE_Y
		sh.mesh = q
		sh.material_override = _shadow_material()
		sh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(sh)
		shadows.append(sh)


# ------------------------------------------------------------------ helpers
func _mat(col: Color, rough := 0.7, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = rough
	m.metallic = metal
	return m


func _glow_mat(col: Color, energy := 2.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(col.r * energy, col.g * energy, col.b * energy)
	return m


func _box(size: Vector3, pos: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var b := BoxMesh.new()
	b.size = size
	mi.mesh = b
	mi.material_override = mat
	mi.position = pos
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	(parent if parent else self).add_child(mi)
	return mi


func _cyl(r: float, h: float, pos: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = r
	c.bottom_radius = r
	c.height = h
	c.radial_segments = 10
	c.rings = 1
	mi.mesh = c
	mi.material_override = mat
	mi.position = pos
	(parent if parent else self).add_child(mi)
	return mi


func _sphere(r: float, pos: Vector3, mat: Material, parent: Node3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	s.radial_segments = 12
	s.rings = 6
	mi.mesh = s
	mi.material_override = mat
	mi.position = pos
	(parent if parent else self).add_child(mi)
	return mi


static func _shadow_material() -> StandardMaterial3D:
	if _shadow_mat == null:
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
		g.colors = PackedColorArray([Color(0, 0, 0, 0.55), Color(0, 0, 0, 0.3), Color(0, 0, 0, 0)])
		var gt := GradientTexture2D.new()
		gt.gradient = g
		gt.fill = GradientTexture2D.FILL_RADIAL
		gt.fill_from = Vector2(0.5, 0.5)
		gt.fill_to = Vector2(1.0, 0.5)
		_shadow_mat = StandardMaterial3D.new()
		_shadow_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_shadow_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_shadow_mat.albedo_texture = gt
		_shadow_mat.render_priority = 1
	return _shadow_mat


## Instantiates a Meshy prop scaled so its walkable top spans `width_m`, top surface at y=0,
## depth clamped to `max_depth`. Returns null when the prop isn't there.
func _prop(name: String, width_m: float, max_depth := 99.0, depth_scale := 1.0, full := false, ysq := 1.0) -> Node3D:
	if not ResourceLoader.exists(PROPS % name):
		return null
	var inst := _load_prop(name)
	var fit: Dictionary = _fit(name, inst)
	var holder := Node3D.new()
	holder.add_child(inst)
	var sx: float = width_m / (fit.fw if full else fit.w)
	var sz: float = minf(sx * depth_scale, max_depth / fit.d)
	var sy: float = sx * ysq
	inst.scale = Vector3(sx, sy, sz)
	inst.position = Vector3(-(fit.fcx if full else fit.cx) * sx, -fit.top * sy, -fit.cz * sz)
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if TINT.has(name):
			var m3 := mi as MeshInstance3D
			for si in m3.mesh.get_surface_count():
				var sm := m3.mesh.surface_get_material(si)
				if sm is BaseMaterial3D:
					var c := (sm as BaseMaterial3D).duplicate() as BaseMaterial3D
					c.albedo_color = c.albedo_color * TINT[name]
					m3.set_surface_override_material(si, c)
	return holder


static func _load_prop(name: String) -> Node3D:
	var inst := (load(PROPS % name) as PackedScene).instantiate() as Node3D
	if not CROP.has(name):
		return inst
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		var m: MeshInstance3D = mi
		var key := name + str(m.mesh.get_instance_id())
		if not _crop_cache.has(key):
			_crop_cache[key] = _crop(m.mesh, CROP[name])
		m.mesh = _crop_cache[key]
	return inst


static func _crop(mesh: Mesh, band) -> ArrayMesh:
	if band is String:
		return _main_piece(mesh)
	var aabb := mesh.get_aabb()
	var y0: float = aabb.position.y + aabb.size.y * band[0]
	var y1: float = aabb.position.y + aabb.size.y * band[1]
	var out := ArrayMesh.new()
	for si in mesh.get_surface_count():
		var arr: Array = mesh.surface_get_arrays(si)
		var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		if idx.is_empty():
			idx.resize(vs.size())
			for i in vs.size():
				idx[i] = i
		var keep := PackedInt32Array()
		for i in range(0, idx.size(), 3):
			var ok := true
			for k in 3:
				var y := vs[idx[i + k]].y
				if y < y0 or y > y1:
					ok = false
					break
			if ok:
				keep.append(idx[i])
				keep.append(idx[i + 1])
				keep.append(idx[i + 2])
		arr[Mesh.ARRAY_INDEX] = keep
		out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		out.surface_set_material(si, mesh.surface_get_material(si))
	return out


static func _main_piece(mesh: Mesh) -> ArrayMesh:
	var aabb := mesh.get_aabb()
	var out := ArrayMesh.new()
	for si in mesh.get_surface_count():
		var arr: Array = mesh.surface_get_arrays(si)
		var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		# union-find over welded positions
		var weld := {}
		var parent := PackedInt32Array()
		parent.resize(vs.size())
		var rep := PackedInt32Array()
		rep.resize(vs.size())
		for i in vs.size():
			var k := Vector3i((vs[i] * 2000.0).round())
			if not weld.has(k):
				weld[k] = i
			rep[i] = weld[k]
			parent[i] = i
		var find := func(x: int) -> int:
			while parent[x] != x:
				parent[x] = parent[parent[x]]
				x = parent[x]
			return x
		for i in range(0, idx.size(), 3):
			var a: int = find.call(rep[idx[i]])
			for k in range(1, 3):
				var b: int = find.call(rep[idx[i + k]])
				if a != b:
					parent[b] = a
		var comp := {}   # root -> {n, lo, hi, sum}
		for i in range(0, idx.size(), 3):
			var r: int = find.call(rep[idx[i]])
			if not comp.has(r):
				comp[r] = {"n": 0, "lo": Vector3(INF, INF, INF), "hi": -Vector3(INF, INF, INF), "sum": Vector3.ZERO}
			var c: Dictionary = comp[r]
			c.n += 1
			for k in 3:
				var v := vs[idx[i + k]]
				c.lo = (c.lo as Vector3).min(v)
				c.hi = (c.hi as Vector3).max(v)
				c.sum += v / 3.0
		var main := -1
		var best := 0
		var high := aabb.position.y + aabb.size.y * 0.7
		for r in comp:
			if comp[r].hi.y >= high and comp[r].n > best:
				best = comp[r].n
				main = r
		var box := AABB(comp[main].lo, comp[main].hi - comp[main].lo).grow(aabb.size.length() * 0.01)
		var keep := {}
		for r in comp:
			if r == main or box.has_point(comp[r].sum / comp[r].n):
				keep[r] = true
		var nidx := PackedInt32Array()
		for i in range(0, idx.size(), 3):
			if keep.has(find.call(rep[idx[i]])):
				nidx.append(idx[i])
				nidx.append(idx[i + 1])
				nidx.append(idx[i + 2])
		arr[Mesh.ARRAY_INDEX] = nidx
		out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		out.surface_set_material(si, mesh.surface_get_material(si))
	return out


## Measures a prop: x centre and width of its walkable top, the top's height, z centre and depth.
static func _fit(name: String, inst: Node3D) -> Dictionary:
	if _fit_cache.has(name):
		return _fit_cache[name]
	var pts := PackedVector3Array()
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		var m: Mesh = (mi as MeshInstance3D).mesh
		var xf: Transform3D = (mi as MeshInstance3D).transform
		var p: Node = mi.get_parent()
		while p != null and p != inst and p is Node3D:
			xf = (p as Node3D).transform * xf
			p = p.get_parent()
		for s in m.get_surface_count():
			var arr: Array = m.surface_get_arrays(s)
			var vv: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var ii: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
			if ii.is_empty():
				for v in vv:
					pts.append(xf * v)
			else:
				var used := {}
				for j in ii:
					used[j] = true
				for j in used:
					pts.append(xf * vv[j])
	var lo := Vector3(INF, INF, INF)
	var hi := -lo
	for v in pts:
		lo = lo.min(v)
		hi = hi.max(v)
	# column tops across x (middle third in z): the walkable surface is the median top
	var cols := 40
	var tops := []
	tops.resize(cols)
	tops.fill(-INF)
	var zc := (lo.z + hi.z) * 0.5
	var zr := (hi.z - lo.z) * 0.25
	for v in pts:
		if absf(v.z - zc) > zr:
			continue
		var i := clampi(int((v.x - lo.x) / (hi.x - lo.x) * cols), 0, cols - 1)
		tops[i] = maxf(tops[i], v.y)
	var valid := []
	for tp in tops:
		if tp > -INF:
			valid.append(tp)
	valid.sort()
	var top: float = valid[valid.size() / 2] if valid.size() > 0 else hi.y
	# walkable span: columns whose top is close to the surface
	var tol := (hi.y - lo.y) * 0.12
	var first := -1
	var last := -1
	for i in cols:
		if tops[i] > -INF and absf(tops[i] - top) < tol:
			if first < 0:
				first = i
			last = i
	var x0 := lo.x + (hi.x - lo.x) * (first / float(cols))
	var x1 := lo.x + (hi.x - lo.x) * ((last + 1) / float(cols))
	var r := {"cx": (x0 + x1) * 0.5, "w": maxf(0.01, x1 - x0), "fcx": (lo.x + hi.x) * 0.5, "fw": hi.x - lo.x, "top": top, "cz": zc, "d": maxf(0.01, hi.z - lo.z), "h": hi.y - lo.y}
	_fit_cache[name] = r
	return r


func _follow(i: int, node: Node3D, off := Vector3.ZERO) -> void:
	add_child(node)
	plat_nodes[i] = node
	plat_off[i] = off
	_place_plat(i)


func _place_plat(i: int) -> void:
	var r: Rect2 = stage.plats[i].rect
	plat_nodes[i].position = w(Vector2(r.get_center().x, r.position.y)) + plat_off[i]


static var _tile_tex: Texture2D


static func _tiles() -> Texture2D:
	if _tile_tex != null:
		return _tile_tex
	var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	var n := FastNoiseLite.new()
	n.frequency = 0.08
	for y in 64:
		for x in 64:
			var v := 0.85 + 0.15 * n.get_noise_2d(x, y)
			if x < 2 or y < 2:
				v *= 0.55
			img.set_pixel(x, y, Color(v, v, v))
	img.generate_mipmaps()
	_tile_tex = ImageTexture.create_from_image(img)
	return _tile_tex


static func _windows() -> Texture2D:
	if _win_tex != null:
		return _win_tex
	var rng := RandomNumberGenerator.new()
	rng.seed = 11
	var img := Image.create(128, 256, false, Image.FORMAT_RGBA8)
	img.fill(Color(0.035, 0.03, 0.07))
	for cy in 16:
		for cx in 8:
			var r := rng.randf()
			var c := Color(0.09, 0.1, 0.2)
			if r < 0.3:
				c = Color(1.0, 0.72, 0.4)
			elif r < 0.4:
				c = Color(0.35, 0.85, 1.0)
			elif r < 0.45:
				c = Color(1.0, 0.35, 0.8)
			for y in 10:
				for x in 10:
					var dim := 1.0 - y * 0.03
					img.set_pixel(cx * 16 + 3 + x, cy * 16 + 3 + y, c * dim)
	img.generate_mipmaps()
	_win_tex = ImageTexture.create_from_image(img)
	return _win_tex


func _windows_mat(tiles: Vector2) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_texture = _windows()
	m.uv1_scale = Vector3(tiles.x, tiles.y, 1)
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	return m


func _facade(size: Vector2, pos: Vector3, parent: Node3D = null, tint := Color.WHITE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = size
	mi.mesh = q
	var m := _windows_mat(Vector2(size.x / 3.2, size.y / 6.4))
	m.albedo_color = tint
	mi.material_override = m
	mi.position = pos
	(parent if parent else self).add_child(mi)
	return mi


func _blink(m: StandardMaterial3D, rate: float, phase := 0.0) -> void:
	blinkers.append({"mat": m, "base": m.albedo_color, "rate": rate, "phase": phase})


# ------------------------------------------------------------------ neon skyline
func _build_rooftop() -> void:
	var r: Rect2 = stage.plats[0].rect
	var wm := r.size.x / PXU
	var root := Node3D.new()
	var dark := _mat(Color(0.09, 0.08, 0.14), 0.6, 0.3)
	var steel := _mat(Color(0.32, 0.32, 0.42), 0.35, 0.8)
	# the tower and its lit windows
	_box(Vector3(wm - 0.6, 40.0, 4.6), Vector3(0, -20.55, -1.8), dark, root)
	_facade(Vector2(wm - 1.6, 38.0), Vector3(0, -20.6, 0.51), root)
	for x in [-wm * 0.5 + 0.3, wm * 0.5 - 0.3, -wm * 0.17, wm * 0.17]:
		_box(Vector3(0.35, 40.0, 0.4), Vector3(x, -20.55, 0.55), dark, root)
	# roof slab with a neon lip
	_box(Vector3(wm, 0.55, 5.0), Vector3(0, -0.29, -1.7), _mat(Color(0.2, 0.19, 0.28), 0.5, 0.4), root)
	var floor := _mat(Color(0.16, 0.15, 0.22), 0.22, 0.35)
	floor.albedo_texture = _tiles()
	floor.uv1_scale = Vector3(wm / 1.2, 5.0 / 1.2, 1)
	floor.uv1_triplanar = false
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(wm - 0.3, 4.8)
	fl.mesh = pm
	fl.material_override = floor
	fl.position = Vector3(0, 0.002, -1.7)
	root.add_child(fl)
	# parapet lip along the front edge
	_box(Vector3(wm + 0.04, 0.12, 0.25), Vector3(0, -0.06, 0.72), _mat(Color(0.55, 0.55, 0.72), 0.3, 0.7), root)
	var neon := _glow_mat(Color(1.0, 0.25, 0.85), 2.2)
	_box(Vector3(wm + 0.06, 0.09, 0.1), Vector3(0, -0.5, 0.82), neon, root)
	_blink(neon, 3.0)
	# neon sign
	var sign := Node3D.new()
	sign.position = Vector3(0, -2.4, 0.62)
	root.add_child(sign)
	_box(Vector3(5.2, 1.4, 0.15), Vector3.ZERO, _mat(Color(0.04, 0.03, 0.08)), sign)
	var lbl := Label3D.new()
	lbl.text = "STRIKE"
	lbl.font = Game.font_display
	lbl.font_size = 128
	lbl.pixel_size = 0.0085
	lbl.modulate = Color(0.5, 1.6, 2.0)
	lbl.outline_size = 0
	lbl.shaded = false
	lbl.position = Vector3(0, -0.02, 0.1)
	sign.add_child(lbl)
	var frame := _glow_mat(Color(0.3, 0.95, 1.0), 1.8)
	for e in [[Vector3(5.2, 0.06, 0.06), Vector3(0, 0.7, 0.1)], [Vector3(5.2, 0.06, 0.06), Vector3(0, -0.7, 0.1)],
			[Vector3(0.06, 1.4, 0.06), Vector3(-2.6, 0, 0.1)], [Vector3(0.06, 1.4, 0.06), Vector3(2.6, 0, 0.1)]]:
		_box(e[0], e[1], frame, sign)
	blinkers.append({"mat": frame, "base": frame.albedo_color, "rate": -1.0, "phase": 0.0, "label": lbl})
	# roof props: AC units with spinning fans, an antenna, a water tank at the back
	for x in [-8.6, 7.7]:
		var ac := Node3D.new()
		ac.position = Vector3(x, 0, -3.3)
		root.add_child(ac)
		_box(Vector3(1.05, 0.6, 0.9), Vector3(0, 0.3, 0), _mat(Color(0.24, 0.24, 0.32), 0.45, 0.6), ac)
		_box(Vector3(1.07, 0.06, 0.92), Vector3(0, 0.6, 0), steel, ac)
		var fan := _box(Vector3(0.7, 0.04, 0.08), Vector3(0, 0.64, 0), _mat(Color(0.1, 0.1, 0.14)), ac)
		spinners.append({"node": fan, "axis": Vector3.UP, "speed": 9.0})
	var ant := Node3D.new()
	ant.position = Vector3(6.25, 0, -3.6)
	root.add_child(ant)
	_cyl(0.05, 2.6, Vector3(0, 1.3, 0), steel, ant)
	for k in 3:
		_box(Vector3(0.6 - k * 0.15, 0.03, 0.03), Vector3(0, 1.4 + k * 0.4, 0), steel, ant)
	var red := _glow_mat(Color(1.0, 0.15, 0.15), 3.0)
	_sphere(0.09, Vector3(0, 2.65, 0), red, ant)
	_blink(red, -1.4)
	var tank := Node3D.new()
	tank.position = Vector3(-5.5, 0, -3.4)
	tank.scale = Vector3.ONE * 0.8
	root.add_child(tank)
	var wood := _mat(Color(0.3, 0.2, 0.18), 0.85)
	for lx in [-0.6, 0.6]:
		for lz in [-0.6, 0.6]:
			_cyl(0.05, 1.2, Vector3(lx, 0.6, lz), steel, tank)
	_cyl(0.95, 1.7, Vector3(0, 2.05, 0), wood, tank)
	var cone := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.05
	cm.bottom_radius = 1.05
	cm.height = 0.6
	cone.mesh = cm
	cone.material_override = _mat(Color(0.2, 0.17, 0.2), 0.7, 0.3)
	cone.position = Vector3(0, 3.2, 0)
	tank.add_child(cone)
	_follow(0, root)
	# soft platforms: hanging steel grates with cyan under-glow
	var cyan := _glow_mat(Color(0.3, 0.95, 1.0), 2.0)
	for i in range(1, stage.plats.size()):
		var p: Rect2 = stage.plats[i].rect
		var g := Node3D.new()
		var pw := p.size.x / PXU
		_box(Vector3(pw, 0.22, 2.4), Vector3(0, -0.11, -0.5), _mat(Color(0.22, 0.22, 0.32), 0.4, 0.8), g)
		for k in int(pw / 0.35):
			_box(Vector3(0.05, 0.03, 2.3), Vector3(-pw * 0.5 + 0.2 + k * 0.35, 0.005, -0.5), _mat(Color(0.12, 0.12, 0.18), 0.5, 0.6), g)
		_box(Vector3(pw, 0.06, 0.06), Vector3(0, -0.25, 0.7), cyan, g)
		for sx in [-pw * 0.5 + 0.2, pw * 0.5 - 0.2]:
			for sz in [0.5, -1.5]:
				_cyl(0.02, 14.0, Vector3(sx, 7.0, sz), steel, g)
		_follow(i, g)
	# the city in 3D behind the stage
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	for k in 26:
		var z := -rng.randf_range(16.0, 60.0)
		var bw := rng.randf_range(4.0, 9.0)
		var bh := rng.randf_range(14.0, 34.0) + (-z) * 0.25
		var x := rng.randf_range(-60.0, 60.0)
		var top := rng.randf_range(-12.0, 6.0) - z * 0.08
		var b := Node3D.new()
		b.position = Vector3(x, top - bh * 0.5, z)
		add_child(b)
		var shade := clampf(0.5 - (-z - 16.0) / 90.0, 0.15, 0.5)
		_box(Vector3(bw, bh, bw * 0.8), Vector3.ZERO, _mat(Color(0.06, 0.04, 0.11)), b)
		_facade(Vector2(bw - 0.6, bh - 1.0), Vector3(0, 0, bw * 0.4 + 0.02), b, Color(shade + 0.25, shade + 0.2, shade + 0.35))
		if rng.randf() < 0.4:
			var n := _glow_mat(Color.from_hsv(rng.randf_range(0.5, 0.95), 0.75, 1.0), 1.4)
			_box(Vector3(bw + 0.05, 0.12, bw * 0.8 + 0.05), Vector3(0, bh * 0.5 - 0.3, 0), n, b)


# ------------------------------------------------------------------ sunset shrine
func _build_island() -> void:
	var r: Rect2 = stage.plats[0].rect
	var IS := "island2" if ResourceLoader.exists(PROPS % "island2") else "island"
	var isl := _prop(IS, r.size.x / PXU * 1.02, 9.0)
	if isl != null:
		_follow(0, isl, Vector3(0, 0, -2.2))
	# shrine lanterns at both edges
	var lan := Node3D.new()
	add_child(lan)
	var red := _mat(Color(0.75, 0.14, 0.12), 0.5)
	var dark := _mat(Color(0.18, 0.08, 0.08), 0.7)
	for x in [r.position.x + 34.0, r.end.x - 34.0]:
		var l := Node3D.new()
		l.position = w(Vector2(x, r.position.y), -1.6)
		lan.add_child(l)
		_cyl(0.07, 1.4, Vector3(0, 0.7, 0), dark, l)
		_box(Vector3(0.48, 0.08, 0.48), Vector3(0, 1.42, 0), dark, l)
		_box(Vector3(0.36, 0.45, 0.36), Vector3(0, 1.69, 0), red, l)
		var lit := _glow_mat(Color(1.0, 0.75, 0.35), 2.2)
		_box(Vector3(0.24, 0.32, 0.38), Vector3(0, 1.69, 0), lit, l)
		_blink(lit, 4.0, x)
		_box(Vector3(0.56, 0.08, 0.56), Vector3(0, 1.95, 0), dark, l)
		var o := OmniLight3D.new()
		o.light_color = Color(1.0, 0.6, 0.3)
		o.light_energy = 1.2
		o.omni_range = 4.0
		o.position = Vector3(0, 1.7, 0.6)
		l.add_child(o)
	# soft platforms: lacquered planks; the moving one is a little floating rock
	for i in range(1, stage.plats.size()):
		var p: Rect2 = stage.plats[i].rect
		var node: Node3D
		if stage.plats[i].has("move"):
			node = _prop(IS, p.size.x / PXU * 1.15, 3.0, 1.0, true, 0.55)
		else:
			node = _prop("plank", p.size.x / PXU * 1.04, 2.2, 1.0)
		if node != null:
			_follow(i, node, Vector3(0, 0, -0.6))
	# far-off islands drifting in the haze
	var rng := RandomNumberGenerator.new()
	rng.seed = 21
	for k in 7:
		var far := _prop(IS, rng.randf_range(6.0, 13.0), 8.0, 1.0, true, 0.8)
		if far == null:
			break
		var z := -rng.randf_range(45.0, 95.0)
		var fx := rng.randf_range(20.0, 75.0) * (1.0 if k % 2 == 0 else -1.0)
		far.position = Vector3(fx, rng.randf_range(-10.0, 12.0), z)
		far.rotation_degrees.y = rng.randf_range(-40.0, 40.0)
		add_child(far)
		spinners.append({"node": far, "axis": Vector3.UP, "speed": rng.randf_range(-0.03, 0.03), "bob": rng.randf() * TAU})


# ------------------------------------------------------------------ the line
func _build_line() -> void:
	var r: Rect2 = stage.plats[0].rect
	var hov := _prop("hover", r.size.x / PXU * 1.02, 7.0)
	if hov != null:
		_follow(0, hov, Vector3(0, 0, -1.6))
		var o := OmniLight3D.new()
		o.light_color = Color(0.3, 0.9, 1.0)
		o.light_energy = 2.0
		o.omni_range = 10.0
		o.position = Vector3(0, -2.5, 1.5)
		hov.add_child(o)
	# pylons and rings floating in the void
	var cyan := _glow_mat(Color(0.3, 0.9, 1.0), 1.6)
	var pink := _glow_mat(Color(1.0, 0.35, 0.9), 1.6)
	var metal := _mat(Color(0.08, 0.09, 0.14), 0.3, 0.9)
	var rng := RandomNumberGenerator.new()
	rng.seed = 33
	for k in 14:
		var z := -rng.randf_range(18.0, 70.0)
		var x := rng.randf_range(-60.0, 60.0)
		if absf(x) < 14.0 and z > -30.0:
			x += signf(x + 0.01) * 14.0
		var h := rng.randf_range(4.0, 16.0)
		var py := Node3D.new()
		py.position = Vector3(x, rng.randf_range(-14.0, 4.0), z)
		add_child(py)
		_box(Vector3(0.8, h, 0.8), Vector3.ZERO, metal, py)
		_box(Vector3(0.84, 0.12, 0.84), Vector3(0, h * 0.5 - 0.4, 0), cyan if k % 3 else pink, py)
		_box(Vector3(0.84, 0.12, 0.84), Vector3(0, -h * 0.5 + 0.4, 0), cyan if k % 3 else pink, py)
		spinners.append({"node": py, "axis": Vector3.UP, "speed": rng.randf_range(-0.4, 0.4), "bob": rng.randf() * TAU})


# ------------------------------------------------------------------ items
func _item_node(kind: String) -> Node3D:
	var size := {"bomb": 0.75, "food": 0.95, "core": 1.25}
	var inst: Node3D
	if ResourceLoader.exists(PROPS % kind):
		inst = _load_prop(kind)
		var holder := Node3D.new()
		holder.add_child(inst)
		var aabb := _aabb(inst)
		var s: float = size[kind] / maxf(aabb.size.x, maxf(aabb.size.y, aabb.size.z))
		inst.scale = Vector3.ONE * s
		inst.position = -aabb.get_center() * s
		inst = holder
	else:
		inst = Node3D.new()
		var m := _mat(Color(0.12, 0.12, 0.16), 0.3, 0.6) if kind == "bomb" else _glow_mat(Color(1.0, 0.75, 0.25), 1.5)
		if kind == "food":
			m = _mat(Color(0.75, 0.42, 0.2), 0.5)
		_sphere(size[kind] * 0.45, Vector3.ZERO, m, inst)
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(inst)
	return inst


static func _aabb(n: Node3D) -> AABB:
	var box := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var xf: Transform3D = (mi as MeshInstance3D).transform
		var p: Node = mi.get_parent()
		while p != null and p != n and p is Node3D:
			xf = (p as Node3D).transform * xf
			p = p.get_parent()
		var m: Mesh = (mi as MeshInstance3D).mesh
		for si in m.get_surface_count():
			var arr: Array = m.surface_get_arrays(si)
			var vv: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var ii: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
			for j in (ii if not ii.is_empty() else range(vv.size())):
				var v: Vector3 = xf * vv[j]
				if first:
					box = AABB(v, Vector3.ZERO)
					first = false
				else:
					box = box.expand(v)
	return box


func _sync_items() -> void:
	var items = arena.items
	if items == null:
		return
	# pooled per kind ("bomb#0", "bomb#1", ...) so it also works on online guests
	var seen := {}
	var count := {}
	for it in items.list:
		var kn: int = count.get(it.kind, 0)
		count[it.kind] = kn + 1
		var key := "%s#%d" % [it.kind, kn]
		seen[key] = true
		if not item_nodes.has(key):
			item_nodes[key] = _item_node(it.kind)
		var n: Node3D = item_nodes[key]
		var p: Vector2 = it.p
		var z := 0.35 if it.held_by != null else 0.0
		if it.kind == "food":
			p.y -= 10.0 + (sin(t * 3.0 + p.x) * 4.0 if it.grounded else 0.0)
			n.rotation.y = t * 1.6
		else:
			p.y -= 4.0
			if it.thrown_by != null and not it.grounded:
				n.rotation.z -= 0.25 * signf(it.v.x if absf(it.v.x) > 0.1 else 1.0)
			else:
				n.rotation.y = sin(t * 1.5 + p.x) * 0.6
		n.position = w(p, z)
	for key in item_nodes.keys():
		if not seen.has(key):
			(item_nodes[key] as Node3D).queue_free()
			item_nodes.erase(key)
	var core: Dictionary = items.core
	if core.is_empty():
		if core_node:
			core_node.visible = false
	else:
		if core_node == null:
			core_node = _item_node("core")
		core_node.visible = true
		core_node.position = w(core.p, 0.4)
		core_node.rotation = Vector3(sin(t * 1.3) * 0.2, sin(t * 1.7) * 0.45, sin(t * 0.9) * 0.15)
		var s: float = 1.0 + 0.06 * sin(t * 8.0) + core.get("flash", 0.0) * 0.25
		core_node.scale = Vector3.ONE * s


# ------------------------------------------------------------------ per frame
func update(delta: float) -> void:
	t += delta
	for i in plat_nodes:
		_place_plat(i)
	for b in blinkers:
		var k := 1.0
		var rate: float = b.rate
		if rate > 0.0:
			k = 0.8 + 0.2 * sin(t * rate + b.phase)
		elif rate < 0.0:
			k = 1.0 if fmod(t, -rate) < -rate * 0.4 else 0.15
		else:
			k = 1.0 if fmod(t, 4.3) > 0.12 else 0.3
		if b.has("label"):
			k = 1.0 if fmod(t, 4.3) > 0.12 and fmod(t, 4.3) < 4.2 else 0.25
			(b.label as Label3D).modulate = Color(0.5, 1.6, 2.0) * k
		var c: Color = b.base
		(b.mat as StandardMaterial3D).albedo_color = Color(c.r * k, c.g * k, c.b * k)
	for s in spinners:
		var n: Node3D = s.node
		if s.speed != 0.0:
			n.rotate(s.axis, s.speed * delta)
		if s.has("bob"):
			n.position.y += sin(t * 0.7 + s.bob) * 0.004
		if s.has("pulse"):
			n.scale = Vector3.ONE * (1.0 + 0.02 * sin(t * 1.5 + s.pulse))
	for i in shadows.size():
		var sh: MeshInstance3D = shadows[i]
		var f = arena.fighters[i]
		if not f.visible or f.intro_t > 0 or f.state == Fighter.S.DEAD or f.state == Fighter.S.OUT:
			sh.visible = false
			continue
		var gy: float = stage.ground_below(f.pos)
		if gy == INF:
			sh.visible = false
			continue
		var k := clampf(1.0 - (gy - f.pos.y) / 400.0, 0.2, 1.0)
		sh.visible = true
		sh.position = w(Vector2(f.pos.x, gy), 0.0) + Vector3(0, 0.03, 0)
		sh.scale = Vector3.ONE * k * f.scale_k
	_sync_items()
