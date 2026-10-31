extends Node
## The farmer's progress: coins, level, the day, seeds, water, wood, fields, upgrades, saving.

signal changed
signal leveled(level: int, unlocked: Array)
signal sold(n: int, coins: int)
signal new_day(day: int)

const SAVE := "user://meadowbrook.json"

var coins := 40
var xp := 0
var level := 1
var day := 1
var clock := 0.25                  # time of day, 0..1 (0.25 = morning)
var seeds := {"onion": 6}
var seed := "onion"                # what you plant
var water := 0
var wood := 0
var fields := 1
var owned := {}
var plots: Array = []              # saved plot states (see plot.gd)
var seen_intro := false
var shipped := 0
var _save_t := 0.0

func _ready() -> void:
	load_game()

func _process(dt: float) -> void:
	clock += dt / Data.DAY_LENGTH
	if clock >= 1.0:
		clock -= 1.0
		day += 1
		new_day.emit(day)
		save_game()
	_save_t += dt
	if _save_t > 10.0:
		_save_t = 0.0
		save_game()

func can_size() -> int:
	return Data.CAN_SIZE * (2 if owned.has("bigcan") else 1)

func grow_speed() -> float:
	return 1.3 if owned.has("compost") else 1.0

func buy_seeds(c: String, n := 3) -> bool:
	var cost: int = Data.CROPS[c].seed * n
	if coins < cost or Data.CROPS[c].level > level:
		return false
	coins -= cost
	seeds[c] = seeds.get(c, 0) + n
	seed = c
	changed.emit()
	return true

func use_seed() -> bool:
	if seeds.get(seed, 0) <= 0:
		return false
	seeds[seed] -= 1
	changed.emit()
	return true

func sell(t: String, n: int) -> int:
	var pay := Data.price(t) * n
	coins += pay
	shipped += n
	add_xp(n * (2 if Data.CROPS.has(t) else 1))
	sold.emit(n, pay)
	changed.emit()
	return pay

func add_xp(n: int) -> void:
	xp += n
	while xp >= Data.xp_for(level):
		xp -= Data.xp_for(level)
		level += 1
		var unlocked := []
		for c in Data.CROP_ORDER:
			if Data.CROPS[c].level == level:
				unlocked.append(c)
		for u in Data.UPGRADE_ORDER:
			if Data.UPGRADES[u].level == level:
				unlocked.append(u)
		leveled.emit(level, unlocked)
	changed.emit()

func buy(u: String) -> bool:
	var d: Dictionary = Data.UPGRADES[u]
	if owned.has(u) or coins < d.cost or d.level > level:
		return false
	coins -= d.cost
	owned[u] = true
	save_game()
	changed.emit()
	return true

func can_open_field() -> bool:
	if fields >= Data.FIELDS.size():
		return false
	var f: Dictionary = Data.FIELDS[fields]
	return coins >= f.cost and wood >= f.wood

func open_field() -> bool:
	if not can_open_field():
		return false
	var f: Dictionary = Data.FIELDS[fields]
	coins -= f.cost
	wood -= f.wood
	fields += 1
	save_game()
	changed.emit()
	return true

# ---------------------------------------------------------------- saving
func save_game() -> void:
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"coins": coins, "xp": xp, "level": level, "day": day, "clock": clock, "seeds": seeds,
			"seed": seed, "water": water, "wood": wood, "fields": fields, "owned": owned.keys(), "plots": plots,
			"intro": seen_intro, "shipped": shipped}))

func load_game() -> void:
	if not FileAccess.file_exists(SAVE):
		return
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
	if typeof(d) != TYPE_DICTIONARY:
		return
	coins = int(d.get("coins", 40))
	xp = int(d.get("xp", 0))
	level = int(d.get("level", 1))
	day = int(d.get("day", 1))
	clock = float(d.get("clock", 0.25))
	seeds = {}
	for k in d.get("seeds", {}):
		seeds[k] = int(d.seeds[k])
	seed = String(d.get("seed", "onion"))
	water = int(d.get("water", 0))
	wood = int(d.get("wood", 0))
	fields = int(d.get("fields", 1))
	plots = d.get("plots", [])
	seen_intro = bool(d.get("intro", false))
	shipped = int(d.get("shipped", 0))
	for u in d.get("owned", []):
		owned[u] = true

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST:
		save_game()
