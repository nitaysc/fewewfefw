// Bakes the sky panorama once at start-up: a physically-inspired raymarch through a
// layer of 3D cumulus clouds (Beer-Lambert extinction, "powder" darkening, a
// two-lobe Henyey-Greenstein phase for the silver lining, ambient sky light from
// above and sea light from below), over a simple Rayleigh/Mie sky gradient.
// Output: HDR colour, alpha = cloud opacity (so the sun disc can be hidden behind clouds).
// Mapping: x = azimuth (0..1 around), y = 0 at the zenith .. 1 at the horizon,
// elevation = pi/2 * (1 - y)^1.6 so most pixels sit near the horizon where you look.
shader_type canvas_item;
render_mode unshaded, blend_disabled;

uniform vec2 size = vec2(4096.0, 1024.0);
uniform vec3 sun_dir = vec3(0.4, 0.6, 0.5);
uniform float coverage = 0.48;
uniform float seed = 3.7;

const float H0 = 900.0;   // cloud base (m)
const float H1 = 2600.0;  // highest tops (m)
const vec3 SUN = vec3(1.0, 0.95, 0.86) * 7.5;

float hash13(vec3 p) {
	p = fract(p * 0.1031);
	p += dot(p, p.zyx + 31.32);
	return fract((p.x + p.y) * p.z);
}

float noise3(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
				   mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
			   mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
				   mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm(vec3 p, int octaves) {
	float v = 0.0, a = 0.5, n = 0.0;
	for (int i = 0; i < octaves; i++) {
		v += a * noise3(p);
		n += a;
		p = p * 2.03 + vec3(17.1, 3.7, 9.2);
		a *= 0.5;
	}
	return v / n;
}

// large-scale cloud coverage (2D) and how tall each cloud grows there
vec2 weather(vec2 xz) {
	float c = fbm(vec3(xz * 0.00034, seed), 4);
	float cov = smoothstep(1.0 - coverage, 1.0 - coverage + 0.18, c);
	return vec2(cov, smoothstep(0.2, 0.9, c));
}

float density(vec3 p, bool cheap) {
	float h = (p.y - H0) / (H1 - H0);
	if (h < 0.0 || h > 1.0) return 0.0;
	vec2 w = weather(p.xz);
	if (w.x <= 0.0) return 0.0;
	float top = mix(0.35, 1.0, w.y);
	// flat bases, rounded cauliflower tops
	float profile = smoothstep(0.0, 0.14, h) * (1.0 - smoothstep(top * 0.55, top, h));
	float base = fbm(p * vec3(0.0017, 0.0024, 0.0017) + vec3(0.0, seed, 0.0), cheap ? 3 : 5);
	float d = w.x * profile - (1.0 - base) * 0.62;
	if (!cheap && d > 0.0) {
		// wispy erosion at the edges
		d -= (1.0 - fbm(p * 0.009, 2)) * 0.22 * (1.0 - d);
	}
	return clamp(d * 5.0, 0.0, 1.0);
}

float hg(float c, float g) {
	return (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * c, 1.5));
}

vec3 atmosphere(vec3 d, vec3 s) {
	float e = max(d.y, 0.0);
	vec3 zenith = vec3(0.13, 0.33, 0.74);
	vec3 horizon = vec3(0.66, 0.77, 0.88);
	vec3 col = mix(horizon, zenith, pow(e, 0.42));
	float mu = max(dot(d, s), 0.0);
	col += vec3(1.0, 0.82, 0.6) * pow(mu, 8.0) * 0.35 + vec3(1.0, 0.9, 0.75) * pow(mu, 80.0) * 1.2;
	return col;
}

void fragment() {
	vec2 uv = FRAGCOORD.xy / size;
	float phi = uv.x * 2.0 * PI;
	float elev = 0.5 * PI * pow(1.0 - uv.y, 1.6);
	vec3 d = normalize(vec3(cos(elev) * sin(phi), sin(elev), -cos(elev) * cos(phi)));
	vec3 s = normalize(sun_dir);
	vec3 sky = atmosphere(d, s);

	float t0 = H0 / max(d.y, 0.012);
	float t1 = H1 / max(d.y, 0.012);
	float tmax = 42000.0;
	vec3 col = vec3(0.0);
	float T = 1.0;
	if (t0 < tmax) {
		t1 = min(t1, t0 + 9000.0);
		const int STEPS = 56;
		float dt = (t1 - t0) / float(STEPS);
		float t = t0 + dt * hash13(vec3(FRAGCOORD.xy, 1.0));
		float cos_sun = dot(d, s);
		float phase = mix(hg(cos_sun, 0.75), hg(cos_sun, -0.2), 0.35) * 4.0 * PI;
		for (int i = 0; i < STEPS; i++) {
			vec3 p = d * t;
			float dens = density(p, false);
			if (dens > 0.001) {
				// light march toward the sun
				float od = 0.0;
				float ls = 70.0;
				vec3 q = p;
				for (int j = 0; j < 6; j++) {
					q += s * ls;
					od += density(q, true) * ls;
					ls *= 1.6;
				}
				float sigma = 0.035;
				float beer = exp(-od * sigma * 0.9);
				float powder = 1.0 - exp(-od * sigma * 2.0);
				float hfrac = clamp((p.y - H0) / (H1 - H0), 0.0, 1.0);
				vec3 ambient = mix(vec3(0.26, 0.32, 0.42), vec3(0.75, 0.82, 0.95), hfrac) * 0.75;
				vec3 lit = SUN * beer * mix(1.0, powder * 1.8, 0.4) * phase * 0.2 + ambient;
				// aerial perspective: distant clouds melt into the haze
				float haze = 1.0 - exp(-t / 26000.0);
				lit = mix(lit, sky * 1.1, haze);
				float a = 1.0 - exp(-dens * sigma * dt);
				col += T * a * lit;
				T *= 1.0 - a;
				if (T < 0.01) break;
			}
			t += dt;
		}
	}
	// fade the whole cloud layer out right at the horizon
	float fade = smoothstep(0.0, 0.03, d.y);
	vec3 outc = sky * mix(1.0, T, fade) + col * fade;
	COLOR = vec4(outc, (1.0 - T) * fade);
}
