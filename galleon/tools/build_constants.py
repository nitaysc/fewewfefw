"""Hull shape as plain math, shared by the texture painter and the Blender builder.

Ship space (as in Godot): +Z bow, +Y up, X across. Waterline at Y = 0.
u runs from 0 (stern / transom) to 1 (stem).
"""
import math

LENGTH = 38.0
BEAM = 10.6
DECK = {'main': 2.9, 'quarter': 5.4, 'poop': 7.8, 'fore': 5.25}
SPLIT = {'poop': 0.125, 'quarter': 0.30, 'fore': 0.765}
GUNPORTS_U = [0.33, 0.405, 0.48, 0.555, 0.63, 0.705]


def z_at(u):
    return (u - 0.5) * LENGTH


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def rail_top(u):
    y = 4.35 + 0.3 * (abs(u - 0.52) / 0.5) ** 2
    y += (6.75 - 4.35) * (1 - smooth(SPLIT['quarter'] - 0.012, SPLIT['quarter'] + 0.012, u))
    y += (9.15 - 6.75) * (1 - smooth(SPLIT['poop'] - 0.01, SPLIT['poop'] + 0.01, u))
    y += (6.55 - 4.35) * smooth(SPLIT['fore'] - 0.012, SPLIT['fore'] + 0.012, u)
    y -= 0.45 * smooth(0.9, 1.0, u)
    return y


def keel(u):
    y = -3.05
    y += 0.55 * (1 - smooth(0, 0.22, u)) ** 2
    b = max(0.0, (u - 0.72) / 0.28)
    y += b * b * 4.1
    return y


def plan_half(u):
    if u < 0.42:
        p = 0.64 + 0.36 * math.sin((u / 0.42) * math.pi / 2)
    elif u < 0.56:
        p = 1.0
    else:
        p = math.sqrt(max(0.0, 1 - ((u - 0.56) / 0.44) ** 2.15))
    return BEAM / 2 * p


def half_width(u, y):
    bottom = keel(u)
    max_y = 1.4
    if y <= bottom:
        return 0.0
    if y < max_y:
        s = (y - bottom) / (max_y - bottom)
        ex = 0.5 + 0.85 * (1 - smooth(0.05, 0.4, u)) + 0.25 * smooth(0.75, 1, u)
        w = math.sin(s * math.pi / 2) ** ex
    else:
        w = 1 - 0.2 * ((y - max_y) / 8) ** 1.25
    return plan_half(u) * w
