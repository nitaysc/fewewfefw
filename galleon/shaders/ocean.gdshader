// Open ocean.
//  - Swell: the analytic Gerstner waves the ship's physics rides on (waves.gdshaderinc).
//  - Chop: three FFT cascades simulated on the GPU (ocean_fft/, JONSWAP spectrum), with
//    foam that accumulates where crests fold over and slowly dissipates.
//  - Ship: wake foam map, foam where the sea touches the hull, refraction and absorption.
// A radial grid follows the camera: dense under the ship, coarse at the horizon.
shader_type spatial;
render_mode blend_mix, cull_back, depth_draw_always, specular_schlick_ggx;

#include "res://shaders/waves.gdshaderinc"
#define MAX_CASCADES 8

global uniform uint num_cascades;
global uniform sampler2DArray displacements;
global uniform sampler2DArray normals : hint_normal;
uniform vec4 map_scales[MAX_CASCADES]; // per cascade: uv scale (xy), displacement scale, normal scale

uniform vec2 center;
uniform float sea_time;
uniform sampler2D detail_tex : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D foam_tex : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D wake_tex : filter_linear, repeat_disable;
uniform vec2 wake_center;
uniform float wake_size = 300.0;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform vec3 deep_color : source_color = vec3(0.015, 0.09, 0.22);
uniform vec3 scatter_color : source_color = vec3(0.04, 0.45, 0.52);
uniform vec3 sun_dir = vec3(-0.55, 0.62, -0.56);
uniform float fft_strength = 1.0;
uniform sampler2D island_tex : filter_linear, repeat_disable; // ground height, metres
uniform vec4 island_rect = vec4(0.0, 0.0, 0.0, 0.0); // x0, z0, size (0 = no island)
uniform int debug_view = 0; // 1 = FFT foam, 2 = FFT slopes

varying vec2 grid;
varying vec3 world;
varying float height;

