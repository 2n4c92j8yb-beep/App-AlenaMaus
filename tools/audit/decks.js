// Test content for the layout audit (tools/audit.mjs). Each deck is built in every direction
// and density, so new layouts are checked against long words, long lists and long text
// before anyone sees them. Add a deck here whenever a real deck shows a new kind of problem.

import { toPool } from '../../src/engine/content.js';
import { SAMPLE_POOL } from '../../src/sample/great-vowel-shift.js';

const long = 'Im Rahmen der Untersuchung absolvierten die Handballspielerinnen über acht Wochen zweimal pro Woche ein zusätzliches plyometrisches Training, das Drop Jumps, Hürdensprünge und Sprungwürfe kombinierte und jeweils etwa zwanzig Minuten dauerte.';

/** A German seminar deck, as the redesign step returns it (word for word, original order). */
export const GERMAN = toPool({
  deck: {
    language: 'de', title: 'Plyometrisches Zusatztraining steigert die Sprungkraft von Handballspielerinnen',
    shortTitle: 'Plyometrie im Handball', subtitle: 'Seminarvortrag Trainingswissenschaft', author: 'Vorname Nachname', course: 'Sportwissenschaft', date: 'WS 2026/27',
    worksCitedTitle: 'Literaturverzeichnis', posterWords: ['PLYOMETRIE', 'SPRUNGKRAFT', 'HANDBALLSPIELERINNEN'], posterLines: ['Dehnungs-Verkürzungs-Zyklus', 'Acht Wochen Intervention'],
  },
  pointLists: [
    { slide: 2, title: 'Dehnungs-Verkürzungs-Zyklus als Grundlage der Schnellkraftleistungsfähigkeit', marker: 'bullet', points: [
      { head: 'Exzentrische Phase: Vordehnung der Muskulatur' }, { head: 'Amortisationsphase möglichst kurz halten' },
      { head: 'Konzentrische Phase: explosive Kraftentfaltung' }, { head: 'Reaktivkraftindex als Leistungskennwert' },
      { head: 'Bodenkontaktzeiten unter 200 Millisekunden' }, { head: 'Sprunghöhe und Kontaktzeit gemeinsam betrachten' } ] },
    { slide: 3, title: '', marker: 'none', points: [{ head: long }] },
    { slide: 4, title: 'Trainingsinhalte', marker: 'number', points: [
      { head: 'Aufwärmen', text: 'Lockeres Einlaufen, Mobilisation und Koordinationsübungen' },
      { head: 'Drop Jumps', text: 'Aus 40 cm Höhe, drei Serien mit je acht Wiederholungen' },
      { head: 'Hürdensprünge', text: 'Fünf Hürden in Folge, beidbeinig, mit minimaler Bodenkontaktzeit' },
      { head: 'Sprungwürfe', text: 'Handballspezifische Umsetzung mit Torwurf' } ] },
  ],
  comparisons: [{ slide: 5, title: 'Interventions- und Kontrollgruppe im Vergleich', left: { heading: 'Interventionsgruppe', points: ['Zusätzliches Sprungkrafttraining', 'Zweimal wöchentlich zwanzig Minuten', 'Normales Mannschaftstraining'] }, right: { heading: 'Kontrollgruppe', points: ['Kein Zusatztraining', 'Normales Mannschaftstraining'] } }],
  figures: [{ slide: 6, title: 'Verbesserung der Countermovement-Jump-Höhe', value: '+12 %', label: 'Sprunghöhe nach acht Wochen', caption: 'Gemessen mit einer Kontaktmatte vor und nach der Intervention.' }],
  processes: [{ slide: 7, title: 'Ablauf der Studie', steps: [{ title: 'Eingangstest', text: 'Sprungdiagnostik' }, { title: 'Intervention', text: 'Acht Wochen Training' }, { title: 'Ausgangstest', text: 'Wiederholung der Diagnostik' }] }],
  quotes: [{ slide: 8, text: 'Reaktivkraft ist die Fähigkeit, im Dehnungs-Verkürzungs-Zyklus einen hohen Kraftstoß zu realisieren.', author: 'Güllich und Schmidtbleicher', work: 'Struktur der Kraftfähigkeiten' }],
  questions: [{ slide: 9, text: 'Sollte plyometrisches Training fester Bestandteil des Jugendhandballs werden?', role: 'discussion' }],
  definitions: [{ slide: 10, term: 'Plyometrie', text: 'Trainingsmethode, die den Dehnungs-Verkürzungs-Zyklus nutzt, um die Schnellkraft zu verbessern.' }],
  timelines: [{ slide: 11, title: 'Messzeitpunkte', events: [{ date: 'Woche 0', label: 'Eingangstest' }, { date: 'Woche 4', label: 'Zwischentest' }, { date: 'Woche 8', label: 'Ausgangstest' }] }],
  sources: ['Güllich, Arne, und Dietmar Schmidtbleicher. „Struktur der Kraftfähigkeiten und ihrer Trainingsmethoden.“ Deutsche Zeitschrift für Sportmedizin, Bd. 50, Nr. 7/8, 1999, S. 223–234.'],
}, { verbatim: true });

/** The extremes: many bullets, a very long paragraph, a long headline. */
export const STRESS = toPool({
  deck: { language: 'en', title: 'Extremes', shortTitle: 'Extremes', posterWords: ['UNDERSTANDING', 'CONSOLIDATION', 'RECOMMENDATIONS'] },
  pointLists: [
    { slide: 1, title: 'Recommendations for Schools and Universities Regarding Sleep Hygiene Education', marker: 'bullet', points: Array.from({ length: 12 }, (_, i) => ({ head: `Bullet number ${i + 1} stays on the slide with its full wording` })) },
    { slide: 2, title: 'A long paragraph', marker: 'none', points: [{ head: `${long} ${long} ${long}` }] },
  ],
}, { verbatim: true });

export const DECKS = { sample: SAMPLE_POOL, german: GERMAN, stress: STRESS };
