class_name Roster
extends RefCounted
## Fighters, their animations and their moves.
## Poses: [lean, head, sf, ef, sb, eb, hf, kf, hb, kb, hy, rot, wa] (see rig.gd).
## Move keys: anim [[frame, pose, ease]], len, hits, land, next/next_win, charge,
## push [[frame, vx]], sfx [[frame, name]], trail [from, to, joint], spawn [frame, kind].
## Hit keys: f [from, to], j joint, r radius, d damage, b base knockback,
## g knockback growth, a angle (deg), back, radial, rehit (frames).

const E_SMOOTH := 0
const E_OUT := 1
const E_IN := 2
const E_LIN := 3

static var _moves: Dictionary = {}
static var _poses: Dictionary = {}

const FIGHTERS := [
	{
		"id": "kai", "name": "KAI", "title": "THE RONIN",
		"blurb": "Balanced swordsman. Crescent waves, a flash step and a deadly counter.",
		"weapon": "sword", "wlen": 46.0,
		"dims": {"torso": 30.0, "ua": 17.0, "la": 17.0, "th": 21.0, "sh": 21.0, "head": 11.0},
		"w": 6.5, "accent": Color(1.0, 0.2, 0.3), "body": Color(0.1, 0.085, 0.11), "scarf": Color(0.92, 0.12, 0.22),
		"run": 9.5, "air": 6.6, "air_acc": 0.62, "jump": 17.0, "djump": 15.5, "grav": 0.85, "fall": 14.0,
		"weight": 1.0, "jumps": 2, "dmg": 1.0, "spd": 1.0, "reach": 1.0,
		"specials": {"nb": "kai_nb", "sb": "kai_sb", "ub": "kai_ub", "db": "kai_db"},
		"special_names": ["Crescent Wave", "Flash Step", "Rising Tempest", "Iron Counter"],
		"stats": [3, 3, 3, 3],
	},
	{
		"id": "bruno", "name": "BRUNO", "title": "THE TITAN",
		"blurb": "Heavy brawler. Slow, tough and every punch can end a stock.",
		"weapon": "fists", "wlen": 0.0,
		"dims": {"torso": 35.0, "ua": 19.5, "la": 19.0, "th": 23.0, "sh": 23.0, "head": 12.5},
		"w": 9.5, "accent": Color(1.0, 0.68, 0.12), "body": Color(0.11, 0.09, 0.07), "scarf": Color(1.0, 0.55, 0.08),
		"run": 8.0, "air": 5.6, "air_acc": 0.5, "jump": 15.8, "djump": 14.2, "grav": 0.95, "fall": 15.5,
		"weight": 1.32, "jumps": 2, "dmg": 1.25, "spd": 1.15, "reach": 1.35,
		"specials": {"nb": "bruno_nb", "sb": "bruno_sb", "ub": "bruno_ub", "db": "bruno_db"},
		"special_names": ["Haymaker", "Bull Rush", "Skyhook", "Quake Slam"],
		"stats": [5, 1, 2, 5],
	},
	{
		"id": "nyx", "name": "NYX", "title": "THE SHADE",
		"blurb": "Lightning-fast ninja with three jumps, kunai and a vanishing act.",
		"weapon": "knives", "wlen": 17.0,
		"dims": {"torso": 28.0, "ua": 16.0, "la": 16.0, "th": 20.5, "sh": 20.5, "head": 10.5},
		"w": 5.8, "accent": Color(0.72, 0.38, 1.0), "body": Color(0.08, 0.07, 0.12), "scarf": Color(0.6, 0.25, 1.0),
		"run": 11.8, "air": 7.4, "air_acc": 0.75, "jump": 17.5, "djump": 14.6, "grav": 0.86, "fall": 14.8,
		"weight": 0.84, "jumps": 3, "dmg": 0.86, "spd": 0.84, "reach": 1.0,
		"specials": {"nb": "nyx_nb", "sb": "nyx_sb", "ub": "nyx_ub", "db": "nyx_db"},
		"special_names": ["Kunai Fan", "Shadow Dash", "Vanish", "Dive Kick"],
		"stats": [2, 5, 4, 2],
	},
	{
		"id": "sol", "name": "SOL", "title": "THE ARCWRIGHT",
		"blurb": "Staff-wielding storm mage. Long reach, charged orbs and a floaty jet.",
		"weapon": "staff", "wlen": 62.0,
		"dims": {"torso": 31.0, "ua": 17.0, "la": 17.0, "th": 22.0, "sh": 22.0, "head": 11.0},
		"w": 6.2, "accent": Color(0.2, 0.9, 1.0), "body": Color(0.07, 0.1, 0.12), "scarf": Color(0.12, 0.75, 0.95),
		"run": 8.8, "air": 6.3, "air_acc": 0.58, "jump": 16.6, "djump": 15.6, "grav": 0.74, "fall": 12.4,
		"weight": 0.94, "jumps": 2, "dmg": 0.95, "spd": 1.0, "reach": 1.0,
		"specials": {"nb": "sol_nb", "sb": "sol_sb", "ub": "sol_ub", "db": "sol_db"},
		"special_names": ["Pulse Orb", "Arc Lance", "Updraft", "Static Field"],
		"stats": [3, 3, 5, 4],
	},
]


