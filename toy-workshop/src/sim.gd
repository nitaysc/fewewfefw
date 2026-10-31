class_name Sim
extends RefCounted
## The factory floor as pure logic: belts carry items, machines take them in, work, and push
## results out of their front. The 3D world only draws what's here, so this can be tested alone.

signal shipped(item: Dictionary, cell: Vector2i)
signal made(cell: Vector2i)          # a machine finished a job (for sounds and effects)

var cells := {}                       # Vector2i -> Dictionary
var next_id := 1
var speed := 1.0                      # global speed multiplier (upgrades)

func new_item(t: String, c: String = "wood") -> Dictionary:
	next_id += 1
	return {"id": next_id, "t": t, "c": c}

func inside(p: Vector2i) -> bool:
	return p.x >= 0 and p.y >= 0 and p.x < Data.GRID_W and p.y < Data.GRID_H

func place(p: Vector2i, kind: String, dir: int = 0) -> Dictionary:
	var c := {"kind": kind, "dir": dir}
	if kind == "belt":
		c.item = null
		c.p = 0.0
	else:
		c.inbuf = []
		c.outbuf = []
		c.t = 0.0
		c.busy = false
		c.job = []
		var def: Dictionary = Data.MACHINES[kind]
		if def.has("modes"):
			c.mode = def.modes.keys()[0]
		if def.kind == "paint":
			c.color = "red"
		if def.kind == "assemble":
			c.toy = "car"
	cells[p] = c
	return c

func remove(p: Vector2i) -> void:
	cells.erase(p)

# ---------------------------------------------------------------- rules
func wants(c: Dictionary, it: Dictionary) -> bool:
	var def: Dictionary = Data.MACHINES[c.kind]
	match def.kind:
		"proc":
			return it.t == def.modes[c.mode].in and c.inbuf.size() < Data.BUFFER
		"paint":
			return Data.PARTS.has(it.t) and Data.PARTS[it.t].get("paint", false) and c.inbuf.size() < 2
		"assemble":
			var needs: Dictionary = Data.TOYS[c.toy].needs
			if not needs.has(it.t):
				return false
			var have: int = c.inbuf.filter(func(x): return x.t == it.t).size()
			return have < needs[it.t] * 2
		"dock":
			return Data.TOYS.has(it.t)
	return false

func _start_job(c: Dictionary) -> void:
	var def: Dictionary = Data.MACHINES[c.kind]
	match def.kind:
		"proc":
			var m: Dictionary = def.modes[c.mode]
			for i in c.inbuf.size():
				if c.inbuf[i].t == m.in:
					c.inbuf.remove_at(i)
					c.job = m.out.map(func(t): return new_item(t))
					c.busy = true
					c.dur = m.time
					c.t = 0.0
					return
		"paint":
			if c.inbuf.size() > 0:
				var it: Dictionary = c.inbuf.pop_front()
				c.job = [new_item(it.t, c.color)]
				c.busy = true
				c.dur = def.time
				c.t = 0.0
		"assemble":
			var toy: Dictionary = Data.TOYS[c.toy]
			for k in toy.needs:
				if c.inbuf.filter(func(x): return x.t == k).size() < toy.needs[k]:
					return
			var colour := "wood"
			for k in toy.needs:
				var n: int = toy.needs[k]
				var i := 0
				while n > 0 and i < c.inbuf.size():
					if c.inbuf[i].t == k:
						if k == toy.body and colour == "wood":
							colour = c.inbuf[i].c
						c.inbuf.remove_at(i)
						n -= 1
					else:
						i += 1
			c.job = [new_item(c.toy, colour)]
			c.busy = true
			c.dur = 2.0
			c.t = 0.0

func _push(from: Vector2i, c: Dictionary) -> void:
	if c.outbuf.is_empty():
		return
	var to: Vector2i = from + Data.DIRS[c.dir]
	if not cells.has(to):
		return
	var d: Dictionary = cells[to]
	if d.kind == "belt":
		if d.item == null and (d.dir + 2) % 4 != c.dir:
			d.item = c.outbuf.pop_front()
			d.p = 0.0
	elif wants(d, c.outbuf[0]):
		_take(to, d, c.outbuf.pop_front())

func _take(p: Vector2i, c: Dictionary, it: Dictionary) -> void:
	if Data.MACHINES[c.kind].kind == "dock":
		shipped.emit(it, p)
	else:
		c.inbuf.append(it)

func step(dt: float) -> void:
	dt *= speed
	# belts first: move along, hand over at the end
	for p in cells:
		var c: Dictionary = cells[p]
		if c.kind != "belt" or c.item == null:
			continue
		c.p = minf(1.0, c.p + dt * Data.BELT_SPEED)
		if c.p < 1.0:
			continue
		var to: Vector2i = p + Data.DIRS[c.dir]
		if not cells.has(to):
			continue
		var d: Dictionary = cells[to]
		if d.kind == "belt":
			if d.item == null and (d.dir + 2) % 4 != c.dir:
				d.item = c.item
				d.p = 0.0
				c.item = null
		elif (p - to) != Data.DIRS[d.dir] and wants(d, c.item):
			# machines take things from any side except the one they push out of
			_take(to, d, c.item)
			c.item = null
	# machines
	for p in cells:
		var c: Dictionary = cells[p]
		if c.kind == "belt":
			continue
		var def: Dictionary = Data.MACHINES[c.kind]
		if def.kind == "crate":
			c.t += dt
			if c.t >= def.period and c.outbuf.is_empty():
				c.outbuf.append(new_item(def.makes))
				c.t = 0.0
				made.emit(p)
		elif def.kind != "dock":
			if not c.busy and c.outbuf.size() < 2:
				_start_job(c)
			if c.busy:
				c.t += dt
				if c.t >= c.dur:
					c.outbuf.append_array(c.job)
					c.job = []
					c.busy = false
					made.emit(p)
		_push(p, c)

# ---------------------------------------------------------------- saving
func to_save() -> Array:
	var out := []
	for p in cells:
		var c: Dictionary = cells[p]
		var s := {"x": p.x, "y": p.y, "k": c.kind, "d": c.dir}
		for key in ["mode", "color", "toy"]:
			if c.has(key):
				s[key] = c[key]
		out.append(s)
	return out

func load_save(arr: Array) -> void:
	cells.clear()
	for s in arr:
		if not Data.MACHINES.has(s.k):
			continue
		var c := place(Vector2i(int(s.x), int(s.y)), s.k, int(s.d))
		for key in ["mode", "color", "toy"]:
			if s.has(key):
				c[key] = s[key]

func starter() -> void:
	cells.clear()
	place(Vector2i(0, 2), "crate_wood", 0)
	place(Vector2i(1, 2), "belt", 0)
	place(Vector2i(2, 2), "saw", 0)
	for x in [3, 4]:
		place(Vector2i(x, 2), "belt", 0)
	place(Vector2i(5, 2), "assembler", 0)
	for x in [6, 7, 8]:
		place(Vector2i(x, 2), "belt", 0)
	place(Vector2i(9, 2), "dock", 0)
	place(Vector2i(0, 5), "crate_wood", 0)
	place(Vector2i(1, 5), "belt", 0)
	place(Vector2i(2, 5), "lathe", 0)
	for x in [3, 4]:
		place(Vector2i(x, 5), "belt", 0)
	for y in [5, 4, 3]:
		place(Vector2i(5, y), "belt", 3)
