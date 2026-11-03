class_name FpArms
extends Node3D
## The first-person arms: a rigged CC0 arm model ("FPS arms rigged" by para on
## OpenGameArt). Each frame the hands are placed on targets (grip, handguard,
## magazine, bolt) and the elbows are solved with two-bone IK; fingers curl
## around whatever the hand holds.

const SIDES := {
	"R": {"upper": "upper_arm.L", "fore": "forearm.L", "end": "forearm.L_end", "hand": "hand.L.control", "tag": "L", "curl": 1.0},
	"L": {"upper": "upper_arm.R", "fore": "forearm.R", "end": "forearm.R_end", "hand": "hand.R.control", "tag": "R", "curl": -1.0},
}
const FINGERS := ["index", "middle", "ring", "pinky"]

var skel: Skeleton3D
var _b := {}          # side -> bone indices and rest data

func setup() -> void:
	var scene: Node3D = load("res://assets/models/arms.fbx").instantiate()
	add_child(scene)
	skel = scene.find_children("*", "Skeleton3D", true, false)[0]
	for mi in scene.find_children("*", "MeshInstance3D", true, false):
		mi.material_override = Mats.vm_arms()
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.extra_cull_margin = 2.0
	for side in SIDES:
		var s: Dictionary = SIDES[side]
		var d := {}
		for k in ["upper", "fore", "end", "hand"]:
			d[k] = skel.find_bone(s[k])
		d["l1"] = skel.get_bone_global_rest(d.upper).origin.distance_to(skel.get_bone_global_rest(d.fore).origin)
		d["l2"] = skel.get_bone_global_rest(d.fore).origin.distance_to(skel.get_bone_global_rest(d.end).origin)
		var fingers := {}
		for f in FINGERS:
			fingers[f] = [skel.find_bone("f_%s.01.%s" % [f, s.tag]), skel.find_bone("f_%s.02.%s" % [f, s.tag]), skel.find_bone("f_%s.03.%s" % [f, s.tag])]
		fingers["thumb"] = [skel.find_bone("thumb.01.%s" % s.tag), skel.find_bone("thumb.02.%s" % s.tag), skel.find_bone("thumb.03.%s" % s.tag)]
		d["fingers"] = fingers
		# the hand's rest frame: x = towards the index finger, z = towards the knuckles
		var wrist := skel.get_bone_global_rest(d.hand).origin
		var mid := skel.get_bone_global_rest(skel.find_bone("f_middle.01.%s" % s.tag)).origin
		var idx := skel.get_bone_global_rest(skel.find_bone("f_index.01.%s" % s.tag)).origin
		var pin := skel.get_bone_global_rest(skel.find_bone("f_pinky.01.%s" % s.tag)).origin
		d["rest_frame"] = _frame(mid - wrist, idx - pin)
		_b[side] = d

## wrist: target transform (in this node's parent space) for the wrist; its
## basis rotates the hand relative to its rest pose. pole: elbow hint direction.
func solve(side: String, wrist_pos: Vector3, knuckles: Vector3, index_side: Vector3, pole: Vector3, curl: Dictionary) -> void:
	var d: Dictionary = _b[side]
	var to_skel := (skel.global_transform.affine_inverse() * get_parent_node_3d().global_transform)
	var target := to_skel * wrist_pos
	var shoulder := skel.get_bone_global_pose(d.upper).origin
	var l1: float = d.l1
	var l2: float = d.l2
	var to_t := target - shoulder
	var dist := clampf(to_t.length(), 0.05, (l1 + l2) * 0.999)
	var dir := to_t.normalized()
	target = shoulder + dir * dist
	# elbow position from the law of cosines, bent towards the pole
	var a := (l1 * l1 - l2 * l2 + dist * dist) / (2.0 * dist)
	var h := sqrt(maxf(l1 * l1 - a * a, 0.0))
	var pole_s := (to_skel.basis * pole).normalized()
	var bend := (pole_s - dir * pole_s.dot(dir)).normalized()
	var elbow := shoulder + dir * a + bend * h
	_aim_bone(d.upper, shoulder, elbow, d.fore)
	_aim_bone(d.fore, elbow, target, d.end)
	var want := _frame(to_skel.basis * knuckles, to_skel.basis * index_side)
	var rest_frame: Basis = d.rest_frame
	var hb := want * rest_frame.inverse() * skel.get_bone_global_rest(d.hand).basis
	skel.set_bone_global_pose(d.hand, Transform3D(hb, target))
	# fingers: each joint rotates about its own X axis
	for f in d.fingers:
		var amount: float = curl.get(f, curl.get("all", 0.0))
		var joints: Array = d.fingers[f]
		var k := [1.0, 1.1, 0.8] if f != "thumb" else [0.4, 0.6, 0.5]
		for j in 3:
			var bi: int = joints[j]
			if bi < 0:
				continue
			var rest := skel.get_bone_rest(bi).basis.get_rotation_quaternion()
			skel.set_bone_pose_rotation(bi, rest * Quaternion(Vector3.RIGHT, deg_to_rad(amount * k[j] * float(SIDES[side].curl))))

func _aim_bone(bone: int, from: Vector3, to: Vector3, child: int) -> void:
	var rest := skel.get_bone_global_rest(bone)
	var rest_dir := (skel.get_bone_global_rest(child).origin - rest.origin).normalized()
	var new_dir := (to - from).normalized()
	var q := Quaternion(rest_dir, new_dir)
	skel.set_bone_global_pose(bone, Transform3D(Basis(q) * rest.basis, from))

static func _frame(fwd: Vector3, side: Vector3) -> Basis:
	var z := fwd.normalized()
	var x := (side - z * side.dot(z)).normalized()
	var y := z.cross(x)
	return Basis(x, y, z)
