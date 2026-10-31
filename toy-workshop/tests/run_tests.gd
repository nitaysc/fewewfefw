extends SceneTree
## Headless checks: godot --headless --path toy-workshop --script res://tests/run_tests.gd

var fails := 0

func check(ok: bool, what: String) -> void:
	print(("ok   " if ok else "FAIL ") + what)
	if not ok:
		fails += 1

func run(sim: Sim, seconds: float) -> Array:
	var got := []
	sim.shipped.connect(func(it, _p): got.append(it))
	var t := 0.0
	while t < seconds:
		sim.step(0.05)
		t += 0.05
	return got

func _init() -> void:
	# the starting line makes wooden toy cars on its own
	var s := Sim.new()
	s.starter()
	var got := run(s, 60.0)
	check(got.size() >= 8, "starter line ships cars (%d in 60 s)" % got.size())
	check(got.all(func(x): return x.t == "car" and x.c == "wood"), "they are wooden cars")

	# a paint booth between the saw and the bench makes red cars
	s = Sim.new()
	s.starter()
	s.place(Vector2i(3, 2), "painter", 0)
	got = run(s, 60.0)
	check(got.size() >= 6 and got.all(func(x): return x.c == "red"), "painted line ships red cars (%d)" % got.size())

	# spinning tops: lathe on pegs feeds the bench with the other lathe's wheels
	s = Sim.new()
	s.starter()
	s.cells[Vector2i(5, 2)].toy = "top"
	s.cells[Vector2i(2, 2)] = s.place(Vector2i(2, 2), "lathe", 0)
	s.cells[Vector2i(2, 2)].mode = "peg"
	got = run(s, 60.0)
	check(got.size() >= 6 and got.all(func(x): return x.t == "top"), "tops ship (%d)" % got.size())

	# belts never hand things backwards and a blocked line just waits
	s = Sim.new()
	s.place(Vector2i(0, 0), "crate_wood", 0)
	s.place(Vector2i(1, 0), "belt", 0)
	s.place(Vector2i(2, 0), "belt", 2)
	run(s, 10.0)
	check(s.cells[Vector2i(1, 0)].item != null and s.cells[Vector2i(2, 0)].item == null, "facing belts don't swap")

	# saving and loading keeps the layout and settings
	s = Sim.new()
	s.starter()
	s.cells[Vector2i(5, 2)].toy = "train"
	var t := Sim.new()
	t.load_save(JSON.parse_string(JSON.stringify(s.to_save())))
	check(t.cells.size() == s.cells.size() and t.cells[Vector2i(5, 2)].toy == "train", "save round trip")

	print("%d failed" % fails)
	quit(1 if fails else 0)
