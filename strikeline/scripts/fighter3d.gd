class_name Fighter3D
extends Node3D
## A lit 3D stickman built from primitive meshes and driven by the same 2D rig (Rig.solve),
## so every existing animation works unchanged. Styles: "ink" (dark glossy body, glowing
## accent outline) and "vinyl" (colored toy-like body with white joints).

const PX := 1.0 / 52.0
const ZF := 0.2   # depth offset of front limbs (toward the camera)

var data: Dictionary
var dims: Dictionary
var style := "ink"
var joints := PackedVector2Array()
var parts := {}
var mat_body: StandardMaterial3D
var mat_back: StandardMaterial3D
var mat_accent: StandardMaterial3D
var mat_joint: StandardMaterial3D
var mat_steel: StandardMaterial3D
var mat_glow: StandardMaterial3D
var scarf_pts: Array = []


func build(fighter_idx: int, p_style := "ink") -> void:
	data = Roster.fighter(fighter_idx)
	dims = data.dims.duplicate()
	dims.weapon = data.wlen
	style = p_style
	var acc: Color = data.accent
	var outline := StandardMaterial3D.new()
	outline.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	outline.cull_mode = BaseMaterial3D.CULL_FRONT
	outline.grow = true
	outline.grow_amount = 0.022 if style == "ink" else 0.016
	outline.albedo_color = (acc * 1.6) if style == "ink" else Color(0.03, 0.03, 0.05)

	mat_body = StandardMaterial3D.new()
	if style == "ink":
		mat_body.albedo_color = Color(0.05, 0.045, 0.06)
		mat_body.roughness = 0.28
		mat_body.metallic = 0.15
		mat_body.metallic_specular = 0.8
		mat_body.rim_enabled = true
		mat_body.rim = 0.9
		mat_body.rim_tint = 0.75
	else:
		mat_body.albedo_color = acc.darkened(0.05)
		mat_body.roughness = 0.32
		mat_body.metallic = 0.0
		mat_body.metallic_specular = 0.7
		mat_body.rim_enabled = true
		mat_body.rim = 0.5
		mat_body.rim_tint = 0.3
	mat_body.next_pass = outline
	mat_back = mat_body.duplicate()
	mat_back.albedo_color = mat_body.albedo_color.darkened(0.35)
	mat_back.next_pass = outline

	mat_accent = StandardMaterial3D.new()
	mat_accent.albedo_color = acc
	mat_accent.emission_enabled = true
	mat_accent.emission = acc
	mat_accent.emission_energy_multiplier = 1.6 if style == "ink" else 0.6
	mat_accent.roughness = 0.3

	mat_joint = StandardMaterial3D.new()
	if style == "ink":
		mat_joint.albedo_color = Color(0.09, 0.08, 0.1)
		mat_joint.roughness = 0.25
		mat_joint.metallic = 0.6
	else:
		mat_joint.albedo_color = Color(0.93, 0.93, 0.95)
		mat_joint.roughness = 0.25
	mat_joint.next_pass = outline

	mat_steel = StandardMaterial3D.new()
	mat_steel.albedo_color = Color(0.85, 0.88, 0.95)
	mat_steel.metallic = 1.0
	mat_steel.roughness = 0.12

	mat_glow = StandardMaterial3D.new()
	mat_glow.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat_glow.albedo_color = acc.lerp(Color(1, 1, 1), 0.5) * 2.2

	var s: float = dims.torso / 30.0
	var w: float = data.w / 6.5
	var r := 0.07 * w
	# limbs: tapered cylinders + joint spheres
	for side in ["f", "b"]:
		var m := mat_body if side == "f" else mat_back
		_limb("ua" + side, r * 1.05, r * 0.92, m)
		_limb("la" + side, r * 0.92, r * 0.8, m)
		_limb("th" + side, r * 1.35, r * 1.0, m)
		_limb("sh" + side, r * 1.0, r * 0.85, m)
		_ball("elbow" + side, r * 0.98, mat_joint)
		_ball("knee" + side, r * 1.1, mat_joint)
		_ball("hand" + side, r * (1.9 if data.weapon == "fists" else 1.25), mat_joint if data.weapon != "fists" else mat_accent)
		_boot("boot" + side, r, m)
		_ball("shoulder" + side, r * 1.15, mat_joint)
	# torso
	_ellipsoid("pelvis", Vector3(0.13, 0.11, 0.1) * w * s, mat_body)
	_ellipsoid("chest", Vector3(0.165, 0.23, 0.115) * w * s, mat_body)
	_limb("spine", r * 1.2, r * 1.3, mat_body)
	_limb("neck", r * 0.8, r * 0.8, mat_body)
	var belt := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 0.135 * w * s
	bm.bottom_radius = 0.135 * w * s
	bm.height = 0.05
	belt.mesh = bm
	belt.material_override = mat_accent
	add_child(belt)
	parts.belt = belt
	# head + visor + knot
	var hr: float = dims.head * PX * 0.95
	_ball("head", hr, mat_body)
	var visor := MeshInstance3D.new()
	var vm := CapsuleMesh.new()
	vm.radius = hr * 0.17
	vm.height = hr * 1.0
	visor.mesh = vm
	visor.material_override = mat_glow
	add_child(visor)
	parts.visor = visor
	_ball("knot", hr * 0.28, mat_accent)
	# scarf: a chain of flattened capsules
	for i in 7:
		var seg := MeshInstance3D.new()
		var sm := CapsuleMesh.new()
		sm.radius = lerpf(0.06, 0.025, i / 6.0)
		sm.height = 0.22
		seg.mesh = sm
		seg.material_override = mat_accent
		seg.scale = Vector3(1.0, 1.0, 0.35)
		add_child(seg)
		parts["scarf%d" % i] = seg
	# weapons
	match data.weapon:
		"sword":
			_box("blade", Vector3(0.075, 1.0, 0.02), mat_steel)
			_box("edge", Vector3(0.02, 1.0, 0.024), mat_glow)
			_box("guard", Vector3(0.2, 0.035, 0.06), mat_accent)
			_limb("hilt", 0.025, 0.025, mat_joint)
		"staff":
			_limb("shaft", 0.035, 0.035, mat_steel)
			_ball("orb", 0.09, mat_glow)
			var l := OmniLight3D.new()
			l.light_color = data.accent
			l.light_energy = 1.4
			l.omni_range = 1.6
			add_child(l)
			parts.orblight = l
		"knives":
			_box("knife_f", Vector3(0.06, 1.0, 0.015), mat_steel)
			_box("knife_b", Vector3(0.06, 1.0, 0.015), mat_steel)


