extends Node3D
## The toy workshop: a real-looking room (Poly Haven props and textures), the stations, you
## (the toymaker), your apprentices, the camera that follows you, and what the action button does.

signal shipped_toy(text: String, pay: int, tip: int)
signal hint(text: String)

var hud: CanvasLayer
var player: Worker
var cam: Camera3D
var stations := {}             # kind -> Station
var helpers: Array = []        # [Worker, job]
var arrow: Node3D
var pressing := false
var target: Station
var t := 0.0
var zoom := 1.0

# ---------------------------------------------------------------- building the room
func _ready() -> void:
	_lighting()
	_room()
	_stations()
	_decor()
	player = Worker.new().setup(false, "Hair_SimpleParted", Color(0.36, 0.22, 0.13), true)
	player.position = Vector3(0, 0, 1.6)
	player.yaw_goal = PI
	player.speed = 2.6 * (1.2 if Game.owned.has("shoes") else 1.0)
	add_child(player)
	player.footstep.connect(func(): Sfx.play("step", -20.0))
	cam = Camera3D.new()
	cam.fov = 46.0
	cam.near = 0.2
	cam.far = 60.0
	add_child(cam)
	_place_camera(1.0)
	arrow = Node3D.new()
	var cone := Meshes.put(arrow, Meshes.cyl(0.0, 0.16, 0.3, 20), Meshes.glow(Color("ffcf5a"), 1.4), Vector3.ZERO, Vector3(180, 0, 0))
	cone.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(arrow)
	spawn_helpers()

func _lighting() -> void:
	var we := WorldEnvironment.new()
	var env := Environment.new()
	var sky := Sky.new()
	var sm := PanoramaSkyMaterial.new()
	sm.panorama = load("res://assets/hdris/carpentry_shop_02.hdr")
	sm.energy_multiplier = 0.9
	sky.sky_material = sm
	env.sky = sky
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("1b1513")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.55
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.0
	env.glow_enabled = true
	env.glow_intensity = 0.25
	env.glow_hdr_threshold = 1.2
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.05
	env.fog_enabled = false
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.light_color = Color("ffe2bd")
	sun.light_energy = 1.15
	sun.rotation_degrees = Vector3(-48, -28, 0)
	sun.shadow_enabled = true
	sun.shadow_blur = 1.5
	sun.directional_shadow_max_distance = 22.0
	add_child(sun)
	for p in [Vector3(-2.8, 2.3, -3.6), Vector3(0, 2.3, -0.6), Vector3(2.4, 2.3, -3.6)]:
		var o := OmniLight3D.new()
		o.light_color = Color("ffbf80")
		o.light_energy = 1.3
		o.omni_range = 4.5
		o.position = p
		add_child(o)

func _room() -> void:
	var floor_mat := Props.textured("wood_floor_worn", Color(0.68, 0.6, 0.55), 0.45)
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(16, 12)
	fl.mesh = pm
	fl.material_override = floor_mat
	add_child(fl)
	_box(Vector3(0, 0, 0), Vector3(16, 0.02, 12), floor_mat, true, -0.011)
	var wall := Props.textured("plastered_wall_04", Color(0.95, 0.9, 0.84), 0.35)
	var trim := Props.textured("oak_wood_planks", Color(0.75, 0.6, 0.48), 1.0)
	_box(Vector3(0, 2.0, -5.1), Vector3(16, 4.0, 0.2), wall, true)
	_box(Vector3(-7.1, 2.0, 0), Vector3(0.2, 4.0, 12), wall, true)
	_box(Vector3(7.1, 2.0, 0), Vector3(0.2, 4.0, 12), wall, true)
	_box(Vector3(0, 0.45, -4.97), Vector3(16, 0.9, 0.06), Props.textured("white_planks_clean", Color(0.85, 0.78, 0.7), 1.2))
	_box(Vector3(-6.97, 0.45, 0), Vector3(0.06, 0.9, 12), Props.textured("white_planks_clean", Color(0.85, 0.78, 0.7), 1.2))
	_box(Vector3(0, 0.92, -4.93), Vector3(16, 0.06, 0.1), trim)
	_box(Vector3(-6.93, 0.92, 0), Vector3(0.1, 0.06, 12), trim)
	for x in [-4.0, 4.0]:
		_window(Vector3(x, 2.3, -4.99))
	# invisible walls keep you inside
	for b in [[Vector3(0, 1, 5.6), Vector3(16, 2, 0.2)]]:
		var sb := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = b[1]
		cs.shape = bs
		sb.add_child(cs)
		sb.position = b[0]
		add_child(sb)

