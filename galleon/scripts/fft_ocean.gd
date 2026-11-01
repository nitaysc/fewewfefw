extends Node3D
## Drives the FFT ocean (ocean_fft/, from GodotOceanWaves): three wave cascades
## simulated on the GPU with a JONSWAP spectrum, foam that builds up where waves
## break and fades away, and spray thrown off the breaking crests.
## The big swell the ship rides on stays analytic (Waves / Gerstner); these
## cascades add the chop, whitecaps and spray on top of it.

const SPRAY_TEX := preload("res://ocean_fft/sea_spray.png")
const MAP_SIZE := 256 ## per-cascade FFT resolution (256 keeps phones fast)
const UPDATES_PER_SECOND := 30.0

var cascades: Array[WaveCascadeParameters] = []
var generator: WaveGenerator
var displacement_maps := Texture2DArrayRD.new()
var normal_maps := Texture2DArrayRD.new()
var map_scales := PackedVector4Array()
var spray: GPUParticles3D
var spray_mat: ShaderMaterial
var materials: Array[ShaderMaterial] = [] ## materials that need map_scales
var _time := 0.0
var _next_update := 0.0
var ok := false


func _ready() -> void:
	if RenderingServer.get_rendering_device() == null:
		push_warning("FFT ocean needs a RenderingDevice (Forward+ / Mobile); falling back to swell only")
		RenderingServer.global_shader_parameter_set(&"num_cascades", 0)
		return
	var wind_deg := rad_to_deg(Waves.WIND_ANGLE)
	# tile size, displacement, normal strength, wind speed, wind dir offset, fetch km, spread, swell, whitecap, foam
	var spec := [
		[88.0, 0.45, 1.0, 6.5, 0.0, 150.0, 0.45, 0.4, 0.5, 4.0],
		[37.0, 0.45, 1.0, 5.5, -12.0, 120.0, 0.55, 0.3, 0.45, 3.0],
		[11.0, 0.25, 0.7, 8.0, 9.0, 300.0, 0.65, 0.2, 0.25, 1.0],
	]
	var rng := RandomNumberGenerator.new()
	rng.seed = 1234
	for i in spec.size():
		var s: Array = spec[i]
		var p := WaveCascadeParameters.new()
		p.tile_length = Vector2(s[0], s[0])
		p.displacement_scale = s[1]
		p.normal_scale = s[2]
		p.wind_speed = s[3]
		p.wind_direction = wind_deg + s[4]
		p.fetch_length = s[5]
		p.spread = s[6]
		p.swell = s[7]
		p.whitecap = s[8]
		p.foam_amount = s[9]
		p.detail = 1.0
		p.spectrum_seed = Vector2i(rng.randi_range(-10000, 10000), rng.randi_range(-10000, 10000))
		p.time = 120.0 + PI * i
		cascades.append(p)
		map_scales.append(Vector4(1.0 / s[0], 1.0 / s[0], s[1], s[2]))

	generator = WaveGenerator.new()
	generator.map_size = MAP_SIZE
	add_child(generator)
	generator.init_gpu(maxi(2, cascades.size()))
	displacement_maps.texture_rd_rid = generator.descriptors[&"displacement_map"].rid
	normal_maps.texture_rd_rid = generator.descriptors[&"normal_map"].rid
	RenderingServer.global_shader_parameter_set(&"num_cascades", cascades.size())
	RenderingServer.global_shader_parameter_set(&"displacements", displacement_maps)
	RenderingServer.global_shader_parameter_set(&"normals", normal_maps)
	RenderingServer.global_shader_parameter_set(&"water_color", Color(0.02, 0.09, 0.2))
	RenderingServer.global_shader_parameter_set(&"foam_color", Color(0.86, 0.88, 0.88))
	_build_spray()
	ok = true
	prewarm(90)


## Run the simulation ahead so foam has already built up on the crests.
func prewarm(steps: int) -> void:
	for i in steps:
		generator.update(1.0 / UPDATES_PER_SECOND, cascades)


func register_material(m: ShaderMaterial) -> void:
	materials.append(m)
	m.set_shader_parameter(&"map_scales", map_scales)


func _build_spray() -> void:
	spray_mat = ShaderMaterial.new()
	spray_mat.shader = load("res://ocean_fft/sea_spray_particle.gdshader")
	spray_mat.set_shader_parameter(&"num_particles", 12100)
	spray_mat.set_shader_parameter(&"particle_scale", Vector3(14, 6, 14))
	spray_mat.set_shader_parameter(&"lifetime", 3.0)
	spray_mat.set_shader_parameter(&"lifetime_randomness", 0.25)
	spray_mat.set_shader_parameter(&"map_scales", map_scales)
	var draw := ShaderMaterial.new()
	draw.shader = load("res://ocean_fft/sea_spray.gdshader")
	draw.set_shader_parameter(&"albedo_texture", SPRAY_TEX)
	var noise := NoiseTexture2D.new()
	noise.seamless = true
	noise.noise = FastNoiseLite.new()
	draw.set_shader_parameter(&"dissolve_texture", noise)
	draw.set_shader_parameter(&"max_alpha", 0.6)
	var quad := QuadMesh.new()
	quad.material = draw
	spray = GPUParticles3D.new()
	spray.amount = 12100
	spray.lifetime = 6.0
	spray.process_material = spray_mat
	spray.draw_pass_1 = quad
	spray.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	spray.scale = Vector3(15, 15, 15) # the emitter box is 10 x 10 units -> 150 m around the camera
	spray.visibility_aabb = AABB(Vector3(-6, -2, -6), Vector3(12, 4, 12))
	add_child(spray)


func follow(cam_pos: Vector3) -> void:
	if not ok:
		return
	var tile := 4.0
	spray.global_position = Vector3(roundf(cam_pos.x / tile) * tile, 0.0, roundf(cam_pos.z / tile) * tile)
	spray_mat.set_shader_parameter(&"sea_time", Waves.time)


func _process(delta: float) -> void:
	if not ok:
		return
	_time += delta
	if _time >= _next_update:
		var step := 1.0 / UPDATES_PER_SECOND + (_time - _next_update)
		_next_update = _time + 1.0 / UPDATES_PER_SECOND
		generator.update(step, cascades)


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE:
		displacement_maps.texture_rd_rid = RID()
		normal_maps.texture_rd_rid = RID()
