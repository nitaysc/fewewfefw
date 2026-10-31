extends Node3D
## The workshop you see: the room, the camera, and every machine, belt and item drawn from
## Game.sim each frame. Also handles touch: pan, pinch-zoom, tap to select, build and remove.

signal selected(cell)                 # Vector2i or null
signal hint(text: String)

const W := Data.GRID_W
const H := Data.GRID_H

var cam: Camera3D
var pivot := Vector3(-0.6, 0, 0.6)
var pivot_goal := Vector3(-0.6, 0, 0.6)
var yaw := deg_to_rad(36.0)
var pitch := deg_to_rad(52.0)
var dist := 17.5
var dist_goal := 17.5

var machine_nodes := {}               # Vector2i -> {node, key}
var item_nodes := {}                  # item id -> Node3D
var belt_mat: ShaderMaterial
var grid_overlay: MeshInstance3D
var sel_ring: MeshInstance3D
var ghost: Node3D
var ghost_kind := ""
var hover := Vector2i(-1, -1)
var tile: MeshInstance3D

var mode := ""                         # "", "build", "remove"
var build_kind := ""
var build_dir := 0
var sel = null                         # selected cell

var touches := {}
var drag_start := Vector2.ZERO
var dragging := false
var drawing := false
var last_cell := Vector2i(-1, -1)
var pinch_d := 0.0
var t := 0.0

# ---------------------------------------------------------------- set up
func _ready() -> void:
	_environment()
	_room()
	_camera()
	belt_mat = ShaderMaterial.new()
	belt_mat.shader = _shader(BELT_SHADER)
	grid_overlay = MeshInstance3D.new()
	var q := PlaneMesh.new()
	q.size = Vector2(W, H)
	grid_overlay.mesh = q
	var gm := ShaderMaterial.new()
	gm.shader = _shader(GRID_SHADER)
	grid_overlay.material_override = gm
	grid_overlay.position = Vector3(0, 0.012, 0)
	grid_overlay.visible = false
	add_child(grid_overlay)
	sel_ring = Meshes.put(self, Meshes.torus(0.6, 0.68), Meshes.glow(Color("ffd36b"), 1.6), Vector3(0, 0.1, 0), Vector3.ZERO, Vector3(1, 0.4, 1))
	sel_ring.visible = false
	tile = Meshes.put(self, Meshes.rbox(Vector3(0.96, 0.02, 0.96), 0.08), Meshes.clear_mat(Color("7dffb0"), 0.35), Vector3.ZERO)
	tile.visible = false
	Game.sim.made.connect(_on_made)
	Game.sold.connect(_on_sold)

func _shader(code: String) -> Shader:
	var s := Shader.new()
	s.code = code
	return s

func _environment() -> void:
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("2a1f24")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("ffe6cf")
	env.ambient_light_energy = 0.2
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.tonemap_exposure = 0.92
	env.glow_enabled = false
	env.glow_intensity = 0.35
	env.glow_bloom = 0.04
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.12
	env.adjustment_contrast = 1.04
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color("fff0d8")
	sun.light_energy = 0.78
	sun.rotation_degrees = Vector3(-52, 28, 0)
	sun.shadow_enabled = true
	sun.shadow_blur = 2.2
	sun.shadow_opacity = 0.75
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 40.0
	add_child(sun)
	var fill := OmniLight3D.new()
	fill.light_color = Color("ffb877")
	fill.light_energy = 0.8
	fill.omni_range = 9.0
	fill.position = Vector3(-4, 3.2, -3.5)
	add_child(fill)

func _camera() -> void:
	cam = Camera3D.new()
	cam.fov = 30.0
	cam.near = 0.5
	cam.far = 80.0
	add_child(cam)
	_place_camera(1.0)

func _place_camera(k: float) -> void:
	pivot = pivot.lerp(pivot_goal, k)
	dist = lerpf(dist, dist_goal, k)
	var off := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist
	cam.position = pivot + off
	cam.look_at(pivot, Vector3.UP)

