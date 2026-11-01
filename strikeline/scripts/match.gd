class_name Match
extends Node2D
## A fight: owns the stage, fighters, camera, effects, HUD and touch controls,
## and resolves hits, knockback and KOs.

signal finished(results: Dictionary)

const PORT_COLORS := [Color(1.0, 0.32, 0.32), Color(0.3, 0.6, 1.0), Color(1.0, 0.85, 0.2), Color(0.3, 0.95, 0.45)]

var cfg: Dictionary
var demo := false
var training := false
var stage: Stage
var bg: StageBG
var world: Node2D
var fx: FX
var proj: Projectiles
var cam: Camera2D
var hud
var pad
var fighters: Array = []
var ledge_owner := {}
var frame := 0
var countdown := 0
var over := false
var over_t := 0
var paused := false
var shake := 0.0
var zoom_punch := 0.0
var cam_center := Vector2(0, -150)
var cam_zoom := 0.85
var slowmo_t := 0.0
var winner := -1
var pause_layer: CanvasLayer
var pause_ui


func setup(config: Dictionary) -> void:
	cfg = config
	demo = cfg.get("mode", "") == "demo"
	training = cfg.get("mode", "") == "training"

	var bgl := CanvasLayer.new()
	bgl.layer = -10
	add_child(bgl)
	bg = StageBG.new()
	bg.setup(cfg.stage)
	bgl.add_child(bg)

	world = Node2D.new()
	add_child(world)
	stage = Stage.new()
	stage.setup(cfg.stage)
	world.add_child(stage)

	var players: Array = cfg.players
	for i in players.size():
		var pl: Dictionary = players[i]
		var f := Fighter.new()
		f.setup(self, i, pl.fighter, pl.cpu, pl.get("level", 2))
		f.stocks = 99 if training else int(cfg.get("stocks", 3))
		f.tag_color = PORT_COLORS[i % 4]
		f.tag_text = ("CPU" if pl.cpu else "P%d" % (i + 1)) if not demo else ""
		var sp: Vector2 = stage.spawns[i % stage.spawns.size()]
		f.place(sp, 1.0 if sp.x < 0 else -1.0)
		f.grounded = true
		f.plat = 0
		f.state = Fighter.S.IDLE
		world.add_child(f)
		fighters.append(f)

	proj = Projectiles.new()
	proj.arena = self
	world.add_child(proj)
	fx = FX.new()
	world.add_child(fx)

	cam = Camera2D.new()
	cam.position = cam_center
	cam.zoom = Vector2(cam_zoom, cam_zoom)
	add_child(cam)
	cam.make_current()

	if not demo:
		var hl := CanvasLayer.new()
		hl.layer = 5
		add_child(hl)
		hud = Hud.new()
		hud.arena = self
		hl.add_child(hud)
		var tl := CanvasLayer.new()
		tl.layer = 10
		add_child(tl)
		pad = TouchPad.new()
		pad.arena = self
		tl.add_child(pad)
		countdown = 200
	else:
		countdown = 0
	Game.play_music("battle" if not demo else "menu")


func _physics_process(_delta: float) -> void:
	if paused:
		return
	frame += 1
	if slowmo_t > 0.0:
		slowmo_t -= 1.0
		if slowmo_t <= 0.0:
			Engine.time_scale = 1.0

	var human_in: Dictionary = pad.poll() if pad != null else {}
	if countdown > 0:
		countdown -= 1
		if countdown == 170 or countdown == 120 or countdown == 70:
			Sfx.play("beep", -2)
		if countdown == 20:
			Sfx.play("go", 0)
		for f in fighters:
			f.tick(_idle_input())
		_update_camera()
		fx.step()
		return

	for f in fighters:
		var i: Dictionary
		if f.is_cpu:
			i = f.brain.think() if not over else _idle_input()
		else:
			i = human_in if not over else _idle_input()
		f.tick(i)
	_resolve_hits()
	proj.step()
	_check_blast()
	fx.step()
	_update_camera()
	if over:
		over_t += 1
		if over_t == 150:
			_finish()


func _idle_input() -> Dictionary:
	return {"x": 0.0, "y": 0.0}


