"""Generates the game's sound effects (all synthesised, no samples) into assets/sounds/."""
import numpy as np, wave, os, sys
SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
rng = np.random.default_rng(7)

def t(d): return np.arange(int(SR * d)) / SR
def noise(d): return rng.uniform(-1, 1, int(SR * d))
def lowpass(x, cut):
    a = np.exp(-2 * np.pi * cut / SR); y = np.zeros_like(x); s = 0.0
    for i, v in enumerate(x): s = (1 - a) * v + a * s; y[i] = s
    return y
def highpass(x, cut): return x - lowpass(x, cut)
def env(d, attack, decay):
    tt = t(d); return np.minimum(tt / max(attack, 1e-5), 1) * np.exp(-tt / decay)
def reverb(x, amt=0.3, taps=((0.031, .5), (0.047, .4), (0.071, .3), (0.113, .22), (0.167, .15))):
    y = np.concatenate([x, np.zeros(int(SR * 0.4))])
    for dly, g in taps:
        n = int(SR * dly); y[n:n + len(x)] += lowpass(x, 2500) * g * amt
    return y
def save(name, x, gain=0.9):
    x = x / (np.max(np.abs(x)) + 1e-9) * gain
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2')
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
def click(d=0.03, cut=4000, decay=0.004):
    return highpass(noise(d), cut) * env(d, 0.0003, decay)

def gunshot(distant=False):
    d = 0.5
    crack = highpass(noise(d), 1800) * env(d, 0.0004, 0.012)
    body = lowpass(noise(d), 1400) * env(d, 0.001, 0.05)
    boom = np.sin(2 * np.pi * (70 + 90 * np.exp(-t(d) * 30)) * t(d)) * env(d, 0.001, 0.09)
    x = crack * 1.0 + body * 0.9 + boom * 1.2
    if distant:
        x = lowpass(x, 900) * 0.8
        return reverb(x, 0.9)
    return reverb(x, 0.45)
save('ak_fire', gunshot())
save('enemy_fire', gunshot(True), 0.6)
save('dry_fire', click(0.05, 2500, 0.006), 0.5)
# magazine out: two metallic clicks and a slide
mo = np.zeros(int(SR * 0.35)); c = click(0.04, 3000, 0.006); mo[:len(c)] += c
c2 = lowpass(noise(0.15), 3000) * env(0.15, 0.01, 0.05) * 0.3; mo[int(SR*0.05):int(SR*0.05)+len(c2)] += c2
save('mag_out', mo, 0.6)
mi = np.zeros(int(SR * 0.3)); c = click(0.05, 1500, 0.01); mi[int(SR*0.02):int(SR*0.02)+len(c)] += c
c = click(0.03, 3500, 0.004); mi[int(SR*0.12):int(SR*0.12)+len(c)] += c * 1.2
save('mag_in', mi, 0.7)
# bolt: pull back and slam forward
bo = np.zeros(int(SR * 0.45))
pull = highpass(noise(0.12), 2000) * env(0.12, 0.01, 0.04) * 0.5; bo[:len(pull)] += pull
slam = click(0.08, 1200, 0.015) + lowpass(noise(0.08), 600) * env(0.08, 0.001, 0.02); bo[int(SR*0.22):int(SR*0.22)+len(slam)] += slam
save('bolt', bo, 0.7)
save('mag_drop', reverb(click(0.08, 800, 0.02) + click(0.08, 2500, 0.01), 0.3), 0.4)
# shell casing tinkle
sh = np.zeros(int(SR * 0.4))
for k, (at, f) in enumerate(((0.0, 5200), (0.09, 4700), (0.16, 5600))):
    n = int(SR * at); d = 0.12; s = np.sin(2 * np.pi * f * t(d)) * env(d, 0.0005, 0.02) * (1 - k * 0.3)
    sh[n:n + len(s)] += s
save('shell', sh, 0.25)
save('hitmarker', np.sin(2 * np.pi * 2400 * t(0.06)) * env(0.06, 0.0005, 0.012), 0.35)
save('headshot', np.sin(2 * np.pi * 3200 * t(0.12)) * env(0.12, 0.0005, 0.03) + click(0.12, 3000, 0.01), 0.5)
save('impact', reverb(highpass(noise(0.12), 900) * env(0.12, 0.0005, 0.015), 0.2), 0.35)
save('step', lowpass(noise(0.09), 700) * env(0.09, 0.003, 0.02) + click(0.09, 2500, 0.004) * 0.2, 0.3)
save('hurt', lowpass(noise(0.25), 500) * env(0.25, 0.002, 0.06) + np.sin(2*np.pi*90*t(0.25))*env(0.25,0.001,0.08), 0.6)
save('inspect', lowpass(noise(0.3), 2200) * env(0.3, 0.05, 0.08) * 0.5 + np.pad(click(0.03, 3000, 0.005), (int(SR*0.2), int(SR*0.3)))[:int(SR*0.3)], 0.35)
print('ok')