# ---------------------------------------------------------------- the room
func _room() -> void:
	var fm := ShaderMaterial.new()
	fm.shader = _shader(FLOOR_SHADER)
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(W + 8, H + 8)
	floor_mi.mesh = pm
	floor_mi.material_override = fm
	floor_mi.position = Vector3(1.5, 0, 1.5)
	add_child(floor_mi)
	# a soft rug under the factory floor so the play area reads clearly
	Meshes.put(self, Meshes.rbox(Vector3(W + 0.6, 0.02, H + 0.6), 0.25), Meshes.mat(Color("c9a98a"), 0.95, 0.0, 0.0), Vector3(0, 0.0, 0))
	Meshes.put(self, Meshes.rbox(Vector3(W + 0.2, 0.025, H + 0.2), 0.2), Meshes.mat(Color("e4cfb6"), 0.95, 0.0, 0.0), Vector3(0, 0.002, 0))
	var wm := ShaderMaterial.new()
	wm.shader = _shader(WALL_SHADER)
	var bz := -H / 2.0 - 1.4
	var lx := -W / 2.0 - 1.4
	# back and left walls with a wooden skirting
	Meshes.put(self, Meshes.rbox(Vector3(W + 6, 4.5, 0.3), 0.05), wm, Vector3(1.5, 2.25, bz - 0.15))
	Meshes.put(self, Meshes.rbox(Vector3(0.3, 4.5, H + 6), 0.05), wm, Vector3(lx - 0.15, 2.25, 1.5))
	var skirt := Meshes.mat(Color("8a5a3c"), 0.6)
	Meshes.put(self, Meshes.rbox(Vector3(W + 6, 0.7, 0.12), 0.04), skirt, Vector3(1.5, 0.35, bz + 0.05))
	Meshes.put(self, Meshes.rbox(Vector3(0.12, 0.7, H + 6), 0.04), skirt, Vector3(lx + 0.05, 0.35, 1.5))
	Meshes.put(self, Meshes.rbox(Vector3(W + 6, 0.08, 0.16), 0.03), Meshes.mat(Color("6e4630"), 0.6), Vector3(1.5, 0.72, bz + 0.07))
	Meshes.put(self, Meshes.rbox(Vector3(0.16, 0.08, H + 6), 0.03), Meshes.mat(Color("6e4630"), 0.6), Vector3(lx + 0.07, 0.72, 1.5))
	# windows with daylight
	for x in [-3.5, 1.0, 5.5]:
		_window(Vector3(x, 2.45, bz + 0.02), 0)
	_window(Vector3(lx + 0.02, 2.45, 0.5), 1)
	# shelves of finished toys on the back wall
	for sx in [-1.25, 3.25]:
		var sy := 1.75
		Meshes.put(self, Meshes.rbox(Vector3(2.4, 0.08, 0.42), 0.03), Meshes.mat(Color("a8703f"), 0.6), Vector3(sx, sy, bz + 0.22))
		var toys := ["car", "teddy", "rocket", "top", "train", "robot"]
		for i in 4:
			var it := Meshes.item({"t": toys[(i + int(sx)) % toys.size()], "c": Data.PAINTS[(i * 2 + int(sx + 4)) % Data.PAINTS.size()]})
			it.position = Vector3(sx - 0.85 + i * 0.57, sy + 0.04, bz + 0.25)
			it.rotation_degrees = Vector3(0, 25 - i * 12, 0)
			it.scale = Vector3.ONE * 1.25
			add_child(it)
	# plants, a stack of parcels and crates around the edges
	_plant(Vector3(lx + 0.7, 0, bz + 0.7), 1.3)
	_plant(Vector3(W / 2.0 + 1.6, 0, bz + 0.7), 1.0)
	_plant(Vector3(lx + 0.7, 0, H / 2.0 + 1.2), 0.9)
	var cb := Meshes.mat(Color("d6a46b"), 0.85)
	for i in 3:
		Meshes.put(self, Meshes.rbox(Vector3(0.8 - i * 0.12, 0.5, 0.7 - i * 0.1), 0.03), cb, Vector3(W / 2.0 + 1.3, 0.25 + i * 0.5, 0.6), Vector3(0, i * 12, 0))
	var crate := Meshes.mat(Color("c98a52"), 0.75)
	Meshes.put(self, Meshes.rbox(Vector3(0.8, 0.8, 0.8), 0.05), crate, Vector3(lx + 0.8, 0.4, -1.2), Vector3(0, 10, 0))
	Meshes.put(self, Meshes.rbox(Vector3(0.6, 0.6, 0.6), 0.05), crate, Vector3(lx + 0.75, 1.1, -1.25), Vector3(0, -8, 0))
	# a big friendly wall clock
	var clock := Node3D.new()
	clock.position = Vector3(-6.0, 3.3, bz + 0.05)
	add_child(clock)
	Meshes.put(clock, Meshes.cyl(0.5, 0.5, 0.1, 40), Meshes.mat(Color("ff7f6b"), 0.5), Vector3.ZERO, Vector3(90, 0, 0))
	Meshes.put(clock, Meshes.cyl(0.42, 0.42, 0.11, 40), Meshes.mat(Color("fff6e8"), 0.6), Vector3(0, 0, 0.01), Vector3(90, 0, 0))
	var hand := Meshes.group(clock, "hand", Vector3(0, 0, 0.08))
	Meshes.put(hand, Meshes.rbox(Vector3(0.04, 0.3, 0.02), 0.01), Meshes.mat(Color("3b2f3a"), 0.5), Vector3(0, 0.13, 0))
	set_meta("clock", hand)

