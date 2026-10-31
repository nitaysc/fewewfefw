extends CanvasLayer
## The interface: joystick and action button, coins, level, day clock, orders with their
## patience, and the pop-ups (start, level up, end of day, the shop).

var ws: Node3D                     # the workshop
var icons: IconMaker
var font: Font
var root: Control
var joy := Vector2.ZERO

var coin_label: Label
var shown_coins := 0.0
var level_label: Label
var xp_bar: ProgressBar
var clock_label: Label
var inv_label: Label
var seed_icon: TextureRect
var act_btn: Button
var act_label: Label
var chips: HBoxContainer
var chips_for := ""
var hint_panel: PanelContainer
var hint_label: Label
var hint_t := 0.0
var popup: Control

const CREAM := Color("fff6ea")
const INK := Color("3e2c26")
const ORANGE := Color("f08a3c")
const TEAL := Color("3f9e8f")
const GREEN := Color("5aa860")

func _ready() -> void:
	layer = 5
	var fv := FontVariation.new()
	fv.base_font = load("res://fonts/Fredoka.ttf")
	fv.variation_opentype = {TextServerManager.get_primary_interface().name_to_tag("wght"): 600}
	font = fv
	icons = IconMaker.new()
	add_child(icons)
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = _theme()
	add_child(root)
	_joystick()
	_top()
	_action()
	_hint()
	Game.changed.connect(_refresh)
	Game.leveled.connect(_on_level)
	shown_coins = Game.coins
	_refresh()

func bind(w: Node3D) -> void:
	ws = w
	ws.hud = self
	ws.hint.connect(show_hint)
	ws.popped.connect(_float)
	if not Game.seen_intro:
		_intro()

# ---------------------------------------------------------------- look
func sb(c: Color, r := 22, shadow := 8, border := 0, bc := Color.TRANSPARENT) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = c
	s.set_corner_radius_all(r)
	s.corner_detail = 10
	s.anti_aliasing = true
	if shadow > 0:
		s.shadow_color = Color(0.1, 0.05, 0.03, 0.3)
		s.shadow_size = shadow
		s.shadow_offset = Vector2(0, shadow * 0.5)
	if border > 0:
		s.set_border_width_all(border)
		s.border_color = bc
	s.content_margin_left = 16
	s.content_margin_right = 16
	s.content_margin_top = 10
	s.content_margin_bottom = 10
	return s

func _theme() -> Theme:
	var th := Theme.new()
	th.default_font = font
	th.default_font_size = 24
	th.set_color("font_color", "Label", INK)
	th.set_stylebox("panel", "PanelContainer", sb(CREAM))
	for st in ["normal", "hover"]:
		var bn := sb(ORANGE, 20, 6)
		bn.border_width_bottom = 5
		bn.border_color = ORANGE.darkened(0.25)
		th.set_stylebox(st, "Button", bn)
	var bp := sb(ORANGE.darkened(0.08), 20, 2)
	bp.border_width_top = 4
	bp.border_color = ORANGE.darkened(0.3)
	th.set_stylebox("pressed", "Button", bp)
	th.set_stylebox("disabled", "Button", sb(Color("cfc4b8"), 20, 2))
	th.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	for k in ["font_color", "font_hover_color", "font_pressed_color"]:
		th.set_color(k, "Button", Color.WHITE)
	th.set_color("font_disabled_color", "Button", Color("8f8378"))
	th.set_constant("outline_size", "Button", 6)
	th.set_color("font_outline_color", "Button", Color(0, 0, 0, 0.25))
	var bg := sb(Color("e6d6c2"), 8, 0)
	bg.content_margin_top = 0
	bg.content_margin_bottom = 0
	var fill := sb(GREEN, 8, 0)
	fill.content_margin_top = 0
	fill.content_margin_bottom = 0
	th.set_stylebox("background", "ProgressBar", bg)
	th.set_stylebox("fill", "ProgressBar", fill)
	return th

