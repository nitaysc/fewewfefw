#!/bin/bash
# Installs the Red Eclipse APK on the running emulator, starts it, takes screenshots
# while it unpacks and loads, taps around, and saves the log. Output goes to shots/.
set -x
mkdir -p shots
PKG=io.github.nitaysc.redeclipse
adb install -r re-x86.apk || { echo "install failed"; exit 1; }
adb logcat -c
adb shell am start -n $PKG/.InstallActivity
shot() { adb exec-out screencap -p > "shots/$1.png"; }
alive() { adb shell pidof $PKG >/dev/null; }

# unpacking the data takes a while on the emulator; wait for the game activity
for i in $(seq 1 60); do
  sleep 10
  if adb shell dumpsys activity activities | grep -q "mResumedActivity.*GameActivity\|topResumedActivity.*GameActivity"; then
    echo "game activity after $((i*10))s"; break
  fi
  [ $((i % 6)) = 0 ] && shot "unpack-$i"
done
sleep 60; shot 1-menu
alive || echo "APP NOT RUNNING after start"
sleep 30; shot 2-menu-later

# screen size, so taps land in the same places on any device profile
read W H < <(adb shell wm size | sed -n 's/.*: \([0-9]*\)x\([0-9]*\).*/\2 \1/p' | tail -1)
echo "landscape size ${W}x${H}"
adb shell input tap $((W/2)) $((H/2)); sleep 8; shot 3-tap-center
adb shell input tap $((W/2)) $((H*45/100)); sleep 8; shot 4-tap-again
adb shell input keyevent KEYCODE_BACK; sleep 5; shot 5-back

alive || echo "APP NOT RUNNING at end"
adb logcat -d > shots/logcat.txt
grep -iE "SDL|redeclipse|fatal|crash|error|signal|abort" shots/logcat.txt | tail -n 200 > shots/logcat-short.txt
adb shell run-as $PKG sh -c 'cat files/home/log.txt 2>/dev/null; ls -R files/home | head -50' > shots/game-log.txt 2>&1
exit 0
