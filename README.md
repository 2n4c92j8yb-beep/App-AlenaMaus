# App-AlenaMaus: Unprompted

A web app that turns notes into a presentation that doesn't look like
everyone else's. Based on the idea overview "AI decks that don't look AI-made".

**First users:** students (seminar presentations, paper talks, teaching, group projects).

## Four looks

- **Texture** (new): Survey, Drafting and Grain, built around generated surfaces
  (contour lines, blueprint grid, grainy gradient).

## Content first: no decorative numbers

The relevant information is the main character of every slide; design must not add
extraneous load. So there are no chapter divider slides (a giant "01" with a section name),
no giant slide numbers running off the edge, and list and step numbers stay small labels
(`numbers: 'large'` in a direction is drawn small). Where a design uses big type, it goes to
meaningful words: headlines, statements, questions, and a key figure that is itself content.
Orders saved with a divider slide drop it (`buildDeck`).
The same goes for decoration: shapes that hold nothing (colour spots, circles, glow blobs,
empty panels, corner squares, chrome objects) are gone; shapes that contain or frame
information (glass panels with text, the key figure's glowing card, the headline column,
the section tab) stay. Nothing spins, floats or drifts.

## Design kits: one identity, several effects

Every direction in every look keeps one identity (colours, type) but owns a small kit
of effects that suit it (`src/library/accents.js`). Nine generated surfaces are shared
between the kits (`src/library/textures.js`): contour lines, blueprint grid, grainy
gradient, film grain, thermal gradient, water ripples, single-hued landscape, speckled
graphite and fluted glass, plus a second background tone (`invert`) and a glowing glass
panel for key figures. A planner places them per deck:

1. textures are decoration, so they only go on the cover, which has no content to compete
   with; content slides stay plain or take the second tone (`invert`, no texture over it) or,
   for a key figure, the glowing panel that contains it
2. about a third of the slides; lists, comparisons, works cited and picture slides stay plain
3. never the same effect twice in a row, never two strong effects side by side
4. seeded by the deck, so "New directions" gives a new mix

- **Glass** (default): Prism, Pearl and Halo (`src/library/glass.js`).
  Frosted glass panels that hold the text, over soft coloured light, holographic or gold
  headlines and one glowing key figure per slide. No chrome objects or spotlights: they
  carried no information. On covers, small glass cards carry the deck's key facts. Cover,
  section, statement, question and key-figure slides have their own layouts;
  content slides use the regular forms, re-dressed by `glassify()` (soft panels
  become glass, pictures get rounded corners, Halo lights pictures like products).
  Fonts: Unbounded and Manrope (`fonts/`, SIL Open Font License). In the PowerPoint
  export, blur becomes a picture; all text stays editable.
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

## Redesigning an AI-made deck

"Upload AI slides" on the start screen takes a deck made with ChatGPT, Claude, Gamma,
Copilot, Canva or similar and rebuilds it in the closest of our directions, keeping its
general look (light or dark, type, accent colour, content) but dropping the AI tells.

1. **Reading, on the device** (`src/engine/import.js`): PDF pages become pictures with
   pdf.js 4.10 (`vendor/pdfjs/`, Apache-2.0, loaded only for PDFs); PowerPoint files are
   opened with the JSZip inside `vendor/pptxgen.bundle.js` (text, speaker notes, theme
   colours and fonts, background kinds, the largest pictures; browsers can't draw .pptx,
   so the app suggests a PDF export for the most faithful match); screenshots are used as
   they are; text and Markdown are notes. Up to 10 slide pictures, spread over the deck.
   Tool credits ("Made with Gamma"), page numbers, repeated footers and emoji are removed;
   the text lands in the notes box, where it can be edited, with Undo.
