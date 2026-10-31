class_name Station
extends Node3D
## A place in the workshop where things are taken, put down or worked on: the lumber crate,
## the saw bench, the drill press (wheels and pegs), the paint table, the assembly bench, the
## shipping box and the scrap bin. Holds the items lying on it and shows them.

signal shipped(item: Dictionary)
signal finished(kind: String)

var kind := ""
var items: Array = []           # things lying on the station
var work := 0.0                 # progress of the current job, 0..1
var working := 0.0              # seconds since someone last worked here (for animation)
var mode := "wheel"             # drill press: wheel or peg
var color := "red"              # paint table colour
var surface := 0.9              # height things rest at
var slots: Array = []           # where things lie on the surface (local)
var face := Vector3(0, 0, 1)    # workers stand on this side
var reach := 1.35
var level := 1                  # player's level (for recipes)
var item_nodes: Array = []
var tool: Node3D                # moves while someone works (saw, drill head...)
var tool_rest := Transform3D()

const HOLD := {"saw": 3, "lathe": 4, "paint": 3, "bench": 4, "logs": 0, "ship": 0, "bin": 0}

func setup(k: String) -> Station:
	kind = k
	return self

# ---------------------------------------------------------------- rules
func job() -> String:
	match kind:
		"saw":
			return "Saw" if _has("lumber") else ""
		"lathe":
			return ("Turn wheels" if mode == "wheel" else "Turn pegs") if _has("lumber") else ""
		"paint":
			return "Paint" if _first_unpainted() >= 0 else ""
		"bench":
			return "Assemble" if Data.recipe_for(items, level) != "" and items.size() > 1 else ""
	return ""

func _has(t: String) -> bool:
	return items.any(func(i): return i.t == t)

func _first_unpainted() -> int:
	for i in items.size():
		if items[i].get("c", "wood") != color:
			return i
	return -1

func can_take() -> bool:
	return kind == "logs" or (not items.is_empty() and kind not in ["ship", "bin"])

## what you'd pick up here (outputs before inputs)
func peek() -> Dictionary:
	if kind == "logs":
		return {"t": "lumber", "c": "wood"}
	if items.is_empty():
		return {}
	for i in range(items.size() - 1, -1, -1):
		if items[i].t != "lumber":
			return items[i]
	return items[items.size() - 1]

func take() -> Dictionary:
	if kind == "logs":
		return {"t": "lumber", "c": "wood"}
	var it := peek()
	if it.is_empty():
		return it
	items.erase(it)
	work = 0.0
	_refresh()
	return it

func can_put(it: Dictionary) -> bool:
	if it.is_empty():
		return false
	match kind:
		"logs":
			return it.t == "lumber"
		"saw", "lathe":
			return it.t == "lumber" and not _has("lumber") and items.size() < HOLD[kind]
		"paint":
			return Data.PARTS.has(it.t) and Data.PARTS[it.t].get("paint", false) and items.size() < HOLD.paint
		"bench":
			return Data.PARTS.has(it.t) and it.t != "lumber" and items.size() < HOLD.bench
		"ship":
			return Data.TOYS.has(it.t)
		"bin":
			return true
	return false

func put(it: Dictionary) -> void:
	match kind:
		"logs", "bin":
			return
		"ship":
			shipped.emit(it)
			return
	items.append(it)
	work = 0.0
	_refresh()

## someone works here for dt seconds; returns true when the job is done
func do_work(dt: float, speed := 1.0) -> bool:
	if job() == "":
		return false
	working = 0.25
	work += dt * speed / Data.WORK[kind]
	if work < 1.0:
		return false
	work = 0.0
	match kind:
		"saw":
			_replace("lumber", [{"t": "block", "c": "wood"}, {"t": "block", "c": "wood"}])
		"lathe":
			_replace("lumber", [{"t": mode, "c": "wood"}, {"t": mode, "c": "wood"}])
		"paint":
			var i := _first_unpainted()
			items[i] = {"t": items[i].t, "c": color}
		"bench":
			var toy := Data.recipe_for(items, level)
			items = [{"t": toy, "c": Data.toy_color(toy, items)}]
	_refresh(true)
	finished.emit(kind)
	return true

func _replace(t: String, with: Array) -> void:
	for i in items.size():
		if items[i].t == t:
			items.remove_at(i)
			break
	items.append_array(with)

# ---------------------------------------------------------------- showing it
func _refresh(pop := false) -> void:
	for n in item_nodes:
		n.queue_free()
	item_nodes.clear()
	if slots.is_empty():
		return
	for i in items.size():
		var n := Props.item(items[i])
		var s: Vector3 = slots[mini(i, slots.size() - 1)]
		n.position = s + Vector3(0, 0.01 * maxi(0, i - slots.size() + 1), 0)
		n.rotation.y = 0.25 * ((i * 37) % 7 - 3) * 0.1
		add_child(n)
		item_nodes.append(n)
		if pop or i == items.size() - 1:
			n.scale = Vector3.ONE * 0.6
			create_tween().tween_property(n, "scale", Vector3.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func _process(dt: float) -> void:
	working = maxf(0.0, working - dt)
	if tool == null:
		return
	var t := Time.get_ticks_msec() / 1000.0
	var tr := tool_rest
	if working > 0.0:
		match kind:
			"saw": tr = tr.translated_local(Vector3(sin(t * 14.0) * 0.12, 0, 0))
			"lathe": tr = tr.translated_local(Vector3(0, -absf(sin(t * 5.0)) * 0.06, 0))
			"paint": tr = tr.rotated_local(Vector3.UP, sin(t * 9.0) * 0.4)
			"bench": tr = tr.rotated_local(Vector3.FORWARD, absf(sin(t * 10.0)) * 0.7)
	tool.transform = tool.transform.interpolate_with(tr, minf(1.0, dt * 20.0))