func label(text: String, size := 24, col := INK) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

func pic(tex: Texture2D, size := 56) -> TextureRect:
	var r := TextureRect.new()
	r.texture = tex
	r.custom_minimum_size = Vector2(size, size)
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r

func juice(b: Control) -> void:
	b.resized.connect(func(): b.pivot_offset = b.size / 2.0)
	if b is BaseButton:
		b.button_down.connect(func(): create_tween().tween_property(b, "scale", Vector2(0.9, 0.9), 0.06))
		b.button_up.connect(func(): create_tween().tween_property(b, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT))

func button(text: String, col := ORANGE, size := 24) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", size)
	if col != ORANGE:
		for st in ["normal", "hover"]:
			var n := sb(col, 20, 6)
			n.border_width_bottom = 5
			n.border_color = col.darkened(0.25)
			b.add_theme_stylebox_override(st, n)
		var p := sb(col.darkened(0.08), 20, 2)
		p.border_width_top = 4
		p.border_color = col.darkened(0.3)
		b.add_theme_stylebox_override("pressed", p)
	b.pressed.connect(func(): Sfx.play("click"))
	juice(b)
	return b

func crop_icon(t: String) -> Texture2D:
	return icons.get_icon("p|" + t, func(): return Props.produce(t))

# ---------------------------------------------------------------- joystick
class Stick extends Control:
	var hud
	var active := -1
	var center := Vector2.ZERO
	var knob := Vector2.ZERO
	const R := 90.0
	func _gui_input(e: InputEvent) -> void:
		if e is InputEventScreenTouch:
			if e.pressed and active < 0:
				active = e.index
				center = e.position
				knob = Vector2.ZERO
			elif not e.pressed and e.index == active:
				active = -1
				knob = Vector2.ZERO
			accept_event()
		elif e is InputEventScreenDrag and e.index == active:
			knob = (e.position - center).limit_length(R)
			accept_event()
		hud.joy = knob / R
		queue_redraw()
	func _draw() -> void:
		var c := center if active >= 0 else Vector2(170, size.y - 170)
		draw_circle(c, R + 14, Color(1, 1, 1, 0.12))
		draw_arc(c, R + 14, 0, TAU, 64, Color(1, 1, 1, 0.35), 4.0, true)
		draw_circle(c + knob, 46, Color(1, 0.97, 0.92, 0.85))
		draw_arc(c + knob, 46, 0, TAU, 48, Color(0.24, 0.17, 0.14, 0.35), 3.0, true)

func _joystick() -> void:
	var s := Stick.new()
	s.hud = self
	s.anchor_right = 0.45
	s.anchor_bottom = 1.0
	s.anchor_top = 0.3
	s.mouse_filter = Control.MOUSE_FILTER_STOP
	root.add_child(s)

