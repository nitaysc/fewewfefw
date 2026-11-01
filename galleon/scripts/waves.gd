extends Node
## The sea surface: a sum of Gerstner (trochoidal) waves.
## The same numbers are written into the ocean shader, so the ship's buoyancy
## (ship.gd) rides exactly the waves on screen.

const GRAVITY := 9.81
const WIND_ANGLE := 0.55 ## direction the wind blows TOWARD, on the x/z plane
const WIND_SPEED := 11.0 ## m/s, a fresh breeze

## [wavelength m, amplitude m, direction offset rad, choppiness, phase]
const SPEC := [
	[96.0, 0.85, 0.0, 0.95, 0.0],
	[61.0, 0.6, -0.38, 1.05, 1.3],
	[43.0, 0.45, 0.47, 1.1, 2.1],
	[29.0, 0.31, -0.72, 1.15, 4.0],
	[19.0, 0.21, 0.26, 1.2, 0.7],
	[12.5, 0.13, -0.15, 1.25, 5.2],
	[8.1, 0.08, 0.9, 1.3, 3.3],
	[5.3, 0.05, -1.05, 1.3, 1.9],
]

var time := 0.0
var waves: Array = [] ## each: {k, a, dx, dz, w, chop, phase, l}


func _init() -> void:
	for s in SPEC:
		var k: float = TAU / s[0]
		var ang: float = WIND_ANGLE + s[2]
		waves.append({
			"l": s[0], "a": s[1], "k": k, "dx": cos(ang), "dz": sin(ang),
			"w": sqrt(GRAVITY * k), "chop": s[3], "phase": s[4],
		})


func wind() -> Vector3:
	return Vector3(cos(WIND_ANGLE), 0.0, sin(WIND_ANGLE)) * WIND_SPEED


## Displacement of the undisturbed surface point (x, z) at time t.
func displacement(x: float, z: float, t: float) -> Vector3:
	var o := Vector3.ZERO
	for v in waves:
		var f: float = v.k * (v.dx * x + v.dz * z) - v.w * t + v.phase
		var h: float = v.chop * v.a * cos(f)
		o.x += v.dx * h
		o.z += v.dz * h
		o.y += v.a * sin(f)
	return o


## Water height under world position (x, z): undoes the sideways Gerstner shift.
func height_at(x: float, z: float, t: float = -1.0) -> float:
	if t < 0.0:
		t = time
	var px := x
	var pz := z
	for i in 4:
		var d := displacement(px, pz, t)
		px = x - d.x
		pz = z - d.z
	return displacement(px, pz, t).y


## GLSL constants for the ocean shader, generated from the same table.
func glsl_constants() -> String:
	var a := PackedStringArray()
	var b := PackedStringArray()
	for v in waves:
		a.append("vec4(%f, %f, %f, %f)" % [v.dx, v.dz, v.k, v.a])
		b.append("vec4(%f, %f, %f, %f)" % [v.w, v.chop, v.phase, v.l])
	return "const int NW = %d;\nconst vec4 WA[NW] = vec4[NW](%s);\nconst vec4 WB[NW] = vec4[NW](%s);\n" % [
		waves.size(), ", ".join(a), ", ".join(b)]