static func fighter(idx: int) -> Dictionary:
	return FIGHTERS[clampi(idx, 0, FIGHTERS.size() - 1)]


static func pose(name: String) -> PackedFloat32Array:
	_build()
	return _poses[name]


static func move(name: String) -> Dictionary:
	_build()
	return _moves.get(name, {})


static func _build() -> void:
	if not _moves.is_empty():
		return
	var P := func(a: Array) -> PackedFloat32Array: return Rig.P(a)
	var ps := {}
	ps.guard = P.call([0.12, -0.05, 0.7, 1.7, 0.35, 1.9, 0.35, 0.35, -0.3, 0.35, 0, 0, 0.25])
	ps.crouch = P.call([0.35, 0.1, 0.9, 1.4, 0.5, 1.6, 1.2, 2.2, -0.4, 1.4, 0, 0, 0.3])
	ps.air_t = P.call([0.05, 0, 0.9, 1.3, 0.3, 1.5, 1.0, 1.8, 0.1, 1.6, 0, 0, 0.3])
	ps.air_fall = P.call([-0.05, -0.15, 2.2, 0.5, -2.0, 0.5, 0.35, 0.3, -0.25, 0.5, 0, 0, 0.3])
	ps.shield = P.call([0.05, 0.2, 1.0, 2.1, 0.8, 2.2, 0.55, 0.7, -0.45, 0.7, 0, 0, 0.9])
	ps.land = P.call([0.3, 0.15, 0.6, 1.2, 0.2, 1.4, 1.05, 2.0, -0.55, 1.5, 0, 0, 0.3])
	ps.squat = P.call([0.25, 0.1, 0.5, 1.0, 0.2, 1.2, 0.95, 1.9, -0.5, 1.4, 0, 0, 0.3])
	ps.hurt = P.call([-0.45, 0.4, 2.2, 0.8, -1.9, 0.6, 0.8, 0.9, -0.4, 0.9, 0, 0, 0.5])
	ps.tumble = P.call([-0.2, 0.5, 2.6, 0.3, -2.4, 0.4, 1.2, 0.4, -0.9, 0.6, 0, 0, 0.5])
	ps.lying = P.call([0.0, 0.0, 1.6, 0.4, -1.4, 0.4, 0.3, 0.3, -0.2, 0.4, 0, -1.57, 0.4])
	ps.ledge = P.call([0.0, -0.3, 2.95, 0.15, 2.8, 0.2, 0.25, 0.4, -0.1, 0.3, 0, 0, 0.0])
	ps.dizzy = P.call([-0.1, 0.6, 0.4, 0.5, -0.3, 0.5, 0.4, 0.5, -0.4, 0.5, 0, 0, 0.6])
	ps.ball = P.call([0.6, 0.6, 1.2, 2.4, 1.0, 2.5, 1.6, 2.7, 1.4, 2.7, 0, 0, 0.3])
	ps.victory = P.call([-0.05, -0.25, 3.1, 0.0, 0.4, 1.9, 0.25, 0.2, -0.35, 0.25, 0, 0, 0.0])
	_poses = ps

	var jab1 := P.call([0.28, -0.1, 1.62, 0.05, 0.3, 2.0, 0.55, 0.35, -0.45, 0.3, 0, 0, -0.2])
	var jab2 := P.call([0.32, -0.1, 0.5, 2.1, 1.62, 0.05, 0.55, 0.35, -0.45, 0.3, 0, 0, 0.4])
	var jab3a := P.call([0.0, 0, 0.9, 1.6, 0.1, 1.9, 1.5, 2.2, -0.15, 0.2, 0, 0, 0.3])
	var jab3b := P.call([-0.3, 0.1, 0.5, 1.8, -0.4, 1.6, 1.62, 0.0, -0.1, 0.1, 0, 0, 0.3])
	var ft_w := P.call([-0.1, 0, -0.5, 1.2, 0.8, 1.2, 0.45, 0.4, -0.4, 0.3, 0, 0, 0.6])
	var ft_s := P.call([0.38, -0.15, 1.6, 0.05, -0.5, 0.8, 0.85, 0.6, -0.65, 0.15, 0, 0, 0.0])
	var ft_f := P.call([0.35, -0.1, 2.1, 0.15, -0.7, 0.8, 0.85, 0.6, -0.65, 0.15, 0, 0, 0.0])
	var ut_w := P.call([0.25, 0.1, 0.6, 0.3, 0.2, 1.8, 0.4, 0.5, -0.35, 0.4, 0, 0, 0.3])
	var ut_s := P.call([-0.05, -0.3, 2.9, 0.1, 0.3, 1.9, 0.2, 0.2, -0.3, 0.2, 0, 0, 0.0])
	var ut_f := P.call([-0.2, -0.3, 3.9, 0.3, 0.3, 1.9, 0.2, 0.2, -0.3, 0.2, 0, 0, 0.0])
	var dt_s := P.call([0.45, -0.2, 1.1, 0.5, -0.3, 1.0, 1.45, 0.0, -0.1, 2.3, 0, 0, 0.3])
	var da_0 := P.call([0.5, 0, -0.6, 1.2, 1.0, 1.2, 0.9, 1.2, -0.7, 0.6, 0, 0, 0.5])
	var da_k := P.call([-0.25, 0.1, -0.6, 0.9, -1.0, 0.9, 1.55, 0.05, -0.4, 1.5, 0, 0, 0.8])
	var fs_w := P.call([-0.35, 0.1, -1.6, 0.9, 1.1, 1.0, 0.55, 0.5, -0.55, 0.4, 0, 0, 0.7])
	var fs_s := P.call([0.55, -0.25, 1.65, 0.0, -0.9, 0.6, 1.0, 0.45, -0.8, 0.1, 0, 0, 0.0])
	var fs_f := P.call([0.5, -0.2, 2.3, 0.2, -1.0, 0.6, 1.0, 0.45, -0.8, 0.1, 0, 0, 0.0])
	var us_w := P.call([0.3, 0.2, 0.3, 0.4, 0.1, 0.4, 0.9, 1.7, -0.6, 1.0, 0, 0, 0.5])
	var us_s := P.call([-0.05, -0.35, 3.05, 0.0, 2.9, 0.1, 0.1, 0.05, -0.1, 0.05, 0, 0, 0.0])
	var ds_w := P.call([0.25, 0.2, 0.8, 2.0, 0.6, 2.0, 0.8, 1.6, -0.6, 1.2, 0, 0, 0.3])
	var ds_s := P.call([0.0, 0.1, 1.55, 0.0, -1.55, 0.0, 1.45, 0.0, -1.45, 0.0, 0, 0, 0.0])
	var na_s := P.call([0.0, 0.0, 1.6, 0.0, -1.6, 0.0, 1.5, 0.1, -1.5, 0.1, 0, 0.0, 0.0])
	var na_e := P.call([0.0, 0.0, 1.6, 0.0, -1.6, 0.0, 1.5, 0.1, -1.5, 0.1, 0, TAU, 0.0])
	var air_spun: PackedFloat32Array = ps.air_t.duplicate()
	air_spun[Rig.ROT] = TAU
	var fa_w := P.call([-0.25, 0.1, 3.5, 0.3, -0.5, 1.0, 1.0, 1.6, 0.0, 1.2, 0, 0, 0.3])
	var fa_s := P.call([0.45, -0.1, 1.2, 0.0, -1.0, 0.8, 1.2, 1.7, 0.2, 1.4, 0, 0, 0.0])
	var fa_f := P.call([0.5, -0.1, 0.6, 0.1, -1.0, 0.8, 1.2, 1.7, 0.2, 1.4, 0, 0, 0.0])
	var ba_w := P.call([0.3, 0.1, 0.9, 1.4, 0.4, 1.6, 0.9, 1.9, -0.3, -1.6, 0, 0, 0.3])
	var ba_s := P.call([0.55, 0.3, 1.2, 1.2, 0.6, 1.4, 0.8, 1.7, -1.65, 0.0, 0, 0, 0.3])
	var ua_w := P.call([-0.1, 0.1, 0.3, 0.6, -0.3, 0.6, 0.6, 1.8, 0.0, 1.0, 0, -0.2, 0.3])
	var ua_s := P.call([-0.35, -0.3, -0.5, 0.3, 0.5, 0.3, 3.0, 0.0, 0.2, 0.8, 0, -0.5, 0.3])
	var dr_w := P.call([0.1, 0.2, 2.4, 0.4, -2.2, 0.4, 1.3, 2.4, 1.1, 2.4, 0, 0, 0.3])
	var dr_s := P.call([0.0, 0.2, 2.6, 0.2, -2.6, 0.2, 0.08, 0.0, -0.08, 0.0, 0, 0, 0.0])

	var c_w := P.call([-0.15, 0.1, 0.4, 2.3, 0.5, 2.2, 0.5, 0.4, -0.45, 0.35, 0, 0, 0.8])
	var c_s := P.call([0.35, -0.1, 1.6, 0.0, 1.5, 0.05, 0.75, 0.5, -0.6, 0.2, 0, 0, 0.0])
	var th_w := P.call([-0.2, 0, 2.6, 1.5, 0.6, 1.8, 0.5, 0.4, -0.45, 0.3, 0, 0, 0.0])
	var th_s := P.call([0.4, -0.1, 1.7, -0.1, -0.5, 1.0, 0.8, 0.5, -0.6, 0.2, 0, 0, 0.0])
	var dsl_w := P.call([0.65, 0, -0.1, 0.4, 0.9, 1.6, 0.9, 1.4, -0.6, 0.6, 0, 0, 1.5])
	var dsl_s := P.call([0.7, -0.2, 1.65, 0.0, -1.2, 0.5, 1.0, 0.3, -1.1, 0.7, 0, 0, 0.0])
	var dsl_f := P.call([0.4, 0, 2.4, 0.1, -1.0, 0.6, 0.6, 0.5, -0.6, 0.3, 0, 0, 0.0])
	var rs_a := P.call([0.0, -0.3, 3.0, 0.0, -2.6, 0.4, 0.15, 0.1, -0.15, 0.3, 0, 0.0, 0.0])
	var rs_b: PackedFloat32Array = rs_a.duplicate()
	rs_b[Rig.ROT] = TAU * 2.0
	var rs_end: PackedFloat32Array = ps.air_fall.duplicate()
	rs_end[Rig.ROT] = TAU * 2.0
	var ct_p := P.call([-0.15, 0.05, 1.1, 1.3, 0.6, 1.9, 0.5, 0.6, -0.5, 0.5, 0, 0, 0.9])
	var uc_w := P.call([0.4, 0.2, 0.2, 2.6, 0.5, 2.2, 1.0, 1.8, -0.5, 1.0, 0, 0, 0.3])
	var uc_s := P.call([-0.2, -0.35, 3.0, 0.05, 0.4, 1.8, 1.3, 2.0, -0.2, 0.3, 0, 0, 0.0])
	var hm_w := P.call([-0.45, 0.15, -1.8, 1.4, 1.2, 1.2, 0.6, 0.6, -0.5, 0.4, 0, 0, 0.3])
	var hm_s := P.call([0.6, -0.3, 1.6, 0.0, -1.0, 0.6, 1.1, 0.5, -0.9, 0.1, 0, 0, 0.0])
	var ru_p := P.call([0.65, 0.1, 1.0, 2.4, -0.4, 1.0, 1.0, 0.9, -0.8, 0.5, 0, 0, 0.3])
	var sl_w := P.call([-0.2, -0.2, 3.3, 0.2, 3.0, 0.2, 0.3, 0.3, -0.3, 0.3, 0, 0, 0.0])
	var sl_s := P.call([0.7, 0.2, 1.0, 0.0, 0.9, 0.1, 1.1, 1.7, -0.6, 0.9, 0, 0, 0.0])
	var pl := P.call([0.3, 0.3, 0.3, 0.0, -0.1, 0.0, 1.5, 2.5, 1.3, 2.5, 0, 0, 0.0])
	var v_p := P.call([0.2, 0.2, 0.3, 0.6, -0.3, 0.6, 0.6, 1.6, -0.2, 1.4, 0, 0, 0.3])
	var dv_p := P.call([0.0, -0.4, 2.6, 0.4, -2.5, 0.3, 1.0, 0.0, -0.15, 1.6, 0, 0.9, 0.3])
	var jt_p := P.call([0.2, -0.2, -0.6, 0.3, -0.8, 0.3, 0.15, 0.2, -0.1, 0.3, 0, 0, 0.0])
	var fd_w := P.call([0.1, 0.3, 0.5, 2.4, 0.4, 2.4, 0.9, 1.5, -0.7, 1.0, 0, 0, 0.0])
	var fd_s := P.call([-0.05, -0.3, 2.4, 0.0, -2.4, 0.0, 0.55, 0.2, -0.55, 0.2, 0, 0, 0.0])
	var ln_w := P.call([-0.2, 0, 0.0, 0.9, 0.9, 1.0, 0.5, 0.5, -0.5, 0.3, 0, 0, 0.7])
	var ln_s := P.call([0.55, -0.2, 1.6, 0.0, -0.6, 0.8, 1.0, 0.5, -0.9, 0.2, 0, 0, 0.0])
	var g: PackedFloat32Array = ps.guard
	var at: PackedFloat32Array = ps.air_t

	var m := {}
	# ---- ground normals ----
	m.jab1 = {"anim": [[0, g], [3, jab1, E_OUT], [7, jab1], [15, g]], "len": 15,
		"hits": [{"f": [3, 5], "j": "hf", "r": 10, "d": 3, "b": 3.5, "g": 1.5, "a": 35}],
		"next": "jab2", "next_win": [5, 15], "sfx": [[2, "swing_l"]], "trail": [2, 6, "hf"]}
	m.jab2 = {"anim": [[0, jab1], [3, jab2, E_OUT], [7, jab2], [15, g]], "len": 15,
		"hits": [{"f": [3, 5], "j": "hb", "r": 10, "d": 3, "b": 4, "g": 1.5, "a": 40}],
		"next": "jab3", "next_win": [5, 15], "sfx": [[2, "swing_l"]], "trail": [2, 6, "hb"]}
	m.jab3 = {"anim": [[0, jab2], [4, jab3a], [7, jab3b, E_OUT], [11, jab3b], [30, g]], "len": 30,
		"hits": [{"f": [7, 10], "j": "ff", "r": 13, "d": 5, "b": 7, "g": 9, "a": 40}],
		"sfx": [[5, "swing_m"]], "trail": [5, 11, "ff"], "push": [[6, 2.0]]}
	m.ftilt = {"anim": [[0, g], [5, ft_w], [8, ft_s, E_OUT], [13, ft_f], [26, g]], "len": 26,
		"hits": [{"f": [7, 11], "j": "hf", "r": 12, "d": 9, "b": 6, "g": 10, "a": 35}],
		"sfx": [[6, "swing_m"]], "trail": [6, 13, "hf"], "push": [[7, 3.0]]}
	m.utilt = {"anim": [[0, g], [4, ut_w], [8, ut_s, E_OUT], [12, ut_f], [26, g]], "len": 26,
		"hits": [{"f": [6, 12], "j": "hf", "r": 13, "d": 8, "b": 6, "g": 9, "a": 95},
			{"f": [7, 11], "j": "head", "r": 12, "d": 7, "b": 6, "g": 8, "a": 92}],
		"sfx": [[5, "swing_m"]], "trail": [5, 13, "hf"]}
	m.dtilt = {"anim": [[0, g], [3, dt_s, E_OUT], [9, dt_s], [20, ps.crouch]], "len": 20,
		"hits": [{"f": [3, 8], "j": "ff", "r": 11, "d": 7, "b": 5, "g": 7, "a": 22}],
		"sfx": [[2, "swing_l"]], "trail": [2, 9, "ff"]}
	m.dash = {"anim": [[0, da_0], [5, da_k, E_OUT], [16, da_k], [34, g]], "len": 34,
		"hits": [{"f": [5, 14], "j": "ff", "r": 13, "d": 9, "b": 7, "g": 8, "a": 40}],
		"sfx": [[4, "swing_m"]], "trail": [4, 15, "ff"], "push": [[4, 3.0]], "slide": true}
	m.fsmash = {"anim": [[0, g], [8, fs_w], [12, fs_s, E_OUT], [18, fs_f], [46, g]], "len": 46, "charge": 8,
		"hits": [{"f": [11, 14], "j": "hf", "r": 14, "d": 15, "b": 7, "g": 22, "a": 38}],
		"sfx": [[10, "swing_h"]], "trail": [10, 18, "hf"], "push": [[11, 4.0]], "kind": "smash"}
	m.usmash = {"anim": [[0, g], [7, us_w], [11, us_s, E_OUT], [18, us_s], [44, g]], "len": 44, "charge": 7,
		"hits": [{"f": [10, 15], "j": "hf", "r": 14, "d": 14, "b": 8, "g": 20, "a": 90},
			{"f": [10, 14], "j": "head", "r": 15, "d": 13, "b": 8, "g": 19, "a": 88}],
		"sfx": [[9, "swing_h"]], "trail": [9, 17, "hf"], "kind": "smash"}
	m.dsmash = {"anim": [[0, g], [6, ds_w], [10, ds_s, E_OUT], [20, ds_s], [44, g]], "len": 44, "charge": 6,
		"hits": [{"f": [9, 13], "j": "ff", "r": 14, "d": 13, "b": 7, "g": 19, "a": 30, "radial": true},
			{"f": [9, 13], "j": "fb", "r": 14, "d": 13, "b": 7, "g": 19, "a": 30, "radial": true}],
		"sfx": [[8, "swing_h"]], "trail": [8, 14, "ff"], "kind": "smash"}
	# ---- aerials ----
	m.nair = {"anim": [[0, at], [4, na_s, E_OUT], [16, na_e, E_LIN], [30, air_spun]], "len": 30, "land": 8, "air": true,
		"hits": [{"f": [4, 14], "j": "ff", "r": 13, "d": 9, "b": 4, "g": 9, "a": 45, "radial": true},
			{"f": [4, 14], "j": "fb", "r": 13, "d": 9, "b": 4, "g": 9, "a": 45, "radial": true}],
		"sfx": [[4, "swing_m"]], "trail": [4, 15, "ff"]}
	m.fair = {"anim": [[0, at], [5, fa_w], [9, fa_s, E_OUT], [14, fa_f], [32, at]], "len": 32, "land": 10, "air": true,
		"hits": [{"f": [7, 11], "j": "hf", "r": 13, "d": 11, "b": 6, "g": 13, "a": 40}],
		"sfx": [[6, "swing_m"]], "trail": [6, 13, "hf"]}
	m.bair = {"anim": [[0, at], [4, ba_w], [7, ba_s, E_OUT], [12, ba_s], [30, at]], "len": 30, "land": 9, "air": true,
		"hits": [{"f": [7, 11], "j": "fb", "r": 13, "d": 12, "b": 7, "g": 14, "a": 40, "back": true}],
		"sfx": [[6, "swing_h"]], "trail": [6, 12, "fb"]}
	m.uair = {"anim": [[0, at], [3, ua_w], [7, ua_s, E_OUT], [11, ua_s], [28, at]], "len": 28, "land": 8, "air": true,
		"hits": [{"f": [6, 11], "j": "ff", "r": 13, "d": 9, "b": 5, "g": 10, "a": 88}],
		"sfx": [[5, "swing_m"]], "trail": [5, 12, "ff"]}
	m.dair = {"anim": [[0, at], [6, dr_w], [10, dr_s, E_OUT], [15, dr_s], [34, at]], "len": 34, "land": 14, "air": true,
		"hits": [{"f": [9, 13], "j": "ff", "r": 13, "d": 12, "b": 5, "g": 10, "a": -80},
			{"f": [9, 13], "j": "fb", "r": 13, "d": 12, "b": 5, "g": 10, "a": -80}],
		"sfx": [[8, "swing_h"]], "trail": [8, 14, "ff"]}

	# ---- KAI ----
	m.kai_nb = {"anim": [[0, g], [5, ft_w], [9, ft_s, E_OUT], [14, ft_f], [32, g]], "len": 32,
		"spawn": [9, "crescent"], "sfx": [[8, "swing_h"]], "trail": [8, 14, "hf"], "special": true}
	m.kai_sb = {"anim": [[0, g], [6, dsl_w], [8, dsl_s, E_OUT], [18, dsl_s], [24, dsl_f], [36, g]], "len": 36,
		"logic": "flash_step", "air_once": "sb", "special": true,
		"hits": [{"f": [8, 18], "j": "core", "r": 30, "d": 10, "b": 6, "g": 12, "a": 35}],
		"sfx": [[7, "dash"]], "trail": [8, 19, "wt"]}
	m.kai_ub = {"anim": [[0, ps.crouch], [4, rs_a, E_OUT], [24, rs_b, E_LIN], [40, rs_end]], "len": 40,
		"logic": "rise", "helpless": true, "special": true,
		"hits": [{"f": [4, 23], "j": "hf", "r": 18, "d": 2, "b": 5, "g": 0, "a": 88, "rehit": 4, "radial": true},
			{"f": [24, 27], "j": "hf", "r": 22, "d": 5, "b": 6, "g": 10, "a": 65}],
		"sfx": [[3, "swing_h"], [12, "swing_m"]], "trail": [4, 27, "wt"]}
	m.kai_db = {"anim": [[0, g], [3, ct_p, E_OUT], [30, ct_p], [36, g]], "len": 36,
		"logic": "counter", "special": true, "sfx": [[2, "counter_ready"]]}
	m.kai_counter = {"anim": [[0, fs_w], [3, fs_s, E_OUT], [8, fs_f], [26, g]], "len": 26, "special": true,
		"hits": [{"f": [3, 6], "j": "hf", "r": 18, "d": 10, "b": 8, "g": 15, "a": 40}],
		"sfx": [[2, "swing_h"]], "trail": [2, 8, "hf"]}

	# ---- BRUNO ----
	m.bruno_nb = {"anim": [[0, g], [10, hm_w], [14, hm_s, E_OUT], [22, hm_s], [40, g]], "len": 40, "charge": 10,
		"charge_max": 60, "charge_btn": "spc", "special": true, "logic": "haymaker",
		"hits": [{"f": [13, 16], "j": "hf", "r": 17, "d": 12, "b": 8, "g": 16, "a": 35}],
		"sfx": [[12, "swing_h"]], "trail": [12, 18, "hf"]}
	m.bruno_sb = {"anim": [[0, g], [6, ru_p, E_OUT], [30, ru_p], [40, g]], "len": 40, "special": true,
		"logic": "rush", "air_once": "sb",
		"hits": [{"f": [6, 30], "j": "core", "r": 30, "d": 11, "b": 7, "g": 11, "a": 40}],
		"sfx": [[5, "dash"]]}
	m.bruno_ub = {"anim": [[0, ps.crouch], [5, uc_w], [8, uc_s, E_OUT], [18, uc_s], [40, ps.air_fall]], "len": 40,
		"logic": "uppercut", "helpless": true, "special": true,
		"hits": [{"f": [7, 16], "j": "hf", "r": 17, "d": 12, "b": 7, "g": 10, "a": 82}],
		"sfx": [[6, "swing_h"]], "trail": [6, 17, "hf"]}
	m.bruno_db = {"anim": [[0, g], [10, sl_w], [15, sl_s, E_OUT], [28, sl_s], [44, g]], "len": 44,
		"logic": "quake", "special": true,
		"hits": [{"f": [15, 18], "j": "hf", "r": 24, "d": 9, "b": 7, "g": 9, "a": 70, "radial": true}],
		"sfx": [[14, "slam"]]}
	m.bruno_plunge = {"anim": [[0, at], [7, pl, E_OUT], [200, pl]], "len": 200, "special": true, "logic": "plunge",
		"hits": [{"f": [8, 200], "j": "hf", "r": 19, "d": 11, "b": 5, "g": 8, "a": -70},
			{"f": [8, 200], "j": "ff", "r": 17, "d": 11, "b": 5, "g": 8, "a": -70}],
		"sfx": [[6, "swing_h"]]}

	# ---- NYX ----
	m.nyx_nb = {"anim": [[0, g], [5, th_w], [8, th_s, E_OUT], [26, g]], "len": 26, "special": true,
		"spawn": [8, "kunai"], "sfx": [[7, "throw"]]}
	m.nyx_sb = {"anim": [[0, g], [5, dsl_w], [7, dsl_s, E_OUT], [16, dsl_s], [22, dsl_f], [34, g]], "len": 34,
		"logic": "shadow", "air_once": "sb", "special": true,
		"hits": [{"f": [14, 17], "j": "core", "r": 32, "d": 9, "b": 6, "g": 11, "a": 45}],
		"sfx": [[5, "dash"], [14, "swing_m"]], "trail": [13, 18, "wt"]}
	m.nyx_ub = {"anim": [[0, ps.crouch], [10, v_p], [22, at], [32, ps.air_fall]], "len": 32,
		"logic": "vanish", "helpless": true, "special": true,
		"hits": [{"f": [11, 14], "j": "core", "r": 32, "d": 6, "b": 7, "g": 6, "a": 70, "radial": true}],
		"sfx": [[2, "vanish"]]}
	m.nyx_db = {"anim": [[0, at], [6, dv_p, E_OUT], [70, dv_p]], "len": 70, "special": true,
		"logic": "dive", "air_once": "db",
		"hits": [{"f": [6, 70], "j": "ff", "r": 15, "d": 10, "b": 7, "g": 9, "a": 45}],
		"sfx": [[5, "dash"]], "trail": [6, 70, "ff"]}

	# ---- SOL ----
	m.sol_nb = {"anim": [[0, g], [6, c_w], [10, c_s, E_OUT], [22, c_s], [32, g]], "len": 32, "charge": 6,
		"charge_max": 60, "charge_btn": "spc", "special": true, "spawn": [10, "orb"], "sfx": [[9, "orb"]]}
	m.sol_sb = {"anim": [[0, g], [6, ln_w], [9, ln_s, E_OUT], [24, ln_s], [36, g]], "len": 36,
		"logic": "lance", "air_once": "sb", "special": true,
		"hits": [{"f": [9, 20], "j": "wt", "r": 16, "d": 2, "b": 3, "g": 0, "a": 20, "rehit": 3},
			{"f": [21, 23], "j": "wt", "r": 21, "d": 6, "b": 7, "g": 10, "a": 35}],
		"sfx": [[8, "zap"], [20, "zap"]], "trail": [9, 23, "wt"]}
	m.sol_ub = {"anim": [[0, ps.crouch], [5, jt_p, E_OUT], [50, jt_p]], "len": 50,
		"logic": "jet", "helpless": true, "special": true,
		"hits": [{"f": [5, 45], "j": "ff", "r": 15, "d": 2, "b": 4, "g": 2, "a": 80, "rehit": 8}],
		"sfx": [[4, "jet"]]}
	m.sol_db = {"anim": [[0, g], [6, fd_w], [9, fd_s, E_OUT], [20, fd_s], [36, g]], "len": 36,
		"logic": "static", "special": true,
		"hits": [{"f": [9, 13], "j": "core", "r": 74, "d": 8, "b": 9, "g": 8, "a": 60, "radial": true}],
		"sfx": [[8, "zap"]]}

	# ---- grabs & throws ----
	var gr_p := P.call([0.35, -0.1, 1.5, 0.1, 1.4, 0.25, 0.85, 0.6, -0.6, 0.25, 0, 0, 0.6])
	var hold := P.call([0.12, 0.0, 1.3, 0.45, 1.2, 0.55, 0.5, 0.45, -0.45, 0.35, 0, 0, 0.8])
	var pum := P.call([0.25, 0.1, 1.3, 0.5, 1.2, 0.6, 1.5, 2.2, -0.3, 0.3, 0, 0, 0.8])
	var tf_w := P.call([-0.3, 0.1, 0.6, 1.2, 0.5, 1.3, 0.4, 0.5, -0.6, 0.4, 0, 0, 0.8])
	var tf_s := P.call([0.5, -0.2, 1.6, 0.0, 1.5, 0.05, 1.0, 0.45, -0.85, 0.1, 0, 0, 0.6])
	var tb_w := P.call([-0.2, 0.2, 2.6, 0.2, 2.4, 0.3, 0.5, 0.5, -0.5, 0.4, 0, 0, 0.8])
	var tb_s := P.call([0.45, 0.4, -1.5, 0.0, -1.4, 0.1, 0.9, 0.6, -0.5, 0.2, 0, 0, 0.8])
	var tu_w := P.call([0.35, 0.2, 0.6, 0.4, 0.5, 0.5, 1.0, 1.9, -0.6, 1.2, 0, 0, 0.8])
	var tu_s := P.call([-0.1, -0.4, 3.0, 0.0, 2.9, 0.05, 0.15, 0.05, -0.15, 0.1, 0, 0, 0.8])
	var td_w := P.call([-0.15, -0.3, 2.9, 0.1, 2.7, 0.1, 0.3, 0.2, -0.3, 0.2, 0, 0, 0.8])
	var td_s := P.call([0.65, 0.3, 0.7, 0.0, 0.6, 0.1, 1.1, 1.8, -0.5, 1.1, 0, 0, 0.8])
	m.grab = {"anim": [[0, g], [6, gr_p, E_OUT], [14, gr_p], [30, g]], "len": 30,
		"hits": [{"f": [6, 9], "j": "hf", "r": 18, "d": 0, "b": 0, "g": 0, "a": 0, "grab": true}],
		"sfx": [[5, "swing_l"]]}
	m.pummel = {"anim": [[0, hold], [4, pum, E_OUT], [14, hold]], "len": 14, "logic": "pummel"}
	m.throw_f = {"anim": [[0, hold], [5, tf_w], [9, tf_s, E_OUT], [30, g]], "len": 30, "logic": "throw",
		"throw": {"at": 9, "d": 8.0, "b": 8.0, "g": 10.0, "a": 40.0, "dir": 1.0}, "sfx": [[8, "swing_m"]], "trail": [7, 12, "hf"]}
	m.throw_b = {"anim": [[0, hold], [6, tb_w], [11, tb_s, E_OUT], [34, g]], "len": 34, "logic": "throw",
		"throw": {"at": 11, "d": 10.0, "b": 8.0, "g": 12.0, "a": 40.0, "dir": -1.0}, "sfx": [[9, "swing_h"]], "trail": [7, 13, "hf"]}
	m.throw_u = {"anim": [[0, hold], [6, tu_w], [10, tu_s, E_OUT], [32, g]], "len": 32, "logic": "throw",
		"throw": {"at": 10, "d": 7.0, "b": 9.0, "g": 9.0, "a": 90.0, "dir": 1.0}, "sfx": [[9, "swing_h"]], "trail": [7, 12, "hf"]}
	m.throw_d = {"anim": [[0, hold], [5, td_w], [10, td_s, E_OUT], [34, g]], "len": 34, "logic": "throw",
		"throw": {"at": 10, "d": 6.0, "b": 7.0, "g": 4.0, "a": 78.0, "dir": 1.0}, "sfx": [[9, "slam"]], "trail": [6, 12, "hf"]}
	m.item_throw = {"anim": [[0, g], [4, th_w], [7, th_s, E_OUT], [20, g]], "len": 20, "logic": "item_throw", "sfx": [[6, "throw"]]}
	# ---- ledge & get-up attacks ----
	m.ledge_atk = {"anim": [[0, ps.crouch], [4, dt_s, E_OUT], [10, dt_s], [24, g]], "len": 24,
		"hits": [{"f": [4, 9], "j": "ff", "r": 14, "d": 8, "b": 7, "g": 5, "a": 35}], "sfx": [[3, "swing_m"]], "trail": [3, 10, "ff"]}
	m.getup_atk = {"anim": [[0, ps.lying], [5, ds_s, E_OUT], [14, ds_s], [28, g]], "len": 28,
		"hits": [{"f": [5, 10], "j": "ff", "r": 14, "d": 7, "b": 7, "g": 5, "a": 30, "radial": true},
			{"f": [5, 10], "j": "fb", "r": 14, "d": 7, "b": 7, "g": 5, "a": 30, "radial": true}], "sfx": [[4, "swing_m"]], "trail": [4, 11, "ff"]}
	# ---- final smash ----
	var fs_c := P.call([-0.2, -0.35, 2.7, 0.3, 2.5, 0.3, 0.5, 0.6, -0.5, 0.5, 0, 0, 0.3])
	m.final = {"anim": [[0, g], [20, fs_c, E_OUT], [58, fs_c], [64, dsl_s, E_OUT], [150, dsl_s], [170, g]], "len": 170,
		"logic": "final", "special": true}

	# victory poses
	ps.victory_kai = P.call([-0.05, -0.25, 3.1, 0.0, 0.4, 1.9, 0.25, 0.2, -0.35, 0.25, 0, 0, 0.0])
	ps.victory_bruno = P.call([0.0, -0.2, 2.2, 1.9, -2.2, -1.9, 0.4, 0.3, -0.4, 0.3, 0, 0, 0.0])
	ps.victory_nyx = P.call([0.45, 0.2, 1.2, 1.0, -0.6, 1.6, 1.25, 2.3, -0.45, 1.5, 0, 0, 1.2])
	ps.victory_sol = P.call([-0.1, -0.3, 2.95, 0.1, 0.9, 1.6, 0.3, 0.2, -0.4, 0.25, 0, 0, -0.1])
	ps.grabbed = P.call([-0.2, 0.4, 2.4, 0.5, -1.8, 0.6, 0.6, 1.0, -0.4, 0.9, 0, 0, 0.5])
	ps.hold = hold

	# convert keyframe frame numbers to floats once
	for k in m:
		var mv: Dictionary = m[k]
		mv.id = k
		if not mv.has("hits"):
			mv.hits = []
		if not mv.has("kind"):
			mv.kind = "air" if mv.get("air", false) else ("special" if mv.get("special", false) else "tilt")
	_moves = m


## Samples a move's keyframed animation at frame t.
static func sample(anim: Array, t: float) -> PackedFloat32Array:
	if t <= anim[0][0]:
		return anim[0][1]
	for i in range(1, anim.size()):
		var k1: Array = anim[i]
		if t <= float(k1[0]):
			var k0: Array = anim[i - 1]
			var span := float(k1[0]) - float(k0[0])
			var u := 1.0 if span <= 0.0 else (t - float(k0[0])) / span
			var e: int = k1[2] if k1.size() > 2 else E_SMOOTH
			match e:
				E_OUT:
					u = 1.0 - pow(1.0 - u, 3.0)
				E_IN:
					u = u * u
				E_SMOOTH:
					u = u * u * (3.0 - 2.0 * u)
			return Rig.blend(k0[1], k1[1], u)
	return anim[anim.size() - 1][1]
