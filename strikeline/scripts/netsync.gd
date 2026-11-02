class_name NetSync
extends RefCounted
## Packs the host's match state into a compact snapshot and applies it on guests,
## plus the guest input packet. Pack and unpack must stay in the same order.

const PROJ_KINDS := ["crescent", "kunai", "orb", "shockwave"]
const ITEM_KINDS := ["bomb", "food"]

static var _names: Array = []
static var _index := {}


static func _tables() -> void:
	if not _names.is_empty():
		return
	Roster.move("jab1")
	_names = Roster._moves.keys()
	_names.sort()
	for i in _names.size():
		_index[_names[i]] = i


# ------------------------------------------------------------------ snapshot
static func pack(m: Match) -> PackedByteArray:
	_tables()
	var b := StreamPeerBuffer.new()
	b.put_u32(m.frame)
	b.put_u16(clampi(m.countdown, 0, 65535))
	b.put_32(m.time_left)
	b.put_u8(int(m.over) | (int(m.sudden) << 1) | (int(m.timed) << 2))
	b.put_8(m.winner)
	b.put_8(m.focus.port if m.focus != null and is_instance_valid(m.focus) else -1)
	b.put_u32(m.stage.frame)
	b.put_u8(m.fighters.size())
	for f in m.fighters:
		_pack_f(b, f)
	# projectiles
	var pl: Array = m.proj.list
	b.put_u8(mini(pl.size(), 60))
	for i in mini(pl.size(), 60):
		var p: Dictionary = pl[i]
		b.put_u8(PROJ_KINDS.find(p.kind))
		b.put_float(p.p.x)
		b.put_float(p.p.y)
		b.put_float(p.v.x)
		b.put_float(p.v.y)
		b.put_float(p.r)
		b.put_u8((p.owner as Fighter).port)
		b.put_u16(clampi(p.t, 0, 65535))
		b.put_u16(clampi(p.life, 0, 65535))
	# items
	var il: Array = m.items.list
	b.put_u8(mini(il.size(), 20))
	for i in mini(il.size(), 20):
		var it: Dictionary = il[i]
		b.put_u8(ITEM_KINDS.find(it.kind))
		b.put_float(it.p.x)
		b.put_float(it.p.y)
		b.put_8((it.held_by as Fighter).port if it.held_by != null else -1)
		b.put_u8(int(it.get("armed", false)) | (int(it.grounded) << 1))
		b.put_u16(clampi(it.t, 0, 65535))
	var c: Dictionary = m.items.core
	b.put_u8(0 if c.is_empty() else 1)
	if not c.is_empty():
		b.put_float(c.p.x)
		b.put_float(c.p.y)
		b.put_u16(clampi(c.t, 0, 65535))
		b.put_float(c.flash)
	return b.data_array


static func _pack_f(b: StreamPeerBuffer, f: Fighter) -> void:
	b.put_u8(f.state)
	b.put_8(int(f.facing))
	b.put_float(f.pos.x)
	b.put_float(f.pos.y)
	b.put_float(f.root.x)
	b.put_float(f.root.y)
	b.put_float(f.damage)
	b.put_8(clampi(f.stocks, -1, 127))
	b.put_8(clampi(f.score, -127, 127))
	var fl := int(f.visible) | (int(f.fs_ready) << 1) | (int(f.charging) << 2) | (int(f.counter_on) << 3) \
		| (int(f.tumble) << 4) | (int(f.grounded) << 5) | (int(f.is_cpu) << 6) | (int(f.eliminated) << 7)
	b.put_u8(fl)
	b.put_u8(clampi(f.invincible, 0, 255))
	b.put_u8(clampi(f.intangible, 0, 255))
	b.put_u8(clampi(f.hitlag, 0, 255))
	b.put_u8(clampi(f.intro_t, 0, 255))
	b.put_u8(clampi(f.combo, 0, 255))
	b.put_float(f.flash)
	b.put_float(f.shield_hp)
	b.put_u16(clampi(f.sframe, 0, 65535))
	b.put_float(f.squash)
	b.put_float(f.vel.x)
	b.put_float(f.vel.y)
	b.put_float(f.kvel.x)
	b.put_float(f.kvel.y)
	b.put_u32(f.t)
	for i in Rig.NP:
		b.put_float(f.cur[i])
	var mn := f.move_name()
	b.put_u8(_index.get(mn, 255))
	b.put_float(f.mf)


