"""Downloads the CC0 (public domain) photo-scanned island assets from Poly Haven
(https://polyhaven.com) into a cache folder: island trees, coastal cliffs and rocks
as glTF, and ground textures. tools/build_island_assets.py then shrinks them for phones.

Run: python3 tools/fetch_island_assets.py [cache_dir]   (default: ./build/polyhaven)
"""
import json
import os
import sys
import urllib.request

UA = {'User-Agent': 'galleon-asset-fetch/1.0 (Godot game; CC0 assets)'}
MODELS = ['island_tree_01', 'island_tree_02', 'island_tree_03',
          'coastal_cliff_01', 'coastal_cliff_02', 'coast_rocks_01', 'coast_rocks_05']
# ground textures: diffuse + OpenGL normal + AO/rough/metal
TEXTURES = ['coast_sand_01', 'damp_beach_sand', 'forest_leaves_02', 'aerial_rocks_02', 'coral_ground_02']
RES = '1k'


def get(url, path=None):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    if path is None:
        return data
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)


def main():
    out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'build', 'polyhaven'))
    for a in MODELS:
        files = json.loads(get(f'https://api.polyhaven.com/files/{a}'))
        g = files['gltf'][RES]['gltf']
        if os.path.exists(os.path.join(out, a, f'{a}.gltf')):
            print('have', a)
            continue
        for rel, info in g['include'].items():
            get(info['url'], os.path.join(out, a, rel))
        get(g['url'], os.path.join(out, a, f'{a}.gltf'))
        print('model', a)
    for t in TEXTURES:
        files = json.loads(get(f'https://api.polyhaven.com/files/{t}'))
        for kind, key in (('diff', 'Diffuse'), ('nor_gl', 'nor_gl'), ('arm', 'arm')):
            if key not in files:
                continue
            f = files[key][RES]['jpg']
            dst = os.path.join(out, 'textures', f'{t}_{kind}.jpg')
            if not os.path.exists(dst):
                get(f['url'], dst)
        print('texture', t)
    print('cached in', out)


if __name__ == '__main__':
    main()
