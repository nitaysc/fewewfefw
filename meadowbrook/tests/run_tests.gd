extends SceneTree
## Headless checks: godot --headless --path toy-workshop --script res://tests/run_tests.gd

var fails := 0

func check(ok: bool, what: String) -> void:
	print(("ok   " if ok else "FAIL ") + what)
	if not ok:
		fails += 1

func work(s: Station) -> void:
	for i in 200:
		if s.do_work(0.05):
			return

var done := false

func _process(_dt: float) -> bool:
	if done:
		return true
	done = true
	var Game = root.get_node("Game")
	# lumber becomes two blocks at the saw
	var saw := Station.new().setup("saw")
	check(saw.can_put({"t": "lumber", "c": "wood"}), "the saw takes lumber")
	saw.put({"t": "lumber", "c": "wood"})
	check(not saw.can_put({"t": "lumber", "c": "wood"}), "one piece of lumber at a time")
	check(saw.job() == "Saw", "there is sawing to do")
	work(saw)
	check(saw.items.size() == 2 and saw.items.all(func(i): return i.t == "block"), "sawing makes two blocks")
	check(saw.take().t == "block", "you pick up a block")

	# the drill press makes wheels or pegs
	var lathe := Station.new().setup("lathe")
	lathe.put({"t": "lumber", "c": "wood"})
	work(lathe)
	check(lathe.items.size() == 2 and lathe.items[0].t == "wheel", "drilling makes two wheels")
	lathe.mode = "peg"
	lathe.put({"t": "lumber", "c": "wood"})
	work(lathe)
	check(lathe.items.filter(func(i): return i.t == "peg").size() == 2, "peg mode makes pegs")

	# painting
	var paint := Station.new().setup("paint")
	paint.color = "blue"
	check(not paint.can_put({"t": "lumber", "c": "wood"}), "lumber can't be painted")
	paint.put({"t": "block", "c": "wood"})
	work(paint)
	check(paint.items[0].c == "blue", "the block comes out blue")

	# the bench builds a car from a block and two wheels, coloured by the block
	var bench := Station.new().setup("bench")
	bench.level = 1
	bench.put({"t": "block", "c": "blue"})
	bench.put({"t": "wheel", "c": "wood"})
	check(bench.job() == "", "not enough parts yet")
	bench.put({"t": "wheel", "c": "wood"})
	check(bench.job() == "Assemble", "a car can be assembled")
	work(bench)
	check(bench.items.size() == 1 and bench.items[0].t == "car" and bench.items[0].c == "blue", "a blue toy car")
	var b2 := Station.new().setup("bench")
	b2.level = 1
	for p in [{"t": "wheel", "c": "wood"}, {"t": "peg", "c": "wood"}]:
		b2.put(p)
	check(b2.job() == "", "spinning tops need level 2")
	b2.level = 2
	check(b2.job() == "Assemble", "at level 2 they can be made")

	# orders pay more for colour and tip for speed
	Game.level = 2
	Game.start_day()
	Game.orders = [{"id": 1, "toy": "car", "c": "blue", "left": 50.0, "total": 100.0, "who": "Mia"}]
	var before: int = Game.coins
	var o: Dictionary = Game.ship({"t": "car", "c": "blue"})
	check(not o.is_empty() and Game.coins - before == int(30 * 1.25) + 9, "blue car pays %d" % (Game.coins - before))
	check(Game.ship({"t": "car", "c": "red"}).is_empty(), "an unordered toy still sells, for less")
	Game.playing = false
	print("%d failed" % fails)
	quit(1 if fails else 0)
	return true
