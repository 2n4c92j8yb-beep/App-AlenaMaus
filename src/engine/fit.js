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
    const words = para.split(/\s+/).filter(Boolean);
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
 * Find the largest font size between `max` and `min` (pt) at which the text
 * fits the box. Returns { size, lines, fits }.
 */
export function fitText(text, w, h, { max, min, factor, lineHeight = 1.2, maxLines = Infinity, step = 1 }) {
  for (let size = max; size >= min; size -= step) {
    const { lines, wordTooLong } = countLines(text, w, size, factor);
    const height = lines * (size / 72) * lineHeight;
    if (height <= h && lines <= maxLines && !wordTooLong) return { size, lines, fits: true };
  }
  const { lines } = countLines(text, w, min, factor);
  return { size: min, lines, fits: false };
}

/** Height in inches that `lines` lines of text take up. */
export function textHeight(lines, sizePt, lineHeight = 1.2) {
  return lines * (sizePt / 72) * lineHeight;
}
