"""Write src/library/glyphs.js: real glyph widths for the fonts the app sizes text for.

Bundled fonts are read from fonts/. Office fonts are read from free fonts with identical
widths (Liberation Sans = Arial, Liberation Mono = Courier New, Carlito = Calibri,
Caladea = Cambria). Run it again after adding a font:

    pip install fonttools
    python3 tools/glyphs.py            # defaults: fonts/ and /usr/share/fonts/truetype
"""
import json
import os
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYS = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/truetype'

# key: (file, variable weight or None); '-bold' keys are the bold cut
FONTS = {
    'anton': (f'{ROOT}/fonts/Anton-Regular.ttf', None),
    'bebas': (f'{ROOT}/fonts/BebasNeue-Regular.ttf', None),
    'sixcaps': (f'{ROOT}/fonts/SixCaps.ttf', None),
    'unbounded': (f'{ROOT}/fonts/Unbounded.ttf', 500),
    'unbounded-bold': (f'{ROOT}/fonts/Unbounded.ttf', 700),
    'manrope': (f'{ROOT}/fonts/Manrope.ttf', 400),
    'manrope-bold': (f'{ROOT}/fonts/Manrope.ttf', 700),
    'arial': (f'{SYS}/liberation/LiberationSans-Regular.ttf', None),
    'arial-bold': (f'{SYS}/liberation/LiberationSans-Bold.ttf', None),
    'courier': (f'{SYS}/liberation/LiberationMono-Regular.ttf', None),
    'courier-bold': (f'{SYS}/liberation/LiberationMono-Bold.ttf', None),
    'calibri': (f'{SYS}/crosextra/Carlito-Regular.ttf', None),
    'calibri-bold': (f'{SYS}/crosextra/Carlito-Bold.ttf', None),
    'cambria': (f'{SYS}/crosextra/Caladea-Regular.ttf', None),
    'cambria-bold': (f'{SYS}/crosextra/Caladea-Bold.ttf', None),
}
CHARS = ''.join(dict.fromkeys(''.join(chr(c) for c in range(32, 127)) + 'ÄÖÜäöüßÀÁÂÉÈÊÍÓÔÚàáâéèêíóôúçñ€£°‰–—‘’“”„…·×→§'))

tables = {}
for key, (file, wght) in FONTS.items():
    font = TTFont(file)
    if wght and 'fvar' in font:
        font = instancer.instantiateVariableFont(font, {'wght': wght})
    upm = font['head'].unitsPerEm
    cmap, hmtx = font.getBestCmap(), font['hmtx']
    have = ''.join(ch for ch in CHARS if ord(ch) in cmap)
    tables[key] = {'chars': have, 'w': [round(hmtx[cmap[ord(ch)]][0] * 1000 / upm) for ch in have]}

body = ',\n'.join(f"  {json.dumps(k)}: [{json.dumps(v['chars'], ensure_ascii=False)}, [{','.join(map(str, v['w']))}]]" for k, v in tables.items())
js = f"""// Real glyph widths (thousandths of an em), written by tools/glyphs.py: do not edit by hand.
// Bundled fonts come from fonts/; Office fonts from free fonts with identical widths
// (Liberation Sans = Arial, Liberation Mono = Courier New, Carlito = Calibri, Caladea = Cambria).
// Text in these fonts is fitted with the widths the browser and PowerPoint will really use,
// so a word like "PLYOMETRIE" or a figure like "+12 %" never runs off or breaks.

const RAW = {{
{body},
}};

const TABLES = Object.fromEntries(Object.entries(RAW).map(([key, [chars, w]]) => [key, new Map([...chars].map((ch, i) => [ch, w[i]]))]));

/** Whether exact widths are known for this font (and cut). */
export const hasGlyphs = (font, bold = false) => Boolean(TABLES[bold ? `${{font}}-bold` : font] ?? TABLES[font]);

/**
 * Width of a single line in em, or null if the font has no table. A bold cut is used when
 * there is one, otherwise the regular widths are widened a little. Unknown characters count as wide.
 */
export function widthEm(font, text, bold = false) {{
  const own = bold ? TABLES[`${{font}}-bold`] : null;
  const t = own ?? TABLES[font];
  if (!t) return null;
  const space = t.get(' ') ?? 250;
  const wide = t.get('M') ?? 700;
  let w = 0;
  for (const ch of String(text)) {{
    if (t.has(ch)) w += t.get(ch);
    else if (ch === '\\u202F') w += space * 0.6; // narrow no-break space between a number and its unit
    else if (/\\s/.test(ch)) w += space;
    else w += wide;
  }}
  return (w / 1000) * (bold && !own ? 1.06 : 1);
}}
"""
with open(f'{ROOT}/src/library/glyphs.js', 'w') as f:
    f.write(js)
print(f'{len(tables)} tables written to src/library/glyphs.js')