func _window(pos: Vector3, side: int) -> void:
	var n := Node3D.new()
	n.position = pos
	n.rotation_degrees = Vector3(0, 90 if side == 1 else 0, 0)
	add_child(n)
	var frame := Meshes.mat(Color("fff6e8"), 0.5)
	Meshes.put(n, Meshes.rbox(Vector3(1.9, 1.8, 0.14), 0.06), frame, Vector3(0, 0, 0.02))
	Meshes.put(n, Meshes.rbox(Vector3(1.66, 1.56, 0.1), 0.03), Meshes.glow(Color("bfe4ff"), 1.25), Vector3(0, 0, 0.06))
	Meshes.put(n, Meshes.rbox(Vector3(0.07, 1.6, 0.12), 0.02), frame, Vector3(0, 0, 0.1))
	Meshes.put(n, Meshes.rbox(Vector3(1.7, 0.07, 0.12), 0.02), frame, Vector3(0, 0.1, 0.1))
	Meshes.put(n, Meshes.rbox(Vector3(2.1, 0.1, 0.3), 0.03), Meshes.mat(Color("a8703f"), 0.6), Vector3(0, -0.95, 0.12))
	# a beam of sunlight falling in
	var beam := MeshInstance3D.new()
	var bm := Meshes.rbox(Vector3(1.6, 3.2, 0.05), 0.02)
	beam.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(1.0, 0.92, 0.7, 0.035)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	beam.material_override = m
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	beam.position = Vector3(0.6, -1.0, 1.1)
	beam.rotation_degrees = Vector3(-38, 0, 0)
	n.add_child(beam)

func _plant(pos: Vector3, s: float) -> void:
	var n := Node3D.new()
	n.position = pos
	n.scale = Vector3.ONE * s
	add_child(n)
	Meshes.put(n, Meshes.cyl(0.26, 0.2, 0.42, 20), Meshes.mat(Color("e07a5f"), 0.7), Vector3(0, 0.21, 0))
	Meshes.put(n, Meshes.cyl(0.24, 0.24, 0.04, 20), Meshes.mat(Color("5a3a2a"), 0.9), Vector3(0, 0.41, 0))
	var leaf := [Meshes.mat(Color("5cae6b"), 0.6), Meshes.mat(Color("7cc77a"), 0.6), Meshes.mat(Color("3f8f58"), 0.6)]
	for i in 9:
		var a := i * 2.4
		var r := 0.12 + (i % 3) * 0.08
		Meshes.put(n, Meshes.sphere(0.2 - (i % 3) * 0.03, 0.12), leaf[i % 3], Vector3(cos(a) * r, 0.62 + (i % 4) * 0.12, sin(a) * r), Vector3(25 * cos(a), -a * 57.0, 20 * sin(a)))

# ---------------------------------------------------------------- helpers
static func cell_pos(p: Vector2i) -> Vector3:
	return Vector3(p.x - W / 2.0 + 0.5, 0, p.y - H / 2.0 + 0.5)

