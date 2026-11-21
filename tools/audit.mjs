// Layout audit: builds the test decks (tools/audit/decks.js) in every direction and density,
// renders them in headless Chromium at full size and measures the real layout:
//   - text that overflows its box or runs off the slide
//   - words broken in the middle across two lines
//   - text overlapping other text
//   - text the engine itself says is too long
// Writes audit-report/index.html (a screenshot of every slide with a problem) and
// audit-report/findings.json, and exits with 1 if anything was found.
//
//   npm run audit                 everything
//   npm run audit -- glass        only directions whose id or look contains "glass"
//
// Needs Playwright with Chromium (preinstalled in Claude's cloud sessions; elsewhere:
// npm i -D playwright && npx playwright install chromium).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DIRECTIONS } from '../src/library/directions.js';
import { DECKS } from './audit/decks.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'audit-report');
const only = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root)) { res.statusCode = 403; res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const dirs = DIRECTIONS.filter((d) => !only || d.id.includes(only) || (d.family ?? 'editorial').includes(only));
const runs = [];
for (const [deck, pool] of Object.entries(DECKS)) for (const d of dirs) for (const density of ['light', 'medium', 'dense']) {
  // the sample deck is told in several story structures, so more forms are covered
  for (const structure of pool.verbatim ? [0] : [0, 3, 6]) runs.push({ deck, dir: d.id, density, structure });
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort()); // no network: photos may be missing, text is what counts
const findings = [];
const shots = new Map();
let done = 0;
for (const r of runs) {
  await page.goto(`${base}/tools/audit/page.html?deck=${r.deck}&dir=${r.dir}&density=${r.density}&structure=${r.structure}`);
  await page.waitForSelector('body[data-ready]');
  const err = await page.evaluate(() => window.AUDIT_ERROR);
  if (err) { findings.push({ ...r, kind: 'crash', text: err }); continue; }
  const found = await page.evaluate(() => window.AUDIT);
  for (const f of found) {
    findings.push(f);
    // one screenshot per slide with problems
    const key = `${f.deck}-${f.direction}-${f.density}-${f.structure}-${f.slide}`;
    if (!shots.has(key)) {
      const file = `shots/${key}.png`;
      await page.locator(`.slide-frame[data-index="${f.slide - 1}"]`).screenshot({ path: path.join(out, file) });
      shots.set(key, { file, issues: [] });
    }
    shots.get(key).issues.push(f);
  }
  if (++done % 50 === 0) process.stdout.write(`${done}/${runs.length} decks checked\n`);
}
await browser.close();
server.close();

fs.writeFileSync(path.join(out, 'findings.json'), JSON.stringify(findings, null, 1));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cards = [...shots.entries()].map(([key, s]) => `<figure><img src="${s.file}" alt="" loading="lazy"><figcaption><b>${esc(key)}</b> · ${esc(s.issues[0].form)}<ul>${s.issues.map((i) => `<li>${esc(i.kind)}: “${esc(i.text)}” ${esc(i.detail ?? '')}</li>`).join('')}</ul></figcaption></figure>`).join('\n');
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Layout audit</title>
<style>body{font:14px system-ui;margin:24px;background:#f4f4f4}figure{margin:0 0 24px;background:#fff;padding:12px;border-radius:10px}img{width:640px;max-width:100%;display:block}ul{margin:6px 0 0;padding-left:18px}</style>
<h1>Layout audit: ${findings.length} finding(s) on ${shots.size} slide(s), ${runs.length} decks checked</h1>${cards || '<p>Nothing found.</p>'}`);

const byKind = findings.reduce((m, f) => m.set(f.kind, (m.get(f.kind) ?? 0) + 1), new Map());
console.log(`\n${runs.length} decks checked, ${findings.length} finding(s) on ${shots.size} slide(s)`);
for (const [k, n] of byKind) console.log(`  ${n}× ${k}`);
console.log(`Report: ${path.relative(process.cwd(), path.join(out, 'index.html'))}`);
process.exit(findings.length ? 1 : 0);
