class_name Weapons
extends RefCounted
## Hand-held weapons for the 3D fighters, built from meshes and attached to hand bones.
## Grip: the blade leaves the fist along the hand bone's +X (thumb side), measured on the
## Meshy rigs; the armature is in centimetres so attachments undo its scale.

const GRIP_ROT := Vector3(0, 0, -90)


static func _mat(c: Color, rough: float, metal: float, emit := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	if emit > 0.0:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = emit
	return m


static func _mesh(parent: Node3D, mesh: Mesh, m: Material, pos := Vector3.ZERO, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	mi.position = pos
	mi.rotation_degrees = rot
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


static func _cyl(r0: float, r1: float, h: float, seg := 12) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = r1
	c.bottom_radius = r0
	c.height = h
	c.radial_segments = seg
	c.rings = 1
	return c


## A slightly curved, tapered blade along +Y from the guard, with a sharp tip.
static func _blade(length: float, width: float, thick: float, curve: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 10
	var spine: Array = []
	var edge: Array = []
	for i in n + 1:
		var u := float(i) / n
		var y := u * length
		var bend := curve * u * u
		var w := width * (1.0 - u * 0.25) if i < n else 0.0
		spine.append(Vector3(bend - w * 0.5, y, 0))
		edge.append(Vector3(bend + w * 0.5, y + (0.0 if i < n else 0.0), 0))
	for i in n:
		var a: Vector3 = spine[i]
		var b: Vector3 = spine[i + 1]
		var c: Vector3 = edge[i]
		var d: Vector3 = edge[i + 1]
		for side in [-1.0, 1.0]:
			var off := Vector3(0, 0, thick * 0.5 * side)
			var eoff := Vector3(0, 0, thick * 0.05 * side)
			st.set_normal(Vector3(0, 0, side))
			if side > 0:
				st.add_vertex(a + off); st.add_vertex(c + eoff); st.add_vertex(b + off)
				st.add_vertex(b + off); st.add_vertex(c + eoff); st.add_vertex(d + eoff)
			else:
				st.add_vertex(a + off); st.add_vertex(b + off); st.add_vertex(c + eoff)
				st.add_vertex(b + off); st.add_vertex(d + eoff); st.add_vertex(c + eoff)
		# back of the blade
		st.set_normal(Vector3(-1, 0, 0))
		st.add_vertex(a + Vector3(0, 0, thick * 0.5)); st.add_vertex(b + Vector3(0, 0, thick * 0.5)); st.add_vertex(a - Vector3(0, 0, thick * 0.5))
		st.add_vertex(b + Vector3(0, 0, thick * 0.5)); st.add_vertex(b - Vector3(0, 0, thick * 0.5)); st.add_vertex(a - Vector3(0, 0, thick * 0.5))
	st.generate_normals()
	return st.commit()


static func attach(model: Node3D, kind: String, accent: Color) -> void:
	if kind == "" or kind == "fists":
		return
	var sk := model.find_child("Skeleton3D", true, false) as Skeleton3D
	if sk == null:
		return
	var inv := Vector3.ONE / (sk.get_parent() as Node3D).scale
	var hands := ["RightHand", "LeftHand"] if kind == "knives" else ["RightHand"]
	for hn in hands:
		var ba := BoneAttachment3D.new()
		ba.bone_name = hn
		ba.name = "Weapon_" + hn
		sk.add_child(ba)
		var g := Node3D.new()
		g.name = "Grip"
		ba.add_child(g)
		g.scale = inv
		g.position = Vector3(0.0, 0.075, 0.015) * inv
		g.rotation_degrees = GRIP_ROT
		var steel := _mat(Color(0.86, 0.88, 0.94), 0.12, 1.0)
		var glow := _mat(accent, 0.3, 0.0, 3.5)
		var dark := _mat(Color(0.08, 0.06, 0.08), 0.5, 0.3)
		var gold := _mat(Color(0.95, 0.72, 0.3), 0.25, 1.0)
		var tip := Node3D.new()
		tip.name = "Tip"
		match kind:
			"sword":
				# katana: wrapped hilt below the fist, round guard, curved glowing-edged blade
				_mesh(g, _cyl(0.017, 0.016, 0.24), _mat(accent.darkened(0.5), 0.7, 0.0), Vector3(0, -0.06, 0))
				for k in 5:
					_mesh(g, _cyl(0.019, 0.019, 0.012, 8), dark, Vector3(0, -0.15 + k * 0.045, 0), Vector3(0, 45 * k, 0))
				_mesh(g, _cyl(0.022, 0.022, 0.03), gold, Vector3(0, -0.19, 0))
				_mesh(g, _cyl(0.055, 0.055, 0.012, 20), gold, Vector3(0, 0.075, 0))
				_mesh(g, _blade(0.86, 0.042, 0.008, 0.05), steel, Vector3(0, 0.08, 0))
				var edge := _mesh(g, _blade(0.84, 0.012, 0.011, 0.05), glow, Vector3(0.016, 0.085, 0))
				edge.position.x = 0.016
				tip.position = Vector3(0.05, 0.96, 0)
			"knives":
				# kunai held in a reverse grip
				var k := Node3D.new()
				g.add_child(k)
				k.rotation_degrees = Vector3(0, 0, 180)
				_mesh(k, _cyl(0.013, 0.013, 0.11), dark, Vector3(0, 0.0, 0))
				var ring := TorusMesh.new()
				ring.inner_radius = 0.018
				ring.outer_radius = 0.028
				_mesh(k, ring, steel, Vector3(0, -0.075, 0), Vector3(90, 0, 0))
				_mesh(k, _blade(0.24, 0.05, 0.01, 0.0), steel, Vector3(-0.025, 0.06, 0))
				_mesh(k, _blade(0.23, 0.012, 0.013, 0.0), glow, Vector3(0.0, 0.065, 0))
				tip.position = Vector3(0, 0.3, 0)
				k.add_child(tip)
			"staff":
				# storm staff: silver shaft with gold bands, crescent head and a glowing orb
				_mesh(g, _cyl(0.022, 0.026, 1.75, 10), _mat(Color(0.72, 0.75, 0.82), 0.25, 0.9), Vector3(0, 0.2, 0))
				for y in [-0.6, -0.2, 0.55, 0.95]:
					_mesh(g, _cyl(0.03, 0.03, 0.03, 10), gold, Vector3(0, y, 0))
				var cres := TorusMesh.new()
				cres.inner_radius = 0.09
				cres.outer_radius = 0.115
				_mesh(g, cres, gold, Vector3(0, 1.17, 0), Vector3(90, 0, 0))
				var orb := SphereMesh.new()
				orb.radius = 0.065
				orb.height = 0.13
				_mesh(g, orb, _mat(accent.lerp(Color(1, 1, 1), 0.3), 0.1, 0.0, 5.0), Vector3(0, 1.17, 0))
				var l := OmniLight3D.new()
				l.light_color = accent
				l.light_energy = 1.4
				l.omni_range = 1.4
				l.position = Vector3(0, 1.17, 0)
				g.add_child(l)
				tip.position = Vector3(0, 1.17, 0)
		if tip.get_parent() == null:
			g.add_child(tip)


## World position of the weapon tip in `hand`, or INF if that hand holds nothing.
static func tip(model: Node3D, hand: String) -> Vector3:
	var n := model.find_child("Weapon_" + hand, true, false)
	if n == null:
		return Vector3.INF
	var t := n.find_child("Tip", true, false) as Node3D
	return t.global_position if t != null else Vector3.INF
