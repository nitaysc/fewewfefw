extends CanvasLayer
## The interface: coins and level, orders, the build drawer, machine settings, pop-ups.

var world: Node3D
var icons: IconMaker
var font: Font
var root: Control

var coin_label: Label
var level_label: Label
var xp_bar: ProgressBar
var shown_coins := 0.0
var orders_box: VBoxContainer
var cards: Array = []
var hint_panel: PanelContainer
var hint_label: Label
var hint_t := 0.0
var build_btn: Button
var drawer: PanelContainer
var drawer_cards: HBoxContainer
var build_bar: HBoxContainer
var build_title: Label
var rotate_btn: Button
var sel_panel: PanelContainer
var sel_cell = null
var popup: Control

const CREAM := Color("fff6ea")
const INK := Color("4a3440")
const ORANGE := Color("ff9a4d")
const TEAL := Color("4fb3a5")

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
	_top_bar()
	_orders()
	_hint()
	_build_button()
	_drawer()
	_build_bar()
	_sel_panel()
	Game.changed.connect(_refresh)
	Game.order_progress.connect(_on_order_progress)
	Game.leveled.connect(_on_level)
	shown_coins = Game.coins
	_refresh()
	_rebuild_orders()
	if not Game.seen_intro:
		_intro()

func bind(w: Node3D) -> void:
	world = w
	world.selected.connect(_on_selected)
	world.hint.connect(show_hint)

# ---------------------------------------------------------------- look
func sb(c: Color, r := 22, shadow := 8, border := 0, bc := Color.TRANSPARENT) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = c
	s.set_corner_radius_all(r)
	s.corner_detail = 10
	s.anti_aliasing = true
	if shadow > 0:
		s.shadow_color = Color(0.25, 0.12, 0.08, 0.22)
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
	var bn := sb(ORANGE, 20, 6)
	bn.border_width_bottom = 5
	bn.border_color = ORANGE.darkened(0.25)
	var bp := sb(ORANGE.darkened(0.08), 20, 2)
	bp.border_width_top = 4
	bp.border_color = ORANGE.darkened(0.3)
	var bd := sb(Color("d9cfc4"), 20, 2)
	th.set_stylebox("normal", "Button", bn)
	th.set_stylebox("hover", "Button", bn)
	th.set_stylebox("pressed", "Button", bp)
	th.set_stylebox("disabled", "Button", bd)
	th.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	th.set_color("font_color", "Button", Color.WHITE)
	th.set_color("font_hover_color", "Button", Color.WHITE)
	th.set_color("font_pressed_color", "Button", Color.WHITE)
	th.set_color("font_disabled_color", "Button", Color("9a8f86"))
	th.set_constant("outline_size", "Button", 6)
	th.set_color("font_outline_color", "Button", ORANGE.darkened(0.35))
	var bg := sb(Color("ead9c6"), 10, 0)
	bg.content_margin_top = 0
	bg.content_margin_bottom = 0
	var fill := sb(Color("6cc58a"), 10, 0)
	fill.content_margin_top = 0
	fill.content_margin_bottom = 0
	th.set_stylebox("background", "ProgressBar", bg)
	th.set_stylebox("fill", "ProgressBar", fill)
	return th

func label(text: String, size := 24, col := INK, outline := 0) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	if outline > 0:
		l.add_theme_constant_override("outline_size", outline)
		l.add_theme_color_override("font_outline_color", INK)
	return l

func pic(tex: Texture2D, size := 56) -> TextureRect:
	var r := TextureRect.new()
	r.texture = tex
	r.custom_minimum_size = Vector2(size, size)
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r

## buttons squash a little when pressed and bounce back
func juice(b: Control) -> void:
	b.resized.connect(func(): b.pivot_offset = b.size / 2.0)
	if b is BaseButton:
		b.button_down.connect(func():
			create_tween().tween_property(b, "scale", Vector2(0.9, 0.9), 0.06))
		b.button_up.connect(func():
			create_tween().tween_property(b, "scale", Vector2.ONE, 0.28).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT))

