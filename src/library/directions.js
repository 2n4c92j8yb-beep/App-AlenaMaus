// The curated design directions. Each one is a complete brief: palette, type,
// layout logic, a signature graphic and a photo treatment. The sampler picks
// three that differ clearly; the layouts in forms.js read these values.
//
// Structure comes from space, scale and colour areas, not from rules: only
// Ledger draws lines, as its deliberate table look.
//
// layout:
//   margin      outer margin in inches
//   align       'left' | 'center'            alignment of headlines
//   titlePos    'top' | 'side'               headline above the content, or in a left column
//   numbers     'large' | 'small' | 'none'   how steps and points are numbered
//   cover       'bottom' | 'center' | 'split' | 'block' | 'top'
//   labels      'upper' | 'small' | 'italic' style of kickers and captions
//   kicker      'text' | 'tag'               kicker as plain label or as a filled colour tag
//   signature   the direction's own graphic device (see forms.js → signature())
//   photo       'bleed' | 'framed' | 'offset' | 'round'   how pictures sit on the slide
//   scale       multiplier for headline sizes
//   footer      show page number and short title
// tags: tone (formal | neutral | relaxed), mode (light | dark | tint), type (serif | sans | mixed)
// suits: weight per occasion id (0 = never)

export const DIRECTIONS = [
  {
    id: 'archive',
    name: 'Archive',
    blurb: 'Warm paper, Garamond, oxblood. Pictures sit on a paper mat like plates in an old book.',
    fonts: { display: 'garamond', body: 'garamond', label: 'garamond' },
    colors: { bg: '#F4EFE6', ink: '#2B2622', muted: '#6B6158', accent: '#7A2E2A', soft: '#E4DACB' },
    layout: { margin: 0.9, align: 'left', titlePos: 'top', numbers: 'small', cover: 'bottom', labels: 'upper', kicker: 'text', signature: 'plate', photo: 'framed', scale: 1.05, footer: true },
    tags: { tone: 'formal', mode: 'tint', type: 'serif' },
    suits: { seminar: 3, thesis: 3, lesson: 1, group: 1, pitch: 0, update: 1 },
  },
  {
    id: 'broadsheet',
    name: 'Broadsheet',
    blurb: 'Newspaper energy: bold Georgia headlines, black masthead bars, red tags.',
    fonts: { display: 'georgia', body: 'arial', label: 'arial' },
    colors: { bg: '#FFFFFF', ink: '#141414', muted: '#5A5A5A', accent: '#B5121B', soft: '#EDEDED' },
    layout: { margin: 0.7, align: 'left', titlePos: 'top', numbers: 'large', cover: 'top', labels: 'upper', kicker: 'tag', signature: 'masthead', photo: 'bleed', scale: 1.1, footer: true, boldDisplay: true },
    tags: { tone: 'neutral', mode: 'light', type: 'mixed' },
    suits: { seminar: 2, thesis: 2, lesson: 2, group: 2, pitch: 2, update: 3 },
  },
  {
    id: 'swiss',
    name: 'Swiss Grid',
    blurb: 'Strict grid, oversized numbers running off the edge, one hot accent.',
    fonts: { display: 'arial', body: 'arial', label: 'arial' },
    colors: { bg: '#FFFFFF', ink: '#111111', muted: '#6E6E6E', accent: '#D9432B', soft: '#F0F0F0' },
    layout: { margin: 0.75, align: 'left', titlePos: 'side', numbers: 'large', cover: 'split', labels: 'small', kicker: 'text', signature: 'bleed', photo: 'bleed', scale: 1.0, footer: true, boldDisplay: true },
    tags: { tone: 'neutral', mode: 'light', type: 'sans' },
    suits: { seminar: 2, thesis: 2, lesson: 1, group: 3, pitch: 3, update: 3 },
  },
  {
    id: 'chalk',
    name: 'Chalkboard',
    blurb: 'Slate green-black, italic serif headlines, chalk-yellow highlights and soft spots of colour.',
    fonts: { display: 'georgia', body: 'verdana', label: 'verdana' },
    colors: { bg: '#1F2A2B', ink: '#ECEAE2', muted: '#A9B1AC', accent: '#E8D36A', soft: '#2C3A3B' },
    layout: { margin: 0.85, align: 'left', titlePos: 'top', numbers: 'large', cover: 'center', labels: 'italic', kicker: 'text', signature: 'spots', photo: 'round', scale: 1.0, footer: false, italicDisplay: true },
    tags: { tone: 'relaxed', mode: 'dark', type: 'mixed' },
    suits: { seminar: 2, thesis: 1, lesson: 3, group: 2, pitch: 0, update: 0 },
  },
  {
    id: 'fieldnotes',
    name: 'Field Notes',
    blurb: 'Kraft paper, typewriter labels, index tabs and notes pinned slightly askew.',
    fonts: { display: 'georgia', body: 'georgia', label: 'courier' },
    colors: { bg: '#ECE5D5', ink: '#33312C', muted: '#625C50', accent: '#2F5D50', soft: '#DED5C1', note: '#F6E9A8' },
    layout: { margin: 0.8, align: 'left', titlePos: 'top', numbers: 'small', cover: 'bottom', labels: 'small', kicker: 'text', signature: 'tabs', photo: 'framed', scale: 0.95, footer: true },
    tags: { tone: 'relaxed', mode: 'tint', type: 'serif' },
    suits: { seminar: 3, thesis: 1, lesson: 2, group: 2, pitch: 0, update: 1 },
  },
  {
    id: 'gallery',
    name: 'Gallery',
    blurb: 'Museum wall: centred Palatino, wide margins, pictures given the whole stage.',
    fonts: { display: 'palatino', body: 'palatino', label: 'gillSans' },
    colors: { bg: '#FBFAF7', ink: '#26231F', muted: '#6C655B', accent: '#8C6E4E', soft: '#EFEBE3' },
    layout: { margin: 1.3, align: 'center', titlePos: 'top', numbers: 'none', cover: 'center', labels: 'upper', kicker: 'text', signature: 'wall', photo: 'framed', scale: 0.95, footer: false },
    tags: { tone: 'formal', mode: 'light', type: 'serif' },
    suits: { seminar: 2, thesis: 2, lesson: 1, group: 0, pitch: 1, update: 0 },
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    blurb: 'Deep blue, Century Gothic, translucent blocks that overlap like layered plans.',
    fonts: { display: 'centuryGothic', body: 'centuryGothic', label: 'courier' },
    colors: { bg: '#13355A', ink: '#F2F6FA', muted: '#A9BFD6', accent: '#8FD3F5', soft: '#1C4470' },
    layout: { margin: 0.8, align: 'left', titlePos: 'top', numbers: 'large', cover: 'bottom', labels: 'small', kicker: 'text', signature: 'blocks', photo: 'offset', scale: 0.95, footer: true },
    tags: { tone: 'neutral', mode: 'dark', type: 'sans' },
    suits: { seminar: 1, thesis: 1, lesson: 1, group: 3, pitch: 2, update: 2 },
  },
  {
    id: 'signal',
    name: 'Signal',
    blurb: 'Condensed capitals, wide teal bands, poster-like hierarchy.',
    fonts: { display: 'franklin', body: 'arial', label: 'franklin' },
    colors: { bg: '#F6F5F1', ink: '#1C1F1E', muted: '#5F6462', accent: '#0F7466', soft: '#E4E6E1' },
    layout: { margin: 0.7, align: 'left', titlePos: 'top', numbers: 'large', cover: 'block', labels: 'upper', kicker: 'tag', signature: 'band', photo: 'bleed', scale: 1.15, footer: true, upperDisplay: true },
    tags: { tone: 'neutral', mode: 'light', type: 'sans' },
    suits: { seminar: 1, thesis: 1, lesson: 2, group: 3, pitch: 3, update: 2 },
  },
  {
    id: 'monograph',
    name: 'Monograph',
    blurb: 'Cream and navy, Book Antiqua, a tinted column for every headline.',
    fonts: { display: 'bookAntiqua', body: 'gillSans', label: 'gillSans' },
    colors: { bg: '#F7F2E7', ink: '#1D2B4F', muted: '#5B6680', accent: '#A87C24', soft: '#EAE1CC' },
    layout: { margin: 0.95, align: 'left', titlePos: 'side', numbers: 'small', cover: 'split', labels: 'upper', kicker: 'text', signature: 'panel', photo: 'bleed', scale: 1.0, footer: true },
    tags: { tone: 'formal', mode: 'tint', type: 'mixed' },
    suits: { seminar: 3, thesis: 3, lesson: 1, group: 1, pitch: 1, update: 1 },
  },
  {
    id: 'studio',
    name: 'Studio',
    blurb: 'Warm grey, chunky Trebuchet, terracotta blocks set behind pictures and numbers.',
    fonts: { display: 'trebuchet', body: 'trebuchet', label: 'trebuchet' },
    colors: { bg: '#E9E5DF', ink: '#232220', muted: '#66625C', accent: '#B85A2B', soft: '#DAD4CB' },
    layout: { margin: 0.75, align: 'left', titlePos: 'top', numbers: 'large', cover: 'block', labels: 'small', kicker: 'text', signature: 'offset', photo: 'offset', scale: 1.05, footer: false, boldDisplay: true },
    tags: { tone: 'relaxed', mode: 'tint', type: 'sans' },
    suits: { seminar: 1, thesis: 0, lesson: 3, group: 3, pitch: 2, update: 1 },
  },
  {
    id: 'nightlecture',
    name: 'Night Lecture',
    blurb: 'Near-black stage, large Georgia, an amber glow behind the one thing that matters.',
    fonts: { display: 'georgia', body: 'arial', label: 'arial' },
    colors: { bg: '#141414', ink: '#EDEBE6', muted: '#9C9890', accent: '#F0A43A', soft: '#232323' },
    layout: { margin: 0.9, align: 'left', titlePos: 'top', numbers: 'small', cover: 'bottom', labels: 'upper', kicker: 'text', signature: 'glow', photo: 'bleed', scale: 1.1, footer: false },
    tags: { tone: 'neutral', mode: 'dark', type: 'mixed' },
    suits: { seminar: 2, thesis: 2, lesson: 1, group: 1, pitch: 2, update: 1 },
  },
  {
    id: 'ledger',
    name: 'Ledger',
    blurb: 'Cambria and Calibri on white, table-like rules, ink blue. The one direction that uses lines, on purpose.',
    fonts: { display: 'cambria', body: 'calibri', label: 'calibri' },
    colors: { bg: '#FFFFFF', ink: '#1E1F24', muted: '#5D6170', accent: '#2F4F9E', soft: '#EEF0F5' },
    layout: { margin: 0.8, align: 'left', titlePos: 'top', numbers: 'small', cover: 'top', labels: 'small', kicker: 'text', signature: 'ledger', photo: 'framed', scale: 0.95, footer: true },
    tags: { tone: 'formal', mode: 'light', type: 'mixed' },
    suits: { seminar: 2, thesis: 3, lesson: 1, group: 2, pitch: 1, update: 3 },
  },
  {
    id: 'poster',
    name: 'Poster',
    blurb: 'Mustard and black, Arial Black, full-bleed colour and type that runs off the page.',
    fonts: { display: 'arialBlack', body: 'arial', label: 'arial' },
    colors: { bg: '#F7F3EA', ink: '#1A1A1A', muted: '#5C5850', accent: '#E3B23C', soft: '#EFE6D2', onAccent: '#1A1A1A', accentText: '#7A5A0A' },
    layout: { margin: 0.7, align: 'left', titlePos: 'top', numbers: 'large', cover: 'block', labels: 'upper', kicker: 'text', signature: 'bleed', photo: 'bleed', scale: 0.92, footer: false, accentStatements: true },
    tags: { tone: 'relaxed', mode: 'light', type: 'sans' },
    suits: { seminar: 1, thesis: 0, lesson: 2, group: 3, pitch: 3, update: 1 },
  },
  {
    id: 'margin',
    name: 'Margin Notes',
    blurb: 'A tinted margin holds headlines and numbers, like an annotated page.',
    fonts: { display: 'georgia', body: 'verdana', label: 'verdana' },
    colors: { bg: '#FFFFFF', ink: '#262626', muted: '#6B6B6B', accent: '#992436', soft: '#F4EEEC' },
    layout: { margin: 0.8, align: 'left', titlePos: 'side', numbers: 'small', cover: 'split', labels: 'italic', kicker: 'text', signature: 'margin', photo: 'framed', scale: 0.95, footer: true },
    tags: { tone: 'formal', mode: 'light', type: 'mixed' },
    suits: { seminar: 3, thesis: 2, lesson: 2, group: 1, pitch: 0, update: 1 },
  },
  {
    id: 'botanical',
    name: 'Botanical',
    blurb: 'Pale sage, italic Garamond, large soft circles and round-cropped pictures.',
    fonts: { display: 'garamond', body: 'gillSans', label: 'gillSans' },
    colors: { bg: '#E5ECE3', ink: '#23332A', muted: '#56665C', accent: '#8A4F36', soft: '#D2DDCF' },
    layout: { margin: 0.9, align: 'center', titlePos: 'top', numbers: 'small', cover: 'center', labels: 'upper', kicker: 'text', signature: 'circles', photo: 'round', scale: 1.05, footer: false, italicDisplay: true },
    tags: { tone: 'relaxed', mode: 'tint', type: 'mixed' },
    suits: { seminar: 2, thesis: 1, lesson: 3, group: 2, pitch: 1, update: 0 },
  },
];

