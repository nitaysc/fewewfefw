"""Builds www/img/av/*.webp: the opponents' and the coach's pictures.

The art is Microsoft's Fluent Emoji (3D style), MIT licence:
https://github.com/microsoft/fluentui-emoji . Files are fetched once into tools/.cache/avatars,
checked against tools/avatars.lock (SHA-256), scaled to 192 px and saved as WebP.

Needs python3 with Pillow.   Run: python3 tools/make_avatars.py
"""
import hashlib, json, os, sys, urllib.parse, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache', 'avatars')
LOCK = os.path.join(HERE, 'avatars.lock')
OUT = os.path.join(HERE, '..', 'www', 'img', 'av')
BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/%s/3D/%s_3d.png'
SIZE = 192

# file name in the app -> Fluent Emoji name
ART = {
    'coach': 'Owl',
    'chick': 'Hatching chick',
    'mouse': 'Mouse face',
    'fox': 'Fox',
    'cat': 'Cat face',
    'bear': 'Bear',
    'penguin': 'Penguin',
    'lion': 'Lion',
    'wolf': 'Wolf',
    'robot': 'Robot',
}


def main():
    lock = json.load(open(LOCK)) if os.path.exists(LOCK) else {}
    new_lock = {}
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    for name, emoji in ART.items():
        slug = emoji.lower().replace(' ', '_')
        path = os.path.join(CACHE, slug + '.png')
        if not os.path.exists(path):
            url = BASE % (urllib.parse.quote(emoji), slug)
            with urllib.request.urlopen(url, timeout=60) as r, open(path, 'wb') as f:
                f.write(r.read())
        data = open(path, 'rb').read()
        sha = hashlib.sha256(data).hexdigest()
        if name in lock and lock[name] != sha:
            sys.exit('checksum mismatch for ' + name)
        new_lock[name] = sha
        im = Image.open(path).convert('RGBA').resize((SIZE, SIZE), Image.LANCZOS)
        out = os.path.join(OUT, name + '.webp')
        im.save(out, 'WEBP', quality=90, method=6)
        print('%-8s %5.1f KB' % (name, os.path.getsize(out) / 1024))
    json.dump(new_lock, open(LOCK, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main()
