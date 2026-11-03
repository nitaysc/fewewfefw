class_name BlockModel
extends Node3D
## A blocky, voxel-style fighter built entirely from boxes (no imported model or clips).
## Every frame it is posed straight from the 2D gameplay skeleton (Rig joints), so the
## model always lines up exactly with the hitboxes. Used by fighters with "voxel": true.

const PXU := 48.0

## Colour scheme of the builder (original design: hard hat, ginger beard, green shirt,
## brown overalls, crystal pickaxe).
const SKIN := Color(0.93, 0.72, 0.55)
const HAIR := Color(0.78, 0.36, 0.12)
const SHIRT := Color(0.28, 0.62, 0.3)
const PANTS := Color(0.45, 0.3, 0.18)
const BOOT := Color(0.22, 0.2, 0.2)
const HAT := Color(1.0, 0.78, 0.12)
const WOOD := Color(0.55, 0.38, 0.2)

var meshes: Array = []
var parts := {}          # name -> MeshInstance3D
var cart: Node3D         # minecart shown during the side special
var pick_head: MeshInstance3D
var accent := Color(0.4, 1.0, 0.5)
var _tex_cache := {}
var _j := PackedVector2Array()

# body sizes in game pixels: [thickness (along facing), depth (towards camera)]
const LIMB := 9.0
const ARM_Z := 15.0
const LEG_Z := 5.5


func build(d: Dictionary) -> void:
	accent = d.get("accent", accent)
	var crystal: Color = accent
	_part("leg_u_b", PANTS.darkened(0.15), Vector3(10.5, 1, 10.5))
	_part("leg_l_b", PANTS.darkened(0.25), Vector3(10.0, 1, 10.0))
	_part("boot_b", BOOT.darkened(0.2), Vector3(14, 6, 11))
	_part("arm_u_b", SHIRT.darkened(0.2), Vector3(LIMB, 1, LIMB))
	_part("arm_l_b", SKIN.darkened(0.15), Vector3(LIMB - 0.6, 1, LIMB - 0.6))
	_part("torso", SHIRT, Vector3(12, 1, 22))
	_part("bib", PANTS, Vector3(12.8, 1, 22.8))
	_part("belt", Color(0.18, 0.13, 0.1), Vector3(13.4, 3, 23.4))
	_part("leg_u_f", PANTS, Vector3(10.5, 1, 10.5))
	_part("leg_l_f", PANTS.darkened(0.08), Vector3(10.0, 1, 10.0))
	_part("boot_f", BOOT, Vector3(14, 6, 11))
	_part("head", SKIN, Vector3(23, 23, 23))
	_part("hair", HAIR, Vector3(24, 7, 24))
	_part("hair_back", HAIR, Vector3(5, 18, 24))
	_part("beard", HAIR.darkened(0.1), Vector3(2, 8, 20))
	_part("eye_l", Color(1, 1, 1), Vector3(1.2, 3.2, 4.4), false)
	_part("eye_r", Color(1, 1, 1), Vector3(1.2, 3.2, 4.4), false)
	_part("pupil_l", Color(0.15, 0.3, 0.7), Vector3(1.6, 3.2, 2.2), false)
	_part("pupil_r", Color(0.15, 0.3, 0.7), Vector3(1.6, 3.2, 2.2), false)
	_part("nose", SKIN.darkened(0.12), Vector3(2.4, 3.5, 4), false)
	_part("hat", HAT, Vector3(25, 6, 25))
	_part("brim", HAT.darkened(0.12), Vector3(31, 2, 26))
	_part("lamp", Color(1, 1, 0.85), Vector3(2.5, 4, 5), false, true)
	_part("handle", WOOD, Vector3(3.2, 1, 3.2))
	_part("pick", crystal, Vector3(4.5, 30, 4.5), true, true)
	_part("pick_core", WOOD.darkened(0.2), Vector3(5.5, 6, 5.5))
	_part("arm_u_f", SHIRT, Vector3(LIMB, 1, LIMB))
	_part("arm_l_f", SKIN, Vector3(LIMB - 0.6, 1, LIMB - 0.6))
	pick_head = parts.pick
	_build_cart()


