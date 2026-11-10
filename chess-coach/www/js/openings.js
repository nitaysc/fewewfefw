/* A compact opening book: enough to name common openings and mark book moves. */
(function (g) {
  const RW = (g.RW = g.RW || {});
  const LINES = [
    ["King's Pawn Opening", 'e4'],
    ["King's Pawn Game", 'e4 e5'],
    ["King's Knight Opening", 'e4 e5 Nf3'],
    ["King's Knight Opening", 'e4 e5 Nf3 Nc6'],
    ['Italian Game', 'e4 e5 Nf3 Nc6 Bc4'],
    ['Italian Game: Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5'],
    ['Italian Game: Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+'],
    ['Italian Game: Giuoco Pianissimo', 'e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 c3 d6 O-O O-O'],
    ['Italian Game: Evans Gambit', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4'],
    ['Italian Game: Two Knights Defense', 'e4 e5 Nf3 Nc6 Bc4 Nf6'],
    ['Two Knights Defense: Knight Attack', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5'],
    ['Two Knights Defense: Modern Attack', 'e4 e5 Nf3 Nc6 Bc4 Nf6 d4 exd4 e5 d5'],
    ['Two Knights Defense', 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O'],
    ['Ruy Lopez', 'e4 e5 Nf3 Nc6 Bb5'],
    ['Ruy Lopez: Morphy Defense', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3'],
    ['Ruy Lopez: Exchange Variation', 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O'],
    ['Ruy Lopez: Berlin Defense', 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5'],
    ['Ruy Lopez: Open Variation', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4 b5 Bb3 d5'],
    ['Scotch Game', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4'],
    ['Scotch Game', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5'],
    ['Scotch Game: Classical Variation', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3'],
    ['Scotch Gambit', 'e4 e5 Nf3 Nc6 d4 exd4 Bc4'],
    ['Four Knights Game', 'e4 e5 Nf3 Nc6 Nc3 Nf6'],
    ['Four Knights Game: Spanish Variation', 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6'],
    ['Four Knights Game: Scotch Variation', 'e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4 Nxd4'],
    ['Petrov Defense', 'e4 e5 Nf3 Nf6'],
    ['Petrov Defense: Classical Attack', 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3'],
    ['Philidor Defense', 'e4 e5 Nf3 d6'],
    ['Philidor Defense', 'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7'],
    ['Vienna Game', 'e4 e5 Nc3'],
    ['Vienna Game', 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4'],
    ['Vienna Game', 'e4 e5 Nc3 Nc6 Bc4 Nf6 d3'],
    ["Bishop's Opening", 'e4 e5 Bc4'],
    ["Bishop's Opening", 'e4 e5 Bc4 Nf6 d3 c6 Nf3 d5 Bb3'],
    ["King's Gambit", 'e4 e5 f4'],
    ["King's Gambit Accepted", 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5'],
    ["King's Gambit Declined", 'e4 e5 f4 Bc5 Nf3 d6'],
    ['Center Game', 'e4 e5 d4 exd4 Qxd4 Nc6 Qe3'],
    ['Danish Gambit', 'e4 e5 d4 exd4 c3'],
    ['Sicilian Defense', 'e4 c5'],
    ['Sicilian Defense', 'e4 c5 Nf3'],
    ['Sicilian Defense: Open', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3'],
    ['Sicilian Defense: Najdorf Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6'],
    ['Sicilian Defense: Najdorf Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4'],
    ['Sicilian Defense: Dragon Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6'],
    ['Sicilian Defense: Classical Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5 e6 Qd2'],
    ['Sicilian Defense: Scheveningen Variation', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6 Be2 Be7 O-O O-O'],
    ['Sicilian Defense: Old Sicilian', 'e4 c5 Nf3 Nc6'],
    ['Sicilian Defense: Sveshnikov Variation', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5'],
    ['Sicilian Defense: Accelerated Dragon', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7 Be3 Nf6'],
    ['Sicilian Defense: Rossolimo Attack', 'e4 c5 Nf3 Nc6 Bb5 g6 O-O Bg7'],
    ['Sicilian Defense: Taimanov Variation', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7'],
    ['Sicilian Defense: Kan Variation', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6'],
    ['Sicilian Defense: Alapin Variation', 'e4 c5 c3'],
    ['Sicilian Defense: Alapin Variation', 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3'],
    ['Sicilian Defense: Alapin Variation', 'e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3'],
    ['Sicilian Defense: Closed', 'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6'],
    ['Sicilian Defense: Smith-Morra Gambit', 'e4 c5 d4 cxd4 c3 dxc3 Nxc3'],
    ['French Defense', 'e4 e6'],
    ['French Defense', 'e4 e6 d4 d5'],
    ['French Defense: Advance Variation', 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6'],
    ['French Defense: Exchange Variation', 'e4 e6 d4 d5 exd5 exd5 Nf3 Nf6 Bd3 Bd6'],
    ['French Defense: Winawer Variation', 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3'],
    ['French Defense: Classical Variation', 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7'],
    ['French Defense: Tarrasch Variation', 'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6'],
    ['French Defense: Rubinstein Variation', 'e4 e6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Nf3 Ngf6'],
    ['Caro-Kann Defense', 'e4 c6'],
    ['Caro-Kann Defense', 'e4 c6 d4 d5'],
    ['Caro-Kann Defense: Advance Variation', 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2'],
    ['Caro-Kann Defense: Exchange Variation', 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6'],
    ['Caro-Kann Defense: Panov Attack', 'e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6'],
    ['Caro-Kann Defense: Classical Variation', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7'],
    ['Scandinavian Defense', 'e4 d5'],
    ['Scandinavian Defense', 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3'],
    ['Scandinavian Defense: Modern Variation', 'e4 d5 exd5 Nf6 d4 Nxd5 Nf3'],
    ['Pirc Defense', 'e4 d6 d4 Nf6 Nc3 g6'],
    ['Pirc Defense: Classical Variation', 'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O'],
    ['Modern Defense', 'e4 g6 d4 Bg7 Nc3 d6'],
    ['Alekhine Defense', 'e4 Nf6'],
    ['Alekhine Defense', 'e4 Nf6 e5 Nd5 d4 d6 Nf3'],
    ['Nimzowitsch Defense', 'e4 Nc6'],
    ["Owen's Defense", 'e4 b6'],
    ["Queen's Pawn Opening", 'd4'],
    ["Queen's Pawn Game", 'd4 d5'],
    ["Queen's Gambit", 'd4 d5 c4'],
    ["Queen's Gambit Accepted", 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O'],
    ["Queen's Gambit Declined", 'd4 d5 c4 e6'],
    ["Queen's Gambit Declined", 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4'],
    ["Queen's Gambit Declined: Exchange Variation", 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 c6 e3'],
    ["Queen's Gambit Declined: Tarrasch Defense", 'd4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 Nc6'],
    ['Slav Defense', 'd4 d5 c4 c6'],
    ['Slav Defense', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5'],
    ['Semi-Slav Defense', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3'],
    ['London System', 'd4 d5 Bf4'],
    ['London System', 'd4 d5 Bf4 Nf6 e3 e6 Nf3 Bd6'],
    ['London System', 'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6 Bg3'],
    ['London System', 'd4 d5 Nf3 Nf6 Bf4 e6 e3 Bd6 Bg3'],
    ['London System', 'd4 d5 Nf3 Nf6 Bf4 c5 e3 Nc6 c3'],
    ['London System', 'd4 Nf6 Bf4 d5 e3'],
    ['London System', 'd4 Nf6 Nf3 e6 Bf4'],
    ['London System', 'd4 Nf6 Nf3 g6 Bf4 Bg7 e3 O-O Be2 d6'],
    ['Colle System', 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3'],
    ['Indian Defense', 'd4 Nf6'],
    ['Indian Defense', 'd4 Nf6 c4'],
    ['Indian Defense', 'd4 Nf6 Nf3'],
    ["King's Indian Defense", 'd4 Nf6 c4 g6 Nc3 Bg7'],
    ["King's Indian Defense: Classical Variation", 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7'],
    ["King's Indian Defense: Sämisch Variation", 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3'],
    ['Grünfeld Defense', 'd4 Nf6 c4 g6 Nc3 d5'],
    ['Grünfeld Defense: Exchange Variation', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7'],
    ['Nimzo-Indian Defense', 'd4 Nf6 c4 e6 Nc3 Bb4'],
    ['Nimzo-Indian Defense: Rubinstein Variation', 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O'],
    ['Nimzo-Indian Defense: Classical Variation', 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3'],
    ["Queen's Indian Defense", 'd4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O'],
    ['Bogo-Indian Defense', 'd4 Nf6 c4 e6 Nf3 Bb4+'],
    ['Catalan Opening', 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O'],
    ['Benoni Defense', 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6'],
    ['Benko Gambit', 'd4 Nf6 c4 c5 d5 b5 cxb5 a6'],
    ['Budapest Gambit', 'd4 Nf6 c4 e5 dxe5 Ng4'],
    ['Trompowsky Attack', 'd4 Nf6 Bg5'],
    ['Dutch Defense', 'd4 f5'],
    ['Dutch Defense', 'd4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4'],
    ['Dutch Defense: Leningrad Variation', 'd4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6'],
    ['Old Benoni Defense', 'd4 c5 d5'],
    ['Englund Gambit', 'd4 e5 dxe5 Nc6 Nf3 Qe7'],
    ['Queen\'s Pawn Game: Chigorin Variation', 'd4 d5 Nc3 Nf6 Bg5'],
    ['Jobava London System', 'd4 d5 Nc3 Nf6 Bf4'],
    ['English Opening', 'c4'],
    ['English Opening: Reversed Sicilian', 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2'],
    ['English Opening: Symmetrical Variation', 'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3'],
    ['English Opening', 'c4 Nf6 Nc3 e6 Nf3 d5 d4'],
    ['English Opening', 'c4 e6 Nc3 d5 d4'],
    ['Réti Opening', 'Nf3'],
    ['Réti Opening', 'Nf3 d5 c4'],
    ['Réti Opening', 'Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7'],
    ["King's Indian Attack", 'Nf3 d5 g3 Nf6 Bg2 c5 O-O Nc6 d3 e5'],
    ['Réti Opening', 'Nf3 Nf6 c4 e6 Nc3 d5 d4'],
    ['Réti Opening', 'Nf3 Nf6 g3 g6 Bg2 Bg7 O-O O-O'],
    ['Zukertort Opening', 'Nf3 Nf6 d4 d5 c4'],
    ["Bird's Opening", 'f4'],
    ["Bird's Opening", 'f4 d5 Nf3 Nf6 e3 g6'],
    ['Nimzowitsch-Larsen Attack', 'b3'],
    ['Nimzowitsch-Larsen Attack', 'b3 e5 Bb2 Nc6 e3 Nf6'],
    ["King's Fianchetto Opening", 'g3'],
    ["King's Fianchetto Opening", 'g3 d5 Bg2 Nf6 Nf3'],
    ['Polish Opening', 'b4'],
    ["Van't Kruijs Opening", 'e3'],
    ['Grob Opening', 'g4']
  ];

  // prefix "e4 e5 Nf3" -> opening name for the longest line that reaches it
  const book = new Map();
  for (const [name, line] of LINES) {
    const sans = line.split(' ');
    for (let i = 1; i <= sans.length; i++) {
      const key = sans.slice(0, i).join(' ');
      const exact = i === sans.length;
      const cur = book.get(key);
      if (!cur || (exact && !cur.exact)) book.set(key, { name: exact ? name : cur ? cur.name : null, exact });
    }
  }
  // fill names for interior prefixes from the closest shorter exact line
  for (const [key, v] of book) {
    if (v.name) continue;
    const parts = key.split(' ');
    for (let i = parts.length - 1; i >= 1; i--) {
      const p = book.get(parts.slice(0, i).join(' '));
      if (p && p.exact) { v.name = p.name; break; }
    }
    if (!v.name) v.name = 'Opening';
  }

  // One plain sentence on what each opening family is trying to do.
  const IDEAS = {
    "King's Pawn Opening": 'It opens lines for the queen and bishop and claims the center.',
    "King's Pawn Game": 'Both sides have a pawn in the center, so fast development comes next.',
    "King's Knight Opening": 'The knight comes out with a threat against the e5 pawn.',
    'Italian Game': 'The bishop takes aim at f7, the softest square in Black\'s camp.',
    'Two Knights Defense': 'Black counterattacks e4 instead of defending quietly.',
    'Ruy Lopez': 'The bishop leans on the knight that defends e5.',
    'Scotch Game': 'White opens the center at once to free the pieces.',
    'Scotch Gambit': 'White gives a pawn for a lead in development.',
    'Four Knights Game': 'Calm, sound development with all four knights out.',
    'Petrov Defense': 'Black answers the attack on e5 with a counterattack on e4.',
    'Philidor Defense': 'Black props up e5 with a pawn: solid, if a little passive.',
    'Vienna Game': 'White develops first and keeps the f-pawn push in reserve.',
    "Bishop's Opening": 'The bishop goes straight to its most active diagonal.',
    "King's Gambit": 'White offers a pawn to rip open the f-file and the center.',
    "King's Gambit Accepted": 'Black takes the pawn and has to weather the attack.',
    "King's Gambit Declined": 'Black declines the pawn and develops instead.',
    'Center Game': 'White opens the center early, though the queen comes out with it.',
    'Danish Gambit': 'White gives up pawns for open lines and fast development.',
    'Sicilian Defense': 'Black fights for d4 from the side and gets an unbalanced game.',
    'French Defense': 'Black builds a solid pawn chain and will hit the center with ...d5 and ...c5.',
    'Caro-Kann Defense': 'Black prepares ...d5 while keeping the light-squared bishop free.',
    'Scandinavian Defense': 'Black challenges e4 at once, at the cost of a little time.',
    'Pirc Defense': 'Black lets White build a center and plans to attack it later.',
    'Modern Defense': 'Black lets White build a center and plans to attack it later.',
    'Alekhine Defense': 'Black tempts the pawns forward, hoping they turn into targets.',
    "Queen's Pawn Opening": 'A center pawn that is protected by the queen from the start.',
    "Queen's Pawn Game": 'A closed center, where plans matter more than quick tactics.',
    "Queen's Gambit": 'White offers the c-pawn to pull Black\'s d-pawn away from the center.',
    "Queen's Gambit Accepted": 'Black takes the pawn and gives up the center for easy development.',
    "Queen's Gambit Declined": 'Black holds the d5 strongpoint and develops behind it.',
    'Slav Defense': 'Black supports d5 without shutting in the light-squared bishop.',
    'Semi-Slav Defense': 'A very solid triangle of pawns guarding d5.',
    'London System': 'White sets up the same sturdy shape against almost anything.',
    'Jobava London System': 'A sharper London, with the knight heading for b5.',
    'Colle System': 'White builds quietly, aiming for a later e4 break.',
    'Indian Defense': 'Black controls e4 with a piece instead of a pawn.',
    "King's Indian Defense": 'Black lets White take the center, then strikes back at it.',
    'Grünfeld Defense': 'Black hits the center with ...d5 and uses the long diagonal.',
    'Nimzo-Indian Defense': 'The pin on the knight is a fight for the e4 square.',
    "Queen's Indian Defense": 'The bishop on b7 will watch over e4.',
    'Bogo-Indian Defense': 'A developing check that asks White how to block.',
    'Catalan Opening': 'The bishop on g2 presses down the long diagonal.',
    'Benoni Defense': 'Black accepts less space in return for active pieces.',
    'Benko Gambit': 'Black gives a pawn for lasting pressure on the queenside files.',
    'Budapest Gambit': 'Black gives a pawn to chase quick piece activity.',
    'Trompowsky Attack': 'The bishop comes out early to bother the knight.',
    'Dutch Defense': 'Black grabs e4 with the f-pawn and looks toward the kingside.',
    'Old Benoni Defense': 'Black challenges d4 immediately.',
    'Englund Gambit': 'A risky pawn offer that sets a few traps.',
    'English Opening': 'White controls d5 from the side and keeps the center flexible.',
    'Réti Opening': 'White develops first and decides on the center later.',
    'Zukertort Opening': 'A flexible start that can become almost any queen\'s pawn opening.',
    "King's Indian Attack": 'White builds a compact setup and attacks on the kingside later.',
    "Bird's Opening": 'White controls e5 with the f-pawn.',
    'Nimzowitsch-Larsen Attack': 'The bishop will go to b2 and aim down the long diagonal.',
    "King's Fianchetto Opening": 'The bishop will go to g2 and aim down the long diagonal.',
    'Nimzowitsch Defense': 'Black develops a knight first and keeps the pawns flexible.',
    "Owen's Defense": 'The bishop heads for b7 to press on e4.'
  };

  const clean = (san) => san.replace(/[!?]+$/, '');
  RW.Openings = {
    LINES,
    /* What the opening is about, or '' if there is no note for it. */
    idea(name) {
      if (!name) return '';
      return IDEAS[name] || IDEAS[name.split(':')[0]] || '';
    },
    /* Is the game still in book after these SAN moves? Returns {name} or null. */
    lookup(sans) {
      if (!sans.length || sans.length > 20) return null;
      return book.get(sans.map(clean).join(' ')) || null;
    },
    /* Name of the deepest book position the game passed through. */
    nameFor(sans) {
      let name = null;
      for (let i = 1; i <= Math.min(sans.length, 20); i++) {
        const b = book.get(sans.slice(0, i).map(clean).join(' '));
        if (!b) break;
        name = b.name;
      }
      return name;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
