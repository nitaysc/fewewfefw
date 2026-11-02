class_name OnlineScreen
extends UiScreen
## Online menu: create / join a room, the code keypad, Wi-Fi rooms nearby and the lobby.

const LEVELS := ["EASY", "NORMAL", "HARD"]

var page := "menu"      # menu, keypad, wait, lobby
var entry := ""
var status_msg := ""
var error_msg := ""


func _ready() -> void:
	Net.status.connect(func(m: String): status_msg = m)
	Net.failed.connect(_on_failed)
	Net.joined.connect(func(): page = "lobby"; Net.stop_discovery())
	Net.lobby_changed.connect(func(): pass)
	Net.closed.connect(_on_failed)
	if Net.active() and not Net.lobby.players.is_empty():
		page = "lobby"


func _on_failed(msg: String) -> void:
	error_msg = msg
	page = "menu"
	Sfx.play("ui_back", -4)


func layout() -> void:
	var vs := get_viewport_rect().size
	if error_msg != "":
		add_btn("ok", Rect2(vs.x * 0.5 - 100, vs.y * 0.5 + 60, 200, 60), "OK", "gold")
		return
	match page:
		"menu":
			add_btn("create", Rect2(vs.x * 0.5 - 330, 210, 300, 120), "CREATE ROOM", "primary", "")
			add_btn("join", Rect2(vs.x * 0.5 + 30, 210, 300, 120), "JOIN ROOM", "gold", "")
			add_btn("wifi", Rect2(vs.x * 0.5 - 330, 350, 300, 70), "WI-FI ROOM", "secondary")
			add_btn("name", Rect2(vs.x * 0.5 + 30, 350, 300, 70), "NAME", "chip", Net.my_name.to_upper())
			add_btn("back", Rect2(28, vs.y - 90, 130, 58), "BACK", "secondary")
		"keypad":
			var kw := 64.0
			var x0 := vs.x * 0.5 - 4.0 * (kw + 8.0) - 160.0
			for i in Net.ALPHABET.length():
				var r := Rect2(x0 + (i % 8) * (kw + 8.0), 190 + (i / 8) * (kw + 8.0), kw, kw)
				add_btn("k" + Net.ALPHABET[i], r, Net.ALPHABET[i], "chip")
			add_btn("del", Rect2(x0, 190 + 4 * (kw + 8.0), kw * 2 + 8, 60), "DEL", "secondary")
			add_btn("go", Rect2(x0 + 2 * (kw + 8.0), 190 + 4 * (kw + 8.0), kw * 6 + 40, 60), "JOIN", "gold")
			var ry := 190.0
			for c in Net.lan_rooms:
				var room: Dictionary = Net.lan_rooms[c]
				add_btn("lan" + c, Rect2(vs.x * 0.5 + 250, ry, 300, 62), "%s'S ROOM (%d/4)" % [str(room.name).to_upper(), int(room.n)], "chip")
				ry += 72.0
			add_btn("back", Rect2(28, vs.y - 90, 130, 58), "BACK", "secondary")
		"wait":
			add_btn("cancel", Rect2(vs.x * 0.5 - 100, vs.y * 0.5 + 80, 200, 60), "CANCEL", "secondary")
		"lobby":
			var me := _my_slot()
			if me >= 0:
				var sx := _slot_x(me)
				add_btn("prev", Rect2(sx + 6, 352, 54, 54), "<", "chip")
				add_btn("nextf", Rect2(sx + 196, 352, 54, 54), ">", "chip")
			var by := vs.y - 104
			add_btn("leave", Rect2(28, by + 16, 130, 58), "LEAVE", "secondary")
			if Net.is_host:
				var s: Dictionary = Net.lobby.settings
				var cx := 172.0
				var free: int = 4 - Net.lobby.players.size()
				var st := int(s.stocks)
				add_btn("cpus", Rect2(cx, by, 120, 74), "CPUs", "chip", str(mini(int(s.cpus), free)))
				add_btn("level", Rect2(cx + 130, by, 150, 74), "CPU LEVEL", "chip", LEVELS[clampi(int(s.level) - 1, 0, 2)])
				add_btn("rules", Rect2(cx + 290, by, 140, 74), "RULES", "chip", ("%d STOCK" % st) if st > 0 else ("%d MIN" % -st))
				add_btn("items", Rect2(cx + 440, by, 110, 74), "ITEMS", "chip", "ON" if s.items else "OFF")
				add_btn("stage", Rect2(cx + 560, by, 240, 74), "STAGE", "chip", Stage.STAGES[int(s.stage)].name)
				add_btn("start", Rect2(vs.x - 260, by - 6, 230, 86), "START!", "gold")


