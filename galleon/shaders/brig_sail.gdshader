// Wind on the brig's sails and pennants. Each vertex carries (from tools/import_brig.py):
//   COLOR.rgb = which way this cloth bellies out, COLOR.a = how free it is (0 at the edges),
//   UV2.x = kind (0 square sail, 0.5 fore-and-aft sail, 1 pennant, 2 static cloth),
//   1 - UV2.y = metres below the sail's head / 50 (glTF export flips V, hence the 1 -).
shader_type spatial;
render_mode cull_disabled, specular_schlick_ggx;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic;
uniform sampler2D orm_tex : hint_default_white, filter_linear_mipmap;
uniform float fill = 0.6;       // square sails: + bellies forward (wind from astern)
uniform float side_fill = 0.0;  // fore-and-aft sails: signed, toward +x
uniform float furl = 1.0;       // 1 = set, 0 = hauled up to the yards
uniform float gust = 0.0;

vec3 cloth(vec3 v, vec4 c, vec2 k, float t) {
	if (k.x > 1.5) return v; // static cloth (covers, coils...)
	float w = c.a;
	vec3 dir = c.rgb * 2.0 - 1.0;
	float belly = sin(min(w, 1.0) * PI * 0.5);
	float below = clamp(1.0 - k.y, 0.0, 1.0) * 50.0; // metres below the yard
	if (k.x < 0.25) {
		float luff = max(0.0, 0.3 - abs(fill));
		v += dir * (fill * (2.3 + gust) * belly * furl);
		v += dir * luff * 0.7 * sin(t * 8.0 + v.x * 0.6 + v.y * 0.4) * belly;
		v.y += below * (1.0 - furl);
	} else if (k.x < 0.75) {
		float luff = max(0.0, 0.3 - abs(side_fill));
		v += dir * (side_fill * 1.4 * belly * furl);
		v += dir * luff * 0.6 * sin(t * 9.0 + v.z * 0.5 + v.y * 0.4) * belly;
		v.y += below * (1.0 - furl) * 0.6;
	} else {
		// pennant streaming and snapping in the wind
		v += dir * (sin(t * 7.0 - w * 9.0) * 0.55 + sin(t * 13.0 - w * 15.0) * 0.15) * w;
		v.y += sin(t * 5.0 - w * 6.0) * 0.2 * w;
	}
	return v;
}

void vertex() {
	float t = TIME;
	vec3 p = cloth(VERTEX, COLOR, UV2, t);
	// bend the normal with the cloth (finite difference along the tangent directions)
	vec3 px = cloth(VERTEX + TANGENT * 0.15, COLOR, UV2, t);
	vec3 py = cloth(VERTEX + BINORMAL * 0.15, COLOR, UV2, t);
	vec3 n = normalize(cross(px - p, py - p));
	if (UV2.x < 1.5 && length(n) > 0.5) {
		if (dot(n, NORMAL) < 0.0) n = -n;
		NORMAL = n;
	}
	VERTEX = p;
}

void fragment() {
	ALBEDO = texture(albedo_tex, UV).rgb;
	NORMAL_MAP = texture(normal_tex, UV).rgb;
	vec3 orm = texture(orm_tex, UV).rgb;
	ROUGHNESS = orm.g;
	METALLIC = 0.0;
	SPECULAR = 0.3;
	BACKLIGHT = vec3(0.45, 0.42, 0.38); // sunlight glowing through the canvas
}
