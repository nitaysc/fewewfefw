extends Node3D
## Galleon: open-sea sailing prototype. Builds the world (sky, sea, sun, ship,
## wake, spray), the camera and the HUD, and runs the simulation.
##
## Command-line options (after `--`), used for testing and screenshots:
##   --play            skip the title screen
##   --warm=SECONDS    sail for this long before the first frame
##   --cam=NAME        chase | orbit | cinematic | deck
##   --yaw= --pitch= --dist=   camera placement
##   --shot=PATH --wait=SECONDS   save a screenshot after SECONDS and quit
##   --noenemy         no enemy ship;  --enemy=DIST,BEARING_DEG  place one (relative to the bow)
##   --fire=port|stbd|both   fire a broadside at once (screenshots of the smoke)

const ShipScript := preload("res://scripts/ship.gd")
const OceanScript := preload("res://scripts/ocean.gd")
const FftOceanScript := preload("res://scripts/fft_ocean.gd")
const BowWaveScript := preload("res://scripts/bow_wave.gd")
const WakeScript := preload("res://scripts/wake.gd")
const HelmScript := preload("res://scripts/helm.gd")
const RoseScript := preload("res://scripts/rose.gd")
const GunneryScript := preload("res://scripts/gunnery.gd")
const IslandScript := preload("res://scripts/island.gd")
const CaptainScript := preload("res://scripts/captain.gd")

const CAMS := ["Chase", "Orbit", "Cinematic", "Quarterdeck"]
const BRIG_PATH := "res://assets/brig/brig.glb"
const SAIL_DESIGNS := ["white", "dirty_white", "pirate", "black", "british", "spanish", "templar", "dutch"]
const SAIL_LEVELS := [0.0, 0.5, 1.0]
const SAIL_NAMES := ["Furled", "Half sail", "Full sail"]

var args := {}
var ship: Node3D
var ocean: MeshInstance3D
var fft: Node3D
var sea_audio: AudioStreamPlayer
var wind_audio: AudioStreamPlayer
var wake: SubViewport
var camera: Camera3D
var sun: DirectionalLight3D
var sun_dir := Vector3(-0.55, 0.62, -0.56).normalized()
var sprays: Array = []
var bow_wave: MeshInstance3D
var env: Environment
var sky_mat: ShaderMaterial
var sky_ready := false

var cam_mode := 0
var cam_yaw := 0.62
var cam_pitch := 0.2
var cam_dist := 50.0
var cam_heading := 0.0
var cam_auto := 0.0
var touches := {}
var pinch0 := 0.0
var dist0 := 0.0

var running := false
var model_path := "res://assets/ship/galleon.glb" ## the brig when its licensed files are present
static var quick_start := false ## "sail again" after a sinking skips the title
var gunnery: Node3D
var combat := false ## cannons and enemy ships: parked for now (owner's call); --combat turns them on
var island: Node3D
var enemies: Array = [] ## {ship, captain}
var sunk_count := 0
var spawn_timer := -1.0
var game_over := false
var cam_shake := 0.0
var was_leaking := false
var was_aground := false
var sail_idx := 1
var sail_design := "white"
var perf_level := 0 ## 0 = full quality; raised automatically if the phone cannot keep up
var key_rudder := 0.0

# HUD
var hud: CanvasLayer
var helm
var rose
var speed_lbl: Label
var heading_lbl: Label
var pos_lbl: Label
var sail_lbl: Label
var sail_bars: Array = []
var cam_lbl: Label
var hull_lbl: Label
var banner: Label
var marker: Label
var fire_btns: Array = [] ## [port, starboard]
var over_box: Control
var title: Control
var hud_root: Control

var fps_time := 0.0
var fps_frames := 0
var tuned := false
var shot_timer := -1.0


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv: PackedStringArray = a.trim_prefix("--").split("=", true, 1)
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	combat = args.has("combat")
	_build_world()
	_build_ship()
	_build_hud()
	_build_audio()
	_apply_quality()

	var wind: Vector3 = Waves.wind()
	var wind_from := atan2(-wind.x, -wind.z)
	ship.transform = Transform3D(Basis(Vector3.UP, wind_from + 2.75), Vector3.ZERO)
	ship.sail_target = 0.5
	ship.sail = 0.5
	for i in 240:
		ship.step(1.0 / 60.0)
	cam_heading = ship.heading()

	# an island a mile or so off the port bow, and an enemy on the horizon
	var ih: float = ship.heading() + 0.32
	island = IslandScript.new()
	add_child(island)
	island.build(Vector3(sin(ih), 0.0, cos(ih)) * float(args.get("islanddist", "1350")))
	ship.terrain = island
	ocean.mat.set_shader_parameter("island_tex", island.height_tex)
	ocean.mat.set_shader_parameter("island_rect", island.rect())
	if combat:
		_start_combat()

	if args.has("play") or quick_start:
		_start()

	if args.has("warm"):
		_set_sail(2)
		ship.sail = 1.0
		var secs := float(args.warm)
		var n := int(secs * 30.0)
		for i in n:
			ship.step(1.0 / 30.0)
			ship.animate(1.0 / 30.0)
			for en in enemies:
				en.captain.update(1.0 / 30.0)
				en.ship.step(1.0 / 30.0)
				en.ship.animate(1.0 / 30.0)
			wake.update(1.0 / 30.0, _all_ships())
		cam_heading = ship.heading()
	if args.has("cam"):
		_set_cam(["chase", "orbit", "cinematic", "deck"].find(args.cam))
	if args.has("yaw"):
		cam_yaw = float(args.yaw)
	if args.has("pitch"):
		cam_pitch = float(args.pitch)
	if args.has("dist"):
		cam_dist = float(args.dist)
	if args.has("debug"):
		ocean.mat.set_shader_parameter("debug_view", int(args.debug))
	if args.has("sails") and ship.brig_sails:
		sail_design = args.sails
		_apply_sail_design()
	if args.has("sail"): # screenshots: --sail=0|1|2 sets the sails at once
		_set_sail(int(args.sail))
		ship.sail = SAIL_LEVELS[sail_idx]
		ship.furl_vis = ship.sail
	if args.has("notaa"):
		get_viewport().use_taa = false
	if args.has("shot"):
		shot_timer = float(args.get("wait", "3"))
	if args.has("fire") and combat:
		if args.fire in ["port", "both"]:
			_fire(1.0)
		if args.fire in ["stbd", "both"]:
			_fire(-1.0)


