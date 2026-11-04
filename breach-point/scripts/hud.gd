class_name Hud
extends Control
## Crosshair, hit markers, ammo, health, score, kill feed, damage flash and the
## death screen.

var player: Player
var kills := 0
var score := 0
var _hit_t := 0.0
var _hit_head := false
var _hit_kill := false
var _damage := 0.0
var _feed: VBoxContainer
var _ammo: Label
var _reserve: Label
var _wname: Label
var _score: Label
var _hint: Label
var _death: Control
var _death_label: Label
var _vignette: ColorRect
var _health_bar: ProgressBar
var _mag := 30

func setup(p: Player) -> void:
	player = p
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	mouse_filter = MOUSE_FILTER_IGNORE
	_vignette = ColorRect.new()
	_vignette.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	_vignette.mouse_filter = MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = """
shader_type canvas_item;
uniform float amount = 0.0;
uniform float low = 0.0;
void fragment() {
	vec2 p = UV - 0.5;
	float r = length(p * vec2(1.6, 1.0));
	float edge = smoothstep(0.35, 0.85, r);
	float a = edge * amount + edge * low * 0.55;
	COLOR = vec4(0.55, 0.0, 0.0, clamp(a, 0.0, 0.85));
}
"""
	var sm := ShaderMaterial.new()
	sm.shader = sh
	_vignette.material = sm
	add_child(_vignette)

	_ammo = _label(64, HORIZONTAL_ALIGNMENT_RIGHT)
	Ui.place(_ammo, Vector2(1, 0), Vector2(-300, 8), Vector2(170, 80))
	add_child(_ammo)
	_reserve = _label(30, HORIZONTAL_ALIGNMENT_LEFT)
	_reserve.modulate = Color(1, 1, 1, 0.7)
	Ui.place(_reserve, Vector2(1, 0), Vector2(-122, 28), Vector2(110, 50))
	add_child(_reserve)
	_wname = _label(20, HORIZONTAL_ALIGNMENT_RIGHT)
	_wname.text = "VECTOR  ·  AUTO"
	_wname.modulate = Color(1, 1, 1, 0.6)
	Ui.place(_wname, Vector2(1, 0), Vector2(-320, 84), Vector2(300, 30))
	add_child(_wname)

	_health_bar = ProgressBar.new()
	_health_bar.show_percentage = false
	_health_bar.max_value = 100
	Ui.place(_health_bar, Vector2(0.5, 1), Vector2(-120, -34), Vector2(240, 10))
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0, 0, 0, 0.45)
	var fg := StyleBoxFlat.new()
	fg.bg_color = Color(0.92, 0.92, 0.92, 0.9)
	_health_bar.add_theme_stylebox_override("background", bg)
	_health_bar.add_theme_stylebox_override("fill", fg)
	_health_bar.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(_health_bar)

	_score = _label(26, HORIZONTAL_ALIGNMENT_LEFT)
	_score.position = Vector2(24, 18)
	_score.size = Vector2(400, 40)
	add_child(_score)
	_feed = VBoxContainer.new()
	Ui.place(_feed, Vector2(0.5, 0.5), Vector2(-200, 70), Vector2(400, 200))
	_feed.alignment = BoxContainer.ALIGNMENT_BEGIN
	_feed.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(_feed)
	_hint = _label(26, HORIZONTAL_ALIGNMENT_CENTER)
	Ui.place(_hint, Vector2(0.5, 0.5), Vector2(-200, 40), Vector2(400, 40))
	_hint.modulate = Color(1, 0.85, 0.3)
	add_child(_hint)

	_death = ColorRect.new()
	_death.color = Color(0.1, 0, 0, 0.5)
	_death.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	_death.mouse_filter = MOUSE_FILTER_IGNORE
	_death.visible = false
	add_child(_death)
	_death_label = _label(54, HORIZONTAL_ALIGNMENT_CENTER)
	_death_label.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	_death_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_death.add_child(_death_label)

	player.weapon.ammo_changed.connect(_on_ammo)
	_on_ammo(player.weapon.mag, player.weapon.reserve)
	player.weapon.hit_confirmed.connect(_on_hit)
	player.damaged.connect(func(a, _f): _damage = minf(1.0, _damage + a / 30.0))
	_update_score()

