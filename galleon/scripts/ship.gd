extends Node3D
## The galleon: rigid-body dynamics on the Gerstner sea, plus its animated rigging.
## Buoyancy comes from columns under the hull, each feeling the real wave height,
## so the ship heaves, pitches and rolls with the swell. Ship space: +Z bow, +Y up.

const RHO := 1025.0
const G := 9.81
const AIR := 1.2
const MASS := 640000.0
const DRAFT := 2.65
const COLUMN_HEIGHT := 8.0
const CG_Y := -0.8
const SAIL_AREA := 950.0
const CE_Y := 14.0
const LENGTH := 38.0
const BEAM := 10.6

var inertia := Vector3(MASS * (38.0 * 38.0 + 81.0) / 18.0, MASS * (38.0 * 38.0 + 10.6 * 10.6) / 16.0, MASS * (10.6 * 10.6 + 64.0) / 12.0)

var vel := Vector3.ZERO
var omega := Vector3.ZERO ## world angular velocity
var rudder := 0.0 ## -1..1, positive turns to starboard (clockwise seen from above)
var sail := 0.0 ## 0 furled .. 1 full, smoothed toward sail_target
var sail_target := 0.0
var drive := 0.0 ## how well the sails draw, 0..1
var apparent := Vector3.ZERO ## apparent wind (blowing toward)
var submerged := 0.0
var bow_dip := 0.0
var columns: Array = []
var sim_time := 0.0

# visuals
var model: Node3D
var sails: Array = [] ## {node: MeshInstance3D, pivot: Node3D, kind}
var flags: Array = []
var rudder_node: Node3D
var furl_vis := 0.0


func _ready() -> void:
	_build_columns()


# ------------------------------------------------------------------ hull shape (matches tools/build_constants.py)
static func _smooth(a: float, b: float, x: float) -> float:
	var t := clampf((x - a) / (b - a), 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)


static func keel(u: float) -> float:
	var y := -3.05 + 0.55 * pow(1.0 - _smooth(0.0, 0.22, u), 2.0)
	var b := maxf(0.0, (u - 0.72) / 0.28)
	return y + b * b * 4.1


static func plan_half(u: float) -> float:
	var p := 1.0
	if u < 0.42:
		p = 0.64 + 0.36 * sin((u / 0.42) * PI / 2.0)
	elif u >= 0.56:
		p = sqrt(maxf(0.0, 1.0 - pow((u - 0.56) / 0.44, 2.15)))
	return BEAM / 2.0 * p


static func half_width(u: float, y: float) -> float:
	var bottom := keel(u)
	if y <= bottom:
		return 0.0
	var w: float
	if y < 1.4:
		var s := (y - bottom) / (1.4 - bottom)
		var ex := 0.5 + 0.85 * (1.0 - _smooth(0.05, 0.4, u)) + 0.25 * _smooth(0.75, 1.0, u)
		w = pow(sin(s * PI / 2.0), ex)
	else:
		w = 1.0 - 0.2 * pow((y - 1.4) / 8.0, 1.25)
	return plan_half(u) * w


static func z_at(u: float) -> float:
	return (u - 0.5) * LENGTH


func _build_columns() -> void:
	columns.clear()
	var total := 0.0
	for i in 11:
		var u := 0.06 + 0.88 * i / 10.0
		var w := half_width(u, 0.2)
		if w <= 0.0:
			w = plan_half(u) * 0.3
		for side in [-1.0, 1.0]:
			var weight := maxf(0.15, w) * (1.0 - 0.35 * maxf(0.0, keel(u) + 2.5) / 3.0)
			columns.append({"p": Vector3(side * w * 0.78, -DRAFT, z_at(u)), "weight": weight, "area": 0.0})
			total += weight
	var area := MASS / (RHO * DRAFT)
	for c in columns:
		c.area = area * c.weight / total


# ------------------------------------------------------------------ physics
func forward() -> Vector3:
	return global_transform.basis.z


func heading() -> float:
	var f := forward()
	return atan2(f.x, f.z)


func speed() -> float:
	return vel.dot(forward())


static func sail_polar(beta: float) -> float:
	return _smooth(0.95, 1.85, beta) * (1.0 - 0.18 * _smooth(2.5, PI, beta))


func step(dt: float) -> void:
	var n := maxi(1, ceili(dt / (1.0 / 120.0)))
	var h := dt / n
	for i in n:
		_substep(h)