func screen_cell(sp: Vector2) -> Vector2i:
	var o := cam.project_ray_origin(sp)
	var d := cam.project_ray_normal(sp)
	if absf(d.y) < 0.0001:
		return Vector2i(-1, -1)
	var k := -o.y / d.y
	var hit := o + d * k
	return Vector2i(floori(hit.x + W / 2.0), floori(hit.z + H / 2.0))

static func dir_rot(d: int) -> float:
	return -d * PI / 2.0

func _key(c: Dictionary) -> String:
	return "%s|%d|%s|%s|%s" % [c.kind, c.dir, c.get("color", ""), c.get("toy", ""), c.get("mode", "")]

# ---------------------------------------------------------------- every frame
func _process(dt: float) -> void:
	t += dt
	_place_camera(1.0 - exp(-dt * 12.0))
	var clock: Node3D = get_meta("clock")
	clock.rotation.z = -t * 0.2
	_sync_machines(dt)
	_sync_items(dt)
	if sel_ring.visible:
		var s := 1.0 + sin(t * 5.0) * 0.04
		sel_ring.scale = Vector3(s, 0.4, s)
	if ghost:
		ghost.position = ghost.position.lerp(cell_pos(hover) + Vector3(0, 0.05 + sin(t * 6.0) * 0.03, 0), 1.0 - exp(-dt * 20.0))
		ghost.rotation.y = lerp_angle(ghost.rotation.y, dir_rot(build_dir), 1.0 - exp(-dt * 18.0))

func _sync_machines(dt: float) -> void:
	var cells: Dictionary = Game.sim.cells
	for p in machine_nodes.keys():
		if not cells.has(p):
			var old: Node3D = machine_nodes[p].node
			machine_nodes.erase(p)
			var tw := create_tween()
			tw.tween_property(old, "scale", Vector3(1.2, 0.1, 1.2), 0.16).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_IN)
			tw.tween_callback(old.queue_free)
	for p in cells:
		var c: Dictionary = cells[p]
		var key := _key(c)
		var rec = machine_nodes.get(p)
		if rec == null or rec.key != key:
			var fresh: bool = rec == null
			if rec != null:
				rec.node.queue_free()
			var n: Node3D
			if c.kind == "belt":
				n = Meshes.belt(belt_mat)
			else:
				n = Meshes.machine(c.kind, c)
				_shadow_blob(n)
			n.position = cell_pos(p)
			n.rotation.y = dir_rot(c.dir)
			add_child(n)
			machine_nodes[p] = {"node": n, "key": key}
			if fresh and t > 0.5:
				n.position.y = 1.2
				n.scale = Vector3(0.7, 1.3, 0.7)
				var tw := create_tween().set_parallel()
				tw.tween_property(n, "position:y", 0.0, 0.32).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
				tw.tween_property(n, "scale", Vector3.ONE, 0.45).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
		_animate_machine(machine_nodes[p].node, c, dt)

func _shadow_blob(n: Node3D) -> void:
	var q := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1.25, 1.25)
	q.mesh = pm
	var m := ShaderMaterial.new()
	m.shader = _shader(BLOB_SHADER)
	q.material_override = m
	q.position = Vector3(0, 0.006, 0)
	q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	n.add_child(q)

func _animate_machine(n: Node3D, c: Dictionary, dt: float) -> void:
	if c.kind == "belt":
		return
	var busy: bool = c.get("busy", false)
	var spin: Node3D = n.get_node_or_null("spin")
	if spin:
		var sp := 14.0 if busy else 0.6
		match c.kind:
			"saw": spin.rotate_z(-dt * sp * 1.6)
			"lathe": spin.rotate_x(dt * sp * 1.5)
			"loom": spin.rotate_y(dt * sp * 0.5)
	var bob: Node3D = n.get_node_or_null("bob")
	if bob:
		bob.position.y = 0.82 + (sin(t * 22.0) * 0.03 if busy else 0.0)
	var ham: Node3D = n.get_node_or_null("hammer")
	if ham:
		ham.rotation.z = (sin(t * 14.0) * 0.5 - 0.2) if busy else lerpf(ham.rotation.z, 0.3, dt * 4.0)
	var head: Node3D = n.get_node_or_null("head")
	if head:
		head.position.y = (0.55 + absf(sin(t * 6.0)) * 0.2) if busy else lerpf(head.position.y, 0.72, dt * 5.0)
	# busy machines breathe a little
	var target := 1.0 + (sin(t * 12.0) * 0.015 if busy else 0.0)
	n.scale = n.scale.lerp(Vector3(target, 2.0 - target, target), 1.0 - exp(-dt * 10.0))

