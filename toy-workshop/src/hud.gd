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
var orders_box: VBoxContainer
var cards := {}                    # order id -> card
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
	_orders()
	_action()
	_hint()
	Game.changed.connect(_refresh)
	Game.order_done.connect(_on_done)
	Game.order_missed.connect(_on_missed)
	Game.order_added.connect(func(_o): Sfx.play("pop", -4.0))
	Game.leveled.connect(_on_level)
	Game.day_over.connect(_on_day_over)
	shown_coins = Game.coins
	_refresh()

func bind(w: Node3D) -> void:
	ws = w
	ws.hud = self
	ws.hint.connect(show_hint)
	ws.shipped_toy.connect(func(text, _p, _t): show_hint(text))
	if not Game.seen_intro:
		_intro()
	else:
		_day_card()

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

func toy_icon(t: String, c := "wood") -> Texture2D:
	return icons.get_icon("i|%s|%s" % [t, c], func(): return Props.item({"t": t, "c": c}))

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
	dp.add_theme_stylebox_override("panel", sb(Color(0.15, 0.1, 0.08, 0.8), 30, 0))
	clock_label = label("Day 1", 24, CREAM)
	dp.add_child(clock_label)
	bar.add_child(dp)
	var mute := button("Sound", TEAL, 18)
	mute.custom_minimum_size = Vector2(0, 50)
	mute.pressed.connect(func():
		Sfx.set_muted(not Sfx.muted)
		mute.text = "Muted" if Sfx.muted else "Sound")
	bar.add_child(mute)

func _refresh() -> void:
	level_label.text = "Level %d" % Game.level
	create_tween().tween_property(xp_bar, "value", 100.0 * Game.xp / Data.xp_for(Game.level), 0.35)
	_sync_orders()

func _process(dt: float) -> void:
	var target := float(Game.coins)
	shown_coins = target if absf(shown_coins - target) < 0.5 else lerpf(shown_coins, target, 1.0 - exp(-dt * 8.0))
	coin_label.text = str(int(round(shown_coins)))
	var tl := maxf(0.0, Game.time_left)
	clock_label.text = "Day %d   %d:%02d" % [Game.day, int(tl) / 60, int(tl) % 60] if Game.playing else "Day %d" % Game.day
	clock_label.add_theme_color_override("font_color", Color("ff9f8a") if Game.playing and tl < 20 else CREAM)
	for o in Game.orders:
		var card: Control = cards.get(o.id)
		if card:
			var bar: ProgressBar = card.find_child("bar", true, false)
			var k: float = o.left / o.total
			bar.value = 100.0 * k
			var f := sb(GREEN.lerp(Color("e0a83a"), clampf(1.6 - k * 2.0, 0, 1)).lerp(Color("d9534a"), clampf(0.7 - k * 2.0, 0, 1) / 0.7), 8, 0)
			f.content_margin_top = 0
			f.content_margin_bottom = 0
			bar.add_theme_stylebox_override("fill", f)
			card.rotation = sin(Time.get_ticks_msec() / 60.0) * 0.02 if k < 0.2 else 0.0
	if hint_t > 0.0:
		hint_t -= dt
		if hint_t <= 0.0:
			create_tween().tween_property(hint_panel, "modulate:a", 0.0, 0.3)
	_update_action()

# ---------------------------------------------------------------- orders
func _orders() -> void:
	var holder := VBoxContainer.new()
	holder.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	holder.position = Vector2(-290, 18)
	holder.custom_minimum_size = Vector2(270, 0)
	holder.add_theme_constant_override("separation", 8)
	root.add_child(holder)
	var t := label("Orders", 24, CREAM)
	t.add_theme_constant_override("outline_size", 8)
	t.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.5))
	holder.add_child(t)
	orders_box = VBoxContainer.new()
	orders_box.add_theme_constant_override("separation", 8)
	holder.add_child(orders_box)

func _sync_orders() -> void:
	var ids := {}
	for o in Game.orders:
		ids[o.id] = true
		if not cards.has(o.id):
			var c := _card(o)
			orders_box.add_child(c)
			cards[o.id] = c
			c.modulate.a = 0.0
			c.position.x += 60
			create_tween().tween_property(c, "modulate:a", 1.0, 0.25)
	for id in cards.keys():
		if not ids.has(id) and not cards[id].has_meta("leaving"):
			_remove_card(id, false)