func _substep(dt: float) -> void:
	sim_time += dt
	Waves.time = sim_time
	sail += (sail_target - sail) * minf(1.0, dt * 0.35)
	var b := transform.basis.orthonormalized()
	var pos := position
	var force := Vector3(0.0, -MASS * G, 0.0)
	var torque := Vector3.ZERO
	var cg := pos + b * Vector3(0.0, CG_Y, 0.0)

	# buoyancy and heave damping, column by column
	var sub := 0.0
	for c in columns:
		var p: Vector3 = pos + b * c.p
		var water := Waves.height_at(p.x, p.z, sim_time)
		var depth := minf(COLUMN_HEIGHT, water - p.y)
		if depth <= 0.0:
			continue
		sub += depth / DRAFT
		p.y += depth * 0.5
		var vp := vel + omega.cross(p - cg)
		var lift: float = RHO * G * c.area * depth
		var damp: float = -RHO * 1.6 * c.area * vp.y * minf(1.0, depth / 1.5)
		var f := Vector3(0.0, lift + damp, 0.0)
		force += f
		torque += (p - cg).cross(f)
	submerged = sub / columns.size()
	var wet := minf(1.3, submerged)

	# hull drag in the ship's own frame
	var local := b.inverse() * vel
	var drag := b * Vector3(
		-(52000.0 * local.x * absf(local.x) + 60000.0 * local.x) * wet,
		0.0,
		-(1500.0 * local.z * absf(local.z) + 2200.0 * local.z) * wet)
	var at := pos + b * Vector3(0.0, -1.2, 0.0)
	force += drag
	torque += (at - cg).cross(drag)

	# wind on the sails
	var fwd := b.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var star := Vector3(-fwd.z, 0.0, fwd.x) * -1.0 ## starboard (-X in ship space)
	star = -b.x
	star.y = 0.0
	star = star.normalized()
	apparent = Waves.wind() - vel
	apparent.y = 0.0
	var app_speed := apparent.length()
	drive = 0.0
	if app_speed > 0.01 and sail > 0.001:
		var from := -apparent / app_speed
		var beta := acos(clampf(from.dot(fwd), -1.0, 1.0))
		var polar := sail_polar(beta)
		drive = polar
		var q := 0.5 * AIR * app_speed * app_speed * SAIL_AREA * sail
		var side_sign := -signf(from.dot(star))
		var side := q * (0.28 + 0.5 * polar) * sin(beta) * 0.55
		var sf := fwd * (q * polar) + star * side * side_sign
		if beta < 0.9:
			sf -= fwd * q * 0.12 * (1.0 - beta / 0.9)
		var ce := pos + b * Vector3(0.0, CE_Y, 0.0)
		force += sf
		torque += (ce - cg).cross(sf)

	# rudder: needs water flowing past it
	var vf := local.z
	var yaw_t := rudder * (2.1e5 * vf * absf(vf) + 1.4e5 * vf + 6e4) * wet
	torque += b.y * -yaw_t
	torque += fwd * (-rudder * 1.2e4 * vf * absf(vf) * wet)

	# water resists turning and rolling
	var wl := b.inverse() * omega
	torque += b * Vector3(
		-wl.x * 3.4e7 * wet,
		-wl.y * 1.1e7 * wet - wl.y * absf(wl.y) * 6e7,
		-wl.z * 2.4e7 * wet)

	# integrate
	vel += force * (dt / MASS)
	pos += vel * dt
	var tl := b.inverse() * torque
	wl += Vector3(tl.x / inertia.x, tl.y / inertia.y, tl.z / inertia.z) * dt
	omega = b * wl
	var ang := omega.length()
	if ang > 1e-9:
		b = Basis(omega / ang, ang * dt) * b
	transform = Transform3D(b.orthonormalized(), pos)

	var bow := pos + b * Vector3(0.0, 0.0, 17.0)
	var bow_v := vel + omega.cross(bow - cg)
	bow_dip = maxf(0.0, -bow_v.y) if bow.y - Waves.height_at(bow.x, bow.z, sim_time) < 1.5 else 0.0


func attitude() -> Vector2: ## (heel, pitch) in degrees
	var b := transform.basis
	return Vector2(rad_to_deg(asin(clampf(b.x.y, -1.0, 1.0))), rad_to_deg(asin(clampf(b.z.y, -1.0, 1.0))))


