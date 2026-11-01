extends SceneTree
## Scripted sea fight for tuning (not run in CI): the player fires whenever a
## broadside bears; prints both ships' state every 2 s.
##   godot --headless --fixed-fps 60 -s res://test/battle_sim.gd -- --play --enemy=300,80
var m
var t := 0
func _initialize():
	m = load("res://scenes/main.tscn").instantiate()
	root.add_child(m)
func _process(dt):
	t += 1
	if m.enemies.size() > 0:
		var e = m.enemies[0].ship
		for s in [1.0, -1.0]:
			if not m._player_lay(s).is_empty():
				if m.ship.reload[0 if s > 0 else 1] == 0.0: print("FIRE ", s, " lay ", m._player_lay(s))
				m._fire(s)
		if t % 120 == 0:
			print("sim=%.0f t=%d dist=%.0f enemy hull=%.0f flood=%.0f | us hull=%.0f flood=%.0f" % [m.ship.sim_time, t/60, e.position.distance_to(m.ship.position), e.hull, e.flood, m.ship.hull, m.ship.flood])
	elif t % 120 == 0:
		print("t=%d no enemy, sunk=%d" % [t/60, m.sunk_count])
	if t > 60 * 240 or m.game_over:
		print("end sunk=", m.sunk_count, " game_over=", m.game_over)
		quit()
	return false
