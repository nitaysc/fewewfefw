extends Node
## Sets up the world, the player, the enemies and the interface, runs the
## respawn loop, and has a scripted self-test (`-- --autotest=<dir>`) that
## plays through firing, aiming, reloading and inspecting and saves screenshots.

const BOT_COUNT := 5
const BOT_TINT := Color(0.56, 0.48, 0.34)

var controls: Controls
var map: GameMap
var player: Player
var hud: Hud
var touch: TouchControls
var menu: Control
var pause_menu: Control
var _respawn_t := 0.0
var _bot_queue: Array[float] = []
var _autotest_dir := ""

func _ready() -> void:
	randomize()
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--autotest="):
			_autotest_dir = a.get_slice("=", 1)
	_build_environment()
	map = GameMap.new()
	add_child(map)
	map.build()
	controls = Controls.new()
	add_child(controls)
	player = Player.new()
	add_child(player)
	player.setup(controls)
	player.respawn(map.player_spawns[0], 0.0)
	player.died.connect(_on_player_died)

	var ui := CanvasLayer.new()
	add_child(ui)
	hud = Hud.new()
	ui.add_child(hud)
	hud.setup(player)
	touch = TouchControls.new()
	ui.add_child(touch)
	touch.setup(controls)
	touch.pause_pressed.connect(_pause)
	_build_menus(ui)

	for i in BOT_COUNT:
		_spawn_bot()
	if _autotest_dir != "":
		menu.visible = false
		_autotest()
	else:
		_show_menu()

func _build_environment() -> void:
	var env := Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.32, 0.47, 0.68)
	sm.sky_horizon_color = Color(0.72, 0.74, 0.74)
	sm.ground_horizon_color = Color(0.6, 0.6, 0.58)
	sm.ground_bottom_color = Color(0.25, 0.24, 0.22)
	sm.sun_angle_max = 20.0
	sky.sky_material = sm
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.7
	env.ambient_light_color = Color(0.62, 0.6, 0.56)
	env.ambient_light_sky_contribution = 0.35
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.05
	env.fog_enabled = true
	env.fog_light_color = Color(0.68, 0.7, 0.72)
	env.fog_density = 0.006
	env.fog_sky_affect = 0.2
	env.glow_enabled = true
	env.glow_intensity = 0.6
	env.glow_hdr_threshold = 1.2
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.08
	env.adjustment_saturation = 0.92
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -35, 0)
	sun.light_energy = 1.25
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 45.0
	sun.shadow_blur = 1.2
	add_child(sun)

func _spawn_bot() -> void:
	var bot := Bot.new()
	add_child(bot)
	# spawn at the bot spawn farthest from the player
	var best := map.bot_spawns[0]
	var best_d := -1.0
	for s in map.bot_spawns:
		var d := s.distance_to(player.global_position) + randf() * 8.0
		if d > best_d:
			best_d = d
			best = s
	bot.global_position = best + Vector3(randf_range(-2, 2), 0, randf_range(-2, 2))
	bot.setup(player, map, BOT_TINT)
	bot.killed.connect(_on_bot_killed)

func _on_bot_killed(_bot: Bot, headshot: bool) -> void:
	hud.add_kill(headshot)
	_bot_queue.append(4.0)

func _on_player_died() -> void:
	_respawn_t = 4.0
	touch.release_all()

func _process(delta: float) -> void:
	for i in range(_bot_queue.size() - 1, -1, -1):
		_bot_queue[i] -= delta
		if _bot_queue[i] <= 0:
			_bot_queue.remove_at(i)
			_spawn_bot()
	if not player.alive:
		_respawn_t -= delta
		hud.show_death(_respawn_t)
		if _respawn_t <= 0:
			hud.hide_death()
			var sp: Vector3 = map.player_spawns.pick_random()
			player.respawn(sp, 0.0)

# --- menus ----------------------------------------------------------------

func _panel(ui: CanvasLayer) -> Control:
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.process_mode = Node.PROCESS_MODE_ALWAYS
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.04, 0.05, 0.78)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(bg)
	ui.add_child(root)
	return root

