// Bright trade-wind sky with cumulus clouds. Clouds are drawn at half resolution
// (they are soft) and the same sky lights the ship and is reflected by the sea.
shader_type sky;
render_mode use_half_res_pass;

uniform vec3 zenith : source_color = vec3(0.16, 0.38, 0.78);
uniform vec3 horizon : source_color = vec3(0.70, 0.80, 0.90);
uniform float cloud_cover = 0.56;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
	float v = 0.0, a = 0.5;
	mat2 r = mat2(vec2(0.8, -0.6), vec2(0.6, 0.8));
	for (int i = 0; i < 6; i++) { v += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
	return v;
}

vec3 base_sky(vec3 d, vec3 sun) {
	float h = max(d.y, 0.0);
	vec3 col = mix(horizon, zenith, pow(h, 0.45));
	float sd = max(dot(d, sun), 0.0);
	col += vec3(1.0, 0.85, 0.6) * pow(sd, 8.0) * 0.3 + vec3(1.0, 0.9, 0.75) * pow(sd, 64.0) * 0.8;
	return col;
}

vec4 clouds(vec3 d, vec3 sun) {
	if (d.y < 0.004) return vec4(0.0);
	vec2 p = d.xz / (d.y + 0.07) * 1.3;
	vec2 w = vec2(fbm(p * 0.6 + 3.1), fbm(p * 0.6 - 7.7));
	float n = fbm(p + w * 0.6);
	float cov = smoothstep(1.0 - cloud_cover - 0.02, 1.0 - cloud_cover + 0.12, n);
	float n2 = fbm(p + w * 0.6 + sun.xz * 0.12);
	float lit = clamp(0.7 + (n - n2) * 6.0 - (1.0 - smoothstep(0.0, 0.3, n - (1.0 - cloud_cover))) * 0.15, 0.15, 1.25);
	vec3 col = mix(vec3(0.46, 0.53, 0.64), vec3(1.25, 1.22, 1.16), lit);
	col += vec3(0.4, 0.32, 0.2) * pow(max(dot(d, sun), 0.0), 6.0) * (1.0 - cov);
	return vec4(col, cov * smoothstep(0.0, 0.1, d.y) * 0.97);
}

void sky() {
	vec3 d = normalize(EYEDIR);
	vec3 sun = LIGHT0_ENABLED ? LIGHT0_DIRECTION : normalize(vec3(-0.55, 0.62, -0.56));
	if (AT_HALF_RES_PASS || AT_CUBEMAP_PASS) {
		vec3 col = base_sky(d, sun);
		vec4 c = clouds(d, sun);
		col = mix(col, c.rgb, c.a);
		col = mix(col, horizon * 1.02, (1.0 - smoothstep(0.0, 0.07, abs(d.y))) * 0.7);
		if (d.y < 0.0) col = mix(col, vec3(0.03, 0.12, 0.22), smoothstep(0.0, -0.1, d.y));
		COLOR = col;
		ALPHA = c.a;
	} else {
		COLOR = HALF_RES_COLOR.rgb;
		float sd = max(dot(d, sun), 0.0);
		COLOR += vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, sd) * 30.0 * (1.0 - HALF_RES_COLOR.a);
	}
}
