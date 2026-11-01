// A flag or pennant streaming in the wind (the node is turned downwind by ship.gd).
shader_type spatial;
render_mode cull_disabled;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform vec3 tint : source_color = vec3(1.0);
uniform bool use_tex = true;

void vertex() {
	float s = UV.x;
	float w = sin(TIME * 7.0 - s * 9.0 + UV.y * 1.5) * 0.4 + sin(TIME * 12.0 - s * 15.0) * 0.12;
	VERTEX.z += w * s * 1.2;
	VERTEX.y -= s * s * 0.25;
	NORMAL = normalize(vec3(-cos(TIME * 7.0 - s * 9.0) * 0.6 * s, 0.0, 1.0));
}

void fragment() {
	ALBEDO = use_tex ? texture(albedo_tex, UV).rgb : tint;
	ROUGHNESS = 0.85;
	BACKLIGHT = vec3(0.25);
}
