/* Avatars: the opponents' pictures and the player's own badge.
   The animals are Fluent Emoji by Microsoft (MIT), prepared by tools/make_avatars.py; each sits on its own
   colour, inside a rounded square frame drawn by the CSS. The player's pawn badge is drawn here. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  const img = (name, bg) => '<img src="img/av/' + name + '.webp" alt="" draggable="false" style="background:' + bg + '">';

  const ART = {
    chick: img('chick', '#f6e3a1'),
    mouse: img('mouse', '#cfe4c3'),
    fox: img('fox', '#bfe0d6'),
    cat: img('cat', '#c9d7f2'),
    bear: img('bear', '#f1d2bd'),
    penguin: img('penguin', '#d9cdf3'),
    lion: img('lion', '#cfe6ee'),
    wolf: img('wolf', '#f2c9cf'),
    robot: img('robot', '#dfe2e6')
  };

  const svg = (bg, body) => '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="' + bg + '"/>' + body + '</svg>';
  const PAWN = (bg, fg) => svg(bg, '<g fill="' + fg + '"><circle cx="32" cy="22" r="9"/><path d="M25 32h14l-2 4.5c3.6 3 5.2 7.5 5.4 12.5H21.6c.2-5 1.8-9.5 5.4-12.5z"/><rect x="17" y="49" width="30" height="7" rx="3.5"/></g>');

  RW.Avatars = {
    ART,
    /* The coach's picture. `mood` is kept for callers; the picture itself does not change. */
    coach: () => '<img src="img/av/coach.webp" alt="" draggable="false">',
    you: () => PAWN('#6c6a66', '#d9d7d2'),
    // stand-ins for players in an imported game
    side: (color) => (color === 'w' ? PAWN('#e9e8e4', '#8b8985') : PAWN('#3a3936', '#161514'))
  };
})(typeof window !== 'undefined' ? window : globalThis);