static func unpack(m: Match, data: PackedByteArray) -> void:
	_tables()
	var b := StreamPeerBuffer.new()
	b.data_array = data
	m.frame = b.get_u32()
	m.countdown = b.get_u16()
	m.time_left = b.get_32()
	var fl := b.get_u8()
	m.over = fl & 1 != 0
	m.sudden = fl & 2 != 0
	m.timed = fl & 4 != 0
	m.winner = b.get_8()
	var fp := b.get_8()
	m.focus = m.fighters[fp] if fp >= 0 and fp < m.fighters.size() else null
	m.stage.frame = b.get_u32() - 1
	m.stage.step()
	var n := b.get_u8()
	for i in n:
		_unpack_f(b, m.fighters[i] if i < m.fighters.size() else null)
	# projectiles
	var pl: Array = []
	for i in b.get_u8():
		var k := b.get_u8()
		var p := {"kind": PROJ_KINDS[clampi(k, 0, 3)], "p": Vector2(b.get_float(), b.get_float()), "v": Vector2(b.get_float(), b.get_float()),
			"r": b.get_float()}
		var owner: int = b.get_u8()
		p.owner = m.fighters[owner]
		p.c = (m.fighters[owner] as Fighter).data.accent
		p.t = b.get_u16()
		p.life = b.get_u16()
		pl.append(p)
	m.proj.list = pl
	# items
	var il: Array = []
	for i in b.get_u8():
		var it := {"kind": ITEM_KINDS[clampi(b.get_u8(), 0, 1)], "p": Vector2(b.get_float(), b.get_float())}
		var hb := b.get_8()
		it.held_by = m.fighters[hb] if hb >= 0 else null
		var f2 := b.get_u8()
		it.armed = f2 & 1 != 0
		it.grounded = f2 & 2 != 0
		it.t = b.get_u16()
		it.v = Vector2.ZERO
		it.thrown_by = null
		il.append(it)
	m.items.list = il
	if b.get_u8() == 1:
		m.items.core = {"p": Vector2(b.get_float(), b.get_float()), "t": b.get_u16(), "flash": b.get_float(), "hp": 1.0}
	else:
		m.items.core = {}


static func _unpack_f(b: StreamPeerBuffer, f: Fighter) -> void:
	var st := b.get_u8()
	var facing := float(b.get_8())
	var pos := Vector2(b.get_float(), b.get_float())
	var root := Vector2(b.get_float(), b.get_float())
	var dmg := b.get_float()
	var stocks := b.get_8()
	var score := b.get_8()
	var fl := b.get_u8()
	var inv := b.get_u8()
	var intang := b.get_u8()
	var hitlag := b.get_u8()
	var intro := b.get_u8()
	var combo := b.get_u8()
	var flash := b.get_float()
	var shp := b.get_float()
	var sframe := b.get_u16()
	var squash := b.get_float()
	var vel := Vector2(b.get_float(), b.get_float())
	var kvel := Vector2(b.get_float(), b.get_float())
	var t := b.get_u32()
	var pose := PackedFloat32Array()
	pose.resize(Rig.NP)
	for i in Rig.NP:
		pose[i] = b.get_float()
	var mi := b.get_u8()
	var mf := b.get_float()
	if f == null:
		return
	f.state = st
	f.facing = facing if facing != 0.0 else 1.0
	f.pos = pos
	f.root = root
	f.damage = dmg
	f.stocks = stocks
	f.score = score
	f.visible = fl & 1 != 0
	f.fs_ready = fl & 2 != 0
	f.charging = fl & 4 != 0
	f.counter_on = fl & 8 != 0
	f.tumble = fl & 16 != 0
	f.grounded = fl & 32 != 0
	if fl & 64 != 0 and not f.is_cpu:
		f.is_cpu = true
		f.tag_text = "CPU"
	f.eliminated = fl & 128 != 0
	f.invincible = inv
	f.intangible = intang
	f.hitlag = hitlag
	f.intro_t = intro
	f.combo = combo
	f.flash = flash
	f.shield_hp = shp
	f.sframe = sframe
	f.squash = squash
	f.vel = vel
	f.kvel = kvel
	f.t = t
	f.cur = pose
	var name: String = _names[mi] if mi < _names.size() else ""
	if name == "":
		f.mv = {}
	elif f.mv.get("id", "") != name:
		f.mv = Roster.move(name)
		f.trail.clear()
	f.mf = mf


# ------------------------------------------------------------------ guest input
static func pack_input(i: Dictionary, counters: Dictionary) -> PackedByteArray:
	var b := StreamPeerBuffer.new()
	b.put_8(clampi(int(round(float(i.get("x", 0.0)) * 100.0)), -100, 100))
	b.put_8(clampi(int(round(float(i.get("y", 0.0)) * 100.0)), -100, 100))
	var fl := int(i.get("atk_h", false)) | (int(i.get("spc_h", false)) << 1) | (int(i.get("jmp_h", false)) << 2) \
		| (int(i.get("shd", false)) << 3) | (int(i.get("smash", false)) << 4) | (int(i.get("down_h", false)) << 5)
	b.put_u8(fl)
	for k in ["atk", "spc", "jmp", "shd_p", "down", "flick_x"]:
		if i.get(k, false):
			counters[k] = (int(counters.get(k, 0)) + 1) & 255
		b.put_u8(int(counters.get(k, 0)))
	return b.data_array


## Host: turns the latest packet into an input dictionary. `seen` remembers the press
## counters already used, so a press is never lost or repeated if packets drop.
static func unpack_input(data: PackedByteArray, seen: Dictionary) -> Dictionary:
	var out := {"x": 0.0, "y": 0.0}
	if data.size() < 9:
		return out
	var b := StreamPeerBuffer.new()
	b.data_array = data
	out.x = b.get_8() / 100.0
	out.y = b.get_8() / 100.0
	var fl := b.get_u8()
	out.atk_h = fl & 1 != 0
	out.spc_h = fl & 2 != 0
	out.jmp_h = fl & 4 != 0
	out.shd = fl & 8 != 0
	out.smash = fl & 16 != 0
	out.down_h = fl & 32 != 0
	for k in ["atk", "spc", "jmp", "shd_p", "down", "flick_x"]:
		var c := b.get_u8()
		out[k] = seen.has(k) and int(seen[k]) != c
		seen[k] = c
	return out
