extends MeshInstance3D
## The sea mesh: a radial grid, dense near the camera and coarse toward the
## horizon, re-centred under the camera every frame. Waves come from Waves.

const SHADER_PATH := "res://shaders/ocean.gdshader"

var mat: ShaderMaterial


func setup(rings: int, segments: int, wake_tex: Texture2D) -> void:
	mesh = _radial_grid(rings, segments)
	extra_cull_margin = 16384.0
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mat = ShaderMaterial.new()
	mat.shader = load(SHADER_PATH)
	mat.set_shader_parameter("map_scales", PackedVector4Array())
	mat.set_shader_parameter("detail_tex", load("res://assets/ocean/detail_normal.png"))
	mat.set_shader_parameter("foam_tex", load("res://assets/ocean/foam.png"))
	mat.set_shader_parameter("wake_tex", wake_tex)
	material_override = mat


func follow(cam_pos: Vector3, wake_center: Vector2, sun_dir: Vector3) -> void:
	mat.set_shader_parameter("center", Vector2(cam_pos.x, cam_pos.z))
	mat.set_shader_parameter("sea_time", Waves.time)
	mat.set_shader_parameter("wake_center", wake_center)
	mat.set_shader_parameter("sun_dir", sun_dir)


func _radial_grid(rings: int, segments: int) -> ArrayMesh:
	var a := 12.1
	var b := 0.033 * 200.0 / rings
	var verts := PackedVector3Array()
	verts.append(Vector3.ZERO)
	for r in range(1, rings + 1):
		var rad := a * (exp(b * r) - 1.0)
		for s in segments:
			var t := TAU * s / segments
			verts.append(Vector3(cos(t) * rad, 0.0, sin(t) * rad))
	var idx := PackedInt32Array()
	for s in segments:
		idx.append_array([0, 1 + s, 1 + (s + 1) % segments])
	for r in range(1, rings):
		var o := 1 + (r - 1) * segments
		var n := o + segments
		for s in segments:
			var s1 := (s + 1) % segments
			idx.append_array([o + s, n + s, o + s1, o + s1, n + s, n + s1])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	var normals := PackedVector3Array()
	normals.resize(verts.size())
	normals.fill(Vector3.UP)
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return m
