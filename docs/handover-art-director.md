# Handover: the art director step

For Claude Code, working in `app-alenamaus` (Unprompted). Written 16 Nov 2026 against commit `57a3995`, with all 73 tests passing.

## Why

Unprompted currently works like a catalogue. Claude writes the content (`api/generate.js`). Code then samples three of the hand-made directions (`src/engine/sampler.js`) and pours the content into them (`src/engine/assemble.js`, `src/library/forms.js`). The README states this on purpose: "The variety does not come from the AI model."

That design keeps the AI tells out, but it causes two problems:

1. **The looks become recognisable.** With a fixed set of directions, every Unprompted deck eventually looks like an Unprompted deck. A recognisable tool look is itself a tell.
2. **The design ignores the content.** A talk on Bauhaus and a talk on supply chains get the same choices. A human designer starts from the topic and the argument: which point deserves the big moment, what can be cut, where one word is enough.

The product goal is still **a presentation made by AI that looks made by a person**.

## The idea in one paragraph

After the writing step, a second Claude call acts as **art director**. It reads the finished content and makes design decisions for this one deck: which base direction fits the topic, how to shift its accent colour, which pieces to use and in what order, where sections break, which slide gets the loud moment and which stays almost empty. **Claude makes decisions; code draws.** The art director never produces coordinates, CSS or free-form colours. Its answer is a small JSON spec. Code validates that spec against the library's rules and the AI-tell list, repairs or rejects it, and renders it through the existing `buildDeck()`. The library stops being a set of finished templates and becomes the rules Claude composes within.

## What already exists and should be reused

You should not need to rewrite the renderer. These pieces already do most of the work:

| Need | Already there |
|---|---|
| Render a deck from an explicit slide list | `buildDeck({ deck, direction, structure, density, plan })` in `src/engine/build.js`. `plan` replaces the story structure's order. |
| Stable item ids to reference content | `withIds(pool)` in `src/engine/edits.js` (`${kind}-${index}`) |
| Plan format (stored and resolved) | `planOf()` and `resolvePlan()` in `src/engine/edits.js` |
| Shift an accent hue while keeping contrast of at least 3:1 | `adaptDirection(dir, profile)` in `src/engine/match.js` (takes `profile.colors.accent`) |
| Contrast check | `contrast()` in `src/library/forms.js` |
| AI-tell vocabulary | `TELLS` and `FIXES` in `src/engine/match.js` |
| Slide rhythm for effects (textures, invert, glow) | `assignAccents()` in `src/library/accents.js`. Leave it in charge of effects in phase 1. |
| Server call pattern with an injectable client, refusal fallback and `parseAnswer` | `writeDeck()` in `api/generate.js` |
| Kind to form mapping | `FORM_FOR_KIND` in `src/library/structures.js` |
| Direction catalogue | `DIRECTIONS` in `src/library/directions.js` (editorial, glass, poster and texture families) |

## Phase 1: the art director, behind a flag

Work on a branch called `art-director`. Keep `main` deployable throughout.

### 1. The spec (what Claude returns)

```json
{
  "direction": "fieldnotes",
  "accentHue": 152,
  "why": "One sentence a student would understand, saying why this look suits this topic.",
  "slides": [
    { "id": "claim-0", "kicker": "" },
    { "section": "How it started" },
    { "id": "figure-3", "moment": "loud" },
    { "id": "quote-1", "moment": "quiet" },
    { "id": "image-0" }
  ],
  "dropped": ["points-5", "claim-7"]
}
```

- `direction` is an id from `DIRECTIONS`. In phase 1, only the **editorial** family may be picked. Glass, Poster and Texture have their own composers (`glass.js`, `posters.js`, `textures.js`), and you should check how they read `direction` before letting the art director choose them.
- `accentHue` is optional, from 0 to 359. Apply it with `adaptDirection(dir, { colors: { accent: <hex at that hue> } })` so the contrast rule holds. Claude never sends hex codes for background or ink.
- `slides` is the order. Entries reference pool ids or are section dividers. The cover is added by code at the start and Works Cited at the end. Claude does not list them.
- `moment` is a hint about rhythm: `loud`, `quiet` or absent. In phase 1, map `loud` on a `statement` slide to the full accent background (the `accentStatements` branch in `forms.js`). Elsewhere, record it and ignore it. Phase 2 makes more use of it.
- `dropped` lists pieces left out on purpose. Leaving pieces out is part of looking human.

