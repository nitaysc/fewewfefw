# Whiskers & Coffee art guide (how every picture in the game is made)

Read this before adding or changing **any** art: people, cats, furniture, drinks, food,
walls, floors. Everything the player sees in the café comes out of this folder, so new art
made this way matches the rest automatically. Do **not** paint sprites by hand, cut them out
of AI images, or draw them in code in `www/js/art/*.js`. The owner rejected all three looks.

## 1. The look in one paragraph

Cozy, warm, "premium indie" pixel art. Every object is a small **3D model built from soft
rounded shapes** (rounded boxes, cylinders, capsules, ellipsoids, tori, smooth unions). It is
**lit by one warm light from the upper left**, with soft shadows and ambient occlusion, then
**snapped to hand-picked colour ramps**: 5-6 shades per material, hue-shifted cooler/redder in
shadow and warmer in light. Each sprite gets a **dark coloured outline** (never pure black):
the material's darkest shade, or a warm brown `(70, 40, 32)` for clothes. No dithering noise,
no anti-aliased edges, no white fringes. Faces are **hand-painted pixels** on top of the
render (eyes 2x5 px with a white catch-light, blush, a 2 px mouth).

## 2. Files

| File | What it is |
| --- | --- |
| `sdf.py` | The renderer. `render(scene, size, ppu, center, pitch, yaw, light)` returns RGBA pixels. Shapes: `rbox`, `cyl`, `ell`, `cap`, `torus`, `rcone`; combine with `smin` (soft union), `sub`, `inter`, `xform` (rotate), `rot_all`. Materials: `Mat(base_hex, shades, spread, tex=, spec=, emissive=, outline=, hs=, hl=)`. |
| `items.py` | Shared materials `M[...]` (oak, walnut, velvet, leather, glass, brass, leaf...) and the first furniture builders. |
| `models.py` | `MODELS = {catalog_type: builder}` for **every** catalog item. |
| `people.py` | `person(look, pose, yaw, ...)`: the chibi body, hair styles, clothes; `paint_face(...)`. |
| `cats.py` | `cat(coat, pose, ...)`, `COATS` colours, `render_cat(...)` with painted eyes and nose. |
| `room.py` | Floors (`FLOORS`), wall styles (`WALLS`), wall features (`feature(kind, length)`). |
| `food3d.py` | `drink(id, vessel, extra)` and `food(id)`: cups, glasses, layers, latte art, toppings, plates. |
| `build.py` | Renders everything into `www/img/r3/*.png` and writes `www/js/art/r3manifest.js`. |
| `catalog.json` | Sizes and rotations of the catalog items (exported from `www/js/game/catalog.js`). |

In the game, `www/js/art/r3.js` loads the pictures, picks animation frames and builds order
bubbles; `www/js/render.js` draws them (old art is only a fallback while loading).

## 3. Rebuilding

```
pip install numpy pillow            # the only dependencies
cd whiskers-coffee/tools/art3d
python3 build.py all room food      # everything, about 2 minutes on 4 cores
python3 build.py furniture          # or one group: furniture | people | cats | room | food
```

If you change the catalog (add an item, change a size or rotation), export it first:

```
cd whiskers-coffee
node -e "import('./www/js/game/catalog.js').then(m=>{const o={};for(const [k,v] of Object.entries(m.CATALOG)) o[k]={size:v.size,rotates:!!v.rotates}; require('fs').writeFileSync('tools/art3d/catalog.json', JSON.stringify(o))})"
```

Always look at the result before committing. Make a contact sheet of the new PNGs on a cream
background at 2-4x zoom and check it. Then run the game: `cd www && python3 -m http.server`
and open `index.html`.

## 4. Units, cameras and anchors (keep these exactly)

- **1 floor tile = 1 unit.** Heights: a chair seat 0.46, a table top 0.72, a counter 0.88,
  a standing person about 1.2 (big chibi head of radius 0.25), a sitting cat about 0.5,
  the walls 2.4.
- In the game's world pixels a unit is 16 px across a tile and **19.6 px of height**. So any
  height the game logic needs (catalog `seatZ`, `surface`, `perch`, `glow`) = units x 19.6,
  rounded.
- **Furniture, room, wall features:** true 2:1 isometric, `pitch=30, yaw=45`,
  `PPU = 16*sqrt(2)*K3` with **K3 = 2** picture pixels per world pixel. The light is
  `(-0.35, 0.85, 0.45)`.
- **People:** a lower camera (`people.PITCH = 14`, yaw 0) so faces read. The body is turned
  instead: front view `yaw=0.3`, back view `pi-0.3`; seated poses turn more (`0.62`) so the bent
  legs show. Pictures face **right**; the game mirrors them for left.
