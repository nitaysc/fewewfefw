// Island ground: sea bed, wet and dry sand, jungle and bare volcanic rock,
// chosen by height and slope and broken up with noise so no band is a clean line.
shader_type spatial;
render_mode cull_back, specular_schlick_ggx;

uniform sampler2D noise_tex : filter_linear_mipmap_anisotropic, repeat_enable;

varying vec3 world;
varying vec3 wnormal;

void vertex() {
	world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnormal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	float n1 = texture(noise_tex, world.xz * 0.004).r;
	float n2 = texture(noise_tex, world.xz * 0.03).r;
	float n3 = texture(noise_tex, world.xz * 0.21).r;
	float h = world.y + (n1 - 0.5) * 3.0;
	float slope = 1.0 - wnormal.y;

	vec3 seabed = mix(vec3(0.62, 0.58, 0.45), vec3(0.42, 0.45, 0.36), n2);
	vec3 wet = vec3(0.55, 0.47, 0.34);
	vec3 sand = mix(vec3(0.86, 0.79, 0.62), vec3(0.78, 0.7, 0.53), n3);
	vec3 jungle = mix(vec3(0.02, 0.04, 0.015), vec3(0.05, 0.08, 0.025), n2 * 0.7 + n3 * 0.3);
	jungle *= 0.6 + 0.8 * n3 * n3; // canopy clumps and the shadows between them
	vec3 scrub = vec3(0.2, 0.22, 0.09); // dry scrub on the windward heights
	vec3 rock = mix(vec3(0.13, 0.12, 0.11), vec3(0.22, 0.2, 0.17), n3); // dark volcanic basalt

	vec3 col = seabed;
	col = mix(col, wet, smoothstep(-1.5, 0.0, h));
	col = mix(col, sand, smoothstep(0.4, 1.4, h));
	col = mix(col, jungle, smoothstep(3.0, 6.5, h + n2 * 2.0));
	col = mix(col, scrub, smoothstep(60.0, 120.0, h + n2 * 30.0) * 0.6);
	col = mix(col, rock, smoothstep(0.5, 0.75, slope + (n2 - 0.5) * 0.3) * smoothstep(2.0, 6.0, h));
	col = mix(col, rock * 1.3, smoothstep(140.0, 180.0, h + n2 * 25.0));

	ALBEDO = col;
	float dry = smoothstep(0.0, 1.2, h);
	ROUGHNESS = mix(0.35, 0.95, dry); // wet sand shines
	SPECULAR = mix(0.5, 0.25, dry);
	vec3 bump = vec3((n3 - 0.5) * 0.6, 1.0, (texture(noise_tex, world.xz * 0.21 + 0.37).r - 0.5) * 0.6);
	NORMAL = normalize(mix(NORMAL, (VIEW_MATRIX * vec4(normalize(wnormal + bump * vec3(1, 0, 1) * 0.35), 0.0)).xyz, 0.7));
}
