// Spray thrown up by the bow: soft droplet clouds that tear apart (dissolve) as they age.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled;

uniform sampler2D albedo_texture : source_color, filter_linear_mipmap;
uniform sampler2D dissolve_texture : filter_linear_mipmap, repeat_enable;
uniform float max_alpha = 0.75;
uniform vec3 tint : source_color = vec3(0.95, 0.97, 1.0);

varying float age;
varying float seed;

void vertex() {
	// face the camera, keep the particle's scale
	float sc = length(MODEL_MATRIX[0].xyz);
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * sc, INV_VIEW_MATRIX[1] * sc, INV_VIEW_MATRIX[2] * sc, MODEL_MATRIX[3]);
	age = INSTANCE_CUSTOM.y;
	seed = fract(MODEL_MATRIX[3].x * 0.137 + MODEL_MATRIX[3].z * 0.311);
}

void fragment() {
	vec4 tex = texture(albedo_texture, UV);
	float d = texture(dissolve_texture, UV * 0.8 + vec2(seed, TIME * 0.2)).r;
	ALBEDO = tint * (0.85 + 0.15 * tex.r);
	ALPHA = tex.a * max_alpha * clamp((1.0 - age) * 1.6 - d * 0.9, 0.0, 1.0) * smoothstep(0.0, 0.08, age);
}