func _limb(n: String, r0: float, r1: float, m: Material) -> void:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.bottom_radius = r0
	cm.top_radius = r1
	cm.height = 1.0
	cm.radial_segments = 16
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = m
	add_child(mi)
	parts[n] = mi


func _ball(n: String, r: float, m: Material) -> void:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = r
	sm.height = r * 2.0
	sm.radial_segments = 24
	sm.rings = 12
	mi.mesh = sm
	mi.material_override = m
	add_child(mi)
	parts[n] = mi


func _ellipsoid(n: String, size: Vector3, m: Material) -> void:
	_ball(n, 1.0, m)
	parts[n].set_meta("size", size)


func _box(n: String, size: Vector3, m: Material) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1, 1, 1)
	mi.mesh = bm
	mi.material_override = m
	mi.set_meta("size", size)
	add_child(mi)
	parts[n] = mi


func _boot(n: String, r: float, m: Material) -> void:
	var mi := MeshInstance3D.new()
	var cm := CapsuleMesh.new()
	cm.radius = r * 1.05
	cm.height = r * 4.2
	mi.mesh = cm
	mi.material_override = m
	add_child(mi)
	parts[n] = mi


static func _sb(b: Basis, s: Vector3) -> Basis:
	return Basis(b.x * s.x, b.y * s.y, b.z * s.z)


static func _basis_along(d: Vector3) -> Basis:
	var y := d.normalized()
	var x := y.cross(Vector3(0, 0, 1))
	if x.length() < 0.001:
		x = Vector3(1, 0, 0)
	x = x.normalized()
	var z := x.cross(y).normalized()
	return Basis(x, y, z)


func _place_seg(n: String, a: Vector3, b: Vector3, width_scale := Vector3.ONE) -> void:
	var mi: MeshInstance3D = parts[n]
	var d := b - a
	var l := maxf(d.length(), 0.001)
	var bs := _basis_along(d)
	mi.transform = Transform3D(_sb(bs, Vector3(width_scale.x, l, width_scale.z)), (a + b) * 0.5)


func _place_at(n: String, p: Vector3) -> void:
	var mi: MeshInstance3D = parts[n]
	mi.transform = Transform3D(Basis(), p)


func _place_box(n: String, a: Vector3, b: Vector3) -> void:
	var mi: MeshInstance3D = parts[n]
	var size: Vector3 = mi.get_meta("size")
	var d := b - a
	var bs := _basis_along(d)
	mi.transform = Transform3D(_sb(bs, Vector3(size.x, d.length() * size.y, size.z)), (a + b) * 0.5)


func _v(p: Vector2, z: float) -> Vector3:
	return Vector3(p.x * PX, -p.y * PX, z)


