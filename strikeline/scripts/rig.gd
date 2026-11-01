class_name Rig
extends RefCounted
## The stickman skeleton: a pose is a list of joint angles, solved with forward
## kinematics into joint positions and drawn as outlined ink strokes.
##
## Angle convention (facing right, y down): dir(a) = (sin a, cos a), so
## 0 = straight down, PI/2 = forward, PI = straight up, -PI/2 = backward.
## The torso uses its own lean: 0 = upright, positive = leaning forward.

enum { LEAN, HEAD, SF, EF, SB, EB, HF, KF, HB, KB, HY, ROT, WA }
const NP := 13

enum { J_HIP, J_NECK, J_HEAD, J_SH, J_EF, J_HF, J_EB, J_HB, J_KF, J_FF, J_KB, J_FB, J_WM, J_WT, J_WB, J_CORE }
const NJ := 16

const JOINT_NAMES := {
	"hip": J_HIP, "neck": J_NECK, "head": J_HEAD, "hf": J_HF, "hb": J_HB,
	"ef": J_EF, "eb": J_EB, "kf": J_KF, "ff": J_FF, "kb": J_KB, "fb": J_FB,
	"wm": J_WM, "wt": J_WT, "wb": J_WB, "core": J_CORE,
}


static func P(a: Array) -> PackedFloat32Array:
	var p := PackedFloat32Array()
	p.resize(NP)
	for i in range(mini(a.size(), NP)):
		p[i] = float(a[i])
	return p


static func blend(a: PackedFloat32Array, b: PackedFloat32Array, t: float) -> PackedFloat32Array:
	var p := PackedFloat32Array()
	p.resize(NP)
	for i in NP:
		p[i] = lerpf(a[i], b[i], t)
	return p


## Moves `cur` toward `target` by factor k; rotation takes the short way round.
static func approach(cur: PackedFloat32Array, target: PackedFloat32Array, k: float) -> void:
	for i in NP:
		if i == ROT:
			cur[i] += wrapf(target[i] - cur[i], -PI, PI) * k
		else:
			cur[i] = lerpf(cur[i], target[i], k)


static func dir(a: float) -> Vector2:
	return Vector2(sin(a), cos(a))


## Solves joints relative to the hip. `d` holds the body dimensions.
static func solve(p: PackedFloat32Array, d: Dictionary, facing: float, out: PackedVector2Array) -> void:
	if out.size() != NJ:
		out.resize(NJ)
	var lean := p[LEAN]
	var up := Vector2(sin(lean), -cos(lean))
	var hip := Vector2.ZERO
	var neck: Vector2 = hip + up * d.torso
	var hd := lean + p[HEAD]
	var head: Vector2 = neck + Vector2(sin(hd), -cos(hd)) * (d.head + 1.5)
	var sh: Vector2 = neck - up * 3.0
	var ef: Vector2 = sh + dir(p[SF]) * d.ua
	var hf: Vector2 = ef + dir(p[SF] + p[EF]) * d.la
	var eb: Vector2 = sh + dir(p[SB]) * d.ua
	var hb: Vector2 = eb + dir(p[SB] + p[EB]) * d.la
	var kf: Vector2 = hip + dir(p[HF]) * d.th
	var ff: Vector2 = kf + dir(p[HF] - p[KF]) * d.sh
	var kb: Vector2 = hip + dir(p[HB]) * d.th
	var fb: Vector2 = kb + dir(p[HB] - p[KB]) * d.sh
	var wd := dir(p[SF] + p[EF] + p[WA])
	var wl: float = d.weapon
	var wm: Vector2 = hf + wd * wl * 0.55
	var wt: Vector2 = hf + wd * wl
	var wb: Vector2 = hb + dir(p[SB] + p[EB] + p[WA]) * wl
	var core: Vector2 = hip + up * d.torso * 0.45
	out[J_HIP] = hip
	out[J_NECK] = neck
	out[J_HEAD] = head
	out[J_SH] = sh
	out[J_EF] = ef
	out[J_HF] = hf
	out[J_EB] = eb
	out[J_HB] = hb
	out[J_KF] = kf
	out[J_FF] = ff
	out[J_KB] = kb
	out[J_FB] = fb
	out[J_WM] = wm
	out[J_WT] = wt
	out[J_WB] = wb
	out[J_CORE] = core
	var rot := p[ROT]
	if absf(rot) > 0.0001:
		for i in NJ:
			out[i] = core + (out[i] - core).rotated(rot)
	if facing < 0.0:
		for i in NJ:
			out[i].x = -out[i].x