func button(text: String, col := ORANGE, size := 24) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", size)
	if col != ORANGE:
		var n := sb(col, 20, 6)
		n.border_width_bottom = 5
		n.border_color = col.darkened(0.25)
		b.add_theme_stylebox_override("normal", n)
		b.add_theme_stylebox_override("hover", n)
		var p := sb(col.darkened(0.08), 20, 2)
		p.border_width_top = 4
		p.border_color = col.darkened(0.3)
		b.add_theme_stylebox_override("pressed", p)
		b.add_theme_color_override("font_outline_color", col.darkened(0.4))
	b.pressed.connect(func(): Sfx.play("click"))
	juice(b)
	return b

# ---------------------------------------------------------------- top bar
func _top_bar() -> void:
	var bar := HBoxContainer.new()
	bar.position = Vector2(22, 18)
	bar.add_theme_constant_override("separation", 14)
	root.add_child(bar)
	var cp := PanelContainer.new()
	cp.add_theme_stylebox_override("panel", sb(CREAM, 30))
	var ch := HBoxContainer.new()
	ch.add_theme_constant_override("separation", 6)
	ch.add_child(pic(icons.get_icon("coin", Meshes.coin), 42))
	coin_label = label("0", 30, INK)
	coin_label.custom_minimum_size.x = 92
	ch.add_child(coin_label)
	cp.add_child(ch)
	bar.add_child(cp)
	var lp := PanelContainer.new()
	lp.add_theme_stylebox_override("panel", sb(CREAM, 30))
	var lv := VBoxContainer.new()
	lv.add_theme_constant_override("separation", 2)
	level_label = label("Level 1", 22)
	lv.add_child(level_label)
	xp_bar = ProgressBar.new()
	xp_bar.custom_minimum_size = Vector2(170, 14)
	xp_bar.show_percentage = false
	lv.add_child(xp_bar)
	lp.add_child(lv)
	bar.add_child(lp)
	var mute := button("Sound", TEAL, 18)
	mute.custom_minimum_size = Vector2(0, 52)
	mute.pressed.connect(func():
		Sfx.set_muted(not Sfx.muted)
		mute.text = "Muted" if Sfx.muted else "Sound")
	bar.add_child(mute)

func _refresh() -> void:
	level_label.text = "Level %d" % Game.level
	var need := Data.xp_for(Game.level)
	create_tween().tween_property(xp_bar, "value", 100.0 * Game.xp / need, 0.35).set_trans(Tween.TRANS_QUAD)
	for i in mini(cards.size(), Game.orders.size()):
		var o: Dictionary = Game.orders[i]
		if cards[i].get_meta("id") != o.id:
			_rebuild_orders()
			return
		_update_card(i)
	if drawer.visible:
		_fill_drawer()

func _process(dt: float) -> void:
	# coins count up smoothly
	var target := float(Game.coins)
	if absf(shown_coins - target) > 0.5:
		shown_coins = lerpf(shown_coins, target, 1.0 - exp(-dt * 8.0))
	else:
		shown_coins = target
	coin_label.text = str(int(round(shown_coins)))
	if hint_t > 0.0:
		hint_t -= dt
		if hint_t <= 0.0:
			create_tween().tween_property(hint_panel, "modulate:a", 0.0, 0.25)

# ---------------------------------------------------------------- orders
func _orders() -> void:
	var holder := VBoxContainer.new()
	holder.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	holder.position = Vector2(-300, 18)
	holder.custom_minimum_size = Vector2(280, 0)
	holder.add_theme_constant_override("separation", 10)
	root.add_child(holder)
	holder.add_child(label("Orders", 26, CREAM, 8))
	orders_box = VBoxContainer.new()
	orders_box.add_theme_constant_override("separation", 10)
	holder.add_child(orders_box)

func _rebuild_orders() -> void:
	for c in cards:
		c.queue_free()
	cards.clear()
	for i in Game.orders.size():
		var card := _card(Game.orders[i])
		orders_box.add_child(card)
		cards.append(card)
		_update_card(i)

