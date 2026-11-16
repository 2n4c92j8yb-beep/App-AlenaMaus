# App-AlenaMaus: Unprompted

A web app that turns notes into a presentation that doesn't look like
everyone else's. Based on the idea overview "AI decks that don't look AI-made".

**First users:** students (seminar presentations, paper talks, teaching, group projects).

## Four looks

- **Texture**: Survey, Drafting, Grain, Memphis, Terra, Riso, Press, Waveform and Redline,
  built around generated surfaces (contour lines, blueprint grid, grainy gradient, Memphis
  squiggles and terrazzo, organic blobs, two-ink risograph halftone, op-art line waves,
  hand-drawn scalloped frames).

## Design kits: one identity, several effects

Every direction in every look keeps one identity (colours, type) but owns a small kit
of effects that suit it (`src/library/accents.js`). Nine generated surfaces are shared
between the kits (`src/library/textures.js`): contour lines, blueprint grid, grainy
gradient, film grain, thermal gradient, water ripples, single-hued landscape, speckled
graphite and fluted glass, plus a second background tone (`invert`) and a glowing glass
panel for key figures. A planner places them per deck:

1. an effect only where it means something (grid behind a process, ripples behind a
   question, contour lines opening a section, a landscape near the end …)
2. about a third of the slides; lists, comparisons, works cited and picture slides stay plain
3. never the same effect twice in a row, never two strong effects side by side
4. seeded by the deck, so "New directions" gives a new mix

- **Glass** (default): Prism, Pearl and Halo (`src/library/glass.js`).
  Frosted glass over soft coloured light, chrome objects (sphere, capsule, ring),
  holographic or gold headlines and one glowing key figure per slide. Cover,
  section, statement, question and key-figure slides have their own layouts;
  content slides use the regular forms, re-dressed by `glassify()` (soft panels
  become glass, pictures get rounded corners, Halo lights pictures like products).
  Fonts: Unbounded and Manrope (`fonts/`, SIL Open Font License). In the PowerPoint
  export, blur and chrome will become pictures; all text stays editable.
- **Poster**: Summit, Cut-out and Monolith (`src/library/posters.js`).
  Cover, section, statement, key-figure and question slides are built like film
  posters: a colour-graded photo, one giant word (behind the subject, filled with
  the photo, or spanning the width) and small widely spaced labels. Content slides
  use the regular forms in the same type and colours.
- **Editorial:** the 15 directions below, plus six built on the design laws:
  Bauhaus, Couture, Riot, Bento, Specimen and Duotone.


## Directions from reference pictures

Five directions were built from Alena's own design references (posters, landing pages,
brand illustration), grouped by what they share. They follow the references' principles,
not any one design:

- **Knockout** (Poster): teal-tinted photos, one giant white word across the cover, numbers
  cut out of the paper with the photo inside. From the word-meets-photo posters.
- **Press** (Texture): a photo panel over one full-width olive word, typewriter labels,
  grain. From the print-shop posters.
- **Waveform** (Texture): charcoal, a generated ring of fine orange-to-magenta lines.
- **Redline** (Texture): cream and one oxblood ink, hand-drawn scalloped frames and
  corner sketches, italic Garamond.
- **Frost** (Glass): a frosted panel over the deck's cover photo, softly blurred, with
  matte clay spheres (baked in two finishes, lit by a key light) instead of chrome.

## Design laws

Every direction follows named laws of design, written into its brief (`laws` in
`src/library/directions.js`, helpers in `src/library/laws.js`), read by the layout
engine and checked by `tests/laws.test.js`:

| Law | What it means here | Checked |
|---|---|---|
| Modular type scale | Headline sizes are steps on one ratio from a 21 pt body (minor third 1.2 up to the golden section 1.618); body text never grows past step 1, so a headline always outranks it | headline/body ≥ the direction's ratio on every content slide |
| Type pairing | Display and body faces contrast in one stated dimension (classification, width, weight, case, style, or one family); at most two typefaces plus one monospace. Every font carries its classification in `fonts.js` | the stated contrast really exists |
| Colour harmony | A named scheme (neutral + accent, monochromatic, analogous, complementary, split-complementary, triadic); Bauhaus is measured on the painters' red-yellow-blue wheel | the stated hues are the right distance apart |
| 60-30-10 | On content slides the accent covers at most a tenth of the slide | measured on every content slide |
| Contrast | Ink 7:1, secondary text 4.5:1 on the background and on tinted panels, accent text 3:1 | every direction |
| Grid | Margins and content start lines snap to a 1/8-inch baseline unit; side columns are built from a 12-column grid | margins and columns |
| Motion | Tempo and easing follow the style in Present mode: snap (Riot, Specimen), brisk, calm, slow (Couture, Terra, Gallery) | every slide carries its tempo |
| Movement | Each direction names the school it comes from (International Typographic Style, Bauhaus, Memphis …), so a critique can say what it is doing | stated for every direction |

