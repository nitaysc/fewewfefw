extends Node
## Sea trials (run headless in CI): godot --headless res://test/sea_trials.tscn
## Checks the ship floats, sails, can't sail into the wind, answers the helm,
## and that the ocean shader's wave table matches the physics.

const ShipScript := preload("res://scripts/ship.gd")
var failed := 0


func check(ok: bool, msg: String) -> void:
	print(("ok   " if ok else "FAIL ") + msg)
	if not ok:
		failed += 1


func sail(heading: float, sail_target: float, rudder: float, seconds: float) -> Dictionary:
	var s = ShipScript.new()
	add_child(s)
	s.transform = Transform3D(Basis(Vector3.UP, heading), Vector3.ZERO)
	s.sail_target = sail_target
	s.sail = sail_target
	s.rudder = rudder
	var r := {"max_roll": 0.0, "max_pitch": 0.0, "min_y": 1e9, "max_y": -1e9, "turned": 0.0}
	var last: float = s.heading()
	for i in int(seconds * 30):
		s.step(1.0 / 30.0)
		if i > 300:
			var a: Vector2 = s.attitude()
			r.max_roll = maxf(r.max_roll, absf(a.x))
			r.max_pitch = maxf(r.max_pitch, absf(a.y))
			r.min_y = minf(r.min_y, s.position.y)
			r.max_y = maxf(r.max_y, s.position.y)
		r.turned += wrapf(s.heading() - last, -PI, PI)
		last = s.heading()
	r.ship = s
	return r


func _ready() -> void:
	var inc := FileAccess.get_file_as_string("res://shaders/waves.gdshaderinc")
	check(inc.ends_with(Waves.glsl_constants()), "ocean shader waves match the physics (else run test/gen_waves_inc.gd)")

	var worst := 0.0
	for i in 200:
		var x := randf_range(-200, 200)
		var z := randf_range(-200, 200)
		var t := randf_range(0, 100)
		var d: Vector3 = Waves.displacement(x, z, t)
		worst = maxf(worst, absf(Waves.height_at(x + d.x, z + d.z, t) - d.y))
	check(worst < 0.05, "water height lookup is accurate (worst %.4f m)" % worst)

	var w: Vector3 = Waves.wind()
	var wind_from := atan2(-w.x, -w.z)

	var r := sail(0.0, 0.0, 0.0, 60.0)
	check(r.min_y > -2.5 and r.max_y < 2.5, "floats at the right height (y %.2f .. %.2f)" % [r.min_y, r.max_y])
	check(r.max_roll < 14.0 and r.max_pitch < 8.0, "rides the swell (roll %.1f°, pitch %.1f°)" % [r.max_roll, r.max_pitch])

	r = sail(wind_from + 2.3, 1.0, 0.0, 90.0)
	var kn: float = r.ship.speed() * 1.944
	check(kn > 5.0 and kn < 13.0, "full sail on a broad reach makes %.1f knots" % kn)
	check(r.max_roll < 16.0, "stays upright under sail (max roll %.1f°)" % r.max_roll)

	r = sail(wind_from, 1.0, 0.0, 60.0)
	check(r.ship.speed() < 0.6, "head to wind it makes no headway (%.1f knots)" % (r.ship.speed() * 1.944))

	r = sail(wind_from + 2.3, 1.0, 1.0, 60.0)
	var deg := rad_to_deg(r.turned)
	check(deg < -60.0, "starboard helm turns her clockwise (%.0f° in 60 s)" % deg)

	print("\n%s" % ("all sea trials passed" if failed == 0 else "%d check(s) failed" % failed))
	get_tree().quit(1 if failed else 0)
