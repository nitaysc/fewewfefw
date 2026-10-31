# Downloads free CC0 models and textures from Poly Haven (polyhaven.com) into toy-workshop/assets.
# Runs on GitHub Actions (the development sandbox can't reach polyhaven.com).
# assets/wanted.json: {"models": [...ids], "textures": [...ids], "hdris": [...ids], "res": "1k"}
import json, os, sys, urllib.request

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
API = 'https://api.polyhaven.com'
UA = {'User-Agent': 'TinyToyworks-asset-fetch/1.0'}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()

def save(url, path):
    if os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = get(url)
    open(path, 'wb').write(data)
    print('  saved', path, len(data))

def catalog():
    for t in ['models', 'textures', 'hdris']:
        d = json.loads(get(f'{API}/assets?t={t}'))
        slim = {k: {'name': v.get('name'), 'cat': v.get('categories'), 'tags': v.get('tags')} for k, v in d.items()}
        json.dump(slim, open(os.path.join(ROOT, f'catalog_{t}.json'), 'w'), indent=0, sort_keys=True)
        print(t, len(slim))

def model(mid, res):
    f = json.loads(get(f'{API}/files/{mid}'))
    g = f['gltf'][res]['gltf']
    base = os.path.join(ROOT, 'models', mid)
    save(g['url'], os.path.join(base, os.path.basename(g['url'])))
    for rel, inc in g.get('include', {}).items():
        save(inc['url'], os.path.join(base, rel))

def texture(tid, res):
    f = json.loads(get(f'{API}/files/{tid}'))
    base = os.path.join(ROOT, 'textures', tid)
    for key, name in [('Diffuse', 'albedo'), ('nor_gl', 'normal'), ('Rough', 'rough'), ('AO', 'ao')]:
        if key in f and res in f[key]:
            save(f[key][res]['jpg']['url'], os.path.join(base, name + '.jpg'))

def hdri(hid, res):
    f = json.loads(get(f'{API}/files/{hid}'))
    save(f['hdri'][res]['hdr']['url'], os.path.join(ROOT, 'hdris', hid + '.hdr'))

if __name__ == '__main__':
    os.makedirs(ROOT, exist_ok=True)
    catalog()
    wp = os.path.join(ROOT, 'wanted.json')
    w = json.load(open(wp)) if os.path.exists(wp) else {}
    res = w.get('res', '1k')
    for m in w.get('models', []):
        print('model', m); model(m, res)
    for t in w.get('textures', []):
        print('texture', t); texture(t, res)
    for h in w.get('hdris', []):
        print('hdri', h); hdri(h, '1k')