## Lowest point of the feet, used to plant grounded poses on the floor.
static func foot_bottom(j: PackedVector2Array) -> float:
	return maxf(maxf(j[J_FF].y, j[J_FB].y), maxf(j[J_KF].y, j[J_KB].y) + 3.0)


## Lowest point of the whole body (for lying / rolled poses).
static func body_bottom(j: PackedVector2Array, head_r: float) -> float:
	var m := foot_bottom(j)
	for i in [J_HIP, J_NECK, J_EF, J_HF, J_EB, J_HB]:
		m = maxf(m, j[i].y + 3.0)
	return maxf(m, j[J_HEAD].y + head_r)


static func _seg(ci: CanvasItem, a: Vector2, b: Vector2, col: Color, w: float) -> void:
	ci.draw_line(a, b, col, w, true)
	ci.draw_circle(a, w * 0.5, col)
	ci.draw_circle(b, w * 0.5, col)


static func _limb(ci: CanvasItem, a: Vector2, b: Vector2, c: Vector2, fill: Color, line: Color, w: float, ow: float) -> void:
	_seg(ci, a, b, line, w + ow * 2.0)
	_seg(ci, b, c, line, w + ow * 2.0)
	_seg(ci, a, b, fill, w)
	_seg(ci, b, c, fill, w)


## Draws a fighter. `o` is the hip position in the canvas item's space.
## st: body, back, line, accent, w, head, weapon, facing
static func draw_body(ci: CanvasItem, jj: PackedVector2Array, o: Vector2, st: Dictionary, alpha := 1.0, flash := 0.0) -> void:
	var j := PackedVector2Array()
	j.resize(NJ)
	for i in NJ:
		j[i] = jj[i] + o
	var body: Color = st.body
	var back: Color = st.back
	var line: Color = st.line
	var accent: Color = st.accent
	if flash > 0.0:
		body = body.lerp(Color(1, 1, 1), flash)
		back = back.lerp(Color(1, 1, 1), flash * 0.8)
		line = line.lerp(Color(1, 1, 1), flash)
	body.a *= alpha
	back.a *= alpha
	line.a *= alpha
	accent.a *= alpha
	var w: float = st.w
	var ow: float = st.get("ow", 2.2)
	var facing: float = st.facing
	var weapon: String = st.weapon

	# back arm and leg
	if weapon == "knives":
		_draw_knife(ci, j[J_HB], j[J_WB], line, accent, alpha)
	_limb(ci, j[J_SH], j[J_EB], j[J_HB], back, line, w * 0.92, ow)
	_limb(ci, j[J_HIP], j[J_KB], j[J_FB], back, line, w * 0.95, ow)
	if weapon == "fists":
		_fist(ci, j[J_HB], back, line, accent, w, ow, alpha * 0.8)

	# torso
	_seg(ci, j[J_HIP], j[J_NECK], line, w * 1.2 + ow * 2.0)
	_seg(ci, j[J_HIP], j[J_NECK], body, w * 1.2)
	# front leg
	_limb(ci, j[J_HIP], j[J_KF], j[J_FF], body, line, w, ow)

	# head
	var hr: float = st.head
	ci.draw_circle(j[J_HEAD], hr + ow, line)
	ci.draw_circle(j[J_HEAD], hr, body)
	var hv := (j[J_HEAD] - j[J_NECK]).normalized()
	var side := Vector2(-hv.y, hv.x) * facing
	var vis_c := j[J_HEAD] + side * hr * 0.35 + hv * hr * 0.12
	var visor := accent.lerp(Color(1, 1, 1), 0.25)
	ci.draw_line(vis_c - side * hr * 0.25, vis_c + side * hr * 0.62, visor, maxf(3.0, hr * 0.34), true)
	# headband knot
	var knot := j[J_HEAD] - side * hr * 0.95 + hv * hr * 0.15
	ci.draw_circle(knot, hr * 0.22, accent)

	# front arm + weapon
	if weapon == "sword":
		_draw_sword(ci, j[J_HF], j[J_WT], line, accent, alpha)
	elif weapon == "staff":
		_draw_staff(ci, j[J_HF], j[J_WT], line, accent, alpha)
	elif weapon == "knives":
		_draw_knife(ci, j[J_HF], j[J_WT], line, accent, alpha)
	_limb(ci, j[J_SH], j[J_EF], j[J_HF], body, line, w, ow)
	if weapon == "fists":
		_fist(ci, j[J_HF], body, line, accent, w, ow, alpha)