func _card(o: Dictionary) -> PanelContainer:
	var card := PanelContainer.new()
	card.set_meta("id", o.id)
	card.add_theme_stylebox_override("panel", sb(CREAM, 22))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	var icon_bg := PanelContainer.new()
	var ib := sb(Color("f3e2cc"), 18, 0)
	ib.set_content_margin_all(2)
	icon_bg.add_theme_stylebox_override("panel", ib)
	icon_bg.add_child(pic(icons.toy(o.toy, o.c if o.c != "" else "wood"), 64))
	h.add_child(icon_bg)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var title := label(Game.order_title(o), 20)
	title.name = "title"
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	title.custom_minimum_size.x = 150
	v.add_child(title)
	var row := HBoxContainer.new()
	var bar := ProgressBar.new()
	bar.name = "bar"
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(100, 14)
	bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(bar)
	var cnt := label("0/0", 18)
	cnt.name = "count"
	row.add_child(cnt)
	v.add_child(row)
	var rw := HBoxContainer.new()
	rw.add_theme_constant_override("separation", 4)
	rw.add_child(pic(icons.get_icon("coin", Meshes.coin), 22))
	var rl := label(str(o.reward), 18, Color("b07a1a"))
	rl.name = "reward"
	rw.add_child(rl)
	v.add_child(rw)
	h.add_child(v)
	card.add_child(h)
	card.modulate.a = 0.0
	create_tween().tween_property(card, "modulate:a", 1.0, 0.3)
	return card

func _find(n: Node, name: String) -> Node:
	return n.find_child(name, true, false)

func _update_card(i: int) -> void:
	var o: Dictionary = Game.orders[i]
	var card: PanelContainer = cards[i]
	(_find(card, "count") as Label).text = "%d/%d" % [o.got, o.n]
	var bar: ProgressBar = _find(card, "bar")
	create_tween().tween_property(bar, "value", 100.0 * o.got / o.n, 0.25)

