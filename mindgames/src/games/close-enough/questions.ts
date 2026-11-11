/**
 * CLOSE ENOUGH question bank.
 *
 * Every answer is a stable, well-documented figure. Anything that drifts over time is
 * pinned to a date or a named survey in the question itself. `tol` is the relative
 * tolerance treated as a perfect answer (used where reputable sources round differently).
 */

export type Category = 'Body' | 'Space' | 'Earth' | 'Landmarks' | 'Time' | 'Numbers' | 'Games' | 'Science' | 'Culture' | 'Nature';

export interface Question {
  id: string;
  text: string;
  answer: number;
  /** shown after the number, e.g. "km" */
  unit: string;
  category: Category;
  tol?: number;
  note?: string;
}

const q = (id: string, category: Category, text: string, answer: number, unit: string, extra: { tol?: number; note?: string } = {}): Question => ({
  id,
  category,
  text,
  answer,
  unit,
  ...extra,
});

export const QUESTIONS: Question[] = [
  // ── Body ──────────────────────────────────────────────
  q('bones', 'Body', 'How many bones are in the adult human body?', 206, 'bones', { note: 'Babies start with around 300; many fuse as we grow.' }),
  q('teeth', 'Body', 'How many teeth are in a full adult set, wisdom teeth included?', 32, 'teeth'),
  q('chromosomes', 'Body', 'How many chromosomes does a typical human cell contain?', 46, 'chromosomes', { note: '23 pairs.' }),
  q('ribs', 'Body', 'How many ribs does a typical human have in total?', 24, 'ribs', { note: '12 pairs.' }),
  q('hand-bones', 'Body', 'How many bones are in one human hand, wrist included?', 27, 'bones'),
  q('foot-bones', 'Body', 'How many bones are in one human foot?', 26, 'bones'),
  q('skull-bones', 'Body', 'How many bones make up the human skull?', 22, 'bones', { note: '8 cranial and 14 facial bones.' }),

  // ── Space ─────────────────────────────────────────────
  q('moon-distance', 'Space', 'How far is the Moon from Earth on average, in kilometres?', 384400, 'km'),
  q('earth-diameter', 'Space', "What is Earth's diameter at the equator, in kilometres?", 12756, 'km'),
  q('earth-circumference', 'Space', "What is Earth's circumference around the equator, in kilometres?", 40075, 'km'),
  q('light-speed', 'Space', 'How fast does light travel in a vacuum, in kilometres per second?', 299792, 'km/s'),
  q('sunlight', 'Space', 'About how many seconds does sunlight take to reach Earth?', 499, 'seconds', { tol: 0.01, note: 'Roughly 8 minutes 19 seconds.' }),
  q('moon-diameter', 'Space', "What is the Moon's diameter, in kilometres?", 3474, 'km'),
  q('mars-year', 'Space', 'How many Earth days does Mars take to orbit the Sun?', 687, 'days'),
  q('mercury-year', 'Space', 'How many Earth days does Mercury take to orbit the Sun?', 88, 'days'),
  q('venus-year', 'Space', 'How many Earth days does Venus take to orbit the Sun?', 225, 'days', { tol: 0.01 }),
  q('neptune-year', 'Space', 'How many Earth years does Neptune take to orbit the Sun?', 165, 'years', { tol: 0.01 }),
  q('moonwalkers', 'Space', 'How many people have walked on the Moon?', 12, 'people', { note: 'All between 1969 and 1972.' }),
  q('sun-diameter', 'Space', "What is the Sun's diameter, in kilometres?", 1392700, 'km', { tol: 0.01, note: 'About 109 Earths side by side.' }),
  q('earth-age', 'Space', 'How old is Earth, in millions of years?', 4540, 'million years', { tol: 0.015 }),
  q('constellations', 'Space', 'How many constellations are officially recognised by astronomers?', 88, 'constellations', { note: 'Fixed by the International Astronomical Union.' }),
  q('jupiter-diameter', 'Space', "What is Jupiter's diameter at its equator, in kilometres?", 142984, 'km'),
  q('sun-distance', 'Space', 'How far is Earth from the Sun on average, in kilometres?', 149600000, 'km', { tol: 0.005 }),
  q('earth-speed', 'Space', 'How fast does Earth travel around the Sun, in kilometres per hour?', 107200, 'km/h', { tol: 0.01 }),

  // ── Earth ─────────────────────────────────────────────
  q('everest', 'Earth', 'How tall is Mount Everest, in metres?', 8849, 'm', { note: '8,848.86 m in the 2020 Nepal–China survey.' }),
  q('k2', 'Earth', 'How tall is K2, the second-highest mountain on Earth, in metres?', 8611, 'm'),
  q('kilimanjaro', 'Earth', 'How tall is Mount Kilimanjaro, in metres?', 5895, 'm'),
  q('fuji', 'Earth', 'How tall is Mount Fuji, in metres?', 3776, 'm'),
  q('matterhorn', 'Earth', 'How tall is the Matterhorn, in metres?', 4478, 'm'),
  q('aconcagua', 'Earth', 'How tall is Aconcagua, the highest peak in the Americas, in metres?', 6961, 'm'),
  q('denali', 'Earth', 'How tall is Denali, the highest peak in North America, in metres?', 6190, 'm'),
  q('challenger-deep', 'Earth', 'How deep is the Challenger Deep, the deepest known point in the ocean, in metres?', 10935, 'm', { tol: 0.01 }),
  q('nile', 'Earth', 'How long is the Nile, in kilometres?', 6650, 'km', { tol: 0.03 }),
  q('un-members', 'Earth', 'How many member states does the United Nations have?', 193, 'states', { note: 'Unchanged since South Sudan joined in 2011.' }),
  q('angel-falls', 'Earth', "How tall is Angel Falls, the world's highest waterfall, in metres?", 979, 'm'),
  q('baikal', 'Earth', "How deep is Lake Baikal, the world's deepest lake, at its deepest point in metres?", 1642, 'm'),
  q('grand-canyon', 'Earth', 'How long is the Grand Canyon, in kilometres?', 446, 'km'),
  q('tokyo', 'Earth', "How many people lived in Tokyo Metropolis at Japan's 2020 census?", 14047594, 'people', { tol: 0.01 }),
  q('vatican', 'Earth', 'How large is Vatican City, the smallest country in the world, in hectares?', 49, 'hectares', { tol: 0.03 }),
  q('venice', 'Earth', 'How many small islands is the historic city of Venice built on?', 118, 'islands', { tol: 0.03 }),

  // ── Landmarks ─────────────────────────────────────────
  q('eiffel', 'Landmarks', 'How tall is the Eiffel Tower to its tip, in metres?', 330, 'm', { tol: 0.02 }),
  q('eiffel-steps', 'Landmarks', 'How many steps lead from the ground to the top of the Eiffel Tower?', 1665, 'steps', { tol: 0.01 }),
  q('burj', 'Landmarks', "How tall is the Burj Khalifa, the world's tallest building, in metres?", 828, 'm'),
  q('great-wall', 'Landmarks', "How long is the Great Wall of China according to China's official 2012 survey, in kilometres?", 21196, 'km'),
  q('liberty', 'Landmarks', 'How tall is the Statue of Liberty from the ground to the tip of the torch, in metres?', 93, 'm'),
  q('panama', 'Landmarks', 'How long is the Panama Canal, in kilometres?', 82, 'km', { tol: 0.02 }),
  q('suez', 'Landmarks', 'How long is the Suez Canal, in kilometres?', 193, 'km', { tol: 0.01 }),
  q('chunnel', 'Landmarks', 'How long is the Channel Tunnel between England and France, in kilometres?', 50, 'km', { tol: 0.02 }),
  q('golden-gate', 'Landmarks', 'How long is the main span of the Golden Gate Bridge, in metres?', 1280, 'm'),
  q('empire-state', 'Landmarks', 'How tall is the Empire State Building including its antenna, in metres?', 443, 'm'),
  q('empire-steps', 'Landmarks', 'How many steps do runners climb in the Empire State Building Run-Up, from the lobby to the 86th floor?', 1576, 'steps'),
  q('big-ben', 'Landmarks', 'How tall is the Elizabeth Tower, home of Big Ben, in metres?', 96, 'm'),
  q('pyramid', 'Landmarks', 'How tall was the Great Pyramid of Giza when it was completed, in metres?', 147, 'm', { tol: 0.015 }),
  q('pyramid-blocks', 'Landmarks', 'An estimated how many stone blocks make up the Great Pyramid of Giza?', 2300000, 'blocks', { tol: 0.05 }),
  q('titanic', 'Landmarks', 'How long was the RMS Titanic, in metres?', 269, 'm'),
  q('buckingham', 'Landmarks', 'How many rooms does Buckingham Palace have?', 775, 'rooms'),
  q('redeemer', 'Landmarks', 'How tall is the Christ the Redeemer statue in Rio, not counting its pedestal, in metres?', 30, 'm'),

  // ── Time ──────────────────────────────────────────────
  q('minutes-year', 'Time', 'How many minutes are there in a 365-day year?', 525600, 'minutes'),
  q('seconds-day', 'Time', 'How many seconds are there in a day?', 86400, 'seconds'),
  q('hours-week', 'Time', 'How many hours are there in a week?', 168, 'hours'),
  q('hours-year', 'Time', 'How many hours are there in a 365-day year?', 8760, 'hours'),
  q('seconds-week', 'Time', 'How many seconds are there in a week?', 604800, 'seconds'),
  q('seconds-year', 'Time', 'How many seconds are there in a 365-day year?', 31536000, 'seconds'),
  q('hundred-years-war', 'Time', "How many years did the Hundred Years' War actually last?", 116, 'years', { note: 'From 1337 to 1453.' }),
  q('elizabeth', 'Time', 'For how many years did Queen Elizabeth II reign?', 70, 'years'),

  // ── Numbers ───────────────────────────────────────────
  q('chess-squares', 'Numbers', 'Counting squares of every size, how many squares are on a chessboard?', 204, 'squares', { note: '64 small ones, plus every 2×2, 3×3 and so on up to the whole board.' }),
  q('die-dots', 'Numbers', 'How many dots are on a standard six-sided die in total?', 21, 'dots'),
  q('domino-dots', 'Numbers', 'How many dots are there in total on a double-six set of dominoes?', 168, 'dots'),
  q('sum-100', 'Numbers', 'What do the whole numbers from 1 to 100 add up to?', 5050, ''),
  q('roulette', 'Numbers', 'What do all the numbers on a roulette wheel add up to?', 666, ''),
  q('two-20', 'Numbers', 'What is 2 to the power of 20?', 1048576, ''),
  q('two-16', 'Numbers', 'What is 2 to the power of 16?', 65536, ''),
  q('seven-5', 'Numbers', 'What is 7 to the power of 5?', 16807, ''),
  q('poker-hands', 'Numbers', 'How many different 5-card hands can be dealt from a 52-card deck?', 2598960, 'hands'),
  q('hexagon', 'Numbers', 'What do the interior angles of a hexagon add up to, in degrees?', 720, '°'),
  q('primes-100', 'Numbers', 'How many prime numbers are there below 100?', 25, 'primes'),
  q('primes-1000', 'Numbers', 'How many prime numbers are there below 1,000?', 168, 'primes'),
  q('factorial-10', 'Numbers', 'What is 10 factorial (10 × 9 × 8 × … × 1)?', 3628800, ''),
  q('byte', 'Numbers', 'How many different values can a single byte (8 bits) represent?', 256, 'values'),
  q('feet-mile', 'Numbers', 'How many feet are in a mile?', 5280, 'feet'),
  q('metres-mile', 'Numbers', 'How many metres are in a mile?', 1609, 'm'),
  q('gallon', 'Numbers', 'How many millilitres are in a US gallon?', 3785, 'ml'),
  q('pool', 'Numbers', 'How many litres of water fill an Olympic pool measuring 50 m × 25 m × 2 m?', 2500000, 'litres'),

  // ── Games ─────────────────────────────────────────────
  q('scrabble-tiles', 'Games', 'How many letter tiles are in an English Scrabble set?', 100, 'tiles'),
  q('scrabble-board', 'Games', 'How many squares are on a Scrabble board?', 225, 'squares', { note: '15 × 15.' }),
  q('monopoly', 'Games', 'How many spaces are on a Monopoly board?', 40, 'spaces'),
  q('darts', 'Games', 'What is the highest score possible with three darts?', 180, 'points'),
  q('snooker', 'Games', 'What is the maximum break in snooker without a free ball?', 147, 'points'),
  q('bowling', 'Games', 'What is a perfect score in ten-pin bowling?', 300, 'points'),
  q('chess-first', 'Games', 'How many different first moves can White choose from in chess?', 20, 'moves', { note: '16 pawn moves and 4 knight moves.' }),
  q('go-board', 'Games', 'How many intersections are on a standard Go board?', 361, 'points', { note: '19 × 19.' }),
  q('sudoku', 'Games', 'How many cells are in a standard Sudoku grid?', 81, 'cells'),
  q('rubik', 'Games', "How many coloured stickers cover a classic 3×3 Rubik's Cube?", 54, 'stickers'),
  q('dominoes', 'Games', 'How many tiles are in a double-six set of dominoes?', 28, 'tiles'),
  q('mahjong', 'Games', 'How many tiles are in a standard Mahjong set with flowers and seasons?', 144, 'tiles'),
  q('tarot', 'Games', 'How many cards are in a tarot deck?', 78, 'cards'),
  q('marathon', 'Games', 'How long is a marathon, in metres?', 42195, 'm'),
  q('hoop', 'Games', 'How high is a basketball hoop above the floor, in centimetres?', 305, 'cm'),

  // ── Science ───────────────────────────────────────────
  q('elements', 'Science', 'How many elements are in the periodic table?', 118, 'elements'),
  q('sun-surface', 'Science', "About how hot is the Sun's surface, in degrees Celsius?", 5500, '°C', { tol: 0.02 }),
  q('sound', 'Science', 'How fast does sound travel through air at 20 °C, in metres per second?', 343, 'm/s'),
  q('iron', 'Science', 'At what temperature does iron melt, in degrees Celsius?', 1538, '°C'),
  q('gold-melt', 'Science', 'At what temperature does gold melt, in degrees Celsius?', 1064, '°C'),
  q('boil-f', 'Science', 'At what temperature does water boil at sea level, in degrees Fahrenheit?', 212, '°F'),
  q('gold-z', 'Science', 'What is the atomic number of gold?', 79, ''),
  q('uranium-z', 'Science', 'What is the atomic number of uranium?', 92, ''),

  // ── Culture ───────────────────────────────────────────
  q('piano', 'Culture', 'How many keys are on a standard piano?', 88, 'keys'),
  q('piano-black', 'Culture', 'How many black keys are on a standard piano?', 36, 'keys'),
  q('sonnets', 'Culture', 'How many sonnets did Shakespeare publish?', 154, 'sonnets'),
  q('mozart', 'Culture', 'How many numbered symphonies did Mozart write?', 41, 'symphonies'),
  q('tweet', 'Culture', 'How many characters did the original tweet limit allow?', 140, 'characters'),
  q('a4', 'Culture', 'How tall is a sheet of A4 paper, in millimetres?', 297, 'mm'),
  q('greek', 'Culture', 'How many letters are in the Greek alphabet?', 24, 'letters'),
  q('russian', 'Culture', 'How many letters are in the Russian alphabet?', 33, 'letters'),
  q('bible', 'Culture', 'How many books are in the Protestant Bible?', 66, 'books'),

  // ── Nature ────────────────────────────────────────────
  q('dog-teeth', 'Nature', 'How many teeth does an adult dog have?', 42, 'teeth'),
  q('cat-teeth', 'Nature', 'How many teeth does an adult cat have?', 30, 'teeth'),
  q('elephant', 'Nature', 'About how many months does an African elephant pregnancy last?', 22, 'months', { tol: 0.03, note: 'The longest of any land mammal.' }),
];