func _sync_items(dt: float) -> void:
	var want := {}
	for p in Game.sim.cells:
		var c: Dictionary = Game.sim.cells[p]
		var dv := Vector3(Data.DIRS[c.dir].x, 0, Data.DIRS[c.dir].y)
		if c.kind == "belt":
			if c.item != null:
				want[c.item.id] = [c.item, cell_pos(p) + dv * (c.p - 0.5) + Vector3(0, 0.1, 0), dir_rot(c.dir)]
		elif not c.outbuf.is_empty():
			var it: Dictionary = c.outbuf[0]
			want[it.id] = [it, cell_pos(p) + dv * 0.46 + Vector3(0, 0.12, 0), dir_rot(c.dir)]
	for id in item_nodes.keys():
		if not want.has(id):
			var n: Node3D = item_nodes[id]
			item_nodes.erase(id)
			var tw := create_tween()
			tw.tween_property(n, "scale", Vector3.ZERO, 0.12)
			tw.tween_callback(n.queue_free)
	var k := 1.0 - exp(-dt * 28.0)
	for id in want:
		var w: Array = want[id]
		var n: Node3D = item_nodes.get(id)
		if n == null:
			n = Meshes.item(w[0])
			n.set_meta("s", 1.35)
			n.position = w[1]
			n.rotation.y = w[2]
			n.scale = Vector3.ZERO
			add_child(n)
			item_nodes[id] = n
			create_tween().tween_property(n, "scale", Vector3.ONE * 1.35, 0.22).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		else:
			n.position = n.position.lerp(w[1], k)
			n.rotation.y = lerp_angle(n.rotation.y, w[2], k * 0.5)

# ---------------------------------------------------------------- effects
func _on_made(p: Vector2i) -> void:
	var rec = machine_nodes.get(p)
	if rec == null:
		return
	var n: Node3D = rec.node
	n.scale = Vector3(1.12, 0.86, 1.12)
	var c: Dictionary = Game.sim.cells.get(p, {})
	var kind: String = c.get("kind", "")
	var col := Color("e8c393")
	match kind:
		"painter": col = Data.COLORS.get(c.get("color", "red"), Color.WHITE)
		"assembler": col = Color("ffe08a")
		"press", "crate_metal": col = Color("cfd8e0")
		"loom", "crate_cloth": col = Color("ffc2d6")
	if kind.begins_with("crate"):
		var load: Node3D = n.get_node_or_null("load")
		if load:
			load.position.y = 0.66
			create_tween().tween_property(load, "position:y", 0.52, 0.3).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	else:
		burst(cell_pos(p) + Vector3(0, 0.6, 0), col, 12 if kind != "assembler" else 18)
		if _on_screen(cell_pos(p)):
			Sfx.play("saw" if kind in ["saw", "lathe", "press"] else ("pop" if kind == "assembler" else "tap"), -14.0)

func _on_screen(p: Vector3) -> bool:
	return cam.is_position_in_frustum(p)

