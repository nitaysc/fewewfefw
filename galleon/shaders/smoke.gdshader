// Gun smoke: thick, sunlit clouds of black-powder smoke. They burst from the muzzle,
// stop within a couple of seconds, then swell, thin out and drift down the wind.
shader_type spatial;
render_mode cull_disabled, depth_draw_never, shadows_disabled, specular_disabled;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform vec3 drift = vec3(0.0); // metres per second the smoke is carried by the wind
uniform float lifetime = 9.0;
uniform vec3 tint : source_color = vec3(0.82, 0.81, 0.78);
uniform float density = 0.85;

varying float age;
varying float seed;

void vertex() {
	float sc = length(MODEL_MATRIX[0].xyz);
	age = INSTANCE_CUSTOM.y;
	vec3 at = MODEL_MATRIX[3].xyz + drift * age * lifetime + vec3(0.0, 0.25, 0.0) * age * lifetime;
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * sc, INV_VIEW_MATRIX[1] * sc, INV_VIEW_MATRIX[2] * sc, vec4(at, 1.0));
	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
	seed = fract(float(INSTANCE_ID) * 0.6180339);
}

void fragment() {
	vec2 c = UV * 2.0 - 1.0;
	float r = length(c);
	// a lumpy puff: radial falloff broken up by two octaves of noise that churn slowly
	float n = texture(noise_tex, UV * 0.55 + vec2(seed * 3.1, seed * 1.7 + age * 0.08)).r * 0.65
			+ texture(noise_tex, UV * 1.3 + vec2(seed, -age * 0.15)).r * 0.35;
	float puff = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.9);
	float fade = smoothstep(0.0, 0.03, age) * pow(1.0 - age, 1.4);
	float a = puff * density * fade;
	// soft where it meets the water or the hull
	float raw = texture(depth_tex, SCREEN_UV).r;
	vec4 vp = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, raw, 1.0);
	vp.xyz /= vp.w;
	a *= clamp((length(vp.xyz) - length(VERTEX)) / 2.5, 0.0, 1.0);
	// the core is a little darker and warmer while fresh (unburnt powder)
	vec3 col = mix(tint, tint * vec3(0.62, 0.58, 0.54), (1.0 - r) * (1.0 - age) * 0.6);
	ALBEDO = col * (0.75 + n * 0.35);
	NORMAL = normalize(vec3(c * 0.6, 1.0));
	BACKLIGHT = vec3(0.55);
	ALPHA = clamp(a, 0.0, 1.0);
}
