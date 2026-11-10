"""Builds www/sounds/sounds.wav (one sprite) and www/js/sounds-map.js from openly licensed recordings.

Sources (downloaded into tools/.cache, checked by SHA-256):
  * Piece sounds (move, capture, castle): "Chess Console Sounds" by Stefan Haack (shaack.com),
    CC BY 4.0, shipped in the npm package chess-console 7.0.0. Only the recorded piece
    sounds are used; that package's jingles and beeps are synthesized and are left out.
  * Bell dings: "Bell dings/chimes" by PWL on OpenGameArt, CC0.

Needs: python3 with numpy, and ffmpeg on the PATH.   Run: python3 tools/make_sounds.py
"""
import hashlib, io, os, subprocess, sys, tarfile, urllib.request, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
OUT_WAV = os.path.join(HERE, '..', 'www', 'sounds', 'sounds.wav')
OUT_MAP = os.path.join(HERE, '..', 'www', 'js', 'sounds-map.js')
SR = 44100

SOURCES = {
    'chess-console.tgz': ('https://registry.npmjs.org/chess-console/-/chess-console-7.0.0.tgz',
                          '8b5d36bbac8af931ea1122e9f10fde09b883010ece39fd4748a08c25686cf327'),
    'bell_ding1.wav': ('https://opengameart.org/sites/default/files/bell_ding1.wav', '8ce40f49cd211125303df59db0da4fe911e8b2f34d3847011b15137c6b5850de'),
    'bell_ding2.wav': ('https://opengameart.org/sites/default/files/bell_ding2.wav', 'e4a764a1e0a6284f5a5ec80caf3d44c76d3ff8db17ddab8b42abb6b143e83529'),
    'bell_ding3.wav': ('https://opengameart.org/sites/default/files/bell_ding3.wav', '99b9cdb7b9536c97c6738f1e0762cc40a3e7ef81bc774b0b6e0322aa70c96434'),
}
SPRITE_IN_TGZ = 'package/assets/sounds/chess_console_sounds.mp3'

# name -> (source, window start s, window length s, target level, max length s)
# Windows on the chess-console sprite sit on its 0.45 s grid.
CLIPS = [
    ('move1', 'cc', 4.50, 0.42, 1.00, 0.30),
    ('move2', 'cc', 4.95, 0.42, 1.00, 0.30),
    ('move3', 'cc', 5.40, 0.42, 1.00, 0.30),
    ('move4', 'cc', 5.85, 0.42, 1.00, 0.30),
    ('capture1', 'cc', 6.30, 0.42, 1.00, 0.36),
    ('capture2', 'cc', 6.75, 0.42, 1.00, 0.36),
    ('capture3', 'cc', 7.20, 0.42, 1.00, 0.36),
    ('castle', 'cc', 7.65, 0.42, 1.00, 0.40),
    ('ding1', 'bell_ding1.wav', 0, None, 0.55, 0.60),
    ('ding2', 'bell_ding2.wav', 0, None, 0.55, 1.10),
    ('ding3', 'bell_ding3.wav', 0, None, 0.55, 1.50),
]


def fetch(name):
    url, sha = SOURCES[name]
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        print('downloading', url)
        with urllib.request.urlopen(url, timeout=120) as r, open(path, 'wb') as f:
            f.write(r.read())
    got = hashlib.sha256(open(path, 'rb').read()).hexdigest()
    if sha.startswith('__'):
        print('  sha256 %s  %s' % (name, got))
    elif got != sha:
        sys.exit('checksum mismatch for %s: %s' % (name, got))
    return path