func _on_sold(cell: Vector2i, coins: int, matched: bool) -> void:
	var at := cell_pos(cell)
	var rec = machine_nodes.get(cell)
	if rec:
		var n: Node3D = rec.node
		for s in [0, 2]:
			var f: Node3D = n.get_node_or_null("flap%d" % s)
			if f:
				var base_rot: float = -35.0 * (s - 1)
				f.rotation_degrees.x = base_rot * 2.2
				create_tween().tween_property(f, "rotation_degrees:x", base_rot, 0.4).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
		n.scale = Vector3(1.15, 0.8, 1.15)
	burst(at + Vector3(0, 0.8, 0), Color("ffd36b"), 16)
	var coin := Meshes.coin()
	coin.position = at + Vector3(0, 0.7, 0)
	add_child(coin)
	var tw := create_tween().set_parallel()
	tw.tween_property(coin, "position:y", 2.0, 0.7).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(coin, "rotation:y", TAU * 2.0, 0.7)
	tw.tween_property(coin, "scale", Vector3.ZERO, 0.25).set_delay(0.55)
	tw.chain().tween_callback(coin.queue_free)
	var l := Label3D.new()
	l.text = "+%d" % coins
	l.font = load("res://fonts/Fredoka.ttf")
	l.font_size = 72
	l.outline_size = 18
	l.modulate = Color("ffd36b") if matched else Color("fff6e8")
	l.outline_modulate = Color("5a3a2a")
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.pixel_size = 0.006
	l.position = at + Vector3(0.3, 1.0, 0)
	add_child(l)
	var tl := create_tween().set_parallel()
	tl.tween_property(l, "position:y", 2.3, 1.1).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tl.tween_property(l, "modulate:a", 0.0, 0.4).set_delay(0.75)
	tl.chain().tween_callback(l.queue_free)
	Sfx.play("coin", -6.0 if matched else -10.0)

func burst(at: Vector3, col: Color, n := 12) -> void:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.amount = n
	p.explosiveness = 0.95
	p.lifetime = 0.7
	var m := Meshes.sphere(0.035)
	p.mesh = m
	var mm := Meshes.mat(col, 0.5, 0.0, 0.0)
	p.material_override = mm
	p.direction = Vector3(0, 1, 0)
	p.spread = 70.0
	p.initial_velocity_min = 1.4
	p.initial_velocity_max = 2.6
	p.gravity = Vector3(0, -7.0, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.3
	var curve := Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(1, 0))
	p.scale_amount_curve = curve
	p.position = at
	add_child(p)
	p.emitting = true
	get_tree().create_timer(1.2).timeout.connect(p.queue_free)

func dust(at: Vector3) -> void:
	burst(at + Vector3(0, 0.1, 0), Color("f3e2c8"), 18)

# ---------------------------------------------------------------- modes (the HUD calls these)
func start_build(kind: String) -> void:
	mode = "build"
	build_kind = kind
	select(null)
	grid_overlay.visible = true
	_make_ghost()
	hint.emit("Drag along the floor to lay belts" if kind == "belt" else "Tap a free spot to place it")

func start_remove() -> void:
	mode = "remove"
	build_kind = ""
	select(null)
	grid_overlay.visible = true
	_make_ghost()
	hint.emit("Tap something to take it away (half the price back)")

func stop_mode() -> void:
	mode = ""
	build_kind = ""
	grid_overlay.visible = false
	tile.visible = false
	_make_ghost()
	hint.emit("")

func rotate_build() -> void:
	build_dir = (build_dir + 1) % 4
	Sfx.play("click")

func _make_ghost() -> void:
	if ghost:
		ghost.queue_free()
		ghost = null
	if mode != "build":
		return
	ghost = Meshes.belt(belt_mat) if build_kind == "belt" else Meshes.machine(build_kind, {"color": "red", "toy": "car"})
	_ghostify(ghost)
	add_child(ghost)
	if hover.x < 0:
		hover = Vector2i(W / 2, H / 2)
	ghost.position = cell_pos(hover)
	ghost.visible = false

func _ghostify(n: Node) -> void:
	for ch in n.get_children():
		if ch is MeshInstance3D:
			var m: Material = ch.material_override
			if m is StandardMaterial3D:
				ch.material_override = Meshes.clear_mat((m as StandardMaterial3D).albedo_color.lightened(0.2), 0.55)
			ch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_ghostify(ch)

func select(p) -> void:
	sel = p
	sel_ring.visible = p != null
	if p != null:
		sel_ring.position = cell_pos(p) + Vector3(0, 0.1, 0)
		var rec = machine_nodes.get(p)
		if rec:
			rec.node.scale = Vector3(1.1, 0.9, 1.1)
	selected.emit(p)

func focus(p: Vector2i) -> void:
	pivot_goal = cell_pos(p) + Vector3(0.6, 0, 0.6)

