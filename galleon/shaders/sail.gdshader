// Sailcloth. The whole sail shape is computed from UV on the GPU: billowing with
// the wind (fill), hauling up to the yard (furl), luffing when the wind is weak.
shader_type spatial;
render_mode cull_disabled, specular_schlick_ggx;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic;
uniform int mode = 0; // 0 square sail, 1 lateen
uniform vec3 lat_a;
uniform vec3 lat_b;
uniform vec3 lat_c;
instance uniform float fill = 0.6;
instance uniform float furl = 1.0;
instance uniform vec4 shape = vec4(8.0, 9.0, 9.0, 0.75); // top half-width, foot half-width, drop, z

vec3 sail_pos(vec2 uv) {
	float s = uv.x, t = uv.y;
	float f = max(furl, 0.04);
	float luff = max(0.0, 0.32 - abs(fill));
	if (mode == 0) {
		float hw = mix(shape.x, shape.y, t);
		float x = (2.0 * s - 1.0) * hw * mix(0.9, 1.0, f);
		float y = -0.25 - t * shape.z * f;
		float depth = clamp(fill, -0.6, 1.0) * 0.2 * shape.z * f;
		float z = shape.w + depth * pow(max(sin(PI * s), 0.0), 0.8) * sin(PI * (0.08 + t * 0.78)) * 1.25;
		z += luff * 0.7 * sin(TIME * 8.0 + s * 7.0 + t * 5.0) * t * sin(PI * s);
		z += sin(s * 70.0) * 0.12 * max(0.0, 1.0 - f * 2.5); // folds of a furled sail
		y += abs(depth) * 0.22 * sin(PI * s) * t * t;
		x *= 1.0 - abs(depth) * 0.012 * sin(PI * t);
		return vec3(x, y, z);
	}
	vec3 p = mix(lat_a, lat_b, s);
	vec3 q = mix(p, lat_c, t * f);
	float depth = clamp(fill, -1.0, 1.0) * 1.7 * f;
	q.x += depth * sin(PI * s) * sin(PI * t * 0.85);
	q.x += luff * 0.5 * sin(TIME * 8.0 + s * 6.0 + t * 4.0) * t;
	q.x += sin(s * 50.0) * 0.1 * max(0.0, 1.0 - f * 2.5);
	return q;
}

void vertex() {
	vec3 p = sail_pos(UV);
	vec3 ds = sail_pos(UV + vec2(0.004, 0.0)) - p;
	vec3 dt = sail_pos(UV + vec2(0.0, 0.004)) - p;
	VERTEX = p;
	NORMAL = normalize(cross(ds, dt));
	TANGENT = normalize(ds);
	BINORMAL = normalize(cross(NORMAL, TANGENT));
}

void fragment() {
	ALBEDO = texture(albedo_tex, UV).rgb;
	NORMAL_MAP = texture(normal_tex, UV).rgb;
	NORMAL_MAP_DEPTH = 0.5;
	ROUGHNESS = 0.9;
	SPECULAR = 0.3;
	BACKLIGHT = vec3(0.5, 0.47, 0.4);
}
