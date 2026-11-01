// The bow wave: a sheet of white water piled up against the stem that peels
// outward and falls back along the hull. The mesh (bow_wave.gd) only gives the
// layout: UV.x runs from the stem aft, UV.y from the hull out to the lip. The
// height is built here on top of the real sea surface (swell + FFT chop).
shader_type spatial;
render_mode world_vertex_coords, blend_mix, depth_draw_never, cull_disabled, specular_schlick_ggx;

#include "res://shaders/waves.gdshaderinc"
#define MAX_CASCADES 8
global uniform uint num_cascades;
global uniform sampler2DArray displacements;
uniform vec4 map_scales[MAX_CASCADES];

uniform float sea_time;
uniform float speed = 0.0;      // ship speed through the water, m/s
uniform float surge = 0.0;      // extra height while the bow plunges
uniform sampler2D foam_tex : filter_linear_mipmap, repeat_enable;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;

varying float along;
varying float across;
varying float strength;

float sea_height(vec2 xz) {
	// undo the sideways Gerstner shift (two fixed-point steps), then add the chop
	vec2 p = xz;
	for (int k = 0; k < 2; k++) {
		vec2 off = vec2(0.0);
		for (int i = 0; i < NW; i++) {
			float f = WA[i].z * dot(WA[i].xy, p) - WB[i].x * sea_time + WB[i].z;
			off += WA[i].xy * WB[i].y * WA[i].w * cos(f);
		}
		p = xz - off;
	}
	float h = 0.0;
	for (int i = 0; i < NW; i++) {
		h += WA[i].w * sin(WA[i].z * dot(WA[i].xy, p) - WB[i].x * sea_time + WB[i].z);
	}
	for (uint i = 0U; i < num_cascades; ++i) {
		h += texture(displacements, vec3(xz * map_scales[i].xy, float(i))).y * map_scales[i].z;
	}
	return h;
}

void vertex() {
	along = UV.x;
	across = UV.y;
	float sp = clamp((speed - 0.4) / 3.2, 0.0, 1.0);
	strength = sp;
	// tallest just aft of the stem, dying away along the hull
	float rise = smoothstep(0.0, 0.12, along) * (1.0 - smoothstep(0.18, 1.0, along));
	float height = (1.9 * sp + surge) * rise;
	// the sheet climbs from the hull, crests and curls back down to the sea
	float arc = sin(PI * across * 0.92);
	vec3 p = VERTEX;
	p.y = sea_height(p.xz) + height * arc - 0.15;
	// wobble the lip so it never looks rigid
	p.y += sin(sea_time * 6.0 + along * 23.0) * 0.08 * across * sp;
	VERTEX = p;
}

void fragment() {
	// foam flows aft along the sheet
	vec2 fuv = vec2(along * 6.0 - sea_time * (0.25 + strength * 0.6), across * 1.4);
	float f1 = texture(foam_tex, fuv).r;
	float f2 = texture(foam_tex, fuv * 2.3 + vec2(0.37, sea_time * 0.11)).r;
	float foam = f1 * 0.6 + f2 * 0.4;
	// the breaking crest carries the white foam; the climbing face is clear green water
	float edge = across + (foam - 0.5) * 0.5;
	float crest = smoothstep(0.25, 0.6, across) * (1.0 - smoothstep(0.8, 1.0, edge));
	float white = clamp(smoothstep(0.42, 0.72, foam) * crest + smoothstep(0.62, 0.85, foam) * 0.35 * (1.0 - smoothstep(0.85, 1.0, edge)), 0.0, 1.0);
	float water_a = (1.0 - smoothstep(0.1, 0.85, across)) * 0.5;
	float body = smoothstep(0.0, 0.18, along) * (1.0 - smoothstep(0.7, 1.0, along)) * smoothstep(0.0, 0.06, across);
	float a = body * strength * max(water_a, white);

	// soft contact with the water and hull behind
	float raw = texture(depth_tex, SCREEN_UV).r;
	vec4 vp = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, raw, 1.0);
	vp.xyz /= vp.w;
	a *= clamp((length(vp.xyz) - length(VERTEX)) / 0.6, 0.0, 1.0);

	vec3 green = vec3(0.03, 0.3, 0.34); // thin water lit from behind
	ALBEDO = mix(green, vec3(0.92, 0.95, 0.97), white);
	NORMAL = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
	if (!FRONT_FACING) NORMAL = -NORMAL;
	SPECULAR = 0.3;
	BACKLIGHT = vec3(0.35, 0.45, 0.45);
	ROUGHNESS = mix(0.08, 0.7, white);
	ALPHA = clamp(a * 1.3, 0.0, 0.92);
}