# ---------------------------------------------------------------- touch
func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP:
			dist_goal = clampf(dist_goal * 0.9, 8.0, 30.0)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			dist_goal = clampf(dist_goal * 1.1, 8.0, 30.0)
	if e is InputEventScreenTouch:
		if e.pressed:
			touches[e.index] = e.position
			if touches.size() == 1:
				drag_start = e.position
				dragging = false
				drawing = false
				last_cell = screen_cell(e.position)
				_hover(last_cell)
				if mode == "build" and build_kind == "belt" and Game.sim.inside(last_cell):
					drawing = true
					_lay_belt(last_cell, build_dir, true)
			elif touches.size() == 2:
				var ps := touches.values()
				pinch_d = ps[0].distance_to(ps[1])
				drawing = false
		else:
			var was_one := touches.size() == 1
			touches.erase(e.index)
			if was_one and not dragging and not drawing:
				_tap(screen_cell(e.position))
			if touches.is_empty():
				drawing = false
	elif e is InputEventScreenDrag:
		touches[e.index] = e.position
		if touches.size() >= 2:
			var ps := touches.values()
			var d: float = ps[0].distance_to(ps[1])
			if pinch_d > 0.0:
				dist_goal = clampf(dist_goal * pinch_d / maxf(d, 1.0), 8.0, 30.0)
			pinch_d = d
			_pan(e.relative * 0.5)
			return
		if drawing:
			var c := screen_cell(e.position)
			if c != last_cell and Game.sim.inside(c):
				var step := c - last_cell
				if absi(step.x) + absi(step.y) == 1:
					var d := Data.DIRS.find(step)
					_lay_belt(last_cell, d, false)
					_lay_belt(c, d, true)
				last_cell = c
				_hover(c)
			return
		if not dragging and e.position.distance_to(drag_start) > 14.0:
			dragging = true
		if dragging:
			_pan(e.relative)
		if mode == "build":
			_hover(screen_cell(e.position))

func _pan(rel: Vector2) -> void:
	var right := cam.global_transform.basis.x
	right.y = 0
	right = right.normalized()
	var fwd := -cam.global_transform.basis.z
	fwd.y = 0
	fwd = fwd.normalized()
	var k := dist * 0.0016 * (1280.0 / maxf(get_viewport().get_visible_rect().size.x, 1.0))
	pivot_goal += (-right * rel.x + fwd * rel.y) * k
	pivot_goal.x = clampf(pivot_goal.x, -W / 2.0, W / 2.0 + 1.0)
	pivot_goal.z = clampf(pivot_goal.z, -H / 2.0, H / 2.0 + 1.0)

func _hover(c: Vector2i) -> void:
	if not Game.sim.inside(c):
		tile.visible = false
		if ghost:
			ghost.visible = false
		return
	hover = c
	if mode == "":
		return
	tile.visible = true
	tile.position = cell_pos(c) + Vector3(0, 0.02, 0)
	var ok := _can_place(c) if mode == "build" else Game.sim.cells.has(c)
	tile.material_override = Meshes.clear_mat(Color("7dffb0") if ok else Color("ff7a7a"), 0.35)
	if ghost:
		ghost.visible = true

func _can_place(c: Vector2i) -> bool:
	if not Game.sim.inside(c):
		return false
	var there = Game.sim.cells.get(c)
	if there == null:
		return true
	return there.kind == "belt" and (build_kind != "belt")

func _lay_belt(c: Vector2i, d: int, new_ok: bool) -> void:
	var there = Game.sim.cells.get(c)
	if there != null:
		if there.kind == "belt" and there.dir != d:
			there.dir = d
			Sfx.play("tap", -8.0)
		return
	if not new_ok:
		return
	if not Game.buy("belt"):
		Sfx.play("error")
		hint.emit("Not enough coins")
		return
	var b := Game.sim.place(c, "belt", d)
	b.item = null
	build_dir = d
	Sfx.play("place", -8.0, 1.3)
	Sfx.buzz(8)

