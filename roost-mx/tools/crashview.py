"""Print telemetry leading up to each crash in a lap CSV (Tests/out/lap_*.csv)."""
import csv, sys
rows = list(csv.DictReader(open(sys.argv[1])))
keys = sys.argv[3].split(',') if len(sys.argv) > 3 else ['t','progress','speed_kmh','target_speed','lean','target_lean','pitch','steer','gear','rpm','thr','clutch','fbrake','rbrake','f_load','r_load','f_comp','r_comp','f_slip','r_slip','f_alpha','r_alpha','air','rider_dz']
window = float(sys.argv[2]) if len(sys.argv) > 2 else 1.5
crash_t = []
was = False
for r in rows:
    bad = abs(float(r['lean'])) > 70 or abs(float(r['pitch'])) > 70
    if bad and not was: crash_t.append(float(r['t']))
    was = bad
for ct in crash_t[:2]:
    print(f"--- crash at t={ct:.2f}")
    for r in rows:
        t = float(r['t'])
        if ct - window <= t <= ct and int(round(t * 200)) % 8 == 0:
            print(' '.join(f"{k}={float(r[k]):.3g}" for k in keys))