# ------------------------------------------------------------------ world
func _build_world() -> void:
	sky_mat = ShaderMaterial.new()
	sky_mat.shader = load("res://shaders/sky.gdshader")
	var sky := Sky.new()
	sky.sky_material = sky_mat
	sky.process_mode = Sky.PROCESS_MODE_QUALITY
	sky.radiance_size = Sky.RADIANCE_SIZE_256
	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 1.0
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.95
	env.tonemap_white = 6.0
	env.glow_enabled = true
	env.glow_intensity = 0.35
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 1.1
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.fog_enabled = true
	env.fog_light_color = Color(0.72, 0.8, 0.9)
	env.fog_density = 0.00035
	env.fog_sky_affect = 0.0
	env.fog_aerial_perspective = 0.75
	env.ssao_enabled = true
	env.ssao_radius = 1.6
	env.ssao_intensity = 1.6
	env.ssao_power = 1.4
	env.ssao_detail = 0.6
	# (volumetric fog was dropped for speed: at this thin haze the depth fog + aerial
	#  perspective below look the same at a fraction of the cost)
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.12
	env.adjustment_contrast = 1.06
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	sun = DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.light_energy = 2.2
	sun.shadow_enabled = true
	# one shadow cascade fitted around the ship: the ship is drawn into the shadow map
	# once per frame instead of twice, at the same sharpness where it matters
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 110.0
	sun.shadow_bias = 0.04
	sun.shadow_normal_bias = 1.2
	sun.light_angular_distance = 0.5
	add_child(sun)

	camera = Camera3D.new()
	camera.fov = 50.0
	camera.near = 0.3
	camera.far = 8000.0
	camera.cull_mask = 0xFFFFF & ~(1 << (WakeScript.LAYER - 1))
	add_child(camera)
	camera.make_current()

	wake = WakeScript.new()
	add_child(wake)

	ocean = OceanScript.new()
	add_child(ocean)
	ocean.setup(220, 288, wake.get_texture())
	fft = FftOceanScript.new()
	add_child(fft)
	if fft.ok:
		fft.register_material(ocean.mat)


func _place_sun() -> void:
	# keep the sun behind the default camera so the ship is lit as you first see it
	var h: float = ship.heading() + cam_yaw + 0.6
	sun_dir = Vector3(sin(h) * 0.78, 0.62, cos(h) * 0.78).normalized()
	sun.look_at_from_position(Vector3.ZERO, -sun_dir, Vector3.UP if absf(sun_dir.y) < 0.99 else Vector3.FORWARD)