func _on_order_progress(i: int, done: bool) -> void:
	if i >= cards.size():
		return
	var card: PanelContainer = cards[i]
	card.pivot_offset = card.size / 2.0
	card.scale = Vector2(1.06, 1.06)
	create_tween().tween_property(card, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if done:
		Sfx.play("ding")
		Sfx.buzz(40)
		card.add_theme_stylebox_override("panel", sb(Color("c9f0d2"), 22))
		(_find(card, "title") as Label).text = "Done!  +%d" % Game.orders[i].reward
		var tw := create_tween()
		tw.tween_interval(1.1)
		tw.tween_property(card, "modulate:a", 0.0, 0.3)
		tw.tween_callback(func(): Game.replace_order(i))

# ---------------------------------------------------------------- hint
func _hint() -> void:
	hint_panel = PanelContainer.new()
	hint_panel.add_theme_stylebox_override("panel", sb(Color(0.23, 0.15, 0.17, 0.85), 24, 0))
	hint_panel.set_anchors_preset(Control.PRESET_CENTER_TOP)
	hint_panel.position = Vector2(-200, 96)
	hint_panel.custom_minimum_size = Vector2(400, 0)
	hint_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hint_label = label("", 22, CREAM)
	hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint_panel.add_child(hint_label)
	hint_panel.modulate.a = 0.0
	root.add_child(hint_panel)

func show_hint(text: String) -> void:
	if text == "":
		hint_t = 0.01
		return
	hint_label.text = text
	hint_panel.reset_size()
	hint_panel.position = Vector2((root.size.x - hint_panel.size.x) / 2.0, 96)
	hint_panel.modulate.a = 1.0
	hint_t = 3.0

# ---------------------------------------------------------------- build
func _build_button() -> void:
	build_btn = Button.new()
	build_btn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	build_btn.custom_minimum_size = Vector2(132, 132)
	build_btn.position = Vector2(-160, -160)
	var s := sb(ORANGE, 66, 10)
	s.border_width_bottom = 8
	s.border_color = ORANGE.darkened(0.25)
	build_btn.add_theme_stylebox_override("normal", s)
	build_btn.add_theme_stylebox_override("hover", s)
	build_btn.add_theme_stylebox_override("pressed", sb(ORANGE.darkened(0.1), 66, 3))
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var hp := pic(icons.get_icon("hammer", Meshes.hammer), 70)
	hp.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	v.add_child(hp)
	var l := label("Build", 24, Color.WHITE, 6)
	l.add_theme_color_override("font_outline_color", ORANGE.darkened(0.4))
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(l)
	build_btn.add_child(v)
	build_btn.pressed.connect(open_drawer)
	juice(build_btn)
	root.add_child(build_btn)

func _drawer() -> void:
	drawer = PanelContainer.new()
	drawer.add_theme_stylebox_override("panel", sb(CREAM, 28, 12))
	drawer.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	drawer.offset_left = 20
	drawer.offset_right = -20
	drawer.offset_top = -236
	drawer.offset_bottom = -16
	var v := VBoxContainer.new()
	var top := HBoxContainer.new()
	var t := label("Build", 28)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(t)
	var close := button("Close", TEAL, 22)
	close.pressed.connect(close_drawer)
	top.add_child(close)
	v.add_child(top)
	var sc := ScrollContainer.new()
	sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sc.custom_minimum_size = Vector2(0, 160)
	drawer_cards = HBoxContainer.new()
	drawer_cards.add_theme_constant_override("separation", 12)
	sc.add_child(drawer_cards)
	v.add_child(sc)
	drawer.add_child(v)
	drawer.visible = false
	root.add_child(drawer)

func _fill_drawer() -> void:
	for c in drawer_cards.get_children():
		c.queue_free()
	var rm := _shop_card("remove", "Take away", "", true)
	drawer_cards.add_child(rm)
	for k in Data.SHOP_ORDER:
		var def: Dictionary = Data.MACHINES[k]
		var open: bool = def.level <= Game.level
		drawer_cards.add_child(_shop_card(k, def.name, (str(def.cost) if open else "Level %d" % def.level), open and Game.coins >= def.cost))

func _shop_card(k: String, name: String, price: String, ok: bool) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(138, 150)
	var s := sb(Color("ffffff") if ok else Color("efe6dc"), 22, 4, 3, Color("f0d9bf"))
	b.add_theme_stylebox_override("normal", s)
	b.add_theme_stylebox_override("hover", s)
	b.add_theme_stylebox_override("pressed", sb(Color("ffe7c9"), 22, 1, 3, ORANGE))
	b.add_theme_stylebox_override("disabled", s)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 0)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tex: Texture2D = icons.get_icon("remove", func():
		var n := Node3D.new()
		Meshes.put(n, Meshes.rbox(Vector3(0.5, 0.12, 0.12), 0.05), Meshes.mat(Color("ff7a7a"), 0.5), Vector3.ZERO, Vector3(0, 0, 45))
		Meshes.put(n, Meshes.rbox(Vector3(0.5, 0.12, 0.12), 0.05), Meshes.mat(Color("ff7a7a"), 0.5), Vector3.ZERO, Vector3(0, 0, -45))
		return n) if k == "remove" else icons.machine(k)
	var p := pic(tex, 78)
	p.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	if not ok and k != "remove":
		p.modulate = Color(1, 1, 1, 0.45)
	v.add_child(p)
	var n := label(name, 18)
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(n)
	if price != "":
		var ph := HBoxContainer.new()
		ph.alignment = BoxContainer.ALIGNMENT_CENTER
		ph.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if price.is_valid_int():
			ph.add_child(pic(icons.get_icon("coin", Meshes.coin), 20))
		ph.add_child(label(price, 18, Color("b07a1a") if ok else Color("a09080")))
		v.add_child(ph)
	b.add_child(v)
	juice(b)
	b.pressed.connect(func():
		if k == "remove":
			Sfx.play("click")
			_start("remove")
		elif Data.MACHINES[k].level > Game.level:
			Sfx.play("error")
			show_hint("Unlocks at level %d" % Data.MACHINES[k].level)
		elif Game.coins < Data.MACHINES[k].cost:
			Sfx.play("error")
			show_hint("Not enough coins yet: fill orders to earn more")
		else:
			Sfx.play("click")
			_start(k))
	return b

