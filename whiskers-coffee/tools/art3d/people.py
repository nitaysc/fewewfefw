from sdf import *
from PIL import Image
PITCH = 14

def person(L, pose='stand', yaw=0.0, phase=0.0, bob=0.0, carry=False, sip=False):
    """L: dict of colours. returns scene, face anchor points (before yaw), pose info"""
    m = lambda c, n=6, s=0.6, **k: Mat(c, n, s, **k)
    skin, hair, top, top2, pants, shoe = m(L['skin'], 5, 0.3, hs=-0.015), m(L['hair'], 6, 0.6, spec=0.35), m(L['top'], 6, 0.6), m(L.get('top2', L['top']), 6, 0.6), m(L['pants'], 5, 0.55), m(L.get('shoes', '#4a2c1c'), 5, 0.5, spec=0.3)
    apron = m(L['apron'], 6, 0.55) if L.get('apron') else None
    INK = (70, 40, 32)
    skin.outline = (150, 82, 62); hair.outline = tuple(int(v * 0.55) for v in hair.ramp[0]); top.outline = INK; top2.outline = INK; pants.outline = INK; shoe.outline = INK
    sc = []
    hip = (0.3 if pose != 'sit' else 0.48) + bob
    R = 0.25
    hy = hip + 0.3 + R * 0.82
    if pose == 'sit':
        for s in (-1, 1):
            sc += [(cap((s * 0.055, hip, 0.0), (s * 0.06, hip + 0.02, 0.27), 0.054), pants), (cap((s * 0.06, hip + 0.02, 0.28), (s * 0.06, 0.1, 0.3), 0.046), pants),
                   (ell((s * 0.06, 0.06, 0.34), (0.05, 0.045, 0.075)), shoe)]
    else:
        for i, s in enumerate((-1, 1)):
            sw = np.sin(phase + i * np.pi) if pose == 'walk' else 0.0
            zz = sw * 0.11; lift = max(0.0, np.cos(phase + i * np.pi)) * 0.035 if pose == 'walk' else 0.0
            sc += [(cap((s * 0.055, hip, 0.0), (s * 0.057, 0.09 + lift, zz), 0.05), pants), (ell((s * 0.058, 0.042 + lift, zz + 0.03), (0.05, 0.042, 0.075)), shoe)]
    body = smin([rcone((0, hip + 0.01, 0), (0, hip + 0.24, 0), 0.125, 0.095), ell((0, hip + 0.05, 0), (0.13, 0.07, 0.1))], 0.04)
    sc.append((body, top))
    if apron:
        apron.outline = INK
        sc.append((inter(lambda p: body(p) - 0.012, rbox((0, hip + 0.08, 0.12), (0.1, 0.13, 0.12), 0.03)), apron))
    if carry: hands = ((0.16, 0.1), (0.16, 0.1))
    elif pose == 'walk': hands = ((np.sin(phase + np.pi) * 0.09, 0.0), (np.sin(phase) * 0.09, 0.0))
    elif pose == 'sit': hands = ((0.14, 0.06), (0.1, 0.25) if sip else (0.14, 0.06))
    else: hands = ((0, 0), (0, 0))
    for i, s in enumerate((-1, 1)):
        sh = (s * 0.11, hip + 0.21, 0)
        hz, hl = hands[i]
        hand = (s * (0.14 if not carry else 0.1), hip + 0.02 + hl, hz)
        sc += [(cap(sh, hand, 0.04), top2), (ell(hand, (0.037, 0.039, 0.037)), skin)]
    if L.get('scarf'): sc.append((torus((0, hip + 0.25, 0.0), 0.085, 0.04), m(L['scarf'], 5, 0.55, outline=INK)))
    sc.append((ell((0, hy, 0), (R, R * 0.93, R * 0.9)), skin))
    style = L.get('style', 'bob')
    hb = [ell((0, hy + 0.06, -0.03), (R * 1.07, R * 0.92, R * 0.98))]
    # side locks frame the face
    hb += [ell((s * R * 0.86, hy - 0.04, 0.03), (0.07, 0.16 if style in ('bob', 'long') else 0.08, 0.12)) for s in (-1, 1)] if style != 'short' else []
    if style == 'long': hb += [rbox((0, hy - 0.18, -0.1), (R * 0.95, 0.2, 0.08), 0.08)]
    if style == 'bob': hb += [ell((0, hy - 0.06, -0.08), (R * 1.08, R * 0.75, R * 0.9))]
    if style == 'bun': hb += [ell((0, hy + 0.34, -0.05), (0.11, 0.1, 0.11))]
    if style == 'messy': hb += [ell((x, hy + 0.26 - abs(x) * 0.4, z), (0.07, 0.05, 0.06)) for x, z in ((-0.08, 0.06), (0.02, 0.1), (0.1, 0.04), (-0.02, -0.06))]
    hairs = smin(hb, 0.04)
    face_cut = ell((0, hy - 0.09, R * 0.7), (R * 0.8, R * 0.72, R * 0.6))
    hairf = sub(hairs, face_cut)
    # uneven parted fringe
    bangs = smin([ell((x, hy + yy, R * 0.72), (rx, 0.06, 0.05)) for x, yy, rx in ((-0.13, 0.04, 0.06), (-0.06, 0.07, 0.065), (0.03, 0.08, 0.07), (0.12, 0.05, 0.06))], 0.025)
    sc.append((smin([hairf, bangs], 0.025), hair))
    if L.get('backpack'): sc.append((rbox((0, hip + 0.13, -0.15), (0.11, 0.13, 0.06), 0.045), m(L['backpack'], 5, 0.55, outline=INK)))
    anchors = {'eyeL': (-0.09, hy - 0.05, R * 0.88), 'eyeR': (0.09, hy - 0.05, R * 0.88), 'mouth': (0, hy - 0.14, R * 0.84),
               'blushL': (-0.15, hy - 0.11, R * 0.74), 'blushR': (0.15, hy - 0.11, R * 0.74)}
    return rot_all(sc, yaw), anchors