func _build_ship() -> void:
	ship = ShipScript.new()
	add_child(ship)
	# the purchased brig if its (git-ignored, licensed) files are present, else the built-in galleon
	model_path = BRIG_PATH if ResourceLoader.exists(BRIG_PATH) and not args.has("galleon") else "res://assets/ship/galleon.glb"
	ship.attach_model(load(model_path), load("res://shaders/sail.gdshader"), load("res://shaders/flag.gdshader"))
	if ship.brig_sails:
		var cfg := ConfigFile.new()
		cfg.load("user://settings.cfg")
		sail_design = cfg.get_value("ship", "sails", "white")
		_apply_sail_design()
	_place_sun_deferred.call_deferred()
	# bow wave sheets, droplets and mist
	bow_wave = BowWaveScript.new()
	ship.add_child(bow_wave)
	bow_wave.build(ShipScript, ship.bow_scale)
	var noise := NoiseTexture2D.new()
	noise.seamless = true
	noise.noise = FastNoiseLite.new()
	var spray_tex: Texture2D = load("res://ocean_fft/sea_spray.png")
	var mist_shader: Shader = load("res://shaders/bow_spray.gdshader")
	var drop_shader: Shader = load("res://shaders/spray_droplet.gdshader")
	for side in [1.0, -1.0]:
		# droplets thrown off the crest of the bow wave
		var drops := GPUParticles3D.new()
		drops.amount = 380
		drops.lifetime = 1.1
		drops.local_coords = false
		drops.position = Vector3(side * 3.4, 1.0, 14.5 * ship.bow_scale)
		drops.transform_align = GPUParticles3D.TRANSFORM_ALIGN_Z_BILLBOARD_Y_TO_VELOCITY
		var dm := ParticleProcessMaterial.new()
		dm.direction = Vector3(side * 1.0, 1.3, 0.6)
		dm.spread = 24.0
		dm.initial_velocity_min = 3.5
		dm.initial_velocity_max = 9.0
		dm.gravity = Vector3(0, -9.8, 0)
		dm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
		dm.emission_box_extents = Vector3(0.4, 0.4, 2.2)
		dm.scale_min = 0.5
		dm.scale_max = 1.4
		drops.process_material = dm
		var dq := QuadMesh.new()
		dq.size = Vector2(0.05, 0.3)
		var dmat := ShaderMaterial.new()
		dmat.shader = drop_shader
		dq.material = dmat
		drops.draw_pass_1 = dq
		drops.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		drops.visibility_aabb = AABB(Vector3(-40, -10, -40), Vector3(80, 30, 80))
		drops.amount_ratio = 0.0
		ship.add_child(drops)
		sprays.append(drops)
		# fine mist that drifts back over the bow wave
		var mist := GPUParticles3D.new()
		mist.amount = 40
		mist.lifetime = 1.6
		mist.local_coords = false
		mist.position = Vector3(side * 3.6, 1.2, 13.5 * ship.bow_scale)
		var mm := ParticleProcessMaterial.new()
		mm.direction = Vector3(side * 0.8, 0.7, 0.2)
		mm.spread = 35.0
		mm.initial_velocity_min = 1.0
		mm.initial_velocity_max = 3.0
		mm.gravity = Vector3(0, -0.6, 0)
		mm.damping_min = 0.4
		mm.damping_max = 1.0
		mm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
		mm.emission_box_extents = Vector3(0.6, 0.4, 3.0)
		mm.scale_min = 1.5
		mm.scale_max = 3.2
		mm.angle_min = -180.0
		mm.angle_max = 180.0
		var sc := Curve.new()
		sc.add_point(Vector2(0, 0.5))
		sc.add_point(Vector2(1, 1.7))
		var sct := CurveTexture.new()
		sct.curve = sc
		mm.scale_curve = sct
		mist.process_material = mm
		var mq := QuadMesh.new()
		var mmat := ShaderMaterial.new()
		mmat.shader = mist_shader
		mmat.set_shader_parameter("albedo_texture", spray_tex)
		mmat.set_shader_parameter("dissolve_texture", noise)
		mq.material = mmat
		mist.draw_pass_1 = mq
		mist.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mist.visibility_aabb = AABB(Vector3(-40, -10, -40), Vector3(80, 30, 80))
		mist.amount_ratio = 0.0
		ship.add_child(mist)
		sprays.append(mist)


func _place_sun_deferred() -> void:
	_place_sun()
	_bake_sky()


## Raymarch the volumetric clouds into an HDR panorama, a strip per frame
## (so a phone GPU never stalls), then hand it to the sky.
func _bake_sky() -> void:
	var w := int(args.get("skyres", "4096"))
	var h := w / 4
	var vp := SubViewport.new()
	vp.size = Vector2i(w, h)
	vp.use_hdr_2d = true
	vp.transparent_bg = false
	vp.render_target_clear_mode = SubViewport.CLEAR_MODE_NEVER
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	var rect := ColorRect.new()
	var m := ShaderMaterial.new()
	m.shader = load("res://shaders/cloud_bake.gdshader")
	m.set_shader_parameter("size", Vector2(w, h))
	m.set_shader_parameter("sun_dir", sun_dir)
	rect.material = m
	vp.add_child(rect)
	add_child(vp)
	var strips := 16
	for i in strips:
		rect.position = Vector2(0, h * i / strips)
		rect.size = Vector2(w, ceili(float(h) / strips))
		vp.render_target_update_mode = SubViewport.UPDATE_ONCE
		await RenderingServer.frame_post_draw
	var img := vp.get_texture().get_image()
	sky_mat.set_shader_parameter("panorama", ImageTexture.create_from_image(img))
	sky_mat.set_shader_parameter("ready", 1.0)
	vp.queue_free()
	sky_ready = true


## Full quality by default. If the phone can't hold ~30 fps the game steps down
## by itself (render scale first, then the most expensive effects); no menu needed.
func _apply_quality() -> void:
	var vp := get_viewport()
	# phones have very dense screens: TAA + FSR upscaling from ~90 % is hard to tell apart
	var scales := [1.0, 0.9, 0.8, 0.72, 0.65, 0.58]
	vp.scaling_3d_scale = scales[mini(perf_level, scales.size() - 1)]
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_FSR if vp.scaling_3d_scale < 1.0 else Viewport.SCALING_3D_MODE_BILINEAR
	env.ssao_enabled = perf_level < 5
	if island:
		for t in island.trees:
			t.visible = perf_level < 4 # the jungle canopy stays; the scanned trees go
	RenderingServer.directional_shadow_atlas_set_size(4096 if perf_level < 3 else 2048, true)


