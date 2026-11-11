import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Persistent key/value storage. On Android this is backed by native SharedPreferences
 * (survives WebView cache clears); in a browser it falls back to localStorage.
 */
const native = Capacitor.isNativePlatform();

export async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = native ? (await Preferences.get({ key })).value : window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    const raw = JSON.stringify(value);
    if (native) await Preferences.set({ key, value: raw });
    else window.localStorage.setItem(key, raw);
  } catch {
    /* storage full or unavailable — the app keeps working from memory */
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    if (native) await Preferences.remove({ key });
    else window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
