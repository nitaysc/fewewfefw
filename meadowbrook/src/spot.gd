class_name Spot
extends Node3D
## Something on the farm you can use: a soil plot, the water barrel, the shipping crate, the
## seed stand, a tree to chop, a fruit tree, or a sign that opens a new field.

signal changed_state

var kind := ""
var reach := 1.2
var size := Vector3(1, 1, 1)
# plots
var state := "grass"            # grass, tilled, planted, ripe
var crop := ""
var wet := false
var growth := 0.0
var index := -1
# trees
var cooldown := 0.0
var fruit := ""
var field := 0                  # sign: which field it opens
var visual: Node3D
var shake := 0.0

func setup(k: String) -> Spot:
	kind = k
	return self

## what using this spot does now: {label, work (a Data.WORK key or ""), ok}
func action(carry: Dictionary, g) -> Dictionary:
	match kind:
		"plot":
			match state:
				"grass":
					return {"label": "Hold: Dig", "work": "dig"}
				"tilled":
					if g.seeds.get(g.seed, 0) <= 0:
						return {"label": "No %s seeds" % Data.CROPS[g.seed].name.to_lower(), "work": "", "bad": true}
					return {"label": "Plant " + Data.CROPS[g.seed].name.to_lower(), "work": "plant"}
				"planted":
					if not wet and not g.owned.has("sprinkler"):
						if g.water <= 0:
							return {"label": "Can is empty", "work": "", "bad": true}
						return {"label": "Hold: Water", "work": "water"}
					return {"label": "Growing %d%%" % int(growth * 100), "work": "", "bad": true}
				"ripe":
					if not carry.is_empty() and (carry.t != crop or carry.n >= Data.BASKET):
						return {"label": "Hands full", "work": "", "bad": true}
					return {"label": "Hold: Harvest", "work": "harvest"}
		"well":
			return {"label": "Hold: Fill can", "work": "fill"} if g.water < g.can_size() else {"label": "Can is full", "work": "", "bad": true}
		"crate":
			if carry.is_empty():
				return {"label": "", "work": ""}
			return {"label": "Sell %d for %d" % [carry.n, Data.price(carry.t) * carry.n], "work": "", "tap": "sell"}
		"stand":
			return {"label": "Buy 3 %s seeds (%d)" % [Data.CROPS[g.seed].name.to_lower(), Data.CROPS[g.seed].seed * 3], "work": "", "tap": "buy"}
		"tree":
			return {"label": "Hold: Chop", "work": "chop"} if cooldown <= 0.0 else {"label": "Growing back", "work": "", "bad": true}
		"fruit":
			if cooldown > 0.0:
				return {"label": "No %s yet" % Data.FRUIT[fruit].name.to_lower(), "work": "", "bad": true}
			if not carry.is_empty() and (carry.t != fruit or carry.n >= Data.BASKET):
				return {"label": "Hands full", "work": "", "bad": true}
			return {"label": "Hold: Pick " + Data.FRUIT[fruit].name.to_lower(), "work": "pick"}
		"sign":
			var f: Dictionary = Data.FIELDS[field]
			return {"label": "New field: %d coins + %d wood" % [f.cost, f.wood], "work": "", "tap": "field"}
	return {"label": "", "work": ""}

## finish the work (or tap) here; returns what the worker now carries
func finish(work: String, carry: Dictionary, g) -> Dictionary:
	match work:
		"dig":
			state = "tilled"
		"plant":
			if g.use_seed():
				crop = g.seed
				state = "planted"
				growth = 0.0
				wet = g.owned.has("sprinkler")
		"water":
			g.water -= 1
			wet = true
		"harvest":
			var n: int = Data.CROPS[crop].yield
			var have: int = carry.get("n", 0) if not carry.is_empty() else 0
			carry = {"t": crop, "n": mini(have + n, Data.BASKET)}
			g.add_xp(2)
			state = "tilled"
			crop = ""
			wet = false
			growth = 0.0
		"fill":
			g.water = g.can_size()
		"chop":
			g.wood += 2
			g.add_xp(1)
			cooldown = 70.0
		"pick":
			var have2: int = carry.get("n", 0) if not carry.is_empty() else 0
			carry = {"t": fruit, "n": mini(have2 + 3, Data.BASKET)}
			cooldown = Data.FRUIT[fruit].regrow
	g.changed.emit()
	changed_state.emit()
	return carry

func tick(dt: float, g) -> void:
	if cooldown > 0.0:
		cooldown -= dt
		if cooldown <= 0.0:
			changed_state.emit()
	if kind == "plot" and state == "planted" and (wet or g.owned.has("sprinkler")):
		growth += dt * g.grow_speed() / Data.CROPS[crop].grow
		if growth >= 1.0:
			growth = 1.0
			state = "ripe"
			changed_state.emit()

func save() -> Dictionary:
	return {"s": state, "c": crop, "w": wet, "g": growth}

func restore(d: Dictionary) -> void:
	state = String(d.get("s", "grass"))
	crop = String(d.get("c", ""))
	wet = bool(d.get("w", false))
	growth = float(d.get("g", 0.0))
