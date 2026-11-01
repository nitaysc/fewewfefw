# FFT ocean (from GodotOceanWaves)

The FFT wave generator, foam accumulation and sea-spray particles in this folder come from
[GodotOceanWaves](https://github.com/2Retr0/GodotOceanWaves) by Ethan Truong (MIT, see LICENSE),
lightly adapted (resource paths, no editor tooling). The Galleon's own ocean shader
(`../shaders/ocean.gdshader`) layers these FFT cascades over the Gerstner swell that the ship's
physics rides on, and adds the wake, hull contact foam and refraction.