func _box(pos: Vector3, size: Vector3, m: Material, solid := false, y_off := 0.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = m
	mi.position = pos + Vector3(0, y_off, 0)
	add_child(mi)
	if solid:
		var sb := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		sb.add_child(cs)
		sb.position = pos
		add_child(sb)
	return mi

func _window(pos: Vector3) -> void:
	var frame := Props.textured("white_planks_clean", Color(0.95, 0.93, 0.9), 2.0)
	_box(pos, Vector3(2.0, 1.6, 0.08), frame)
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color("dcefff")
	glass.emission_enabled = true
	glass.emission = Color("cfe6ff")
	glass.emission_energy_multiplier = 1.6
	_box(pos + Vector3(0, 0, 0.03), Vector3(1.8, 1.4, 0.04), glass)
	_box(pos + Vector3(0, 0, 0.06), Vector3(0.05, 1.4, 0.04), frame)
	_box(pos + Vector3(0, 0, 0.06), Vector3(1.8, 0.05, 0.04), frame)
	_box(pos + Vector3(0, -0.82, 0.12), Vector3(2.2, 0.06, 0.24), Props.textured("oak_wood_planks", Color(0.8, 0.65, 0.5)))
	var beam := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.7, 4.5, 0.02)
	beam.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(1.0, 0.9, 0.72, 0.05)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	beam.material_override = m
	beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	beam.position = pos + Vector3(0.6, -1.4, 1.6)
	beam.rotation_degrees = Vector3(-42, -20, 0)
	add_child(beam)

func _solid(n: Node3D, size: Vector3, center_y := -1.0) -> void:
	var sb := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(size.x, maxf(size.y, 0.5), size.z)
	cs.shape = bs
	cs.position.y = bs.size.y / 2.0 if center_y < 0 else center_y
	sb.add_child(cs)
	n.add_child(sb)

func _station(kind: String, pos: Vector3, yaw: float, base: String, width := 0.0) -> Station:
	var s := Station.new().setup(kind)
	s.position = pos
	s.rotation_degrees.y = yaw
	s.level = Game.level
	add_child(s)
	var b := Props.place(s, base, Vector3.ZERO, 0.0, width)
	var size: Vector3 = b.get_meta("size")
	s.surface = b.get_meta("height")
	s.set_meta("size", size)
	_solid(s, size)
	s.face = Vector3(0, 0, 1).rotated(Vector3.UP, deg_to_rad(yaw))
	s.shipped.connect(_on_shipped)
	s.finished.connect(func(k): _on_finished(s, k))
	stations[kind] = s
	return s