### 2. The prompt (`src/engine/director.js`)

Use the same split as `content.js`: export `SYSTEM_PROMPT`, a `jsonPrompt()` and a `toSpec(answer, pool)` that checks and cleans the answer. Send:

- The pool items with ids, kind, a short text excerpt, tags and weight. Leave out picture binaries.
- The occasion and formality.
- The editorial directions as a compact catalogue: id, name, blurb, tags and suits. Do not send the layout internals.
- The rules below, written as instructions.

The rules for the art director:

- Start from the topic and the argument, not from a template. Pick the direction whose blurb fits the subject matter. Use the hue to tie the deck to the topic (for example green for a botany seminar), but only when it helps.
- One idea per slide. The deck should have an uneven rhythm: some dense slides, some almost empty, at most one or two loud moments.
- Never put more than two slides of the same form in a row. Never use more than two `points` slides in a deck.
- Use section dividers only when there are at least two real sections.
- Drop weak or repetitive pieces. A deck of 9 strong slides beats a deck of 15 complete ones.
- Pictures go where they carry an argument, never as a decoration between every slide.
- Avoid the tells in `TELLS`. List them by name in the prompt.

Model: the `MODEL` constant from `api/generate.js`. Start with `effort: 'medium'` and measure the time it takes. This is the step where judgement matters, so don't default to `low` without comparing.

### 3. Validation and repair in code (`toSpec`)

Code has the final word. `toSpec` must:

- Drop unknown ids, duplicates and directions that don't exist or aren't allowed. Fall back to the sampler's first pick when no valid direction is left.
- Enforce the rhythm rules above by moving or dropping slides, not by rejecting the whole spec.
- Make sure the thesis is present whenever the pool has one.
- Turn the result into a `plan` (`{ form, item, kicker, sectionNo }`, with the form taken from `FORM_FOR_KIND` and pictures alternating between `photo` and `photoSplit` as `assembleDeck` does).
- Return `{ direction, plan, why, warnings }`. `warnings` lists every repair made, for the evaluation.

If the call fails, is refused or produces nothing usable, the app falls back to today's sampler path silently. The copy-and-paste fallback keeps using the sampler, so don't add a second paste step.

### 4. Server function (`api/direct.js`)

Base this on `api/generate.js`: same key handling, same refusal and `max_tokens` handling, and the same visitor limit. Count a deck once, not once for each call. Input: `{ pool, occasionId, formality, avoid: [directionIds] }`. `avoid` is for "Another take". Output: the cleaned spec. Use a separate endpoint rather than a second call inside `generate.js`. That keeps each function well inside `maxDuration`, lets the UI show progress between the two steps, and lets the redesign path reuse the same call later.

### 5. Building the deck (`src/engine/build.js`)

Add `buildDirected({ pool, spec, occasionId, density })`. It calls `buildDeck` with the adapted direction and the plan. It needs a pseudo-structure, for example `{ id: 'director', name: 'Art director' }`, because `deckKey()` in `edits.js` keys saved edits by `direction.id|structure.id|density`. Check that editing, reordering, undo, Present mode and the PowerPoint export all work on a directed deck. They should, because they all go through `buildDeck`.

### 6. Interface, behind `?director=1`

When the flag is set, the results page shows **one deck large**, with Claude's `why` line underneath. It has two buttons:

- **Another take:** calls `api/direct.js` again, with the current direction in `avoid`.
- **See classic directions:** switches to today's three-card view.

Without the flag, nothing changes. Follow the interface conventions in the README (calm gallery shell, Manrope, round forms, everything still under reduced motion). Run the `web-interface-guidelines` skill on the new view before you commit.

### 7. Tests

