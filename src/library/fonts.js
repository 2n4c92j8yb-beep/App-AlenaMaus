// Fonts that ship with Microsoft Office (Windows and Mac), so an exported deck
// looks the same when someone else opens and edits it.
// `css` adds fallbacks for the preview on devices without Office (e.g. iPad).
// `factor` is the average character width in em, used for text fitting;
// `capsFactor` the same for text in capitals (measured in the browser).
// Poster fonts (`embed: true`) are not part of Office; they ship with the app
// (fonts/, SIL Open Font License) and are embedded in exported files.

export const FONTS = {
  georgia:      { office: 'Georgia',            css: 'Georgia, "Times New Roman", serif',                     factor: 0.53, capsFactor: 0.575 },
  garamond:     { office: 'Garamond',           css: 'Garamond, "EB Garamond", Baskerville, Georgia, serif',  factor: 0.47 },
  palatino:     { office: 'Palatino Linotype',  css: '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif', factor: 0.50 },
  bookAntiqua:  { office: 'Book Antiqua',       css: '"Book Antiqua", Palatino, "Palatino Linotype", Georgia, serif', factor: 0.50 },
  cambria:      { office: 'Cambria',            css: 'Cambria, Charter, Georgia, serif',                      factor: 0.51 },
  rockwell:     { office: 'Rockwell',           css: 'Rockwell, "American Typewriter", "Courier New", serif', factor: 0.54 },
  arial:        { office: 'Arial',              css: 'Arial, "Helvetica Neue", Helvetica, sans-serif',        factor: 0.51, capsFactor: 0.6 },
  arialBlack:   { office: 'Arial Black',        css: '"Arial Black", "Helvetica Neue", Arial, sans-serif',    factor: 0.67, weight: 900 },
  verdana:      { office: 'Verdana',            css: 'Verdana, Geneva, sans-serif',                           factor: 0.58 },
  trebuchet:    { office: 'Trebuchet MS',       css: '"Trebuchet MS", "Lucida Grande", sans-serif',           factor: 0.50 },
  franklin:     { office: 'Franklin Gothic Medium', css: '"Franklin Gothic Medium", "Avenir Next Condensed", "Arial Narrow", Arial, sans-serif', factor: 0.47 },
  centuryGothic:{ office: 'Century Gothic',     css: '"Century Gothic", Futura, "Avenir Next", sans-serif',   factor: 0.56 },
  gillSans:     { office: 'Gill Sans MT',       css: '"Gill Sans MT", "Gill Sans", Calibri, sans-serif',      factor: 0.47 },
  calibri:      { office: 'Calibri',            css: 'Calibri, Carlito, "Helvetica Neue", Arial, sans-serif', factor: 0.47 },
  courier:      { office: 'Courier New',        css: '"Courier New", Courier, monospace',                     factor: 0.60 },
  anton:        { office: 'Anton',      css: 'Anton, Impact, "Arial Narrow", sans-serif',        factor: 0.39, capsFactor: 0.425, embed: true, file: 'Anton-Regular.ttf' },
  bebas:        { office: 'Bebas Neue', css: '"Bebas Neue", Impact, "Arial Narrow", sans-serif', factor: 0.33, capsFactor: 0.352, embed: true, file: 'BebasNeue-Regular.ttf' },
  sixcaps:      { office: 'Six Caps',   css: '"Six Caps", Impact, "Arial Narrow", sans-serif',   factor: 0.19, capsFactor: 0.208, embed: true, file: 'SixCaps.ttf' },
};
