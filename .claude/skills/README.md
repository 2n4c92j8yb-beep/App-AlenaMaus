# Project skills

Skills Claude loads when working on this repo. Each was read before it was added.
Third-party skills keep their licence file in their folder.

| Skill | Source (commit) | Licence | Used for |
|---|---|---|---|
| `emil-design-eng` | emilkowalski/skills (f7ce8c0) | MIT | UI polish and design-engineering judgment |
| `animate` | emilkowalski/skills (f7ce8c0) | MIT | Building a single animation |
| `choreograph` | emilkowalski/skills (f7ce8c0) | MIT | Several elements moving together (Present-mode builds) |
| `review-animations` | emilkowalski/skills (f7ce8c0) | MIT | Reviewing motion; runs only when asked |
| `gsap-core` | greensock/gsap-skills (aed9cfd) | MIT | GSAP tweens, easing, reduced motion |
| `gsap-timeline` | greensock/gsap-skills (aed9cfd) | MIT | Sequencing animations |
| `gsap-performance` | greensock/gsap-skills (aed9cfd) | MIT | Smooth animation |
| `web-interface-guidelines` | vercel-labs/web-interface-guidelines (434b7f9), bundled copy | MIT | Accessibility and UI review of the app |
| `taste-references` | Leonxlnx/taste-skill (f6b7657), 5 chapters only | MIT | Design principles for effects, backgrounds, cards, motion |
| `impeccable` | pbakaus/impeccable (d41d986), skill folder only | Apache 2.0 | Design critique, audit, polish, bolder/quieter, typeset, layout (`/impeccable <command> <target>`) |

`impeccable`: added without its hooks (they run its checker at every session start, after every
edit and at the end of every turn) and without its helper agents. Its launcher downloads a
checker program from the author's GitHub releases on first use and verifies its SHA-256; without
it, the skill reads PRODUCT.md and DESIGN.md directly. Its live mode can start an agent with
permission checks turned off, so it is not used here.

Deliberately not added: the full tasteskill (40 MB, runs a script after every turn, written for
websites), awesome-design-md (descriptions of real brands' looks), and screenshot-to-code tools
(not needed). Update a skill by copying a newer commit, reading the diff, and changing the table.
