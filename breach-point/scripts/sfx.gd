class_name Sfx
## Loads the generated sound effects and makes players for them.

static var _streams := {}

static func stream(name: String) -> AudioStream:
	if not _streams.has(name):
		_streams[name] = load("res://assets/sounds/%s.wav" % name)
	return _streams[name]

static func player(name: String, db := 0.0) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.stream = stream(name)
	p.volume_db = db
	p.max_polyphony = 4
	return p

static func player3d(name: String, db := 0.0) -> AudioStreamPlayer3D:
	var p := AudioStreamPlayer3D.new()
	p.stream = stream(name)
	p.volume_db = db
	p.max_polyphony = 4
	p.unit_size = 6.0
	p.max_distance = 90.0
	return p

## plays a one-off positional sound that frees itself
static func at(tree_node: Node, name: String, pos: Vector3, db := 0.0, pitch := 1.0) -> void:
	var p := player3d(name, db)
	p.pitch_scale = pitch
	tree_node.get_tree().current_scene.add_child(p)
	p.global_position = pos
	p.play()
	p.finished.connect(p.queue_free)
