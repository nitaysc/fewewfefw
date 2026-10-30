// Courses are plain data. Each hole is a grid, one character per 2x2 cell:
//   ' ' void (walled off)   '.' or 0-9 floor at that height   '_' gap (no walls, fall = penalty)
//   ^ v < >  ramp rising one level toward that side (north is the top row)
// start/cup/path/obstacle positions are [column, row] in cells and may be fractional.
// `path` is the route a bot follows to judge how close a shot leaves it.

export const COURSES = [
  {
    id: 'candy',
    name: 'ארץ הממתקים',
    emoji: '🍭',
    theme: {
      sky: ['#7fd3ff', '#ffd9ee'],
      fog: '#ffd9ee',
      ground: '#ffb8d6',
      felt: ['#62d69c', '#55c98e'],
      side: '#ff8fbf',
      wall: '#fff5fa',
      wallStripe: '#ff4f8b',
      trim: '#ff4f8b',
      decor: 'candy',
    },
    holes: [
      {
        name: 'שביל הסוכר', par: 2,
        grid: [
          '...',
          '...',
          '...',
          '...',
          '...',
          '...',
          '...',
        ],
        start: [1.5, 6.4], cup: [1.5, 0.9],
        obstacles: [
          { type: 'bumper', at: [0.7, 3.6] },
          { type: 'bumper', at: [2.3, 2.4] },
        ],
      },
      {
        name: 'פינת המקל', par: 3,
        grid: [
          '......',
          '......',
          '..    ',
          '..    ',
          '..    ',
          '..    ',
        ],
        start: [1, 5.4], cup: [5.2, 1],
        path: [[1, 5.4], [1, 1.2], [5.2, 1]],
        obstacles: [
          { type: 'block', at: [3.5, 0.55], size: [0.35, 0.5, 2.2] },
        ],
      },
      {
        name: 'גבעת הגומי', par: 3,
        grid: [
          '111',
          '111',
          '111',
          ' ^ ',
          '...',
          '...',
          '...',
        ],
        start: [1.5, 6.4], cup: [1.5, 0.8],
        path: [[1.5, 6.4], [1.5, 3.5], [1.5, 0.8]],
        obstacles: [
          { type: 'mover', a: [0.5, 1.8], b: [2.5, 1.8], size: [1.7, 0.45, 0.45], period: 3.2 },
        ],
      },
      {
        name: 'מכונת הפינבול', par: 3,
        grid: [
          '.....',
          '.....',
          '.....',
          '.....',
          '.....',
          '.....',
          '.....',
        ],
        start: [2.5, 6.5], cup: [2.5, 0.8],
        obstacles: [
          { type: 'bumper', at: [1.1, 2.2] },
          { type: 'bumper', at: [2.5, 2.0] },
          { type: 'bumper', at: [3.9, 2.2] },
          { type: 'bumper', at: [1.8, 3.6] },
          { type: 'bumper', at: [3.2, 3.6] },
          { type: 'bumper', at: [2.5, 5.0] },
        ],
      },
      {
        name: 'הסביבון המתוק', par: 3,
        grid: [
          '...',
          '...',
          '...',
          '...',
          '...',
          '...',
          '...',
          '...',
        ],
        start: [1.5, 7.4], cup: [1.5, 0.9],
        obstacles: [
          { type: 'spinner', at: [1.5, 4], len: 5.1, speed: 1.1, arms: 2 },
        ],
      },
      {
        name: 'הקפיצה הגדולה', par: 3,
        grid: [
          '...',
          '...',
          '...',
          '...',
          '...',
          '___',
          '^^^',
          '...',
          '...',
          '...',
        ],
        start: [1.5, 9.4], cup: [1.5, 1.6],
        path: [[1.5, 9.4], [1.5, 6.5], [1.5, 4], [1.5, 1.6]],
        obstacles: [
          { type: 'boost', at: [1.5, 7.5], span: [3, 1], dir: '^', speed: 8 },
          { type: 'block', at: [1.5, 4.93], size: [6, 0.22, 0.14] },
        ],
      },
    ],
  },
];