func _looped(s: AudioStreamWAV) -> AudioStreamWAV:
	s.loop_mode = AudioStreamWAV.LOOP_FORWARD
	s.loop_begin = 0
	s.loop_end = s.data.size() / 2
	return s


func _build_audio() -> void:
	# procedurally made loops (tools/make_audio.py): surf and wind
	sea_audio = AudioStreamPlayer.new()
	sea_audio.stream = _looped(load("res://assets/audio/sea_loop.wav"))
	sea_audio.volume_db = -6.0
	sea_audio.autoplay = true
	add_child(sea_audio)
	wind_audio = AudioStreamPlayer.new()
	wind_audio.stream = _looped(load("res://assets/audio/wind_loop.wav"))
	wind_audio.volume_db = -14.0
	wind_audio.autoplay = true
	add_child(wind_audio)


# ------------------------------------------------------------------ HUD
func _style(bg: Color, radius: int) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	s.border_color = Color(1, 0.95, 0.85, 0.22)
	s.set_border_width_all(1)
	s.content_margin_left = 16
	s.content_margin_right = 16
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	return s


func _label(text: String, size: int, color := Color(0.97, 0.93, 0.85)) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
	l.add_theme_constant_override("shadow_offset_y", 2)
	return l


func _round_button(text: String, size := 76) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(size, size)
	b.add_theme_font_size_override("font_size", 28)
	for st in [["normal", Color(0.03, 0.09, 0.16, 0.55)], ["hover", Color(0.06, 0.14, 0.24, 0.65)], ["pressed", Color(0.85, 0.66, 0.3, 0.55)]]:
		var sb := _style(st[1], size / 2 - 2)
		sb.corner_detail = 16
		sb.anti_aliasing = true
		sb.content_margin_left = 0
		sb.content_margin_right = 0
		b.add_theme_stylebox_override(st[0], sb)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.focus_mode = Control.FOCUS_NONE
	return b


