/** Date helpers. Daily puzzles are keyed by the player's local calendar date (YYYY-MM-DD). */

export const LAUNCH_DAY = '2026-11-01'; // MINDGAMES #1

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function dayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function daysBetween(a: string, b: string): number {
  return dayIndex(b) - dayIndex(a);
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Puzzle number shown to players, e.g. MINDGAMES #124. */
export function dailyNumber(key: string): number {
  return daysBetween(LAUNCH_DAY, key) + 1;
}

/** Monday of the week containing `key`. */
export function weekStart(key: string): string {
  const dow = (parseKey(key).getDay() + 6) % 7; // Mon = 0
  return addDays(key, -dow);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function formatLong(key: string): string {
  const d = parseKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatShort(key: string): string {
  const d = parseKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

export function monthName(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export function weekdayShort(key: string): string {
  return WEEKDAYS[parseKey(key).getDay()].slice(0, 1);
}
