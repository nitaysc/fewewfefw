// The sky: a panorama of volumetric cumulus baked at start-up (cloud_bake.gdshader),
// plus the sun disc at full resolution, hidden where clouds cover it.
// Reading one texture per pixel is far cheaper than computing clouds every frame.
shader_type sky;

uniform sampler2D panorama : filter_linear, repeat_enable;
uniform float ready = 0.0;
uniform vec3 zenith : source_color = vec3(0.13, 0.33, 0.74);
uniform vec3 horizon : source_color = vec3(0.66, 0.77, 0.88);

void sky() {
	vec3 d = normalize(EYEDIR);
	vec3 sun = LIGHT0_ENABLED ? LIGHT0_DIRECTION : normalize(vec3(-0.55, 0.62, -0.56));
	vec3 col;
	float cover = 0.0;
	if (d.y >= 0.0) {
		if (ready > 0.5) {
			float elev = asin(clamp(d.y, 0.0, 1.0));
			float v = 1.0 - pow(elev / (0.5 * PI), 1.0 / 1.6);
			float u = fract(atan(d.x, -d.z) / (2.0 * PI));
			vec4 c = textureLod(panorama, vec2(u, v), 0.0);
			col = c.rgb;
			cover = c.a;
		} else {
			col = mix(horizon, zenith, pow(d.y, 0.42));
		}
	} else {
		// below the horizon (only seen through gaps): deep sea haze
		col = mix(horizon * 0.9, vec3(0.03, 0.12, 0.22), smoothstep(0.0, -0.1, d.y));
	}
	if (AT_CUBEMAP_PASS) {
		COLOR = col;
	} else {
		float sd = max(dot(d, sun), 0.0);
		COLOR = col + vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, sd) * 40.0 * (1.0 - cover);
	}
}