func _build_cart() -> void:
	cart = Node3D.new()
	add_child(cart)
	var body := _box(Color(0.42, 0.44, 0.48), Vector3(46, 18, 30) / PXU)
	body.position = Vector3(0, 15, 0) / PXU
	cart.add_child(body)
	var rim := _box(Color(0.3, 0.31, 0.34), Vector3(50, 4, 34) / PXU)
	rim.position = Vector3(0, 25, 0) / PXU
	cart.add_child(rim)
	for x in [-14.0, 14.0]:
		for z in [-16.0, 16.0]:
			var w := _box(Color(0.15, 0.15, 0.17), Vector3(10, 10, 3) / PXU)
			w.position = Vector3(x, 5, z) / PXU
			cart.add_child(w)
	cart.visible = false


## Pixel-art texture: a flat colour with per-texel brightness noise, nearest filtered.
func _tex(c: Color) -> Texture2D:
	var key := c.to_html()
	if _tex_cache.has(key):
		return _tex_cache[key]
	var img := Image.create(8, 8, false, Image.FORMAT_RGBA8)
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(key)
	for y in 8:
		for x in 8:
			var k := rng.randf_range(-0.09, 0.09)
			img.set_pixel(x, y, Color(clampf(c.r + k, 0, 1), clampf(c.g + k, 0, 1), clampf(c.b + k, 0, 1)))
	var t := ImageTexture.create_from_image(img)
	_tex_cache[key] = t
	return t


func _box(c: Color, size: Vector3, textured := true, glow := false) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	var m := StandardMaterial3D.new()
	m.roughness = 0.85
	if textured:
		m.albedo_texture = _tex(c)
		m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	else:
		m.albedo_color = c
	if glow:
		m.emission_enabled = true
		m.emission = c
		m.emission_energy_multiplier = 0.6
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	meshes.append(mi)
	return mi


## Parts are unit-length along Y; limbs get their length set per frame through scale.y.
func _part(n: String, c: Color, size_px: Vector3, textured := true, glow := false) -> void:
	var mi := _box(c, size_px / PXU, textured, glow)
	add_child(mi)
	parts[n] = mi


## Poses a box so it spans from a to b (local metres, model faces +X), at depth z.
func _span(n: String, a: Vector2, b: Vector2, z: float, extra := 0.0) -> Transform3D:
	var mi: MeshInstance3D = parts[n]
	var v := b - a
	var L := maxf(v.length(), 0.001)
	var ang := atan2(v.x, -v.y)          # box points down (-Y) at angle 0
	var basis := Basis(Vector3.BACK, ang)
	var bm: BoxMesh = mi.mesh
	var sz := bm.size
	var len_m := L + extra
	var scl := len_m / sz.y if sz.y > 0.0 else 1.0
	var mid := (a + b) * 0.5
	var tr := Transform3D(basis.scaled_local(Vector3(1, scl, 1)), Vector3(mid.x, mid.y, z))
	mi.transform = tr
	return Transform3D(basis, Vector3(mid.x, mid.y, z))


## Places a fixed-size part relative to a frame (offset in that frame's local pixels).
func _attach(n: String, frame: Transform3D, off_px: Vector3, rot := 0.0) -> void:
	var mi: MeshInstance3D = parts[n]
	var b := frame.basis
	if rot != 0.0:
		b = b * Basis(Vector3.BACK, rot)
	mi.transform = Transform3D(b, frame * (off_px / PXU))


## Converts a Rig joint (game px, y down, mirrored by facing) into model space.
func _p(j: int, root: Vector2, facing: float) -> Vector2:
	var q: Vector2 = root + _j[j]
	return Vector2(q.x * facing, -q.y) / PXU


