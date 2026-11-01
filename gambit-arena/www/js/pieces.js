// What each chess piece brings to a gunfight. Bigger pieces are tougher and better armed,
// but a good shot with a pawn can still take down a queen.
export const FIGHTERS = {
  p: { name: 'Pawn', hp: 100, speed: 6.2, height: 1.5, radius: 0.45,
    weapon: { name: 'Sidearm', dmg: 24, rate: 0.32, spread: 0.012, pellets: 1, range: 60, mag: 12, reload: 1.3 } },
  n: { name: 'Knight', hp: 110, speed: 7.8, height: 1.75, radius: 0.5,
    weapon: { name: 'Scattergun', dmg: 8, rate: 0.85, spread: 0.075, pellets: 8, range: 22, mag: 6, reload: 1.8 } },
  b: { name: 'Bishop', hp: 100, speed: 6.4, height: 1.95, radius: 0.45,
    weapon: { name: 'Longshot', dmg: 56, rate: 0.9, spread: 0.002, pellets: 1, range: 120, mag: 5, reload: 2.0, zoom: true } },
  r: { name: 'Rook', hp: 170, speed: 4.9, height: 1.8, radius: 0.62,
    weapon: { name: 'Mortar', dmg: 70, rate: 1.25, spread: 0.0, pellets: 1, range: 80, mag: 4, reload: 2.2, rocket: true, splash: 3.2, rocketSpeed: 28 } },
  q: { name: 'Queen', hp: 140, speed: 6.8, height: 2.1, radius: 0.5,
    weapon: { name: 'Stormgun', dmg: 9, rate: 0.085, spread: 0.04, pellets: 1, range: 55, mag: 36, reload: 1.9 } },
  k: { name: 'King', hp: 150, speed: 5.6, height: 2.2, radius: 0.52,
    weapon: { name: 'Crown Cannon', dmg: 34, rate: 0.5, spread: 0.008, pellets: 1, range: 70, mag: 7, reload: 1.6 } },
};

// Rough firepower score: damage per second over health, used by the chess bot
const power = (t) => {
  const f = FIGHTERS[t], w = f.weapon;
  return (w.dmg * w.pellets * 0.7) / w.rate * f.hp;
};

// Chance that `att` beats `def` in a straight fight (the defender gets a small home edge).
export function duelOdds(att, def) {
  const a = power(att), d = power(def) * 1.1;
  return a / (a + d);
}
