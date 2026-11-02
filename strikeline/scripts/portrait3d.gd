class_name Portrait3D
extends SubViewport
## A live 3D render of one fighter for menus (select cards, lobby, results).
## Each portrait is its own little lit world rendered to a transparent texture.

const VICTORY := {"kai": "Combat_Stance", "bruno": "Chest_Pound_Taunt", "nyx": "Combat_Stance", "sol": "Charged_Spell_Cast_1"}
const SHOWCASE := {"kai": "Charged_Slash", "bruno": "Right_Uppercut_from_Guard", "nyx": "Lunge_Spin_Kick", "sol": "Charged_Spell_Cast"}

var idx := -1
var clip := ""
var model: Node3D
var ap: AnimationPlayer
var cam: Camera3D


## Returns (and creates on first use) the portrait texture `key` living under `owner`.
static func texture(owner: Node, key: String, fighter_idx: int, clip_name: String, px := 512) -> Texture2D:
	if not FighterView3D.available():
		return null
	var p: Portrait3D = owner.get_node_or_null(NodePath("pt_" + key))
	if p == null:
		p = Portrait3D.new()
		p.name = "pt_" + key
		p.size = Vector2i(px, px)
		p.transparent_bg = true
		p.own_world_3d = true
		p.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		owner.add_child(p)
		p._build_world()
	p.show_fighter(fighter_idx, clip_name)
	return p.get_texture()


func _build_world() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.8, 0.75, 0.9)
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-30, -35, 0)
	key.light_energy = 1.3
	key.light_color = Color(1.0, 0.93, 0.86)
	add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-10, 165, 0)
	rim.light_energy = 1.6
	rim.light_color = Color(0.6, 0.75, 1.0)
	add_child(rim)
	cam = Camera3D.new()
	cam.fov = 30.0
	cam.position = Vector3(0, 0.98, 4.3)
	add_child(cam)
	cam.look_at(Vector3(0, 0.95, 0))


func show_fighter(fighter_idx: int, clip_name: String) -> void:
	if fighter_idx != idx:
		idx = fighter_idx
		if model != null:
			model.queue_free()
		var d: Dictionary = Roster.fighter(idx)
		var id: String = d.id
		FighterView3D._load(id)
		model = (FighterView3D._scenes[id] as PackedScene).instantiate() as Node3D
		add_child(model)
		model.rotation_degrees = Vector3(0, 32, 0)
		ap = model.find_child("AnimationPlayer", true, false) as AnimationPlayer
		if ap == null:
			ap = AnimationPlayer.new()
			model.add_child(ap)
		ap.add_animation_library("m", FighterView3D._libs[id])
		ap.animation_finished.connect(func(_n): if clip != "": ap.play("m/" + clip))
		Weapons.attach(model, d.weapon, d.accent)
		var accent := OmniLight3D.new()
		accent.light_color = d.accent
		accent.light_energy = 2.0
		accent.omni_range = 3.0
		accent.position = Vector3(-0.8, 1.6, -1.0)
		model.add_child(accent)
		if id == "bruno":
			cam.position = Vector3(0, 1.05, 4.7)
		else:
			cam.position = Vector3(0, 0.98, 4.3)
		clip = ""
	if clip_name != clip:
		clip = clip_name
		if ap.has_animation("m/" + clip):
			ap.play("m/" + clip, 0.2)
