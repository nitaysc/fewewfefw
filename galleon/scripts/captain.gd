extends RefCounted
## An enemy captain. Sails the same physics as the player (so it can't point into
## the wind either), closes to gun range, turns to bring a broadside to bear, and
## fires when the target is on the beam. Its gunners aim for the range, but not perfectly.

var ship
var target
var gunnery
var patrol_heading := 0.0
var skill := 0.7 ## 0..1: how true the gunners lay their guns
var think := 0.0
var want := 0.0 ## heading the captain is steering for


func _init(s, t, g) -> void:
	ship = s
	target = t
	gunnery = g
	patrol_heading = s.heading()
	want = patrol_heading


static func _no_go(heading: float) -> bool:
	var w: Vector3 = Waves.wind()
	var wind_from := atan2(-w.x, -w.z)
	return absf(wrapf(heading - wind_from, -PI, PI)) < deg_to_rad(62.0)


func update(dt: float) -> void:
	if ship.sinking:
		ship.rudder = move_toward(ship.rudder, 0.4, dt * 0.2)
		return
	var to: Vector3 = target.position - ship.position
	to.y = 0.0
	var dist := to.length()
	var bearing := atan2(to.x, to.z)
	var h: float = ship.heading()

	think -= dt
	if think <= 0.0:
		think = 1.5
		var options := []
		if dist > 1100.0 or target.sinking:
			options = [patrol_heading, patrol_heading + 0.8, patrol_heading - 0.8]
		elif dist > 380.0:
			options = [bearing + 0.55, bearing - 0.55, bearing + 1.1, bearing - 1.1] # close in at an angle
		elif dist < 110.0:
			options = [bearing + 2.1, bearing - 2.1] # too close: bear away and open the range
		else:
			options = [bearing + PI * 0.5, bearing - PI * 0.5] # put her on the beam
		var best := INF
		for o in options:
			if _no_go(o):
				continue
			var cost := absf(wrapf(o - h, -PI, PI))
			if cost < best:
				best = cost
				want = o
		ship.sail_target = 0.5 if dist < 160.0 else 1.0

	# helm: positive rudder turns her clockwise (heading decreases)
	var err := wrapf(want - h, -PI, PI)
	var yaw_rate: float = ship.omega.y
	ship.rudder = clampf(-err * 1.8 + yaw_rate * 6.0, -1.0, 1.0)

	# gunnery: fire the side the target is on when it bears and is in range
	if target.sinking or dist > 520.0 or dist < 25.0:
		return
	var rel := wrapf(bearing - h, -PI, PI) # +90° = on the port beam
	var side := 1.0 if rel > 0.0 else -1.0
	var off_beam := absf(absf(rel) - PI * 0.5)
	if off_beam < deg_to_rad(9.0):
		var e: float = gunnery.aim_elevation(dist) + randf_range(-1.0, 1.0) * deg_to_rad(1.2) * (1.0 - skill)
		# wait for the roll: fire as the gunports come level
		var heel: float = ship.attitude().x
		if absf(heel) < 4.0:
			gunnery.fire(ship, side, e)
