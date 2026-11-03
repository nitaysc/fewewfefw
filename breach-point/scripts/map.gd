class_name GameMap
extends NavigationRegion3D
## The arena: a walled industrial yard with containers, two buildings, a raised
## platform and cover. Built from boxes so it needs no model files. Bots walk on a
## navigation mesh baked from it when the game starts.

const HALF := 32.0

var player_spawns: Array[Vector3] = []
var bot_spawns: Array[Vector3] = []
var patrol_points: Array[Vector3] = []

func build() -> void:
	var nm := NavigationMesh.new()
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	nm.agent_radius = 0.5
	nm.agent_height = 1.8
	nm.agent_max_climb = 0.5
	nm.agent_max_slope = 40.0
	nm.cell_size = 0.25
	nm.cell_height = 0.25
	navigation_mesh = nm

	# ground and outer walls
	box(Vector3(0, -0.5, 0), Vector3(HALF * 2 + 4, 1, HALF * 2 + 4), Mats.ground())
	for s in [-1, 1]:
		box(Vector3(0, 2.5, s * (HALF + 0.5)), Vector3(HALF * 2 + 2, 5, 1), Mats.wall())
		box(Vector3(s * (HALF + 0.5), 2.5, 0), Vector3(1, 5, HALF * 2 + 2), Mats.wall())

	# shipping containers
	var red := Mats.painted_metal(Color(0.55, 0.16, 0.10), "red")
	var blue := Mats.painted_metal(Color(0.13, 0.27, 0.45), "blue")
	var green := Mats.painted_metal(Color(0.20, 0.36, 0.22), "green")
	var orange := Mats.painted_metal(Color(0.75, 0.40, 0.10), "orange")
	var c := Vector3(2.44, 2.6, 6.1)
	container(Vector3(-6, 0, 4), 0, red)
	container(Vector3(-6, 2.6, 4), 0, blue)
	container(Vector3(-3.2, 0, 5.5), 0, green)
	container(Vector3(7, 0, -6), 90, orange)
	container(Vector3(7, 0, -9), 90, blue)
	container(Vector3(20, 0, -20), 20, red)
	container(Vector3(-22, 0, 20), -15, green)
	container(Vector3(-22, 2.6, 20), -15, orange)
	container(Vector3(24, 0, 4), 0, green)
	container(Vector3(-25, 0, -4), 0, blue)
	container(Vector3(2, 0, 22), 90, orange)
	container(Vector3(-10, 0, -24), 90, red)

	# buildings with doorways and windows
	building(Vector3(-15, 0, -12), Vector3(10, 3.6, 8), 0)
	building(Vector3(15, 0, 13), Vector3(9, 3.6, 9), 90)

	# raised platform in the middle with a ramp
	var plat := Mats.concrete()
	box(Vector3(0, 1.4, -2), Vector3(6, 0.4, 6), plat)
	for p in [Vector3(-2.7, 0.6, -4.7), Vector3(2.7, 0.6, -4.7), Vector3(-2.7, 0.6, 0.7), Vector3(2.7, 0.6, 0.7)]:
		box(p, Vector3(0.4, 1.2, 0.4), plat)
	box(Vector3(0, 0.75, 3.6), Vector3(2.4, 0.3, 5.6), plat, 0, -16.0)
	box(Vector3(0, 1.95, -4.85), Vector3(6, 0.7, 0.2), Mats.painted_metal(Color(0.3, 0.3, 0.3), "rail"))

	# crates and barriers for cover
	var crate := Mats.crate_wood()
	for p in [Vector3(4, 0, 6), Vector3(5.3, 0, 6.2), Vector3(4.6, 1.2, 6.1), Vector3(-12, 0, 9), Vector3(-13.2, 0, 9.3),
			Vector3(12, 0, -2), Vector3(18, 0, -12), Vector3(18, 1.2, -12), Vector3(-18, 0, 4), Vector3(-4, 0, -16),
			Vector3(9, 0, 22), Vector3(-26, 0, 12), Vector3(26, 0, -10), Vector3(-1, 0, -12)]:
		box(p + Vector3(0, 0.6, 0), Vector3(1.2, 1.2, 1.2), crate, randf_range(-20, 20))
	var barrier := Mats.concrete()
	for b in [[Vector3(10, 0, 4), 0], [Vector3(-9, 0, -4), 90], [Vector3(-2, 0, 14), 10], [Vector3(14, 0, -15), 60],
			[Vector3(-18, 0, -22), 0], [Vector3(22, 0, 22), 45], [Vector3(-8, 0, 16), 90], [Vector3(26, 0, 14), 90]]:
		box(b[0] + Vector3(0, 0.55, 0), Vector3(2.4, 1.1, 0.6), barrier, b[1])

	# light poles for some silhouettes
	for p in [Vector3(-28, 0, -28), Vector3(28, 0, -28), Vector3(-28, 0, 28), Vector3(28, 0, 28)]:
		box(p + Vector3(0, 4, 0), Vector3(0.3, 8, 0.3), Mats.painted_metal(Color(0.25, 0.25, 0.27), "pole"))

	player_spawns = [Vector3(0, 0.2, 26), Vector3(-26, 0.2, 26), Vector3(26, 0.2, 26)]
	bot_spawns = [Vector3(-27, 0.2, -27), Vector3(27, 0.2, -27), Vector3(0, 0.2, -27), Vector3(-27, 0.2, 0), Vector3(27, 0.2, 0)]
	for x in range(-24, 25, 8):
		for z in range(-24, 25, 8):
			patrol_points.append(Vector3(x, 0.2, z))

	bake_navigation_mesh(false)

