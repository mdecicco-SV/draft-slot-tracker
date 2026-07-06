#!/usr/bin/env node
// Turn a CSV exported from the draft slot tracker into a clean one-page-style PDF.
//
// Usage:
//   node make-pdf.js <export.csv> [title] [output.pdf]
//
// Examples:
//   node make-pdf.js ~/Downloads/draft-slots-2026-07-03.csv
//   node make-pdf.js ~/Downloads/draft-slots-2026-07-03.csv "SEC Left-Handed Pitchers Drafted at Age 22"
//
// Requires Google Chrome (set CHROME=/path/to/chrome to override).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [, , csvPath, titleArg, outArg] = process.argv;
if (!csvPath) {
  console.error('Usage: node make-pdf.js <export.csv> [title] [output.pdf]');
  process.exit(1);
}

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!fs.existsSync(CHROME)) {
  console.error('Chrome not found at ' + CHROME + ' — set the CHROME env var to your Chrome binary.');
  process.exit(1);
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.length === header.length)
    .map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// Accepts both raw numbers (152100) and formatted values ($152,100 / -$152,100 / −$152,100)
function parseMoney(s) {
  if (s == null) return null;
  const neg = /[-−(]/.test(String(s));
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : (neg ? -n : n);
}

function fmtMoney(n) {
  if (n == null) return '—';
  return (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US');
}

const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const finalSchool = s => {
  const parts = String(s || '').split(',').map(p => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || '';
};

const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
if (!rows.length) { console.error('No rows found in ' + csvPath); process.exit(1); }

const years = [...new Set(rows.map(r => +r.Year).filter(Boolean))].sort();
const yearSpan = years.length > 1 ? years[0] + '–' + years[years.length - 1] : String(years[0] || '');
const title = titleArg || 'MLB Draft Picks';
const subtitle = rows.length + ' picks · ' + yearSpan + ' MLB Draft' + (years.length > 1 ? 's' : '');
const generated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const body = rows.map(r => {
  const bonus = parseMoney(r.Bonus), slot = parseMoney(r.Slot), diff = parseMoney(r.Diff);
  const cls = diff > 0 ? 'pos' : diff < 0 ? 'neg' : 'zero';
  const age = r.Age === '' || r.Age == null ? '—' : (+r.Age).toFixed(1);
  return '<tr><td class=num>' + esc(r.Year) + '</td><td class=num>' + esc(r.Round) + '</td><td class=num>' + esc(r.Pick) +
    '</td><td class=player>' + esc(r.Player) + '</td><td class=num>' + age +
    '</td><td class=num>' + fmtMoney(bonus) + '</td><td class=num>' + fmtMoney(slot) +
    '</td><td class="num ' + cls + '">' + fmtMoney(diff) +
    '</td><td>' + esc(finalSchool(r.School)) + '</td><td>' + esc(r.Team) + '</td></tr>';
}).join('\n');

const html = '<!doctype html><html><head><meta charset=utf-8><style>' +
  '@page{size:letter;margin:9mm 10mm;}' +
  'body{font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;color:#18191b;margin:0;font-size:8.6px;}' +
  '.head{display:flex;align-items:baseline;gap:8px;border-bottom:3px solid #0d0d0d;padding-bottom:5px;margin-bottom:3px;}' +
  '.dot{width:9px;height:9px;background:#ff2a22;border-radius:2px;display:inline-block;margin-right:2px;}' +
  'h1{font-size:14px;margin:0;letter-spacing:-0.01em;}' +
  '.sub{color:#6b7280;font-size:10px;margin:4px 0 8px;}' +
  'table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;}' +
  'thead th{text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.06em;color:#4b5563;border-bottom:1.5px solid #0d0d0d;padding:3px 6px;}' +
  'thead th.num{text-align:right;}' +
  'td{padding:2.55px 6px;border-bottom:0.5px solid #e5e7eb;}' +
  'td.num{text-align:right;}td.player{font-weight:700;}' +
  '.pos{color:#059669;font-weight:600;}.neg{color:#dc2626;font-weight:600;}.zero{color:#6b7280;}' +
  'tr{page-break-inside:avoid;}thead{display:table-header-group;}' +
  '.foot{margin-top:8px;color:#6b7280;font-size:8.5px;display:flex;justify-content:space-between;}' +
  '</style></head><body>' +
  '<div class=head><span class=dot></span><h1>' + esc(title) + '</h1></div>' +
  '<div class=sub>' + esc(subtitle) + '</div>' +
  '<table><thead><tr><th class=num>Year</th><th class=num>Rd</th><th class=num>Pick</th><th>Player</th><th class=num>Age</th><th class=num>Bonus</th><th class=num>Slot</th><th class=num>Diff</th><th>School</th><th>Team</th></tr></thead><tbody>' +
  body + '</tbody></table>' +
  '<div class=foot><span>Age = age on day 1 of that year\'s draft. Diff = bonus minus slot value.</span><span>Generated ' + generated + '</span></div>' +
  '</body></html>';

const outPdf = outArg || csvPath.replace(/\.csv$/i, '') + '.pdf';
const tmpHtml = path.join(require('os').tmpdir(), 'draft-report-' + Date.now() + '.html');
fs.writeFileSync(tmpHtml, html);
try {
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=' + outPdf, tmpHtml], { stdio: 'pipe' });
} finally {
  fs.unlinkSync(tmpHtml);
}
console.log('Wrote ' + outPdf + ' (' + rows.length + ' rows)');