static func _fist(ci: CanvasItem, p: Vector2, fill: Color, line: Color, accent: Color, w: float, ow: float, alpha: float) -> void:
	ci.draw_circle(p, w * 0.95 + ow, line)
	ci.draw_circle(p, w * 0.95, fill)
	var a := accent
	a.a = alpha
	ci.draw_arc(p, w * 0.95, 0, TAU, 14, a, 2.0, true)


static func _draw_sword(ci: CanvasItem, hand: Vector2, tip: Vector2, line: Color, accent: Color, alpha: float) -> void:
	var d := (tip - hand).normalized()
	var n := Vector2(-d.y, d.x)
	var handle := hand - d * 9.0
	ci.draw_line(handle, hand, line, 5.0, true)
	var steel := Color(0.92, 0.94, 1.0, alpha)
	var edge := accent.lerp(Color(1, 1, 1), 0.3)
	edge.a = alpha
	var base := hand + d * 3.0
	var blade := PackedVector2Array([base + n * 2.6, tip - d * 6.0 + n * 2.0, tip, tip - d * 6.0 - n * 2.4, base - n * 2.4])
	var outline := PackedVector2Array([base + n * 4.2, tip - d * 6.0 + n * 3.6, tip + d * 2.0, tip - d * 6.0 - n * 4.0, base - n * 4.0])
	ci.draw_colored_polygon(outline, line)
	ci.draw_colored_polygon(blade, steel)
	ci.draw_line(base + n * 1.4, tip - d * 4.0, edge, 1.6, true)
	ci.draw_line(hand + d * 2.0 + n * 6.0, hand + d * 2.0 - n * 6.0, line, 4.5, true)
	ci.draw_line(hand + d * 2.0 + n * 5.0, hand + d * 2.0 - n * 5.0, accent, 2.2, true)


static func _draw_staff(ci: CanvasItem, hand: Vector2, tip: Vector2, line: Color, accent: Color, alpha: float) -> void:
	var d := (tip - hand).normalized()
	var butt := hand - d * (tip - hand).length() * 0.45
	ci.draw_line(butt, tip, line, 7.0, true)
	var shaft := Color(0.78, 0.82, 0.9, alpha)
	ci.draw_line(butt, tip, shaft, 3.4, true)
	var glow := accent
	glow.a = 0.28 * alpha
	ci.draw_circle(tip, 11.0, glow)
	ci.draw_circle(tip, 6.5, line)
	var core := accent.lerp(Color(1, 1, 1), 0.45)
	core.a = alpha
	ci.draw_circle(tip, 4.6, core)
	ci.draw_circle(butt, 3.5, line)


static func _draw_knife(ci: CanvasItem, hand: Vector2, tip: Vector2, line: Color, accent: Color, alpha: float) -> void:
	var d := (tip - hand).normalized()
	var n := Vector2(-d.y, d.x)
	var base := hand + d * 2.0
	var outline := PackedVector2Array([base + n * 3.6, tip + d * 1.5, base - n * 3.6])
	ci.draw_colored_polygon(outline, line)
	var steel := Color(0.9, 0.9, 1.0, alpha)
	ci.draw_colored_polygon(PackedVector2Array([base + n * 2.2, tip, base - n * 2.2]), steel)
	ci.draw_line(base, tip - d * 2.0, accent, 1.3, true)