func on_button(id: String) -> void:
	if error_msg != "":
		error_msg = ""
		return
	match id:
		"back":
			if page == "keypad":
				page = "menu"
				Net.stop_discovery()
			else:
				Net.leave()
				main.show_title_menu()
		"create":
			page = "wait"
			status_msg = "Creating room…"
			Net.host_online()
		"wifi":
			page = "wait"
			status_msg = "Opening Wi-Fi room…"
			Net.host_lan()
		"join":
			page = "keypad"
			entry = ""
			Net.start_discovery()
		"name":
			var i := Net.NAMES.find(Net.my_name)
			Net.my_name = Net.NAMES[(i + 1) % Net.NAMES.size()]
		"del":
			entry = entry.substr(0, maxi(0, entry.length() - 1))
		"go", "enter":
			if page == "keypad" and (entry.length() == 4 or entry.length() == 8):
				_join(entry)
		"cancel":
			Net.leave()
			page = "menu"
		"leave":
			Net.leave()
			page = "menu"
		"prev", "nextf":
			var me := _my_slot()
			if me >= 0:
				var f: int = Net.lobby.players[me].fighter
				f = (f + (3 if id == "prev" else 1)) % 4
				Game.settings.fighter = f
				Net.pick_fighter(f)
		"cpus":
			var free: int = 4 - Net.lobby.players.size()
			Net.set_setting("cpus", (int(Net.lobby.settings.cpus) + 1) % (free + 1))
		"level":
			Net.set_setting("level", int(Net.lobby.settings.level) % 3 + 1)
		"rules":
			var order := [1, 2, 3, 4, 5, -2, -3]
			Net.set_setting("stocks", order[(order.find(int(Net.lobby.settings.stocks)) + 1) % order.size()])
		"items":
			Net.set_setting("items", not Net.lobby.settings.items)
		"stage":
			Net.set_setting("stage", (int(Net.lobby.settings.stage) + 1) % Stage.STAGES.size())
		"start":
			Net.host_start()
		_:
			if id.begins_with("k") and id.length() == 2 and entry.length() < 8:
				entry += id.substr(1)
			elif id.begins_with("lan"):
				_join(id.substr(3))


func _join(c: String) -> void:
	page = "wait"
	status_msg = "Joining %s…" % c
	Net.stop_discovery()
	Net.join(c)


func _my_slot() -> int:
	var me := Net.my_id()
	for i in Net.lobby.players.size():
		if int(Net.lobby.players[i].peer) == me:
			return i
	return -1


func _slot_x(i: int) -> float:
	var vs := get_viewport_rect().size
	return vs.x * 0.5 - 2.0 * 270.0 + i * 270.0 + 7.0


