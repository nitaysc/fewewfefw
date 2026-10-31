class_name Data
## Everything the workshop knows about: parts, toys and their recipes, stations, colours,
## upgrades and levels.

const COLORS := {
	"wood": Color(1, 1, 1),
	"red": Color("d8433b"),
	"blue": Color("3f74c9"),
	"yellow": Color("f2bd2e"),
	"green": Color("4ea35b"),
	"pink": Color("e57aa8"),
	"purple": Color("7d5bc4"),
}
const PAINTS := ["red", "blue", "yellow", "green", "pink", "purple"]

const PARTS := {
	"lumber": {"name": "Lumber"},
	"block": {"name": "Block", "paint": true},
	"wheel": {"name": "Wheel", "paint": true},
	"peg": {"name": "Peg", "paint": true},
}

# toys: what the bench needs, which part gives the colour, value, unlock level
const TOYS := {
	"car": {"name": "Toy Car", "needs": {"block": 1, "wheel": 2}, "body": "block", "value": 30, "level": 1},
	"top": {"name": "Spinning Top", "needs": {"wheel": 1, "peg": 1}, "body": "wheel", "value": 26, "level": 2},
	"plane": {"name": "Toy Plane", "needs": {"block": 1, "peg": 2}, "body": "block", "value": 38, "level": 3},
	"train": {"name": "Toy Train", "needs": {"block": 2, "wheel": 2}, "body": "block", "value": 52, "level": 4},
}
const TOY_ORDER := ["car", "top", "plane", "train"]

# how long hands-on work takes (seconds)
const WORK := {"saw": 1.6, "lathe": 1.8, "paint": 1.1, "bench": 2.0}

const DAY_LENGTH := 180.0
const MAX_ORDERS := 4

# things to buy between days
const UPGRADES := {
	"sawyer": {"name": "Apprentice sawyer", "desc": "Fetches lumber and saws blocks all day.", "cost": 220, "level": 1},
	"turner": {"name": "Apprentice turner", "desc": "Fetches lumber and turns wheels or pegs.", "cost": 260, "level": 2},
	"tools": {"name": "Sharper tools", "desc": "All hand work goes 35% faster.", "cost": 180, "level": 1},
	"shoes": {"name": "Comfy shoes", "desc": "Walk 20% faster.", "cost": 120, "level": 1},
	"patience": {"name": "Cozy waiting corner", "desc": "Customers wait 30% longer.", "cost": 200, "level": 2},
	"painter": {"name": "Apprentice painter", "desc": "Paints blocks waiting at the saw in the paint table's colour.", "cost": 300, "level": 3},
}
const UPGRADE_ORDER := ["sawyer", "tools", "shoes", "turner", "patience", "painter"]

static func xp_for(level: int) -> int:
	return int(round(60.0 * pow(level, 1.4)))

static func toys_at(level: int) -> Array:
	return TOY_ORDER.filter(func(t): return TOYS[t].level <= level)

static func item_name(it: Dictionary) -> String:
	var base: String = TOYS[it.t].name if TOYS.has(it.t) else PARTS[it.t].name
	return base if it.get("c", "wood") == "wood" else "%s %s" % [String(it.c).capitalize(), base]

## which toy (if any) a set of parts on the bench makes, among the unlocked ones
static func recipe_for(parts: Array, level: int) -> String:
	var have := {}
	for p in parts:
		have[p.t] = have.get(p.t, 0) + 1
	for t in toys_at(level):
		if TOYS[t].needs == have:
			return t
	return ""

## the toy's colour comes from its body part
static func toy_color(toy: String, parts: Array) -> String:
	for p in parts:
		if p.t == TOYS[toy].body and p.get("c", "wood") != "wood":
			return p.c
	return "wood"
