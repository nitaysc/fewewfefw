"""
Prepare the CC-BY "KTM Dirt Bike" (OCTbuilds, Sketchfab) for Roost MX.

The source glTF is merged by material (both tyres in one mesh, forks + bars + swingarm in
one aluminium mesh), so nothing can move. This script splits every mesh into connected
pieces, classifies each piece into a rig part, re-pivots the parts at their joints and
writes one GLB with real-world scale and the hierarchy the game animates:

  RoostBike (root at ground level under the bike's centre of mass)
    Chassis                 frame, engine, tank, plastics, seat, exhaust, radiators
    SteerAssembly           pivot on the steering axis: clamps, bars, upper fork, fender, plate
      ForkLowers            slides along the fork axis
        FrontWheel          pivot at the front axle, spins about local X
    Swingarm                pivot at the swingarm pivot: arm, chain guide, rear brake
    RearWheel               pivot at the rear axle

Also writes bike_rig.json with the measured geometry (axles, radii, steering axis, pivot).

  python3 prepare_bike.py <source scene.gltf> <out.glb> [--debug-colors] [--tex 2048]
"""
import json, struct, sys, os, io, math
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
DEBUG = '--debug-colors' in sys.argv
TEX = int(sys.argv[sys.argv.index('--tex') + 1]) if '--tex' in sys.argv else 2048
base = os.path.dirname(src)
g = json.load(open(src))
binb = open(os.path.join(base, g['buffers'][0]['uri']), 'rb').read()