## Pose the model from solved joints (relative to the feet), the fighter's facing and
## root offset. Also sets the facing basis (turned a little towards the camera).
func apply(joints: PackedVector2Array, root: Vector2, facing: float, turn_deg := 28.0, show_cart := false) -> void:
	_j = joints
	var hip := _p(Rig.J_HIP, root, facing)
	var neck := _p(Rig.J_NECK, root, facing)
	var head := _p(Rig.J_HEAD, root, facing)
	var sh := _p(Rig.J_SH, root, facing)
	var ef := _p(Rig.J_EF, root, facing)
	var hf := _p(Rig.J_HF, root, facing)
	var eb := _p(Rig.J_EB, root, facing)
	var hb := _p(Rig.J_HB, root, facing)
	var kf := _p(Rig.J_KF, root, facing)
	var ff := _p(Rig.J_FF, root, facing)
	var kb := _p(Rig.J_KB, root, facing)
	var fb := _p(Rig.J_FB, root, facing)
	var wt := _p(Rig.J_WT, root, facing)
	var az := ARM_Z / PXU
	var lz := LEG_Z / PXU
	# torso, slightly overlapping the hips and neck so there are no gaps
	var tf := _span("torso", hip, neck, 0.0, 4.0 / PXU)
	_attach("bib", tf, Vector3(0.0, -6.0, 0.0))
	(parts.bib as MeshInstance3D).scale = Vector3(1, 14.0, 1)
	_attach("belt", tf, Vector3(0.0, -12.5, 0.0))
	# legs (back first), boots follow the shins
	_span("leg_u_b", hip, kb, -lz, 3.0 / PXU)
	var sb := _span("leg_l_b", kb, fb, -lz, 2.0 / PXU)
	_attach("boot_b", sb, Vector3(2.5, -(fb - kb).length() * PXU * 0.5 + 1.0, 0.0), -_ang(kb, fb))
	_span("leg_u_f", hip, kf, lz, 3.0 / PXU)
	var sf := _span("leg_l_f", kf, ff, lz, 2.0 / PXU)
	_attach("boot_f", sf, Vector3(2.5, -(ff - kf).length() * PXU * 0.5 + 1.0, 0.0), -_ang(kf, ff))
	# arms
	_span("arm_u_b", sh, eb, -az, 4.0 / PXU)
	_span("arm_l_b", eb, hb, -az, 3.0 / PXU)
	_span("arm_u_f", sh, ef, az, 4.0 / PXU)
	_span("arm_l_f", ef, hf, az, 3.0 / PXU)
	# head: a cube centred on the head joint, tilted with the neck
	var hang := atan2(head.x - neck.x, head.y - neck.y)   # 0 = straight up
	var hb3 := Basis(Vector3.BACK, -hang)
	var hframe := Transform3D(hb3, Vector3(head.x, head.y, 0.0))
	(parts.head as MeshInstance3D).transform = hframe
	_attach("hair", hframe, Vector3(-0.5, 9.5, 0))
	_attach("hair_back", hframe, Vector3(-10.0, 1.5, 0))
	_attach("beard", hframe, Vector3(11.6, -7.0, 0))
	_attach("nose", hframe, Vector3(12.2, -1.5, 0))
	_attach("eye_l", hframe, Vector3(11.7, 2.5, 5.5))
	_attach("eye_r", hframe, Vector3(11.7, 2.5, -5.5))
	_attach("pupil_l", hframe, Vector3(11.9, 2.5, 6.6))
	_attach("pupil_r", hframe, Vector3(11.9, 2.5, -4.4))
	_attach("hat", hframe, Vector3(0, 13.5, 0))
	_attach("brim", hframe, Vector3(3.0, 11.0, 0))
	_attach("lamp", hframe, Vector3(13.0, 14.0, 0))
	# pickaxe: handle from the front hand to the weapon tip, crystal head across the tip
	var hz := az + 0.5 / PXU
	var wf := _span("handle", hf, wt, hz, 6.0 / PXU)
	var wlen := (wt - hf).length() * PXU
	_attach("pick", wf, Vector3(0, -wlen * 0.5 - 1.0, 0), PI * 0.5)
	_attach("pick_core", wf, Vector3(0, -wlen * 0.5 - 1.0, 0))
	cart.visible = show_cart
	if show_cart:
		cart.position = Vector3(0, -4.0 / PXU, 0)
	# facing: mirror for left, turned towards the camera
	var yaw := deg_to_rad(-turn_deg)
	var b := Basis(Vector3.UP, yaw)
	if facing < 0.0:
		b = Basis.from_scale(Vector3(-1, 1, 1)) * b
	transform.basis = b


func _ang(a: Vector2, b: Vector2) -> float:
	var v := b - a
	return atan2(v.x, -v.y)


## Head position in model space (for portrait head shots).
func head_local() -> Vector3:
	return (parts.head as MeshInstance3D).position


## Poses from a Rig pose array, standing on the ground (menus and portraits).
func apply_pose(p: PackedFloat32Array, d: Dictionary, turn_deg := 28.0) -> void:
	var dims: Dictionary = d.dims.duplicate()
	dims.weapon = d.wlen
	var j := PackedVector2Array()
	Rig.solve(p, dims, 1.0, j)
	var root := Vector2(0, -Rig.foot_bottom(j) - 1.5)
	apply(j, root, 1.0, turn_deg)