func _build_hud() -> void:
	hud = CanvasLayer.new()
	add_child(hud)
	hud_root = Control.new()
	hud_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud_root.visible = false
	hud.add_child(hud_root)

	# stats, top left
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", _style(Color(0.03, 0.09, 0.16, 0.5), 16))
	panel.position = Vector2(24, 18)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 26)
	panel.add_child(row)
	for pair in [["0.0", "KNOTS"], ["000°", "HEADING"]]:
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", -4)
		var big := _label(pair[0], 36)
		big.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		var small := _label(pair[1], 13, Color(0.97, 0.93, 0.85, 0.65))
		small.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(big)
		col.add_child(small)
		row.add_child(col)
		if pair[1] == "KNOTS":
			speed_lbl = big
		else:
			heading_lbl = big
	pos_lbl = _label("Broad reach", 22)
	pos_lbl.custom_minimum_size.x = 160
	pos_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(pos_lbl)
	hud_root.add_child(panel)
	if combat:
		hull_lbl = _label("Hull 100%", 20)
		hull_lbl.custom_minimum_size.x = 150
		hull_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		row.add_child(hull_lbl)

		# broadsides: port on the left, starboard on the right (as seen from astern)
		for side in [1.0, -1.0]:
			var fb := _round_button("PORT" if side > 0.0 else "STBD", 104)
			fb.add_theme_font_size_override("font_size", 20)
			var sd: float = side
			fb.pressed.connect(func(): _fire(sd))
			if side > 0.0:
				fb.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
				fb.position = Vector2(60, -360)
			else:
				fb.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
				fb.position = Vector2(-310, -150)
			hud_root.add_child(fb)
			fire_btns.append(fb)

		banner = _label("", 34)
		banner.set_anchors_preset(Control.PRESET_CENTER_TOP)
		banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		banner.position = Vector2(-450, 130)
		banner.custom_minimum_size = Vector2(900, 50)
		banner.modulate.a = 0.0
		hud_root.add_child(banner)

		marker = _label("", 17)
		marker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		marker.custom_minimum_size = Vector2(180, 40)
		marker.visible = false
		hud_root.add_child(marker)

	# wind rose and buttons, top right
	var tr := HBoxContainer.new()
	tr.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	tr.position = Vector2(-380, 16)
	tr.add_theme_constant_override("separation", 14)
	tr.alignment = BoxContainer.ALIGNMENT_END
	tr.custom_minimum_size.x = 360
	var cam_btn := _round_button("CAM", 72)
	cam_btn.add_theme_font_size_override("font_size", 18)
	cam_btn.pressed.connect(func(): _set_cam(cam_mode + 1))
	rose = RoseScript.new()
	if ship.brig_sails:
		var sails_btn := _round_button("SAILS", 72)
		sails_btn.add_theme_font_size_override("font_size", 14)
		sails_btn.pressed.connect(_next_sail_design)
		tr.add_child(sails_btn)
	tr.add_child(cam_btn)
	tr.add_child(rose)
	hud_root.add_child(tr)
	cam_lbl = _label("", 18)
	cam_lbl.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	cam_lbl.position = Vector2(-300, 100)
	cam_lbl.modulate.a = 0.0
	hud_root.add_child(cam_lbl)

	# helm, bottom left
	helm = HelmScript.new()
	helm.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	helm.position = Vector2(26, -226)
	helm.size = Vector2(200, 200)
	hud_root.add_child(helm)

	# sails, bottom right
	var sr := VBoxContainer.new()
	sr.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	sr.position = Vector2(-150, -290)
	sr.custom_minimum_size = Vector2(120, 270)
	sr.alignment = BoxContainer.ALIGNMENT_CENTER
	sr.add_theme_constant_override("separation", 8)
	var up := _round_button("▲", 88)
	up.pressed.connect(func(): _set_sail(sail_idx + 1))
	var down := _round_button("▼", 88)
	down.pressed.connect(func(): _set_sail(sail_idx - 1))
	var bars := HBoxContainer.new()
	bars.alignment = BoxContainer.ALIGNMENT_CENTER
	for i in 2:
		var cr := ColorRect.new()
		cr.custom_minimum_size = Vector2(34, 8)
		bars.add_child(cr)
		sail_bars.append(cr)
	sail_lbl = _label("Half sail", 20)
	sail_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	for c in [up, bars, sail_lbl, down]:
		if c is Button:
			var holder := CenterContainer.new()
			holder.add_child(c)
			sr.add_child(holder)
		else:
			sr.add_child(c)
	hud_root.add_child(sr)
	_set_sail(1)

	# title
	title = ColorRect.new()
	title.color = Color(0.01, 0.04, 0.08, 0.45)
	title.set_anchors_preset(Control.PRESET_FULL_RECT)
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 14)
	var t := _label("G A L L E O N", 96)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var st := _label("Open-sea sailing  ·  prototype", 24, Color(0.97, 0.93, 0.85, 0.8))
	st.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var go := Button.new()
	go.text = "  SET SAIL  "
	go.add_theme_font_size_override("font_size", 30)
	go.add_theme_stylebox_override("normal", _style(Color(0.85, 0.66, 0.3, 0.3), 40))
	go.add_theme_stylebox_override("hover", _style(Color(0.85, 0.66, 0.3, 0.45), 40))
	go.add_theme_stylebox_override("pressed", _style(Color(0.85, 0.66, 0.3, 0.6), 40))
	go.custom_minimum_size = Vector2(300, 74)
	go.pressed.connect(_start)
	var gc := CenterContainer.new()
	gc.add_child(go)
	box.add_child(t)
	box.add_child(st)
	box.add_child(gc)
	box.position = Vector2(-400, -150)
	box.custom_minimum_size = Vector2(800, 300)
	title.add_child(box)
	hud.add_child(title)

	over_box = ColorRect.new()
	(over_box as ColorRect).color = Color(0.01, 0.03, 0.06, 0.55)
	over_box.set_anchors_preset(Control.PRESET_FULL_RECT)
	over_box.visible = false
	var ob := VBoxContainer.new()
	ob.set_anchors_preset(Control.PRESET_CENTER)
	ob.position = Vector2(-400, -120)
	ob.custom_minimum_size = Vector2(800, 240)
	ob.add_theme_constant_override("separation", 18)
	var ot := _label("She's gone down", 64)
	ot.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ot.name = "Title"
	var os_ := _label("", 24, Color(0.97, 0.93, 0.85, 0.8))
	os_.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	os_.name = "Sub"
	var again := Button.new()
	again.text = "  SAIL AGAIN  "
	again.add_theme_font_size_override("font_size", 30)
	again.add_theme_stylebox_override("normal", _style(Color(0.85, 0.66, 0.3, 0.3), 40))
	again.add_theme_stylebox_override("pressed", _style(Color(0.85, 0.66, 0.3, 0.6), 40))
	again.custom_minimum_size = Vector2(300, 74)
	again.pressed.connect(func():
		quick_start = true
		get_tree().reload_current_scene())
	var ac := CenterContainer.new()
	ac.add_child(again)
	ob.add_child(ot)
	ob.add_child(os_)
	ob.add_child(ac)
	over_box.add_child(ob)
	hud.add_child(over_box)
	cam_mode = 2


func _start() -> void:
	running = true
	title.visible = false
	hud_root.visible = true
	_set_cam(0)
	_set_sail(2)


func _set_sail(i: int) -> void:
	sail_idx = clampi(i, 0, 2)
	if ship:
		ship.sail_target = SAIL_LEVELS[sail_idx]
	sail_lbl.text = SAIL_NAMES[sail_idx]
	for k in sail_bars.size():
		sail_bars[k].color = Color(0.97, 0.93, 0.85, 0.95) if k < sail_idx else Color(1, 1, 1, 0.2)


