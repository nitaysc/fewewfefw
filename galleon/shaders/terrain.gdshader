// Island ground from photo-scanned textures (Poly Haven, CC0): coral sea bed, wet and
// dry beach sand, jungle floor and bare rock, chosen by height and slope. Each layer is
// sampled at two scales so it holds up close and doesn't tile visibly from the sea;
// rock is projected sideways on steep faces so cliffs don't smear.
shader_type spatial;
render_mode cull_back, specular_schlick_ggx;

uniform sampler2D noise_tex : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D coast_sand_01_diff : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D coast_sand_01_nor : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D damp_beach_sand_diff : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D damp_beach_sand_nor : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D forest_leaves_02_diff : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D forest_leaves_02_nor : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D aerial_rocks_02_diff : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D aerial_rocks_02_nor : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D coral_ground_02_diff : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D coral_ground_02_nor : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;

varying vec3 world;
varying vec3 wnormal;

void vertex() {
	world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnormal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	// the mesh has no tangents; textures are laid along world x/z, so build them here
	TANGENT = normalize(vec3(1.0, 0.0, 0.0) - NORMAL * NORMAL.x);
	BINORMAL = normalize(cross(TANGENT, NORMAL));
}

// two scales, the larger one rotated, blended so neither repeat is obvious
vec3 two_scale(sampler2D t, vec2 uv, float far) {
	vec3 a = texture(t, uv).rgb;
	vec3 b = texture(t, mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8)) * uv * 0.23).rgb;
	return mix(a, mix(a, b, 0.5), far);
}

void fragment() {
	float dist = length(world - CAMERA_POSITION_WORLD);
	float far = smoothstep(30.0, 250.0, dist);
	float n1 = texture(noise_tex, world.xz * 0.004).r;
	float n2 = texture(noise_tex, world.xz * 0.03).r;
	float h = world.y + (n1 - 0.5) * 3.0;
	float slope = 1.0 - wnormal.y;

	vec2 uv = world.xz / 6.0;
	vec3 seabed = two_scale(coral_ground_02_diff, uv, far);
	vec3 wet = two_scale(damp_beach_sand_diff, uv * 1.2, far);
	vec3 sand = two_scale(coast_sand_01_diff, uv, far);
	vec3 floor_ = two_scale(forest_leaves_02_diff, uv * 1.5, far);
	floor_ = mix(vec3(dot(floor_, vec3(0.3, 0.59, 0.11))) * vec3(0.32, 0.5, 0.16), floor_ * 0.5, 0.25); // moist green undergrowth
	// jungle canopy seen from the sea: clumps of crowns ~10 m across with dark gaps between.
	// Real trees only fringe the beach (island.gd); this is far cheaper than thousands of trees.
	float c1 = texture(noise_tex, world.xz * 0.085).r;
	// big clumps of trees (~40 m) with shadowed hollows between them: what survives at range
	vec2 cq = world.xz * 0.028 + 0.5;
	float c2 = texture(noise_tex, cq).r;
	float c2x = texture(noise_tex, cq + vec2(0.012, 0.0)).r;
	float c2z = texture(noise_tex, cq + vec2(0.0, 0.012)).r;
	float crowns = smoothstep(0.3, 0.75, c1);
	vec3 canopy = mix(vec3(0.012, 0.03, 0.008), vec3(0.06, 0.11, 0.028), crowns * 0.5 + smoothstep(0.35, 0.7, c2) * 0.5);
	canopy *= 0.55 + 0.7 * smoothstep(0.25, 0.75, c2);
	canopy = mix(canopy, vec3(0.09, 0.1, 0.035), smoothstep(0.75, 0.95, texture(noise_tex, world.xz * 0.007).r) * 0.4); // paler patches
	float canopy_w = smoothstep(16.0, 26.0, h + n2 * 6.0) * (1.0 - smoothstep(110.0, 150.0, h + n2 * 20.0));
	canopy_w = max(canopy_w, smoothstep(200.0, 500.0, dist) * smoothstep(5.0, 9.0, h)); // far away, the fringe merges into canopy
	floor_ = mix(floor_, canopy, canopy_w);
	// rock on cliffs: project along whichever horizontal axis faces the slope
	vec2 ruv = (abs(wnormal.x) > abs(wnormal.z) ? world.zy : world.xy) / 9.0;
	vec3 rock = mix(two_scale(aerial_rocks_02_diff, ruv, far), two_scale(aerial_rocks_02_diff, world.xz / 9.0, far), wnormal.y * wnormal.y) * 0.75;

	vec3 col = seabed;
	float w_wet = smoothstep(-1.5, 0.0, h);
	float w_sand = smoothstep(0.6, 1.6, h);
	float w_floor = smoothstep(3.0, 6.5, h + n2 * 2.0);
	float w_rock = smoothstep(0.55, 0.8, slope + (n2 - 0.5) * 0.3) * smoothstep(1.0, 4.0, h);
	w_rock = max(w_rock, smoothstep(140.0, 180.0, h + n2 * 25.0));
	col = mix(col, wet, w_wet);
	col = mix(col, sand, w_sand);
	col = mix(col, floor_, w_floor);
	col = mix(col, rock, w_rock);
	ALBEDO = col;

	vec3 nm = texture(coral_ground_02_nor, uv).rgb;
	nm = mix(nm, texture(damp_beach_sand_nor, uv * 1.2).rgb, w_wet);
	nm = mix(nm, texture(coast_sand_01_nor, uv).rgb, w_sand);
	nm = mix(nm, mix(texture(forest_leaves_02_nor, uv * 1.5).rgb, vec3(0.5 + (c2 - c2x) * 14.0 + (c1 - 0.5) * 0.3, 0.5 + (c2 - c2z) * 14.0, 1.0), canopy_w), w_floor);
	nm = mix(nm, texture(aerial_rocks_02_nor, ruv).rgb, w_rock);
	NORMAL_MAP = nm;
	NORMAL_MAP_DEPTH = mix(1.0, 0.4, far);

	float dry = smoothstep(0.0, 1.2, h);
	ROUGHNESS = mix(0.3, 0.92, dry); // wet sand shines
	SPECULAR = mix(0.5, 0.3, dry);
}
