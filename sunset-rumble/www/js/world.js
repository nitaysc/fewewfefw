// The town: roads, blocks, everything solid, ramps and boost pads.
// Pure data with no three.js, so the physics, the bots and the node tests share it.
// Both phones in an online match build the exact same town from the same seed.

export const HALF = 126;            // drivable area is [-HALF, HALF] on x and z
export const ROAD_LINES = [-90, -30, 30, 90];
export const ROAD_HALF = 8;         // roads are 16 wide
export const SIDEWALK = 3;

// a small seeded random, so the town is identical everywhere
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// block edges along one axis: [-126,-98], [-82,-38], [-22,22], [38,82], [98,126]
const EDGES = (() => {
  const e = [];
  const pts = [-HALF, ...ROAD_LINES.flatMap((r) => [r - ROAD_HALF, r + ROAD_HALF]), HALF];
  for (let i = 0; i < pts.length; i += 2) e.push([pts[i], pts[i + 1]]);
  return e;
})();

// What fills each block, by [ix][iz] (ix: west→east, iz: south→north).
// The east column is the beach. Everything else is a mix of streets and set pieces.
const KIND = (ix, iz) => {
  if (ix === 4) return 'beach';
  if (ix === 2 && iz === 2) return 'plaza';
  if (ix === 3 && iz === 1) return 'gas';
  if (ix === 1 && iz === 3) return 'park';
  if (ix === 1 && iz === 1) return 'skate';
  if (ix === 3 && iz === 3) return 'park2';
  return 'city';
};