func _set_cam(i: int) -> void:
	cam_mode = posmod(i, CAMS.size())
	match CAMS[cam_mode]:
		"Chase":
			cam_yaw = 0.62; cam_pitch = 0.2; cam_dist = 50.0
		"Cinematic":
			cam_pitch = 0.1; cam_dist = 55.0
		"Quarterdeck":
			cam_yaw = 0.0; cam_pitch = 0.0
	if cam_lbl:
		cam_lbl.text = CAMS[cam_mode]
		cam_lbl.modulate.a = 1.0
		create_tween().tween_property(cam_lbl, "modulate:a", 0.0, 1.2).set_delay(0.8)


## Sail designs that came with the brig (white, pirate, black, British, Spanish...).
func _next_sail_design() -> void:
	sail_design = SAIL_DESIGNS[(SAIL_DESIGNS.find(sail_design) + 1) % SAIL_DESIGNS.size()]
	_apply_sail_design()
	var cfg := ConfigFile.new()
	cfg.load("user://settings.cfg")
	cfg.set_value("ship", "sails", sail_design)
	cfg.save("user://settings.cfg")
	if cam_lbl:
		cam_lbl.text = "Sails: " + sail_design.replace("_", " ").capitalize()
		cam_lbl.modulate.a = 1.0
		create_tween().tween_property(cam_lbl, "modulate:a", 0.0, 1.2).set_delay(0.8)


func _apply_sail_design() -> void:
	var path := "res://assets/brig/sails/%s.jpg" % sail_design
	if ResourceLoader.exists(path):
		ship.set_sail_design(load(path))


# ------------------------------------------------------------------ input
func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventScreenTouch:
		if e.pressed:
			touches[e.index] = e.position
		else:
			touches.erase(e.index)
		if touches.size() == 2:
			var p: Array = touches.values()
			pinch0 = p[0].distance_to(p[1])
			dist0 = cam_dist
	elif e is InputEventScreenDrag:
		touches[e.index] = e.position
		if touches.size() == 1:
			cam_yaw -= e.relative.x * 0.005
			cam_pitch = clampf(cam_pitch + e.relative.y * 0.004, -0.05, 1.3)
		elif touches.size() == 2 and pinch0 > 0.0:
			var p: Array = touches.values()
			cam_dist = clampf(dist0 * pinch0 / maxf(1.0, p[0].distance_to(p[1])), 22.0, 200.0)
	elif e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = maxf(22.0, cam_dist * 0.9)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_dist = minf(200.0, cam_dist * 1.1)
	elif e is InputEventKey and e.pressed and not e.echo:
		match e.keycode:
			KEY_W, KEY_UP:
				_set_sail(sail_idx + 1)
			KEY_S, KEY_DOWN:
				_set_sail(sail_idx - 1)
			KEY_C:
				_set_cam(cam_mode + 1)
			KEY_Q:
				if combat: _fire(1.0)
			KEY_E:
				if combat: _fire(-1.0)


# ------------------------------------------------------------------ frame
func _process(delta: float) -> void:
	var dt := minf(delta, 0.05)
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		helm.set_angle(helm.angle - 300.0 * dt)
	elif Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		helm.set_angle(helm.angle + 300.0 * dt)
	ship.rudder = helm.value()

	ship.step(dt)
	ship.animate(dt)
	_update_enemies(dt)
	wake.update(dt, _all_ships())
	if gunnery:
		gunnery.listener = camera.global_position
	var ratio := clampf((ship.speed() - 2.0) / 4.0 + ship.bow_dip * 0.8, 0.0, 1.0)
	bow_wave.update(maxf(0.0, ship.speed()), clampf(ship.bow_dip * 0.5, 0.0, 1.2), fft.map_scales)
	for p in sprays:
		p.amount_ratio = ratio
		p.emitting = ratio > 0.01

	_update_camera(dt)
	if cam_shake > 0.0:
		cam_shake = maxf(0.0, cam_shake - dt * 1.5)
		camera.rotate_object_local(Vector3(randf_range(-1, 1), randf_range(-1, 1), 0).normalized(), cam_shake * 0.02 * randf())
	ocean.follow(camera.global_position, wake.center, sun_dir)
	fft.follow(camera.global_position)
	var spd: float = maxf(0.0, ship.speed())
	sea_audio.volume_db = lerpf(-8.0, -1.0, clampf(spd / 4.0, 0.0, 1.0))
	sea_audio.pitch_scale = lerpf(0.95, 1.08, clampf(spd / 4.0, 0.0, 1.0))
	_update_hud()

	fps_time += delta
	fps_frames += 1
	if fps_time > 3.0 and running and not tuned and not args.has("shot"):
		var fps := fps_frames / fps_time
		if fps < 40.0 and perf_level < 5:
			perf_level += 1
			_apply_quality()
		elif fps >= 40.0:
			tuned = true
		fps_time = 0.0
		fps_frames = 0

	if shot_timer >= 0.0 and sky_ready:
		shot_timer -= delta
		if shot_timer < 0.0:
			var img := get_viewport().get_texture().get_image()
			img.save_png(args.shot)
			print("saved ", args.shot, " fps~", Engine.get_frames_per_second())
			get_tree().quit()


