// The analysis step's contract (api/analyse.js): Claude looks at an uploaded AI-made
// deck and returns its content (the same shape as the writing step) and a style
// profile, which src/engine/match.js turns into a choice of direction.

import { EXAMPLE_SHAPE } from './content.js';
import { TELLS } from './match.js';

export const STYLE_SHAPE = {
  summary: 'one sentence on how the deck looks',
  mode: 'light | dark | tint',
  type: 'serif | sans | mixed',
  tone: 'formal | neutral | relaxed',
  colors: { background: '#RRGGBB', text: '#RRGGBB', accent: '#RRGGBB' },
  surface: 'flat | gradient | glass | texture | photo',
  imagery: 'none | icons | illustrations | photos',
  typeScale: 'quiet | bold | huge',
  align: 'left | center',
  density: 'light | medium | dense',
  tells: [`any of: ${TELLS.join(', ')}`],
};

export const ANALYSE_PROMPT = `You get a presentation that someone made with an AI tool (for example ChatGPT, Claude, Gamma, Copilot or Canva): pictures of its slides, the text taken from the file, or both. A design engine will rebuild it in a new design that keeps its general look and all of its text, but no longer looks AI-made. You have two jobs.

Job 1, the content. The person wants a new design for the same slides, not new slides. Copy the text of the deck, slide by slide, into the JSON pieces below:
- Word for word. Keep every headline, sentence, bullet, number, name and source exactly as it is written on the slide: the same words, spelling, capitalisation, punctuation and language. Do not rephrase, shorten, summarise, complete, correct, translate, merge or split anything, and do not turn a topic headline into a statement. Never add a word, fact, example, question, quote or source that is not on the slides.
- One piece per slide. Each uploaded slide (after the title slide) becomes exactly one piece, in the order of the deck, and keeps all of its text. Never leave a slide out, never leave a line out, and never spread one slide over several pieces. Nothing is too long: the design engine makes the type smaller where needed.
- Leave out only what is not content: credits of the AI tool ("Made with Gamma"), page numbers, footers or logos repeated on every slide, placeholder text ("Click to add text") and emoji.
- The title slide fills deck: title, subtitle, author, course and date exactly as written on it (empty strings for what it doesn't show). shortTitle is the title or its first words; worksCitedTitle is the heading of the deck's sources slide, or empty; posterWords are three single words taken from the slides; posterLines are up to five short lines taken from the slides; placeShort is a place the slides name, or empty.
- Pick the piece that matches how the slide is already built, and put the slide's headline in its title field unchanged:
  - a headline with bullet points or a list: pointLists, one point per bullet, in order, however many there are. If a bullet starts with a short lead-in ("Lead-in: rest" or a bold first phrase), head is the lead-in and text is the rest; otherwise head is the whole bullet and text is "". Sub-bullets go into the text of their bullet.
  - a headline with one block of running text: pointLists with a single point whose head is that text, word for word, and text "".
  - two columns set side by side (pros and cons, then and now): comparisons, the column headings as heading and their lines as points.
  - numbered steps or a sequence of stages (2 to 6): processes. Three to eight dated events: timelines. Longer sequences: pointLists.
  - one big number as the point of the slide (written in 9 characters or fewer, e.g. "40 %"): figures, the number as value and the words with it as label and caption.
  - a quotation with its author: quotes. A slide that is just a question: questions (role "hook" near the start, "discussion" near the end). A term with its definition: definitions. A slide with one sentence and no headline: claims.
  - two forms of one thing shown as before and after: pairs.
  - anything else: pointLists with its lines as points.
- sources: the entries of the deck's sources or references slide, each exactly as written. Leave sources empty if the deck has none, and then do not make a piece of that slide.
- pictures and pictureCaptions: leave both empty; the new design keeps to the deck's own content.
- year: the year a piece belongs to, or 0.
- slide: give every piece the number of the uploaded slide it comes from. Slides count from 1 in the order of the deck (the text marks them "Slide 1", "Slide 2" …; each picture says which slide it shows).
- If you have pictures but no text for a slide, copy the text you can read on the picture, just as carefully.

Job 2, the style. Describe how the uploaded deck looks, so the engine can pick the closest design:
- mode: "dark" for dark backgrounds, "light" for white or near-white, "tint" for clearly coloured but light backgrounds (cream, pastel, beige).
- type: "serif", "sans", or "mixed" (serif headlines with sans body text, or the other way round).
- tone: how formal the deck feels.
- colors: the main background colour, the main text colour and the one accent colour that recurs most (headlines, highlights, shapes), as six-digit hex codes. For a gradient background, give its main colour.
- surface: how most backgrounds are made: "flat" (solid colour), "gradient", "glass" (frosted, translucent or glossy panels, glows), "texture" (grain, paper, patterns, illustrations as backgrounds), "photo" (full-bleed photos).
- imagery: the main kind of pictures on the slides.
- typeScale: how loud the headlines are: "quiet" (modest), "bold" (large and heavy), "huge" (poster-size words).
- align: whether most slides are centred or left-aligned.
- density: how much text a typical slide carries.
- tells: the typical signs of an AI-made deck you can actually see, using only these names: ${TELLS.join(', ')}. ("card-grid" means rows of identical boxes; "bullet-walls" means slides full of bullet points.) An empty list is fine.
- summary: one plain sentence describing the look, e.g. "Dark navy slides with purple–blue gradients, white sans-serif type and emoji bullets."
If you only have text and no pictures, guess the style from the text and the theme information given, and leave tells empty unless the text shows them (emoji bullets, walls of bullets).`;

