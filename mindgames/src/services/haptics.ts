import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let enabled = true;
export const setHapticsEnabled = (on: boolean) => {
  enabled = on;
};

const native = Capacitor.isNativePlatform();
const vibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
};

export const haptic = {
  tap() {
    if (!enabled) return;
    if (native) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else vibrate(8);
  },
  press() {
    if (!enabled) return;
    if (native) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    else vibrate(14);
  },
  success() {
    if (!enabled) return;
    if (native) void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else vibrate([12, 60, 18]);
  },
  error() {
    if (!enabled) return;
    if (native) void Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    else vibrate([30, 40, 30]);
  },
};
