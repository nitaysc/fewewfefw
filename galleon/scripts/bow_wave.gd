extends MeshInstance3D
## The bow wave sheets on both sides of the stem (shape is made in bow_wave.gdshader).
## The mesh lies flat in ship space; the shader lifts it onto the live sea surface.

var mat: ShaderMaterial


func build(ship_script) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var na := 40
	var nb := 10
	for side in [1.0, -1.0]:
		var base := []
		for i in na + 1:
			var a := float(i) / na
			var u := 1.0 - a * 0.42 # from the stem back to about 40 % of the hull
			var hw: float = ship_script.half_width(u, 0.3)
			var z: float = ship_script.z_at(u) - 0.3
			# the sheet flares out further as it runs aft
			var spread := 0.6 + 3.2 * pow(a, 0.7)
			var row := []
			for j in nb + 1:
				var b := float(j) / nb
				row.append([Vector3(side * (hw + 0.05 + spread * b), 0.0, z - b * spread * 0.35), Vector2(a, b)])
			base.append(row)
		for i in na:
			for j in nb:
				var q := [base[i][j], base[i + 1][j], base[i + 1][j + 1], base[i][j + 1]]
				for k in [0, 1, 2, 0, 2, 3]:
					st.set_uv(q[k][1])
					st.add_vertex(q[k][0])
	mesh = st.commit()
	extra_cull_margin = 8.0
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mat = ShaderMaterial.new()
	mat.shader = load("res://shaders/bow_wave.gdshader")
	mat.set_shader_parameter("foam_tex", load("res://assets/ocean/foam.png"))
	material_override = mat


func update(speed: float, surge: float, map_scales: PackedVector4Array) -> void:
	mat.set_shader_parameter("sea_time", Waves.time)
	mat.set_shader_parameter("speed", speed)
	mat.set_shader_parameter("surge", surge)
	mat.set_shader_parameter("map_scales", map_scales)
