// Open ocean. A radial grid that follows the camera, displaced by the same
// Gerstner waves the physics uses (waves.gdshaderinc, generated from waves.gd), with FFT
// detail normals, refraction and absorption, whitecaps on pinched crests,
// foam where the sea meets the hull, and the ship's wake from a foam map.
shader_type spatial;
render_mode blend_mix, cull_back, depth_draw_always, specular_schlick_ggx;

#include "res://shaders/waves.gdshaderinc"

uniform vec2 center;
uniform float sea_time;
uniform sampler2D detail_tex : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D foam_tex : filter_linear_mipmap, repeat_enable;
uniform sampler2D wake_tex : filter_linear, repeat_disable;
uniform vec2 wake_center;
uniform float wake_size = 300.0;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform vec3 deep_color : source_color = vec3(0.02, 0.11, 0.24);
uniform vec3 scatter_color : source_color = vec3(0.05, 0.42, 0.50);
uniform vec3 sun_dir = vec3(-0.55, 0.62, -0.56);
uniform float detail_strength = 0.75;

varying vec2 grid;
varying vec3 world;
varying float height;

void vertex() {
	vec2 g = VERTEX.xz + center;
	float dist = length(VERTEX.xz);
	float spacing = max(0.25, dist * 0.035);
	vec3 p = vec3(g.x, 0.0, g.y);
	for (int i = 0; i < NW; i++) {
		vec4 a = WA[i];
		vec4 b = WB[i];
		float fade = smoothstep(spacing * 3.0, spacing * 6.0, b.w);
		float f = a.z * dot(a.xy, g) - b.x * sea_time + b.z;
		float h = b.y * a.w * cos(f) * fade;
		p.x += a.x * h;
		p.z += a.y * h;
		p.y += a.w * sin(f) * fade;
	}
	grid = g;
	world = p;
	height = p.y;
	VERTEX = p;
}

void fragment() {
	vec3 cam = CAMERA_POSITION_WORLD;
	float dist = length(world - cam);
	vec3 V = normalize(cam - world);
	vec2 g = grid;
	float t = sea_time;

	// swell: analytic Gerstner normal and Jacobian (folding -> whitecaps)
	vec3 n = vec3(0.0, 1.0, 0.0);
	float jxx = 1.0, jzz = 1.0, jxz = 0.0;
	for (int i = 0; i < NW; i++) {
		vec4 a = WA[i];
		vec4 b = WB[i];
		float f = a.z * dot(a.xy, g) - b.x * t + b.z;
		float ka = a.z * a.w;
		float c = cos(f), s = sin(f);
		n.x -= a.x * ka * c;
		n.z -= a.y * ka * c;
		n.y -= b.y * ka * s;
		float q = b.y * ka * s;
		jxx -= a.x * a.x * q;
		jzz -= a.y * a.y * q;
		jxz -= a.x * a.y * q;
	}
	float jac = jxx * jzz - jxz * jxz;

	// chop: two scrolling layers of an FFT ocean patch
	float fade = 1.0 - smoothstep(80.0, 900.0, dist);
	vec2 s1 = texture(detail_tex, g / 48.0 + vec2(t * 0.011, t * 0.006)).rg * 2.0 - 1.0;
	vec2 s2 = texture(detail_tex, g / 15.0 + vec2(-t * 0.017, t * 0.013)).rg * 2.0 - 1.0;
	vec2 s3 = texture(detail_tex, g / 5.3 + vec2(t * 0.03, t * 0.021)).rg * 2.0 - 1.0;
	vec2 slope = s1 * 0.75 + s2 * 0.5 * fade + s3 * 0.3 * (1.0 - smoothstep(10.0, 90.0, dist));

	// wake foam map around the ship
	vec2 wuv = (world.xz - wake_center) / wake_size + 0.5;
	vec3 wake = vec3(0.0);
	if (wuv.x > 0.0 && wuv.x < 1.0 && wuv.y > 0.0 && wuv.y < 1.0) {
		wake = texture(wake_tex, wuv).rgb;
	}
	slope += vec2(sin(g.x * 1.7 + t * 3.1), cos(g.y * 1.9 - t * 2.6)) * wake.g * 0.25;

	n.xz -= slope * detail_strength;
	vec3 N = normalize(n);

	// water depth behind this pixel, for absorption and contact foam
	float raw = texture(depth_tex, SCREEN_UV).r;
	vec4 vp = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, raw, 1.0);
	vp.xyz /= vp.w;
	float thickness = max(0.0, length(vp.xyz) - length(VERTEX));
	vec2 off = N.xz * 0.04 * clamp(thickness * 0.3, 0.0, 1.0) / max(1.0, dist * 0.02);
	float raw2 = texture(depth_tex, SCREEN_UV + off).r;
	vec4 vp2 = INV_PROJECTION_MATRIX * vec4((SCREEN_UV + off) * 2.0 - 1.0, raw2, 1.0);
	vp2.xyz /= vp2.w;
	vec2 ruv = (length(vp2.xyz) > length(VERTEX)) ? SCREEN_UV + off : SCREEN_UV;
	float thick2 = (length(vp2.xyz) > length(VERTEX)) ? length(vp2.xyz) - length(VERTEX) : thickness;
	thick2 = clamp(thick2, 0.0, 1000.0);
	vec3 refr = textureLod(screen_tex, ruv, 0.0).rgb;

	// foam
	float fn = texture(foam_tex, g * 0.07 + vec2(t * 0.01, 0.0)).r * 0.6
			+ texture(foam_tex, g * 0.19 - vec2(0.0, t * 0.013)).r * 0.4;
	float crest = smoothstep(0.7, 0.3, jac) * smoothstep(-0.2, 1.0, height + 0.4);
	crest = max(crest, smoothstep(0.55, 0.85, texture(detail_tex, g / 48.0 + vec2(t * 0.011, t * 0.006)).b) * smoothstep(0.2, 1.4, height) * 0.7);
	float contact = (1.0 - smoothstep(0.0, 1.4, thickness)) * smoothstep(400.0, 0.0, dist);
	float amt = clamp(max(max(crest * 0.85, wake.r), contact), 0.0, 1.0);
	float foam = smoothstep(1.0 - amt, 1.0 - amt + 0.3, fn) * min(1.0, amt * 2.5);
	foam = max(foam, smoothstep(0.8, 1.0, wake.r) * 0.85);

	// light
	vec3 L = normalize(sun_dir);
	float ndv = clamp(dot(N, V), 0.0, 1.0);
	float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
	float trans = exp(-thick2 * 0.28);
	vec3 body = deep_color;
	// light scattered through thin, sunlit crests and churned water
	float sss = pow(clamp(dot(V, -normalize(L + N * 0.6)), 0.0, 1.0), 3.0) * 1.2 + 0.25 * clamp(dot(N, L), 0.0, 1.0);
	vec3 glow = scatter_color * (sss * smoothstep(-0.8, 1.6, height) * 0.55 + wake.g * 0.9);
	vec3 seen = mix(body * 0.9, refr * vec3(0.35, 0.8, 0.85), trans);

	ALBEDO = mix(body * 0.25, vec3(0.9, 0.93, 0.95), foam);
	EMISSION = (seen * 0.85 + glow) * (1.0 - fres) * (1.0 - foam);
	ROUGHNESS = mix(mix(0.02, 0.12, smoothstep(30.0, 900.0, dist)), 0.85, foam);
	SPECULAR = mix(0.35, 0.2, foam);
	METALLIC = 0.0;
	NORMAL = normalize((VIEW_MATRIX * vec4(N, 0.0)).xyz);
}