func _button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(320, 76)
	b.add_theme_font_size_override("font_size", 32)
	return b

func _build_menus(ui: CanvasLayer) -> void:
	menu = _panel(ui)
	var box := VBoxContainer.new()
	Ui.place(box, Vector2(0.5, 0.5), Vector2(-260, -220), Vector2(520, 440))
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 18)
	menu.add_child(box)
	var title := Label.new()
	title.text = "BREACH POINT"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 72)
	title.add_theme_color_override("font_color", Color(0.95, 0.78, 0.35))
	box.add_child(title)
	var sub := Label.new()
	sub.text = "Clear the yard. Enemies keep coming."
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_font_size_override("font_size", 24)
	box.add_child(sub)
	var play := _button("PLAY")
	play.pressed.connect(_start)
	box.add_child(play)
	var help := Label.new()
	help.text = "Left side: move (push up to sprint)  ·  Right side: look\nCrouch while sprinting to slide"
	help.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	help.add_theme_font_size_override("font_size", 20)
	help.modulate = Color(1, 1, 1, 0.7)
	box.add_child(help)
	var credit := Label.new()
	credit.text = "Weapon and hands: \"Kriss Vector Animated (Free)\" by BarcodeGames, CC-BY 4.0"
	credit.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	credit.add_theme_font_size_override("font_size", 14)
	credit.modulate = Color(1, 1, 1, 0.45)
	box.add_child(credit)

	pause_menu = _panel(ui)
	pause_menu.visible = false
	var pbox := VBoxContainer.new()
	Ui.place(pbox, Vector2(0.5, 0.5), Vector2(-260, -200), Vector2(520, 400))
	pbox.alignment = BoxContainer.ALIGNMENT_CENTER
	pbox.add_theme_constant_override("separation", 18)
	pause_menu.add_child(pbox)
	var pt := Label.new()
	pt.text = "PAUSED"
	pt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	pt.add_theme_font_size_override("font_size", 56)
	pbox.add_child(pt)
	var sl := Label.new()
	sl.text = "Look sensitivity"
	sl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sl.add_theme_font_size_override("font_size", 24)
	pbox.add_child(sl)
	var slider := HSlider.new()
	slider.min_value = 0.08
	slider.max_value = 0.6
	slider.step = 0.01
	slider.value = controls.touch_sensitivity
	slider.custom_minimum_size = Vector2(420, 50)
	slider.value_changed.connect(func(v): controls.touch_sensitivity = v; controls.mouse_sensitivity = v * 0.55)
	pbox.add_child(slider)
	var resume := _button("RESUME")
	resume.pressed.connect(_resume)
	pbox.add_child(resume)

func _show_menu() -> void:
	menu.visible = true
	controls.enabled = false
	get_tree().paused = true

func _start() -> void:
	menu.visible = false
	controls.enabled = true
	get_tree().paused = false
	if not DisplayServer.is_touchscreen_available():
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _pause() -> void:
	touch.release_all()
	pause_menu.visible = true
	controls.enabled = false
	get_tree().paused = true

func _resume() -> void:
	pause_menu.visible = false
	controls.enabled = true
	get_tree().paused = false

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and not menu.visible and _autotest_dir == "":
		_pause()
	elif what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if pause_menu.visible:
			_resume()
		elif not menu.visible:
			_pause()

# --- self-test ------------------------------------------------------------

func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(_autotest_dir.path_join(name + ".png"))
	print("shot ", name)

func _debug_views() -> void:
	# look at the viewmodel from outside to check how the arms hold the gun
	var cam := Camera3D.new()
	cam.fov = 50
	cam.near = 0.01
	player.camera.add_child(cam)
	for v in [["00_side", Vector3(0.9, -0.1, -0.15), Vector3(0.05, -0.15, -0.2)], ["00_top", Vector3(0.05, 0.8, -0.2), Vector3(0.05, -0.15, -0.21)], ["00_front", Vector3(0.1, -0.05, -1.2), Vector3(0.05, -0.15, -0.1)], ["00_rhand", Vector3(0.45, -0.2, -0.15), Vector3(0.12, -0.17, -0.17)], ["00_rhand_l", Vector3(-0.3, -0.25, -0.15), Vector3(0.12, -0.17, -0.17)]]:
		cam.position = v[1]
		cam.look_at(player.camera.to_global(v[2]), player.camera.global_basis.y if v[0] != "00_top" else -player.camera.global_basis.z)
		cam.current = true
		await _wait(0.1)
		await _shot(v[0])
	player.camera.current = true
	cam.queue_free()

