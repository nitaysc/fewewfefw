extends SubViewport
## The ship's wake, drawn top-down into a small texture the ocean shader reads:
## red = white foam, green = churned (turquoise) water. Blobs are laid down
## along the ship's track: a turbulent trail astern, Kelvin wave arms spreading
## from the bow, and white water pressed against the hull.

const LAYER := 20
const MAX_BLOBS := 2600
const SIZE := 300.0

var center := Vector2.ZERO
var tracks := {} ## ship instance id -> samples along its track
var splashes: Array = []
var timer := 0.0
var mm: MultiMesh
var cam: Camera3D
var buf := PackedFloat32Array() ## 12 transform + 4 custom floats per blob, uploaded in one go
var redraw := 0.0


func _init() -> void:
	size = Vector2i(512, 512)
	render_target_update_mode = SubViewport.UPDATE_ONCE
	transparent_bg = false
	msaa_3d = Viewport.MSAA_DISABLED


func _ready() -> void:
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = SIZE
	cam.near = 1.0
	cam.far = 200.0
	cam.cull_mask = 1 << (LAYER - 1)
	cam.rotation_degrees = Vector3(-90, 0, 0)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color.BLACK
	env.ambient_light_source = Environment.AMBIENT_SOURCE_DISABLED
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	cam.environment = env
	add_child(cam)

	var quad := PlaneMesh.new()
	quad.size = Vector2(2, 2)
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, depth_test_disabled, fog_disabled;
varying vec4 val;
void vertex() { val = INSTANCE_CUSTOM; }
void fragment() {
	float d = length(UV * 2.0 - 1.0);
	float core = smoothstep(0.65, 0.1, d);
	float soft = smoothstep(1.0, 0.0, d);
	ALBEDO = vec3(val.x * core, val.y * soft * 0.6, 0.0);
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	quad.material = m
	mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = quad
	mm.instance_count = MAX_BLOBS
	mm.visible_instance_count = 0
	buf.resize(MAX_BLOBS * 16)
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.layers = 1 << (LAYER - 1)
	mmi.extra_cull_margin = 16384.0
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mmi)


## ships[0] is the one the map is centred on; the others leave wakes where they cross it.
func update(dt: float, ships: Array) -> void:
	timer += dt
	var record := timer > 0.12
	if record:
		timer = 0.0
	for ship in ships:
		_record(ship, record)
	var lead = ships[0]
	var texel := SIZE / size.x
	center = Vector2(roundf(lead.position.x / texel) * texel, roundf(lead.position.z / texel) * texel)
	cam.position = Vector3(center.x, 100.0, center.y)
	# the foam map only needs refreshing ~30 times a second
	redraw += dt
	if redraw < 1.0 / 30.0:
		return
	redraw = 0.0
	var n := 0
	for ship in ships:
		n = _draw_ship(n, ship)
	var now: float = lead.sim_time
	var i := 0
	while i < splashes.size():
		var sp: Dictionary = splashes[i]
		var age: float = now - sp.t
		if age > 25.0:
			splashes.remove_at(i)
			continue
		n = _put(n, sp.x, sp.z, sp.r * (1.5 + age * 0.25), sp.rot, sp.k * exp(-age / 5.0), sp.k * exp(-age / 9.0) * 0.8)
		i += 1
	mm.buffer = buf
	render_target_update_mode = SubViewport.UPDATE_ONCE
	mm.visible_instance_count = n


## A patch of foam where a shot (or a sinking ship) churned the sea.
func add_splash(p: Vector3, strength: float, t: float) -> void:
	if splashes.size() > 120:
		splashes.pop_front()
	splashes.append({"x": p.x, "z": p.z, "r": 2.0 * strength + 0.5, "k": minf(1.0, strength), "t": t, "rot": randf() * TAU})


