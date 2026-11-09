"""Draws the Rookwise launcher icons and splash screens into the Android project."""
import glob, os
from PIL import Image, ImageDraw

ROOK = [(10,8),(14,8),(14,11),(16.5,11),(16.5,8),(19.5,8),(19.5,11),(22,11),(22,8),(26,8),(26,15),(23,17.5),(23,24),(26,26),(26,29),(10,29),(10,26),(13,24),(13,17.5),(10,15)]
AMBER, INK, DARK = (243,179,61,255), (29,21,3,255), (20,23,29,255)

def rook(d, cx, cy, size, fill):
    s = size / 36.0
    d.polygon([(cx + (x - 18) * s, cy + (y - 18.5) * s) for x, y in ROOK], fill=fill)

def icon(n, shape):
    S = n * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if shape == 'round': d.ellipse([0, 0, S - 1, S - 1], fill=AMBER)
    elif shape == 'square': d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=AMBER)
    elif shape == 'bg': d.rectangle([0, 0, S, S], fill=AMBER)
    if shape != 'bg': rook(d, S / 2, S / 2, S * (0.62 if shape == 'fg' else 1.0), INK)
    return im.resize((n, n), Image.LANCZOS)

def splash(w, h):
    im = Image.new('RGBA', (w, h), DARK)
    d = ImageDraw.Draw(im)
    s = min(w, h) * 0.3
    d.rounded_rectangle([w / 2 - s / 2, h / 2 - s / 2, w / 2 + s / 2, h / 2 + s / 2], radius=s * 0.22, fill=AMBER)
    rook(d, w / 2, h / 2, s, INK)
    return im

here = os.path.dirname(os.path.abspath(__file__))
res = os.path.join(here, '..', 'android', 'app', 'src', 'main', 'res')
for f in glob.glob(os.path.join(res, '**', '*.png'), recursive=True):
    w, h = Image.open(f).size
    name = os.path.basename(f)
    if name == 'splash.png': splash(w, h).save(f)
    elif name == 'ic_launcher.png': icon(w, 'square').save(f)
    elif name == 'ic_launcher_round.png': icon(w, 'round').save(f)
    elif name == 'ic_launcher_foreground.png': icon(w, 'fg').save(f)
    elif name == 'ic_launcher_background.png': icon(w, 'bg').save(f)
icon(1024, 'square').save(os.path.join(here, '..', 'icon-1024.png'))
