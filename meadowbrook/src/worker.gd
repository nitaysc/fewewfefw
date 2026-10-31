class_name Worker
extends CharacterBody3D
## Someone in the workshop (you or an apprentice): walks, carries one thing, works at stations.

var model: Toymaker
var carry := {}
var carry_node: Node3D
var speed := 2.6
var move_dir := Vector3.ZERO
var working_at: Node3D
var work_anim := "Interact"
var yaw_goal := 0.0
var steps := 0.0
signal footstep

const WORK_ANIM := {"dig": "TreeChopping", "chop": "TreeChopping", "plant": "Farm_PlantSeed", "water": "Farm_Watering", "harvest": "Farm_Harvest", "pick": "Farm_Harvest", "fill": "Interact"}

func setup(female := false, hair := "Hair_SimpleParted", hair_col := Color(0.42, 0.27, 0.17), beard := true) -> Worker:
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.28
	cap.height = 1.7
	shape.shape = cap
	shape.position.y = 0.85
	add_child(shape)
	model = Toymaker.new()
	model.hair_color = hair_col
	model.build(female, hair, beard)
	add_child(model)
	for n in WORK_ANIM.values():
		var a: Animation = model.anim.get_animation(n)
		if a:
			a.loop_mode = Animation.LOOP_LINEAR
	# a soft blob shadow under the feet grounds the character
	var blob := MeshInstance3D.new()
	var q := PlaneMesh.new()
	q.size = Vector2(0.9, 0.9)
	blob.mesh = q
	var m := ShaderMaterial.new()
	m.shader = Shader.new()
	m.shader.code = "shader_type spatial;\nrender_mode unshaded, blend_mix, depth_draw_never;\nvoid fragment(){ float d = length(UV - 0.5) * 2.0; ALBEDO = vec3(0.08,0.05,0.04); ALPHA = smoothstep(1.0, 0.3, d) * 0.45; }"
	blob.material_override = m
	blob.position.y = 0.01
	blob.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(blob)
	return self

func hold(it: Dictionary) -> void:
	carry = it
	if carry_node:
		carry_node.queue_free()
		carry_node = null
	if it.is_empty():
		return
	carry_node = Props.basket(it)
	carry_node.position = Vector3(0, 0.95, 0.42)
	carry_node.scale = Vector3.ONE * 0.4
	add_child(carry_node)
	create_tween().tween_property(carry_node, "scale", Vector3.ONE, 0.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func drop() -> Dictionary:
	var it := carry
	hold({})
	return it

func face(p: Vector3) -> void:
	var d := p - global_position
	if Vector2(d.x, d.z).length() > 0.05:
		yaw_goal = atan2(d.x, d.z)

func _physics_process(dt: float) -> void:
	var mv := move_dir
	if working_at:
		mv = Vector3.ZERO
	velocity = Vector3(mv.x, 0, mv.z) * speed
	move_and_slide()
	global_position.y = 0.0
	if mv.length() > 0.08:
		yaw_goal = atan2(mv.x, mv.z)
	rotation.y = lerp_angle(rotation.y, yaw_goal, 1.0 - exp(-dt * 12.0))
	var moving := velocity.length() > 0.3
	if working_at:
		model.play(work_anim, 0.2, 1.1)
	elif moving:
		var fast := speed > 2.9
		if carry.is_empty():
			model.play("Jog_Fwd" if fast else "Walk", 0.18, 1.0 if fast else speed / 1.6)
		else:
			model.play("Walk_Carry", 0.18, speed / 1.6)
		steps += dt * speed * 1.4
		if steps > 1.0:
			steps = 0.0
			footstep.emit()
	else:
		model.play("Idle" if carry.is_empty() else "Walk_Carry", 0.25, 1.0 if carry.is_empty() else 0.0)
	_hold_in_hands(dt)

## keep what you carry between your hands (the hand bones of the skeleton)
func _hold_in_hands(dt: float) -> void:
	if carry_node == null or model == null or model.skel == null:
		return
	var sk := model.skel
	var l := sk.find_bone("hand_l")
	var r := sk.find_bone("hand_r")
	if l < 0 or r < 0:
		return
	var pl := to_local(sk.global_transform * sk.get_bone_global_pose(l).origin)
	var pr := to_local(sk.global_transform * sk.get_bone_global_pose(r).origin)
	var goal := (pl + pr) * 0.5 + Vector3(0, -0.13, 0.04)
	carry_node.position = goal if carry_node.position.distance_to(goal) > 0.5 else carry_node.position.lerp(goal, minf(1.0, dt * 30.0))
