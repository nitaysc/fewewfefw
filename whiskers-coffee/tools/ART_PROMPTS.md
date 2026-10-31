# Making new art for Whiskers & Coffee

The game's characters, cats and much of the furniture come from the reference sheets in
`docs/art-references/`. New art made with the prompts below keeps the same style, and
`tools/auto_extract.py` cuts it straight into the game.

## Rules that make a sheet usable

1. **Flat plain background**, one colour, cream `#F0E7D6`. No dotted guide lines, no
   grid, no paper texture, no vignette.
2. **Space between sprites**: at least about 100 px of empty background around each one.
   Nothing touching or overlapping.
3. **No text near the sprites.** A title at the very top is fine; leave labels off
   everything else.
4. **Same size as the existing sheets**: landscape, about 2752×1536, with a standing
   character about 430 px tall (the art pixels are about 4–5 screen pixels each).
5. **One thing per drawing**, full body or whole object, nothing cropped at the edges.
6. **Furniture camera**: the 3/4 top-down "isometric" view of the reference sofas and
   chairs: we look down at about 30°, and the object's front faces toward the bottom left.
   For anything people sit on, also ask for the other three facings (see sheet 3).

## The style block (paste this into every prompt)

> Cozy pixel art game sprite sheet, in the exact style of a warm cat café game: soft
> pixel art at about 64–96 pixels tall per character, chibi proportions (big head,
> about 2.5 heads tall), large dark-brown eyes with a white highlight, pink blush, a small
> smile, soft brown outlines (not pure black), warm muted palette (browns, cream, sage
> green, dusty pink, slate blue), gentle shading with light from the top left, no
> anti-aliasing blur, crisp square pixels. Plain flat cream background (#F0E7D6), each
> sprite separated by generous empty space, no text labels, no guide lines, no
> shadows on the background except a soft small shadow directly under furniture.

---

## Sheet 1: the coffee counter (most wanted)

> [style block] A sprite sheet of cat café counter pieces, all in 3/4 top-down isometric
> view facing toward the bottom left, warm wood with cream tops: (1) an espresso machine
> sitting on a wooden counter section, chrome with a red stripe, two pressure gauges,
> cups on top; (2) a plain wooden counter section the same size; (3) a counter section
> with a cash register; (4) a glass cake display case on a wooden counter, with
> strawberry shortcake, chocolate cake and cheesecake slices inside; (5) a counter
> section with a coffee grinder and jars of beans; (6) a corner counter piece; (7) a tall
> wooden shelf with jars, cups and a small plant. Each piece about the width of the
> reference sofa. Plain flat cream background, wide spacing, no labels.

## Sheet 2: characters sitting (so everyone sits properly)

> [style block] A sprite sheet of seated customers for a cozy cat café game, the same
> characters as the reference: a girl with long pink hair in a beige coat and scarf, a
> man with messy black hair in a green jacket and jeans, a girl with long brown hair in a
> white sweater and dark skirt, a young man with a beige cap and apron, a boy in a black
> hoodie. For each character, four seated poses on an invisible chair: facing the viewer
> holding a coffee cup with both hands; facing the viewer eating cake with a fork; seen
> from behind; seen from the side (facing right). Legs bent at the knee, feet on the
> ground. Plain flat cream background, wide spacing, no labels, no chairs.

## Sheet 3: seats from every side

> [style block] A sprite sheet of café seating in 3/4 top-down isometric view. For each
> item draw four facings in a row: front facing bottom-left, front facing bottom-right,
> back toward the viewer facing top-left, back toward the viewer facing top-right. Items:
> a wooden café chair with spindle back, a green velvet armchair, a pink armchair, a grey
> three-seat sofa, a brown leather sofa with cushions, a round wooden stool. Plain flat
> cream background, wide spacing, no labels.

## Sheet 4: new characters (walk cycle and views)

> [style block] A character sprite sheet for a cozy cat café game. Three new customers:
> [describe each, e.g. "an older man with grey hair and a cardigan", "a girl with a
> bob haircut and yellow raincoat", "a student with glasses and a backpack"]. For each
> character, one row: front view standing, back view standing, side view facing right
> standing, then a 4-frame walking cycle seen from the side facing right. Same height and
> proportions for all. Plain flat cream background, wide spacing, no labels.

## Sheet 5: baristas (player characters)

> [style block] Barista character sprite sheet: [describe, e.g. "a girl with a short
> black bob, white shirt and sage green apron" / "a boy with curly red hair, cream shirt
> and brown apron" / "a girl with a high ponytail and cat-ear headband"]. For each: front,
> back, side facing right, a 4-frame side walking cycle, holding a tray with a coffee cup
> (front view), and steaming milk at a machine (side view). Plain flat cream background,
> wide spacing, no labels.

## Sheet 6: more cats

> [style block] Cat sprite sheet in the same style as the reference orange tabby and
> calico. Coats: cream, siamese (cream with dark brown face, ears and tail), grey tabby,
> pure black, tuxedo, white. For each cat one row: sitting facing the viewer, a 4-frame
> walking cycle facing right, sleeping curled up, grooming a paw, stretching, sitting
> seen from behind. Same size for all cats. Plain flat cream background, wide spacing,
> no labels.

## Sheet 7: decor and plants

> [style block] Cozy café decor sprite sheet in 3/4 top-down isometric view: a tall
> bookshelf with books and a cat figurine, a floor lamp with a warm shade, a round rug
> with a paw pattern, a large fiddle-leaf fig in a terracotta pot, a small succulent on a
> stool, a hanging pothos plant, a wooden plant stand with three pots, a framed cat
> painting (front view, for a wall), a round wall clock, a wall shelf with jars, a
> window with cream curtains (front view), a neon "Whiskers Cafe" sign (front view).
> Plain flat cream background, wide spacing, no labels.

## Sheet 8: seasonal sets

> [style block] Seasonal café decor in 3/4 top-down isometric view facing bottom left.
> Autumn: pumpkins, a hay bale seat, a basket of apples, a maple-leaf rug. Winter: a
> small decorated Christmas tree with lights, a pile of presents, a brick fireplace, a
> snowman plush. Spring: cherry blossom tree in a pot, a flower cart. Plain flat cream
> background, wide spacing, no labels.

## Optional: walls and floors

Walls and floors are drawn by the game in code at an isometric angle, so pictures need a
little extra work to use. If you'd like them anyway, ask for:

> Seamless square pixel art textures, flat top-down, 64×64 pixels each, cozy café
> style: oak floor planks, dark walnut planks, cream and terracotta checker tiles,
> cream plaster wall with thin stripes, sage wallpaper with small leaves, red brick, dark
> wood wainscot panel. Arranged in a grid with space between them.

---

## Adding a finished sheet to the game

1. Put the image in `docs/art-references/` (for example `counter-sheet.png`).
2. Run `python3 tools/auto_extract.py docs/art-references/counter-sheet.png counter`
   (needs `pip install numpy pillow scipy`). It writes `www/img/ref/counter_01.png`,
   `counter_02.png`… and `counter_contact.png` showing which number is which, and
   updates `manifest.json` and `www/js/art/refmanifest.js`.
3. Rename the files you want (and their manifest keys), then map them in
   `www/js/art/refsprites.js`: people in `MODELS`, cats in `CAT`, furniture in
   `FURNITURE` (with a picture per quarter turn and a width in café pixels), and add new
   furniture to `game/catalog.js` and `SHOP_ORDER`.
4. `npm test`, try it in the browser, push: the APK builds by itself.

When you're working with Claude, just send the sheet and say what's on it. It knows this
workflow from the handoff notes.