func open_drawer() -> void:
	world.stop_mode()
	_fill_drawer()
	drawer.visible = true
	build_btn.visible = false
	sel_panel.visible = false
	build_bar.visible = false
	drawer.modulate.a = 0.0
	drawer.pivot_offset = Vector2(drawer.size.x / 2.0, drawer.size.y)
	drawer.scale = Vector2(1.0, 0.6)
	var tw := create_tween().set_parallel()
	tw.tween_property(drawer, "modulate:a", 1.0, 0.18)
	tw.tween_property(drawer, "scale", Vector2.ONE, 0.32).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	Sfx.play("whoosh")

func close_drawer() -> void:
	drawer.visible = false
	build_btn.visible = true

func _start(k: String) -> void:
	drawer.visible = false
	build_bar.visible = true
	if k == "remove":
		world.start_remove()
		build_title.text = "Take away"
		rotate_btn.visible = false
	else:
		world.start_build(k)
		build_title.text = Data.MACHINES[k].name
		rotate_btn.visible = true

func _build_bar() -> void:
	build_bar = HBoxContainer.new()
	build_bar.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	build_bar.position = Vector2(-260, -110)
	build_bar.custom_minimum_size = Vector2(520, 84)
	build_bar.add_theme_constant_override("separation", 12)
	var tp := PanelContainer.new()
	tp.add_theme_stylebox_override("panel", sb(CREAM, 26))
	build_title = label("", 24)
	build_title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	tp.add_child(build_title)
	tp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	build_bar.add_child(tp)
	rotate_btn = button("Turn", TEAL)
	rotate_btn.pressed.connect(func(): world.rotate_build())
	build_bar.add_child(rotate_btn)
	var more := button("More", Color("9b7cf0"))
	more.pressed.connect(open_drawer)
	build_bar.add_child(more)
	var done := button("Done")
	done.pressed.connect(func():
		world.stop_mode()
		build_bar.visible = false
		build_btn.visible = true)
	build_bar.add_child(done)
	build_bar.visible = false
	root.add_child(build_bar)

# ---------------------------------------------------------------- selected machine
func _sel_panel() -> void:
	sel_panel = PanelContainer.new()
	sel_panel.add_theme_stylebox_override("panel", sb(CREAM, 28, 12))
	sel_panel.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	sel_panel.custom_minimum_size = Vector2(600, 0)
	sel_panel.visible = false
	root.add_child(sel_panel)

