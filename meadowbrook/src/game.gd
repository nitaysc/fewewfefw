extends Node
## The toymaker's progress: coins, level, day, the orders waiting, upgrades bought, saving.

signal changed
signal order_added(o: Dictionary)
signal order_done(o: Dictionary, pay: int, tip: int)
signal order_missed(o: Dictionary)
signal leveled(level: int, unlocked: Array)
signal day_over(stats: Dictionary)

const SAVE := "user://toyworks2.json"

var coins := 60
var xp := 0
var level := 1
var day := 1
var owned := {}                 # upgrade id -> true
var orders: Array = []
var time_left := Data.DAY_LENGTH
var playing := false
var stats := {}
var seen_intro := false
var _next_order := 3.0
var _seq := 0
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.randomize()
	load_game()

func start_day() -> void:
	orders.clear()
	time_left = Data.DAY_LENGTH
	stats = {"done": 0, "missed": 0, "earned": 0, "tips": 0}
	_next_order = 2.0
	playing = true
	changed.emit()

func _process(dt: float) -> void:
	if not playing:
		return
	time_left -= dt
	for o in orders.duplicate():
		o.left -= dt
		if o.left <= 0.0:
			orders.erase(o)
			stats.missed += 1
			order_missed.emit(o)
			changed.emit()
	_next_order -= dt
	if _next_order <= 0.0 and orders.size() < Data.MAX_ORDERS and time_left > 25.0:
		var o := make_order()
		orders.append(o)
		order_added.emit(o)
		changed.emit()
		_next_order = rng.randf_range(20.0, 32.0) - level * 1.2
	if orders.is_empty() and _next_order > 6.0:
		_next_order = 6.0
	if time_left <= 0.0:
		playing = false
		for o in orders:
			stats.missed += 1
		orders.clear()
		day_over.emit(stats)
		day += 1
		save_game()
		changed.emit()

func paints_open() -> Array:
	return [] if level < 2 else Data.PAINTS.slice(0, mini(Data.PAINTS.size(), level))

func make_order() -> Dictionary:
	_seq += 1
	var toys := Data.toys_at(level)
	var toy: String = toys[rng.randi() % toys.size()]
	if toys.size() > 1 and rng.randf() < 0.45:
		toy = toys[toys.size() - 1]        # the newest toy comes up a little more often
	var c := "wood"
	var p := paints_open()
	if not p.is_empty() and rng.randf() < 0.6:
		c = p[rng.randi() % p.size()]
	var parts := 0
	for k in Data.TOYS[toy].needs:
		parts += Data.TOYS[toy].needs[k]
	var patience := (55.0 + parts * 14.0 + (12.0 if c != "wood" else 0.0)) * (1.3 if owned.has("patience") else 1.0)
	var name: String = ["Mia", "Noah", "Lily", "Leo", "Ava", "Omar", "Zoe", "Eli", "Maya", "Sam", "Nora", "Ben"][rng.randi() % 12]
	return {"id": _seq, "toy": toy, "c": c, "left": patience, "total": patience, "who": name}

func order_title(o: Dictionary) -> String:
	return Data.item_name({"t": o.toy, "c": o.c})

## a toy arrives at the shipping box; returns the order it filled (or {})
func ship(it: Dictionary) -> Dictionary:
	var best := {}
	for o in orders:
		if o.toy == it.t and o.c == it.get("c", "wood") and (best.is_empty() or o.left < best.left):
			best = o
	if best.is_empty():
		var pay2 := int(Data.TOYS[it.t].value * 0.4)
		coins += pay2
		stats.earned += pay2
		add_xp(2)
		changed.emit()
		return {}
	orders.erase(best)
	var value: int = Data.TOYS[it.t].value
	var pay := int(value * (1.25 if best.c != "wood" else 1.0))
	var tip := int(round(value * 0.6 * best.left / best.total))
	coins += pay + tip
	stats.done += 1
	stats.earned += pay + tip
	stats.tips += tip
	add_xp(10 + (4 if best.c != "wood" else 0))
	order_done.emit(best, pay, tip)
	changed.emit()
	return best

func add_xp(n: int) -> void:
	xp += n
	while xp >= Data.xp_for(level):
		xp -= Data.xp_for(level)
		level += 1
		var unlocked := []
		for t in Data.TOY_ORDER:
			if Data.TOYS[t].level == level:
				unlocked.append(t)
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

func work_speed() -> float:
	return 1.35 if owned.has("tools") else 1.0

# ---------------------------------------------------------------- saving
func save_game() -> void:
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"coins": coins, "xp": xp, "level": level, "day": day, "owned": owned.keys(), "intro": seen_intro}))

func load_game() -> void:
	if not FileAccess.file_exists(SAVE):
		return
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
	if typeof(d) != TYPE_DICTIONARY:
		return
	coins = int(d.get("coins", 60))
	xp = int(d.get("xp", 0))
	level = int(d.get("level", 1))
	day = int(d.get("day", 1))
	seen_intro = bool(d.get("intro", false))
	for u in d.get("owned", []):
		owned[u] = true

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST:
		save_game()