# ------------------------------------------------------------------ visuals
func attach_model(scene: PackedScene, sail_shader: Shader, flag_shader: Shader) -> void:
	model = scene.instantiate()
	add_child(model)
	var sail_tex: Texture2D = load("res://assets/ship/tex/sail_albedo.png")
	var sail_nrm: Texture2D = load("res://assets/ship/tex/sail_normal.png")
	var flag_tex: Texture2D = load("res://assets/ship/tex/flag_albedo.png")
	for node in _all(model):
		if node is MeshInstance3D:
			var mi := node as MeshInstance3D
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			if mi.name.begins_with("Sail_"):
				var m := ShaderMaterial.new()
				m.shader = sail_shader
				m.set_shader_parameter("albedo_tex", sail_tex)
				m.set_shader_parameter("normal_tex", sail_nrm)
				var kind := "square"
				if mi.name == "Sail_lateen":
					kind = "lateen"
					m.set_shader_parameter("mode", 1)
					var abc := _lateen_points(mi.mesh)
					m.set_shader_parameter("lat_a", abc[0])
					m.set_shader_parameter("lat_b", abc[1])
					m.set_shader_parameter("lat_c", abc[2])
				else:
					mi.set_instance_shader_parameter("shape", _sail_shape(mi.mesh))
				mi.material_override = m
				mi.extra_cull_margin = 4.0
				sails.append({"node": mi, "pivot": mi.get_parent(), "kind": kind})
			elif mi.name.begins_with("Flag_"):
				var m := ShaderMaterial.new()
				m.shader = flag_shader
				if mi.name in ["Flag_fore", "Flag_mizzen"]:
					m.set_shader_parameter("use_tex", false)
					m.set_shader_parameter("tint", Color(0.6, 0.08, 0.05))
				else:
					m.set_shader_parameter("albedo_tex", flag_tex)
				mi.material_override = m
				mi.extra_cull_margin = 2.0
				flags.append(mi)
		if node.name == "Rudder":
			rudder_node = node


func _all(n: Node) -> Array:
	var out := [n]
	for c in n.get_children():
		out.append_array(_all(c))
	return out


## Read the rest shape of a square sail back from its mesh.
func _sail_shape(mesh: Mesh) -> Vector4:
	var arr := mesh.surface_get_arrays(0)
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var top := -INF
	var bot := INF
	for p in v:
		top = maxf(top, p.y)
		bot = minf(bot, p.y)
	var th := 0.0
	var bh := 0.0
	for p in v:
		if absf(p.y - top) < 0.01:
			th = maxf(th, absf(p.x))
		if absf(p.y - bot) < 0.01:
			bh = maxf(bh, absf(p.x))
	return Vector4(th, bh, top - bot, v[0].z)


func _lateen_points(mesh: Mesh) -> Array:
	var arr := mesh.surface_get_arrays(0)
	var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var uv: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV]
	var a := Vector3.ZERO
	var b := Vector3.ZERO
	var c := Vector3.ZERO
	for i in v.size():
		if uv[i].distance_to(Vector2(0, 0)) < 0.01:
			a = v[i]
		elif uv[i].distance_to(Vector2(1, 0)) < 0.01:
			b = v[i]
		elif uv[i].y > 0.99:
			c = v[i]
	return [a, b, c]


func animate(dt: float) -> void:
	if model == null:
		return
	var wl := transform.basis.inverse() * apparent
	wl.y = 0.0
	var ws := maxf(0.1, wl.length())
	var wind_angle := atan2(wl.x, wl.z)
	furl_vis += (sail - furl_vis) * minf(1.0, dt * 3.0)
	for s in sails:
		var pivot: Node3D = s.pivot
		var mi: MeshInstance3D = s.node
		if s.kind == "square":
			var target := clampf(wind_angle * 0.5, -0.6, 0.6)
			pivot.rotation.y += (target - pivot.rotation.y) * minf(1.0, dt * 0.8)
			var n := sin(pivot.rotation.y) * wl.x + cos(pivot.rotation.y) * wl.z
			mi.set_instance_shader_parameter("fill", clampf((n / ws) * (0.75 + 0.6 * drive) + 0.15, -0.6, 1.0))
		else:
			var target := clampf(-wl.x / ws * 0.45, -0.5, 0.5)
			pivot.rotation.y += (target - pivot.rotation.y) * minf(1.0, dt * 0.8)
			mi.set_instance_shader_parameter("fill", clampf(wl.x / ws * 1.3, -1.0, 1.0))
		mi.set_instance_shader_parameter("furl", furl_vis)
	for f in flags:
		f.rotation.y = atan2(-wl.z, wl.x)
	if rudder_node:
		rudder_node.rotation.y += (rudder * 0.6 - rudder_node.rotation.y) * minf(1.0, dt * 3.0)
