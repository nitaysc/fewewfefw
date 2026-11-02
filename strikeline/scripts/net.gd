extends Node
## Autoload "Net": online rooms and Wi-Fi rooms for up to 4 players.
##
## Online rooms: WebRTC peer-to-peer (the webrtc-native GDExtension) with the free public
## PeerJS server doing signalling, like the café game. Room codes are 4 characters.
## Wi-Fi rooms: ENet on the local network; the code encodes the host's LAN address
## ("W" + 7 characters) and hosts also broadcast themselves for discovery.
##
## Netcode: the host runs the real simulation. Guests send their inputs every frame and
## receive a snapshot of the match every frame plus a reliable stream of effect events.

signal status(msg: String)
signal joined
signal failed(msg: String)
signal lobby_changed
signal start(cfg: Dictionary)
signal results(res: Dictionary)
signal closed(msg: String)
signal peer_left(peer: int)
signal go_lobby

const ALPHABET := "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const PREFIX := "strikeline-v1-"
const LAN_PORT := 47821
const DISCO_PORT := 47822
const ICE := {"iceServers": [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:global.stun.twilio.com:3478"]}]}
const NAMES := ["Blaze", "Comet", "Rook", "Echo", "Vex", "Nova", "Bolt", "Drift", "Rune", "Jinx", "Pike", "Zed"]

var mode := ""          # "", "online", "lan"
var is_host := false
var code := ""
var my_name := ""
var in_match := false
var lobby := {"players": [], "settings": {}}

# signalling
var ws: WebSocketPeer
var ws_open := false
var my_sig := ""
var host_sig := ""
var hb_t := 0.0
var join_t := 0.0
var sig_host := "0.peerjs.com"
var sig_port := 443
var sig_secure := true
var rtc: WebRTCMultiplayerPeer
var conns := {}         # sig id -> {"id": int, "pc": WebRTCPeerConnection}
var next_peer := 2

# lan
var disco: PacketPeerUDP
var disco_t := 0.0
var listen: PacketPeerUDP
var lan_rooms := {}

# match traffic
var inputs := {}        # host: peer -> PackedByteArray (latest input)
var snaps: Array = []   # guest: queued snapshots
var events: Array = []  # guest: queued event batches


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	my_name = NAMES[randi() % NAMES.size()]
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--peer="):
			var hp := a.substr(7).split(":")
			sig_host = hp[0]
			sig_port = int(hp[1]) if hp.size() > 1 else 9000
			sig_secure = false
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.connected_to_server.connect(_on_connected_to_host)
	multiplayer.connection_failed.connect(func(): _fail("Couldn't connect to that room."))
	multiplayer.server_disconnected.connect(func(): _close("The host left the room."))


func active() -> bool:
	return mode != ""


func my_id() -> int:
	return multiplayer.get_unique_id() if active() else 1


# ------------------------------------------------------------------ hosting / joining
func host_online() -> void:
	leave()
	mode = "online"
	is_host = true
	code = _rand_code(4)
	my_sig = PREFIX + code
	if not _webrtc_ok():
		return
	status.emit("Creating room…")
	_sig_connect()


func join(c: String) -> void:
	leave()
	c = c.strip_edges().to_upper()
	if c.length() == 8 and c.begins_with("W"):
		_join_lan(c)
		return
	mode = "online"
	is_host = false
	code = c
	host_sig = PREFIX + c
	my_sig = PREFIX + c + "-" + _rand_code(6)
	if not _webrtc_ok():
		return
	status.emit("Looking for room %s…" % c)
	_sig_connect()


func host_lan() -> void:
	leave()
	var ip := _lan_ip()
	if ip == "":
		_fail("Connect to Wi-Fi first.")
		return
	mode = "lan"
	is_host = true
	code = "W" + _encode_ip(ip)
	var p := ENetMultiplayerPeer.new()
	var err := p.create_server(LAN_PORT, 3)
	if err != OK:
		_fail("Couldn't open a Wi-Fi room (error %d)." % err)
		return
	multiplayer.multiplayer_peer = p
	disco = PacketPeerUDP.new()
	disco.set_broadcast_enabled(true)
	disco.set_dest_address("255.255.255.255", DISCO_PORT)
	_init_lobby()
	joined.emit()


func _join_lan(c: String) -> void:
	var ip := _decode_ip(c.substr(1))
	if ip == "":
		_fail("That code doesn't look right.")
		return
	mode = "lan"
	is_host = false
	code = c
	var p := ENetMultiplayerPeer.new()
	var err := p.create_client(ip, LAN_PORT)
	if err != OK:
		_fail("Couldn't reach that room (error %d)." % err)
		return
	multiplayer.multiplayer_peer = p
	join_t = 8.0
	status.emit("Connecting over Wi-Fi…")


func start_discovery() -> void:
	if listen != null:
		return
	listen = PacketPeerUDP.new()
	if listen.bind(DISCO_PORT) != OK:
		listen = null


func stop_discovery() -> void:
	if listen != null:
		listen.close()
		listen = null
	lan_rooms.clear()


func leave() -> void:
	in_match = false
	if ws != null:
		ws.close()
		ws = null
	ws_open = false
	for k in conns:
		var pc: WebRTCPeerConnection = conns[k].pc
		pc.close()
	conns.clear()
	if multiplayer.multiplayer_peer != null and not (multiplayer.multiplayer_peer is OfflineMultiplayerPeer):
		multiplayer.multiplayer_peer.close()
	multiplayer.multiplayer_peer = OfflineMultiplayerPeer.new()
	rtc = null
	if disco != null:
		disco.close()
		disco = null
	mode = ""
	is_host = false
	code = ""
	next_peer = 2
	join_t = 0.0
	inputs.clear()
	snaps.clear()
	events.clear()
	lobby = {"players": [], "settings": {}}


func _fail(msg: String) -> void:
	leave()
	failed.emit(msg)


func _close(msg: String) -> void:
	leave()
	closed.emit(msg)


func _webrtc_ok() -> bool:
	var pc := WebRTCPeerConnection.new()
	if pc.initialize(ICE) != OK:
		_fail("Online rooms need a 64-bit phone. Try a Wi-Fi room instead.")
		return false
	pc.close()
	return true


# ------------------------------------------------------------------ signalling (PeerJS)
func _sig_connect() -> void:
	ws = WebSocketPeer.new()
	var scheme := "wss" if sig_secure else "ws"
	var url := "%s://%s:%d/peerjs?key=peerjs&id=%s&token=%s&version=1.5.4" % [scheme, sig_host, sig_port, my_sig, _rand_code(10).to_lower()]
	var err := ws.connect_to_url(url, TLSOptions.client() if sig_secure else null)
	if err != OK:
		_fail("No internet connection.")
		return
	join_t = 15.0


func _sig_send(dst: String, type: String, payload: Dictionary) -> void:
	if ws == null or ws.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return
	ws.send_text(JSON.stringify({"type": type, "dst": dst, "payload": payload}))


func _on_sig(msg: Dictionary) -> void:
	var type: String = msg.get("type", "")
	match type:
		"OPEN":
			ws_open = true
			if is_host:
				rtc = WebRTCMultiplayerPeer.new()
				rtc.create_server()
				multiplayer.multiplayer_peer = rtc
				_init_lobby()
				join_t = 0.0
				joined.emit()
			else:
				_sig_send(host_sig, "OFFER", {"t": "hello"})
		"ID-TAKEN":
			if is_host:
				code = _rand_code(4)
				my_sig = PREFIX + code
				ws.close()
				_sig_connect()
			else:
				my_sig = PREFIX + code + "-" + _rand_code(6)
				ws.close()
				_sig_connect()
		"EXPIRE":
			if not is_host:
				_fail("Couldn't find room %s. Check the code and that it's still open." % code)
		"ERROR":
			_fail("The online service had a problem. Try again in a moment.")
		"OFFER", "ANSWER", "CANDIDATE":
			var src: String = msg.get("src", "")
			var pl: Dictionary = msg.get("payload", {})
			if is_host:
				_host_sig(src, pl)
			else:
				_guest_sig(pl)


func _host_sig(src: String, pl: Dictionary) -> void:
	var t: String = pl.get("t", "")
	if t == "hello":
		if conns.has(src):
			return
		if in_match or lobby.players.size() >= 4:
			_sig_send(src, "OFFER", {"t": "full"})
			return
		var id := next_peer
		next_peer += 1
		var pc := _new_pc(src)
		conns[src] = {"id": id, "pc": pc}
		rtc.add_peer(pc, id)
		pc.create_offer()
		return
	if not conns.has(src):
		return
	var pc: WebRTCPeerConnection = conns[src].pc
	if t == "sdp":
		pc.set_remote_description(pl.type, pl.sdp)
	elif t == "ice":
		pc.add_ice_candidate(pl.mid, int(pl.idx), pl.name)


func _guest_sig(pl: Dictionary) -> void:
	var t: String = pl.get("t", "")
	match t:
		"full":
			_fail("That room is full or already in a match.")
		"sdp":
			if rtc == null:
				rtc = WebRTCMultiplayerPeer.new()
				rtc.create_client(int(pl.id))
				var pc := _new_pc(host_sig)
				conns[host_sig] = {"id": 1, "pc": pc}
				rtc.add_peer(pc, 1)
				multiplayer.multiplayer_peer = rtc
				status.emit("Connecting…")
			var pc2: WebRTCPeerConnection = conns[host_sig].pc
			pc2.set_remote_description(pl.type, pl.sdp)
		"ice":
			if conns.has(host_sig):
				var pc3: WebRTCPeerConnection = conns[host_sig].pc
				pc3.add_ice_candidate(pl.mid, int(pl.idx), pl.name)


func _new_pc(dst: String) -> WebRTCPeerConnection:
	var pc := WebRTCPeerConnection.new()
	pc.initialize(ICE)
	pc.session_description_created.connect(func(type: String, sdp: String):
		pc.set_local_description(type, sdp)
		var id: int = conns[dst].id if conns.has(dst) else 0
		_sig_send(dst, "OFFER" if type == "offer" else "ANSWER", {"t": "sdp", "type": type, "sdp": sdp, "id": id}))
	pc.ice_candidate_created.connect(func(mid: String, idx: int, name: String):
		_sig_send(dst, "CANDIDATE", {"t": "ice", "mid": mid, "idx": idx, "name": name}))
	return pc


# ------------------------------------------------------------------ per-frame
func _process(delta: float) -> void:
	if ws != null:
		ws.poll()
		var st := ws.get_ready_state()
		if st == WebSocketPeer.STATE_OPEN:
			while ws.get_available_packet_count() > 0:
				var txt := ws.get_packet().get_string_from_utf8()
				var msg = JSON.parse_string(txt)
				if msg is Dictionary:
					_on_sig(msg)
					if ws == null:
						return
			hb_t += delta
			if hb_t > 5.0:
				hb_t = 0.0
				ws.send_text('{"type":"HEARTBEAT"}')
		elif st == WebSocketPeer.STATE_CLOSED:
			ws = null
			if not ws_open:
				_fail("Couldn't reach the online service. Check your internet connection.")
				return
			ws_open = false
			if is_host and mode == "online":
				# keep the room reachable for new players
				_sig_connect()
	if join_t > 0.0:
		join_t -= delta
		if join_t <= 0.0 and not _connected_as_guest() and not (is_host and lobby.players.size() > 0):
			_fail("Couldn't find room %s. Check the code and that it's still open." % code if mode == "online" else "Couldn't reach that Wi-Fi room. Are you on the same Wi-Fi?")
	if disco != null:
		disco_t -= delta
		if disco_t <= 0.0:
			disco_t = 1.0
			disco.put_packet(("STRIKELINE|%s|%s|%d" % [code, my_name, lobby.players.size()]).to_utf8_buffer())
	if listen != null:
		while listen.get_available_packet_count() > 0:
			var pk := listen.get_packet().get_string_from_utf8()
			var parts := pk.split("|")
			if parts.size() >= 4 and parts[0] == "STRIKELINE":
				lan_rooms[parts[1]] = {"name": parts[2], "n": int(parts[3]), "t": Time.get_ticks_msec()}
		for k in lan_rooms.keys():
			if Time.get_ticks_msec() - int(lan_rooms[k].t) > 4000:
				lan_rooms.erase(k)


func _connected_as_guest() -> bool:
	return not is_host and lobby.players.size() > 0


# ------------------------------------------------------------------ lobby
func _init_lobby() -> void:
	var s: Dictionary = Game.settings
	lobby = {"players": [{"peer": 1, "name": my_name, "fighter": int(s.fighter)}],
		"settings": {"stage": int(s.stage), "stocks": int(s.stocks), "items": bool(s.get("items", true)),
			"cpus": 0, "level": int(s.level)}}


func _on_peer_connected(id: int) -> void:
	pass


func _on_connected_to_host() -> void:
	join_t = 0.0
	if ws != null:
		ws.close()
		ws = null
	hello.rpc_id(1, my_name, int(Game.settings.fighter))


func _on_peer_disconnected(id: int) -> void:
	if not is_host:
		return
	for i in range(lobby.players.size() - 1, -1, -1):
		if int(lobby.players[i].peer) == id:
			lobby.players.remove_at(i)
	for k in conns.keys():
		if conns[k].id == id:
			conns.erase(k)
	inputs.erase(id)
	peer_left.emit(id)
	if not in_match:
		_broadcast_lobby()


@rpc("any_peer", "reliable")
func hello(name: String, fighter: int) -> void:
	if not is_host:
		return
	var id := multiplayer.get_remote_sender_id()
	if in_match or lobby.players.size() >= 4:
		multiplayer.multiplayer_peer.disconnect_peer(id)
		return
	for p in lobby.players:
		if int(p.peer) == id:
			return
	var used := []
	for p in lobby.players:
		used.append(p.name)
	if used.has(name):
		name = name + " " + str(id)
	lobby.players.append({"peer": id, "name": name, "fighter": clampi(fighter, 0, 3)})
	var s: Dictionary = lobby.settings
	s.cpus = mini(int(s.cpus), 4 - lobby.players.size())
	_broadcast_lobby()


func _broadcast_lobby() -> void:
	lobby_state.rpc(lobby)


@rpc("authority", "reliable", "call_local")
func lobby_state(l: Dictionary) -> void:
	var first: bool = lobby.players.is_empty() and not is_host
	lobby = l
	if first:
		joined.emit()
	lobby_changed.emit()


func pick_fighter(idx: int) -> void:
	if is_host:
		_set_fighter(1, idx)
	else:
		pick.rpc_id(1, idx)


@rpc("any_peer", "reliable")
func pick(idx: int) -> void:
	if is_host:
		_set_fighter(multiplayer.get_remote_sender_id(), idx)


func _set_fighter(peer: int, idx: int) -> void:
	for p in lobby.players:
		if int(p.peer) == peer:
			p.fighter = clampi(idx, 0, 3)
	_broadcast_lobby()


func set_setting(k: String, v) -> void:
	if not is_host:
		return
	lobby.settings[k] = v
	_broadcast_lobby()


func host_start() -> void:
	if not is_host:
		return
	var s: Dictionary = lobby.settings
	var players := []
	for p in lobby.players:
		players.append({"fighter": int(p.fighter), "cpu": false, "peer": int(p.peer), "name": p.name})
	var taken := players.map(func(x): return x.fighter)
	var pool := [0, 1, 2, 3]
	pool.shuffle()
	for i in mini(int(s.cpus), 4 - players.size()):
		var f: int = pool[i]
		for q in pool:
			if not taken.has(q):
				f = q
				break
		taken.append(f)
		players.append({"fighter": f, "cpu": true, "level": int(s.level), "peer": 0})
	if players.size() < 2:
		players.append({"fighter": (int(players[0].fighter) + 1) % 4, "cpu": true, "level": int(s.level), "peer": 0})
	var cfg := {"mode": "versus", "online": true, "stage": int(s.stage), "stocks": int(s.stocks), "items": bool(s.items), "players": players}
	begin.rpc(cfg)


@rpc("authority", "reliable", "call_local")
func begin(cfg: Dictionary) -> void:
	in_match = true
	inputs.clear()
	snaps.clear()
	events.clear()
	start.emit(cfg)


func match_over(res: Dictionary) -> void:
	if is_host:
		over.rpc(res)


@rpc("authority", "reliable", "call_local")
func over(res: Dictionary) -> void:
	in_match = false
	results.emit(res)


func back_to_lobby() -> void:
	if is_host:
		to_lobby.rpc()


@rpc("authority", "reliable", "call_local")
func to_lobby() -> void:
	in_match = false
	go_lobby.emit()


# ------------------------------------------------------------------ match traffic
func send_input(data: PackedByteArray) -> void:
	if not is_host and active():
		net_input.rpc_id(1, data)


@rpc("any_peer", "unreliable_ordered")
func net_input(data: PackedByteArray) -> void:
	if is_host:
		inputs[multiplayer.get_remote_sender_id()] = data


func send_frame(snap: PackedByteArray, evs: Array) -> void:
	if not is_host or not active():
		return
	net_snap.rpc(snap)
	if not evs.is_empty():
		net_events.rpc(evs)


@rpc("authority", "unreliable_ordered")
func net_snap(data: PackedByteArray) -> void:
	snaps.append(data)
	if snaps.size() > 8:
		snaps = snaps.slice(snaps.size() - 3)


@rpc("authority", "reliable")
func net_events(evs: Array) -> void:
	events.append_array(evs)


## Guest: the next snapshot to show (a small jitter buffer keeps playback smooth).
func take_snapshot() -> PackedByteArray:
	if snaps.is_empty():
		return PackedByteArray()
	if snaps.size() > 3:
		snaps = snaps.slice(snaps.size() - 2)
	return snaps.pop_front()


func take_events() -> Array:
	var e := events
	events = []
	return e


# ------------------------------------------------------------------ helpers
func _rand_code(n: int) -> String:
	var s := ""
	for i in n:
		s += ALPHABET[randi() % ALPHABET.length()]
	return s


func _lan_ip() -> String:
	var fallback := ""
	for a in IP.get_local_addresses():
		if a.count(".") != 3 or a.begins_with("127.") or a.begins_with("169.254."):
			continue
		if a.begins_with("192.168.") or a.begins_with("10.") or (a.begins_with("172.") and int(a.split(".")[1]) >= 16 and int(a.split(".")[1]) <= 31):
			return a
		if fallback == "":
			fallback = a
	return fallback


func _encode_ip(ip: String) -> String:
	var p := ip.split(".")
	var v := (int(p[0]) << 24) | (int(p[1]) << 16) | (int(p[2]) << 8) | int(p[3])
	var s := ""
	for i in 7:
		s = ALPHABET[v & 31] + s
		v >>= 5
	return s


func _decode_ip(s: String) -> String:
	if s.length() != 7:
		return ""
	var v := 0
	for ch in s:
		var k := ALPHABET.find(ch)
		if k < 0:
			return ""
		v = (v << 5) | k
	return "%d.%d.%d.%d" % [(v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255]