func _stations() -> void:
	var logs := _station("logs", Vector3(-5.3, 0, -4.15), 90, "wooden_crate_02")
	for i in 5:
		var l := Props.item({"t": "lumber"})
		l.position = Vector3(-0.15 + (i % 3) * 0.14, logs.surface + 0.002 + int(i / 3) * 0.09, 0.0)
		l.rotation.y = PI / 2 + (i - 2) * 0.05
		logs.add_child(l)
	var saw := _station("saw", Vector3(-2.7, 0, -4.2), 0, "WoodenTable_03")
	saw.slots = [Vector3(-0.35, saw.surface, 0.05), Vector3(0.2, saw.surface, 0.12), Vector3(0.38, saw.surface, 0.12), Vector3(0.29, saw.surface, -0.08)]
	var hs := Props.place(saw, "handsaw_wood", Vector3(-0.28, saw.surface + 0.12, -0.12), 90)
	hs.rotation_degrees.z = 70
	saw.tool = hs
	saw.tool_rest = hs.transform
	Props.place(saw, "measuring_tape_01", Vector3(0.5, saw.surface, -0.18), 30)
	var lathe := _station("lathe", Vector3(0.0, 0, -4.15), 0, "wooden_table_02")
	var dp := Props.place(lathe, "drill_press_01", Vector3(-0.3, lathe.surface, -0.12), 0)
	lathe.tool = dp
	lathe.tool_rest = dp.transform
	lathe.slots = [Vector3(0.12, lathe.surface, 0.12), Vector3(0.3, lathe.surface, 0.12), Vector3(0.3, lathe.surface, -0.08), Vector3(0.45, lathe.surface, 0.05)]
	var paint := _station("paint", Vector3(2.6, 0, -4.1), 0, "tool_cart")
	paint.slots = [Vector3(-0.15, paint.surface, 0.1), Vector3(0.15, paint.surface, 0.1), Vector3(0.0, paint.surface, -0.12)]
	var sp := Props.place(paint, "spray_paint_bottles", Vector3(0.42, paint.surface, -0.15), 10)
	paint.tool = sp
	paint.tool_rest = sp.transform
	var can := Meshes.put(paint, Meshes.cyl(0.08, 0.08, 0.16, 24), Props.plain(Data.COLORS["red"], 0.35), Vector3(-0.45, paint.surface + 0.08, -0.15))
	can.name = "can"
	Meshes.put(paint, Meshes.cyl(0.082, 0.082, 0.02, 24), Props.plain(Color("b7bcc0"), 0.3, 0.8), Vector3(-0.45, paint.surface + 0.165, -0.15))
	var bench := _station("bench", Vector3(0.0, 0, -0.8), 0, "WoodenTable_03", 1.9)
	bench.slots = [Vector3(-0.42, bench.surface, 0.08), Vector3(-0.14, bench.surface, 0.1), Vector3(0.14, bench.surface, 0.1), Vector3(0.42, bench.surface, 0.08)]
	Props.place(bench, "bench_vice_01", Vector3(-0.8, bench.surface, -0.2), 0)
	var hm := Props.place(bench, "wooden_hammer_01", Vector3(0.65, bench.surface + 0.02, -0.18), 80)
	hm.rotation_degrees.z = 90
	bench.tool = hm
	bench.tool_rest = hm.transform
	Props.place(bench, "hand_plane_no4", Vector3(0.0, bench.surface, -0.2), 15)
	var ship := _station("ship", Vector3(5.2, 0, -1.2), -90, "cardboard_box_01", 0.85)
	Props.place(self, "hand_truck", Vector3(5.9, 0, -2.4), -60)
	var bin := _station("bin", Vector3(4.6, 0, 1.8), -90, "wicker_basket_01", 0.7)
	bin.reach = 1.1
	ship.reach = 1.5
	_set_paint("red")

func _decor() -> void:
	var b := Props.place(self, "wooden_bookshelf_worn", Vector3(-6.65, 0, -0.3), 90)
	_solid(b, b.get_meta("size"))
	var shelf := Props.place(self, "wooden_display_shelves_01", Vector3(6.75, 0, 1.6), -90)
	_solid(shelf, shelf.get_meta("size"))
	var toys := [["car", "red"], ["top", "blue"], ["plane", "yellow"], ["train", "green"], ["car", "wood"], ["top", "pink"]]
	for i in toys.size():
		var it := Props.item({"t": toys[i][0], "c": toys[i][1]})
		it.position = Vector3(6.75, 0.18 + (i % 3) * 0.47, 1.25 + int(i / 3) * 0.55)
		it.rotation_degrees.y = -90 + (i * 23) % 40
		it.scale = Vector3.ONE * 1.15
		add_child(it)
	Props.place(self, "rubber_duck_toy", Vector3(6.75, 1.58, 1.4), -120, 0.18)
	Props.place(self, "carved_wooden_elephant", Vector3(6.75, 1.58, 1.9), -90, 0.2)
	var tc := Props.place(self, "metal_tool_chest", Vector3(-6.55, 0, -3.3), 90)
	_solid(tc, tc.get_meta("size"))
	Props.place(self, "metal_toolbox", Vector3(-6.55, tc.get_meta("height"), -3.3), 80)
	var p1 := Props.place(self, "potted_plant_01", Vector3(6.4, 0, -4.4), 0)
	_solid(p1, Vector3(0.5, 1, 0.5))
	var p2 := Props.place(self, "potted_plant_02", Vector3(-6.3, 0, 3.9), 0)
	_solid(p2, Vector3(0.6, 1, 0.6))
	var sw := Props.place(self, "spinning_wheel_01", Vector3(-5.6, 0, 2.2), 60)
	_solid(sw, Vector3(0.6, 1, 0.8))
	Props.place(self, "wooden_stool_01", Vector3(1.4, 0, 0.2), 20)
	Props.place(self, "wooden_crate_01", Vector3(5.9, 0, -4.4), 10)
	Props.place(self, "wall_clock", Vector3(0, 2.8, -4.97), 0)
	var sh := Props.place(self, "Shelf_01", Vector3(-6.85, 0, 2.6 - 4.5), 90)
	sh.position = Vector3(-6.85, 0, -1.9)
	for p in [Vector3(-2.7, 2.9, -4.3), Vector3(2.5, 2.9, -4.3)]:
		Props.place(self, "hanging_industrial_lamp", p, 0)

