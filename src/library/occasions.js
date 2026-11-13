// Occasions the user can pick. Students come first (seminar, paper, teaching,
// group work); pitch and work update stay available for later users.
// `structures` weights which story structures suit the occasion.

export const OCCASIONS = [
  {
    id: 'seminar',
    name: 'Seminar presentation',
    hint: 'Present a topic or text to your seminar group and lead a discussion.',
    structures: { thesisFirst: 3, questionLed: 3, contrast: 2, chronological: 2, caseFirst: 1 },
  },
  {
    id: 'thesis',
    name: 'Paper or thesis talk',
    hint: 'Present your own argument and research, e.g. a term paper or thesis.',
    structures: { thesisFirst: 3, contrast: 2, problemSolution: 2, questionLed: 1 },
  },
  {
    id: 'lesson',
    name: 'Teaching a lesson',
    hint: 'Micro-teaching or a lesson in a school placement.',
    structures: { lessonArc: 3, caseFirst: 3, questionLed: 2 },
  },
  {
    id: 'group',
    name: 'Group project',
    hint: 'Report a project you did together: aim, process, results.',
    structures: { problemSolution: 3, chronological: 2, scqa: 2, caseFirst: 1 },
  },
  {
    id: 'pitch',
    name: 'Pitch',
    hint: 'Convince people of an idea, project or proposal.',
    structures: { scqa: 3, problemSolution: 3, caseFirst: 1 },
  },
  {
    id: 'update',
    name: 'Work update',
    hint: 'Status, results and next steps for a team.',
    structures: { scqa: 3, chronological: 2, problemSolution: 1 },
  },
];

export const occasionById = (id) => OCCASIONS.find((o) => o.id === id) ?? OCCASIONS[0];