func _update_camera(dt: float) -> void:
	var h: float = ship.heading()
	cam_heading += wrapf(h - cam_heading, -PI, PI) * minf(1.0, dt * 1.2)
	var pos: Vector3 = ship.position
	if CAMS[cam_mode] == "Quarterdeck":
		var b: Basis = ship.transform.basis
		var eye: Vector3 = pos + b * Vector3(-1.2, 9.9, -14.0)
		var look: Vector3 = pos + b * Vector3(sin(cam_yaw * 0.6) * 20.0, 9.0 + cam_pitch * 10.0, 40.0)
		var up := b.y.lerp(Vector3.UP, 0.6).normalized()
		camera.look_at_from_position(eye, look, up)
		return
	if CAMS[cam_mode] == "Cinematic":
		cam_auto += dt * 0.05
	var base := 0.0 if CAMS[cam_mode] == "Orbit" else cam_heading
	var yaw := base + cam_yaw + cam_auto
	var pivot := Vector3(pos.x, pos.y * 0.5 + 9.0, pos.z)
	if args.has("campos"): # screenshots: --campos=x,y,z --camlook=x,y,z relative to the island's centre
		var cp: PackedFloat64Array = args.campos.split_floats(",")
		var cl: PackedFloat64Array = args.get("camlook", "0,20,0").split_floats(",")
		camera.look_at_from_position(island.position + Vector3(cp[0], cp[1], cp[2]), island.position + Vector3(cl[0], cl[1], cl[2]), Vector3.UP)
		return
	if args.has("focus"): # screenshots: aim at a point given in ship space, e.g. --focus=0,1,17
		var f: PackedFloat64Array = args.focus.split_floats(",")
		pivot = ship.transform * Vector3(f[0], f[1], f[2])
	var cp := pivot + Vector3(sin(yaw) * cos(cam_pitch), sin(cam_pitch), cos(yaw) * cos(cam_pitch)) * cam_dist
	cp.y = maxf(cp.y, Waves.height_at(cp.x, cp.z) + 2.0)
	camera.look_at_from_position(cp, pivot, Vector3.UP)
	var aspect := get_viewport().get_visible_rect().size.aspect()
	camera.fov = 68.0 if aspect < 1.0 else 50.0


func _update_hud() -> void:
	if not hud_root.visible:
		return
	speed_lbl.text = "%.1f" % (maxf(0.0, ship.speed()) * 1.944)
	var bearing := fposmod(rad_to_deg(-ship.heading()), 360.0)
	heading_lbl.text = "%03d°" % (int(round(bearing)) % 360)
	var app: Vector3 = ship.apparent
	var from := atan2(-app.x, -app.z)
	var rel := wrapf(from - ship.heading(), -PI, PI)
	rose.wind_rel = -rel
	rose.queue_redraw()
	var d := rad_to_deg(absf(rel))
	var name := "Running"
	if ship.sail < 0.05:
		name = "Drifting" if ship.speed() > 0.5 else "Hove to"
	elif d < 50.0:
		name = "In irons"
	elif d < 75.0:
		name = "Close-hauled"
	elif d < 105.0:
		name = "Beam reach"
	elif d < 160.0:
		name = "Broad reach"
	pos_lbl.text = name
	if combat:
		_update_combat_hud()


# ------------------------------------------------------------------ battle
## Cannons and an enemy man-of-war (off by default for now; run with --combat).
func _start_combat() -> void:
	gunnery = GunneryScript.new()
	add_child(gunnery)
	gunnery.ships = [ship]
	gunnery.terrain = island
	gunnery.splashed.connect(func(p: Vector3, sz: float): wake.add_splash(p, sz, ship.sim_time))
	gunnery.hit.connect(_on_hit)
	if not args.has("noenemy"):
		if args.has("enemy"):
			var e: PackedFloat64Array = args.enemy.split_floats(",")
			_spawn_enemy(e[0], deg_to_rad(e[1]) if e.size() > 1 else 0.6)
		else:
			_spawn_enemy(950.0, randf_range(-0.9, 0.9))


func _all_ships() -> Array:
	var out := [ship]
	for e in enemies:
		out.append(e.ship)
	return out


## A man-of-war on the horizon: same hull and physics as ours, her own colours.
func _spawn_enemy(dist: float, rel_bearing: float) -> void:
	var b: float = ship.heading() + rel_bearing
	var at := ship.position + Vector3(sin(b), 0.0, cos(b)) * dist
	# keep her clear of the island
	for k in 12:
		if island == null or island.height(at.x, at.z) < -25.0:
			break
		b += 0.5
		at = ship.position + Vector3(sin(b), 0.0, cos(b)) * dist
	var e = ShipScript.new()
	add_child(e)
	e.attach_model(load(model_path), load("res://shaders/sail.gdshader"), load("res://shaders/flag.gdshader"))
	if e.brig_sails:
		# the purchased brig as an enemy: navy sail designs that came with it
		var design: String = ["british", "spanish", "dutch"][sunk_count % 3]
		var tex := "res://assets/brig/sails/%s.jpg" % design
		if ResourceLoader.exists(tex):
			e.set_sail_design(load(tex))
	else:
		e.set_colours(Color(0.8, 0.77, 0.7), Color(0.75, 0.06, 0.05))
	e.terrain = island
	# sail across our bow, on whichever tack the wind allows
	var hd: float = b + PI * 0.5
	if CaptainScript._no_go(hd):
		hd = b - PI * 0.5
	e.transform = Transform3D(Basis(Vector3.UP, hd), Vector3(at.x, 0.0, at.z))
	e.sail_target = 1.0
	e.sail = 1.0
	for i in 120:
		e.step(1.0 / 30.0)
	var cap = CaptainScript.new(e, ship, gunnery)
	cap.skill = clampf(0.55 + sunk_count * 0.08, 0.0, 0.95)
	enemies.append({"ship": e, "captain": cap})
	gunnery.ships = _all_ships()
	if running:
		_say("Sail ho! A man-of-war, %d m off the %s bow" % [int(dist), "port" if rel_bearing > 0.0 else "starboard"])


