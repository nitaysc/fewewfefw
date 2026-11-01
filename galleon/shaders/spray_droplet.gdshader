// Spray droplets: small streaks stretched along their flight path (the particle
// system aligns the quad's Y axis with the velocity).
shader_type spatial;
render_mode cull_disabled, depth_draw_never, shadows_disabled, unshaded;

uniform vec3 light_color : source_color = vec3(1.0, 0.98, 0.94);

varying float age;

void vertex() {
	age = INSTANCE_CUSTOM.y;
}

void fragment() {
	vec2 c = UV * 2.0 - 1.0;
	float streak = (1.0 - smoothstep(0.2, 1.0, abs(c.x))) * (1.0 - smoothstep(0.4, 1.0, abs(c.y)));
	ALBEDO = light_color * 0.95;
	ALPHA = streak * 0.45 * (1.0 - age) * smoothstep(0.0, 0.05, age);
}