func _card(o: Dictionary) -> PanelContainer:
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", sb(CREAM, 20))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	var ib := PanelContainer.new()
	var ibs := sb(Color("efe2d0"), 16, 0)
	ibs.set_content_margin_all(2)
	ib.add_theme_stylebox_override("panel", ibs)
	ib.add_child(pic(toy_icon(o.toy, o.c), 62))
	h.add_child(ib)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_child(label(Game.order_title(o), 19))
	v.add_child(label("for " + o.who, 15, Color("8a7466")))
	var bar := ProgressBar.new()
	bar.name = "bar"
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(150, 12)
	bar.value = 100
	v.add_child(bar)
	h.add_child(v)
	card.add_child(h)
	return card

func _remove_card(id: int, good: bool) -> void:
	var c: Control = cards.get(id)
	if c == null:
		return
	c.set_meta("leaving", true)
	c.add_theme_stylebox_override("panel", sb(Color("cdeccf") if good else Color("f3c5bd"), 20))
	var tw := create_tween()
	tw.tween_interval(0.6)
	tw.tween_property(c, "modulate:a", 0.0, 0.25)
	tw.tween_callback(func():
		cards.erase(id)
		c.queue_free())

func _on_done(o: Dictionary, pay: int, tip: int) -> void:
	_remove_card(o.id, true)
	Sfx.buzz(40)
	_float("+%d" % pay + ("   +%d tip!" % tip if tip > 0 else ""), Color("ffd36b"))

func _on_missed(o: Dictionary) -> void:
	_remove_card(o.id, false)
	Sfx.play("error")
	show_hint("%s got tired of waiting for a %s" % [o.who, Game.order_title(o)])

func _float(text: String, col: Color) -> void:
	var l := label(text, 44, col)
	l.add_theme_constant_override("outline_size", 12)
	l.add_theme_color_override("font_outline_color", Color(0.25, 0.14, 0.08))
	root.add_child(l)
	l.reset_size()
	l.position = Vector2((root.size.x - l.size.x) / 2.0, root.size.y * 0.32)
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
	act_label = label("", 22, Color.WHITE)
	act_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	act_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	act_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	act_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	act_label.add_theme_constant_override("outline_size", 6)
	act_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.25))
	act_btn.add_child(act_label)
	act_btn.button_down.connect(func(): if ws: ws.press())
	act_btn.button_up.connect(func(): if ws: ws.release())
	juice(act_btn)
	root.add_child(act_btn)
	chips = HBoxContainer.new()
	chips.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	chips.position = Vector2(-560, -110)
	chips.add_theme_constant_override("separation", 8)
	root.add_child(chips)

func _update_action() -> void:
	if ws == null:
		return
	var t: String = ws.action_label() if Game.playing else ""
	act_label.text = t
	act_btn.disabled = t == ""
	if ws.player.working_at:
		var w: float = ws.player.working_at.work
		act_label.text = "%d%%" % int(w * 100)
	# colour and mode choices appear when you stand at the paint table or drill press
	var near: String = ws.target.kind if ws.target and Game.playing else ""
	if near != chips_for:
		chips_for = near
		for c in chips.get_children():
			c.queue_free()
		if near == "paint":
			if Game.paints_open().is_empty():
				chips.add_child(_chip_label("Paints unlock at level 2"))
			for col in Game.paints_open():
				chips.add_child(_swatch(col))
		elif near == "lathe":
			for m in ["wheel", "peg"]:
				chips.add_child(_mode_chip(m))
		chips.reset_size()
		chips.position = Vector2(root.size.x - 230 - chips.size.x, root.size.y - 110)

func _chip_label(t: String) -> Control:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", sb(CREAM, 20))
	p.add_child(label(t, 18))
	return p

