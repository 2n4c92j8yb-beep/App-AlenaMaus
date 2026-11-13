// Story structures: the order in which content is told. Each role names the
// kinds of content it accepts (and optionally tags such as 'thesis' or
// 'counter'). The assembler fills roles from the content pool, so the same
// notes become a differently ordered deck under each structure.
//
// Content kinds: claim, definition, figure, pair, timeline, steps,
// comparison, quote, question, points, image, sources.
//
// Role fields:
//   kinds     accepted content kinds, in order of preference
//   tags      required tags (falls back to any tag if none match and the role is not optional)
//   optional  dropped in the 'light' density
//   repeat    how many items the role may take (capped by density)
//   section   label of a section divider shown before this role (not in 'light')
//   kicker    small label above the headline

export const STRUCTURES = [
  {
    id: 'thesisFirst',
    name: 'Thesis first',
    blurb: 'State the argument, prove it, face the objection, open the discussion.',
    roles: [
      { kinds: ['claim'], tags: ['thesis'], kicker: 'Thesis' },
      { kinds: ['definition'], optional: true },
      { kinds: ['pair', 'image', 'figure', 'timeline', 'quote', 'steps'], tags: ['evidence'], repeat: 4, section: 'Evidence' },
      { kinds: ['comparison', 'claim'], tags: ['counter'], section: 'Objections', kicker: 'Objection' },
      { kinds: ['claim'], tags: ['takeaway'], optional: true, kicker: 'So what' },
      { kinds: ['question'], tags: ['counter', 'discussion'], kicker: 'For discussion' },
      { kinds: ['sources'] },
    ],
  },
  {
    id: 'questionLed',
    name: 'Open with a question',
    blurb: 'Start from a puzzle, collect clues, give the answer, then complicate it.',
    roles: [
      { kinds: ['question'], tags: ['hook'], kicker: 'A puzzle' },
      { kinds: ['image', 'quote', 'pair'], tags: ['evidence'], optional: true },
      { kinds: ['definition'] },
      { kinds: ['figure', 'image', 'timeline', 'steps', 'pair'], tags: ['evidence'], repeat: 3, section: 'Clues' },
      { kinds: ['claim'], tags: ['thesis'], section: 'Answer', kicker: 'The answer' },
      { kinds: ['claim', 'comparison'], tags: ['counter'], optional: true, kicker: 'But' },
      { kinds: ['question'], tags: ['counter', 'discussion'], kicker: 'For discussion' },
      { kinds: ['sources'] },
    ],
  },
  {
    id: 'chronological',
    name: 'Chronological story',
    blurb: 'Tell it in time order, from the first sign to today.',
    chronological: true,
    roles: [
      { kinds: ['timeline'], kicker: 'Overview' },
      { kinds: ['image', 'quote', 'figure', 'pair'], tags: ['evidence'], repeat: 4, section: 'Step by step' },
      { kinds: ['steps'], optional: true },
      { kinds: ['points'], optional: true },
      { kinds: ['claim'], tags: ['takeaway', 'thesis'], section: 'Today', kicker: 'Today' },
      { kinds: ['sources'] },
    ],
  },
  {
    id: 'caseFirst',
    name: 'Example first',
    blurb: 'Show one concrete case, ask why, explain the mechanism, then name it.',
    roles: [
      { kinds: ['pair', 'quote'], tags: ['evidence'], kicker: 'Look at this' },
      { kinds: ['question'], tags: ['hook'], kicker: 'Why?' },
      { kinds: ['steps'], section: 'How it works' },
      { kinds: ['definition'], kicker: 'The name for it' },
      { kinds: ['image', 'figure', 'timeline', 'pair'], tags: ['evidence'], repeat: 2, optional: true },
      { kinds: ['points'] },
      { kinds: ['question'], tags: ['discussion', 'counter', 'task'], kicker: 'Your turn' },
      { kinds: ['sources'] },
    ],
  },
  {
    id: 'contrast',
    name: 'Two sides',
    blurb: 'Set two positions against each other and weigh them.',
    roles: [
      { kinds: ['claim', 'definition'], tags: ['context'], kicker: 'The issue' },
      { kinds: ['definition'], optional: true },
      { kinds: ['comparison'], section: 'Two positions' },
      { kinds: ['figure', 'image', 'pair', 'quote', 'timeline'], tags: ['evidence'], repeat: 3 },
      { kinds: ['claim'], tags: ['counter'], optional: true, kicker: 'The other side' },
      { kinds: ['claim'], tags: ['thesis', 'takeaway'], section: 'Weighing up', kicker: 'My position' },
      { kinds: ['question'], tags: ['discussion', 'counter'], optional: true },
      { kinds: ['sources'] },
    ],
  },
  {
    id: 'lessonArc',
    name: 'Lesson arc',
    blurb: 'Warm-up, input, practice, reflection: the phases of a lesson.',
    roles: [
      { kinds: ['question'], tags: ['hook'], kicker: 'Warm-up' },
      { kinds: ['pair', 'image', 'quote'], tags: ['evidence'], repeat: 2, section: 'Input' },
      { kinds: ['definition'] },
      { kinds: ['steps'] },
      { kinds: ['figure', 'timeline'], tags: ['evidence'], repeat: 2, optional: true },
      { kinds: ['question'], tags: ['task'], section: 'Practice', kicker: 'Task' },
      { kinds: ['points'], section: 'Reflection', kicker: 'What we found' },
      { kinds: ['sources'], optional: true },
    ],
  },
  {
    id: 'scqa',
    name: 'Situation, complication, answer',
    blurb: 'Where we are, what went wrong or changed, what we propose.',
    roles: [
      { kinds: ['claim'], tags: ['context'], kicker: 'Situation' },
      { kinds: ['figure', 'image', 'timeline'], tags: ['evidence'], repeat: 2, kicker: 'Complication' },
      { kinds: ['question'], tags: ['hook', 'discussion'], kicker: 'The question' },
      { kinds: ['claim'], tags: ['thesis'], kicker: 'Answer' },
      { kinds: ['steps', 'points'], repeat: 2 },
      { kinds: ['claim'], tags: ['takeaway'], optional: true, kicker: 'Next' },
      { kinds: ['sources'], optional: true },
    ],
  },
  {
    id: 'problemSolution',
    name: 'Problem and solution',
    blurb: 'Show the problem and its size, then the approach and what changes.',
    roles: [
      { kinds: ['claim'], tags: ['context'], kicker: 'The problem' },
      { kinds: ['figure', 'image', 'pair'], tags: ['evidence'], repeat: 2 },
      { kinds: ['steps'], section: 'Approach' },
      { kinds: ['comparison'], optional: true },
      { kinds: ['timeline', 'quote'], tags: ['evidence'], optional: true },
      { kinds: ['claim'], tags: ['thesis', 'takeaway'], section: 'Result', kicker: 'Result' },
      { kinds: ['question'], tags: ['discussion', 'counter'], optional: true },
      { kinds: ['sources'] },
    ],
  },
];

export const structureById = (id) => STRUCTURES.find((s) => s.id === id);

// Which slide form shows which kind of content.
export const FORM_FOR_KIND = {
  claim: 'statement',
  definition: 'definition',
  figure: 'bigNumber',
  pair: 'pair',
  timeline: 'timeline',
  steps: 'process',
  comparison: 'comparison',
  quote: 'quote',
  question: 'question',
  points: 'points',
  image: 'photo', // alternates with photoSplit in the assembler
  sources: 'references',
};
