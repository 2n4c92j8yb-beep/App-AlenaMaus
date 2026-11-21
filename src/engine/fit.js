// Text fitting without a browser.
// Slides are laid out in inches on a 13.333 x 7.5 canvas (PowerPoint 16:9).
// Widths are estimated from an average character width per font (in em),
// which keeps the HTML preview and the later PowerPoint export in step.

export const SLIDE_W = 13.333;
export const SLIDE_H = 7.5;

/** Count wrapped lines for `text` in a box `widthIn` inches wide. */
export function countLines(text, widthIn, sizePt, widthFactor) {
  const charW = (sizePt / 72) * widthFactor;
  // 4% safety margin: real glyph widths vary around the average
  const maxChars = Math.max(1, Math.floor((widthIn * 0.96) / charW));
  let lines = 0;
  let longestWord = 0;
  for (const para of String(text).split('\n')) {
    const words = para.split(/[ \t\r\f\v]+/).filter(Boolean); // no-break spaces keep a number and its unit together
    if (!words.length) { lines += 1; continue; }
    let cur = 0;
    for (const w of words) {
      longestWord = Math.max(longestWord, w.length);
      if (cur === 0) {
        lines += 1;
        cur = w.length;
      } else if (cur + 1 + w.length <= maxChars) {
        cur += 1 + w.length;
      } else {
        lines += 1;
        cur = w.length;
      }
      while (cur > maxChars) { lines += 1; cur -= maxChars; }
    }
  }
  return { lines, maxChars, wordTooLong: longestWord > maxChars };
}

/**
 * Count wrapped lines with real glyph widths: `measure(str)` gives a string's width in em.
 * Like the browser, a line may break at spaces and after hyphens.
 */
export function countLinesMeasured(text, widthIn, sizePt, measure) {
  const em = sizePt / 72;
  const max = widthIn * 0.98;
  const space = measure(' ') * em;
  let lines = 0;
  let tooLong = false;
  for (const para of String(text).split('\n')) {
    // pieces a line may end after: words, and the parts of hyphenated words
    const words = para.split(/[ \t\r\f\v]+/).filter(Boolean);
    if (!words.length) { lines += 1; continue; }
    let cur = -1; // width of the current line; -1 = no line started
    for (const word of words) {
      const parts = word.match(/[^\-–]+[\-–]?|[\-–]/g) ?? [word];
      parts.forEach((part, k) => {
        const w = measure(part) * em;
        if (w > max) tooLong = true;
        const gap = k === 0 && cur > 0 ? space : 0;
        if (cur < 0) { lines += 1; cur = w; }
        else if (cur + gap + w <= max) cur += gap + w;
        else { lines += 1; cur = w; }
      });
    }
  }
  return { lines, wordTooLong: tooLong };
}

/**
 * Find the largest font size between `max` and `min` (pt) at which the text
 * fits the box. Returns { size, lines, fits }.
 */
export function fitText(text, w, h, { max, min, factor, lineHeight = 1.2, maxLines = Infinity, step = 1, lineEm, measure }) {
  // one line with a known real width (lineEm, in em): shrink until it fits the box exactly
  if (lineEm != null && maxLines === 1) {
    for (let size = max; size >= min; size -= step) {
      if (lineEm * (size / 72) <= w * 0.97 && (size / 72) * lineHeight <= h + 1e-9) return { size, lines: 1, fits: true };
    }
    return { size: min, lines: 1, fits: false };
  }
  const count = measure ? (size) => countLinesMeasured(text, w, size, measure) : (size) => countLines(text, w, size, factor);
  for (let size = max; size >= min; size -= step) {
    const { lines, wordTooLong } = count(size);
    const height = lines * (size / 72) * lineHeight;
    if (height <= h && lines <= maxLines && !wordTooLong) return { size, lines, fits: true };
  }
  const { lines } = count(min);
  return { size: min, lines, fits: false };
}

/** Height in inches that `lines` lines of text take up. */
export function textHeight(lines, sizePt, lineHeight = 1.2) {
  return lines * (sizePt / 72) * lineHeight;
}
