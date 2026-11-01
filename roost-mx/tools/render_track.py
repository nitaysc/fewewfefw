"""Render out/track.bin (from `dotnet run -- map` in Tests/) to a PNG: hillshade + surfaces + distance marks."""
import struct, sys
import numpy as np
from PIL import Image, ImageDraw

src = sys.argv[1] if len(sys.argv) > 1 else 'out/track.bin'
dst = sys.argv[2] if len(sys.argv) > 2 else 'out/track.png'
b = open(src, 'rb').read()
R, size = struct.unpack_from('<if', b, 0); o = 8
H = np.frombuffer(b, '<f4', R * R, o).reshape(R, R); o += R * R * 4
S = np.frombuffer(b, '<f4', R * R * 4, o).reshape(R, R, 4); o += R * R * 16
n, = struct.unpack_from('<i', b, o); o += 4
P = np.frombuffer(b, '<f4', n * 5, o).reshape(n, 5)
cs = size / (R - 1)
gy, gx = np.gradient(H, cs)
shade = np.clip(0.6 + (-gx * 0.6 + gy * 0.6) * 1.2, 0.15, 1.2)
cols = np.array([[95, 130, 70], [150, 120, 90], [120, 90, 65], [215, 195, 140]], float)
rgb = np.einsum('ijk,kl->ijl', S, cols) * shade[..., None]
lv = (H - H.min()) / (np.ptp(H) + 1e-6)
rgb *= (0.8 + 0.3 * lv)[..., None]
img = Image.fromarray(np.clip(rgb[::-1], 0, 255).astype(np.uint8)).resize((1024, 1024))
d = ImageDraw.Draw(img)
def px(x, z): return ((x + size / 2) / size * 1024, 1024 - (z + size / 2) / size * 1024)
for x, z, s, bank, feat in P[::50]:
    X, Y = px(x, z); d.text((X + 4, Y), f"{int(s)}", fill=(255, 255, 255))
    d.ellipse([X - 2, Y - 2, X + 2, Y + 2], fill=(255, 255, 0))
X, Y = px(P[0][0], P[0][1]); d.rectangle([X - 5, Y - 5, X + 5, Y + 5], outline=(255, 0, 0), width=2)
img.save(dst); print('saved', dst, 'height range', H.min(), H.max())
