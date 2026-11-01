extends Node3D
## A tropical island: a procedural heightmap (volcanic peak, beaches, a reef shelf)
## dressed with photo-scanned trees, cliffs and rocks (Poly Haven, CC0), and a height lookup that the ship (running
## aground), the shot (hitting land) and the ocean shader (shallows, surf) all share.

const RES := 192 ## heightmap samples per side
const SIZE := 1200.0 ## metres covered by the heightmap
const PEAK := 170.0

var heights := PackedFloat32Array()
var height_tex: ImageTexture
var _noise: NoiseTexture2D
var trees: Array = [] ## MultiMeshInstance3D per tree part, hidden on slow phones
const TREES_PER_KIND := 200
const CHUNK := 150.0 ## metres: trees are batched per tile so far tiles drop to low LODs and off-screen ones are culled
var origin := Vector2.ZERO ## world x/z of the heightmap's corner


func build(center: Vector3, seed_value := 11) -> void:
	position = Vector3(center.x, 0.0, center.z)
	origin = Vector2(center.x, center.z) - Vector2(SIZE, SIZE) * 0.5
	var fnl := FastNoiseLite.new()
	fnl.seed = seed_value
	fnl.frequency = 0.0028
	fnl.fractal_octaves = 5
	fnl.fractal_gain = 0.5
	var ridge := FastNoiseLite.new()
	ridge.seed = seed_value + 5
	ridge.frequency = 0.006
	ridge.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	ridge.fractal_octaves = 4
	heights.resize(RES * RES)
	var img := Image.create(RES, RES, false, Image.FORMAT_RF)
	for j in RES:
		for i in RES:
			var x := (float(i) / (RES - 1) - 0.5) * SIZE
			var z := (float(j) / (RES - 1) - 0.5) * SIZE
			# an elongated main island with a smaller hump off one end
			var r := Vector2(x / 400.0, z / 270.0).length()
			var r2 := Vector2((x - 230.0) / 120.0, (z + 120.0) / 110.0).length()
			var mass := maxf(1.0 - r, 0.0)
			mass = maxf(mass, maxf(1.0 - r2, 0.0) * 0.55)
			var n := fnl.get_noise_2d(x, z)
			var shape := mass + n * 0.22
			var h := -32.0 + 46.0 * smoothstep(-0.15, 0.25, shape) # shelf rising to the beach
			var land := smoothstep(0.18, 0.75, shape)
			h += land * PEAK * (0.55 + 0.45 * absf(ridge.get_noise_2d(x, z))) * pow(clampf(mass * 1.1, 0.0, 1.0), 1.25)
			h = maxf(h, -32.0)
			heights[j * RES + i] = h
			img.set_pixel(i, j, Color(h, 0, 0))
	height_tex = ImageTexture.create_from_image(img)
	_build_mesh()
	_build_trees()
	_build_rocks()


## Ground height at world (x, z); deep water away from the island.
func height(x: float, z: float) -> float:
	var fx := (x - origin.x) / SIZE * (RES - 1)
	var fz := (z - origin.y) / SIZE * (RES - 1)
	if fx < 0.0 or fz < 0.0 or fx >= RES - 1 or fz >= RES - 1:
		return -60.0
	var i := int(fx)
	var j := int(fz)
	var tx := fx - i
	var tz := fz - j
	var a := lerpf(heights[j * RES + i], heights[j * RES + i + 1], tx)
	var b := lerpf(heights[(j + 1) * RES + i], heights[(j + 1) * RES + i + 1], tx)
	return lerpf(a, b, tz)


func rect() -> Vector4: ## x0, z0, size for the ocean shader
	return Vector4(origin.x, origin.y, SIZE, 0.0)


func _local(i: int, j: int) -> Vector3:
	return Vector3((float(i) / (RES - 1) - 0.5) * SIZE, heights[j * RES + i], (float(j) / (RES - 1) - 0.5) * SIZE)


