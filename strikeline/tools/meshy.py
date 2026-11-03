#!/usr/bin/env python3
"""Meshy pipeline for the Strikeline fighters: generate -> texture -> rig -> animate.

The API key is read from MESHY_API_KEY (or the file named by MESHY_API_KEY_FILE).
It is never written anywhere. Task ids are kept in tools/meshy_tasks.json so a run
can be resumed; downloaded models go to assets/meshy/<fighter>/.

  python3 tools/meshy.py preview kai bruno nyx sol   # untextured meshes
  python3 tools/meshy.py refine  kai ...             # textured (PBR)
  python3 tools/meshy.py rig     kai ...
  python3 tools/meshy.py animate kai ...             # the fighting animation set
  python3 tools/meshy.py status
"""
import json
import os
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE = os.path.join(ROOT, "tools", "meshy_tasks.json")
OUT = os.path.join(ROOT, "assets", "meshy")
API = "https://api.meshy.ai/openapi"

STYLE = ("Stylized 3D fighting game hero in the style of a modern Nintendo platform fighter, full body, "
         "standing in A-pose, empty open hands holding nothing, clean readable silhouette, bold colors, "
         "high quality game-ready character, smooth hand-painted PBR materials.")

STYLE_ARMED = ("Stylized 3D fighting game hero in the style of a modern Nintendo platform fighter, full body, "
               "standing upright facing forward, arms held slightly away from the body, clean readable silhouette, bold colors, high quality game-ready character, "
               "smooth hand-painted PBR materials. The weapon is firmly gripped in a closed fist, fingers wrapped "
               "around the handle, held out to the side away from the body and legs.")

FIGHTERS = {
    "kai": "Young heroic ronin samurai. Crimson and black samurai armor with layered shoulder pads, chest "
           "plate and armored skirt over a dark fitted suit, long flowing red scarf, red headband, spiky black "
           "hair, handsome determined face. Katana sheathed in its scabbard at the left hip, both hands empty.",
    "bruno": "Huge muscular heavyweight brawler. Massive arms with big golden metal gauntlets, sleeveless "
             "orange and black fighter vest, black pants with golden belt, short dark beard, bald head, "
             "confident grin.",
    "nyx": "Agile female shadow ninja. Slim athletic build, purple and black stealth suit with violet "
           "armor accents, hooded ninja mask with glowing violet eyes, long purple scarf, wrapped forearms "
           "and shins.",
    "sol": "Young storm mage. Long flowing cyan and white robes with gold trim, short hooded cloak, glowing "
           "cyan rune patterns on the sleeves, silver hair, calm focused face, sandals.",
    # armed versions: the weapon is part of the model, gripped in the hand
    "kai_w": "Samurai warrior HOLDING A DRAWN KATANA SWORD IN HIS RIGHT HAND, closed fist around the hilt, blade "
             "pointing down and out to the side. Young heroic ronin in crimson and black samurai armor with layered "
             "shoulder pads and armored skirt, long red scarf, red headband, spiky black hair, determined face.",
    "nyx_w": "Female ninja HOLDING A SHORT KUNAI DAGGER IN EACH HAND, closed fists around the handles, blades "
             "pointing down. Agile shadow ninja with slim athletic build, purple and black stealth suit with violet "
             "armor accents, hooded ninja mask with glowing violet eyes, long purple scarf.",
    "sol_w": "Mage HOLDING A LONG STAFF IN HIS RIGHT HAND, closed fist around the shaft, the staff topped with a "
             "glowing cyan orb inside a gold crescent. Young storm mage in long flowing cyan and white robes with "
             "gold trim, short hooded cloak, glowing cyan runes on the sleeves, silver hair, calm focused face.",
}

# Meshy animation library ids (https://api.meshy.ai/web/public/animations/resources)
ANIMS = {
    "common": [89, 191, 192, 215, 207, 213, 178, 7, 158, 156],
    "common2": [138, 187, 100, 86, 94, 0, -1, -2],
    "kai": [219, 221, 92, 105, 102, 147, 240, 242],
    "bruno": [193, 194, 214, 206, 211, 127, 198, 88],
    "nyx": [216, 218, 208, 91, 93, 212, 217, 90],
    "sol": [125, 126, 129, 130, 131, 132, 127, 142],
    # movement: backflip (double jump), jump, falling, ledge hang, crouch, victory, jump with arms open
    "move": [452, 466, 502, 478, 524, 412, 461],
}


def base(n: str) -> str:
    return n.split("_")[0]


def key() -> str:
    k = os.environ.get("MESHY_API_KEY", "")
    f = os.environ.get("MESHY_API_KEY_FILE", "")
    if not k and f and os.path.exists(f):
        k = open(f).read().strip()
    if not k:
        sys.exit("Set MESHY_API_KEY (or MESHY_API_KEY_FILE).")
    return k


