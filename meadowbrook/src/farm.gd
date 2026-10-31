extends Node3D
## Meadowbrook farm: realistic ground, sky and nature (Poly Haven), soil plots in fields, the
## water barrel, shipping crate, seed stand, trees, the day/night cycle, you and your farmhand.

signal hint(text: String)
signal popped(text: String, col: Color)

var hud: CanvasLayer
var player: Worker
var cam: Camera3D
var sun: DirectionalLight3D
var env: Environment
var sky_mat: PanoramaSkyMaterial
var lamps: Array = []
var spots: Array = []
var plots: Array = []
var target: Spot
var pressing := false
var work_key := ""
var work_t := 0.0
var helper: Worker
var helper_job := {}
var t := 0.0
var zoom := 1.0

const FIELD_POS := [Vector3(-2.6, 0, 0.4), Vector3(1.8, 0, 0.4), Vector3(-2.6, 0, 4.6), Vector3(1.8, 0, 4.6)]
const GAP := 1.25

func _ready() -> void:
	_sky()
	_ground()
	_places()
	_nature()
	_fields()
	player = Worker.new().setup(false, "Hair_SimpleParted", Color(0.36, 0.22, 0.13), true)
	player.position = Vector3(0, 0, -2.0)
	player.yaw_goal = PI
	add_child(player)
	player.footstep.connect(func(): Sfx.play("step", -22.0))
	cam = Camera3D.new()
	cam.fov = 46.0
	cam.far = 200.0
	add_child(cam)
	_place_camera(1.0)
	spawn_helper()
	Game.new_day.connect(func(d): popped.emit("Day %d" % d, Color("ffe7a8")))

# ---------------------------------------------------------------- world
func _sky() -> void:
	var we := WorldEnvironment.new()
	env = Environment.new()
	var sky := Sky.new()
	sky_mat = PanoramaSkyMaterial.new()
	sky_mat.panorama = load("res://assets/hdris/belfast_farmhouse.hdr")
	sky.sky_material = sky_mat
	env.sky = sky
	env.background_mode = Environment.BG_SKY
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.8
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.0
	env.glow_enabled = true
	env.glow_intensity = 0.2
	env.fog_enabled = true
	env.fog_light_color = Color("c9d6e0")
	env.fog_density = 0.006
	env.fog_sky_affect = 0.0
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.light_color = Color("fff1dc")
	sun.shadow_enabled = true
	sun.shadow_blur = 1.2
	sun.directional_shadow_max_distance = 30.0
	add_child(sun)

func _ground() -> void:
	var g := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(90, 90)
	g.mesh = pm
	g.material_override = Props.textured("leafy_grass", Color(0.78, 0.98, 0.66), 0.35)
	add_child(g)
	# dirt paths
	var path := Props.textured("grass_path_2", Color(0.95, 0.92, 0.88), 0.5)
	for b in [[Vector3(0, 0.005, -2.3), Vector3(16, 0.01, 1.6)], [Vector3(-0.4, 0.006, 2.6), Vector3(1.4, 0.01, 9.5)]]:
		var m := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = b[1]
		m.mesh = bm
		m.material_override = path
		m.position = b[0]
		add_child(m)
	# a fence of invisible walls keeps you on the farm
	for w in [[Vector3(0, 1, -11), Vector3(30, 2, 0.4)], [Vector3(0, 1, 11), Vector3(30, 2, 0.4)], [Vector3(-12, 1, 0), Vector3(0.4, 2, 24)], [Vector3(12, 1, 0), Vector3(0.4, 2, 24)]]:
		_wall(w[0], w[1])

func _wall(pos: Vector3, size: Vector3) -> void:
	var sb := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	sb.add_child(cs)
	sb.position = pos
	add_child(sb)

func _solid(n: Node3D, size: Vector3) -> void:
	_wall(n.position + Vector3(0, 0.5, 0), Vector3(maxf(size.x, 0.3), 1.0, maxf(size.z, 0.3)))

func _spot(kind: String, pos: Vector3, reach := 1.2) -> Spot:
	var s := Spot.new().setup(kind)
	s.position = pos
	s.reach = reach
	add_child(s)
	spots.append(s)
	return s

