// The analysis step's contract (api/analyse.js): Claude looks at an uploaded AI-made
// deck and returns its content (the same shape as the writing step) and a style
// profile, which src/engine/match.js turns into a choice of direction.

import { SYSTEM_PROMPT, EXAMPLE_SHAPE } from './content.js';
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

export const ANALYSE_PROMPT = `You get a presentation that someone made with an AI tool (for example ChatGPT, Claude, Gamma, Copilot or Canva): pictures of its slides, the text taken from the file, or both. A design engine will rebuild it in a new design that keeps its general look but no longer looks AI-made. You have two jobs.

Job 1, the content. Treat the slide text (and any speaker notes) as the student's notes and follow these rules:

${SYSTEM_PROMPT.split('\n').slice(2).join('\n')}
- slide: give every piece (claims, definitions, figures, pairs, timelines, processes, comparisons, quotes, questions, point lists) the number of the uploaded slide it comes from, so the new deck can keep the original order. Slides count from 1 in the order of the deck (the text marks them "Slide 1", "Slide 2" …; each picture says which slide it shows). Use 0 only for a piece that comes from no particular slide.

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