void vertex() {
	vec2 g = VERTEX.xz + center;
	float dist = length(VERTEX.xz);
	float spacing = max(0.2, dist * 0.03);
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
	// FFT chop, faded out where the grid becomes too coarse to hold it
	float dfade = clamp(exp(-(dist - 150.0) * 0.007), 0.0, 1.0) * fft_strength;
	vec3 fd = vec3(0.0);
	for (uint i = 0U; i < num_cascades; ++i) {
		vec4 s = map_scales[i];
		fd += texture(displacements, vec3(g * s.xy, float(i))).xyz * s.z;
	}
	p += fd * dfade;
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

	// swell: analytic Gerstner normal and Jacobian
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

	// FFT cascades: slopes and accumulated foam
	vec3 grad = vec3(0.0);
	for (uint i = 0U; i < num_cascades; ++i) {
		vec4 s = map_scales[i];
		grad += texture(normals, vec3(g * s.xy, float(i))).xyw * vec3(s.ww, 1.0);
	}
	float far = exp(-dist * 0.012);
	vec2 slope = grad.xy * mix(0.06, fft_strength, far);
	// very fine ripples close to the camera
	vec2 s3 = texture(detail_tex, g / 4.7 + vec2(t * 0.03, t * 0.021)).rg * 2.0 - 1.0;
	slope += s3 * 0.12 * (1.0 - smoothstep(8.0, 60.0, dist));

	// wake foam map around the ship
	vec2 wuv = (world.xz - wake_center) / wake_size + 0.5;
	vec3 wake = vec3(0.0);
	if (wuv.x > 0.0 && wuv.x < 1.0 && wuv.y > 0.0 && wuv.y < 1.0) {
		wake = texture(wake_tex, wuv).rgb;
	}
	// the wake band is choppier (small breaking ripples) and the Kelvin arms ride as waves
	slope += vec2(sin(g.x * 1.7 + t * 3.1), cos(g.y * 1.9 - t * 2.6)) * wake.g * 0.35;

	// the island: turquoise shallows over sand, and surf breaking along the shore
	float surf = 0.0;
	float shallow = 0.0;
	if (island_rect.z > 0.0) {
		vec2 iuv = (world.xz - island_rect.xy) / island_rect.z;
		if (iuv.x > 0.0 && iuv.x < 1.0 && iuv.y > 0.0 && iuv.y < 1.0) {
			float ground = texture(island_tex, iuv).r;
			float wd = world.y - ground;
			shallow = 1.0 - smoothstep(0.0, 14.0, wd);
			// lines of breakers marching in, strongest right at the beach
			float lines = 0.5 + 0.5 * sin(wd * 2.2 - t * 1.6 + texture(foam_tex, g * 0.01).r * 6.0);
			surf = (1.0 - smoothstep(0.0, 2.2, wd)) * (0.55 + 0.45 * lines) + (1.0 - smoothstep(0.0, 5.0, wd)) * smoothstep(0.75, 1.0, lines) * 0.6;
			surf *= step(-1.5, wd);
		}
	}

	n.xz -= slope;
	vec3 N = normalize(n);

	// water thickness behind this pixel: absorption, refraction and contact foam
	float raw = texture(depth_tex, SCREEN_UV).r;
	vec4 vp = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, raw, 1.0);
	vp.xyz /= vp.w;
	float thickness = max(0.0, length(vp.xyz) - length(VERTEX));
	vec2 off = N.xz * 0.035 * clamp(thickness * 0.3, 0.0, 1.0) / max(1.0, dist * 0.02);
	float raw2 = texture(depth_tex, SCREEN_UV + off).r;
	vec4 vp2 = INV_PROJECTION_MATRIX * vec4((SCREEN_UV + off) * 2.0 - 1.0, raw2, 1.0);
	vp2.xyz /= vp2.w;
	bool behind = length(vp2.xyz) > length(VERTEX);
	vec2 ruv = behind ? SCREEN_UV + off : SCREEN_UV;
	float thick2 = clamp(behind ? length(vp2.xyz) - length(VERTEX) : thickness, 0.0, 1000.0);
	vec3 refr = textureLod(screen_tex, ruv, 0.0).rgb;

	// foam: breaking crests (FFT, accumulated over time), swell crests, wake, hull contact
	float fn = texture(foam_tex, g * 0.06 + vec2(t * 0.008, 0.0)).r * 0.55
			+ texture(foam_tex, g * 0.17 - vec2(0.0, t * 0.011)).r * 0.45;
	float fft_foam = smoothstep(0.0, 1.0, grad.z * 0.8) * exp(-dist * 0.004);
	float crest = smoothstep(0.7, 0.3, jac) * smoothstep(0.0, 1.2, height) * 0.6;
	float contact = (1.0 - smoothstep(0.0, 1.3, thickness)) * smoothstep(300.0, 0.0, dist);
	float amt = clamp(max(max(max(max(fft_foam, crest), wake.r), contact), surf), 0.0, 1.0);
	float foam = smoothstep(1.0 - amt, 1.0 - amt + 0.35, fn) * min(1.0, amt * 2.2);
	foam = max(foam, smoothstep(0.55, 1.0, fft_foam) * 0.8);
	foam = max(foam, smoothstep(0.8, 1.0, wake.r) * 0.85);
	float film = amt * 0.25; // a translucent sheet of bubbles under the lace

	// light
	vec3 L = normalize(sun_dir);
	float ndv = clamp(dot(N, V), 0.0, 1.0);
	float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
	float trans = exp(-thick2 * 0.3);
	float sss = pow(clamp(dot(V, -normalize(L + N * 0.6)), 0.0, 1.0), 3.0) * 1.3 + 0.2 * clamp(dot(N, L), 0.0, 1.0);
	// churned water: bubbles make it paler and a little greener, not neon turquoise
	vec3 glow = scatter_color * (sss * smoothstep(-1.0, 2.0, height) * 0.5 + film * 0.35) + vec3(0.03, 0.09, 0.09) * wake.g;
	vec3 seen = mix(deep_color * 0.9, refr * vec3(0.3, 0.75, 0.82), trans);
	seen += vec3(0.02, 0.2, 0.17) * shallow * (1.0 - trans * 0.5);

	ALBEDO = mix(deep_color * 0.25, vec3(0.88, 0.9, 0.92), foam);
	EMISSION = (seen * 0.85 + glow) * (1.0 - fres) * (1.0 - foam);
	// specular anti-aliasing: widen the highlight where the normal varies faster than a pixel
	vec3 dn = fwidth(N);
	float variance = clamp(dot(dn, dn) * 4.0, 0.0, 0.25);
	float base_rough = mix(0.04, 0.16, smoothstep(30.0, 900.0, dist));
	ROUGHNESS = mix(sqrt(base_rough * base_rough + variance), 0.85, foam);
	SPECULAR = mix(0.35, 0.2, foam);
	METALLIC = 0.0;
	NORMAL = normalize((VIEW_MATRIX * vec4(N, 0.0)).xyz);
	if (debug_view == 1) { EMISSION = vec3(grad.z); ALBEDO = vec3(0.0); }
	if (debug_view == 3) { EMISSION = vec3(float(num_cascades) / 3.0, map_scales[0].x * 50.0, texture(normals, vec3(fract(g / 88.0), 0.0)).w); ALBEDO = vec3(0.0); }
	if (debug_view == 2) { EMISSION = vec3(abs(grad.xy), 0.0); ALBEDO = vec3(0.0); }
}