def req(method: str, path: str, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method,
                               headers={"Authorization": "Bearer " + key(), "Content-Type": "application/json"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(r, timeout=60) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            if e.code == 429 or e.code >= 500:
                time.sleep(5 * (attempt + 1))
                continue
            sys.exit(f"{method} {path} -> {e.code}: {msg}")
        except urllib.error.URLError:
            time.sleep(5)
    sys.exit(f"{method} {path} failed")


def load_state() -> dict:
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


def save_state(s: dict) -> None:
    json.dump(s, open(STATE, "w"), indent=2, sort_keys=True)


def wait(path: str, every=10, label=""):
    while True:
        t = req("GET", path)
        st = t.get("status")
        if st in ("SUCCEEDED", "FAILED", "CANCELED", "EXPIRED"):
            print(f"  {label}: {st}", flush=True)
            return t
        print(f"  {label}: {st} {t.get('progress', 0)}%", flush=True)
        time.sleep(every)


def download(url: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with urllib.request.urlopen(url, timeout=300) as r, open(dest, "wb") as f:
        f.write(r.read())
    print("  saved", os.path.relpath(dest, ROOT), os.path.getsize(dest) // 1024, "KB")


def preview(names):
    s = load_state()
    for n in names:
        body = {"mode": "preview", "prompt": ((FIGHTERS[n] + " " + STYLE_ARMED) if n.endswith("_w") else (STYLE + " " + FIGHTERS[n]))[:800], "ai_model": "meshy-7.1",
                "pose_mode": "" if n.endswith("_w") else "a-pose", "target_formats": ["glb"], "should_remesh": True, "topology": "triangle",
                "target_polycount": 40000}
        r = req("POST", "/v2/text-to-3d", body)
        s.setdefault(n, {})["preview"] = r["result"]
        save_state(s)
        print(n, "preview task", r["result"])
    for n in names:
        t = wait("/v2/text-to-3d/" + s[n]["preview"], label=n + " preview")
        if t["status"] == "SUCCEEDED":
            download(t["thumbnail_url"], os.path.join(OUT, n, "preview_thumb.png"))


def refine(names):
    s = load_state()
    for n in names:
        r = req("POST", "/v2/text-to-3d", {"mode": "refine", "preview_task_id": s[n]["preview"], "enable_pbr": True,
                                          "texture_resolution": "2k", "target_formats": ["glb"]})
        s[n]["refine"] = r["result"]
        save_state(s)
        print(n, "refine task", r["result"])
    for n in names:
        t = wait("/v2/text-to-3d/" + s[n]["refine"], label=n + " refine")
        if t["status"] == "SUCCEEDED":
            download(t["model_urls"]["glb"], os.path.join(OUT, n, "model.glb"))
            download(t["thumbnail_url"], os.path.join(OUT, n, "thumb.png"))


def rig(names):
    s = load_state()
    for n in names:
        r = req("POST", "/v1/rigging", {"input_task_id": s[n]["refine"], "height_meters": 1.75 if base(n) != "bruno" else 1.95})
        s[n]["rig"] = r["result"]
        save_state(s)
        print(n, "rig task", r["result"])
    for n in names:
        t = wait("/v1/rigging/" + s[n]["rig"], label=n + " rig")
        if t["status"] == "SUCCEEDED":
            download(t["result"]["rigged_character_glb_url"], os.path.join(OUT, n, "rigged.glb"))
        else:
            print(json.dumps(t.get("task_error"), indent=1))


def animate(names):
    s = load_state()
    for n in names:
        s[n].setdefault("anims", {})
    # wait for / download whatever is already running, then submit the rest
    for rnd in range(4):
        for n in names:
            for group, tid in s[n]["anims"].items():
                dest = os.path.join(OUT, n, f"anim_{group}.glb")
                if os.path.exists(dest):
                    continue
                t = wait("/v1/animations/" + tid, label=f"{n} {group}")
                if t["status"] == "SUCCEEDED":
                    download(t["result"]["animation_glb_url"], dest)
                else:
                    print(json.dumps(t.get("task_error"), indent=1))
        pending = [(n, g) for n in names for g in ("common", "common2", base(n), "move") if g not in s[n]["anims"]]
        if not pending:
            break
        for n, group in pending[:8]:
            ids = [i for i in ANIMS[group] if i >= 0]
            r = req("POST", "/v1/animations", {"rig_task_id": s[n]["rig"], "action_ids": ids})
            s[n]["anims"][group] = r["result"]
            save_state(s)
            print(n, group, "animation task", r["result"])
    # the walk/run clips that came with the rig
    for n in names:
        dest = os.path.join(OUT, n, "anim_run.glb")
        if not os.path.exists(dest):
            t = req("GET", "/v1/rigging/" + s[n]["rig"])
            ba = (t.get("result") or {}).get("basic_animations") or {}
            if ba.get("running_glb_url"):
                download(ba["running_glb_url"], dest)


def anim_test(names):
    """One quick clip (3 credits) to check how a new rig deforms: anim_test <name> <action_id>."""
    s = load_state()
    n, aid = names[0], int(names[1])
    r = req("POST", "/v1/animations", {"rig_task_id": s[n]["rig"], "action_id": aid})
    t = wait("/v1/animations/" + r["result"], label=f"{n} test {aid}")
    if t["status"] == "SUCCEEDED":
        download(t["result"]["animation_glb_url"], os.path.join(OUT, n, f"test_{aid}.glb"))


def status():
    print(json.dumps(load_state(), indent=1))
    print(req("GET", "/v1/balance"))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    names = sys.argv[2:] or list(FIGHTERS)
    {"preview": preview, "refine": refine, "rig": rig, "animate": animate, "anim_test": anim_test, "status": lambda _=None: status()}[cmd](names)