## Poses the model. `feet` is the 2D feet position (px), `pose` a Rig pose.
func apply(pose: PackedFloat32Array, facing: float, feet2d: Vector2, planted := true) -> void:
	Rig.solve(pose, dims, facing, joints)
	var root := Vector2(0, -Rig.body_bottom(joints, dims.head) - 1.5) if planted else Vector2(0, -(dims.th + dims.sh) * 1.05)
	var o := feet2d + root
	var J := func(i: int, z: float) -> Vector3: return _v(joints[i] + o, z)
	var zf := ZF
	var zb := -ZF
	# torso
	var hip: Vector3 = J.call(Rig.J_HIP, 0.0)
	var neck: Vector3 = J.call(Rig.J_NECK, 0.0)
	var chest := hip.lerp(neck, 0.62)
	_place_seg("spine", hip, chest)
	var up := (neck - hip).normalized()
	var tb := _basis_along(neck - hip)
	var ps: Vector3 = parts.pelvis.get_meta("size")
	parts.pelvis.transform = Transform3D(_sb(tb, ps), hip + up * 0.04)
	var cs: Vector3 = parts.chest.get_meta("size")
	parts.chest.transform = Transform3D(_sb(tb, cs), chest)
	parts.belt.transform = Transform3D(tb, hip + up * 0.12)
	var head: Vector3 = J.call(Rig.J_HEAD, 0.0)
	_place_seg("neck", neck - up * 0.05, head)
	_place_at("head", head)
	# visor on the facing side of the head
	var hv := (head - neck).normalized()
	var side := Vector3(hv.y, -hv.x, 0) * facing
	var hr: float = dims.head * PX * 0.95
	parts.visor.transform = Transform3D(_basis_along(side), head + side * hr * 0.42 + hv * hr * 0.1 + Vector3(0, 0, hr * 0.62))
	_place_at("knot", head - side * hr * 0.95 + hv * hr * 0.2 - Vector3(0, 0, hr * 0.3))
	# arms and legs
	for sd in ["f", "b"]:
		var z := zf if sd == "f" else zb
		var sh: Vector3 = J.call(Rig.J_SH, z * 0.6)
		var el: Vector3 = J.call(Rig.J_EF if sd == "f" else Rig.J_EB, z)
		var ha: Vector3 = J.call(Rig.J_HF if sd == "f" else Rig.J_HB, z)
		var kn: Vector3 = J.call(Rig.J_KF if sd == "f" else Rig.J_KB, z * 0.7)
		var ft: Vector3 = J.call(Rig.J_FF if sd == "f" else Rig.J_FB, z * 0.7)
		var hp: Vector3 = hip + Vector3(0, 0, z * 0.5)
		_place_at("shoulder" + sd, sh)
		_place_seg("ua" + sd, sh, el)
		_place_seg("la" + sd, el, ha)
		_place_at("elbow" + sd, el)
		_place_at("hand" + sd, ha)
		_place_seg("th" + sd, hp, kn)
		_place_seg("sh" + sd, kn, ft)
		_place_at("knee" + sd, kn)
		var shin := (ft - kn).normalized()
		var fwd := Vector3(shin.y, -shin.x, 0) * facing
		if fwd.dot(Vector3(facing, 0, 0)) < -0.2:
			fwd = -fwd
		var boot: MeshInstance3D = parts["boot" + sd]
		boot.transform = Transform3D(_basis_along(fwd), ft + fwd * 0.07)
	# weapon
	var hf: Vector3 = J.call(Rig.J_HF, zf + 0.04)
	var wt: Vector3 = J.call(Rig.J_WT, zf + 0.04)
	match data.weapon:
		"sword":
			var d := (wt - hf).normalized()
			_place_box("blade", hf + d * 0.08, wt)
			_place_box("edge", hf + d * 0.1, wt + d * 0.02)
			_place_box("guard", hf + d * 0.04 - Vector3(0, 0.0001, 0), hf + d * 0.075)
			parts.guard.transform = Transform3D(_sb(_basis_along(Vector3(-d.y, d.x, 0)), Vector3(0.035, 0.24, 0.06)), hf + d * 0.06)
			_place_seg("hilt", hf - d * 0.16, hf)
		"staff":
			var d := (wt - hf).normalized()
			var len := (wt - hf).length()
			_place_seg("shaft", hf - d * len * 0.45, wt)
			_place_at("orb", wt)
			parts.orblight.position = wt
		"knives":
			_place_box("knife_f", hf, wt)
			_place_box("knife_b", J.call(Rig.J_HB, zb - 0.04), J.call(Rig.J_WB, zb - 0.04))
	# scarf trailing behind the head
	var a := head - side * hr * 0.95 + hv * hr * 0.2 - Vector3(0, 0, hr * 0.3)
	var prev := a
	for i in 7:
		var u := float(i + 1)
		var p := a + Vector3(-facing * u * 0.17, -u * 0.045 + sin(u * 0.9) * 0.03, -0.05 * u * 0.2)
		var seg: MeshInstance3D = parts["scarf%d" % i]
		var bs := _basis_along(p - prev)
		seg.transform = Transform3D(_sb(bs, Vector3(1.0, 1.0, 0.35)), (p + prev) * 0.5)
		prev = p