func _record(ship, record: bool) -> void:
	var id: int = ship.get_instance_id()
	if not tracks.has(id):
		tracks[id] = []
	var samples: Array = tracks[id]
	if not record:
		return
	var t: float = ship.sim_time
	var b: Basis = ship.transform.basis
	var pos: Vector3 = ship.position
	var fwd := b.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var sides := []
	for u in [0.85, 0.65, 0.45, 0.25]:
		for s in [1.0, -1.0]:
			sides.append(pos + b * Vector3(s * (ship.half_width(u, 0.0) + 0.3), 0.0, ship.z_at(u)))
	samples.append({
		"t": t, "speed": maxf(0.0, ship.speed()), "heave": absf(ship.vel.y),
		"stern": pos + b * Vector3(0, 0, ship.z_at(0.03)), "bow": pos + b * Vector3(0, 0, ship.z_at(0.97)),
		"right": Vector3(fwd.z, 0.0, -fwd.x), "sides": sides, "rot": randf() * TAU,
	})
	while samples.size() > 0 and t - samples[0].t > 45.0:
		samples.pop_front()


func _draw_ship(n: int, ship) -> int:
	var pos: Vector3 = ship.position
	# skip ships whose wake can't reach the map at all
	if Vector2(pos.x, pos.z).distance_to(center) > SIZE * 0.5 + 600.0:
		return n
	var t: float = ship.sim_time
	var b: Basis = ship.transform.basis
	var spd: float = maxf(0.0, ship.speed())
	for s in tracks.get(ship.get_instance_id(), []):
		var age: float = t - s.t
		var sp := minf(1.0, s.speed / 3.5)
		var churn := minf(1.0, sp + s.heave * 0.4)
		var decay := exp(-age / 11.0)
		n = _put(n, s.stern.x, s.stern.z, 3.0 + age * 0.32, s.rot + age * 0.1, churn * decay * 0.9, churn * exp(-age / 20.0) * 0.9)
		if age < 22.0:
			var spread: float = 5.2 + age * s.speed * 0.36
			var arm := exp(-age / 6.5) * sp
			for side in [1.0, -1.0]:
				var p: Vector3 = s.bow + s.right * side * spread
				n = _put(n, p.x, p.z, 1.5 + age * 0.22, s.rot + side, arm * 0.8, arm * 0.7)
		if age < 3.0:
			var k := (1.0 - age / 3.0) * (0.35 + 0.65 * churn)
			for i in s.sides.size():
				var p: Vector3 = s.sides[i]
				var bowish := 1.4 if i < 2 else 1.0 # the bow pushes up the most white water
				n = _put(n, p.x, p.z, (2.4 + age * 1.4) * bowish, s.rot + age, minf(1.0, k * 0.9 * bowish), k)
	var idle := minf(1.0, absf(ship.vel.y) * 0.8 + minf(1.0, spd / 3.5) * 0.5)
	for i in 9:
		var u := 0.1 + i * 0.1
		for side in [1.0, -1.0]:
			var p: Vector3 = pos + b * Vector3(side * (ship.half_width(u, 0.0) + 0.2), 0.0, ship.z_at(u))
			n = _put(n, p.x, p.z, 2.4, u * 10.0, 0.3 + 0.5 * idle, 0.5 + 0.4 * idle)
	return n


func forget(ship) -> void:
	tracks.erase(ship.get_instance_id())


func _put(n: int, x: float, z: float, r: float, rot: float, foam: float, aer: float) -> int:
	if n >= MAX_BLOBS:
		return n
	var c := cos(rot) * r
	var sn := sin(rot) * r
	var i := n * 16
	# rows of the 3x4 transform (rotation about Y, scaled by r in x/z), then custom data
	buf[i] = c; buf[i + 1] = 0.0; buf[i + 2] = sn; buf[i + 3] = x
	buf[i + 4] = 0.0; buf[i + 5] = 1.0; buf[i + 6] = 0.0; buf[i + 7] = 0.0
	buf[i + 8] = -sn; buf[i + 9] = 0.0; buf[i + 10] = c; buf[i + 11] = z
	buf[i + 12] = foam; buf[i + 13] = aer; buf[i + 14] = 0.0; buf[i + 15] = 0.0
	return n + 1