func _set_paint(c: String) -> void:
	var s: Station = stations.paint
	s.color = c
	var can: MeshInstance3D = s.get_node("can")
	can.material_override = Props.plain(Data.COLORS[c], 0.35)

func spawn_helpers() -> void:
	for h in helpers:
		h[0].queue_free()
	helpers.clear()
	var looks := {"sawyer": [true, "Hair_Buns", Color(0.25, 0.15, 0.1), Vector3(-3.5, 0, -2.8)],
		"turner": [false, "Hair_SimpleParted", Color(0.75, 0.62, 0.4), Vector3(0.8, 0, -2.8)],
		"painter": [true, "Hair_Buns", Color(0.6, 0.2, 0.12), Vector3(3.2, 0, -2.6)]}
	for job in ["sawyer", "turner", "painter"]:
		if Game.owned.has(job):
			var l: Array = looks[job]
			var w := Worker.new().setup(l[0], l[1], l[2], false)
			w.position = l[3]
			w.speed = 2.0
			add_child(w)
			helpers.append([w, job, 0.0])

# ---------------------------------------------------------------- every frame
func _place_camera(k: float) -> void:
	var focus := player.global_position + Vector3(0, 0.5, -0.6)
	focus.x = clampf(focus.x, -3.6, 3.6)
	focus.z = clampf(focus.z, -2.8, 1.8)
	var goal := focus + Vector3(0, 5.0, 5.4) * zoom
	cam.position = cam.position.lerp(goal, k)
	cam.look_at(cam.position + (focus - goal).normalized(), Vector3.UP)

func _process(dt: float) -> void:
	t += dt
	_place_camera(1.0 - exp(-dt * 6.0))
	for s in stations.values():
		s.level = Game.level
	# you move with the joystick (or keys)
	var v: Vector2 = hud.joy if hud else Vector2.ZERO
	var kb := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	if kb.length() > v.length():
		v = kb
	player.move_dir = Vector3(v.x, 0, v.y)
	if player.working_at and v.length() > 0.3:
		player.working_at = null
	target = _nearest(player)
	if pressing and player.working_at:
		var s := player.working_at
		if s.job() == "" or s != target:
			player.working_at = null
		else:
			s.do_work(dt, Game.work_speed())
	_helpers(dt)
	_arrow(dt)

func _nearest(w: Worker) -> Station:
	var best: Station = null
	var bd := 9.0
	var fwd := Vector3(sin(w.rotation.y), 0, cos(w.rotation.y))
	for s in stations.values():
		var to: Vector3 = s.global_position - w.global_position
		to.y = 0
		var size: Vector3 = s.get_meta("size")
		var d := maxf(0.0, to.length() - maxf(size.x, size.z) * 0.45)
		if d > s.reach:
			continue
		d -= fwd.dot(to.normalized()) * 0.4
		if d < bd:
			bd = d
			best = s
	return best