/** The full system prompt for the server, with the JSON shape to answer in. */
// the writing step's shape, with the uploaded slide number on every piece that can have one
const SLIDE_LISTS = ['claims', 'definitions', 'figures', 'pairs', 'timelines', 'processes', 'comparisons', 'quotes', 'questions', 'pointLists'];
const CONTENT_SHAPE = Object.fromEntries(Object.entries(EXAMPLE_SHAPE).map(([k, v]) => [k, SLIDE_LISTS.includes(k) ? v.map((x) => ({ ...x, slide: 0 })) : v]));

export function analysePrompt() {
  return `${ANALYSE_PROMPT}

Answer with JSON only, no other text, in exactly this shape:
${JSON.stringify({ content: CONTENT_SHAPE, style: STYLE_SHAPE }, null, 1)}`;
}

// ---------------------------------------------------------------- cleaning

const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const color = (v, fallback) => (/^#?[0-9a-f]{6}$/i.test(String(v ?? '').trim()) ? `#${String(v).trim().replace('#', '').toUpperCase()}` : fallback);

/** A style profile with every field present and valid, whatever the model sent. */
export function cleanStyle(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const mode = pick(s.mode, ['light', 'dark', 'tint'], 'light');
  const c = s.colors ?? {};
  return {
    summary: typeof s.summary === 'string' ? s.summary.replace(/\s+/g, ' ').trim().slice(0, 200) : '',
    mode,
    type: pick(s.type, ['serif', 'sans', 'mixed'], 'sans'),
    tone: pick(s.tone, ['formal', 'neutral', 'relaxed'], 'neutral'),
    colors: {
      background: color(c.background, mode === 'dark' ? '#111111' : '#FFFFFF'),
      text: color(c.text, mode === 'dark' ? '#FFFFFF' : '#111111'),
      accent: color(c.accent, ''),
    },
    surface: pick(s.surface, ['flat', 'gradient', 'glass', 'texture', 'photo'], 'flat'),
    imagery: pick(s.imagery, ['none', 'icons', 'illustrations', 'photos'], 'none'),
    typeScale: pick(s.typeScale, ['quiet', 'bold', 'huge'], 'bold'),
    align: pick(s.align, ['left', 'center'], 'left'),
    density: pick(s.density, ['light', 'medium', 'dense'], 'medium'),
    tells: [...new Set((Array.isArray(s.tells) ? s.tells : []).filter((t) => TELLS.includes(t)))],
  };
}