func _update_enemies(dt: float) -> void:
	var i := 0
	while i < enemies.size():
		var e: Dictionary = enemies[i]
		var s = e.ship
		if running:
			e.captain.update(dt)
		s.step(dt)
		s.animate(dt)
		if s.sinking and s.position.y < -16.0:
			# gone: leave a patch of foam and wreckage where she went down
			wake.add_splash(s.position, 4.0, ship.sim_time)
			wake.forget(s)
			s.queue_free()
			enemies.remove_at(i)
			gunnery.ships = _all_ships()
			sunk_count += 1
			spawn_timer = 30.0
			continue
		i += 1
	if spawn_timer > 0.0 and not args.has("noenemy"):
		spawn_timer -= dt
		if spawn_timer <= 0.0:
			_spawn_enemy(1000.0, randf_range(-1.2, 1.2))
	# our own ship going down
	if ship.sinking and not game_over and ship.position.y < -5.0:
		game_over = true
		over_box.visible = true
		hud_root.visible = false
		(over_box.find_child("Sub", true, false) as Label).text = "Ships sunk: %d" % sunk_count


## Lay the guns: if an enemy is near this beam, elevate and train them on her.
func _player_lay(side: float) -> Array:
	var best: Array = []
	var best_d := 900.0
	for e in enemies:
		if e.ship.sinking:
			continue
		var d: float = e.ship.position.distance_to(ship.position)
		var l: Array = GunneryScript.lay(ship, side, e.ship.position)
		if l.size() > 0 and d < best_d:
			best_d = d
			best = l
	return best


func _fire(side: float) -> void:
	var l := _player_lay(side)
	if l.is_empty():
		l = [deg_to_rad(1.0), 0.0]
	if gunnery.fire(ship, side, l[0], l[1]):
		cam_shake = maxf(cam_shake, 0.35)


func _on_hit(s, below: bool) -> void:
	if s == ship:
		cam_shake = maxf(cam_shake, 0.8)
		if below and not was_leaking:
			was_leaking = true
			_say("We're holed below the waterline! The pumps are manned")
		if ship.sinking:
			_say("She's breaking up. Abandon ship!")
	else:
		if s.sinking and not s.has_meta("struck"):
			s.set_meta("struck", true)
			_say("She's striking her colours. She's sinking!")


func _say(text: String) -> void:
	if banner == null:
		return
	banner.text = text
	banner.modulate.a = 1.0
	var tw := create_tween()
	tw.tween_interval(3.0)
	tw.tween_property(banner, "modulate:a", 0.0, 1.0)


func _update_combat_hud() -> void:
	var water := ""
	if ship.flood > 1.0:
		water = "\nWater %d t" % int(ship.flood)
	hull_lbl.text = "Hull %d%%%s" % [int(ship.hull), water]
	hull_lbl.add_theme_color_override("font_color", Color(1.0, 0.45, 0.35) if ship.hull < 35.0 or ship.flood > 300.0 else Color(0.97, 0.93, 0.85))
	if ship.aground > 0.3 and not was_aground:
		_say("Aground! Get her off the reef")
	was_aground = ship.aground > 0.3
	for k in 2:
		var b: Button = fire_btns[k]
		var r: float = ship.reload[k]
		var side := 1.0 if k == 0 else -1.0
		if r > 0.0:
			b.text = "%d" % ceili(r)
			b.modulate = Color(1, 1, 1, 0.6)
		else:
			b.text = "PORT" if k == 0 else "STBD"
			var aim := not _player_lay(side).is_empty()
			b.modulate = Color(1.0, 0.8, 0.45) if aim else Color.WHITE
	# the nearest enemy, labelled over her masts
	marker.visible = false
	for e in enemies:
		var s = e.ship
		var top: Vector3 = s.position + Vector3.UP * 46.0
		if camera.is_position_behind(top):
			continue
		var d := ship.position.distance_to(s.position)
		var sp := camera.unproject_position(top)
		marker.visible = true
		marker.position = sp - Vector2(90, 40)
		marker.text = ("Sinking" if s.sinking else "Man-of-war  %d%%" % int(s.hull)) + "\n%d m" % int(d)
		break
