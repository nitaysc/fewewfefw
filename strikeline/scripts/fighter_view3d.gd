class_name FighterView3D
extends Node3D
## The 3D look of one fighter (Meshy model + motion-capture clips) driven by the 2D
## gameplay Fighter. Each frame it picks a clip for the fighter's state or move and sets
## the clip time so the clip's moment of impact lands on the move's first active frame.

const PXU := 48.0          # game pixels per metre
const TURN := 62.0         # how far fighters turn toward the camera (degrees)
const ROOT := "res://assets/meshy/%s/"
## Which Meshy model each fighter uses (the "_w" models hold their weapons in a closed fist).
const MODEL_DIRS := {"kai": "kai_w", "bruno": "bruno", "nyx": "nyx_w", "sol": "sol_w"}

## Locomotion: an athletic forward-lean sprint and a calm, tucked fall.
const RUN_CLIP := "Lean_Forward_Sprint_inplace"
const FALL_CLIP := "Fall2"

static var _scenes := {}
static var _libs := {}
static var _info := {}

## Move -> clip. "*" applies to everyone; per-fighter entries override.
const CLIPS := {
	"*": {
		"jab1": "Left_Jab_from_Guard", "jab2": "Right_Jab_from_Guard", "jab3": "High_Kick",
		"ftilt": "Right_Jab_from_Guard", "utilt": "High_Kick", "dtilt": "Leg_Sweep", "dash": "Flying_Fist_Kick",
		"fsmash": "Roundhouse_Kick", "usmash": "High_Kick", "dsmash": "Leg_Sweep",
		"nair": "Roundhouse_Kick", "fair": "Right_Jab_from_Guard", "bair": "Roundhouse_Kick", "uair": "High_Kick",
		"dair": "Leg_Sweep", "grab": "Left_Jab_from_Guard", "pummel": "Right_Jab_from_Guard",
		"throw_f": "Right_Jab_from_Guard", "throw_b": "Roundhouse_Kick", "throw_u": "High_Kick", "throw_d": "Leg_Sweep",
		"item_throw": "Right_Jab_from_Guard", "ledge_atk": "Leg_Sweep", "getup_atk": "Leg_Sweep",
	},
	"kai": {
		"ftilt": "Right_Hand_Sword_Slash", "utilt": "Charged_Upward_Slash", "fsmash": "Charged_Slash",
		"usmash": "Sword_Judgment", "dsmash": "Double_Combo_Attack", "fair": "Right_Hand_Sword_Slash",
		"dair": "Sword_Judgment", "nair": "Double_Combo_Attack", "dash": "Thrust_Slash",
		"kai_nb": "Right_Hand_Sword_Slash", "kai_sb": "Thrust_Slash", "kai_ub": "Charged_Upward_Slash",
		"kai_db": "Sword_Parry", "kai_counter": "Charged_Slash", "final": "Triple_Combo_Attack",
		"throw_f": "Right_Hand_Sword_Slash",
	},
	"bruno": {
		"jab3": "Left_Hook_from_Guard", "ftilt": "Left_Hook_from_Guard", "utilt": "Right_Uppercut_from_Guard",
		"dash": "Spartan_Kick", "fsmash": "Punch_Forward_with_Both_Fists", "usmash": "Right_Uppercut_from_Guard",
		"dsmash": "Charged_Ground_Slam", "fair": "Left_Hook_from_Guard", "nair": "Boxing_Guard_Step_Knee_Strike",
		"uair": "Right_Uppercut_from_Guard", "dair": "Charged_Ground_Slam",
		"bruno_nb": "Punch_Forward_with_Both_Fists", "bruno_sb": "Spartan_Kick", "bruno_ub": "Right_Uppercut_from_Guard",
		"bruno_db": "Charged_Ground_Slam", "bruno_plunge": "Charged_Ground_Slam", "final": "Punch_Combo",
		"throw_u": "Right_Uppercut_from_Guard", "pummel": "Boxing_Guard_Step_Knee_Strike",
	},
	"nyx": {
		"jab3": "Step_in_High_Kick", "ftilt": "Elbow_Strike", "utilt": "Step_in_High_Kick", "dtilt": "Sweeping_Kick",
		"dash": "Lunge_Roundhouse_Kick", "fsmash": "Lunge_Spin_Kick", "usmash": "Step_in_High_Kick",
		"dsmash": "Sweeping_Kick", "nair": "Lunge_Spin_Kick", "fair": "Lunge_Roundhouse_Kick",
		"nyx_nb": "Right_Jab_from_Guard", "nyx_sb": "Lunge_Roundhouse_Kick", "nyx_ub": "Stand_Dodge",
		"nyx_db": "Lunge_Spin_Kick", "final": "Counterstrike",
	},
	"sol": {
		"ftilt": "mage_soell_cast", "utilt": "mage_soell_cast_1", "fsmash": "Charged_Spell_Cast_1",
		"usmash": "mage_soell_cast_1", "dsmash": "Charged_Ground_Slam", "dair": "Charged_Ground_Slam",
		"sol_nb": "Charged_Spell_Cast", "sol_sb": "mage_soell_cast_2", "sol_ub": "mage_soell_cast_3",
		"sol_db": "Charged_Ground_Slam", "final": "Charged_Spell_Cast_1",
	},
}