# ---------------------------------------------------------------- top bar
func _top() -> void:
	var bar := HBoxContainer.new()
	bar.position = Vector2(22, 18)
	bar.add_theme_constant_override("separation", 12)
	root.add_child(bar)
	var cp := PanelContainer.new()
	cp.add_theme_stylebox_override("panel", sb(CREAM, 30))
	var ch := HBoxContainer.new()
	ch.add_child(pic(icons.get_icon("coin", Meshes.coin), 40))
	coin_label = label("0", 30)
	coin_label.custom_minimum_size.x = 80
	ch.add_child(coin_label)
	cp.add_child(ch)
	bar.add_child(cp)
	var lp := PanelContainer.new()
	lp.add_theme_stylebox_override("panel", sb(CREAM, 30))
	var lv := VBoxContainer.new()
	lv.add_theme_constant_override("separation", 2)
	level_label = label("Level 1", 20)
	lv.add_child(level_label)
	xp_bar = ProgressBar.new()
	xp_bar.custom_minimum_size = Vector2(150, 12)
	xp_bar.show_percentage = false
	lv.add_child(xp_bar)
	lp.add_child(lv)
	bar.add_child(lp)
	var dp := PanelContainer.new()
	dp.add_theme_stylebox_override("panel", sb(Color(0.15, 0.1, 0.08, 0.75), 30, 0))
	clock_label = label("Day 1", 24, CREAM)
	dp.add_child(clock_label)
	bar.add_child(dp)
	# what you have: seeds of the chosen kind, water in the can, wood
	var ip := PanelContainer.new()
	ip.add_theme_stylebox_override("panel", sb(CREAM, 30))
	var ih := HBoxContainer.new()
	seed_icon = pic(crop_icon(Game.seed), 36)
	ih.add_child(seed_icon)
	inv_label = label("", 22)
	ih.add_child(inv_label)
	ip.add_child(ih)
	bar.add_child(ip)
	var right := HBoxContainer.new()
	right.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	right.position = Vector2(-300, 18)
	right.add_theme_constant_override("separation", 10)
	root.add_child(right)
	var shop := button("Shop", TEAL, 22)
	shop.custom_minimum_size = Vector2(120, 54)
	shop.pressed.connect(_shop)
	right.add_child(shop)
	var mute := button("Sound", Color("8a7a6c"), 18)
	mute.custom_minimum_size = Vector2(110, 54)
	mute.pressed.connect(func():
		Sfx.set_muted(not Sfx.muted)
		mute.text = "Muted" if Sfx.muted else "Sound")
	right.add_child(mute)

func _refresh() -> void:
	level_label.text = "Level %d" % Game.level
	create_tween().tween_property(xp_bar, "value", 100.0 * Game.xp / Data.xp_for(Game.level), 0.35)
	inv_label.text = "%d seeds   Water %d/%d   Wood %d" % [Game.seeds.get(Game.seed, 0), Game.water, Game.can_size(), Game.wood]
	seed_icon.texture = crop_icon(Game.seed)

func _process(dt: float) -> void:
	var target := float(Game.coins)
	shown_coins = target if absf(shown_coins - target) < 0.5 else lerpf(shown_coins, target, 1.0 - exp(-dt * 8.0))
	coin_label.text = str(int(round(shown_coins)))
	var mins := int(Game.clock * 24 * 60)
	clock_label.text = "Day %d   %d:%02d" % [Game.day, mins / 60, mins % 60]
	if hint_t > 0.0:
		hint_t -= dt
		if hint_t <= 0.0:
			create_tween().tween_property(hint_panel, "modulate:a", 0.0, 0.3)
	_update_action()

func _float(text: String, col: Color) -> void:
	var l := label(text, 40, col)
	l.add_theme_constant_override("outline_size", 12)
	l.add_theme_color_override("font_outline_color", Color(0.22, 0.13, 0.08))
	root.add_child(l)
	l.reset_size()
	l.position = Vector2((root.size.x - l.size.x) / 2.0, root.size.y * 0.3)
	l.pivot_offset = l.size / 2.0
	l.scale = Vector2(0.5, 0.5)
	var tw := create_tween().set_parallel()
	tw.tween_property(l, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "position:y", l.position.y - 70, 1.3)
	tw.tween_property(l, "modulate:a", 0.0, 0.4).set_delay(0.9)
	tw.chain().tween_callback(l.queue_free)

# ---------------------------------------------------------------- action button
func _action() -> void:
	act_btn = Button.new()
	act_btn.custom_minimum_size = Vector2(170, 170)
	act_btn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	act_btn.position = Vector2(-205, -205)
	for st in ["normal", "hover"]:
		var s := sb(ORANGE, 85, 10)
		s.border_width_bottom = 9
		s.border_color = ORANGE.darkened(0.3)
		act_btn.add_theme_stylebox_override(st, s)
	act_btn.add_theme_stylebox_override("pressed", sb(ORANGE.darkened(0.12), 85, 3))
	act_btn.add_theme_stylebox_override("disabled", sb(Color(0.4, 0.33, 0.28, 0.55), 85, 0))
	act_label = label("", 21, Color.WHITE)
	act_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	act_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	act_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	act_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	act_label.offset_left = 12
	act_label.offset_right = -12
	act_label.add_theme_constant_override("outline_size", 6)
	act_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.25))
	act_btn.add_child(act_label)
	act_btn.button_down.connect(func(): if ws: ws.press())
	act_btn.button_up.connect(func(): if ws: ws.release())
	juice(act_btn)
	root.add_child(act_btn)
	chips = HBoxContainer.new()
	chips.add_theme_constant_override("separation", 8)
	root.add_child(chips)