def accessor(i):
    a = g['accessors'][i]; bv = g['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dt = {5126: '<f4', 5123: '<u2', 5125: '<u4', 5121: 'u1'}[a['componentType']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    st = bv.get('byteStride', 0); size = np.dtype(dt).itemsize
    if st and st != n * size:
        raw = np.frombuffer(binb, np.uint8, a['count'] * st, off).reshape(a['count'], st)
        return raw[:, :n * size].copy().view(dt).reshape(-1, n)
    return np.frombuffer(binb, dt, a['count'] * n, off).reshape(-1, n).astype(np.float64 if dt == '<f4' else np.int64)

def node_matrix(nd):
    if 'matrix' in nd: return np.array(nd['matrix'], float).reshape(4, 4).T
    T = np.eye(4); R = np.eye(4); S = np.eye(4)
    if 'translation' in nd: T[:3, 3] = nd['translation']
    if 'rotation' in nd:
        x, y, z, w = nd['rotation']
        R[:3, :3] = [[1 - 2*(y*y + z*z), 2*(x*y - z*w), 2*(x*z + y*w)],
                     [2*(x*y + z*w), 1 - 2*(x*x + z*z), 2*(y*z - x*w)],
                     [2*(x*z - y*w), 2*(y*z + x*w), 1 - 2*(x*x + y*y)]]
    if 'scale' in nd: S[:3, :3] = np.diag(nd['scale'])
    return T @ R @ S

# ---- flatten to world-space primitives --------------------------------------------------
prims = []   # dict(mat, pos, nrm, uv, idx)
def walk(i, M):
    nd = g['nodes'][i]; M = M @ node_matrix(nd)
    if 'mesh' in nd:
        for p in g['meshes'][nd['mesh']]['primitives']:
            at = p['attributes']
            v = accessor(at['POSITION'])
            w = (M @ np.c_[v, np.ones(len(v))].T).T[:, :3]
            nm = accessor(at['NORMAL']) if 'NORMAL' in at else np.zeros_like(v)
            N = np.linalg.inv(M[:3, :3]).T
            nw = (N @ nm.T).T; nw /= np.maximum(1e-9, np.linalg.norm(nw, axis=1))[:, None]
            uv = accessor(at['TEXCOORD_0']) if 'TEXCOORD_0' in at else np.zeros((len(v), 2))
            idx = accessor(p['indices']).reshape(-1) if 'indices' in p else np.arange(len(v))
            prims.append(dict(mat=p['material'], pos=w, nrm=nw, uv=uv, idx=idx.reshape(-1, 3)))
    for c in nd.get('children', []): walk(c, M)
for r in g['scenes'][g.get('scene', 0)]['nodes']: walk(r, np.eye(4))
matname = lambda i: g['materials'][i]['name']

# ---- measure the bike from its tyres ------------------------------------------------------
def tyre_pts():
    t = next(p for p in prims if matname(p['mat']) == 'Tyres')
    return t['pos']
tp = tyre_pts()
front_pts, rear_pts = tp[tp[:, 2] > 0], tp[tp[:, 2] < 0]
def wheel(pts):
    lo, hi = pts.min(0), pts.max(0)
    return (lo + hi) / 2, (hi[1] - lo[1]) / 2
def pca(pts):
    c = pts.mean(0); _, sv, vt = np.linalg.svd(pts - c, full_matrices=False)
    return c, vt, sv
RA, RR = wheel(rear_pts)
FA, RF = wheel(front_pts)
xc = RA[0]                                             # bike centre plane
ground = min(front_pts[:, 1].min(), rear_pts[:, 1].min())

# ---- steering geometry ----------------------------------------------------------------------
# The model was built with the bars turned. Steering about a raked axis d tilts the wheel's
# axle direction to n = cos(t) X + sin(t) (d x X), so the wheel's own orientation gives the
# rake, the steer angle and (with the bike's centre plane) the axis position.
_, vtw, _ = pca(front_pts); wheel_n = vtw[2] * np.sign(vtw[2][0])
d = np.array([0.0, -wheel_n[2], wheel_n[1]]); d *= np.sign(d[1]); d /= np.linalg.norm(d)   # steering axis (sagittal)
f = np.array([0.0, d[2], -d[1]]) * -1; f *= np.sign(f[2])                                 # forward, perpendicular to it
def rot_about(axis, ang):
    x, y, z = axis; c, s_ = math.cos(ang), math.sin(ang); C1 = 1 - c
    return np.array([[c + x*x*C1, x*y*C1 - z*s_, x*z*C1 + y*s_], [y*x*C1 + z*s_, c + y*y*C1, y*z*C1 - x*s_], [z*x*C1 - y*s_, z*y*C1 + x*s_, c + z*z*C1]])
X = np.array([1.0, 0, 0])
def proj(v): return v - (v @ d) * d
theta = math.atan2(d @ np.cross(X, wheel_n), X @ wheel_n)
Rt = rot_about(d, theta)
side = Rt @ f                                    # where the "forward" offset points after steering
r_ax = (FA[0] - xc) / side[0] if abs(side[0]) > 0.05 else 0.05
A = FA - r_ax * side                             # foot of the axle on the steering axis
rake = math.degrees(math.atan2(-d[2], d[1]))
print(f'front axle {FA.round(3)} r {RF:.3f}  rear axle {RA.round(3)} r {RR:.3f}  rake {rake:.1f}  steered {math.degrees(theta):.1f} deg  axle ahead of axis {r_ax:.3f} m')

def unsteer(pts): return A + (pts - A) @ rot_about(d, -theta).T

# ---- connected pieces ---------------------------------------------------------------------
def islands(p):
    key = np.round(p['pos'] / 2e-4).astype(np.int64)
    _, weld = np.unique(key, axis=0, return_inverse=True)
    weld = weld.reshape(-1)
    parent = np.arange(weld.max() + 1)
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for tri in weld[p['idx']]:
        r0 = find(tri[0]); parent[find(tri[1])] = r0; parent[find(tri[2])] = r0
    roots = np.array([find(x) for x in range(len(parent))])
    return roots[weld[p['idx'][:, 0]]]

pivot = np.array([xc, RA[1] + 0.13, RA[2] + 0.585])     # swingarm pivot (typical MX geometry)
PARTS = ['Chassis', 'SteerAssembly', 'ForkLowers', 'FrontWheel', 'Swingarm', 'RearWheel', 'Removed']

def is_front_end(c, lo, hi):
    ahead = (c - A) @ f
    if np.linalg.norm(c - FA) < RF + 0.02 and abs((c - FA) @ wheel_n) < 0.11: return True    # wheel, hub, disc
    if ahead > -0.03 and c[1] > FA[1] - 0.05 and c[2] > FA[2] - 0.45: return True           # fork, fender, plate
    if c[1] > FA[1] + 0.78 and c[2] > FA[2] - 0.75 and ahead > -0.35: return True           # bars, guards, levers
    return False

def classify_unsteered(c, lo, hi):
    span = hi - lo
    if abs(c[0] - xc) < 0.10 and np.hypot(c[1] - FA[1], c[2] - FA[2]) < RF + 0.01 and max(span[1], span[2]) < 2 * RF + 0.06:
        return 'FrontWheel'
    along = (c - FA) @ d
    dist = np.linalg.norm(proj(c - FA) - ((c - FA) @ f) * f * 0) if False else abs((c - FA) @ f)
    if along < 0.40 and dist < 0.09 and lo[1] < FA[1] + 0.2:
        return 'ForkLowers'
    return 'SteerAssembly'

def classify_rest(c, lo, hi):
    span = hi - lo
    if abs(c[0] - RA[0]) < 0.11 and np.hypot(c[1] - RA[1], c[2] - RA[2]) < RR + 0.01 and max(span[1], span[2]) < 2 * RR + 0.06:
        return 'RearWheel'
    if lo[1] < ground + 0.07 and RA[2] + RR * 0.8 < c[2] < FA[2] - RF * 0.8:
        return 'Removed'                                                    # kickstand
    if RA[2] - 0.08 < c[2] < pivot[2] + 0.06 and c[1] < pivot[1] + 0.10 and hi[1] < pivot[1] + 0.22:
        return 'Swingarm'
    return 'Chassis'

part_tris = {k: [] for k in PARTS}
for pi, p in enumerate(prims):
    roots = islands(p)
    moved = np.zeros(len(p['pos']), bool)
    for r in np.unique(roots):
        tris = np.nonzero(roots == r)[0]
        used = np.unique(p['idx'][tris])
        vs = p['pos'][used]; lo, hi = vs.min(0), vs.max(0); c = (lo + hi) / 2
        if is_front_end(c, lo, hi):
            p['pos'][used] = unsteer(p['pos'][used]); p['nrm'][used] = p['nrm'][used] @ rot_about(d, -theta).T
            vs = p['pos'][used]; lo, hi = vs.min(0), vs.max(0)
            part = classify_unsteered((lo + hi) / 2, lo, hi)
        else:
            part = classify_rest(c, lo, hi)
        part_tris[part].append((pi, tris))
FA = unsteer(FA[None])[0]
for k in PARTS: print(f'{k:14s}', sum(len(t) for _, t in part_tris[k]), 'tris')
fork_axis = d; fwd_perp = f

# ---- pivots and hierarchy (world space, metres) ---------------------------------------------
steer_pivot = A + d * ((FA + d * 0.80 - A) @ d)    # on the steering axis, at clamp height
pivots = {
    'Chassis': np.zeros(3), 'SteerAssembly': steer_pivot, 'ForkLowers': FA, 'FrontWheel': FA,
    'Swingarm': pivot, 'RearWheel': RA,
}
parents = {'SteerAssembly': 'Chassis', 'ForkLowers': 'SteerAssembly', 'FrontWheel': 'ForkLowers',
           'Swingarm': 'Chassis', 'RearWheel': 'Chassis'}

# root: on the ground, between the axles (game places it under the physics CoM)
origin = np.array([0.0, ground, (FA[2] + RA[2]) / 2])

# ---- write GLB --------------------------------------------------------------------------------
buf = bytearray(); views = []; accs = []
def add_view(data, target=None):
    while len(buf) % 4: buf.append(0)
    off = len(buf); buf.extend(data)
    v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
    if target: v['target'] = target
    views.append(v); return len(views) - 1
def add_acc(arr, typ, comp, target=None, minmax=False):
    arr = np.ascontiguousarray(arr)
    vi = add_view(arr.tobytes(), target)
    a = {'bufferView': vi, 'componentType': comp, 'count': int(arr.shape[0]), 'type': typ}
    if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
    accs.append(a); return len(accs) - 1

out_nodes, out_meshes = [], []
debug_cols = {'Chassis': [0.6, 0.6, 0.6], 'SteerAssembly': [0.1, 0.4, 1], 'ForkLowers': [0, 1, 1], 'FrontWheel': [1, 0.2, 0.2],
              'Swingarm': [1, 1, 0], 'RearWheel': [1, 0.5, 0], 'Removed': [1, 0, 1]}
materials = json.loads(json.dumps(g['materials']))
if DEBUG:
    materials = [{'name': k, 'pbrMetallicRoughness': {'baseColorFactor': debug_cols[k] + [1], 'metallicFactor': 0, 'roughnessFactor': 0.8}} for k in PARTS]
node_index = {}
for part in PARTS:
    if part == 'Removed' and not DEBUG: continue
    world_pivot = pivots.get(part, np.zeros(3))
    by_mat = {}
    for pi, tris in part_tris[part]:
        by_mat.setdefault(prims[pi]['mat'] if not DEBUG else PARTS.index(part), []).append((pi, tris))
    prim_list = []
    for mat, items in by_mat.items():
        P, Nn, U, I = [], [], [], []; base_i = 0
        for pi, tris in items:
            p = prims[pi]; used = np.unique(p['idx'][tris]); remap = -np.ones(len(p['pos']), np.int64); remap[used] = np.arange(len(used))
            P.append(p['pos'][used] - world_pivot); Nn.append(p['nrm'][used]); U.append(p['uv'][used])
            I.append(remap[p['idx'][tris]].reshape(-1) + base_i); base_i += len(used)
        P = np.concatenate(P).astype('<f4'); Nn = np.concatenate(Nn).astype('<f4'); U = np.concatenate(U).astype('<f4'); I = np.concatenate(I).astype('<u4')
        prim_list.append({'attributes': {'POSITION': add_acc(P, 'VEC3', 5126, 34962, True), 'NORMAL': add_acc(Nn, 'VEC3', 5126, 34962),
                                         'TEXCOORD_0': add_acc(U, 'VEC2', 5126, 34962)},
                          'indices': add_acc(I, 'SCALAR', 5125, 34963), 'material': int(mat)})
    node = {'name': part}
    if prim_list:
        out_meshes.append({'name': part, 'primitives': prim_list}); node['mesh'] = len(out_meshes) - 1
    out_nodes.append(node); node_index[part] = len(out_nodes) - 1

# translations relative to parent pivots
for part, ni in node_index.items():
    par = parents.get(part)
    t = pivots.get(part, np.zeros(3)) - (pivots[par] if par else origin)
    if part == 'Removed': t = -origin
    out_nodes[ni]['translation'] = [float(x) for x in t]
for part, par in parents.items():
    out_nodes[node_index[par]].setdefault('children', []).append(node_index[part])
root_children = [node_index['Chassis']] + ([node_index['Removed']] if 'Removed' in node_index else [])
out_nodes.append({'name': 'RoostBike', 'children': root_children}); root = len(out_nodes) - 1

# textures: downscale and embed
images, textures, samplers = [], [], [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
if not DEBUG:
    for i, im in enumerate(g.get('images', [])):
        pil = Image.open(os.path.join(base, im['uri']))
        if max(pil.size) > TEX: pil = pil.resize((TEX, TEX), Image.LANCZOS)
        if 'Orange_Plastics_baseColor' in im['uri']:
            # remove the manufacturer lettering: the dark grey graphics become panel grey
            a = np.asarray(pil.convert('RGB')).astype(np.float32) / 255
            mx, mn = a.max(2), a.min(2)
            dark = (mx < 0.97) & ((mx - mn) < 0.16)
            a[dark] = np.array([0.80, 0.80, 0.82])
            # the manufacturer's lettering and its outlines: paint those panels plain white
            # (rectangles in 0..1 UV-image space, found by inspecting the 4096 px texture)
            H, W = a.shape[:2]
            for x0, y0, x1, y1 in [(0.305, 0.015, 0.435, 0.290), (0.452, 0.012, 0.570, 0.245),
                                   (0.812, 0.245, 0.872, 0.285), (0.628, 0.845, 0.676, 0.895)]:
                a[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = np.array([0.95, 0.95, 0.95])
            pil = Image.fromarray((a * 255).astype(np.uint8))
        b = io.BytesIO(); pil.save(b, 'PNG', optimize=True)
        images.append({'bufferView': add_view(b.getvalue()), 'mimeType': 'image/png', 'name': os.path.basename(im['uri'])})
    textures = [{'sampler': 0, 'source': t['source']} for t in g.get('textures', [])]

gl = {'asset': {'version': '2.0', 'generator': 'roost-mx prepare_bike.py',
                'copyright': 'KTM Dirt Bike by OCTbuilds (sketchfab.com/OCTbuilds), CC-BY-4.0; split and re-pivoted for Roost MX'},
      'scene': 0, 'scenes': [{'nodes': [root]}], 'nodes': out_nodes, 'meshes': out_meshes,
      'materials': materials, 'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': 0}]}
if images: gl['images'] = images; gl['textures'] = textures; gl['samplers'] = samplers
while len(buf) % 4: buf.append(0)
gl['buffers'][0]['byteLength'] = len(buf)
js = json.dumps(gl, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
with open(out, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(buf), 0x004E4942)); f.write(buf)

rig = {'source': 'KTM Dirt Bike by OCTbuilds, CC-BY-4.0',
       'frontAxle': (FA - origin).tolist(), 'rearAxle': (RA - origin).tolist(), 'frontRadius': RF, 'rearRadius': RR,
       'forkAxis': fork_axis.tolist(), 'rakeDeg': rake, 'steerPivot': (steer_pivot - origin).tolist(),
       'swingarmPivot': (pivot - origin).tolist(), 'wheelbase': float(FA[2] - RA[2])}
json.dump(rig, open(os.path.splitext(out)[0] + '_rig.json', 'w'), indent=2)
print('wrote', out, os.path.getsize(out) // 1024, 'KB', rig)