## what pressing the button does right now (for the button's label)
func action_label() -> String:
	var s := target
	if s == null:
		return ""
	var c := player.carry
	if not c.is_empty():
		if s.can_put(c):
			match s.kind:
				"ship": return "Ship it!"
				"bin": return "Throw away"
				"logs": return "Put back"
			return "Put down"
		return ""
	if s.kind == "bench" and s.job() != "":
		return "Hold: Assemble"
	if s.can_take() and (s.kind in ["logs", "bench", "paint"] or s.peek().t != "lumber"):
		if s.kind == "paint" and s.job() != "":
			return "Hold: Paint"
		return "Take " + Data.item_name(s.peek())
	if s.job() != "":
		return "Hold: " + s.job()
	return ""

func press() -> void:
	pressing = true
	var s := target
	if s == null:
		return
	player.face(s.global_position)
	var c := player.carry
	if not c.is_empty():
		if s.can_put(c):
			var it := player.drop()
			s.put(it)
			Sfx.play("place" if s.kind != "bin" else "remove", -6.0)
			Sfx.buzz(12)
			if s.kind == "bin":
				_burst(s.global_position + Vector3(0, 0.4, 0), Color("c9a27a"))
			if s.job() != "" and s.kind in ["saw", "lathe", "paint"]:
				player.working_at = s
		else:
			Sfx.play("error", -8.0)
			hint.emit(_why_not(s, c))
		return
	var label := action_label()
	if label.begins_with("Hold"):
		player.working_at = s
		return
	if s.can_take():
		player.hold(s.take())
		Sfx.play("pop", -6.0)
		Sfx.buzz(10)

func release() -> void:
	pressing = false
	player.working_at = null

func _why_not(s: Station, c: Dictionary) -> String:
	match s.kind:
		"saw", "lathe":
			return "Only lumber goes on the %s." % ("saw" if s.kind == "saw" else "drill press") if c.t != "lumber" else "Finish the piece that's there first."
		"paint":
			return "Paint blocks, wheels and pegs here."
		"bench":
			return "The bench is full." if s.items.size() >= 4 else "Cut lumber into parts first."
		"ship":
			return "Only finished toys go in the shipping box."
		"logs":
			return "Your hands are full."
	return ""

func _on_finished(s: Station, kind: String) -> void:
	Sfx.play({"saw": "saw", "lathe": "saw", "paint": "whoosh", "bench": "ding"}[kind], -6.0)
	_burst(s.global_position + Vector3(0, s.surface + 0.15, 0), Color("f0d2a8") if kind != "paint" else Data.COLORS[s.color], 16)
	if s == player.working_at:
		player.working_at = null
		Sfx.buzz(25)

func _on_shipped(it: Dictionary) -> void:
	var s: Station = stations.ship
	var o := Game.ship(it)
	_burst(s.global_position + Vector3(0, 0.6, 0), Color("ffd36b"), 24)
	if o.is_empty():
		shipped_toy.emit("Nobody ordered that, sold it cheap", 0, 0)
		Sfx.play("coin", -10.0)
	else:
		Sfx.play("coin", -4.0)
		Sfx.play("ding", -8.0)

func _burst(at: Vector3, col: Color, n := 12) -> void:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.amount = n
	p.explosiveness = 0.95
	p.lifetime = 0.8
	p.mesh = Meshes.sphere(0.02)
	p.material_override = Props.plain(col, 0.6)
	p.direction = Vector3(0, 1, 0)
	p.spread = 60.0
	p.initial_velocity_min = 1.2
	p.initial_velocity_max = 2.4
	p.gravity = Vector3(0, -6.0, 0)
	var curve := Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(1, 0))
	p.scale_amount_curve = curve
	p.position = at
	add_child(p)
	p.emitting = true
	get_tree().create_timer(1.3).timeout.connect(p.queue_free)

