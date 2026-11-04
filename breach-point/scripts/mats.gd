class_name Mats
## Materials built in code from noise, so the game needs no texture files.
## Every material uses triplanar mapping, so meshes need no UVs.

static var _cache := {}

static func _noise_tex(key: String, freq: float, octaves: int, lo: Color, hi: Color, size := 256, seed_ := 1, kind := FastNoiseLite.TYPE_SIMPLEX_SMOOTH) -> ImageTexture:
	if _cache.has(key):
		return _cache[key]
	var n := FastNoiseLite.new()
	n.noise_type = kind
	n.frequency = freq
	n.fractal_octaves = octaves
	n.seed = seed_
	var img := n.get_seamless_image(size, size)
	img.convert(Image.FORMAT_RGB8)
	for y in size:
		for x in size:
			var v := img.get_pixel(x, y).r
			img.set_pixel(x, y, lo.lerp(hi, v))
	img.generate_mipmaps()
	var tex := ImageTexture.create_from_image(img)
	_cache[key] = tex
	return tex

static func _mat(albedo: Texture2D, tint: Color, rough: float, metal := 0.0, scale := 0.25) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = albedo
	m.albedo_color = tint
	m.roughness = rough
	m.metallic = metal
	m.metallic_specular = 0.25
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3.ONE * scale
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return m

static func concrete() -> StandardMaterial3D:
	return _cached("concrete", func(): return _mat(_noise_tex("concrete", 0.03, 5, Color(0.42, 0.42, 0.40), Color(0.62, 0.61, 0.58)), Color.WHITE, 0.95, 0.0, 0.2))

static func ground() -> StandardMaterial3D:
	return _cached("ground", func(): return _mat(_noise_tex("ground", 0.02, 6, Color(0.30, 0.29, 0.26), Color(0.50, 0.47, 0.41), 256, 3), Color.WHITE, 1.0, 0.0, 0.12))

static func wall() -> StandardMaterial3D:
	return _cached("wall", func(): return _mat(_noise_tex("wall", 0.05, 4, Color(0.55, 0.52, 0.47), Color(0.70, 0.67, 0.61), 256, 5), Color.WHITE, 0.9, 0.0, 0.3))

static func painted_metal(c: Color, key: String) -> StandardMaterial3D:
	return _cached("pm_" + key, func(): return _mat(_noise_tex("rust", 0.04, 5, Color(0.72, 0.70, 0.68), Color(1, 1, 1), 256, 9), c, 0.6, 0.3, 0.35))

static func crate_wood() -> StandardMaterial3D:
	return _cached("crate", func(): return _mat(_noise_tex("planks", 0.012, 3, Color(0.40, 0.29, 0.17), Color(0.62, 0.47, 0.29), 256, 11, FastNoiseLite.TYPE_CELLULAR), Color.WHITE, 0.85, 0.0, 0.6))

static func gun_metal() -> StandardMaterial3D:
	return _cached("gunmetal", func():
		var m := _mat(_noise_tex("gm", 0.2, 3, Color(0.10, 0.10, 0.11), Color(0.17, 0.17, 0.18), 128, 2), Color.WHITE, 0.38, 0.85, 6.0)
		m.uv1_world_triplanar = false
		return m)

static func gun_wood() -> StandardMaterial3D:
	return _cached("gunwood", func():
		var m := _mat(_noise_tex("gw", 0.05, 4, Color(0.20, 0.08, 0.03), Color(0.36, 0.16, 0.06), 256, 4), Color.WHITE, 0.45, 0.0, 3.0)
		m.uv1_world_triplanar = false
		return m)

static func gun_mag() -> StandardMaterial3D:
	return _cached("gunmag", func():
		var m := _mat(_noise_tex("gmag", 0.1, 3, Color(0.13, 0.12, 0.11), Color(0.2, 0.19, 0.17), 128, 6), Color.WHITE, 0.5, 0.7, 5.0)
		m.uv1_world_triplanar = false
		return m)

static func cloth(c: Color, key: String) -> StandardMaterial3D:
	return _cached("cloth_" + key, func():
		var m := _mat(_noise_tex("camo", 0.06, 3, Color(0.75, 0.75, 0.75), Color(1.05, 1.05, 1.0), 128, 8, FastNoiseLite.TYPE_CELLULAR), c, 0.95, 0.0, 4.0)
		m.uv1_world_triplanar = false
		return m)

