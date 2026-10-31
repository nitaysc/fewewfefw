extends Node
## The player's workshop: money, level, orders, the factory itself, and saving.

signal changed                                    # coins, xp, level or orders changed
signal leveled(level: int, unlocked: Array)
signal order_progress(index: int, done: bool)
signal sold(cell: Vector2i, coins: int, matched: bool)

const SAVE := "user://toyworks.json"

var sim := Sim.new()
var coins := 250
var xp := 0
var level := 1
var orders: Array = []
var shipped := 0
var seq := 0
var seen_intro := false
var _save_t := 0.0
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.randomize()
	sim.shipped.connect(_on_shipped)
	if not load_game():
		reset()

func reset() -> void:
	sim = Sim.new()
	sim.shipped.connect(_on_shipped)
	sim.starter()
	coins = 250
	xp = 0
	level = 1
	shipped = 0
	orders = [{"toy": "car", "c": "", "n": 3, "got": 0, "reward": 60, "xp": 24, "id": 1}]
	seq = 1
	while orders.size() < 3:
		orders.append(make_order())
	changed.emit()

func _physics_process(dt: float) -> void:
	sim.step(dt)
	_save_t += dt
	if _save_t > 8.0:
		_save_t = 0.0
		save_game()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST:
		save_game()

# ---------------------------------------------------------------- orders
func paints_open() -> Array:
	return Data.PAINTS.slice(0, mini(Data.PAINTS.size(), 2 + level))

func make_order() -> Dictionary:
	seq += 1
	var toys := Data.toys_at(level)
	# newer toys come up more often so there's always something fresh to build
	var weights := []
	for i in toys.size():
		weights.append(1.0 + i * 0.8)
	var pick := 0
	var r: float = rng.randf() * weights.reduce(func(a, b): return a + b, 0.0)
	for i in weights.size():
		r -= weights[i]
		if r <= 0.0:
			pick = i
			break
	var toy: String = toys[pick]
	var colour := ""
	if level >= 2 and rng.randf() < 0.6:
		var p := paints_open()
		colour = p[rng.randi() % p.size()]
	var n := rng.randi_range(2, 3 + level / 2)
	var value: int = Data.TOYS[toy].value
	var reward := int(round(value * n * (1.3 if colour != "" else 1.0) / 5.0) * 5)
	return {"toy": toy, "c": colour, "n": n, "got": 0, "reward": reward, "xp": 8 * n + (6 if colour != "" else 0), "id": seq}

func order_title(o: Dictionary) -> String:
	var name: String = Data.TOYS[o.toy].name
	return name if o.c == "" else "%s %s" % [String(o.c).capitalize(), name]

func _on_shipped(it: Dictionary, cell: Vector2i) -> void:
	shipped += 1
	for i in orders.size():
		var o: Dictionary = orders[i]
		if o.got < o.n and o.toy == it.t and (o.c == "" or o.c == it.c):
			o.got += 1
			var pay := int(o.reward / o.n)
			coins += pay
			sold.emit(cell, pay, true)
			var done: bool = o.got >= o.n
			if done:
				coins += o.reward - pay * o.n
				add_xp(o.xp)
			order_progress.emit(i, done)
			changed.emit()
			return
	# nobody asked for this one: it still sells, for less
	var pay2 := int(Data.TOYS[it.t].value / 2)
	coins += pay2
	add_xp(1)
	sold.emit(cell, pay2, false)
	changed.emit()

func replace_order(i: int) -> void:
	orders[i] = make_order()
	changed.emit()

func add_xp(n: int) -> void:
	xp += n
	while xp >= Data.xp_for(level):
		xp -= Data.xp_for(level)
		level += 1
		var unlocked := []
		for k in Data.SHOP_ORDER:
			if Data.MACHINES[k].level == level:
				unlocked.append(k)
		for t in Data.TOY_ORDER:
			if Data.TOYS[t].level == level:
				unlocked.append(t)
		leveled.emit(level, unlocked)
	changed.emit()

# ---------------------------------------------------------------- building
func can_buy(kind: String) -> bool:
	return coins >= Data.MACHINES[kind].cost and Data.MACHINES[kind].level <= level

func buy(kind: String) -> bool:
	if not can_buy(kind):
		return false
	coins -= Data.MACHINES[kind].cost
	changed.emit()
	return true

func refund(kind: String) -> int:
	var back := int(Data.MACHINES[kind].cost / 2)
	coins += back
	changed.emit()
	return back

# ---------------------------------------------------------------- saving
func save_game() -> void:
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify({"v": 1, "coins": coins, "xp": xp, "level": level, "orders": orders, "shipped": shipped,
		"seq": seq, "cells": sim.to_save(), "intro": seen_intro}))

func load_game() -> bool:
	if not FileAccess.file_exists(SAVE):
		return false
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
	if typeof(d) != TYPE_DICTIONARY or not d.has("cells"):
		return false
	sim.load_save(d.cells)
	coins = int(d.coins)
	xp = int(d.xp)
	level = int(d.level)
	shipped = int(d.get("shipped", 0))
	seq = int(d.get("seq", 0))
	seen_intro = bool(d.get("intro", false))
	orders = []
	for o in d.orders:
		o.n = int(o.n)
		o.got = int(o.got)
		o.reward = int(o.reward)
		o.xp = int(o.xp)
		orders.append(o)
	while orders.size() < 3:
		orders.append(make_order())
	return true
