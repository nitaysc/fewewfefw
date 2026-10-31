class_name Data
## Everything the workshop knows about: parts, toys, machines, recipes, colours and levels.

const GRID_W := 12
const GRID_H := 8

# directions on the grid: 0 east (+x), 1 south (+z), 2 west (-x), 3 north (-z)
const DIRS := [Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(0, -1)]

const COLORS := {
	"wood": Color("d9a066"),
	"red": Color("ef5a5a"),
	"blue": Color("4f8ff0"),
	"yellow": Color("ffcc4d"),
	"green": Color("5cc879"),
	"pink": Color("ff8fc1"),
	"purple": Color("9b7cf0"),
}
const PAINTS := ["red", "blue", "yellow", "green", "pink", "purple"]

const PARTS := {
	"log": {"name": "Log"},
	"metal": {"name": "Metal bar"},
	"cloth": {"name": "Cloth"},
	"block": {"name": "Block", "paint": true},
	"wheel": {"name": "Wheel", "paint": true},
	"peg": {"name": "Peg", "paint": true},
	"tube": {"name": "Tube", "paint": true},
	"fluff": {"name": "Fluff", "paint": true},
}

# toys: what goes in, which part gives the toy its colour, what it's worth, when it unlocks
const TOYS := {
	"car": {"name": "Toy Car", "needs": {"block": 1, "wheel": 2}, "body": "block", "value": 20, "level": 1},
	"top": {"name": "Spinning Top", "needs": {"wheel": 1, "peg": 1}, "body": "wheel", "value": 18, "level": 2},
	"train": {"name": "Toy Train", "needs": {"block": 2, "wheel": 2}, "body": "block", "value": 42, "level": 3},
	"rocket": {"name": "Rocket", "needs": {"tube": 1, "block": 1}, "body": "tube", "value": 48, "level": 4},
	"teddy": {"name": "Teddy Bear", "needs": {"fluff": 2}, "body": "fluff", "value": 55, "level": 5},
	"robot": {"name": "Robot", "needs": {"tube": 1, "block": 1, "peg": 2}, "body": "tube", "value": 80, "level": 6},
}
const TOY_ORDER := ["car", "top", "train", "rocket", "teddy", "robot"]

# machines. kind: crate (makes raw stuff), proc (turns one thing into another), paint,
# assemble, dock (ships toys), belt
const MACHINES := {
	"belt": {"name": "Conveyor", "cost": 5, "level": 1, "kind": "belt", "desc": "Carries things along. Drag to lay a line."},
	"crate_wood": {"name": "Wood Crate", "cost": 40, "level": 1, "kind": "crate", "makes": "log", "period": 2.5, "desc": "Sends out logs."},
	"saw": {"name": "Saw", "cost": 60, "level": 1, "kind": "proc", "desc": "Saws logs into blocks.",
		"modes": {"block": {"in": "log", "out": ["block"], "time": 1.4}}},
	"lathe": {"name": "Lathe", "cost": 80, "level": 1, "kind": "proc", "desc": "Turns logs into wheels or pegs.",
		"modes": {"wheel": {"in": "log", "out": ["wheel", "wheel"], "time": 1.8}, "peg": {"in": "log", "out": ["peg", "peg"], "time": 1.6}}},
	"assembler": {"name": "Assembly Bench", "cost": 150, "level": 1, "kind": "assemble", "desc": "Puts parts together into a toy."},
	"dock": {"name": "Shipping Box", "cost": 100, "level": 1, "kind": "dock", "desc": "Ships finished toys to fill orders."},
	"painter": {"name": "Paint Booth", "cost": 120, "level": 2, "kind": "paint", "desc": "Paints parts any colour.", "time": 1.0},
	"crate_metal": {"name": "Metal Crate", "cost": 150, "level": 4, "kind": "crate", "makes": "metal", "period": 3.0, "desc": "Sends out metal bars."},
	"press": {"name": "Tube Press", "cost": 140, "level": 4, "kind": "proc", "desc": "Rolls metal into tubes.",
		"modes": {"tube": {"in": "metal", "out": ["tube"], "time": 1.8}}},
	"crate_cloth": {"name": "Cloth Crate", "cost": 150, "level": 5, "kind": "crate", "makes": "cloth", "period": 2.8, "desc": "Sends out cloth."},
	"loom": {"name": "Stuffing Loom", "cost": 160, "level": 5, "kind": "proc", "desc": "Turns cloth into fluffy stuffing.",
		"modes": {"fluff": {"in": "cloth", "out": ["fluff", "fluff"], "time": 2.0}}},
}
const SHOP_ORDER := ["belt", "crate_wood", "saw", "lathe", "painter", "assembler", "dock", "crate_metal", "press", "crate_cloth", "loom"]

# a tip shown after each level-up, so the player always knows what to try next
const TIPS := {
	2: "Buy a Paint Booth and place it on the belt right after the Saw. Tap it to choose a colour.",
	3: "Trains need 2 blocks and 2 wheels. Tap the Assembly Bench to switch it to Trains, or build a second line.",
	4: "Metal Crate + Tube Press make tubes. Rockets need a tube and a block.",
	5: "Cloth Crate + Stuffing Loom make fluff. Teddy Bears need two fluffs.",
	6: "Robots need a tube, a block and two pegs. Set a Lathe to Pegs!",
}

const BELT_SPEED := 1.25        # cells per second
const BUFFER := 4               # how many things a machine holds waiting

static func xp_for(level: int) -> int:
	return int(round(40.0 * pow(level, 1.5)))

static func toys_at(level: int) -> Array:
	return TOY_ORDER.filter(func(t): return TOYS[t].level <= level)

static func item_name(it: Dictionary) -> String:
	var base: String = TOYS[it.t].name if TOYS.has(it.t) else PARTS[it.t].name
	return base if it.get("c", "wood") == "wood" else "%s %s" % [String(it.c).capitalize(), base]