func _places() -> void:
	var well := _spot("well", Vector3(-6.4, 0, -1.6), 1.0)
	var b := Props.place(well, "wooden_barrels_01", Vector3.ZERO, 30)
	_solid(well, b.get_meta("size") * 0.8)
	Props.place(self, "wooden_bucket_01", Vector3(-5.6, 0, -0.9), 0)
	Props.place(self, "watering_can_metal_01", Vector3(-5.7, 0, -2.4), 60)
	var crate := _spot("crate", Vector3(6.4, 0, -1.6), 1.2)
	var c := Props.place(crate, "wooden_crate_02", Vector3.ZERO, 90)
	_solid(crate, Vector3(1.1, 1, 0.6))
	crate.set_meta("top", c.get_meta("height"))
	Props.place(self, "wicker_basket_01", Vector3(7.3, 0, -0.8), 20)
	var stand := _spot("stand", Vector3(-0.4, 0, -4.4), 1.3)
	var t := Props.place(stand, "wooden_table_02", Vector3.ZERO, 0)
	_solid(stand, t.get_meta("size"))
	var top: float = t.get_meta("height")
	Props.place(stand, "seeding_tray_01", Vector3(-0.3, top, 0.05), 10)
	Props.place(stand, "planter_box_01", Vector3(0.32, top, 0.0), -8, 0.42)
	Props.place(stand, "rusted_spade_01", Vector3(0.65, 0, 0.45), 30)
	for i in 4:
		var p := Props.produce(["onion", "potato", "onion", "potato"][i])
		p.position = Vector3(-0.42 + i * 0.12, top + 0.05, 0.25)
		stand.add_child(p)
	# fruit trees and trees for wood
	for f in [["apple", Vector3(-7.2, 0, -6.2)], ["apple", Vector3(-4.0, 0, -7.4)], ["pear", Vector3(6.8, 0, -6.6)]]:
		var s := _spot("fruit", f[1], 1.5)
		s.fruit = f[0]
		var tree := Props.place(s, "tree_small_02", Vector3.ZERO, randf() * 360.0)
		_solid(s, Vector3(0.5, 1, 0.5))
		s.visual = tree
		var hold := Node3D.new()
		hold.name = "fruit"
		s.add_child(hold)
		var h: float = tree.get_meta("height")
		for i in 6:
			var a := i * 1.05
			var p := Props.produce(f[0])
			p.position = Vector3(cos(a) * 0.55, h * 0.55 + (i % 3) * 0.25, sin(a) * 0.55)
			hold.add_child(p)
		s.changed_state.connect(func(): hold.visible = s.cooldown <= 0.0)
	for p in [Vector3(-9.5, 0, -3.5), Vector3(9.4, 0, 2.4), Vector3(-9.2, 0, 6.5), Vector3(4.6, 0, -8.6)]:
		var s := _spot("tree", p, 1.6)
		var tree := Props.place(s, "island_tree_01" if int(p.x) % 2 == 0 else "island_tree_02", Vector3.ZERO, randf() * 360.0, 3.2)
		s.visual = tree
		var stump := Props.place(s, "tree_stump_01", Vector3.ZERO, 0, 0.7)
		stump.name = "stump"
		stump.visible = false
		_solid(s, Vector3(0.6, 1, 0.6))
		s.changed_state.connect(func():
			stump.visible = s.cooldown > 0.0
			tree.visible = s.cooldown <= 0.0
			if tree.visible:
				tree.scale = Vector3.ONE * 0.2
				create_tween().tween_property(tree, "scale", Vector3.ONE, 1.2).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT))
	# a cosy corner: picnic table, bench, fire pit, lamps, gnome
	var pt := Props.place(self, "wooden_picnic_table", Vector3(7.0, 0, 4.2), -15)
	_solid(pt, pt.get_meta("size") * 0.8)
	Props.place(self, "painted_wooden_bench", Vector3(-7.4, 0, 2.6), 90)
	Props.place(self, "stone_fire_pit", Vector3(-6.6, 0, 5.4), 0)
	Props.place(self, "garden_gnome", Vector3(-4.6, 0, -1.1), 160, 0.3)
	Props.place(self, "compost_bags", Vector3(4.2, 0, -3.9), 20)
	Props.place(self, "wine_barrel_01", Vector3(7.6, 0, -2.8), 0)
	Props.place(self, "wooden_ladder", Vector3(-8.4, 0, -6.4), 30)
	for p in [Vector3(-1.6, 0, -3.3), Vector3(3.6, 0, -3.3)]:
		var lamp := Props.place(self, "street_lamp_02", p, 0, 0.6)
		var o := OmniLight3D.new()
		o.light_color = Color("ffc27a")
		o.omni_range = 7.0
		o.position = p + Vector3(0, lamp.get_meta("height") - 0.3, 0)
		add_child(o)
		lamps.append(o)

