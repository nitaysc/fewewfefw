from sdf import *
from PIL import Image
CPITCH = 20
COATS = {
    'orange': dict(base='#e8954a', light='#fbe3c4', patch=None, eye=(90, 140, 50)),
    'calico': dict(base='#f4ede0', light='#ffffff', patch=['#d98a3d', '#3a3236'], eye=(150, 110, 40)),
    'black': dict(base='#3a3844', light='#55525f', patch=None, eye=(200, 210, 80)),
    'grey': dict(base='#a7a9b2', light='#e4e5ea', patch=None, eye=(70, 140, 190)),
    'tux': dict(base='#34323c', light='#f4f1ea', patch=None, eye=(150, 200, 90)),
    'cream': dict(base='#f3e1c0', light='#fff6e6', patch=None, eye=(110, 90, 50)),
    'siamese': dict(base='#efe2cc', light='#fbf3e6', patch=None, points='#5a3e2e', eye=(80, 140, 210)),
    'tabby': dict(base='#a8805a', light='#ead8bd', patch=None, stripes='#6e4a30', eye=(120, 160, 60)),
}
COATS['tuxedo'] = COATS['tux']
def cat(coat, pose='sit', phase=0.0, breathe=0.0, tail=0.0):
    K = COATS[coat]
    tex = None
    if K.get('stripes'): tex = lambda p, n: -0.16 * (np.sin(p[:, 0] * 40 + p[:, 1] * 12) > 0.55)
    fur = Mat(K['base'], 6, 0.5, outline=tuple(int(v * 0.45) for v in ramp(K['base'])[0]), tex=tex)
    lite = Mat(K['light'], 5, 0.35, outline=(90, 60, 50))
    pink = Mat('#f0a8b0', 4, 0.3, outline=(120, 60, 60))
    sc = []
    if pose == 'sit':
        body = smin([ell((0, 0.17, -0.02), (0.15, 0.17, 0.14)), ell((0, 0.07, 0.0), (0.17, 0.08, 0.16))], 0.05)
        head = (0, 0.4, 0.05)
        body = smin([ell((0, 0.17 + breathe, -0.02), (0.15, 0.17 + breathe, 0.14)), ell((0, 0.07, 0.0), (0.17, 0.08, 0.16))], 0.05)
        tip = (0.24 + tail * 0.05, 0.06 + abs(tail) * 0.06, 0.12)
        tail = smin([cap((0.1, 0.03, -0.12), (0.25, 0.04, -0.02), 0.04), cap((0.25, 0.04, -0.02), tip, 0.036)], 0.03)
        paws = [ell((s * 0.06, 0.03, 0.13), (0.045, 0.035, 0.06)) for s in (-1, 1)]
    elif pose == 'loaf':
        body = smin([ell((0, 0.12, -0.04), (0.2, 0.12 + breathe, 0.17))], 0.05)
        head = (0, 0.2, 0.12)
        tail = cap((0.17, 0.04, -0.12), (0.12, 0.04, 0.12), 0.04)
        paws = []
    else:  # walk (side on, facing right)
        body = ell((0, 0.19, 0), (0.22, 0.11, 0.1))
        head = (0.25, 0.29, 0.0)
        tail = smin([cap((-0.2, 0.22, 0), (-0.3, 0.38, 0), 0.035), cap((-0.3, 0.38, 0), (-0.26, 0.48, 0), 0.032)], 0.03)
        sw = [np.sin(phase), np.sin(phase + np.pi), np.sin(phase + np.pi), np.sin(phase)]
        paws = [cap((x, 0.15, z), (x + s_ * 0.06, 0.02 + max(0, -s_) * 0.03, z), 0.035) for (x, z), s_ in zip(((0.14, 0.05), (0.12, -0.05), (-0.14, 0.05), (-0.15, -0.05)), sw)]
        body = ell((0, 0.19 + abs(np.cos(phase)) * 0.01, 0), (0.22, 0.11, 0.1))
    hx, hy, hz = head
    headf = smin([ell(head, (0.135, 0.115, 0.115)), ell((hx, hy - 0.04, hz + 0.05), (0.08, 0.055, 0.06))], 0.03)
    ears = [rcone((hx + s * 0.075, hy + 0.06, hz - 0.01), (hx + s * 0.1, hy + 0.17, hz - 0.02), 0.045, 0.008) for s in (-1, 1)]
    allfur = smin([body, headf, tail] + paws + ears, 0.02)
    sc.append((allfur, fur))
    # belly and muzzle in the light colour
    sc.append((inter(lambda p: allfur(p) - 0.006, ell((hx, hy - 0.06, hz + 0.1), (0.075, 0.05, 0.06))), lite))
    if pose == 'sit': sc.append((inter(lambda p: allfur(p) - 0.006, ell((0, 0.14, 0.12), (0.08, 0.13, 0.06))), lite))
    if coat == 'tux': sc += [(inter(lambda p: allfur(p) - 0.006, ell((s * 0.06, 0.03, 0.15), (0.05, 0.05, 0.05))), lite) for s in (-1, 1)]
    if K['patch']:
        sc.append((inter(lambda p: allfur(p) - 0.006, ell((0.08, 0.3, -0.06), (0.14, 0.2, 0.14))), Mat(K['patch'][0], 6, 0.5, outline=(90, 50, 30))))
        sc.append((inter(lambda p: allfur(p) - 0.006, ell((hx - 0.09, hy + 0.08, hz), (0.08, 0.08, 0.1))), Mat(K['patch'][1], 5, 0.5, outline=(30, 25, 28))))
    if K.get('points'):
        pm = Mat(K['points'], 5, 0.5, outline=(40, 28, 22))
        sc.append((inter(lambda p: allfur(p) - 0.006, ell((hx, hy - 0.03, hz + 0.08), (0.09, 0.07, 0.07))), pm))
        for e in ears: sc.append((lambda p, e=e: e(p) - 0.003, pm))
    for s in (-1, 1): sc.append((inter(lambda p, s=s: ears[(s + 1) // 2](p) - 0.004, ell((hx + s * 0.08, hy + 0.1, hz + 0.03), (0.03, 0.06, 0.02))), pink))
    return sc, head

def render_cat(coat, pose='sit', w=None, h=None, ppu=72, phase=0.0, breathe=0.0, tail=0.0, blink=False):
    w = w or (60 if pose == 'walk' else 48); h = h or (64 if pose == 'walk' else 58)
    sc, head = cat(coat, pose, phase, breathe, tail)
    center = (0.0, 0.3, 0)
    size = (w, h)
    img = render(sc, size, ppu=ppu, center=center, pitch=CPITCH, yaw=0, light=(-0.6, 0.75, 0.75))
    a = img.copy()
    hx, hy, hz = head
    def put(x, y, col, al=1.0):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < w and 0 <= y < h and a[y, x, 3]: a[y, x, :3] = (np.array(col) * al + a[y, x, :3] * (1 - al)).astype(np.uint8)
    eye = COATS[coat]['eye']
    eyes = [(hx + s * 0.055, hy + 0.0, hz + 0.1) for s in (-1, 1)]
    for e in eyes:
        x, y = project(e, size, ppu, center, CPITCH, 0)
        if pose == 'loaf' or blink:
            for dx in (-1, 0, 1): put(x + dx, y + (0 if dx else 1), (50, 30, 26))
            continue
        for dy in (-1, 0, 1): put(x, y + dy, eye); put(x + 1, y + dy, eye)
        put(x + 1, y, (30, 20, 18)); put(x + 1, y + 1, (30, 20, 18)); put(x, y - 1, (255, 255, 240))
    nx, ny = project((hx, hy - 0.045, hz + 0.115), size, ppu, center, CPITCH, 0)
    put(nx, ny, (230, 120, 130)); put(nx + 1, ny, (230, 120, 130))
    return a