# ------------------------------------------------------------------ hits
func _resolve_hits() -> void:
	for a in fighters:
		if a.hitlag > 0:
			continue
		var boxes: Array = a.active_hitboxes()
		if boxes.is_empty():
			continue
		for v in fighters:
			if v == a or not v.can_be_hit():
				continue
			for hb in boxes:
				var h: Dictionary = hb.hit
				var key := str(v.port) + ":" + str(h.f[0])
				if a.hit_log.has(key):
					var rh: int = h.get("rehit", 0)
					if rh <= 0 or a.mf - float(a.hit_log[key]) < rh:
						continue
				var c: Vector2 = hb.c
				var r: float = hb.r
				var touched := false
				if v.state == Fighter.S.SHIELD:
					touched = c.distance_to(v.core_world()) < r + v.shield_radius()
				else:
					touched = v.hurt_test(c, r)
				if not touched:
					continue
				# one hit per victim per move (all hitboxes of the same move share the log)
				for hh in a.mv.hits:
					if a.mf >= hh.f[0] and a.mf <= hh.f[1]:
						a.hit_log[str(v.port) + ":" + str(hh.f[0])] = a.mf
				var dirx: float = a.facing
				if h.get("radial", false):
					dirx = signf(v.pos.x - a.pos.x)
					if dirx == 0.0:
						dirx = a.facing
				elif h.get("back", false):
					dirx = -a.facing
				var mult := 1.0
				var mn: String = a.mv.get("id", "")
				if a.mv.get("kind", "") == "smash":
					mult = 1.0 + 0.45 * a.charge_ct / 60.0
				elif mn == "bruno_nb":
					mult = 1.0 + 1.3 * a.charge_ct / 60.0
				var hd := h
				if mn == "kai_counter":
					hd = h.duplicate()
					hd.d = maxf(h.d, a.get_meta("counter_dmg", 10.0))
				apply_hit(a, v, hd, c, dirx, mult, false)
				break


func apply_hit(a: Fighter, v: Fighter, h: Dictionary, c: Vector2, dirx: float, mult: float, is_proj: bool) -> void:
	var dmg: float = snappedf(h.d * a.data.dmg * mult, 0.1)
	var after: float = v.damage + dmg
	var wk: float = 2.0 / (1.0 + v.data.weight)
	var kb: float = (h.b + h.g * after / 100.0 * (1.35 + dmg / 40.0)) * wk
	var lag := clampi(int(3 + dmg * 0.45), 3, 15)
	var strong := kb > 27.0
	if strong:
		lag += 5
	var res: String = v.take_hit(a, dmg, kb, h.a, dirx, lag)
	match res:
		"counter":
			_counter(v, a, dmg)
		"shield":
			if not is_proj:
				a.hitlag = lag
			fx.shield_hit(c, v.data.accent)
			Sfx.play("shield_hit", -4)
		_:
			if not is_proj:
				a.hitlag = lag
				a.hit_landed = true
			a.st_dealt += dmg
			var power := dmg + kb * 0.5
			fx.hit(c, Vector2(dirx, -0.4).normalized(), power, a.data.accent)
			camera_shake(minf(3.0 + kb * 0.35, 16.0))
			if strong:
				zoom_punch = 0.08
				Sfx.play("hit_crit", 0)
				if hud: hud.flash(0.25)
			elif dmg >= 10.0:
				Sfx.play("hit_h", -2)
			elif dmg >= 5.0:
				Sfx.play("hit_m", -3)
			else:
				Sfx.play("hit_l", -4)
			if hud: hud.bump(v.port)
			if (not a.is_cpu or not v.is_cpu) and not demo:
				Input.vibrate_handheld(clampi(int(20 + kb * 2.0), 20, 90))


func _counter(kai: Fighter, att: Fighter, dmg: float) -> void:
	kai.position = kai.pos
	kai.pos.x = att.pos.x - att.facing * 52.0
	kai.pos.y = att.pos.y
	kai.facing = att.facing
	kai.set_meta("counter_dmg", maxf(dmg * 1.3, 10.0))
	kai._begin("kai_counter")
	kai.intangible = 12
	att.hitlag = 14
	kai.hitlag = 6
	if att.state == Fighter.S.ATTACK:
		for hh in att.mv.hits:
			att.hit_log[str(kai.port) + ":" + str(hh.f[0])] = att.mf
	fx.smoke(kai.core_world(), kai.data.accent)
	fx.ring(kai.core_world(), Color(1, 1, 1), 90.0, 0.4, 6.0)
	Sfx.play("counter", 0)
	if hud: hud.flash(0.35)
	camera_shake(6.0)


func spawn_projectile(kind: String, owner: Fighter, charge: float) -> void:
	proj.spawn(kind, owner, charge)


func destroy_projectiles_near(c: Vector2, r: float, by: Fighter) -> void:
	proj.destroy_near(c, r, by)