func _build_mesh() -> void:
	var verts := PackedVector3Array()
	var normals := PackedVector3Array()
	verts.resize(RES * RES)
	normals.resize(RES * RES)
	var cell := SIZE / (RES - 1)
	for j in RES:
		for i in RES:
			verts[j * RES + i] = _local(i, j)
			var hl := heights[j * RES + maxi(i - 1, 0)]
			var hr := heights[j * RES + mini(i + 1, RES - 1)]
			var hd := heights[maxi(j - 1, 0) * RES + i]
			var hu := heights[mini(j + 1, RES - 1) * RES + i]
			normals[j * RES + i] = Vector3(hl - hr, 2.0 * cell, hd - hu).normalized()
	var idx := PackedInt32Array()
	for j in RES - 1:
		for i in RES - 1:
			# skip quads deep under water: nobody sees them
			var a := j * RES + i
			if maxf(maxf(heights[a], heights[a + 1]), maxf(heights[a + RES], heights[a + RES + 1])) < -30.0:
				continue
			idx.append_array([a, a + 1, a + RES, a + 1, a + RES + 1, a + RES])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_INDEX] = idx
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/terrain.gdshader")
	var noise := NoiseTexture2D.new()
	noise.seamless = true
	noise.width = 512
	noise.height = 512
	var fnl := FastNoiseLite.new()
	fnl.frequency = 0.03
	fnl.fractal_octaves = 5
	noise.noise = fnl
	m.set_shader_parameter("noise_tex", noise)
	for layer in ["coast_sand_01", "damp_beach_sand", "forest_leaves_02", "aerial_rocks_02", "coral_ground_02"]:
		m.set_shader_parameter(layer + "_diff", load("res://assets/island/ground/%s_diff.jpg" % layer))
		m.set_shader_parameter(layer + "_nor", load("res://assets/island/ground/%s_nor_gl.jpg" % layer))
	_noise = noise
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


## Photo-scanned coastal trees (Poly Haven, CC0), slimmed by tools/build_island_assets.py.
## One MultiMesh per tree part keeps the importer's automatic LODs, so distant trees are cheap.
func _build_trees() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 9
	var kinds := ["island_tree_01", "island_tree_02", "island_tree_03"]
	var spots := [[], [], []]
	var cell := SIZE / (RES - 1)
	for tries in 150000:
		var x := rng.randf_range(-0.5, 0.5) * SIZE
		var z := rng.randf_range(-0.5, 0.5) * SIZE
		var h := height(x + position.x, z + position.z)
		if h < 1.8 or h > 22.0: # real trees fringe the beaches; the hills' jungle is drawn by terrain.gdshader
			continue
		var sl := absf(height(x + position.x + cell, z + position.z) - height(x + position.x - cell, z + position.z)) / (2.0 * cell)
		if sl > 0.8:
			continue
		# thickest just behind the beach, thinning out up the hills
		var k := rng.randi_range(0, 2)
		if spots[k].size() >= TREES_PER_KIND:
			continue
		var sc := rng.randf_range(2.0, 3.4)
		var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc * rng.randf_range(0.9, 1.15), sc))
		spots[k].append(Transform3D(b, Vector3(x, h - 0.25, z)))
		if spots[0].size() + spots[1].size() + spots[2].size() >= TREES_PER_KIND * 3:
			break
	for k in kinds.size():
		_scatter("res://assets/island/%s.glb" % kinds[k], spots[k], true)