def rot_pt(p, yaw):
    c, s = np.cos(yaw), np.sin(yaw)
    x, y, z = p
    # same rotation as xform(rot_y=yaw) applied to points: inverse of the sdf transform
    return (x * c - z * s * -1 * -1 if False else x * c + z * s * 0 + 0, y, z) if False else (x * c - (-z) * 0, y, z)

def paint_face(img, anchors, size, ppu, center, yaw, L):
    """hand-drawn pixel face on top of the render"""
    from sdf import project
    c, s = np.cos(yaw), np.sin(yaw)
    def P(p):
        x, y, z = p
        # sdf xform(rot_y=yaw) samples f(p @ M), so the model is turned by the inverse rotation
        xr, zr = x * c + z * s, -x * s + z * c
        return project((xr, y, zr), size, ppu, center, PITCH, 0)
    a = img.copy()
    def put(x, y, col, al=1.0):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < a.shape[1] and 0 <= y < a.shape[0] and a[y, x, 3]:
            a[y, x, :3] = (np.array(col) * al + a[y, x, :3] * (1 - al)).astype(np.uint8)
    eye = L.get('eye', (64, 38, 34))
    for k in ('eyeL', 'eyeR'):
        x, y = P(anchors[k])
        if L.get('closed'):
            for dx in (-1, 0, 1): put(x + dx, y + (1 if dx else 0), (60, 36, 30))
            continue
        for dy in (-2, -1, 0, 1, 2):
            put(x, y + dy, eye); put(x + 1, y + dy, eye)
        put(x - 1, y - 1, eye); put(x + 2, y - 1, eye); put(x - 1, y, eye); put(x + 2, y, eye); put(x - 1, y + 1, eye); put(x + 2, y + 1, eye)
        put(x, y - 1, (255, 252, 244)); put(x, y - 2, (255, 252, 244)); put(x + 1, y + 1, tuple(min(255, int(v * 2.2)) for v in eye))
        put(x + 2, y + 2, tuple(min(255, int(v * 1.6)) for v in eye))
    for k in ('blushL', 'blushR'):
        x, y = P(anchors[k]); [put(x + dx, y, (242, 140, 140), 0.5) for dx in (-1, 0, 1)]
    x, y = P(anchors['mouth']); put(x, y, (150, 70, 60)); put(x + 1, y, (150, 70, 60), 0.6)
    if L.get('glasses'):
        for k in ('eyeL', 'eyeR'):
            x, y = P(anchors[k])
            for dx in range(-1, 3): put(x + dx, y - 3, (110, 80, 60)); put(x + dx, y + 3, (110, 80, 60))
            for dy in range(-2, 3): put(x - 2, y + dy, (110, 80, 60)); put(x + 3, y + dy, (110, 80, 60))
        xl, yl = P(anchors['eyeL']); xr, yr = P(anchors['eyeR'])
        for xx in range(int(xl) + 4, int(xr) - 1): put(xx, (yl + yr) / 2 - 1, (110, 80, 60))
    hx, hy_ = P(anchors['eyeL']); hx2, _ = P(anchors['eyeR'])
    cx = (hx + hx2) / 2 + 0.5
    for dx in range(-5, 5):
        yy = int(round(hy_ - 13 + (dx / 5) ** 2 * 2))
        xx = int(round(cx + dx))
        if 0 <= yy < a.shape[0] and 0 <= xx < a.shape[1] and a[yy, xx, 3] and L.get('shine', True):
            a[yy, xx, :3] = np.minimum(255, a[yy, xx, :3].astype(int) * 0.6 + 255 * 0.4).astype(np.uint8)
    return a

def render_person(L, pose='stand', yaw=0.0, w=56, h=92, ppu=60, **kw):
    sc, anchors = person(L, pose, yaw, **kw)
    cy = 0.66 if pose != 'sit' else 0.72
    size, center = (w, h), (0, cy, 0)
    img = render(sc, size, ppu=ppu, center=center, pitch=PITCH, yaw=0, light=(-0.6, 0.7, 0.8))
    if abs(np.arctan2(np.sin(yaw), np.cos(yaw))) > np.pi / 2: return img
    return paint_face(img, anchors, size, ppu, center, yaw, L)
