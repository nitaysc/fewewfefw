extends Node3D
## A tropical island: a procedural heightmap (volcanic peak, jungle, beaches, a reef
## shelf), coconut palms along the shore, and a height lookup that the ship (running
## aground), the shot (hitting land) and the ocean shader (shallows, surf) all share.

const RES := 192 ## heightmap samples per side
const SIZE := 1200.0 ## metres covered by the heightmap
const PEAK := 170.0

var heights := PackedFloat32Array()
var height_tex: ImageTexture
var _noise: NoiseTexture2D
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
	_build_palms()
	_build_canopy()


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
	_noise = noise
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


## Coconut palms: a curved trunk and a crown of drooping fronds, scattered thickly
## just above the beach and more sparsely inland.
func _build_palms() -> void:
	var mesh := _palm_mesh()
	var spots := []
	var rng := RandomNumberGenerator.new()
	rng.seed = 5
	var cell := SIZE / (RES - 1)
	for tries in 30000:
		var i := rng.randi_range(1, RES - 2)
		var j := rng.randi_range(1, RES - 2)
		var h := heights[j * RES + i]
		if h < 2.2 or h > 120.0:
			continue
		var slope := absf(heights[j * RES + i + 1] - heights[j * RES + i - 1]) / (2.0 * cell) \
				+ absf(heights[(j + 1) * RES + i] - heights[(j - 1) * RES + i]) / (2.0 * cell)
		if slope > 0.7:
			continue
		var keep := 1.0 if h < 9.0 else 0.45
		if rng.randf() > keep:
			continue
		var p := _local(i, j) + Vector3(rng.randf_range(-0.5, 0.5) * cell, 0.0, rng.randf_range(-0.5, 0.5) * cell)
		p.y = height(p.x + position.x, p.z + position.z) - 0.3
		spots.append(p)
		if spots.size() >= 1800:
			break
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = spots.size()
	for k in spots.size():
		var s := rng.randf_range(0.75, 1.25)
		var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.85, 1.15), s))
		mm.set_instance_transform(k, Transform3D(b, spots[k]))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)


## Jungle canopy: thousands of rounded tree crowns packed over the hills, so the
## island reads as rain forest rather than lawn. Each crown is a squashed, lumpy sphere.
func _build_canopy() -> void:
	var sphere := SphereMesh.new()
	sphere.radial_segments = 9
	sphere.rings = 5
	sphere.radius = 1.0
	sphere.height = 1.4
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/canopy.gdshader")
	m.set_shader_parameter("noise_tex", _noise)
	sphere.material = m
	var rng := RandomNumberGenerator.new()
	rng.seed = 21
	var cell := SIZE / (RES - 1)
	var xf := []
	var cols := []
	for tries in 40000:
		var x := rng.randf_range(-0.5, 0.5) * SIZE
		var z := rng.randf_range(-0.5, 0.5) * SIZE
		var h := height(x + position.x, z + position.z)
		if h < 5.0 or h > 150.0:
			continue
		var sl := absf(height(x + position.x + cell, z + position.z) - height(x + position.x - cell, z + position.z)) / (2.0 * cell)
		if sl > 1.1 or rng.randf() < smoothstep(90.0, 150.0, h):
			continue
		var r := rng.randf_range(3.5, 7.0)
		var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(r, r * rng.randf_range(0.55, 0.8), r * rng.randf_range(0.8, 1.2)))
		xf.append(Transform3D(b, Vector3(x, h + r * 0.35, z)))
		var g := rng.randf()
		cols.append(Color(0.035 + 0.04 * g, 0.075 + 0.06 * g, 0.02 + 0.015 * g).lerp(Color(0.12, 0.11, 0.04), rng.randf() * 0.3))
		if xf.size() >= 4200:
			break
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = sphere
	mm.instance_count = xf.size()
	for k in xf.size():
		mm.set_instance_transform(k, xf[k])
		mm.set_instance_color(k, cols[k])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)


func _palm_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var trunk := Color(0.36, 0.29, 0.2)
	var frond := Color(0.1, 0.2, 0.05)
	var hgt := 13.0
	var lean := 2.2
	var seg := 8
	var sides := 6
	var spine := []
	for k in seg + 1:
		var t := float(k) / seg
		spine.append(Vector3(lean * t * t, hgt * t, 0.0))
	for k in seg:
		var r0 := lerpf(0.32, 0.17, float(k) / seg)
		var r1 := lerpf(0.32, 0.17, float(k + 1) / seg)
		for s in sides:
			var a0 := TAU * s / sides
			var a1 := TAU * (s + 1) / sides
			var p00: Vector3 = spine[k] + Vector3(cos(a0), 0, sin(a0)) * r0
			var p01: Vector3 = spine[k] + Vector3(cos(a1), 0, sin(a1)) * r0
			var p10: Vector3 = spine[k + 1] + Vector3(cos(a0), 0, sin(a0)) * r1
			var p11: Vector3 = spine[k + 1] + Vector3(cos(a1), 0, sin(a1)) * r1
			var shade := 0.8 + 0.2 * float(k % 2) # the ringed bark
			for v in [[p00, a0], [p10, a0], [p11, a1], [p00, a0], [p11, a1], [p01, a1]]:
				st.set_color(trunk * shade)
				st.set_normal(Vector3(cos(v[1]), 0.1, sin(v[1])))
				st.add_vertex(v[0])
	var top: Vector3 = spine[seg]
	var fronds := 11
	for f in fronds:
		var ang := TAU * f / fronds + 0.3 * sin(f * 3.7)
		var dir := Vector3(cos(ang), 0.0, sin(ang))
		var side := Vector3(-dir.z, 0.0, dir.x)
		var length := 5.5 + 1.2 * sin(f * 1.9)
		var rise := 0.35 + 0.25 * sin(f * 2.3)
		var pts := []
		for k in 7:
			var t := float(k) / 6.0
			pts.append(top + dir * length * t + Vector3.UP * (rise * 3.0 * t - 4.2 * t * t))
		for k in 6:
			var w0 := 0.9 * sin(PI * minf(1.0, (float(k) / 6.0) * 1.15 + 0.05))
			var w1 := 0.9 * sin(PI * minf(1.0, (float(k + 1) / 6.0) * 1.15 + 0.05))
			var a: Vector3 = pts[k]
			var b: Vector3 = pts[k + 1]
			var n := (b - a).cross(side).normalized()
			if n.y < 0.0:
				n = -n
			var droop0 := Vector3.DOWN * w0 * 0.35
			var droop1 := Vector3.DOWN * w1 * 0.35
			var c := frond * (0.85 + 0.3 * float(k) / 6.0)
			for v in [a, a + side * w0 + droop0, b + side * w1 + droop1, a, b + side * w1 + droop1, b,
					a, b, b - side * w1 + droop1, a, b - side * w1 + droop1, a - side * w0 + droop0]:
				st.set_color(c)
				st.set_normal(n)
				st.add_vertex(v)
	var mesh := st.commit()
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.roughness = 0.8
	m.backlight_enabled = true
	m.backlight = Color(0.25, 0.35, 0.1)
	mesh.surface_set_material(0, m)
	return mesh
