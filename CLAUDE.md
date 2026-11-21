# Unprompted: working rules

See README.md for how the app works.

## Before every commit that touches layout, fonts, forms or looks

1. `npm test`: all tests pass.
2. `npm run audit`: 0 findings. It renders the test decks (`tools/audit/decks.js`) in every
   direction and density in headless Chromium and reports text that overflows its box or the
   slide, words broken mid-word, and text overlapping text (report: `audit-report/index.html`).
   Fix every finding, then run it again. Do not loosen a check to get to 0 unless the finding
   is a false alarm, and then say so in the commit message.
3. Look at screenshots of the slides you changed in at least two looks before saying it works.

When the person reports a new kind of layout problem, fix it and add content like theirs to
`tools/audit/decks.js` (or a test) so the whole class of problem is checked from then on.
After adding a font, run `tools/glyphs.py` so its real glyph widths are known.

## Design rules (from the person who owns this app)

- **Content first.** The relevant information is the main character of every slide. Design must
  not add extraneous load. Big type goes to meaningful words (headlines, statements, questions,
  key figures), never to numbering or decoration.
- **No decoration without information.** No chapter divider slides, no giant slide or section
  numbers, no shapes that hold nothing (blobs, glows, chrome objects, empty panels), no textures
  behind content. Shapes may stay when they contain or frame information.
- **Nothing spins, floats or drifts.** Entrances that show the order of content are fine; motion
  stops once the slide is shown.
- **Text fits.** Words and figures that must stay on one line get smaller rather than being cut or
  broken; text is sized with real glyph widths (`src/library/glyphs.js`).

## Redesigning an uploaded deck (`deck.verbatim`)

- The text stays word for word: no rephrasing, shortening, merging, splitting or translating,
  no slide or line left out, nothing added (no photos, no Works Cited the deck didn't have).
- The hierarchy stays as on the original slides: only a slide's own headline is a headline, no
  labels the app adds itself ("Thesis", "Question", "Key figure"), no heading/detail split unless
  the slide sets a lead-in apart, and lists keep their own marker (numbers, bullets or none).
  Where a slide shows no hierarchy, create none.

## Working with the person

- Explain changes in plain language (what changed for the user), not in code terms.
- Ask before merging to `main` unless told to merge.
