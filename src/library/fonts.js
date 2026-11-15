// Every face carries its type classification (`group`: serif | sans | mono, `cls`: e.g.
// transitional, didone, neo-grotesque, humanist, geometric), its `family` (Arial Black is
// Arial's heavy weight) and `width`. laws.js uses these to check each direction's pairing.
//
// Fonts that ship with Microsoft Office (Windows and Mac), so an exported deck
// looks the same when someone else opens and edits it.
// `css` adds fallbacks for the preview on devices without Office (e.g. iPad).
// `capsOnly` faces have no real lower case (they would capitalise phonetic transcriptions).
// `factor` is the average character width in em, used for text fitting;
// `capsFactor` the same for text in capitals (measured in the browser).
// Poster and Glass fonts (`embed: true`) are not part of Office; they ship with the app
// (fonts/, SIL Open Font License). In exported files the display faces become pictures
// and Manrope becomes Arial (src/export/pptx.js), since PowerPoint does not have them.

export const FONTS = {
  georgia:      { group: 'serif', cls: 'transitional', family: 'georgia', width: 'normal', office: 'Georgia',            css: 'Georgia, "Times New Roman", serif',                     factor: 0.53, capsFactor: 0.575 },
  garamond:     { group: 'serif', cls: 'old-style', family: 'garamond', width: 'normal', office: 'Garamond',           css: 'Garamond, "EB Garamond", Baskerville, Georgia, serif',  factor: 0.47 },
  palatino:     { group: 'serif', cls: 'old-style', family: 'palatino', width: 'normal', office: 'Palatino Linotype',  css: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif', factor: 0.50 },
  bookAntiqua:  { group: 'serif', cls: 'old-style', family: 'palatino', width: 'normal', office: 'Book Antiqua',       css: '"Book Antiqua", Palatino, "Palatino Linotype", Georgia, serif', factor: 0.50 },
  cambria:      { group: 'serif', cls: 'transitional', family: 'cambria', width: 'normal', office: 'Cambria',            css: 'Cambria, Charter, Georgia, serif',                      factor: 0.51 },
  rockwell:     { group: 'serif', cls: 'slab', family: 'rockwell', width: 'normal', office: 'Rockwell',           css: 'Rockwell, "Rockwell Nova", "Roboto Slab", Arvo, Georgia, serif', factor: 0.54 },
  arial:        { group: 'sans', cls: 'neo-grotesque', family: 'arial', width: 'normal', office: 'Arial',              css: 'Arial, "Helvetica Neue", Helvetica, sans-serif',        factor: 0.51, capsFactor: 0.6 },
  arialBlack:   { group: 'sans', cls: 'neo-grotesque', family: 'arial', width: 'normal', office: 'Arial Black',        css: '"Arial Black", "Helvetica Neue", Arial, sans-serif',    factor: 0.67, weight: 900 },
  verdana:      { group: 'sans', cls: 'humanist', family: 'verdana', width: 'wide', office: 'Verdana',            css: 'Verdana, Geneva, sans-serif',                           factor: 0.58 },
  trebuchet:    { group: 'sans', cls: 'humanist', family: 'trebuchet', width: 'normal', office: 'Trebuchet MS',       css: '"Trebuchet MS", "Lucida Grande", sans-serif',           factor: 0.50 },
  franklin:     { group: 'sans', cls: 'grotesque', family: 'franklin', width: 'normal', office: 'Franklin Gothic Medium', css: '"Franklin Gothic Medium", "Avenir Next Condensed", "Arial Narrow", Arial, sans-serif', factor: 0.47 },
  centuryGothic:{ group: 'sans', cls: 'geometric', family: 'centuryGothic', width: 'wide', office: 'Century Gothic',     css: '"Century Gothic", Futura, "Avenir Next", sans-serif',   factor: 0.56 },
  gillSans:     { group: 'sans', cls: 'humanist', family: 'gillSans', width: 'normal', office: 'Gill Sans MT',       css: '"Gill Sans MT", "Gill Sans", Calibri, sans-serif',      factor: 0.47 },
  calibri:      { group: 'sans', cls: 'humanist', family: 'calibri', width: 'normal', office: 'Calibri',            css: 'Calibri, Carlito, "Helvetica Neue", Arial, sans-serif', factor: 0.47 },
  bodoni:       { group: 'serif', cls: 'didone', family: 'bodoni', width: 'normal', office: 'Bodoni MT', css: '"Bodoni MT", "Bodoni 72", Didot, "Bodoni Moda", "Playfair Display", Georgia, serif', factor: 0.5, capsFactor: 0.62 },
  courier:      { group: 'mono', cls: 'monospace', family: 'courier', width: 'normal', office: 'Courier New',        css: '"Courier New", Courier, monospace',                     factor: 0.60 },
  anton:        { group: 'sans', cls: 'grotesque', family: 'anton', width: 'condensed', office: 'Anton',      css: 'Anton, Impact, "Arial Narrow", sans-serif',        factor: 0.39, capsFactor: 0.425, capsOnly: true, embed: true, file: 'Anton-Regular.ttf' },
  bebas:        { group: 'sans', cls: 'grotesque', family: 'bebas', width: 'condensed', office: 'Bebas Neue', css: '"Bebas Neue", Impact, "Arial Narrow", sans-serif', factor: 0.33, capsFactor: 0.352, capsOnly: true, embed: true, file: 'BebasNeue-Regular.ttf' },
  unbounded:    { group: 'sans', cls: 'geometric', family: 'unbounded', width: 'extended', office: 'Unbounded', css: 'Unbounded, "Arial Black", "Helvetica Neue", Arial, sans-serif', factor: 0.67, capsFactor: 0.79, weight: 500, embed: true, file: 'Unbounded.ttf' },
  manrope:      { group: 'sans', cls: 'geometric', family: 'manrope', width: 'normal', office: 'Manrope',   css: 'Manrope, "Segoe UI", "Helvetica Neue", Arial, sans-serif',  factor: 0.50, capsFactor: 0.58, embed: true, file: 'Manrope.ttf' },
  sixcaps:      { group: 'sans', cls: 'grotesque', family: 'sixcaps', width: 'condensed', office: 'Six Caps',   css: '"Six Caps", Impact, "Arial Narrow", sans-serif',   factor: 0.19, capsFactor: 0.208, capsOnly: true, embed: true, file: 'SixCaps.ttf' },
};