func _update_action() -> void:
	if ws == null:
		return
	var a: Dictionary = ws.action_info()
	act_label.text = a.get("label", "")
	act_btn.disabled = act_label.text == ""
	act_btn.modulate = Color(1, 1, 1, 0.75) if a.get("bad", false) else Color.WHITE
	var pr: float = ws.work_progress()
	if pr >= 0.0:
		act_label.text = "%d%%" % int(pr * 100)
	# seed choice appears at the seed stand and next to empty soil
	var near := ""
	if ws.target and (ws.target.kind == "stand" or (ws.target.kind == "plot" and ws.target.state == "tilled")):
		near = "seeds"
	var key := near + str(Game.level) + Game.seed
	if key != chips_for:
		chips_for = key
		for c in chips.get_children():
			c.queue_free()
		if near == "seeds":
			for c in Data.crops_at(Game.level):
				chips.add_child(_seed_chip(c))
		chips.reset_size()
		chips.position = Vector2(root.size.x - 230 - chips.size.x, root.size.y - 120)

func _seed_chip(c: String) -> Button:
	var on := Game.seed == c
	var b := button("%s  %d" % [Data.CROPS[c].name, Game.seeds.get(c, 0)], TEAL if on else Color("a99686"), 17)
	b.icon = crop_icon(c)
	b.expand_icon = true
	b.custom_minimum_size = Vector2(150, 62)
	b.pressed.connect(func():
		Game.seed = c
		Game.changed.emit()
		chips_for = "")
	return b

# ---------------------------------------------------------------- hints
func _hint() -> void:
	hint_panel = PanelContainer.new()
	hint_panel.add_theme_stylebox_override("panel", sb(Color(0.15, 0.1, 0.08, 0.85), 24, 0))
	hint_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hint_label = label("", 22, CREAM)
	hint_panel.add_child(hint_label)
	hint_panel.modulate.a = 0.0
	root.add_child(hint_panel)

func show_hint(text: String) -> void:
	if text == "":
		return
	hint_label.text = text
	hint_panel.reset_size()
	hint_panel.position = Vector2((root.size.x - hint_panel.size.x) / 2.0, 92)
	hint_panel.modulate.a = 1.0
	hint_t = 3.0