export function buildWorld(seed = 7) {
  const R = rng(seed);
  const boxes = [];     // solid: {x0,x1,z0,z1,h, kind, color}
  const circles = [];   // solid: {x,z,r, kind}
  const ramps = [];     // {x,z, ang, len, w, h}
  const pads = [];      // boost pads {x,z, ang, len, w}
  const blocks = [];    // {x0,x1,z0,z1, kind}
  const deco = { palms: [], trees: [], lamps: [], benches: [], cones: [] };
  const landmarks = {};

  const palette = ['#f6d7b0', '#f2b5a0', '#a9d8d0', '#c9b8e6', '#f4e3a1', '#b7d3f0', '#eac0d6', '#d8e2c4'];

  for (let ix = 0; ix < 5; ix++) {
    for (let iz = 0; iz < 5; iz++) {
      const [x0, x1] = EDGES[ix];
      const [z0, z1] = EDGES[iz];
      const kind = KIND(ix, iz);
      blocks.push({ x0, x1, z0, z1, kind, ix, iz });
      const m = SIDEWALK; // keep the sidewalk free
      const ix0 = x0 + m, ix1 = x1 - m, iz0 = z0 + m, iz1 = z1 - m;

      if (kind === 'city') {
        // split into a 2×2 grid of lots with alleys; skip a lot now and then for a shortcut
        const cx = (ix0 + ix1) / 2, cz = (iz0 + iz1) / 2;
        const alley = 7;
        const lots = [
          [ix0, cx - alley / 2, iz0, cz - alley / 2],
          [cx + alley / 2, ix1, iz0, cz - alley / 2],
          [ix0, cx - alley / 2, cz + alley / 2, iz1],
          [cx + alley / 2, ix1, cz + alley / 2, iz1],
        ];
        const narrow = (ix1 - ix0) < 30 || (iz1 - iz0) < 30;
        if (narrow) {
          // edge blocks: one or two long buildings
          const along = (ix1 - ix0) < (iz1 - iz0) ? 'z' : 'x';
          if (along === 'z') {
            boxes.push(mkB(ix0, ix1, iz0, cz - alley / 2));
            boxes.push(mkB(ix0, ix1, cz + alley / 2, iz1));
          } else {
            boxes.push(mkB(ix0, cx - alley / 2, iz0, iz1));
            boxes.push(mkB(cx + alley / 2, ix1, iz0, iz1));
          }
        } else {
          const skip = Math.floor(R() * 6); // 0..3 skips a lot, 4..5 keep all
          lots.forEach((l, k) => {
            if (k === skip) {
              // an open corner lot: a little parking with cones
              for (let c = 0; c < 3; c++) deco.cones.push({ x: l[0] + 3 + R() * (l[1] - l[0] - 6), z: l[2] + 3 + R() * (l[3] - l[2] - 6) });
              deco.trees.push({ x: (l[0] + l[1]) / 2, z: (l[2] + l[3]) / 2, s: 1 + R() * 0.4 });
              circles.push({ x: (l[0] + l[1]) / 2, z: (l[2] + l[3]) / 2, r: 0.9, kind: 'tree' });
              return;
            }
            boxes.push(mkB(...l));
          });
        }
      } else if (kind === 'plaza') {
        landmarks.fountain = { x: 0, z: 0 };
        circles.push({ x: 0, z: 0, r: 6.5, kind: 'fountain' });
        for (let a = 0; a < 8; a++) {
          const ang = a * Math.PI / 4 + Math.PI / 8;
          deco.palms.push({ x: Math.cos(ang) * 15, z: Math.sin(ang) * 15, s: 1 + R() * 0.3, r: R() * 6.28 });
          circles.push({ x: Math.cos(ang) * 15, z: Math.sin(ang) * 15, r: 0.7, kind: 'palm' });
        }
        // four boost pads pointing round the fountain (counter-clockwise)
        for (let a = 0; a < 4; a++) {
          const ang = a * Math.PI / 2;
          pads.push({ x: Math.cos(ang) * 10, z: Math.sin(ang) * 10, ang: -ang, len: 5, w: 4 });
        }
      } else if (kind === 'gas') {
        landmarks.gas = { x: (ix0 + ix1) / 2, z: (iz0 + iz1) / 2 };
        const g = landmarks.gas;
        // shop at the back, canopy with pillars in front
        boxes.push({ x0: g.x + 6, x1: ix1, z0: iz0 + 2, z1: iz1 - 2, h: 6, kind: 'shop', color: '#f3efe6' });
        for (const [px, pz] of [[-8, -7], [-8, 7], [2, -7], [2, 7]]) circles.push({ x: g.x + px, z: g.z + pz, r: 0.8, kind: 'pillar' });
        for (const pz of [-3, 3]) for (const px of [-3]) boxes.push({ x0: g.x + px - 1, x1: g.x + px + 1, z0: g.z + pz - 0.6, z1: g.z + pz + 0.6, h: 1.8, kind: 'pump', color: '#e5483e' });
      } else if (kind === 'park' || kind === 'park2') {
        // grass you can drive across, with trees to dodge and a jump in the middle
        const cx = (ix0 + ix1) / 2, cz = (iz0 + iz1) / 2;
        for (let t = 0; t < 9; t++) {
          let x, z, tries = 0;
          do { x = ix0 + 3 + R() * (ix1 - ix0 - 6); z = iz0 + 3 + R() * (iz1 - iz0 - 6); tries++; }
          while (tries < 30 && (Math.hypot(x - cx, z - cz) < 12 || circles.some((c) => Math.hypot(c.x - x, c.z - z) < 6)));
          const s = 0.9 + R() * 0.6;
          deco.trees.push({ x, z, s });
          circles.push({ x, z, r: 0.9 * s, kind: 'tree' });
        }
        const ang = kind === 'park' ? 0 : Math.PI / 2;
        ramps.push({ x: cx, z: cz, ang, len: 9, w: 7, h: 2.6 });
        deco.benches.push({ x: ix0 + 2, z: cz, ang: Math.PI / 2 }, { x: ix1 - 2, z: cz, ang: -Math.PI / 2 });
      } else if (kind === 'skate') {
        // an open lot with ramps facing each other
        const cx = (ix0 + ix1) / 2, cz = (iz0 + iz1) / 2;
        ramps.push({ x: cx - 9, z: cz, ang: Math.PI / 2, len: 8, w: 8, h: 2.4 });
        ramps.push({ x: cx + 9, z: cz, ang: -Math.PI / 2, len: 8, w: 8, h: 2.4 });
        ramps.push({ x: cx, z: cz - 11, ang: 0, len: 7, w: 6, h: 1.8 });
        for (const [dx, dz] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
          deco.palms.push({ x: cx + dx, z: cz + dz, s: 1.1, r: R() * 6.28 });
          circles.push({ x: cx + dx, z: cz + dz, r: 0.7, kind: 'palm' });
        }
      } else if (kind === 'beach') {
        // sand, palms, a lifeguard tower and the big wheel on the pier
        for (let k = 0; k < 4; k++) {
          const x = ix0 + 4 + R() * (ix1 - ix0 - 8);
          const z = iz0 + 4 + R() * (iz1 - iz0 - 8);
          if (circles.some((c) => Math.hypot(c.x - x, c.z - z) < 7)) continue;
          deco.palms.push({ x, z, s: 1 + R() * 0.4, r: R() * 6.28 });
          circles.push({ x, z, r: 0.7, kind: 'palm' });
        }
        if (iz === 3) {
          landmarks.wheel = { x: 118, z: (iz0 + iz1) / 2 };
          circles.push({ x: 118, z: landmarks.wheel.z - 5, r: 1.6, kind: 'wheel' });
          circles.push({ x: 118, z: landmarks.wheel.z + 5, r: 1.6, kind: 'wheel' });
        }
        if (iz === 1) {
          landmarks.tower = { x: 116, z: (iz0 + iz1) / 2 };
          boxes.push({ x0: 114, x1: 118, z0: landmarks.tower.z - 2, z1: landmarks.tower.z + 2, h: 5, kind: 'tower', color: '#f06b5b' });
        }
      }
    }
  }

  function mkB(x0, x1, z0, z1) {
    const w = x1 - x0, d = z1 - z0;
    const tall = R() < 0.18;
    const h = tall ? 32 + R() * 30 : 9 + R() * 16;
    return { x0, x1, z0, z1, h: Math.round(h), kind: tall ? 'tower' : 'house', color: palette[Math.floor(R() * palette.length)], w, d };
  }

  // boost pads on the long avenues, pointing both ways
  for (const r of [-30, 30]) {
    pads.push({ x: r - 4, z: -60, ang: 0, len: 6, w: 5 });
    pads.push({ x: r + 4, z: 60, ang: Math.PI, len: 6, w: 5 });
    pads.push({ x: -60, z: r + 4, ang: Math.PI / 2, len: 6, w: 5 });
    pads.push({ x: 60, z: r - 4, ang: -Math.PI / 2, len: 6, w: 5 });
  }

  // street lamps along the roads (decoration only)
  for (const r of ROAD_LINES) {
    for (let t = -120; t <= 120; t += 30) {
      if (ROAD_LINES.some((q) => Math.abs(q - t) < 12)) continue;
      deco.lamps.push({ x: r + ROAD_HALF + 1.2, z: t, ang: -Math.PI / 2 });
      deco.lamps.push({ x: t, z: r - ROAD_HALF - 1.2, ang: 0 });
    }
  }

  // road intersections double as waypoints for the bots
  const nodes = [];
  for (const x of ROAD_LINES) for (const z of ROAD_LINES) nodes.push({ x, z });
  // the ends of each road at the edge of the town too
  for (const r of ROAD_LINES) {
    nodes.push({ x: r, z: -HALF + 6 }, { x: r, z: HALF - 6 }, { x: -HALF + 6, z: r }, { x: HALF - 14, z: r });
  }

  const spawns = [
    { x: -30, z: -60, h: 0 },
    { x: 30, z: 60, h: Math.PI },
  ];

  const world = { seed, boxes, circles, ramps, pads, blocks, deco, landmarks, nodes, spawns, HALF };
  world.links = linkNodes(world);
  return world;
}

