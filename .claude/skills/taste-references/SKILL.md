---
name: taste-references
description: Design reference chapters on effects, backgrounds, cards and motion, for designing new looks and directions in the Deck App (e.g. the Glass look: glass, glow, holo gradients, chrome objects, floating cards). Read when designing or reviewing a look, a slide layout or an effect; not for the app's form UI.
---

# Taste references (excerpt)

Five chapters copied from tasteskill by Leonxlnx (github.com/Leonxlnx/taste-skill,
commit f6b7657, MIT licence, see `LICENSE`):

| File | Read it for |
|---|---|
| `effects-usage.md` | When an effect earns its place, and how many per screen |
| `effects-creative.md` | Creative effect ideas and their limits |
| `backgrounds.md` | Grounds: gradients, light, texture |
| `cards.md` | Card anatomy, edges, padding, rhythm |
| `motion.md` | Motion tokens, entrances, loops, what to avoid |

## How to use these in this project

- These chapters were written for **company websites**. Take the principles, not the
  website rules: the Deck App makes **16:9 slides**, so ignore anything about page sections,
  screens per section, scrolling, hover or breakpoints.
- The original skill's scripts, assets, gate and checker are **not** included. Where a chapter
  names a script, a file under `assets/` or a `data-` hook, treat it as an example of the idea
  and build the equivalent in this project's own code.
- The Deck App's own rules win: image credits are required on slides and in Works Cited, and
  variety comes from the curated library in `src/library/`, not from improvisation.
