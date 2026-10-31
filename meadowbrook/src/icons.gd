class_name IconMaker
extends Node
## Renders 3D models into small pictures for the interface (toys, machines, coins), one per
## frame in a hidden viewport, so every icon matches the game exactly.

var SIZE := 160
var vp: SubViewport
var cam: Camera3D
var holder: Node3D
var queue: Array = []
var cache := {}
var working := false

func _ready() -> void:
	vp = SubViewport.new()
	vp.size = Vector2i(SIZE, SIZE)
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(vp)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("fff0e0")
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	we.environment = env
	vp.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-45, 35, 0)
	sun.light_energy = 1.3
	vp.add_child(sun)
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	vp.add_child(cam)
	holder = Node3D.new()
	vp.add_child(holder)

## an icon for key; maker builds the model (called later). The texture fills in when ready.
func get_icon(key: String, maker: Callable) -> ImageTexture:
	if cache.has(key):
		return cache[key]
	var tex := ImageTexture.create_from_image(Image.create(SIZE, SIZE, false, Image.FORMAT_RGBA8))
	cache[key] = tex
	queue.append([tex, maker])
	if not working:
		_work()
	return tex

func toy(t: String, c := "wood") -> ImageTexture:
	return get_icon("item|%s|%s" % [t, c], func(): return Props.item({"t": t, "c": c}))

func machine(kind: String) -> ImageTexture:
	if kind == "belt":
		return get_icon("belt", func():
			var m := ShaderMaterial.new()
			m.shader = Shader.new()
			m.shader.code = "shader_type spatial;\nvoid fragment(){ float v = fract(UV.x*5.0 + abs(UV.y-0.5)*1.2); ALBEDO = mix(vec3(0.2,0.22,0.26), vec3(0.42,0.46,0.52), smoothstep(0.16,0.1,v)); }"
			return Meshes.belt(m))
	return get_icon("m|" + kind, func(): return Meshes.machine(kind, {"color": "red", "toy": "car"}))

func _work() -> void:
	working = true
	while not queue.is_empty():
		var job: Array = queue.pop_front()
		for ch in holder.get_children():
			ch.queue_free()
		var model: Node3D = job[1].call()
		holder.add_child(model)
		_frame(model)
		vp.render_target_update_mode = SubViewport.UPDATE_ONCE
		await RenderingServer.frame_post_draw
		var img := vp.get_texture().get_image()
		if img:
			img.convert(Image.FORMAT_RGBA8)
			(job[0] as ImageTexture).set_image(img)
	working = false

func _frame(model: Node3D) -> void:
	var box := AABB()
	var first := true
	for mi in _meshes(model):
		var b: AABB = _rel(mi, model) * mi.get_aabb()
		box = b if first else box.merge(b)
		first = false
	var c := box.get_center()
	var dir := Vector3(1.0, 0.85, 1.25).normalized()
	cam.size = maxf(box.size.length() * 0.92, 0.2)
	cam.position = c + dir * 6.0
	cam.look_at(c, Vector3.UP)

func _rel(n: Node3D, root: Node3D) -> Transform3D:
	var tr := Transform3D.IDENTITY
	while n != root and n != null:
		tr = n.transform * tr
		n = n.get_parent() as Node3D
	return tr

func _meshes(n: Node) -> Array:
	var out := []
	for ch in n.get_children():
		if ch is MeshInstance3D:
			out.append(ch)
		out.append_array(_meshes(ch))
	return out