## Scanned coastal cliffs and rock shelves along the shore, boulders on the beaches.
func _build_rocks() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 13
	var cliffs := []
	var shelves := []
	var boulders := []
	var cell := SIZE / (RES - 1)
	for tries in 30000:
		var x := rng.randf_range(-0.5, 0.5) * SIZE
		var z := rng.randf_range(-0.5, 0.5) * SIZE
		var wx := x + position.x
		var wz := z + position.z
		var h := height(wx, wz)
		var gx := (height(wx + cell, wz) - height(wx - cell, wz)) / (2.0 * cell)
		var gz := (height(wx, wz + cell) - height(wx, wz - cell)) / (2.0 * cell)
		var sl := Vector2(gx, gz).length()
		# the direction down the slope, i.e. out to sea: the rock's face turns that way
		var out := atan2(-gx, -gz)
		if h > -1.0 and h < 8.0 and sl > 0.5 and cliffs.size() < 14:
			var sc := rng.randf_range(0.6, 1.0)
			cliffs.append(Transform3D(Basis(Vector3.UP, out).scaled(Vector3(sc, sc * rng.randf_range(1.0, 1.3), sc)), Vector3(x, h - 4.0, z)))
		elif h > -2.5 and h < 0.6 and shelves.size() < 18 and rng.randf() < 0.3:
			var sc := rng.randf_range(0.35, 0.6)
			shelves.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc, sc)), Vector3(x, h - 0.8, z)))
		elif h > 0.3 and h < 4.0 and boulders.size() < 70 and rng.randf() < 0.2:
			var sc := rng.randf_range(0.7, 2.2)
			boulders.append(Transform3D(Basis(Vector3(rng.randf(), 1.0, rng.randf()).normalized(), rng.randf() * TAU).scaled(Vector3(sc, sc, sc)), Vector3(x, h - 0.3 * sc, z)))
	_scatter("res://assets/island/coastal_cliff_01.glb", cliffs.slice(0, cliffs.size() / 2), false)
	_scatter("res://assets/island/coastal_cliff_02.glb", cliffs.slice(cliffs.size() / 2), false)
	_scatter("res://assets/island/coast_rocks_01.glb", shelves, false)
	_scatter("res://assets/island/coast_rocks_05.glb", boulders, false)


## Instance every mesh part of a .glb at these transforms (one MultiMesh per part).
func _scatter(path: String, xforms: Array, foliage: bool) -> void:
	if xforms.is_empty() or not ResourceLoader.exists(path):
		return
	var scene: Node = (load(path) as PackedScene).instantiate()
	var parts := []
	var stack := [scene]
	while stack.size() > 0:
		var n: Node = stack.pop_back()
		stack.append_array(n.get_children())
		if n is MeshInstance3D:
			parts.append(n)
	var chunks := {}
	for xf in xforms:
		var key := Vector2i(floori(xf.origin.x / CHUNK), floori(xf.origin.z / CHUNK))
		if not chunks.has(key):
			chunks[key] = []
		chunks[key].append(xf)
	for key in chunks:
		_scatter_parts(parts, scene, chunks[key], foliage)
	scene.free()


func _scatter_parts(parts: Array, scene: Node, xforms: Array, foliage: bool) -> void:
	for mi in parts:
		var local: Transform3D = (mi as Node3D).transform
		var p: Node = mi.get_parent()
		while p and p != scene:
			local = (p as Node3D).transform * local
			p = p.get_parent()
		var mesh: Mesh = mi.mesh
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mm.instance_count = xforms.size()
		for k in xforms.size():
			mm.set_instance_transform(k, xforms[k] * local)
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if foliage:
			for i in mesh.get_surface_count():
				var m := mesh.surface_get_material(i) as StandardMaterial3D
				if m and m.resource_name.ends_with("_leaves"):
					m = m.duplicate()
					m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
					m.alpha_scissor_threshold = 0.4
					m.cull_mode = BaseMaterial3D.CULL_DISABLED
					m.backlight_enabled = true
					m.backlight = Color(0.25, 0.35, 0.12)
					mmi.material_override = m # one material per part (split in build_island_assets.py)
			trees.append(mmi)
			mmi.visibility_range_end = 700.0
			mmi.visibility_range_end_margin = 120.0
			mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		add_child(mmi)