func _nature() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var kinds := ["shrub_01", "shrub_02", "shrub_03", "shrub_04", "grass_medium_01", "grass_medium_02", "grass_bermuda_01", "fern_02",
		"flower_gazania", "flower_ursinia", "dandelion_01", "celandine_01", "boulder_01", "rock_moss_set_01", "stone_01"]
	for i in 120:
		var a := rng.randf() * TAU
		var r := rng.randf_range(9.5, 22.0)
		var p := Vector3(cos(a) * r, 0, sin(a) * r * 0.9)
		var k: String = kinds[rng.randi() % kinds.size()]
		Props.place(self, k, p, rng.randf() * 360.0)
	for i in 70:
		var p := Vector3(rng.randf_range(-9, 9), 0, rng.randf_range(-9, 9))
		if absf(p.z + 2.3) < 1.2 or (p.x > -5.5 and p.x < 5.5 and p.z > -1.5 and p.z < 9.0) or p.distance_to(Vector3(-0.4, 0, -4.4)) < 1.5:
			continue
		var k2: String = ["grass_medium_01", "grass_medium_02", "dandelion_01", "celandine_01", "grass_bermuda_01"][rng.randi() % 5]
		Props.place(self, k2, p, rng.randf() * 360.0)
	for p in [Vector3(-14, 0, -9), Vector3(14, 0, -8), Vector3(-15, 0, 9), Vector3(13, 0, 10), Vector3(0, 0, -15), Vector3(-6, 0, -14), Vector3(8, 0, -14)]:
		Props.place(self, ["island_tree_01", "island_tree_02"][int(absf(p.x)) % 2], p, rng.randf() * 360.0, rng.randf_range(3.5, 5.0))

# ---------------------------------------------------------------- fields and plots
func _fields() -> void:
	for f in Data.FIELDS.size():
		if f < Game.fields:
			_make_field(f)
	if Game.fields < Data.FIELDS.size():
		_sign(Game.fields)

func _sign(f: int) -> void:
	var s := _spot("sign", FIELD_POS[f] + Vector3(GAP, 0, GAP), 1.6)
	s.field = f
	Meshes.put(s, Meshes.rbox(Vector3(0.1, 1.0, 0.1), 0.02), Props.textured("weathered_planks", Color.WHITE, 2.0), Vector3(0, 0.5, 0))
	Meshes.put(s, Meshes.rbox(Vector3(0.8, 0.45, 0.06), 0.02), Props.textured("weathered_planks", Color(1, 0.95, 0.9), 2.0), Vector3(0, 1.0, 0.06))
	var l := Label3D.new()
	l.text = "FOR SALE"
	l.font = load("res://fonts/Fredoka.ttf")
	l.font_size = 64
	l.pixel_size = 0.004
	l.modulate = Color("5a3a24")
	l.outline_size = 0
	l.position = Vector3(0, 1.0, 0.1)
	s.add_child(l)

func _make_field(f: int) -> void:
	for gz in 3:
		for gx in 3:
			var p := _spot("plot", FIELD_POS[f] + Vector3(gx * GAP, 0, gz * GAP), 0.9)
			p.index = plots.size()
			if p.index < Game.plots.size():
				p.restore(Game.plots[p.index])
			plots.append(p)
			p.changed_state.connect(func(): _plot_visual(p))
			_plot_visual(p)