# ---------------------------------------------------------------- the guide arrow
## which station you'd want to go to next, to make the most urgent order
func suggestion() -> Station:
	if not Game.playing or Game.orders.is_empty():
		return null
	var o: Dictionary = Game.orders[0]
	for oo in Game.orders:
		if oo.left < o.left:
			o = oo
	var need: Dictionary = Data.TOYS[o.toy].needs
	var bench: Station = stations.bench
	var c := player.carry
	if not c.is_empty():
		if Data.TOYS.has(c.t):
			return stations.ship
		if c.t == "lumber":
			return stations.saw if _missing(bench, need).has("block") else stations.lathe
		if c.t == Data.TOYS[o.toy].body and o.c != "wood" and c.get("c", "wood") != o.c:
			return stations.paint
		return bench
	if bench.items.size() == 1 and Data.TOYS.has(bench.items[0].t):
		return bench
	if bench.job() != "":
		return bench
	var miss := _missing(bench, need)
	if miss.is_empty():
		return null
	var p: Station = stations.paint
	if not p.items.is_empty() and p.job() == "":
		return p
	for k in miss:
		var src: Station = stations.saw if k == "block" else stations.lathe
		if src.items.any(func(i): return i.t == k):
			return src
	var first: String = miss[0]
	var src2: Station = stations.saw if first == "block" else stations.lathe
	if src2.job() != "":
		return src2
	return stations.logs

func _missing(bench: Station, need: Dictionary) -> Array:
	var out := []
	for k in need:
		var have := bench.items.filter(func(i): return i.t == k).size()
		for i in maxi(0, need[k] - have):
			out.append(k)
	return out

func _arrow(dt: float) -> void:
	var s := suggestion()
	arrow.visible = s != null and Game.day <= 3
	if s:
		var goal: Vector3 = s.global_position + Vector3(0, s.surface + 0.75 + sin(t * 4.0) * 0.08, 0)
		arrow.position = arrow.position.lerp(goal, 1.0 - exp(-dt * 10.0)) if arrow.position.distance_to(goal) < 6 else goal
		arrow.rotation.y += dt * 2.0

# ---------------------------------------------------------------- apprentices
func _helpers(dt: float) -> void:
	for h in helpers:
		var w: Worker = h[0]
		match h[1]:
			"sawyer": _feeder(w, stations.saw)
			"turner": _feeder(w, stations.lathe)
			"painter": _painter(w)

func _go(w: Worker, s: Station) -> bool:
	var spot: Vector3 = s.global_position + s.face * (s.get_meta("size").z * 0.5 + 0.45)
	var d := spot - w.global_position
	d.y = 0
	if d.length() < 0.3:
		w.move_dir = Vector3.ZERO
		w.face(s.global_position)
		return true
	w.move_dir = d.normalized()
	return false

func _feeder(w: Worker, dst: Station) -> void:
	if w.working_at:
		if dst.job() == "" or not Game.playing:
			w.working_at = null
		else:
			dst.do_work(get_process_delta_time(), 0.8)
		return
	if not Game.playing:
		w.move_dir = Vector3.ZERO
		return
	if w.carry.is_empty():
		if dst.job() != "":
			if _go(w, dst):
				w.working_at = dst
		elif dst.items.size() >= 3:
			_go(w, dst)
		elif _go(w, stations.logs):
			w.hold(stations.logs.take())
	elif _go(w, dst):
		if dst.can_put(w.carry):
			dst.put(w.drop())

func _painter(w: Worker) -> void:
	var p: Station = stations.paint
	var saw: Station = stations.saw
	if w.working_at:
		if p.job() == "" or not Game.playing:
			w.working_at = null
		else:
			p.do_work(get_process_delta_time(), 0.8)
		return
	if not Game.playing:
		w.move_dir = Vector3.ZERO
		return
	if w.carry.is_empty():
		if p.job() != "":
			if _go(w, p):
				w.working_at = p
		elif p.items.size() < 2 and saw.items.any(func(i): return i.t == "block" and i.c == "wood"):
			if _go(w, saw):
				for i in saw.items:
					if i.t == "block" and i.c == "wood":
						saw.items.erase(i)
						saw._refresh()
						w.hold(i)
						break
		else:
			_go(w, p)
	elif _go(w, p):
		if p.can_put(w.carry):
			p.put(w.drop())

func set_paint(c: String) -> void:
	_set_paint(c)
	Sfx.play("pop")

func set_lathe(m: String) -> void:
	stations.lathe.mode = m
	Sfx.play("click")