func _draw() -> void:
	var vs := get_viewport_rect().size
	dim(0.7)
	match page:
		"menu":
			text_shadow("PLAY ONLINE", Vector2(0, 110), 54, Color(1, 1, 1), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
			text("Create a room and share its code, or join a friend's. Up to 4 players, CPUs can fill the rest.",
				Vector2(0, 150), 16, Color(1, 1, 1, 0.7), HORIZONTAL_ALIGNMENT_CENTER, vs.x, false)
			draw_buttons()
			text("Online rooms work over the internet. Wi-Fi rooms are for phones on the same network.",
				Vector2(0, 460), 14, Color(1, 1, 1, 0.5), HORIZONTAL_ALIGNMENT_CENTER, vs.x, false)
		"keypad":
			text_shadow("ENTER ROOM CODE", Vector2(0, 80), 40, Color(1, 1, 1), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
			var shown := entry + "_".repeat(maxi(0, (8 if entry.begins_with("W") else 4) - entry.length()))
			text(" ".join(shown.split("")), Vector2(0, 150), 46, Color(1.0, 0.85, 0.3), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
			draw_buttons()
			if not Net.lan_rooms.is_empty():
				text("ON YOUR WI-FI", Vector2(vs.x * 0.5 + 250, 178), 16, Color(0.5, 0.9, 1.0), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
			else:
				text("Wi-Fi rooms nearby show up here", Vector2(vs.x * 0.5 + 250, 178), 14, Color(1, 1, 1, 0.4), HORIZONTAL_ALIGNMENT_LEFT, -1, false)
		"wait":
			var dots := ".".repeat(int(t * 3.0) % 4)
			text_shadow(status_msg.trim_suffix("…") + dots, Vector2(0, vs.y * 0.5), 34, Color(1, 1, 1), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
			for k in 8:
				var a := t * 4.0 + k * TAU / 8.0
				draw_circle(Vector2(vs.x * 0.5, vs.y * 0.5 - 90) + Vector2(cos(a), sin(a)) * 26.0, 5.0, Color(1, 0.3, 0.35, 0.2 + 0.1 * k))
			draw_buttons()
		"lobby":
			_draw_lobby(vs)
	if error_msg != "":
		draw_rect(Rect2(Vector2.ZERO, vs), Color(0, 0, 0, 0.6))
		draw_rect(Rect2(vs.x * 0.5 - 330, vs.y * 0.5 - 110, 660, 260), Color(0.06, 0.05, 0.1, 0.96))
		draw_rect(Rect2(vs.x * 0.5 - 330, vs.y * 0.5 - 110, 660, 5), Color(1, 0.3, 0.35))
		text("COULDN'T CONNECT", Vector2(0, vs.y * 0.5 - 50), 30, Color(1, 1, 1), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
		text(error_msg, Vector2(vs.x * 0.5 - 300, vs.y * 0.5), 17, Color(1, 1, 1, 0.8), HORIZONTAL_ALIGNMENT_CENTER, 600, false)
		draw_buttons()


func _draw_lobby(vs: Vector2) -> void:
	var lan := Net.mode == "lan"
	text("WI-FI ROOM" if lan else "ROOM CODE", Vector2(0, 48), 18, Color(1, 1, 1, 0.6), HORIZONTAL_ALIGNMENT_CENTER, vs.x, false)
	text_shadow(" ".join(Net.code.split("")), Vector2(0, 104), 58, Color(1.0, 0.85, 0.3), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
	text("Friends on the same Wi-Fi join with this code" if lan else "Share this code. Friends tap JOIN ROOM and type it in.",
		Vector2(0, 134), 15, Color(1, 1, 1, 0.6), HORIZONTAL_ALIGNMENT_CENTER, vs.x, false)
	var players: Array = Net.lobby.players
	var s: Dictionary = Net.lobby.settings
	var cpus := mini(int(s.get("cpus", 0)), 4 - players.size())
	for i in 4:
		var x := _slot_x(i)
		var r := Rect2(x, 160, 256, 260)
		var col: Color = Match.PORT_COLORS[i]
		if i < players.size():
			var p: Dictionary = players[i]
			var fi := int(p.fighter)
			var d: Dictionary = Roster.fighter(fi)
			draw_rect(r, Color(0.06, 0.06, 0.1, 0.9))
			draw_rect(Rect2(r.position, Vector2(r.size.x, 5)), col)
			var pose := Roster.pose("guard").duplicate()
			pose[Rig.LEAN] += sin(t * 4.0 + i) * 0.03
			UiScreen.draw_fighter(self, fi, Vector2(x + 128, 330), 1.25, pose, 1.0)
			var tag := "YOU" if int(p.peer) == Net.my_id() else ("HOST" if int(p.peer) == 1 else "")
			text(str(p.name).to_upper(), Vector2(x + 14, 192), 20, Color(1, 1, 1))
			if tag != "":
				text(tag, Vector2(x + 180, 192), 14, col, HORIZONTAL_ALIGNMENT_LEFT, -1, false)
			text(d.name, Vector2(x, 395), 24, d.accent, HORIZONTAL_ALIGNMENT_CENTER, r.size.x)
		elif i < players.size() + cpus:
			draw_rect(r, Color(0.06, 0.06, 0.1, 0.6))
			draw_rect(Rect2(r.position, Vector2(r.size.x, 5)), Color(0.5, 0.5, 0.55))
			text("CPU", Vector2(x, 300), 36, Color(1, 1, 1, 0.5), HORIZONTAL_ALIGNMENT_CENTER, r.size.x)
			text(LEVELS[clampi(int(s.level) - 1, 0, 2)], Vector2(x, 330), 14, Color(1, 1, 1, 0.4), HORIZONTAL_ALIGNMENT_CENTER, r.size.x, false)
		else:
			draw_rect(r, Color(0.06, 0.06, 0.1, 0.35))
			draw_rect(r, Color(1, 1, 1, 0.12), false, 2.0)
			var dots := ".".repeat(int(t * 2.0 + i) % 4)
			text("WAITING" + dots, Vector2(x, 300), 18, Color(1, 1, 1, 0.35), HORIZONTAL_ALIGNMENT_CENTER, r.size.x, false)
	draw_buttons()
	if not Net.is_host:
		var st := int(s.get("stocks", 3))
		var rules := ("%d STOCK" % st) if st > 0 else ("%d MIN" % -st)
		text("%s  ·  %s  ·  ITEMS %s" % [Stage.STAGES[int(s.get("stage", 0))].name, rules, "ON" if s.get("items", true) else "OFF"],
			Vector2(0, vs.y - 74), 18, Color(1, 1, 1, 0.7), HORIZONTAL_ALIGNMENT_CENTER, vs.x, false)
		text("Waiting for the host to start" + ".".repeat(int(t * 2.0) % 4), Vector2(0, vs.y - 44), 22, Color(1.0, 0.85, 0.3), HORIZONTAL_ALIGNMENT_CENTER, vs.x)
