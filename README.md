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
3. Deploy to Vercel (Unsplash photos, ImageKit cut-outs and colour grades)
4. AI step: copy-paste with your own Claude, plus a rule-based fallback
5. PowerPoint export with embedded poster fonts

## Run locally

```bash

npm start          # serves on http://localhost:8080
npm test           # engine tests (Node 20+)
```

No build step and no dependencies yet.