var f  # Fighter
var id := ""
var model: Node3D
var pivot: Node3D
var ap: AnimationPlayer
var clip := ""
var loop_t := 0.0
var meshes: Array = []
var overlay: StandardMaterial3D
var info: Dictionary = {}
var accent := Color.WHITE
var trail: MeshInstance3D
var trail_pts: Array = []
var cine_hidden := false
var yaw := INF        # smoothed facing (degrees)
var spin_s := 0.0     # smoothed whole-body spin
var lean := 0.0       # forward lean while running   # Final Smash cutscene: fighters not in it step out of shot


static func available() -> bool:
	return ResourceLoader.exists(ROOT % MODEL_DIRS.kai + "rigged.glb")


static func _load(fid: String) -> void:
	if _scenes.has(fid):
		return
	var dir: String = MODEL_DIRS.get(fid, fid)
	_scenes[fid] = load(ROOT % dir + "rigged.glb")
	_libs[fid] = load(ROOT % dir + "anims.res")
	if _info.is_empty() and FileAccess.file_exists("res://assets/meshy/clipinfo.json"):
		_info = JSON.parse_string(FileAccess.get_file_as_string("res://assets/meshy/clipinfo.json"))


func setup(fighter) -> void:
	f = fighter
	id = f.data.id
	accent = f.data.accent
	_load(id)
	info = _info.get(MODEL_DIRS.get(id, id), {})
	pivot = Node3D.new()
	add_child(pivot)
	model = (_scenes[id] as PackedScene).instantiate() as Node3D
	pivot.add_child(model)
	ap = model.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if ap == null:
		ap = AnimationPlayer.new()
		model.add_child(ap)
	ap.add_animation_library("m", _libs[id])
	ap.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		meshes.append(mi)
		(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		WeaponSkin.apply(MODEL_DIRS.get(id, id), mi)
	overlay = StandardMaterial3D.new()
	overlay.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	overlay.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	overlay.albedo_color = Color(1, 1, 1, 0)
	# personal rim light in the fighter's colour, Smash-style
	var rim := OmniLight3D.new()
	rim.light_color = accent
	rim.light_energy = 1.6
	rim.omni_range = 2.6
	rim.position = Vector3(0, 1.7, -0.9)
	add_child(rim)
	trail = MeshInstance3D.new()
	var tm := StandardMaterial3D.new()
	tm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	tm.vertex_color_use_as_albedo = true
	tm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	tm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	tm.cull_mode = BaseMaterial3D.CULL_DISABLED
	trail.material_override = tm
	add_child(trail)
	trail.top_level = true
	_play("Combat_Stance", 0.0, 0.0)


func _cinfo(c: String) -> Dictionary:
	return info.get(c, {"len": 1.0, "impact": 0.4})


func _clip_for_move(mid: String) -> String:
	var own: Dictionary = CLIPS.get(id, {})
	if own.has(mid):
		return own[mid]
	return CLIPS["*"].get(mid, "Right_Jab_from_Guard")


func _play(c: String, t: float, blend: float) -> void:
	var name := "m/" + c
	if not ap.has_animation(name):
		return
	if c != clip:
		clip = c
		ap.play(name, blend)
		ap.seek(t, true)
		return
	var d := t - ap.current_animation_position
	if d >= 0.0 and d < 0.4:
		ap.advance(d)
	else:
		ap.seek(t, true)


func _loop(c: String, speed: float, blend := 0.12) -> void:
	var L: float = _cinfo(c).len
	if c != clip:
		loop_t = 0.0
	loop_t = fmod(loop_t + speed / 60.0, L)
	_play(c, loop_t, blend)


## Maps the move's frame to clip time: startup -> up to the impact, then the follow-through.
func _move_time(mv: Dictionary, c: String) -> float:
	var ci := _cinfo(c)
	var L: float = ci.len
	var imp: float = ci.impact
	var mlen: float = mv.get("len", 30)
	var hit_f := mlen * 0.35
	var hits: Array = mv.get("hits", [])
	if hits.size() > 0:
		hit_f = float(hits[0].f[0])
	elif mv.has("spawn"):
		hit_f = float(mv.spawn[0])
	elif mv.has("throw"):
		hit_f = float(mv.throw.at)
	var pre := clampf(hit_f / 60.0 * 2.2, 0.18, imp)
	var post := clampf((mlen - hit_f) / 60.0 * 1.8, 0.25, L - imp)
	var mf: float = f.mf
	if mf <= hit_f:
		return imp - pre + pre * (mf / maxf(hit_f, 1.0))
	return imp + post * clampf((mf - hit_f) / maxf(mlen - hit_f, 1.0), 0.0, 1.0)


func _has(c: String) -> bool:
	return ap.has_animation("m/" + c)


func update_view(intro_off: float) -> void:
	var S = Fighter.S
	visible = f.visible and f.state != S.DEAD and f.state != S.OUT and not cine_hidden
	if not visible:
		trail.visible = false
		return
	var face: float = f.facing
	var turn := face
	var spin := 0.0
	var st: int = f.state
	match st:
		S.IDLE, S.RESPAWN, S.SQUAT, S.LAND, S.GETUP:
			_loop("Combat_Stance", 1.0, 0.2)
		S.RUN:
			var k := clampf(absf(f.vel.x) / float(f.data.run), 0.45, 1.25)
			_loop(RUN_CLIP if _has(RUN_CLIP) else "Running", k * 0.95, 0.18)
		S.CROUCH:
			_play("Cautious_Crouch_Walk_Forward", 0.15, 0.16)
		S.AIR, S.HELPLESS:
			if f.flip_t > 0:
				# double jump: a real backflip, timed to the jump
				var L: float = _cinfo("Backflip").len
				_play("Backflip", L * (0.22 + 0.5 * (1.0 - f.flip_t / 22.0)), 0.05)
			elif f.vel.y < -2.0:
				var L2: float = _cinfo("Regular_Jump").len
				_play("Regular_Jump", L2 * clampf(0.35 + f.sframe / 60.0 * 0.6, 0.35, 0.55), 0.14)
			else:
				_loop(FALL_CLIP if _has(FALL_CLIP) else "Fall1", 0.8, 0.3)
		S.AIRDODGE:
			_play("Stand_Dodge", clampf(f.sframe / 60.0 * 1.6, 0.0, 1.2), 0.06)
		S.ATTACK:
			var mid: String = f.mv.get("id", "")
			var c := _clip_for_move(mid)
			_play(c, _move_time(f.mv, c), 0.06)
			if mid == "bair" or mid == "throw_b":
				turn = -face
		S.HITSTUN:
			if f.tumble:
				_play("BeHit_FlyUp", clampf(0.15 + f.sframe / 60.0, 0.15, 1.2), 0.04)
			else:
				_play("Hit_Reaction", clampf(0.2 + f.sframe / 60.0 * 1.6, 0.2, 1.2), 0.04)
		S.KNOCKDOWN:
			_play("Knock_Down", clampf(1.0 + f.sframe / 60.0 * 1.5, 1.0, 2.45), 0.08)
		S.SHIELD:
			_play("Block1", 1.08, 0.08)
		S.ROLL:
			_play("Roll_Dodge", clampf(0.3 + f.sframe / 60.0 * 2.2, 0.3, 1.8), 0.05)
		S.SPOT:
			_play("Stand_Dodge", clampf(f.sframe / 60.0 * 1.6, 0.0, 1.3), 0.05)
		S.LEDGE:
			_loop("Bar_Hang_Idle", 1.0, 0.1)
		S.CLIMB:
			_play("Regular_Jump", _cinfo("Regular_Jump").len * clampf(0.3 + f.sframe / 20.0 * 0.4, 0.3, 0.7), 0.08)
		S.DIZZY, S.GRABBED:
			_loop("Hit_Reaction", 0.7)
		S.GRABBING:
			_play("Left_Jab_from_Guard", _cinfo("Left_Jab_from_Guard").impact, 0.08)
		_:
			_loop("Combat_Stance", 1.0)

	# whole-body rotation from the gameplay pose: flips, spins and tumbling
	if st == S.HITSTUN and f.tumble:
		spin = -float(f.cur[Rig.ROT]) * face
	var feet := Vector3(f.pos.x / PXU, -(f.pos.y + intro_off) / PXU, 0.0)
	var shake: Vector2 = f.shake
	position = feet + Vector3(shake.x / PXU, -shake.y / PXU, 0)
	pivot.position = Vector3(0, 0.95, 0)
	model.position = Vector3(0, -0.95, 0)
	# smooth turnarounds and recoveries instead of snapping between poses
	var dt := get_process_delta_time()
	var target_yaw := TURN * turn
	if yaw == INF or st == S.RESPAWN:
		yaw = target_yaw
	yaw = lerpf(yaw, target_yaw, 1.0 - exp(-dt * 24.0))
	if st == S.HITSTUN and f.tumble:
		spin_s = spin
	else:
		spin_s = lerp_angle(spin_s, 0.0, 1.0 - exp(-dt * 14.0))
	var want_lean := 0.0
	if st == S.RUN:
		want_lean = clampf(absf(f.vel.x) / float(f.data.run), 0.0, 1.2) * 7.0
	lean = lerpf(lean, want_lean, 1.0 - exp(-dt * 10.0))
	pivot.rotation = Vector3(0, 0, spin_s)
	model.rotation_degrees = Vector3(0, yaw, 0)
	model.rotate_object_local(Vector3.RIGHT, deg_to_rad(lean))
	var sq := clampf(float(f.squash), -1.0, 1.0)
	model.scale = Vector3(1.0 + sq * 0.12, 1.0 - sq * 0.12, 1.0 + sq * 0.12)

	# flashes: hit flash, dodges, respawn blink, charging and Final Smash aura
	var a := 0.0
	var col := Color(1, 1, 1)
	if f.flash > 0.0:
		a = f.flash * 0.75
	elif f.charging:
		a = 0.25 + 0.2 * sin(f.t * 0.9)
		col = accent
	elif f.fs_ready:
		a = 0.18 + 0.1 * sin(f.t * 0.3)
		col = Color.from_hsv(fmod(f.t * 0.012, 1.0), 0.6, 1.0)
	elif f.intangible > 0 and st in [S.ROLL, S.SPOT, S.AIRDODGE, S.LEDGE, S.GETUP]:
		a = 0.35
		col = Color(0.7, 0.85, 1.0)
	elif f.invincible > 0 and (f.t / 4) % 2 == 0:
		a = 0.4
	overlay.albedo_color = Color(col.r, col.g, col.b, a)
	for mi in meshes:
		(mi as MeshInstance3D).material_overlay = overlay if a > 0.01 else null

	_update_trail(st == S.ATTACK and f.mv.get("hits", []).size() > 0 and _hits_active())


func _hits_active() -> bool:
	for h in f.mv.hits:
		if f.mf >= h.f[0] - 2 and f.mf <= h.f[1] + 2:
			return true
	return false


## A glowing smear following the striking hand/foot (or blade tip) during active frames.
func _update_trail(active: bool) -> void:
	var sk := model.find_child("Skeleton3D", true, false) as Skeleton3D
	if active and sk != null:
		var ci := _cinfo(clip)
		var limb: String = ci.get("limb", "RightHand")
		if limb == "":
			limb = "RightHand"
		var base := sk.global_transform * sk.get_bone_global_pose(sk.find_bone(limb)).origin
		var tip := Vector3.INF
		var wt := WeaponSkin.tip(MODEL_DIRS.get(id, id), limb)
		if wt != Vector3.INF:
			tip = sk.global_transform * (sk.get_bone_global_pose(sk.find_bone(limb)) * wt)
		if tip == Vector3.INF:
			tip = base
			var par := sk.get_bone_parent(sk.find_bone(limb))
			base = sk.global_transform * sk.get_bone_global_pose(par).origin
		trail_pts.append([base.lerp(tip, 0.45), tip, 1.0])
		if trail_pts.size() > 8:
			trail_pts.pop_front()
	for p in trail_pts:
		p[2] -= 0.16
	while trail_pts.size() > 0 and trail_pts[0][2] <= 0.0:
		trail_pts.pop_front()
	trail.visible = trail_pts.size() >= 2
	if not trail.visible:
		return
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	for p in trail_pts:
		var u: float = clampf(p[2], 0.0, 1.0)
		st.set_color(Color(accent.r, accent.g, accent.b, 0.0))
		st.add_vertex(p[0])
		st.set_color(Color(1.0, 1.0, 1.0, u * 0.85).lerp(Color(accent.r, accent.g, accent.b, u * 0.85), 0.4))
		st.add_vertex(p[1])
	trail.mesh = st.commit()
