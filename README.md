# App-AlenaMaus: Deck App (working title)

A web app that turns notes into a presentation that doesn't look like
everyone else's. Based on the idea overview "AI decks that don't look AI-made".

**First users:** students (seminar presentations, paper talks, teaching, group projects).

## Four looks

- **Texture** (new): Survey, Drafting and Grain, built around generated surfaces
  (contour lines, blueprint grid, grainy gradient).

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
- **Editorial:** the 15 directions below.

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

In Present mode, chrome objects become real 3D metal with Three.js (r169, MIT, loaded on
demand): reflections of a small studio that drift slowly, iridescence on holo pieces.
Thumbnails, the slide list and exports keep the vector drawings; without WebGL they stay.

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
2c. Texture look: 3 of 8 directions done (Survey, Drafting, Grain)
3. Deployed on Vercel: done (deck-app-two.vercel.app). Still open: photos for other topics
   (Unsplash, ImageKit cut-outs and colour grades)
4. Writing step: done (Claude API on the server, copy and paste as fallback)
5. PowerPoint export: done (fonts are linked, not embedded)

## Run locally

```bash

npm start          # serves on http://localhost:8080
npm test           # engine tests (Node 20+)
```

No build step and no dependencies yet.
