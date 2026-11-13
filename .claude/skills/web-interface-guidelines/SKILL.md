---
name: web-interface-guidelines
description: Review or build the Deck App's own interface (forms, buttons, upload, results, Present mode) against Vercel's Web Interface Guidelines for accessibility, focus states, forms, motion, typography and polish. Use when asked to review the UI, check accessibility, audit design or UX, or before shipping a UI change.
---

# Web Interface Guidelines

The rules are in `RULES.md` in this folder: a fixed copy of Vercel Labs' guidelines
(vercel-labs/web-interface-guidelines, commit 434b7f9, MIT licence, see `LICENSE`).
They are bundled on purpose instead of being downloaded at review time, so the rules
stay reviewed and do not change without a commit.

## How to use

1. Read `RULES.md` completely.
2. Read the files to check (or the ones the change touched). If none are named, check
   `index.html`, `styles.css` and `src/main.js`.
3. Report findings in the `file:line` format that `RULES.md` describes, most serious first.
4. Slides themselves are design output, not app UI: apply only the typography, contrast and
   motion rules to them.