func _wait(t: float) -> void:
	await get_tree().create_timer(t).timeout

func _autotest() -> void:
	DirAccess.make_dir_recursive_absolute(_autotest_dir)
	touch.visible = true
	# keep the bots away until the bot test so the weapon shots are clean
	for b in get_tree().get_nodes_in_group("bots"):
		b.process_mode = Node.PROCESS_MODE_DISABLED
	player.yaw = 180.0
	await _wait(1.5)
	await _debug_views()
	await _shot("01_hip")
	controls.touch_fire = true
	await _wait(0.35)
	await _shot("02_firing")
	await _wait(0.4)
	controls.touch_fire = false
	await _wait(0.6)
	controls.touch_ads = true
	await _wait(0.5)
	await _shot("03_ads")
	controls.touch_fire = true
	await _wait(0.25)
	await _shot("04_ads_firing")
	controls.touch_fire = false
	controls.touch_ads = false
	await _wait(0.8)
	controls.reload_pressed = true
	await _wait(0.3)
	await _shot("05_reload_tilt")
	await _wait(0.25)
	await _shot("06_reload_mag_out")
	await _wait(0.55)
	await _shot("07_reload_new_mag")
	await _wait(2.0)
	await _shot("08_after_reload")
	controls.inspect_pressed = true
	await _wait(0.8)
	await _shot("09_inspect_left")
	await _wait(1.2)
	await _shot("10_inspect_right")
	await _wait(1.4)
	controls.touch_move = Vector2(0, 1)
	controls.touch_sprint = true
	await _wait(0.8)
	await _shot("11_sprint")
	controls.touch_move = Vector2.ZERO
	controls.touch_sprint = false
	# empty the magazine for an empty reload
	player.weapon.mag = 1
	controls.touch_fire = true
	await _wait(0.4)
	controls.touch_fire = false
	await _wait(1.6)
	await _shot("12_empty_reload_bolt")
	await _wait(1.5)
	# bots
	for b in get_tree().get_nodes_in_group("bots"):
		b.process_mode = Node.PROCESS_MODE_INHERIT
	var bot: Bot = get_tree().get_nodes_in_group("bots")[0]
	bot.global_position = player.global_position + Vector3(-4.5, 0, -7)
	bot.state = Bot.State.ENGAGE
	bot.set_physics_process(false)
	player.yaw = 0.0
	player.pitch = -2.0
	await _wait(1.2)
	await _shot("13_enemy")
	controls.touch_ads = true
	await _wait(0.4)
	var to := bot.global_position + Vector3(0, 1.3, 0) - player.camera.global_position
	player.yaw = rad_to_deg(atan2(-to.x, -to.z))
	player.pitch = rad_to_deg(atan2(to.y, Vector2(to.x, to.z).length()))
	await _wait(0.1)
	var cam := player.camera
	var q := PhysicsRayQueryParameters3D.create(cam.global_position, cam.global_position - cam.global_basis.z * 50.0, 1 | 8)
	q.collide_with_areas = true
	var h := player.get_world_3d().direct_space_state.intersect_ray(q)
	print("aim ray hits ", h.get("collider"), " at ", h.get("position"), " bot at ", bot.global_position, " cam ", cam.global_position, " fwd ", -cam.global_basis.z)
	controls.touch_fire = true
	await _wait(0.5)
	controls.touch_fire = false
	await _wait(0.4)
	await _shot("14_enemy_down")
	controls.touch_ads = false
	player.yaw = 140
	player.pitch = 5
	await _wait(1.0)
	await _shot("15_map")
	print("autotest done, health ", player.health, " kills ", hud.kills, " bot health ", bot.health if is_instance_valid(bot) else -1.0)
	get_tree().quit()
