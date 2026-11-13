# App-AlenaMaus: Deck App (working title)

A web app that turns notes into a presentation that doesn't look like
everyone else's. Based on the idea overview "AI decks that don't look AI-made".

**First users:** students (seminar presentations, paper talks, teaching, group projects).

## Two looks

- **Poster** (new, default): Summit, Cut-out and Monolith (`src/library/posters.js`).
  Cover, section, statement, key-figure and question slides are built like film
  posters: a colour-graded photo, one giant word (behind the subject, filled with
  the photo, or spanning the width) and small widely spaced labels. Content slides
  use the regular forms in the same type and colours.
- **Editorial:** the 15 directions below.

Poster fonts (Anton, Bebas Neue, Six Caps) are in `fonts/` under the SIL Open
Font License. Sample photos are from Wikimedia Commons (see
`src/sample/photos/credits.json`); every photo shown is cited on the Works Cited slide.

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
3. Deploy to Vercel (Unsplash photos, ImageKit cut-outs and colour grades)
4. AI step: copy-paste with your own Claude, plus a rule-based fallback
5. PowerPoint export with embedded poster fonts

## Run locally

```bash

npm start          # serves on http://localhost:8080
npm test           # engine tests (Node 20+)
```

No build step and no dependencies yet.