func _tap(c: Vector2i) -> void:
	match mode:
		"build":
			if build_kind == "belt":
				return
			_hover(c)
			if not Game.sim.inside(c):
				return
			if not _can_place(c):
				Sfx.play("error")
				hint.emit("That spot is taken")
				return
			if not Game.buy(build_kind):
				Sfx.play("error")
				hint.emit("Not enough coins")
				return
			var there = Game.sim.cells.get(c)
			if there != null and there.kind == "belt":
				Game.refund("belt")
			var placed := Game.sim.place(c, build_kind, build_dir)
			if placed.has("color"):
				placed.color = "red"
			Sfx.play("place")
			Sfx.buzz(25)
			get_tree().create_timer(0.3).timeout.connect(func(): dust(cell_pos(c)))
		"remove":
			var there = Game.sim.cells.get(c)
			if there == null:
				return
			var back := Game.refund(there.kind)
			Game.sim.remove(c)
			Sfx.play("remove")
			Sfx.buzz(15)
			dust(cell_pos(c))
			hint.emit("+%d coins back" % back)
		_:
			if Game.sim.cells.has(c) and Game.sim.cells[c].kind != "belt":
				Sfx.play("click")
				select(c)
			elif Game.sim.cells.has(c):
				# tapping a belt turns it
				var b: Dictionary = Game.sim.cells[c]
				b.dir = (b.dir + 1) % 4
				Sfx.play("tap")
				select(null)
			else:
				select(null)

# ---------------------------------------------------------------- shaders
const FLOOR_SHADER := """
shader_type spatial;
render_mode diffuse_burley;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void fragment() {
	vec2 p = wp.xz;
	float row = floor(p.y / 0.55);
	float off = hash(vec2(row, 3.0)) * 3.0;
	float col = floor((p.x + off) / 2.6);
	float h = hash(vec2(row, col));
	vec3 c = mix(vec3(0.62, 0.43, 0.30), vec3(0.54, 0.36, 0.25), h);
	float gx = fract((p.x + off) / 2.6);
	float gy = fract(p.y / 0.55);
	float seam = smoothstep(0.0, 0.025, gy) * smoothstep(1.0, 0.975, gy) * smoothstep(0.0, 0.006, gx) * smoothstep(1.0, 0.994, gx);
	float grain = sin((p.x + h * 10.0) * 16.0 + sin(p.y * 26.0 + h * 6.0) * 1.8) * 0.5 + 0.5;
	c *= mix(0.95, 1.04, grain);
	c *= mix(0.7, 1.0, seam);
	ALBEDO = c;
	ROUGHNESS = 0.72;
}
"""

const WALL_SHADER := """
shader_type spatial;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	float u = wp.x + wp.z;
	float stripe = step(0.5, fract(u * 1.6));
	vec3 a = vec3(0.98, 0.90, 0.80);
	vec3 b = vec3(0.96, 0.84, 0.74);
	vec3 c = mix(a, b, stripe);
	vec2 d = fract(vec2(u * 3.2, wp.y * 3.2)) - 0.5;
	c = mix(c, vec3(0.93, 0.70, 0.62), smoothstep(0.09, 0.06, length(d)) * (1.0 - stripe));
	ALBEDO = c;
	ROUGHNESS = 0.9;
}
"""

const BELT_SHADER := """
shader_type spatial;
void fragment() {
	float v = fract(UV.x * 5.0 - TIME * 6.25 + abs(UV.y - 0.5) * 1.2);
	float chev = smoothstep(0.16, 0.1, v);
	float edge = smoothstep(0.0, 0.06, UV.y) * smoothstep(1.0, 0.94, UV.y);
	vec3 c = mix(vec3(0.20, 0.22, 0.26), vec3(0.40, 0.44, 0.50), chev);
	ALBEDO = c * mix(0.6, 1.0, edge);
	ROUGHNESS = 0.85;
}
"""

const GRID_SHADER := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 g = abs(fract(wp.xz) - 0.5);
	float line = smoothstep(0.47, 0.49, max(g.x, g.y));
	ALBEDO = vec3(1.0, 0.95, 0.85);
	ALPHA = line * 0.55 + 0.05;
}
"""

const BLOB_SHADER := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never;
void fragment() {
	float d = length(UV - 0.5) * 2.0;
	ALBEDO = vec3(0.18, 0.10, 0.08);
	ALPHA = smoothstep(1.0, 0.45, d) * 0.35;
}
"""