# ---------------------------------------------------------------- pop-ups
func _modal(w := 640) -> VBoxContainer:
	if popup:
		popup.queue_free()
	var dim := ColorRect.new()
	dim.color = Color(0.08, 0.05, 0.04, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(dim)
	popup = dim
	var c := CenterContainer.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.add_child(c)
	var box := PanelContainer.new()
	var s := sb(CREAM, 34, 18)
	s.set_content_margin_all(28)
	box.add_theme_stylebox_override("panel", s)
	box.custom_minimum_size.x = w
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 12)
	box.add_child(v)
	c.add_child(box)
	dim.modulate.a = 0.0
	create_tween().tween_property(dim, "modulate:a", 1.0, 0.2)
	box.scale = Vector2(0.75, 0.75)
	box.resized.connect(func(): box.pivot_offset = box.size / 2.0)
	create_tween().tween_property(box, "scale", Vector2.ONE, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	return v

func close_modal() -> void:
	if popup == null:
		return
	var p := popup
	popup = null
	var tw := create_tween()
	tw.tween_property(p, "modulate:a", 0.0, 0.18)
	tw.tween_callback(p.queue_free)

func _center(l: Label) -> Label:
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l

func _intro() -> void:
	var v := _modal(720)
	v.add_child(_center(label("Meadowbrook", 60, ORANGE)))
	v.add_child(_center(label("Your own little farm. Walk with the stick on the left; the big button on the right does things.\nDig the soil, plant seeds, fill your can at the barrel and water them, harvest when they're ripe,\nand sell at the crate. Chop trees for wood to open new fields, buy seeds at the stand.", 19, Color("6d584c"))))
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	for c in ["onion", "potato", "gazania", "ursinia", "apple", "pear"]:
		row.add_child(pic(crop_icon(c), 84))
	v.add_child(row)
	var ok := button("Start farming", ORANGE, 30)
	ok.custom_minimum_size = Vector2(320, 76)
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.pressed.connect(func():
		Game.seen_intro = true
		Game.save_game()
		close_modal()
		show_hint("Walk to the grass patches and hold the button to dig!"))
	v.add_child(ok)

func _on_level(lvl: int, unlocked: Array) -> void:
	Sfx.play("levelup")
	Sfx.buzz(60)
	var text := "Level %d!" % lvl
	for u in unlocked:
		text += "\nNew: " + (Data.CROPS[u].name + " seeds" if Data.CROPS.has(u) else Data.UPGRADES[u].name + " in the shop")
	_float(text, Color("b8f0a8"))
	_confetti()

func _shop() -> void:
	var v := _modal(900)
	v.add_child(_center(label("Farm shop", 44, ORANGE)))
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	for u in Data.UPGRADE_ORDER:
		grid.add_child(_shop_card(u))
	v.add_child(grid)
	var ok := button("Back to the farm", ORANGE, 24)
	ok.custom_minimum_size = Vector2(280, 62)
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.pressed.connect(func():
		close_modal()
		ws.spawn_helper())
	v.add_child(ok)

func _shop_card(u: String) -> Control:
	var d: Dictionary = Data.UPGRADES[u]
	var have: bool = Game.owned.has(u)
	var open: bool = d.level <= Game.level
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", sb(Color("ffffff") if open else Color("efe6dc"), 20, 3, 3, Color("f0dcc4")))
	p.custom_minimum_size = Vector2(270, 0)
	var v := VBoxContainer.new()
	v.add_child(label(d.name, 21))
	var ds := label(d.desc, 16, Color("7a6458"))
	ds.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ds.custom_minimum_size = Vector2(230, 44)
	v.add_child(ds)
	var b := button("Owned" if have else ("%d coins" % d.cost if open else "Level %d" % d.level), GREEN if have else ORANGE, 20)
	b.disabled = have or not open or Game.coins < d.cost
	b.pressed.connect(func():
		if Game.buy(u):
			Sfx.play("coin")
			ws.spawn_helper()
			_shop())
	v.add_child(b)
	p.add_child(v)
	return p

func _confetti() -> void:
	var size := root.size
	for side in [0, 1]:
		var p := CPUParticles2D.new()
		p.one_shot = true
		p.amount = 80
		p.explosiveness = 0.9
		p.lifetime = 2.4
		p.position = Vector2(size.x * (0.15 if side == 0 else 0.85), size.y + 10)
		p.direction = Vector2(0.3 if side == 0 else -0.3, -1)
		p.spread = 22.0
		p.initial_velocity_min = 800.0
		p.initial_velocity_max = 1200.0
		p.gravity = Vector2(0, 950)
		p.angular_velocity_min = -400.0
		p.angular_velocity_max = 400.0
		p.scale_amount_min = 7.0
		p.scale_amount_max = 12.0
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.25, 0.5, 0.75, 1.0])
		g.colors = PackedColorArray([Color("e8533f"), Color("f2b632"), Color("5aa860"), Color("3f74c9"), Color("e57aa8")])
		p.color_initial_ramp = g
		root.add_child(p)
		p.emitting = true
		get_tree().create_timer(3.0).timeout.connect(p.queue_free)
