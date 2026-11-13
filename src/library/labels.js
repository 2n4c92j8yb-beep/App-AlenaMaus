// The app's own words on slides (section names, kickers, occasion names, defaults),
// in the language of the notes. The writing step reports the language; English and
// German are curated here, other languages keep the English labels for now.

const DE = {
  // kickers
  'A puzzle': 'Ein Rätsel', 'Answer': 'Antwort', 'But': 'Aber', 'Complication': 'Die Komplikation',
  'For discussion': 'Zur Diskussion', 'Look at this': 'Seht euch das an', 'My position': 'Meine These',
  'Next': 'Als Nächstes', 'Objection': 'Einwand', 'Overview': 'Überblick', 'Result': 'Ergebnis',
  'Situation': 'Ausgangslage', 'So what': 'Und jetzt?', 'Task': 'Aufgabe', 'The answer': 'Die Antwort',
  'The issue': 'Worum es geht', 'The name for it': 'Der Begriff', 'The other side': 'Die Gegenseite',
  'The problem': 'Das Problem', 'The question': 'Die Frage', 'Thesis': 'These', 'Today': 'Heute',
  'Warm-up': 'Einstieg', 'What we found': 'Was wir herausgefunden haben', 'Why?': 'Warum?', 'Your turn': 'Ihr seid dran',
  // sections
  'Approach': 'Vorgehen', 'Clues': 'Hinweise', 'Evidence': 'Belege', 'How it works': 'So funktioniert es',
  'Input': 'Input', 'Objections': 'Einwände', 'Practice': 'Übung', 'Reflection': 'Reflexion',
  'Step by step': 'Schritt für Schritt', 'Two positions': 'Zwei Positionen', 'Weighing up': 'Abwägung',
  // occasions
  'Seminar presentation': 'Seminarvortrag', 'Paper or thesis talk': 'Vortrag zur Arbeit',
  'Teaching a lesson': 'Unterrichtsstunde', 'Group project': 'Gruppenprojekt', 'Pitch': 'Pitch', 'Work update': 'Projektstand',
  // defaults on slides
  'Question': 'Frage', 'Key figure': 'Kennzahl', 'Part': 'Teil', 'Works Cited': 'Literaturverzeichnis',
  'Your own picture': 'Eigenes Bild',
};

const DICT = { de: DE };

/** The label in the deck's language (falls back to the English label). */
export function t(lang, s) {
  if (!s) return s;
  return DICT[String(lang ?? 'en').slice(0, 2).toLowerCase()]?.[s] ?? s;
}

export const LABEL_KEYS = Object.keys(DE);
