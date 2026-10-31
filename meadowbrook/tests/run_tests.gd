extends SceneTree
## Headless checks: godot --headless --path meadowbrook --script res://tests/run_tests.gd

var fails := 0
var done := false

func check(ok: bool, what: String) -> void:
	print(("ok   " if ok else "FAIL ") + what)
	if not ok:
		fails += 1

func _process(_dt: float) -> bool:
	if done:
		return true
	done = true
	var G = root.get_node("Game")
	G.coins = 40
	G.seeds = {"onion": 2}
	G.seed = "onion"
	G.water = 0
	G.owned = {}
	var p := Spot.new().setup("plot")
	check(p.action({}, G).work == "dig", "grass gets dug first")
	p.finish("dig", {}, G)
	check(p.action({}, G).work == "plant", "then planted")
	p.finish("plant", {}, G)
	check(G.seeds.onion == 1 and p.state == "planted", "planting uses a seed")
	check(p.action({}, G).get("bad", false), "can't water with an empty can")
	G.water = 2
	check(p.action({}, G).work == "water", "watering with water in the can")
	p.finish("water", {}, G)
	p.tick(10.0, G)
	check(p.state == "planted" and p.growth > 0.2, "watered crops grow")
	p.tick(100.0, G)
	check(p.state == "ripe", "and ripen")
	var c: Dictionary = p.finish("harvest", {}, G)
	check(c.t == "onion" and c.n == 3 and p.state == "tilled", "harvest gives 3 onions, soil stays tilled")
	var before: int = G.coins
	G.sell(c.t, c.n)
	check(G.coins - before == 27, "onions sell for 9 each")
	var dry := Spot.new().setup("plot")
	dry.state = "planted"
	dry.crop = "onion"
	dry.tick(100.0, G)
	check(dry.state == "planted" and dry.growth == 0.0, "dry crops don't grow")
	check(G.buy_seeds("potato") and G.seeds.potato == 3, "buying seeds")
	G.wood = 4
	G.coins = 100
	G.fields = 1
	check(G.open_field() and G.fields == 2 and G.wood == 0, "a new field costs coins and wood")
	print("%d failed" % fails)
	quit(1 if fails else 0)
	return true
