class_name Data
## Everything the farm knows about: crops, fruit trees, prices, upgrades, levels.

# crops grown in soil plots: seed price, seconds to grow once watered, sell price per piece,
# how many you harvest, the produce model, the plant model when grown, unlock level
const CROPS := {
	"onion": {"name": "Onions", "seed": 4, "grow": 40.0, "price": 9, "yield": 3, "model": "yellow_onion", "plant": "nettle_plant", "level": 1},
	"potato": {"name": "Sweet potatoes", "seed": 7, "grow": 65.0, "price": 15, "yield": 3, "model": "sweet_potato", "plant": "periwinkle_plant", "level": 1},
	"gazania": {"name": "Gazanias", "seed": 10, "grow": 80.0, "price": 26, "yield": 2, "model": "flower_gazania", "plant": "flower_gazania", "level": 2},
	"ursinia": {"name": "Ursinias", "seed": 14, "grow": 100.0, "price": 38, "yield": 2, "model": "flower_ursinia", "plant": "flower_ursinia", "level": 3},
}
const CROP_ORDER := ["onion", "potato", "gazania", "ursinia"]

# fruit from trees (picked by hand, regrow)
const FRUIT := {
	"apple": {"name": "Apples", "price": 7, "model": "food_apple_01", "regrow": 45.0},
	"pear": {"name": "Pears", "price": 10, "model": "food_pears_asian_01", "regrow": 60.0},
}

const WORK := {"dig": 1.2, "plant": 0.7, "water": 0.9, "harvest": 0.9, "chop": 2.2, "fill": 1.0, "pick": 1.0}
const CAN_SIZE := 6
const BASKET := 9                      # pieces you can carry at once
const DAY_LENGTH := 240.0

# plots come in fields; each extra field costs coins and wood
const FIELDS := [
	{"cost": 0, "wood": 0},
	{"cost": 60, "wood": 4},
	{"cost": 140, "wood": 8},
	{"cost": 260, "wood": 12},
]

const UPGRADES := {
	"farmhand": {"name": "Farmhand Rosa", "desc": "Waters dry crops and harvests ripe ones into the crate.", "cost": 250, "level": 2},
	"sprinkler": {"name": "Sprinklers", "desc": "Crops don't need watering any more.", "cost": 400, "level": 3},
	"bigcan": {"name": "Big watering can", "desc": "Holds twice as much water.", "cost": 80, "level": 1},
	"boots": {"name": "Field boots", "desc": "Walk 20% faster.", "cost": 90, "level": 1},
	"compost": {"name": "Compost", "desc": "Crops grow 30% faster.", "cost": 220, "level": 2},
	"axe": {"name": "Sharp axe", "desc": "Chop trees twice as fast.", "cost": 70, "level": 1},
}
const UPGRADE_ORDER := ["bigcan", "boots", "axe", "farmhand", "compost", "sprinkler"]

static func xp_for(level: int) -> int:
	return int(round(50.0 * pow(level, 1.45)))

static func crops_at(level: int) -> Array:
	return CROP_ORDER.filter(func(c): return CROPS[c].level <= level)

static func price(t: String) -> int:
	return CROPS[t].price if CROPS.has(t) else FRUIT[t].price

static func name_of(t: String) -> String:
	return CROPS[t].name if CROPS.has(t) else FRUIT[t].name
