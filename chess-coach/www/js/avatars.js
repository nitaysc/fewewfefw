/* Avatars: one original flat character per opponent, plus the player's own badge.
   Each is a 64x64 SVG with its own background, shown inside a rounded frame by the CSS. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  const INK = '#1b1d26';
  const svg = (bg, body) => '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="' + bg + '"/>' + body + '</svg>';
  const eye = (x, y, r) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + INK + '"/><circle cx="' + (x + r * 0.38).toFixed(1) + '" cy="' + (y - r * 0.38).toFixed(1) + '" r="' + (r * 0.36).toFixed(1) + '" fill="#fff"/>';
  const blush = (y) => '<circle cx="19" cy="' + y + '" r="3.2" fill="#ff9f8a" opacity=".55"/><circle cx="45" cy="' + y + '" r="3.2" fill="#ff9f8a" opacity=".55"/>';

  const ART = {
    // 400: a chick that has just learned how the pieces move
    chick: svg('#8ccdf2',
      '<path d="M31 28c-2-7 3-10 7-9-3 2-4 5-2 9z" fill="#f7b500"/>' +
      '<ellipse cx="32" cy="45" rx="21" ry="19" fill="#ffd23f"/>' +
      '<path d="M13 50q-5-6 1-11 3 6 3 11z" fill="#f7c21a"/><path d="M51 50q5-6-1-11-3 6-3 11z" fill="#f7c21a"/>' +
      eye(25, 41, 3.3) + eye(39, 41, 3.3) + '<path d="M27.5 47h9l-4.5 5.5z" fill="#f28c28"/>' + blush(49)),
    // 700: a mouse that takes everything it can
    mouse: svg('#a8dc90',
      '<circle cx="15" cy="23" r="11" fill="#9aa0ad"/><circle cx="15" cy="23" r="6.5" fill="#f2a9b9"/>' +
      '<circle cx="49" cy="23" r="11" fill="#9aa0ad"/><circle cx="49" cy="23" r="6.5" fill="#f2a9b9"/>' +
      '<ellipse cx="32" cy="41" rx="19" ry="17" fill="#b4bac6"/>' +
      eye(25, 38, 3) + eye(39, 38, 3) + '<circle cx="32" cy="47" r="3.2" fill="#e5627f"/>' +
      '<path d="M28 47L14 44M28 49.5L14 52M36 47L50 44M36 49.5L50 52" stroke="#6d7380" stroke-width="1.3" stroke-linecap="round"/>' +
      '<path d="M29.5 52q2.5 2 5 0" stroke="#6d7380" stroke-width="1.3" fill="none" stroke-linecap="round"/>'),
    // 1000: a fox with a few tricks
    fox: svg('#9fd8cb',
      '<path d="M11 9l16 13-14 10z" fill="#e2702a"/><path d="M15 15l9 7-9 6z" fill="#7a2c0f"/>' +
      '<path d="M53 9L37 22l14 10z" fill="#e2702a"/><path d="M49 15l-9 7 9 6z" fill="#7a2c0f"/>' +
      '<path d="M10 28Q32 12 54 28q-1 17-22 32Q11 45 10 28z" fill="#e8762e"/>' +
      '<path d="M12 33q12 6 20 27-15-7-20-27z" fill="#fff4e8"/><path d="M52 33q-12 6-20 27 15-7 20-27z" fill="#fff4e8"/>' +
      '<ellipse cx="24" cy="35" rx="2.8" ry="3.4" fill="' + INK + '"/><ellipse cx="40" cy="35" rx="2.8" ry="3.4" fill="' + INK + '"/>' +
      '<circle cx="24.9" cy="33.8" r="1" fill="#fff"/><circle cx="40.9" cy="33.8" r="1" fill="#fff"/>' +
      '<path d="M20 29l7 2M44 29l-7 2" stroke="#9c3d12" stroke-width="1.8" stroke-linecap="round"/>' +
      '<circle cx="32" cy="53" r="3.3" fill="' + INK + '"/>'),
    // 1300: a cat with a simple plan
    cat: svg('#f6b896',
      '<path d="M12 11l15 11-15 10z" fill="#5f5d7a"/><path d="M16 17l8 5-8 6z" fill="#f2a9b9"/>' +
      '<path d="M52 11L37 22l15 10z" fill="#5f5d7a"/><path d="M48 17l-8 5 8 6z" fill="#f2a9b9"/>' +
      '<ellipse cx="32" cy="39" rx="21" ry="18" fill="#6c6a8a"/>' +
      '<ellipse cx="24" cy="37" rx="4.6" ry="5" fill="#cde86a"/><ellipse cx="24" cy="37" rx="1.4" ry="4" fill="' + INK + '"/>' +
      '<ellipse cx="40" cy="37" rx="4.6" ry="5" fill="#cde86a"/><ellipse cx="40" cy="37" rx="1.4" ry="4" fill="' + INK + '"/>' +
      '<path d="M29.5 44h5L32 47z" fill="#f2a9b9"/>' +
      '<path d="M32 47q-2 3-5 2M32 47q2 3 5 2" stroke="#2b2a3a" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
      '<path d="M25 45L11 42M25 47.5L11 50M39 45L53 42M39 47.5L53 50" stroke="#e9e8f2" stroke-width="1.2" stroke-linecap="round"/>'),
    // 1600: a bear that mostly does not hang pieces
    bear: svg('#eaa5c8',
      '<circle cx="15" cy="20" r="9" fill="#875838"/><circle cx="15" cy="20" r="4.6" fill="#c9966a"/>' +
      '<circle cx="49" cy="20" r="9" fill="#875838"/><circle cx="49" cy="20" r="4.6" fill="#c9966a"/>' +
      '<circle cx="32" cy="38" r="21" fill="#875838"/>' +
      '<ellipse cx="32" cy="46" rx="11" ry="8.5" fill="#dcb68e"/><ellipse cx="32" cy="42.5" rx="4.4" ry="3.1" fill="#2a1d14"/>' +
      eye(24, 34, 2.8) + eye(40, 34, 2.8) +
      '<path d="M28.5 48.5q3.5 3 7 0" stroke="#2a1d14" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
    // 1900: a patient penguin
    penguin: svg('#c7aef2',
      '<ellipse cx="32" cy="43" rx="23" ry="25" fill="#262a3c"/>' +
      '<path d="M32 29C24 20 12 28 16 41c2 10 9 16 16 16s14-6 16-16c4-13-8-21-16-12z" fill="#fff"/>' +
      eye(26, 39, 2.8) + eye(38, 39, 2.8) + '<path d="M27.5 45h9L32 50.5z" fill="#f3a23d"/>' + blush(47) +
      '<circle cx="26" cy="39" r="5.6" fill="none" stroke="#262a3c" stroke-width="1.6"/><circle cx="38" cy="39" r="5.6" fill="none" stroke="#262a3c" stroke-width="1.6"/>' +
      '<path d="M31.6 39h.8" stroke="#262a3c" stroke-width="1.6"/>'),
    // 2200: a raven that collects small advantages
    raven: svg('#93d9d2',
      '<path d="M21 21c1-10 10-12 15-8-5 0-7 3-6 8z" fill="#2a2c40"/>' +
      '<circle cx="30" cy="39" r="21" fill="#2a2c40"/>' +
      '<path d="M40 35l21 7-21 6z" fill="#4b4f6b"/><path d="M40 42h21l-21 6z" fill="#383b54"/>' +
      '<circle cx="34" cy="34" r="5.2" fill="#fff"/><circle cx="35.4" cy="34.3" r="2.9" fill="' + INK + '"/><circle cx="36.3" cy="33.3" r="1" fill="#fff"/>' +
      '<path d="M27 27.5l11 2" stroke="#15172a" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M14 46q6 5 14 4" stroke="#3d4060" stroke-width="2" fill="none" stroke-linecap="round"/>'),
    // 2500: a wolf that saw it coming
    wolf: svg('#cfd4de',
      '<path d="M10 7l16 15-14 10z" fill="#5a616e"/><path d="M14 13l9 9-9 6z" fill="#3a3f49"/>' +
      '<path d="M54 7L38 22l14 10z" fill="#5a616e"/><path d="M50 13l-9 9 9 6z" fill="#3a3f49"/>' +
      '<path d="M12 26q20-12 40 0l-2 16q-8 14-18 18-10-4-18-18z" fill="#646b79"/>' +
      '<path d="M21 42q11-7 22 0L32 60z" fill="#dde1e8"/>' +
      '<ellipse cx="23" cy="35" rx="3.8" ry="3" fill="#f2c94c"/><circle cx="23.6" cy="35" r="1.7" fill="' + INK + '"/>' +
      '<ellipse cx="41" cy="35" rx="3.8" ry="3" fill="#f2c94c"/><circle cx="41.6" cy="35" r="1.7" fill="' + INK + '"/>' +
      '<path d="M18 30l9 2.5M46 30l-9 2.5" stroke="#3a3f49" stroke-width="2.2" stroke-linecap="round"/>' +
      '<ellipse cx="32" cy="49" rx="3.5" ry="2.7" fill="' + INK + '"/>'),
    // 3000+: the engine at full strength
    robot: svg('#f3b33d',
      '<path d="M32 15V9" stroke="#3a3f4b" stroke-width="2.6"/><circle cx="32" cy="7.5" r="3.8" fill="#ff5a5a"/>' +
      '<rect x="9" y="28" width="7" height="13" rx="3.5" fill="#8e97a6"/><rect x="48" y="28" width="7" height="13" rx="3.5" fill="#8e97a6"/>' +
      '<rect x="24" y="49" width="16" height="10" rx="2" fill="#b6bfcc"/>' +
      '<rect x="14" y="15" width="36" height="36" rx="10" fill="#d5dbe4"/>' +
      '<rect x="18" y="22" width="28" height="14" rx="7" fill="#1e2430"/>' +
      '<circle cx="25" cy="29" r="3.5" fill="#5ef0ff"/><circle cx="39" cy="29" r="3.5" fill="#5ef0ff"/>' +
      '<rect x="23" y="41" width="18" height="4" rx="2" fill="#7a8494"/>' +
      '<path d="M27 41v4M32 41v4M37 41v4" stroke="#d5dbe4" stroke-width="1.2"/>')
  };

  const PAWN = (bg, fg) => svg(bg, '<g fill="' + fg + '"><circle cx="32" cy="21" r="8.5"/><path d="M25.5 31h13l-2 4.5c3.5 3 5 8 5 12.5h-19c0-4.5 1.5-9.5 5-12.5z"/><rect x="18" y="48" width="28" height="7" rx="3.5"/></g>');

  RW.Avatars = {
    ART,
    you: () => PAWN('#e9edf3', '#2a2f3a'),
    // stand-ins for players in an imported game
    side: (color) => (color === 'w' ? PAWN('#eef0f3', '#9aa1ad') : PAWN('#2a2e38', '#0f1116'))
  };
})(typeof window !== 'undefined' ? window : globalThis);
