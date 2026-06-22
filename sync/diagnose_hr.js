/**
 * HR Diagnostic — run from C:\NodeJSApps\OptiAqua\sync
 * node diagnose_hr.js
 * Prints the first 5 rows of the SSRS CSV so we can see exact column names and date formats.
 */
require('dotenv').config();
const httpntlm = require('httpntlm');

const url = (process.env.SSRS_BASE_URL || '') + (process.env.SSRS_HR_REPORT || '') + '&Status=ALL&rs:Format=CSV';
console.log('Fetching:', url);

const userFull = process.env.SSRS_USER || '';
const domain = userFull.includes('\\') ? userFull.split('\\')[0] : '';
const username = userFull.includes('\\') ? userFull.split('\\')[1] : userFull;

httpntlm.get({
  url, username,
  password: process.env.SSRS_PASS || '',
  domain,
}, (err, res) => {
  if (err) { console.error('FETCH ERROR:', err); process.exit(1); }
  if (res.statusCode !== 200) { console.error('HTTP', res.statusCode); process.exit(1); }

  const lines = res.body.split(/\r?\n/);

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('EmpID,') || lines[i].startsWith('"EmpID"')) {
      headerIdx = i;
      break;
    }
  }

  console.log('\n=== HEADER ROW (index', headerIdx, ') ===');
  if (headerIdx >= 0) console.log(lines[headerIdx]);

  console.log('\n=== FIRST 5 DATA ROWS ===');
  for (let i = headerIdx + 1; i < Math.min(headerIdx + 6, lines.length); i++) {
    if (lines[i].trim()) console.log(`[${i}]`, lines[i]);
  }

  // Also print total record count
  const dataLines = lines.slice(headerIdx + 1).filter(l => l.trim() && !l.startsWith('Emp ID_label'));
  console.log('\nTotal data lines (approx):', dataLines.length);
});
