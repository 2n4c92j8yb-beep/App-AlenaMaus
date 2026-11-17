// The interface's few icons, drawn in one stroke weight (1.8 on a 16px grid) and coloured
// by the text colour, so they match each other and every font fallback.

const PATHS = {
  up: '<path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/>',
  down: '<path d="M8 3v10M3.5 8.5 8 13l4.5-4.5"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.8"/><path d="M10.5 3.2V3.5A1 1 0 0 0 9.5 2.5H4A1.5 1.5 0 0 0 2.5 4v5.5a1 1 0 0 0 1 1h.3"/>',
  trash: '<path d="M2.8 4.3h10.4M6.3 4.3V2.8h3.4v1.5M4.2 4.3l.6 8.6c.05.6.5 1.1 1.1 1.1h4.2c.6 0 1.05-.5 1.1-1.1l.6-8.6"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
};

/** An inline SVG icon; the button around it carries the accessible name. */
export function icon(name) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
  return span;
}