func _on_selected(p) -> void:
	sel_cell = p
	if p == null:
		if sel_panel.visible:
			var tw := create_tween()
			tw.tween_property(sel_panel, "modulate:a", 0.0, 0.12)
			tw.tween_callback(func(): sel_panel.visible = false)
		return
	_fill_sel()
	sel_panel.visible = true
	sel_panel.modulate.a = 1.0
	sel_panel.reset_size()
	var vs := root.size
	var y := vs.y - sel_panel.size.y - 18
	sel_panel.position = Vector2((vs.x - sel_panel.size.x) / 2.0, y + 60)
	create_tween().tween_property(sel_panel, "position:y", y, 0.28).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func _fill_sel() -> void:
	for c in sel_panel.get_children():
		c.queue_free()
	var c: Dictionary = Game.sim.cells.get(sel_cell, {})
	if c.is_empty():
		return
	var def: Dictionary = Data.MACHINES[c.kind]
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 16)
	h.add_child(pic(icons.machine(c.kind), 96))
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_child(label(def.name, 28))
	var d := label(def.desc, 18, Color("7a6470"))
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.custom_minimum_size.x = 300
	v.add_child(d)
	var opts := HBoxContainer.new()
	opts.add_theme_constant_override("separation", 8)
	match def.kind:
		"proc":
			if def.modes.size() > 1:
				for m in def.modes:
					opts.add_child(_opt(icons.toy(m), m.capitalize() + "s", c.mode == m, func():
						c.mode = m
						_fill_sel()))
		"paint":
			for col in Game.paints_open():
				opts.add_child(_swatch(col, c.color == col, func():
					c.color = col
					_fill_sel()))
		"assemble":
			for toy in Data.toys_at(Game.level):
				opts.add_child(_opt(icons.toy(toy), "", c.toy == toy, func():
					c.toy = toy
					c.inbuf = []
					_fill_sel()))
			var need := []
			for k in Data.TOYS[c.toy].needs:
				need.append("%d %s" % [Data.TOYS[c.toy].needs[k], Data.PARTS[k].name + ("s" if Data.TOYS[c.toy].needs[k] > 1 else "")])
			v.add_child(label("%s needs %s" % [Data.TOYS[c.toy].name, " + ".join(need)], 18, Color("b0603a")))
		"dock":
			v.add_child(label("Toys shipped: %d" % Game.shipped, 18, Color("b0603a")))
		"crate":
			v.add_child(label("One every %.1f s" % def.period, 18, Color("b0603a")))
	if opts.get_child_count() > 0:
		v.add_child(opts)
	h.add_child(v)
	var bv := VBoxContainer.new()
	bv.add_theme_constant_override("separation", 8)
	var turn := button("Turn", TEAL, 22)
	turn.pressed.connect(func():
		c.dir = (c.dir + 1) % 4
		Sfx.play("tap"))
	bv.add_child(turn)
	var sell := button("Sell +%d" % int(def.cost / 2), Color("e8735e"), 20)
	sell.pressed.connect(func():
		Game.refund(c.kind)
		Game.sim.remove(sel_cell)
		Sfx.play("remove")
		world.dust(world.cell_pos(sel_cell))
		world.select(null))
	bv.add_child(sell)
	var close := button("Close", Color("b9a99a"), 20)
	close.pressed.connect(func(): world.select(null))
	bv.add_child(close)
	h.add_child(bv)
	sel_panel.add_child(h)

func _opt(tex: Texture2D, text: String, on: bool, cb: Callable) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(70 if text == "" else 112, 70)
	b.icon = tex
	b.expand_icon = true
	b.text = text
	b.add_theme_font_size_override("font_size", 16)
	var s := sb(Color("ffe2bd") if on else Color("ffffff"), 18, 2, 3, ORANGE if on else Color("ecdccb"))
	s.set_content_margin_all(6)
	b.add_theme_stylebox_override("normal", s)
	b.add_theme_stylebox_override("hover", s)
	b.add_theme_stylebox_override("pressed", s)
	b.add_theme_color_override("font_color", INK)
	b.add_theme_constant_override("outline_size", 0)
	b.pressed.connect(func():
		Sfx.play("click")
		cb.call())
	juice(b)
	return b

func _swatch(col: String, on: bool, cb: Callable) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(54, 54)
	var s := sb(Data.COLORS[col], 27, 3, 5 if on else 3, INK if on else Color.WHITE)
	b.add_theme_stylebox_override("normal", s)
	b.add_theme_stylebox_override("hover", s)
	b.add_theme_stylebox_override("pressed", s)
	b.pressed.connect(func():
		Sfx.play("pop")
		cb.call())
	juice(b)
	return b

