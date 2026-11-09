// One-off asset conversion (kept for reference): the sky HDR becomes an RGBE PNG (left half
// mantissas, right half exponents) and the statue's binary buffer is embedded in its glTF
// JSON, so every asset is a plain web type that any static host (and claude.ai) will serve.
import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { RGBELoader } from '../www/vendor/RGBELoader.js';
import * as THREE from '../www/vendor/three.module.js';

const [hdrIn, pngOut, gltfIn, binIn, jsonOut] = process.argv.slice(2);
if (hdrIn) {
  const buf = await readFile(hdrIn);
  const loader = new RGBELoader().setDataType(THREE.FloatType);
  const tex = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const { width: W, height: H, data } = tex;
  const rows = Buffer.alloc(H * (1 + W * 2 * 3));
  for (let y = 0; y < H; y++) {
    const o = y * (1 + W * 6); rows[o] = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      const m = Math.max(r, g, b);
      let R = 0, G = 0, B = 0, E = 0;
      if (m > 1e-32) {
        const e = Math.ceil(Math.log2(m)) + (m === 2 ** Math.ceil(Math.log2(m)) ? 1 : 0);
        const s = 256 / 2 ** e;
        R = Math.min(255, Math.floor(r * s)); G = Math.min(255, Math.floor(g * s)); B = Math.min(255, Math.floor(b * s)); E = e + 128;
      }
      rows[o + 1 + x * 3] = R; rows[o + 2 + x * 3] = G; rows[o + 3 + x * 3] = B;
      const q = o + 1 + (W + x) * 3; rows[q] = E; rows[q + 1] = E; rows[q + 2] = E;
    }
  }
  const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, d) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, d]))); return Buffer.concat([len, t, d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W * 2, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  await writeFile(pngOut, png);
  console.log('sky', W, 'x', H, '->', pngOut, png.length, 'bytes');
}
if (gltfIn) {
  const g = JSON.parse(await readFile(gltfIn, 'utf8'));
  const bin = await readFile(binIn);
  g.buffers = [{ byteLength: bin.length, uri: 'data:application/octet-stream;base64,' + bin.toString('base64') }];
  await writeFile(jsonOut, JSON.stringify(g));
  console.log('model ->', jsonOut);
}