2. **Looking, on the server** (`api/analyse.js`, prompt in `src/engine/style.js`): Claude
   gets the pictures, text and theme and returns the content plus a style profile. The
   content is the deck's own text, **word for word**: one piece per uploaded slide, headlines
   and bullets unchanged (no rephrasing, shortening, merging or splitting), in the piece that
   matches how the slide is built (a bullet list stays a list of up to eight points, a block
   of text stays one block). `toPool(answer, { verbatim: true })` never shortens text or
   drops a list item (the layout shrinks the type instead and the editor says if something
   doesn't fit); a piece that doesn't suit its form (a "figure" that isn't a short number, a
   quote without an author, a timeline of nine events) becomes a list rather than being
   dropped. A deck with more than 40,000 characters of slide text is refused with a message
   instead of being cut (speaker notes are left out first). It adds no
   topic photos and no Works Cited slide the deck didn't have, and "Lighter" keeps every
   slide. The style profile covers light/dark/tint, serif/sans, tone,
   background, text and accent colours, surface (flat, gradient, glass, texture, photo),
   imagery, headline size, alignment, density, and the AI tells it can see (purple
   gradients, card grids, emoji bullets, stock icons, everything centred, generic stock
   photos, gradient text, glow blobs, bullet walls, drop shadows).
3. **Choosing, in code** (`src/engine/match.js`): every direction is scored against the
   profile (look fit, light/dark, type, tone, alignment, accent hue, background lightness);
   the best one is shown as "Closest to your deck", the best directions of two other looks
   as alternatives. Each card says why it fits and lists what changes.
4. **Keeping the theme:** the chosen direction's accent moves to the deck's accent hue and
   is checked for at least 3:1 contrast with the background; fonts, layout and background
   stay the direction's own.
5. **Keeping the order:** Claude marks every piece of content with the uploaded slide it
   comes from (each slide picture is labelled with its slide number, also for long PDFs
   where only a spread of pages is sent). When most pieces have one, the decks follow the
   original order (`AS_UPLOADED` in `src/library/structures.js`, laid out by
   `assembleInOrder()` in `src/engine/assemble.js`): pieces by slide number, Works Cited
   last (only if the deck had one). Adjust → Order →
   "Re-told" switches to our story structures instead (and brings back "New directions").

The results page shows the uploaded slides above the three cards (before and after).
Adjust → Tone re-runs the match; picking a look shows that look's own three directions,
and "Show the best match again" comes back. Same limits as the writing step (six an hour
per visitor); pictures of the slides go to Claude, as the privacy note says.

## Help me choose

Besides the automatic match, people can pick a design themselves. "Help me choose" on the
results page runs a few either/or rounds (usually 3 to 7) until one direction is left:

- Each round asks one question about a visible trait: light or dark background, flat or
  with depth (glass, texture), serif or sans-serif type, formal or relaxed, headline above
  or beside the content, left-aligned or centred (`TRAITS` in `src/engine/chooser.js`).
- It shows two directions side by side (stacked on phones), each with the person's own
  cover and the same content slide. The pair differs in the asked trait and as little as
  possible otherwise (same look where it can), so the comparison is about the question.
- Clicking one keeps that side; "No preference" skips the question; Back undoes an answer.
  When no question splits the rest any more, the last few meet head to head.
- Candidates are all directions that suit the occasion (in the uploaded deck's colours after
  a redesign); closeness to the upload or fit for the occasion only decides which direction
  represents a side, never the outcome.
- "Use this design" puts the pick first on the results page ("Your pick") and opens it;
  the pick is saved with the project.

## Editing slides

On the detail page every slide has **Edit**, move up/down, add after, duplicate and delete
(the cover can only be edited). Edit opens a panel with the slide's fields (beside the slides
on wide screens, a bottom sheet on phones) and a live preview: people change *content*, the
design engine lays the slide out again in the chosen direction on every keystroke, and a
message says when text no longer fits. Lists (points, steps, timeline events, comparison
points, sources) can grow, shrink and be reordered; pictures can be replaced; the cover edits
title, subtitle, author, course and date. "Add a slide" offers content Claude wrote that this
direction doesn't use, or an empty slide of six kinds.

- `src/engine/edits.js` (no DOM, tested in `tests/edits.test.js`): edits are one plain
  object. `items` (edited content by item id) and `cover` follow the content into every
  direction; `plans` hold the slide order of one deck (direction + story + density) once a
  slide is moved, deleted, duplicated or added, so other decks keep their own order and
  switching back restores it. `buildDeck({ plan })` lays out a stored order.
- `src/editor.js`: the panel, built from the field schemas in `edits.js`.
- Undo/Redo (50 steps) and "Discard all edits" (click twice). The project (notes, content,
  pictures, choices, edits, the open deck) is saved in the browser's localStorage after every
  change; the start screen offers "Continue your deck". New notes or a new upload start
  without the old edits. Present mode and the PowerPoint download use the edited slides.

## PowerPoint export

`src/export/pptx.js` (PptxGenJS 3.12, MIT, loaded on demand). Text stays editable; shapes,
transparency, rounded corners and glow are native; photos keep their colour grade; chrome
becomes pictures; light and textures are painted into one background picture per slide.
PowerPoint can't blur behind glass or fill letters with gradients or photos. Free fonts
that are not part of Office are not embedded: the app links them after the download.

## 3D chrome

The layouts no longer place chrome objects. The renderer (`src/render/chrome3d.js`, Three.js
r169, MIT) is kept for any that come back, and draws them once, standing still: nothing turns
or drifts.

## Present mode

`src/render/present.js` choreographs every slide with GSAP 3.13 (`vendor/gsap.min.js`,
GreenSock standard license, free including commercial use): one entrance per slide (the
headline leads, support follows with shrinking gaps, decoration only fades), then one click
per step where order carries meaning (process steps, timeline events, list points, the
second side of a comparison). Timeline bars grow along the time axis, key figures count up,
quotes and statements sharpen into focus, poster photos settle from a slight zoom. Slide
transitions follow the look: blur cross-fade (Glass), hard cut (Poster), slide-over
(Editorial, Texture). No ambient motion: once a slide has appeared, nothing on it keeps moving. Back shows the previous slide
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
3. Deployed on Vercel: done (deck-app-two.vercel.app). Photos for any topic: done
   (Wikimedia Commons, see below). Still open: ImageKit cut-outs
4. Writing step: done (Claude API on the server, copy and paste as fallback)
4c. Editing slides: done (fields panel with live preview, slide order, undo, saved on the device)
4b. Redesigning an uploaded AI deck: done (PDF, PowerPoint, screenshots, text; closest look and two alternatives; original slide order kept)
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