The six new editorial directions:

- **Bauhaus**: red, yellow and blue circle, square and triangle, one geometric sans (Century Gothic).
- **Couture**: fashion editorial; Bodoni on a golden-section scale, huge margins, tracked capitals.
  Bodoni MT ships only with Office for Windows, so its headlines export as pictures.
- **Riot**: neo-brutalism; Arial Black, cobalt and yellow panels with thick outlines and hard
  offset shadows (native shapes in PowerPoint).
- **Bento**: rounded tiles on a 12-column grid, one indigo tile; text keeps clear of the mosaic.
- **Specimen**: experimental typography; one giant Anton word cropped by the slide edge.
- **Duotone**: two inks (navy and orange), photos printed in blue.

Poster fonts (Anton, Bebas Neue, Six Caps) are in `fonts/` under the SIL Open
Font License. Sample photos are from Wikimedia Commons (see
`src/sample/photos/credits.json`); every photo shown is cited on the Works Cited slide.

## App interface

Calm "gallery" shell so the decks are the stars: palette snow `#F7F7F7`, mist `#C8CED6`,
sand `#D4CAC5`, heather `#736A86`, night `#272A3B`; Manrope; round forms (pills, 14–30px
radii); short, calm transitions (view cross-fades, sliding look switch, cards rising in).
Start screen shows real covers from the three looks. Present mode: full-screen slide,
controls that fade while presenting, progress bar, swipe, overview grid (G), rotate hint
on phones. All motion stops under "reduce motion".

## Writing step (notes in, content out)

`api/generate.js` is a Vercel function that sends the notes to Claude (model `claude-opus-5-5`,
low effort for speed, structured output via a zod schema, server-side refusal fallback) and
returns a content pool. The prompt (`src/engine/content.js`) forbids invented facts, numbers,
quotes and sources; `toPool()` drops empty pieces and shortens anything too long for its slide
form. Without the server (or after an error) the app offers copy and paste: a ready prompt
for the user's own Claude and a box for the answer, checked by the same `toPool()`.

Setup: the Vercel project needs the environment variable `ANTHROPIC_API_KEY` for Production
and Preview. Set a monthly spend limit in the Anthropic Console. Per visitor: six decks an
hour (best effort), notes up to 15,000 characters.

## PowerPoint export

`src/export/pptx.js` (PptxGenJS 3.12, MIT, loaded on demand). Text stays editable; shapes,
transparency, rounded corners and glow are native; photos keep their colour grade; chrome
becomes pictures; light and textures are painted into one background picture per slide.
PowerPoint can't blur behind glass or fill letters with gradients or photos. Free fonts
that are not part of Office are not embedded: the app links them after the download.

## 3D chrome

The Glass look's spheres, rings and capsules are real 3D renders everywhere, not drawings.
`src/render/studio.js` defines one photo studio per Glass direction: a sky, a crisp dark
horizon and a lighter floor, soft-edged light panels (key box, strip lights, rim light, a
specular hot spot) and coloured cards in the direction's own palette, so the metal picks up
the colours of the slide. Iridescent pieces reflect a sweep of those colours and add a
thin-film shimmer; plain chrome gets a clear coat.

- **Previews, thumbnails and the PowerPoint export** use pictures baked from that studio
  (`src/render/chrome/*.webp`, 20 files, about 0.3 MB). Re-bake after changing the studio:
  `python3 tools/render-chrome.py` (Playwright and Chrome; software WebGL is enough).
- **Present mode** renders the same metal live with Three.js (r169, MIT, loaded on demand)
  and lets the reflections drift slowly; it fades in over the baked picture without a jump.
- **Grounding:** each object throws a soft shadow and a coloured light bounce onto the slide
  (`groundFor()`, shared by preview and export); objects marked `back` sit slightly out of focus.