// --- geometry helpers shared by physics and bots ---

// How high the ground is at (x,z): 0 except on a ramp.
export function groundAt(world, x, z) {
  for (const r of world.ramps) {
    const s = Math.sin(r.ang), c = Math.cos(r.ang);
    const dx = x - r.x, dz = z - r.z;
    const along = dx * s + dz * c;          // ramp rises along its facing
    const side = dx * c - dz * s;
    if (Math.abs(side) <= r.w / 2 && along >= -r.len / 2 && along <= r.len / 2) {
      return r.h * (along + r.len / 2) / r.len;
    }
  }
  return 0;
}

// what's under the wheels, for grip and dust
export function surfaceAt(world, x, z) {
  if (x > 98) return 'sand';
  for (const b of world.blocks) {
    if (x > b.x0 + SIDEWALK && x < b.x1 - SIDEWALK && z > b.z0 + SIDEWALK && z < b.z1 - SIDEWALK) {
      if (b.kind === 'park' || b.kind === 'park2') return 'grass';
      return 'paved';
    }
  }
  return 'road';
}

export function padAt(world, x, z) {
  for (const p of world.pads) {
    const s = Math.sin(p.ang), c = Math.cos(p.ang);
    const dx = x - p.x, dz = z - p.z;
    if (Math.abs(dx * s + dz * c) < p.len / 2 && Math.abs(dx * c - dz * s) < p.w / 2) return p;
  }
  return null;
}

// is the point clear of everything solid (with a margin)?
export function isFree(world, x, z, m = 1.8) {
  if (Math.abs(x) > HALF - m || Math.abs(z) > HALF - m) return false;
  for (const b of world.boxes) if (x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m) return false;
  for (const c of world.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + m) return false;
  for (const r of world.ramps) if (Math.hypot(x - r.x, z - r.z) < Math.max(r.len, r.w) / 2 + m) return false;
  return true;
}

// does a straight drive from a to b stay clear? (sampled; good enough for the bots)
export function clearLine(world, ax, az, bx, bz, m = 2.2) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.max(2, Math.ceil(d / 2));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    if (Math.abs(x) > HALF - m || Math.abs(z) > HALF - m) return false;
    for (const b of world.boxes) if (x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m) return false;
    for (const c of world.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + m) return false;
  }
  return true;
}

function linkNodes(world) {
  const links = world.nodes.map(() => []);
  world.nodes.forEach((a, i) => world.nodes.forEach((b, j) => {
    if (i < j && (a.x === b.x || a.z === b.z) && clearLine(world, a.x, a.z, b.x, b.z, 1.5)) {
      // only link neighbours along a road, not across the whole map in one hop
      const between = world.nodes.some((c, k) => k !== i && k !== j &&
        ((a.x === b.x && c.x === a.x && (c.z - a.z) * (c.z - b.z) < 0) ||
         (a.z === b.z && c.z === a.z && (c.x - a.x) * (c.x - b.x) < 0)));
      if (!between) { links[i].push(j); links[j].push(i); }
    }
  }));
  return links;
}

// a random clear spot to drop a star, away from the given cars
export function randomSpot(world, R, avoid = [], minDist = 14) {
  for (let tries = 0; tries < 200; tries++) {
    const x = (R() * 2 - 1) * (HALF - 6);
    const z = (R() * 2 - 1) * (HALF - 6);
    if (!isFree(world, x, z, 2.5)) continue;
    if (avoid.some((a) => Math.hypot(a.x - x, a.z - z) < minDist)) continue;
    return { x, z };
  }
  return { x: 0, z: 30 };
}
