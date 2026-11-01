// Muzzle flash: a short tongue of fire, additive, gone in a tenth of a second.
shader_type spatial;
render_mode blend_add, cull_disabled, depth_draw_never, shadows_disabled, unshaded, fog_disabled;

varying float age;

void vertex() {
	float sc = length(MODEL_MATRIX[0].xyz);
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * sc, INV_VIEW_MATRIX[1] * sc, INV_VIEW_MATRIX[2] * sc, MODEL_MATRIX[3]);
	age = INSTANCE_CUSTOM.y;
}

void fragment() {
	vec2 c = UV * 2.0 - 1.0;
	float r = length(c);
	float core = smoothstep(1.0, 0.0, r);
	vec3 col = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.92, 0.6), core * core);
	ALBEDO = col * core * 6.0 * (1.0 - age);
}
