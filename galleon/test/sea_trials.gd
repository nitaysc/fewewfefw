extends Node
## Sea trials (run headless in CI): godot --headless res://test/sea_trials.tscn
## Checks the ship floats, sails, can't sail into the wind, answers the helm,
## and that the ocean shader's wave table matches the physics.

const ShipScript := preload("res://scripts/ship.gd")
const GunneryScript := preload("res://scripts/gunnery.gd")
const CaptainScript := preload("res://scripts/captain.gd")


class FlatShoal:
	func height(_x: float, _z: float) -> float:
		return -1.2
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

	# --- gunnery and damage
	var e300: float = GunneryScript.aim_elevation(300.0)
	check(absf(GunneryScript.range_at(e300) - 300.0) < 6.0, "guns laid for 300 m drop the shot at %.0f m (%.2f°)" % [GunneryScript.range_at(e300), rad_to_deg(e300)])
	var r0: float = GunneryScript.range_at(0.0)
	var rmax: float = GunneryScript.range_at(0.2)
	check(r0 > 120.0 and r0 < 400.0 and rmax > 1200.0, "point-blank range %.0f m, at full elevation %.0f m" % [r0, rmax])
	check(ShipScript.inside_hull(Vector3(0, 0, 0)) and ShipScript.inside_hull(Vector3(4.5, 1.9, 0)) and not ShipScript.inside_hull(Vector3(6.5, 1.0, 0)) and not ShipScript.inside_hull(Vector3(0, 1, 21)), "shot hits the hull, misses beside it")
	for side in [1.0, -1.0]:
		for m in ShipScript.muzzles(side):
			if ShipScript.inside_hull(m):
				check(false, "muzzle %s is outside the hull" % m)

	var holed = sail(0.0, 0.0, 0.0, 1.0).ship
	holed.take_hit(holed.position + Vector3(4.5, -0.5, 0.0), Vector3(-1, 0, 0), 3300.0)
	for i in 60 * 30:
		holed.step(1.0 / 30.0)
	check(holed.position.y > -2.6 and not holed.sinking, "one shot below the waterline: the pumps keep up (water %.0f t)" % holed.flood)

	var wreck = sail(0.0, 0.0, 0.0, 1.0).ship
	while not wreck.sinking:
		wreck.take_hit(wreck.position + Vector3(-4.5, 0.5, 2.0), Vector3(1, 0, 0), 3300.0)
	var t_sink := 0.0
	while wreck.position.y > -12.0 and t_sink < 180.0:
		wreck.step(1.0 / 30.0)
		t_sink += 1.0 / 30.0
	check(t_sink < 120.0, "a shattered hull founders (under in %.0f s, %d t of water)" % [t_sink, int(wreck.flood)])

	var grounded = ShipScript.new()
	add_child(grounded)
	grounded.terrain = FlatShoal.new()
	grounded.transform = Transform3D(Basis(Vector3.UP, wind_from + 2.3), Vector3.ZERO)
	grounded.sail_target = 1.0
	grounded.sail = 1.0
	for i in 40 * 30:
		grounded.step(1.0 / 30.0)
	check(grounded.speed() * 1.944 < 1.5 and grounded.position.y > -1.0, "aground on a shoal she stops (%.1f knots, lifted %.1f m)" % [grounded.speed() * 1.944, grounded.position.y])

	var g := GunneryScript.new()
	add_child(g)
	var hunter = sail(wind_from + 2.0, 1.0, 0.0, 1.0).ship
	var prey = sail(wind_from + 2.0, 0.0, 0.0, 1.0).ship
	prey.position = hunter.position + hunter.transform.basis.x * 250.0
	g.ships = [hunter, prey]
	var cap = CaptainScript.new(hunter, prey, g)
	var fired := false
	for i in 90 * 30:
		cap.update(1.0 / 30.0)
		hunter.step(1.0 / 30.0)
		prey.step(1.0 / 30.0)
		if hunter.reload[0] > 0.0 or hunter.reload[1] > 0.0:
			fired = true
			break
	check(fired, "an enemy captain brings his guns to bear and fires")

	print("\n%s" % ("all sea trials passed" if failed == 0 else "%d check(s) failed" % failed))
	get_tree().quit(1 if failed else 0)
