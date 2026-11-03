class_name Costume
extends RefCounted
## Alternate colours, Smash style: eight costumes per fighter. Costume 0 is the original;
## the others shift the hue / saturation / brightness of the outfit through a shader that
## leaves skin tones alone.

## [name, hue shift (turns), saturation, brightness]
const LIST := [
	["ORIGINAL", 0.0, 1.0, 1.0],
	["AZURE", 0.6, 1.1, 1.0],
	["JADE", 0.33, 1.05, 1.0],
	["GOLD", 0.12, 1.15, 1.08],
	["ROSE", 0.88, 1.1, 1.05],
	["VIOLET", 0.75, 1.1, 1.0],
	["SILVER", 0.0, 0.12, 1.15],
	["SHADOW", 0.0, 0.7, 0.42],
]

const SHADER := """
shader_type spatial;
uniform vec4 albedo_color : source_color = vec4(1.0);
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D mr_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform bool has_normal = false;
uniform bool has_mr = false;
uniform float metallic = 0.0;
uniform float roughness = 1.0;
uniform float hue = 0.0;
uniform float sat = 1.0;
uniform float val = 1.0;

vec3 rgb2hsv(vec3 c) {
	vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
	vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
	vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
	float d = q.x - min(q.w, q.y);
	return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hsv2rgb(vec3 c) {
	vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
	return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

void fragment() {
	vec3 c = texture(albedo_tex, UV).rgb * albedo_color.rgb;
	vec3 h = rgb2hsv(c);
	// skin: warm, moderately saturated, not dark. Keep it as it is.
	float warm = 1.0 - smoothstep(0.06, 0.12, min(h.x, 1.0 - h.x + 0.02));
	float skin = warm * smoothstep(0.15, 0.3, h.y) * (1.0 - smoothstep(0.62, 0.75, h.y)) * smoothstep(0.35, 0.5, h.z);
	float m = 1.0 - skin;
	h.x = fract(h.x + hue * m * smoothstep(0.05, 0.2, h.y));
	h.y = clamp(h.y * mix(1.0, sat, m), 0.0, 1.0);
	h.z = h.z * mix(1.0, val, m);
	ALBEDO = hsv2rgb(h);
	if (has_mr) {
		vec4 mr = texture(mr_tex, UV);
		METALLIC = mr.b * metallic;
		ROUGHNESS = mr.g * roughness;
	} else {
		METALLIC = metallic;
		ROUGHNESS = roughness;
	}
	if (has_normal) {
		NORMAL_MAP = texture(normal_tex, UV).rgb;
	}
}
"""

static var _shader: Shader
static var _cache := {}


static func count() -> int:
	return LIST.size()


## The colour a costume actually gives this fighter (hue shifts are relative to their own colours).
static func name_for(accent: Color, i: int) -> String:
	var n: String = LIST[clampi(i, 0, LIST.size() - 1)][0]
	if n in ["ORIGINAL", "SILVER", "SHADOW"]:
		return n
	var h := swatch(accent, i).h
	var names := ["CRIMSON", "EMBER", "GOLD", "LIME", "JADE", "TEAL", "AZURE", "COBALT", "VIOLET", "ROSE"]
	var cuts := [0.03, 0.09, 0.16, 0.24, 0.42, 0.52, 0.6, 0.7, 0.8, 0.94]
	for k in cuts.size():
		if h < cuts[k]:
			return names[k]
	return "CRIMSON"


## A swatch colour for the costume picker: the fighter's accent, recoloured.
static func swatch(accent: Color, i: int) -> Color:
	var c: Array = LIST[clampi(i, 0, LIST.size() - 1)]
	var h := fposmod(accent.h + float(c[1]), 1.0)
	return Color.from_hsv(h, clampf(accent.s * float(c[2]), 0.0, 1.0), clampf(accent.v * float(c[3]), 0.0, 1.0))


## Recolours every mesh under `root`.
static func apply(root: Node, i: int) -> void:
	if i <= 0 or i >= LIST.size():
		return
	if _shader == null:
		_shader = Shader.new()
		_shader.code = SHADER
	var c: Array = LIST[i]
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m3 := mi as MeshInstance3D
		if m3.mesh == null:
			continue
		for si in m3.mesh.get_surface_count():
			var src := m3.get_active_material(si)
			if not (src is StandardMaterial3D):
				continue
			var key := "%d:%d" % [src.get_instance_id(), i]
			if not _cache.has(key):
				_cache[key] = _make(src as StandardMaterial3D, c)
			m3.set_surface_override_material(si, _cache[key])


static func _make(s: StandardMaterial3D, c: Array) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader
	m.set_shader_parameter("albedo_color", s.albedo_color)
	if s.albedo_texture:
		m.set_shader_parameter("albedo_tex", s.albedo_texture)
	if s.normal_enabled and s.normal_texture:
		m.set_shader_parameter("normal_tex", s.normal_texture)
		m.set_shader_parameter("has_normal", true)
	var mr := s.roughness_texture if s.roughness_texture else s.metallic_texture
	if mr:
		m.set_shader_parameter("mr_tex", mr)
		m.set_shader_parameter("has_mr", true)
	m.set_shader_parameter("metallic", s.metallic)
	m.set_shader_parameter("roughness", s.roughness)
	m.set_shader_parameter("hue", float(c[1]))
	m.set_shader_parameter("sat", float(c[2]))
	m.set_shader_parameter("val", float(c[3]))
	return m