func open_field(sign: Spot) -> void:
	if not Game.open_field():
		popped.emit("Need %d coins and %d wood" % [Data.FIELDS[sign.field].cost, Data.FIELDS[sign.field].wood], Color("ffb2a0"))
		Sfx.play("error")
		return
	spots.erase(sign)
	sign.queue_free()
	_make_field(sign.field)
	if Game.fields < Data.FIELDS.size():
		_sign(Game.fields)
	Sfx.play("levelup")
	popped.emit("New field!", Color("b8f0a8"))

func _plot_visual(p: Spot) -> void:
	if p.visual:
		p.visual.queue_free()
	var v := Node3D.new()
	p.add_child(v)
	p.visual = v
	if p.state == "grass":
		for z in [-0.3, 0.1]:
			Props.place(v, "grass_medium_01", Vector3(0, 0, z), 0.0, 1.0)
		var mark := Meshes.put(v, Meshes.rbox(Vector3(1.08, 0.015, 1.08), 0.04), Props.textured("grass_ground", Color(0.9, 0.95, 0.85), 1.0), Vector3(0, 0.008, 0))
		mark.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		Game.plots.resize(maxi(Game.plots.size(), plots.size()))
		_save_plot(p)
		return
	var soil := Props.textured("farm_soil", Color(0.55, 0.45, 0.4) if p.wet else Color(0.95, 0.85, 0.75), 1.4)
	Meshes.put(v, Meshes.rbox(Vector3(1.1, 0.1, 1.1), 0.04), soil, Vector3(0, 0.03, 0))
	for z in [-0.3, 0.0, 0.3]:
		Meshes.put(v, Meshes.rbox(Vector3(0.95, 0.07, 0.16), 0.05), soil, Vector3(0, 0.1, z))
	if p.state in ["planted", "ripe"]:
		var c: Dictionary = Data.CROPS[p.crop]
		var plants := Node3D.new()
		plants.name = "plants"
		v.add_child(plants)
		for z in [-0.3, 0.0, 0.3]:
			var row := Props.place(plants, c.plant, Vector3(0, 0.12, z), 0.0 if int(z * 10) % 2 == 0 else 180.0, 0.98)
			if p.crop == "ursinia":
				row.scale.y = 2.2
		plants.scale = Vector3.ONE * (0.25 + 0.75 * p.growth)
		if p.state == "ripe" and not p.crop in ["gazania", "ursinia"]:
			for i in 3:
				var pr := Props.produce(p.crop)
				pr.position = Vector3(-0.3 + i * 0.3, 0.11, 0.42)
				v.add_child(pr)
		if p.state == "ripe":
			var sp := Meshes.put(v, Meshes.sphere(0.06), Meshes.glow(Color("ffe08a"), 2.5), Vector3(0, 0.9, 0))
			sp.name = "ripe"
			sp.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	v.scale = Vector3(1.0, 0.6, 1.0)
	create_tween().tween_property(v, "scale", Vector3.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_save_plot(p)

func _save_plot(p: Spot) -> void:
	if Game.plots.size() < plots.size():
		Game.plots.resize(plots.size())
	Game.plots[p.index] = p.save()

# ---------------------------------------------------------------- every frame
func _place_camera(k: float) -> void:
	var focus := player.global_position + Vector3(0, 0.6, -0.4)
	focus.x = clampf(focus.x, -7.0, 7.0)
	focus.z = clampf(focus.z, -7.0, 7.0)
	var goal := focus + Vector3(0, 6.0, 6.4) * zoom
	cam.position = cam.position.lerp(goal, k)
	cam.look_at(cam.position + (focus - goal).normalized(), Vector3.UP)

func _process(dt: float) -> void:
	t += dt
	_place_camera(1.0 - exp(-dt * 6.0))
	_daylight()
	for s in spots:
		s.tick(dt, Game)
		if s.kind == "plot" and s.state == "planted" and s.visual:
			var pl: Node3D = s.visual.get_node_or_null("plants")
			if pl:
				pl.scale = pl.scale.lerp(Vector3.ONE * (0.25 + 0.75 * s.growth), dt * 3.0)
		if s.kind == "plot" and s.state == "ripe" and s.visual:
			var r: Node3D = s.visual.get_node_or_null("ripe")
			if r:
				r.position.y = 0.9 + sin(t * 4.0 + s.index) * 0.06
		if s.shake > 0.0:
			s.shake -= dt
			if s.visual:
				s.visual.rotation.z = sin(t * 40.0) * 0.03 * s.shake
	var v: Vector2 = hud.joy if hud else Vector2.ZERO
	var kb := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	if kb.length() > v.length():
		v = kb
	player.move_dir = Vector3(v.x, 0, v.y)
	player.speed = 2.7 * (1.2 if Game.owned.has("boots") else 1.0)
	if player.working_at and v.length() > 0.3:
		_stop()
	target = _nearest(player.global_position, player.rotation.y)
	if pressing and player.working_at:
		_work(player, dt)
	_helper(dt)

func _daylight() -> void:
	var c := Game.clock
	var day := clampf(sin((c - 0.2) / 0.6 * PI), 0.0, 1.0) if c > 0.2 and c < 0.8 else 0.0
	sun.rotation_degrees = Vector3(-15.0 - 55.0 * day, -40.0 + (c - 0.5) * 140.0, 0)
	sun.light_energy = 0.15 + 1.25 * day
	sun.light_color = Color("ffb27a").lerp(Color("fff3e0"), day)
	sky_mat.energy_multiplier = 0.2 + 0.8 * day
	env.ambient_light_energy = 0.3 + 0.6 * day
	for l in lamps:
		l.light_energy = lerpf(l.light_energy, 2.2 if day < 0.25 else 0.0, 0.05)

func _nearest(pos: Vector3, yaw: float) -> Spot:
	var best: Spot = null
	var bd := 9.0
	var fwd := Vector3(sin(yaw), 0, cos(yaw))
	for s in spots:
		var to: Vector3 = s.global_position - pos
		to.y = 0
		var d := to.length()
		if d > s.reach:
			continue
		d -= fwd.dot(to.normalized()) * 0.35
		if d < bd:
			bd = d
			best = s
	return best

func action_info() -> Dictionary:
	if target == null:
		return {}
	return target.action(player.carry, Game)

func press() -> void:
	pressing = true
	var s := target
	if s == null:
		return
	player.face(s.global_position)
	var a := s.action(player.carry, Game)
	if a.get("bad", false):
		Sfx.play("error", -10.0)
		hint.emit(a.label)
		return
	match a.get("tap", ""):
		"sell":
			var it := player.drop()
			var pay := Game.sell(it.t, it.n)
			popped.emit("+%d" % pay, Color("ffd36b"))
			Sfx.play("coin")
			Sfx.buzz(20)
			return
		"buy":
			if Game.buy_seeds(Game.seed):
				Sfx.play("pop")
				popped.emit("+3 %s seeds" % Data.CROPS[Game.seed].name.to_lower(), Color("d9f5c0"))
			else:
				Sfx.play("error")
				hint.emit("Not enough coins")
			return
		"field":
			open_field(s)
			return
	if a.work != "":
		_start(player, s, a.work)

func release() -> void:
	pressing = false
	_stop()

func _start(w: Worker, s: Spot, key: String) -> void:
	w.working_at = s
	w.work_anim = Worker.WORK_ANIM.get(key, "Interact")
	w.set_meta("work", key)
	w.set_meta("t", 0.0)
	w.face(s.global_position)

func _stop() -> void:
	player.working_at = null

## work for dt; returns true when the job finished
func _work(w: Worker, dt: float) -> bool:
	var s: Spot = w.working_at
	var key: String = w.get_meta("work")
	var a := s.action(w.carry, Game)
	if a.work != key:
		w.working_at = null
		return false
	var speed := 2.0 if key == "chop" and Game.owned.has("axe") else 1.0
	var k: float = w.get_meta("t") + dt * speed / Data.WORK[key]
	w.set_meta("t", k)
	if key == "chop":
		s.shake = 0.4
	if k < 1.0:
		return false
	w.carry = s.finish(key, w.carry, Game)
	w.hold(w.carry)
	w.working_at = null
	_effects(s, key)
	return true

func work_progress() -> float:
	return player.get_meta("t", 0.0) if player.working_at else -1.0

func _effects(s: Spot, key: String) -> void:
	var at := s.global_position + Vector3(0, 0.3, 0)
	match key:
		"dig": _burst(at, Color("6b4a33"), 18); Sfx.play("place", -6.0, 0.8)
		"plant": _burst(at, Color("9bd36a"), 10); Sfx.play("pop", -8.0)
		"water": _burst(at + Vector3(0, 0.3, 0), Color("8fc9ff"), 22); Sfx.play("whoosh", -6.0)
		"harvest", "pick": _burst(at + Vector3(0, 0.4, 0), Color("ffe08a"), 18); Sfx.play("ding", -8.0)
		"chop": _burst(at + Vector3(0, 0.6, 0), Color("c79a63"), 24); Sfx.play("saw", -4.0); popped.emit("+2 wood", Color("e8c79a"))
		"fill": Sfx.play("whoosh", -4.0); popped.emit("Can full", Color("bfe4ff"))
	Sfx.buzz(18)

func _burst(at: Vector3, col: Color, n := 12) -> void:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.amount = n
	p.explosiveness = 0.9
	p.lifetime = 0.9
	p.mesh = Meshes.sphere(0.025)
	p.material_override = Props.plain(col, 0.6)
	p.direction = Vector3(0, 1, 0)
	p.spread = 55.0
	p.initial_velocity_min = 1.2
	p.initial_velocity_max = 2.6
	p.gravity = Vector3(0, -7.0, 0)
	var curve := Curve.new()
	curve.add_point(Vector2(0, 1))
	curve.add_point(Vector2(1, 0))
	p.scale_amount_curve = curve
	p.position = at
	add_child(p)
	p.emitting = true
	get_tree().create_timer(1.4).timeout.connect(p.queue_free)

# ---------------------------------------------------------------- the farmhand
func spawn_helper() -> void:
	if helper or not Game.owned.has("farmhand"):
		return
	helper = Worker.new().setup(true, "Hair_Buns", Color(0.25, 0.14, 0.1), false)
	helper.position = Vector3(-5.0, 0, -1.0)
	helper.speed = 2.2
	helper.set_meta("water", 0)
	add_child(helper)

func _go(w: Worker, p: Vector3) -> bool:
	var d := p - w.global_position
	d.y = 0
	if d.length() < 0.75:
		w.move_dir = Vector3.ZERO
		return true
	w.move_dir = d.normalized()
	return false

func _helper(dt: float) -> void:
	if helper == null:
		return
	var w := helper
	if w.working_at:
		var key: String = w.get_meta("work")
		var s: Spot = w.working_at
		if key == "water":
			# she has her own can
			var k: float = w.get_meta("t") + dt / Data.WORK.water
			w.set_meta("t", k)
			if k >= 1.0:
				s.wet = true
				s.changed_state.emit()
				w.set_meta("water", int(w.get_meta("water")) - 1)
				w.working_at = null
		else:
			_work(w, dt)
		return
	if not w.carry.is_empty():
		var crate: Spot = spots.filter(func(x): return x.kind == "crate")[0]
		if _go(w, crate.global_position):
			var it := w.drop()
			var pay := Game.sell(it.t, it.n)
			popped.emit("Rosa sold %d (+%d)" % [it.n, pay], Color("ffd36b"))
		return
	for p in plots:
		if p.state == "ripe":
			if _go(w, p.global_position):
				_start(w, p, "harvest")
			return
	if not Game.owned.has("sprinkler"):
		for p in plots:
			if p.state == "planted" and not p.wet:
				if int(w.get_meta("water")) <= 0:
					var well: Spot = spots.filter(func(x): return x.kind == "well")[0]
					if _go(w, well.global_position):
						w.set_meta("water", 6)
					return
				if _go(w, p.global_position):
					_start(w, p, "water")
				return
	_go(w, Vector3(0.2, 0, -1.4))
