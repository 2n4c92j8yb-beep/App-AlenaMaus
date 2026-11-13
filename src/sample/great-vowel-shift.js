// Sample content pool for the step-1 preview (no AI yet).
// In step 2 the AI turns the user's notes into a pool of this exact shape.
// Headlines are written as statements, not topic labels.

export const SAMPLE_NOTES = `Great Vowel Shift – seminar "History of English", 20 min
- c. 1400–1700, long vowels of Middle English all move, short ones mostly don't
- 7 long vowels; highest ones (/iː/, /uː/) become diphthongs, others move up
- bite /biːt/ > /baɪt/, house /huːs/ > /haʊs/, name /naːm/ > /neɪm/
- Chaucer still pre-shift ("Whan that Aprill with his shoures soote")
- Caxton's press 1476 helps fix spelling while pronunciation keeps moving → spelling/sound mismatch
- term "Great Vowel Shift" from Otto Jespersen (1909)
- debate: drag chain or push chain? one event or many local changes?
- Scots "hoose" = unshifted
- discussion: is "great" the right word?`;

export const SAMPLE_POOL = {
  title: 'Why English spelling stopped matching its sounds',
  shortTitle: 'The Great Vowel Shift',
  subtitle: 'The Great Vowel Shift, c. 1400–1700',
  author: 'Your Name',
  course: 'Seminar: History of the English Language',
  date: 'Winter term 2026/27',
  // Public-domain pictures from Wikimedia Commons (see img/credits.json).
  coverImage: {
    src: 'src/sample/img/chaucer-knight.jpg', w: 960, h: 1383,
    alt: 'The Knight on horseback, a miniature from the Ellesmere Manuscript of the Canterbury Tales',
    citation: 'The Knight. Ellesmere Manuscript, c. 1400–1410, Huntington Library. Wikimedia Commons, commons.wikimedia.org/wiki/File:Chaucer_knight.jpg.',
  },
  // Poster details: big words, small lines for the edges, a place.
  posterWords: ['Shift', 'English', 'Vowels'],
  posterLines: ['c. 1400 \u2013 1700', 'Chaucer \u00b7 Caxton \u00b7 Shakespeare', 'Middle English', 'Seven long vowels', 'Modern English'],
  place: 'Canterbury \u00b7 51.28\u00b0 N, 1.08\u00b0 E',
  placeShort: 'England',
  // Mood photos for poster slides. Each exists in three colour grades
  // (base-warm.jpg, base-mono.jpg, base-night.jpg); `cut` marks a cut-out layer.
  mood: [
    {
      base: 'src/sample/photos/corona', w: 1600, h: 1064, cut: true, tags: ['depth', 'architecture', 'sky'],
      alt: 'The Corona tower of Canterbury Cathedral against the sky', caption: 'Canterbury Cathedral \u00b7 The Corona',
      citation: 'DimiTalen. Top of The Corona from the South, Canterbury Cathedral. 2019. Wikimedia Commons, CC0, colour-graded.',
    },
    {
      base: 'src/sample/photos/cathedral', w: 1600, h: 1067, tags: ['architecture', 'wide'],
      alt: 'Canterbury Cathedral seen from below', caption: 'Canterbury Cathedral \u00b7 Kent',
      citation: 'Suicasmo. Canterbury Cathedral. 2016. Wikimedia Commons, CC BY-SA 4.0, colour-graded, commons.wikimedia.org/wiki/File:Canterbury_cathedral_20160901.jpg.',
    },
    {
      base: 'src/sample/photos/letterpress', w: 1600, h: 1067, tags: ['texture', 'detail'],
      alt: 'Metal type in a printer\u2019s tray', caption: 'Metal type',
      citation: 'Truitt, Rodney, Jr. Weldon Spring Letterpress. Wikimedia Commons, CC0, colour-graded.',
    },
    {
      base: 'src/sample/photos/nave', w: 1600, h: 1521, tags: ['interior', 'symmetric'],
      alt: 'The nave of Canterbury Cathedral', caption: 'Canterbury Cathedral \u00b7 The Nave',
      citation: 'Diliff. Canterbury Cathedral Nave. Wikimedia Commons, CC BY-SA 3.0, colour-graded, commons.wikimedia.org/wiki/File:Canterbury_Cathedral_Nave_1,_Kent,_UK_-_Diliff.jpg.',
    },
    {
      base: 'src/sample/photos/london', w: 1600, h: 1079, tags: ['city', 'wide'],
      alt: 'The London skyline at night across the Thames', caption: 'London \u00b7 The Thames',
      citation: 'Warby, William. London Skyline. Wikimedia Commons, CC BY 3.0, colour-graded, commons.wikimedia.org/wiki/File:London_Skyline_(232548719).jpeg.',
    },
  ],
  items: [
    {
      kind: 'image', tags: ['evidence'], weight: 3, year: 1400,
      src: 'src/sample/img/chaucer-portrait.jpg', w: 948, h: 1092,
      alt: 'Portrait of Geoffrey Chaucer from the Ellesmere Manuscript',
      title: 'Chaucer wrote just before the shift began',
      caption: 'His long vowels were still the Middle English ones: his "bite" sounded close to our "beet".',
      credit: 'Ellesmere Manuscript, Huntington Library. Public domain, via Wikimedia Commons.',
      citation: 'Portrait of Geoffrey Chaucer. Ellesmere Manuscript, c. 1400–1410, Huntington Library. Wikimedia Commons, commons.wikimedia.org/wiki/File:Chaucer_ellesmere.jpg.',
    },
    {
      kind: 'claim', tags: ['thesis'], weight: 3,
      text: 'English spelling looks irrational because pronunciation kept moving after spelling had started to settle.',
    },
    {
      kind: 'claim', tags: ['context'], weight: 2,
      text: 'Around 1400, English vowel letters still had roughly the values they have in German or Latin today.',
    },
    {
      kind: 'claim', tags: ['counter'], weight: 2,
      text: 'Some scholars doubt it was one "great" shift at all, rather than many local changes we group together afterwards.',
      note: 'The northern varieties, for example, shifted differently from the south.',
    },
    {
      kind: 'claim', tags: ['takeaway'], weight: 2,
      text: 'Every time you read "bite" or "house", you are reading Middle English spelling with Modern English sounds.',
    },
    {
      kind: 'definition', weight: 3,
      term: 'Great Vowel Shift',
      gloss: 'chain shift · c. 1400–1700',
      text: 'A series of changes in which the long vowels of Middle English moved up in the mouth, and the two highest became diphthongs.',
    },
    {
      kind: 'figure', tags: ['evidence'], weight: 3, year: 1450,
      title: 'Every long vowel moved, and the short ones largely stayed put',
      value: '7', label: 'long vowels affected',
      caption: 'Middle English had seven long vowels. All of them changed their quality during the shift; the short vowels did not take part.',
    },
    {
      kind: 'figure', tags: ['evidence'], weight: 2, year: 1476,
      title: 'Printing began to fix spelling while the shift was still under way',
      value: '1476', label: 'Caxton sets up his press in Westminster',
      caption: 'Printed books spread one spelling for each word, which then changed far more slowly than speech.',
    },
    {
      kind: 'pair', tags: ['evidence'], weight: 3, year: 1500,
      title: 'The highest vowels did not rise further: they split into diphthongs',
      word: 'house',
      left: { text: '/huːs/', label: 'Middle English' },
      right: { text: '/haʊs/', label: 'Modern English' },
      caption: 'Scots "hoose" still keeps the older vowel, because the north did not take part in this change.',
    },
    {
      kind: 'pair', tags: ['evidence'], weight: 2, year: 1550,
      title: 'Lower vowels moved up into the space the high vowels left',
      word: 'name',
      left: { text: '/naːm/', label: 'Middle English' },
      right: { text: '/neɪm/', label: 'Modern English' },
      caption: 'The spelling with "a" reflects the old pronunciation, which is why it no longer matches the sound.',
    },
    {
      kind: 'timeline', tags: ['evidence'], weight: 3, year: 1400,
      title: 'The shift ran for about three hundred years',
      events: [
        { date: 'c. 1400', label: 'Chaucer writes before the shift; his long vowels are still the old ones' },
        { date: '1476', label: 'Caxton\'s press: spelling starts to settle' },
        { date: 'c. 1600', label: 'Shakespeare writes in the middle of the change' },
        { date: 'c. 1700', label: 'The shift is largely complete in the south' },
        { date: '1909', label: 'Otto Jespersen gives it its name' },
      ],
    },
    {
      kind: 'steps', weight: 2,
      title: 'A chain shift moves like people changing seats',
      steps: [
        { title: 'The top seats empty', text: 'The highest long vowels, /iː/ and /uː/, become the diphthongs /aɪ/ and /aʊ/.' },
        { title: 'The next row moves up', text: 'Mid vowels rise into the empty positions: /eː/ becomes /iː/, /oː/ becomes /uː/.' },
        { title: 'The rest follow', text: 'The lower vowels rise in turn, so that no two vowels fall together.' },
      ],
    },
    {
      kind: 'comparison', tags: ['counter'], weight: 2,
      title: 'Scholars still disagree about what started the chain',
      left: { heading: 'Drag chain', points: ['The high vowels change first.', 'The gaps they leave pull the lower vowels upwards.'] },
      right: { heading: 'Push chain', points: ['The lower vowels rise first.', 'They push the high vowels out of their position.'] },
      verdict: 'The surviving evidence does not settle the order beyond doubt.',
    },
    {
      kind: 'quote', tags: ['evidence'], weight: 2, year: 1390,
      text: 'Whan that Aprill with his shoures soote / The droghte of March hath perced to the roote',
      author: 'Geoffrey Chaucer', work: 'The Canterbury Tales, General Prologue',
      note: 'Read aloud with the old long vowels, "soote" rhymes with "roote" as /soːtə/ and /roːtə/.',
    },
    {
      kind: 'question', tags: ['hook'], weight: 3,
      text: 'Why do "meet" and "meat" sound the same, but are spelled differently?',
      hint: 'In Middle English, they were pronounced differently.',
    },
    {
      kind: 'question', tags: ['discussion', 'counter'], weight: 2,
      text: 'If the shift was really many local changes, should we still call it "great"?',
      hint: 'Think about who named it, and when.',
    },
    {
      kind: 'question', tags: ['task'], weight: 2,
      text: 'Read Chaucer\'s first line aloud with the old vowels. Which words sound most different to you?',
      hint: 'Work in pairs, 3 minutes.',
    },
    {
      kind: 'points', weight: 2,
      title: 'Three things the shift still explains today',
      points: [
        { head: 'Vowel letters in English differ from other languages', text: 'English "i" in "time" is not the "i" of German, French or Spanish.' },
        { head: 'Related words have different vowels', text: '"Five" changed with the shift, while the short vowel in "fifth" did not.' },
        { head: 'Northern varieties sound older', text: 'Scots "hoose" for "house" keeps a vowel the south lost.' },
      ],
    },
    {
      kind: 'sources', weight: 3,
      title: 'Works Cited',
      entries: [
        'Baugh, Albert C., and Thomas Cable. A History of the English Language. 6th ed., Routledge, 2013.',
        'Crystal, David. The Cambridge Encyclopedia of the English Language. 3rd ed., Cambridge UP, 2019.',
        'Jespersen, Otto. A Modern English Grammar on Historical Principles. Part 1, Carl Winter, 1909.',
      ],
    },
  ],
};