def decode(data_or_path):
    """Any audio file -> mono float32 at SR, via ffmpeg."""
    if isinstance(data_or_path, bytes):
        p = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', str(SR), 'pipe:1'],
                           input=data_or_path, capture_output=True)
    else:
        p = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', data_or_path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), 'pipe:1'],
                           capture_output=True)
    if p.returncode:
        sys.exit(p.stderr.decode())
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def trim(x, max_len):
    """Cut to the sound itself: 1.5 ms before the attack, tail faded out."""
    peak = float(np.abs(x).max())
    loud = np.where(np.abs(x) > peak * 0.02)[0]
    start = max(0, int(loud[0]) - int(SR * 0.0015))
    x = x[start:]
    # last moment the 5 ms envelope is above -52 dB of the peak
    hop = int(SR * 0.005)
    env = np.array([np.abs(x[i:i + hop]).max() for i in range(0, len(x), hop)])
    alive = np.where(env > peak * 10 ** (-52 / 20))[0]
    end = min(len(x), (int(alive[-1]) + 3) * hop, int(SR * max_len))
    x = x[:end].copy()
    fade = min(len(x) // 3, int(SR * (0.03 if max_len < 0.5 else 0.18)))
    x[-fade:] *= np.linspace(1, 0, fade) ** 2
    x[:16] *= np.linspace(0, 1, 16)
    return x


def loudness(x):
    """RMS of the loudest 40 ms: comparable across short knocks and ringing bells."""
    n = int(SR * 0.04)
    if len(x) <= n:
        return float(np.sqrt((x ** 2).mean()))
    c = np.cumsum(np.concatenate([[0.0], x.astype(np.float64) ** 2]))
    return float(np.sqrt(((c[n:] - c[:-n]) / n).max()))


def main():
    with tarfile.open(fetch('chess-console.tgz')) as t:
        cc = decode(t.extractfile(SPRITE_IN_TGZ).read())
    parts, table, pos = [], [], 0
    gap = np.zeros(int(SR * 0.06), dtype=np.float32)
    knocks = []
    clips = {}
    for name, src, start, length, level, max_len in CLIPS:
        if src == 'cc':
            x = cc[int(start * SR):int((start + length) * SR)]
        else:
            x = decode(fetch(src))
        clips[name] = (trim(x, max_len), src, level)
        if src == 'cc':
            knocks.append(loudness(clips[name][0]))
    ref = float(np.median(knocks))
    for name, _, _, _, _, _ in CLIPS:
        x, src, level = clips[name]
        if src == 'cc':
            # keep some of the natural difference between takes, but pull them toward one level
            g = (ref / loudness(x)) ** 0.7
            x = x * g
        clips[name] = (x, src, level)
    top = max(float(np.abs(clips[n][0]).max()) for n, s, *_ in CLIPS if s == 'cc')
    for name, _, _, _, _, _ in CLIPS:
        x, src, level = clips[name]
        x = x * (0.94 / top) if src == 'cc' else x * (level / float(np.abs(x).max()))
        x = np.clip(x, -0.98, 0.98).astype(np.float32)
        table.append((name, pos / SR, len(x) / SR, float(np.abs(x).max())))
        parts += [x, gap]
        pos += len(x) + len(gap)
    out = np.concatenate(parts)
    os.makedirs(os.path.dirname(OUT_WAV), exist_ok=True)
    with wave.open(OUT_WAV, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((out * 32767).astype('<i2').tobytes())
    with open(OUT_MAP, 'w') as f:
        f.write('/* Generated by tools/make_sounds.py. Clip name -> [start seconds, length seconds] in sounds/sounds.wav. */\n')
        f.write('(function (g) {\n  (g.RW = g.RW || {}).SOUND_MAP = {\n')
        f.write(',\n'.join('    %s: [%.4f, %.4f]' % (n, a, d) for n, a, d, _ in table))
        f.write('\n  };\n})(typeof window !== \'undefined\' ? window : globalThis);\n')
    for n, a, d, pk in table:
        print('%-9s at %6.3f  len %.3f  peak %.2f' % (n, a, d, pk))
    print('wrote %s (%.0f KB, %.2f s)' % (os.path.relpath(OUT_WAV), os.path.getsize(OUT_WAV) / 1024, len(out) / SR))


if __name__ == '__main__':
    main()