# ---------------------------------------------------------------- level up and intro
func _on_level(lvl: int, unlocked: Array) -> void:
	Sfx.play("levelup")
	Sfx.buzz(60)
	var box := _modal()
	var v: VBoxContainer = box.get_child(0)
	v.add_child(label("Level %d!" % lvl, 54, ORANGE, 0))
	if unlocked.size() > 0:
		v.add_child(label("New in the workshop:", 22))
		var row := HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		row.add_theme_constant_override("separation", 14)
		for k in unlocked:
			var col := VBoxContainer.new()
			col.add_child(pic(icons.toy(k) if Data.TOYS.has(k) else icons.machine(k), 92))
			var n := label(Data.TOYS[k].name if Data.TOYS.has(k) else Data.MACHINES[k].name, 18)
			n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			col.add_child(n)
			row.add_child(col)
		v.add_child(row)
	var ok := button("Hooray!")
	ok.custom_minimum_size = Vector2(220, 64)
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.pressed.connect(func(): _close_modal())
	v.add_child(ok)
	_confetti()

func _intro() -> void:
	var box := _modal()
	var v: VBoxContainer = box.get_child(0)
	v.add_child(label("Tiny Toyworks", 60, ORANGE))
	var s := label("Run a cozy toy workshop. Conveyor belts carry wood to your saw and lathe,\nthe bench builds toys, and the shipping box sends them to kids who ordered them.\nFill orders, earn coins, unlock new toys, and grow the workshop.", 20, Color("7a6470"))
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(s)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	for t in ["car", "top", "train", "rocket", "teddy", "robot"]:
		row.add_child(pic(icons.toy(t, ["red", "blue", "yellow", "green", "pink", "purple"][Data.TOY_ORDER.find(t)]), 84))
	v.add_child(row)
	var ok := button("Start building", ORANGE, 30)
	ok.custom_minimum_size = Vector2(300, 74)
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.pressed.connect(func():
		Game.seen_intro = true
		Game.save_game()
		_close_modal()
		show_hint("Your first line is already running: watch the cars roll in!"))
	v.add_child(ok)

func _modal() -> PanelContainer:
	if popup:
		popup.queue_free()
	var dim := ColorRect.new()
	dim.color = Color(0.15, 0.08, 0.1, 0.5)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(dim)
	popup = dim
	var c := CenterContainer.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.add_child(c)
	var box := PanelContainer.new()
	var s := sb(CREAM, 36, 16)
	s.set_content_margin_all(30)
	box.add_theme_stylebox_override("panel", s)
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 14)
	box.add_child(v)
	c.add_child(box)
	dim.modulate.a = 0.0
	create_tween().tween_property(dim, "modulate:a", 1.0, 0.2)
	box.scale = Vector2(0.7, 0.7)
	box.resized.connect(func(): box.pivot_offset = box.size / 2.0)
	create_tween().tween_property(box, "scale", Vector2.ONE, 0.4).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	return box

func _close_modal() -> void:
	if popup == null:
		return
	var p := popup
	popup = null
	var tw := create_tween()
	tw.tween_property(p, "modulate:a", 0.0, 0.18)
	tw.tween_callback(p.queue_free)

func _confetti() -> void:
	var size := get_viewport().get_visible_rect().size
	for side in [0, 1]:
		var p := CPUParticles2D.new()
		p.one_shot = true
		p.amount = 70
		p.explosiveness = 0.9
		p.lifetime = 2.2
		p.position = Vector2(size.x * (0.2 if side == 0 else 0.8), size.y + 10)
		p.direction = Vector2(0.35 if side == 0 else -0.35, -1)
		p.spread = 25.0
		p.initial_velocity_min = 700.0
		p.initial_velocity_max = 1100.0
		p.gravity = Vector2(0, 900)
		p.angular_velocity_min = -400.0
		p.angular_velocity_max = 400.0
		p.scale_amount_min = 6.0
		p.scale_amount_max = 11.0
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.25, 0.5, 0.75, 1.0])
		g.colors = PackedColorArray([Color("ff7f6b"), Color("ffc857"), Color("6cc58a"), Color("4f8ff0"), Color("ff8fc1")])
		p.color_initial_ramp = g
		root.add_child(p)
		p.emitting = true
		get_tree().create_timer(3.0).timeout.connect(p.queue_free)