static func flat(c: Color, rough := 0.8, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	return m

static func glow(c: Color, energy := 4.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = c
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = energy
	return m

static func _cached(key: String, make: Callable) -> StandardMaterial3D:
	if not _cache.has(key):
		_cache[key] = make.call()
	return _cache[key]

# --- first-person viewmodel materials --------------------------------------
# The gun and arms are drawn with their own narrower field of view (like most
# shooters) and squashed towards the camera in depth, so they never poke
# through walls and don't look stretched at the edges of a wide view.

const VM_FOV := 58.0

static var _vm_shader: Shader
static var _vm_glow_shader: Shader

const _VM_COMMON := """
uniform float vm_fov = 54.0;
void vm_project(inout vec4 pos, mat4 proj, mat4 modelview, vec3 vtx) {
	vec4 view = modelview * vec4(vtx, 1.0);
	mat4 p = proj;
	// keep the sign of the engine's projection (it can be flipped when rendering to a texture)
	float k = (1.0 / tan(radians(vm_fov) * 0.5)) / abs(proj[1][1]);
	p[0][0] *= k;
	p[1][1] *= k;
	pos = p * view;
	// pull the depth close to the near plane (reverse-Z: 1.0 is near)
	pos.z = pos.w - (pos.w - pos.z) * 0.08;
}
"""

static func vm(tex: Texture2D, tint: Color, rough: float, metal: float, tex_scale: float, key: String) -> ShaderMaterial:
	if _cache.has("vm_" + key):
		return _cache["vm_" + key]
	if not _vm_shader:
		_vm_shader = Shader.new()
		_vm_shader.code = "shader_type spatial;\nrender_mode cull_back, shadows_disabled;\n" + _VM_COMMON + """
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 tint : source_color = vec4(1.0);
uniform float rough = 0.5;
uniform float metal = 0.0;
uniform float tex_scale = 4.0;
uniform bool use_tex = true;
uniform bool use_uv = false;
varying vec3 obj_pos;
varying vec3 obj_nrm;
void vertex() {
	obj_pos = VERTEX * tex_scale;
	obj_nrm = abs(NORMAL);
	vm_project(POSITION, PROJECTION_MATRIX, MODELVIEW_MATRIX, VERTEX);
}
void fragment() {
	vec3 w = pow(obj_nrm, vec3(4.0));
	w /= (w.x + w.y + w.z);
	vec3 c = vec3(1.0);
	if (use_uv) {
		c = texture(albedo_tex, UV).rgb;
	} else if (use_tex) {
		c = texture(albedo_tex, obj_pos.yz).rgb * w.x + texture(albedo_tex, obj_pos.xz).rgb * w.y + texture(albedo_tex, obj_pos.xy).rgb * w.z;
	}
	ALBEDO = c * tint.rgb;
	ROUGHNESS = rough;
	METALLIC = metal;
	SPECULAR = 0.5;
}
"""
	var m := ShaderMaterial.new()
	m.shader = _vm_shader
	m.set_shader_parameter("albedo_tex", tex)
	m.set_shader_parameter("use_tex", tex != null)
	m.set_shader_parameter("tint", tint)
	m.set_shader_parameter("rough", rough)
	m.set_shader_parameter("metal", metal)
	m.set_shader_parameter("tex_scale", tex_scale)
	m.set_shader_parameter("vm_fov", VM_FOV)
	_cache["vm_" + key] = m
	return m

static func vm_glow(tex: Texture2D, c: Color, energy: float) -> ShaderMaterial:
	if not _vm_glow_shader:
		_vm_glow_shader = Shader.new()
		_vm_glow_shader.code = "shader_type spatial;\nrender_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;\n" + _VM_COMMON + """
uniform sampler2D tex : source_color, filter_linear;
uniform vec4 color : source_color = vec4(1.0);
uniform float energy = 4.0;
void vertex() {
	vm_project(POSITION, PROJECTION_MATRIX, MODELVIEW_MATRIX, VERTEX);
}
void fragment() {
	vec4 t = texture(tex, UV);
	ALBEDO = t.rgb * color.rgb * energy;
	ALPHA = t.a;
}
"""
	var m := ShaderMaterial.new()
	m.shader = _vm_glow_shader
	m.set_shader_parameter("tex", tex)
	m.set_shader_parameter("color", c)
	m.set_shader_parameter("energy", energy)
	m.set_shader_parameter("vm_fov", VM_FOV)
	return m

static func vm_textured(tex: Texture2D, key: String) -> ShaderMaterial:
	var m := vm(tex, Color.WHITE, 0.6, 0.15, 1.0, "tex_" + key).duplicate()
	m.set_shader_parameter("use_uv", tex != null)
	m.set_shader_parameter("use_tex", tex != null)
	return m
