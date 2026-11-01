// Bow mist: soft, sunlit clouds of fine spray that thin out and tear apart as they
// age, fading where they touch the water so they never show hard edges.
shader_type spatial;
render_mode cull_disabled, depth_draw_never, shadows_disabled, specular_disabled;

uniform sampler2D albedo_texture : source_color, filter_linear_mipmap;
uniform sampler2D dissolve_texture : filter_linear_mipmap, repeat_enable;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform float max_alpha = 0.16;

varying float age;
varying float seed;

void vertex() {
	float sc = length(MODEL_MATRIX[0].xyz);
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * sc, INV_VIEW_MATRIX[1] * sc, INV_VIEW_MATRIX[2] * sc, MODEL_MATRIX[3]);
	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
	age = INSTANCE_CUSTOM.y;
	seed = fract(MODEL_MATRIX[3].x * 0.137 + MODEL_MATRIX[3].z * 0.311);
}

void fragment() {
	vec4 tex = texture(albedo_texture, UV);
	float d = texture(dissolve_texture, UV * 0.7 + vec2(seed, TIME * 0.15)).r;
	float a = tex.a * max_alpha * clamp((1.0 - age) * 1.5 - d * 0.8, 0.0, 1.0) * smoothstep(0.0, 0.1, age);
	float raw = texture(depth_tex, SCREEN_UV).r;
	vec4 vp = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, raw, 1.0);
	vp.xyz /= vp.w;
	a *= clamp((length(vp.xyz) - length(VERTEX)) / 1.5, 0.0, 1.0);
	ALBEDO = vec3(0.92, 0.94, 0.96);
	NORMAL = vec3(0.0, 0.0, 1.0);
	BACKLIGHT = vec3(0.8); // spray glows when the sun is behind it
	ALPHA = a;
}