- **Cats:** `cats.CPITCH = 20`, slightly bigger (`PPU*1.12`), pictures face right.
- **Drinks and food:** `pitch=34, yaw=-20`, three sizes: `s` (in the café: in hands, on tables),
  `m` (order bubbles), `b` (menus and the order list).
- **Anchors** are stored per picture in the manifest as `[w, h, ax, ay]`:
  furniture = the item's back floor corner (tile `x, y`); people = the point between the feet,
  or the hips when seated; cats = under the paws; drinks and food = the bottom centre;
  the room = world origin. The game draws a picture at `world_point - anchor / K3`.
- A furniture model is **centred on its footprint, stands on y = 0 and faces +z** (that is
  rot 0, facing down-left on screen). `build.py` turns it for rot 1-3 (`-rot * pi/2`).

## 5. Adding things

### A new piece of furniture
1. Add the item to `CATALOG` in `www/js/game/catalog.js` (name, cat, price, size, rotates,
   seat/seatZ, surface/table, perch, glow...). Keep the `paint(p)` fallback (any existing one).
2. Write a builder in `models.py` and register it in `MODELS`. Reuse materials from `M` / `MX`,
   keep the real-world proportions above, round every edge (`rbox(..., r)`), and give flat
   surfaces a little texture (`wood(...)`, `stripes`).
3. Export `catalog.json`, run `python3 build.py furniture`, check all four turns.
4. If it is a seat, table or perch, set its height in the catalog (units x 19.6).

### A new character (customer or barista)
1. Add a look to `LOOKS` in `build.py`: `skin, hair, top, top2 (sleeves), pants, shoes,
   style (bob | long | bun | messy | short)`, optional `apron, scarf, glasses, backpack, hat:
   'beanie' + hatc, ears (cat ears)`.
2. Add the name to `PEOPLE3` in `www/js/art/r3.js`, to `MODELS` in `www/js/art/refsprites.js`
   (the character picker reads names from there) and, for customers, to `CUSTOMER_MODELS`.
3. `python3 build.py people`. Every character gets the same frames:
   `p_<name>_<f|b>_<idle0-1 | walk0-3 | carry0-3 | carryidle0 | sit0 | sip0 (front only)>`.
4. New hairstyle or clothing piece: add it in `people.person()` from the same shapes. Keep the
   face clear: hair is cut away from the face (`face_cut`) and a fringe is added on top.

### A new cat coat
Add it to `COATS` in `cats.py` (`base`, `light`, `eye`, optional `patch` colours, `points`,
`stripes`) and to the game's coats in `www/js/art/cats.js`, then `python3 build.py cats`.
Frames: `c_<coat>_<sit0-2 | walk0-3 | sleep0-1 | groom0-1 | happy0>`.

### A new drink or dish
1. Add it to the game data (`DRINKS` in `www/js/art/drinks.js` or `FOODS` in `www/js/art/foods.js`).
2. Drinks: add its layers (bottom to top, share of the cup) to `LAYERS` and its top colour to
   `TOP` in `food3d.py`, the cup to `DRINK_VES` and allowed extras to `DRINK_EXTRAS` in
   `build.py`. Toppings (latte art, dust, drizzle, cream, ice, fruit) are drawn in `drink()`.
   Dishes: add a branch to `food()` built on `plate()` or `bowl()`, and the id to `FOOD_IDS`.
3. `python3 build.py food`. Pictures: `d_<id>[_<extra>]_<s|m|b>` and `f_<id>_<s|m|b>`.

### A new wallpaper, floor or wall feature
Wallpaper: `WALLS` in `room.py` (base colour, pattern, accent, wainscot colour) plus the
game's `WALL_STYLES`. Floor: `FLOORS` plus `FLOOR_STYLES`. Wall feature: a branch in
`room.feature()` and its `(type, length)` in `FEATS` in `build.py`. Then `python3 build.py room`.

## 6. Quality checklist (what the owner noticed before)

- Nothing cut off: no sprite may touch its canvas edge. `crop_save` crops, but the canvas you
  render into must be big enough.
- No white or pale halos and no stray pixels around sprites.
- Faces visible and both eyes on the face. Never turn a head so far that one eye sits on its
  edge.
- Everything in one style: if something on screen is still drawn the old way (flat pixel
  rectangles, dotted glows, hard square shadows), replace it with art from this pipeline
  or a smooth canvas effect.
- Sizes are believable next to each other: a cup in a hand, a cat beside a chair, a person
  at a table.
- Look at the result in the running game, at the phone's zoom, before pushing.
