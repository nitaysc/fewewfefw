// Rain-forest crowns: each instance is a squashed sphere made lumpy in the vertex
// shader, then broken into clumps of leaves with deep self-shadow between them.
shader_type spatial;
render_mode cull_back, specular_schlick_ggx;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;

varying vec3 wpos;
varying vec3 tint;

void vertex() {
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float n = texture(noise_tex, w.xz * 0.05 + VERTEX.xy * 0.3).r;
	VERTEX += NORMAL * (n - 0.5) * 0.7;
	wpos = w;
	tint = COLOR.rgb;
}

void fragment() {
	float leaf = texture(noise_tex, wpos.xz * 0.35 + wpos.y * 0.2).r;
	float clump = texture(noise_tex, wpos.xz * 0.08 - wpos.y * 0.05).r;
	vec3 col = tint * (0.45 + 0.9 * leaf * clump);
	// darker toward the bottom of each crown (self-shadow)
	float up = (INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).y;
	col *= mix(0.45, 1.0, smoothstep(-0.6, 0.6, up));
	ALBEDO = col;
	ROUGHNESS = 0.8;
	SPECULAR = 0.3;
	BACKLIGHT = tint * 0.6;
	NORMAL = normalize(NORMAL + vec3(leaf - 0.5, clump - 0.5, 0.0) * 0.8);
}