func box(pos: Vector3, size: Vector3, mat: Material, rot_y := 0.0, rot_x := 0.0) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.position = pos
	body.rotation_degrees = Vector3(rot_x, rot_y, 0)
	var shape := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	shape.shape = bs
	body.add_child(shape)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	body.add_child(mi)
	add_child(body)
	return body

func container(pos: Vector3, rot_y: float, mat: Material) -> void:
	var size := Vector3(2.44, 2.6, 6.1)
	var b := box(pos + Vector3(0, size.y / 2, 0), size, mat, rot_y)
	# corrugation ribs on the long sides
	var rib := BoxMesh.new()
	rib.size = Vector3(0.06, size.y - 0.2, 0.12)
	for i in 14:
		for s in [-1, 1]:
			var r := MeshInstance3D.new()
			r.mesh = rib
			r.material_override = mat
			r.position = Vector3(s * (size.x / 2 + 0.03), 0, -size.z / 2 + 0.3 + i * (size.z - 0.6) / 13.0)
			b.add_child(r)
	# door end frame
	var frame := MeshInstance3D.new()
	var fm := BoxMesh.new()
	fm.size = Vector3(size.x + 0.08, size.y + 0.06, 0.1)
	frame.mesh = fm
	frame.material_override = Mats.painted_metal(Color(0.2, 0.2, 0.2), "frame")
	frame.position = Vector3(0, 0, size.z / 2)
	b.add_child(frame)

func building(pos: Vector3, size: Vector3, rot_y: float) -> void:
	var root := Node3D.new()
	root.position = pos
	root.rotation_degrees.y = rot_y
	add_child(root)
	var m := Mats.wall()
	var t := 0.3
	var h := size.y
	var parts := []
	# back wall with a window gap
	parts.append([Vector3(-size.x / 4 - 0.5, h / 2, -size.z / 2), Vector3(size.x / 2 - 1, h, t)])
	parts.append([Vector3(size.x / 4 + 0.5, h / 2, -size.z / 2), Vector3(size.x / 2 - 1, h, t)])
	parts.append([Vector3(0, 0.5, -size.z / 2), Vector3(2, 1, t)])
	parts.append([Vector3(0, h - 0.4, -size.z / 2), Vector3(2, 0.8, t)])
	# front wall with a door
	parts.append([Vector3(-size.x / 4 - 0.6, h / 2, size.z / 2), Vector3(size.x / 2 - 1.2, h, t)])
	parts.append([Vector3(size.x / 4 + 0.6, h / 2, size.z / 2), Vector3(size.x / 2 - 1.2, h, t)])
	parts.append([Vector3(0, h - 0.5, size.z / 2), Vector3(2.4, 1.0, t)])
	# side walls with a window each
	for s in [-1, 1]:
		parts.append([Vector3(s * size.x / 2, h / 2, -size.z / 4 - 0.6), Vector3(t, h, size.z / 2 - 1.2)])
		parts.append([Vector3(s * size.x / 2, h / 2, size.z / 4 + 0.6), Vector3(t, h, size.z / 2 - 1.2)])
		parts.append([Vector3(s * size.x / 2, 0.55, 0), Vector3(t, 1.1, 2.4)])
		parts.append([Vector3(s * size.x / 2, h - 0.4, 0), Vector3(t, 0.8, 2.4)])
	parts.append([Vector3(0, h + 0.15, 0), Vector3(size.x + 0.3, 0.3, size.z + 0.3)])
	for p in parts:
		var b := box(Vector3.ZERO, p[1], m)
		b.reparent(root, false)
		b.position = p[0]
	# floor inside
	var f := box(Vector3.ZERO, Vector3(size.x - 0.2, 0.06, size.z - 0.2), Mats.concrete())
	f.reparent(root, false)
	f.position = Vector3(0, 0.03, 0)