Keep all 73 existing tests passing. Add `tests/director.test.js` with a fake client, using the same pattern as the `writeDeck` tests:

- A valid spec becomes the expected plan.
- Unknown ids, three of the same form in a row, a missing thesis and a disallowed family are all repaired, with warnings.
- A refusal, unreadable JSON and an empty spec fall back to the sampler.
- `avoid` is respected.
- A directed deck survives `planOf` and `resolvePlan` round trips, and the PowerPoint export data matches the HTML slide data.

## Phase 2: the blind comparison (decides whether this ships)

Don't make the art director the default because it is new. Make it the default only if it wins.

1. Collect **3 to 5 sets of real student notes**. Matteo provides these. Add the built-in sample (`src/sample/great-vowel-shift.js`) as one more set.
2. Run the writing step once for each set and save the pool as a fixture under `tests/fixtures/eval/`. Both sides of the comparison then use **identical content**, so only the design differs.
3. Build `eval.html`, a dev-only page that isn't linked from the app. For each set, it shows deck X and deck Y side by side in random order. One is directed and one is today's best sampler pick. A "Reveal" button shows which is which. Record a choice for each pair, plus a free-text note.
4. Questions for the people judging: *Which one looks like a person made it? Which would you present?*

Ship it as the default only if the directed deck wins clearly, for example in at least 2 out of 3 comparisons with more than one judge. Otherwise, the `warnings` and notes from the evaluation show what to fix in the prompt or the rules.

## Phase 3: ideas for afterwards (only if phase 2 succeeds)

- **A one-word slide.** A new `word` form: one to four words, very large. The words have to come from the item's own text, and code checks that every word appears in the source text, so nothing is invented.
- **`moment` drives the effects.** Let `loud` and `quiet` steer `assignAccents()` instead of only seeded placement.
- **More of the library open to the art director.** Allow Glass, Poster and Texture as bases, and allow a whitelist of layout overrides on top of a base direction (`titlePos`, `align`, `numbers`, `photo`). Each override needs a compatibility check, because some knobs depend on each other (for example `masthead` needs `boldDisplay`).
- **Human writing in the content step.** Add AI writing tells to the `SYSTEM_PROMPT` in `content.js`: stock openers, a "Key takeaways" slide, every list of exactly three, perfectly parallel bullets.
- **Redesign path.** Let `api/analyse.js` decks go through the art director too, with the uploaded slide order passed in as a constraint.

## Conventions (unchanged)

- British spelling in user-facing text and docs. No em dashes in prose.
- The HTML preview and the PowerPoint export draw from the same slide data. Never add a renderer-only branch.
- Every motion stops under `prefers-reduced-motion`.
- The repo is public: never commit keys. `ANTHROPIC_API_KEY` stays in the Vercel environment.
- Commit messages are short sentences describing the visible change, like the existing history.
- Update the README's "How variety is created" and "Status" sections when phase 1 lands. The sentence "The variety does not come from the AI model" will no longer be true.

## Known issues to keep in mind (from the 15 Nov review)

- The visitor rate limit in `api/generate.js` (`limited()`) keeps hits in memory for each serverless instance, so it barely applies on Vercel. A second endpoint makes this more pressing. Fix it with a shared store (for example Upstash Redis) or Vercel firewall rate limiting, either before phase 1 is public or as part of it.
- `writeDeck()` uses the beta `server-side-fallback-2026-07-01` with `fallbacks: 'default'`. If either endpoint fails with HTTP 400, check this first.
- Parts of the README are out of date: the "Four looks" list is split up, "PowerPoint export" appears twice, it says "no dependencies", and the "Run locally" block is missing `npm install`.

## Prompt to start Claude Code with

> Read `docs/handover-art-director.md` and the README. Create the branch `art-director` and implement phase 1, steps 1 to 7, in order. Commit after each step with the tests passing. Before step 6, show me the spec Claude returns for the sample deck and the plan `toSpec` makes from it, so I can check the decisions before you build the interface. Stop after phase 1 and tell me which notes you need for the comparison.