func _label(size: int, align: HorizontalAlignment) -> Label:
	var l := Label.new()
	l.horizontal_alignment = align
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	l.add_theme_constant_override("shadow_offset_x", 2)
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.mouse_filter = MOUSE_FILTER_IGNORE
	return l

func _on_ammo(mag: int, reserve: int) -> void:
	_mag = mag
	_ammo.text = str(mag)
	_reserve.text = "/ %d" % reserve
	_ammo.modulate = Color(1, 0.35, 0.3) if mag <= 7 else Color.WHITE

func _on_hit(head: bool, killed: bool) -> void:
	_hit_t = 0.25 if not killed else 0.4
	_hit_head = head
	_hit_kill = killed

func add_kill(headshot: bool) -> void:
	kills += 1
	var pts := 100 + (50 if headshot else 0)
	score += pts
	_update_score()
	var l := _label(24, HORIZONTAL_ALIGNMENT_CENTER)
	l.text = ("HEADSHOT  +%d" if headshot else "ENEMY KILLED  +%d") % pts
	l.modulate = Color(1, 0.85, 0.3) if headshot else Color.WHITE
	_feed.add_child(l)
	var tw := l.create_tween()
	tw.tween_interval(1.6)
	tw.tween_property(l, "modulate:a", 0.0, 0.5)
	tw.tween_callback(l.queue_free)

func _update_score() -> void:
	_score.text = "KILLS %d    SCORE %d" % [kills, score]

func show_death(seconds_left: float) -> void:
	_death.visible = true
	_death_label.text = "YOU DIED\n\nrespawning in %d" % ceili(seconds_left)

func hide_death() -> void:
	_death.visible = false

func _process(delta: float) -> void:
	if not player:
		return
	_hit_t -= delta
	_damage = move_toward(_damage, 0.0, delta * 0.8)
	var low := clampf(1.0 - player.health / 60.0, 0.0, 1.0)
	(_vignette.material as ShaderMaterial).set_shader_parameter("amount", _damage)
	(_vignette.material as ShaderMaterial).set_shader_parameter("low", low)
	_health_bar.value = player.health
	_health_bar.modulate = Color(1, 0.3, 0.3) if player.health < 40 else Color.WHITE
	var w := player.weapon
	if w.reloading:
		_hint.text = ""
	elif w.mag == 0 and w.reserve == 0:
		_hint.text = "NO AMMO"
	elif w.mag <= 7:
		_hint.text = "RELOAD"
	else:
		_hint.text = ""
	queue_redraw()

func _draw() -> void:
	if not player or not player.alive:
		return
	var c := size / 2.0
	var w := player.weapon
	var vis := 1.0 - w.ads_amount
	vis *= 1.0 - w.sprint_amount
	if vis > 0.05 and not w.inspecting:
		var spread := 10.0 + w._bloom * 10.0 + clampf(player.velocity.length() / 5.0, 0.0, 1.5) * 14.0
		var col := Color(1, 1, 1, 0.85 * vis)
		var sh := Color(0, 0, 0, 0.5 * vis)
		for d in [Vector2.RIGHT, Vector2.LEFT, Vector2.UP, Vector2.DOWN]:
			var a: Vector2 = c + d * spread
			var b: Vector2 = c + d * (spread + 12.0)
			draw_line(a + Vector2(1, 1), b + Vector2(1, 1), sh, 3.0)
			draw_line(a, b, col, 2.0)
		draw_circle(c, 1.6, col)
	if _hit_t > 0:
		var col := Color(1, 1, 1)
		if _hit_head:
			col = Color(1, 0.8, 0.2)
		if _hit_kill:
			col = Color(1, 0.25, 0.2)
		var s := 9.0 if not _hit_kill else 12.0
		for d in [Vector2(1, 1), Vector2(-1, 1), Vector2(1, -1), Vector2(-1, -1)]:
			draw_line(c + d * 6.0, c + d * (6.0 + s), col, 2.5)