# ------------------------------------------------------------------ KOs
func _check_blast() -> void:
	var b := stage.blast
	for f in fighters:
		if not f.alive() or f.state == Fighter.S.RESPAWN:
			continue
		var p: Vector2 = f.pos
		var top_ko: bool = p.y < b.position.y and f.state == Fighter.S.HITSTUN
		if p.x < b.position.x or p.x > b.end.x or p.y > b.end.y or top_ko or p.y < b.position.y - 600.0:
			_ko(f)


func _ko(f: Fighter) -> void:
	var b := stage.blast
	var p := Vector2(clampf(f.pos.x, b.position.x + 20, b.end.x - 20), clampf(f.pos.y, b.position.y + 20, b.end.y - 20))
	var toward := (cam_center - p).normalized()
	fx.ko_blast(p, toward, f.data.accent)
	camera_shake(22.0)
	Sfx.play("ko", 0)
	if f.last_hitter >= 0 and f.last_hitter != f.port:
		fighters[f.last_hitter].st_kos += 1
	f.ko()
	if hud:
		hud.flash(0.5)
		hud.ko_popup(f)
	if training or demo:
		if demo and f.stocks <= 0:
			f.stocks = 3
		return
	var alive_n := 0
	var last := -1
	for g in fighters:
		if g.stocks > 0:
			alive_n += 1
			last = g.port
	if alive_n <= 1 and not over:
		over = true
		winner = last
		Engine.time_scale = 0.25
		slowmo_t = 30.0
		if hud: hud.game_set()
		Sfx.play("game", 0)


func _finish() -> void:
	Engine.time_scale = 1.0
	var res := {"winner": winner, "fighters": [], "cfg": cfg}
	for f in fighters:
		res.fighters.append({"port": f.port, "fighter": Roster.FIGHTERS.find(f.data), "cpu": f.is_cpu,
			"kos": f.st_kos, "falls": f.st_falls, "dealt": f.st_dealt, "stocks": maxi(f.stocks, 0)})
	finished.emit(res)


# ------------------------------------------------------------------ camera
func camera_shake(a: float) -> void:
	shake = maxf(shake, a)


func _update_camera() -> void:
	var r := Rect2()
	var first := true
	for f in fighters:
		if not f.alive():
			continue
		var p: Vector2 = f.pos + Vector2(0, -50)
		if first:
			r = Rect2(p, Vector2.ZERO)
			first = false
		else:
			r = r.expand(p)
	if first:
		r = Rect2(Vector2(0, -100), Vector2.ZERO)
	r = r.grow_individual(190, 190, 190, 120)
	var b := stage.blast
	var center := r.get_center()
	center = center.lerp(Vector2(0, -120), 0.2)
	center.x = clampf(center.x, b.position.x + 500, b.end.x - 500)
	center.y = clampf(center.y, b.position.y + 300, b.end.y - 280)
	var vs := get_viewport_rect().size
	var z := minf(vs.x / maxf(r.size.x, 1.0), vs.y / maxf(r.size.y, 1.0))
	z = clampf(z, 0.45, 1.4)
	if demo:
		z = minf(z, 0.75)
	cam_center = cam_center.lerp(center, 0.07)
	cam_zoom = lerpf(cam_zoom, z, 0.045)
	zoom_punch = move_toward(zoom_punch, 0.0, 0.006)
	shake = move_toward(shake, 0.0, 0.9)
	var off := Vector2(randf_range(-1, 1), randf_range(-1, 1)) * shake
	cam.position = cam_center + off
	var zz := cam_zoom * (1.0 + zoom_punch)
	cam.zoom = Vector2(zz, zz)
	bg.cam_pos = cam.position
	bg.cam_zoom = zz


# ------------------------------------------------------------------ pause
func set_paused(p: bool) -> void:
	paused = p
	if pad: pad.reset()
	if p:
		Engine.time_scale = 1.0
		pause_layer = CanvasLayer.new()
		pause_layer.layer = 20
		add_child(pause_layer)
		pause_ui = PauseMenu.new()
		pause_ui.arena = self
		pause_layer.add_child(pause_ui)
		Sfx.play("ui_back", -4)
	elif pause_layer:
		pause_layer.queue_free()
		pause_layer = null


func quit_to_menu() -> void:
	Engine.time_scale = 1.0
	finished.emit({"quit": true, "cfg": cfg})


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST and not demo:
		set_paused(not paused)
	elif what == NOTIFICATION_APPLICATION_PAUSED and not demo and not paused and not over:
		set_paused(true)
