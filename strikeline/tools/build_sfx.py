"""Builds the game's sound effects from CC0 recordings (OpenGameArt) with ffmpeg + numpy.
usage: build_sfx.py <extracted packs dir> <out dir>"""
import subprocess, sys, os, wave
import numpy as np
X, OUT = sys.argv[1], sys.argv[2]
SR = 44100
H = X + "/hits/hits/hit%02d.mp3.flac"
SW = X + "/swishes/swishes/swish-%d.wav"
IM = X + "/impact_-_starninjas/impact.%d.ogg"
C = X + "/100-CC0-SFX_0/%s.ogg"
R = X + "/rpg_sound_pack/RPG Sound Pack/%s.wav"
B = X + "/bangs/%s.ogg"
K = X + "/kenney_interfaceSounds/Audio/%s.ogg"

def find_k(n):
    for root, _, files in os.walk(X + "/kenney_interfaceSounds"):
        if n + ".ogg" in files:
            return os.path.join(root, n + ".ogg")
    raise FileNotFoundError(n)

def load(path, af=""):
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR)]
    if af:
        cmd += ["-af", af]
    cmd += ["-f", "f32le", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def trim(x):
    a = np.abs(x)
    pk = a.max() if len(a) else 0
    if pk == 0:
        return x
    idx = np.where(a > pk * 0.003)[0]
    x = x[max(0, idx[0] - 40): idx[-1] + 1]
    n = min(len(x), int(SR * 0.08))
    x[-n:] *= np.linspace(1, 0, n)
    return x

def mix(layers, peak):
    parts = []
    for path, af, gain, delay in layers:
        y = trim(load(path, af)) * gain
        parts.append(np.concatenate([np.zeros(int(SR * delay / 1000)), y]))
    n = max(len(p) for p in parts)
    out = np.zeros(n, dtype=np.float32)
    for p in parts:
        out[:len(p)] += p
    out = out / max(np.abs(out).max(), 1e-6) * peak
    return out

def save(name, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())

PITCH = lambda k: f"asetrate={int(SR * k)},aresample={SR}"
LOW = lambda f: f"lowpass=f={f}"
VERB = "aecho=0.8:0.6:40|70:0.25|0.15"

S = {
    # name: [variants], each variant = [layers]; layer = (file, filter, gain, delay ms)
    "hit_l": [[(H % 14, "", 1, 0)], [(H % 15, "", 1, 0)], [(H % 18, "", 1, 0)]],
    "hit_m": [[(H % 28, "", 1, 0)], [(H % 29, "", 1, 0)], [(H % 30, "", 1, 0)]],
    "hit_h": [[(H % 19, "", 1, 0), (H % 21, LOW(500), 0.6, 0)], [(H % 35, "", 1, 0), (H % 24, LOW(500), 0.6, 0)], [(H % 21, "", 1, 0), (H % 19, LOW(500), 0.6, 0)]],
    "hit_crit": [[(H % 37, "", 1, 0), (B % "bang_03", "", 0.9, 0), (H % 36, VERB, 0.5, 20)]],
    "swing_l": [[(SW % 12, PITCH(1.15), 1, 0)], [(SW % 13, PITCH(1.15), 1, 0)], [(SW % 11, PITCH(1.15), 1, 0)]],
    "swing_m": [[(SW % 5, "", 1, 0)], [(SW % 6, "", 1, 0)], [(SW % 8, "", 1, 0)]],
    "swing_h": [[(SW % 7, PITCH(0.78), 1, 0)], [(SW % 9, PITCH(0.78), 1, 0)]],
    "shield_hit": [[(IM % 6, "", 1, 0)], [(IM % 3, "", 1, 0)]],
    "shield_break": [[(C % "glass_03", "", 1, 0), (IM % 10, "", 0.7, 0), (C % "glass_05", "", 0.6, 60)]],
    "shield_up": [[(R % "inventory/cloth", PITCH(1.2), 1, 0)]],
    "land": [[(H % 16, LOW(700), 1, 0)], [(H % 17, LOW(700), 1, 0)]],
    "land_heavy": [[(C % "slam_01", "", 1, 0), (H % 24, LOW(300), 0.7, 0)]],
    "jump": [[(R % "inventory/cloth", "", 1, 0), (SW % 12, PITCH(1.3), 0.4, 0)]],
    "djump": [[(SW % 1, PITCH(1.25), 1, 0), (R % "inventory/cloth", PITCH(1.2), 0.6, 0)]],
    "dash": [[(SW % 3, PITCH(0.9), 1, 0)]],
    "dodge": [[(SW % 4, PITCH(1.2), 1, 0)]],
    "ledge": [[(R % "inventory/cloth-heavy", "", 1, 0)]],
    "tech": [[(R % "inventory/cloth-heavy", PITCH(1.2), 1, 0), (H % 16, LOW(900), 0.5, 0)]],
    "grab": [[(R % "inventory/cloth-heavy", "", 1, 0), (H % 26, LOW(1200), 0.6, 0)]],
    "throw": [[(SW % 9, PITCH(0.85), 1, 0)]],
    "ko": [[(B % "bang_06", "", 1, 0), (H % 37, "", 0.8, 0), (B % "bang_03", "", 0.9, 0)]],
    "star": [[(C % "bell_01", PITCH(1.3), 1, 0)]],
    "explosion": [[(B % "bang_09", "", 1, 0), (B % "bang_03", "", 0.8, 0)]],
    "slam": [[(C % "slam_05", "", 1, 0), (H % 21, LOW(400), 0.6, 0)]],
    "bounce": [[(C % "wooden_01", "", 1, 0)]],
    "parry": [[(R % "inventory/metal-ringing", "", 1, 0), (IM % 7, "", 0.6, 0)]],
    "counter": [[(R % "battle/sword-unsheathe", "", 1, 0), (H % 37, "", 0.6, 30)]],
    "counter_ready": [[(R % "battle/sword-unsheathe3", "", 1, 0)]],
    "orb": [[(R % "battle/magic1", "", 1, 0)]],
    "zap": [[(R % "battle/spell", PITCH(1.2), 1, 0)]],
    "jet": [[(SW % 2, PITCH(0.7), 1, 0)]],
    "vanish": [[(SW % 4, "areverse," + PITCH(1.1), 1, 0)]],
    "respawn": [[(R % "battle/magic1", PITCH(1.25), 1, 0)]],
    "fs_start": [[(R % "battle/spell", PITCH(0.85), 1, 0), (C % "gong_01", "", 0.7, 0), (B % "bang_03", "", 0.6, 0)]],
    "core_spawn": [[(R % "battle/magic1", PITCH(0.9), 1, 0), (C % "bell_02", "", 0.5, 0)]],
    "core_hit": [[(C % "glass_02", "", 1, 0), (R % "inventory/metal-ringing", "", 0.5, 0)]],
    "core_break": [[(C % "glass_05", "", 1, 0), (B % "bang_07", "", 0.8, 0), (C % "bell_03", "", 0.6, 40)]],
    "pickup": [[(R % "inventory/metal-small1", "", 1, 0)]],
    "eat": [[(R % "NPC/beetle/bite-small", PITCH(0.9), 1, 0)]],
    "go": [[(C % "gong_02", "", 1, 0), (H % 37, "", 0.5, 0)]],
    "game": [[(C % "gong_01", "", 1, 0), (B % "bang_03", "", 0.8, 0), (H % 36, VERB, 0.5, 0)]],
    "beep": [[(find_k("bong_001"), "", 1, 0)]],
    "tick": [[(find_k("tick_001"), "", 1, 0)]],
    "ui_move": [[(find_k("select_001"), "", 1, 0)]],
    "ui_ok": [[(find_k("confirmation_001"), "", 1, 0)]],
    "ui_back": [[(find_k("back_001"), "", 1, 0)]],
}
PEAK = {"hit_crit": 0.98, "ko": 0.98, "game": 0.95, "fs_start": 0.95, "explosion": 0.95}
os.makedirs(OUT, exist_ok=True)
for name, variants in S.items():
    for i, v in enumerate(variants):
        try:
            x = mix(v, PEAK.get(name, 0.85))
        except Exception as e:
            print("FAIL", name, e)
            break
        save(name if i == 0 else f"{name}_{i + 1}", x)
    print(name, len(variants))