// Poster family: film-poster look. Their cover, section, statement, key-figure
// and question slides come from posters.js; the rest use the forms above.
// `grade` picks the colour-graded version of each mood photo.
const ALL_OCCASIONS = { seminar: 2, thesis: 2, lesson: 2, group: 2, pitch: 2, update: 2 };

DIRECTIONS.push(
  {
    id: 'summit',
    family: 'poster',
    name: 'Summit',
    blurb: 'Golden-hour photo, a giant word standing behind the subject, tiny serif capitals at the edges.',
    grade: 'warm',
    fonts: { display: 'bebas', body: 'georgia', label: 'georgia', poster: 'bebas' },
    colors: { bg: '#0F0C09', ink: '#F2E6D2', muted: '#A99A87', accent: '#D9A75A', soft: '#1D1712' },
    layout: { margin: 0.8, align: 'left', titlePos: 'top', numbers: 'large', cover: 'bottom', labels: 'upper', labelTracking: 0.3, kicker: 'text', signature: 'none', photo: 'bleed', scale: 1.15, footer: true, upperDisplay: true, photoFilter: 'sepia(0.45) contrast(1.1) brightness(0.88)' },
    tags: { tone: 'neutral', mode: 'dark', type: 'mixed' },
    suits: ALL_OCCASIONS,
  },
  {
    id: 'cutout',
    family: 'poster',
    name: 'Cut-out',
    blurb: 'Black and white on paper, the photo showing through a giant vertical word, labels running up the edge.',
    grade: 'mono',
    fonts: { display: 'anton', body: 'arial', label: 'arial', poster: 'anton' },
    colors: { bg: '#EEECE7', ink: '#111111', muted: '#55524D', accent: '#111111', soft: '#DCD9D2' },
    layout: { margin: 0.8, align: 'left', titlePos: 'top', numbers: 'large', cover: 'split', labels: 'upper', labelTracking: 0.3, kicker: 'text', signature: 'none', photo: 'bleed', scale: 1.1, footer: true, upperDisplay: true, photoFilter: 'grayscale(1) contrast(1.15)' },
    tags: { tone: 'neutral', mode: 'light', type: 'sans' },
    suits: ALL_OCCASIONS,
  },
  {
    id: 'monolith',
    family: 'poster',
    name: 'Monolith',
    blurb: 'Dark amber, an ultra-narrow word across the full width, symmetrical photos and a poster footer grid.',
    grade: 'night',
    fonts: { display: 'georgia', body: 'georgia', label: 'georgia', poster: 'sixcaps' },
    colors: { bg: '#0E0C0A', ink: '#EDE3D1', muted: '#9C9182', accent: '#C9A15F', soft: '#1B1713' },
    layout: { margin: 0.9, align: 'center', titlePos: 'top', numbers: 'small', cover: 'center', labels: 'upper', labelTracking: 0.35, kicker: 'text', signature: 'none', photo: 'bleed', scale: 1.0, footer: false, photoFilter: 'sepia(0.55) brightness(0.72) contrast(1.15)' },
    tags: { tone: 'formal', mode: 'dark', type: 'serif' },
    suits: ALL_OCCASIONS,
  },
);

export const byId = (id) => DIRECTIONS.find((d) => d.id === id);