- In the export, each object becomes one picture with its shadow; without WebGL, the baked
  pictures simply stay.

## Present mode

`src/render/present.js` choreographs every slide with GSAP 3.13 (`vendor/gsap.min.js`,
GreenSock standard license, free including commercial use): one entrance per slide (the
headline leads, support follows with shrinking gaps, decoration only fades), then one click
per step where order carries meaning (process steps, timeline events, list points, the
second side of a comparison). Timeline bars grow along the time axis, key figures count up,
quotes and statements sharpen into focus, poster photos settle from a slight zoom. Slide
transitions follow the look: blur cross-fade (Glass), hard cut (Poster), slide-over
(Editorial, Texture). One ambient motion per slide at most. Back shows the previous slide
complete; Shift+→ or S shows the rest of a slide at once; a click mid-animation finishes it.
Under "reduce motion" everything appears without movement. Without GSAP, a CSS build is
the fallback.

## How variety is created

The variety does not come from the AI model. Ordinary code samples from a
curated library, and the model (step 2) only fills in content:

| Library | File | Contents |
|---|---|---|
| Design directions | `src/library/directions.js` | 15 directions: palette, Office-safe fonts, layout logic, motif, occasions they suit |
| Story structures | `src/library/structures.js` | 8 structures (thesis first, question-led, chronological, example first, two sides, lesson arc, SCQA, problem–solution) |
| Slide forms | `src/library/forms.js` | 13 forms (key figure, comparison, process, timeline, quote, definition, before/after, question, …) |
| Occasions | `src/library/occasions.js` | 6 occasions with weights for structures |

`src/engine/sampler.js` picks three directions that must differ visibly
(light/dark, serif/sans, layout logic) and three different structures.
`src/engine/assemble.js` orders the content by structure; `forms.js` lays out
each slide as renderer-neutral elements (inches on a 16:9 canvas), so the HTML
preview and the PowerPoint export draw from the same data.

## Status

1. **Design library and previews: done** (sample content, no AI). No decorative lines; signature colour areas per direction; picture slides; picture upload; Present mode with builds
2. Poster look: 3 test directions done; extend after review
2b. Glass look: 3 directions done (Prism, Pearl, Halo)
2c. Texture look: 9 directions (Survey, Drafting, Grain, Memphis, Terra, Riso, Press, Waveform, Redline)
2d. Design laws: every direction states and passes them (see above)
3. Deployed on Vercel: done (deck-app-two.vercel.app). Photos for any topic: done
   (Wikimedia Commons, see below). Still open: ImageKit cut-outs
4. Writing step: done (Claude API on the server, copy and paste as fallback)
5. PowerPoint export: done (display fonts as pictures, see below)

## Pictures for any topic

The writing step also suggests up to five photographable subjects from the notes
(e.g. "Machu Picchu", "Lake Titicaca"). `src/engine/pictures.js` looks each one up:

- **Unsplash** first for landscapes, buildings and details, through `api/unsplash.js`
  so the access key stays on the server (Vercel environment variable
  `UNSPLASH_ACCESS_KEY`; `UNSPLASH_KEY`, `UNSPLASH_API_KEY` and `UNSPLASH_CLIENT_ID`
  work too). Photos are hotlinked and each use is reported, as Unsplash's API
  guidelines ask. A demo key allows 50 searches an hour; after that, Commons takes over.
- **Wikimedia Commons** first for historical subjects (artworks, manuscripts,
  portraits) and as the fallback: free licences only (CC0, public domain, CC BY,
  CC BY-SA), large photos, no maps, flags or logos.

The first photo becomes the cover, up to three more become picture slides, and all of
them serve as mood photos in the Poster look. Each photo has a credit line, and every
photo the deck shows is cited in MLA style on the Works Cited slide. Without either
service the deck is made without pictures; your own uploads still take priority.

## PowerPoint export

PowerPoint does not have the free fonts of the Poster and Glass looks and would swap in
wider ones, so headlines ran off the slides. Text in a display face (Bebas Neue, Anton,
Six Caps, Unbounded) is therefore exported as a sharp transparent picture drawn exactly
like the preview, with its words in the alt text and speaker notes; body text in
Manrope becomes editable Arial (almost identical widths); all other text stays editable.

## Run locally

```bash

npm start          # serves on http://localhost:8080
npm test           # engine tests (Node 20+)
```

No build step and no dependencies yet.