func _swatch(col: String) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(64, 64)
	var on: bool = ws.stations.paint.color == col
	for st in ["normal", "hover", "pressed"]:
		b.add_theme_stylebox_override(st, sb(Data.COLORS[col], 32, 4, 6 if on else 3, Color.WHITE if on else Color(1, 1, 1, 0.5)))
	b.pressed.connect(func():
		ws.set_paint(col)
		chips_for = "")
	juice(b)
	return b

func _mode_chip(m: String) -> Button:
	var on: bool = ws.stations.lathe.mode == m
	var b := button("Wheels" if m == "wheel" else "Pegs", TEAL if on else Color("a99686"), 20)
	b.icon = toy_icon(m)
	b.expand_icon = true
	b.custom_minimum_size = Vector2(140, 64)
	b.pressed.connect(func():
		ws.set_lathe(m)
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
	v.add_child(_center(label("Tiny Toyworks", 58, ORANGE)))
	v.add_child(_center(label("You're the toymaker. Walk with the stick on the left, use the big button on the right.\nGrab lumber, saw it into blocks, turn wheels and pegs on the drill press, paint them,\nassemble toys at the workbench and drop them in the shipping box before customers lose patience.", 19, Color("6d584c"))))
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	for p in [["car", "red"], ["top", "blue"], ["plane", "yellow"], ["train", "green"]]:
		row.add_child(pic(toy_icon(p[0], p[1]), 96))
	v.add_child(row)
	var ok := button("Open the workshop", ORANGE, 30)
	ok.custom_minimum_size = Vector2(340, 76)
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.pressed.connect(func():
		Game.seen_intro = true
		close_modal()
		_begin())
	v.add_child(ok)

func _day_card() -> void:
	var v := _modal(520)
	v.add_child(_center(label("Day %d" % Game.day, 56, ORANGE)))
	v.add_child(_center(label("Orders come in all day. Fast deliveries earn tips!", 20, Color("6d584c"))))
	var ok := button("Start the day", ORANGE, 28)
	ok.custom_minimum_size = Vector2(300, 70)
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.pressed.connect(func():
		close_modal()
		_begin())
	v.add_child(ok)

func _begin() -> void:
	Game.start_day()
	Sfx.play("ding")
	show_hint("Follow the golden arrow to make your first toy!" if Game.day <= 1 else "Here come the orders!")

func _on_level(lvl: int, unlocked: Array) -> void:
	Sfx.play("levelup")
	Sfx.buzz(60)
	var text := "Level %d!" % lvl
	for u in unlocked:
		text += "\nNew: " + (Data.TOYS[u].name if Data.TOYS.has(u) else Data.UPGRADES[u].name)
	if lvl == 2:
		text += "\nPaints unlocked: customers want colours now"
	_float(text, Color("9fe0a5"))
	_confetti()

func _on_day_over(stats: Dictionary) -> void:
	Sfx.play("levelup")
	var v := _modal(620)
	v.add_child(_center(label("Day %d done!" % (Game.day - 1), 50, ORANGE)))
	var stars := 3 if stats.missed == 0 and stats.done >= 3 else (2 if stats.done > stats.missed else 1)
	v.add_child(_center(label("★".repeat(stars) + "☆".repeat(3 - stars), 54, Color("f2b632"))))
	v.add_child(_center(label("Toys delivered: %d     Missed: %d\nEarned: %d coins  (tips: %d)" % [stats.done, stats.missed, stats.earned, stats.tips], 22)))
	var ok := button("Visit the shop", TEAL, 26)
	ok.custom_minimum_size = Vector2(300, 66)
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.pressed.connect(_shop)
	v.add_child(ok)
	if stars == 3:
		_confetti()

func _shop() -> void:
	var v := _modal(900)
	v.add_child(_center(label("Workshop shop", 44, ORANGE)))
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 12)
	for u in Data.UPGRADE_ORDER:
		grid.add_child(_shop_card(u))
	v.add_child(grid)
	var ok := button("Start day %d" % Game.day, ORANGE, 26)
	ok.custom_minimum_size = Vector2(300, 66)
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.pressed.connect(func():
		close_modal()
		ws.spawn_helpers()
		ws.player.speed = 2.6 * (1.2 if Game.owned.has("shoes") else 1.0)
		_begin())
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
