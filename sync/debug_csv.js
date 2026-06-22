const fs = require('fs');
const ssrsData = fs.readFileSync('full_csv_export.txt', 'utf8');
const records = [];
const lines = ssrsData.split(/\r?\n/);
let empStartIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('EmpID,FIRSTNM,LASTNM')) {
    empStartIndex = i + 1;
    break;
  }
}

if (empStartIndex > -1) {
  for (let i = empStartIndex; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = [];
    let inQuotes = false, val = '';
    for (const ch of lines[i]) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) { row.push(val); val = ''; }
      else val += ch;
    }
    row.push(val);

    if (row.length >= 7) {
      records.push({
        EmpID: row[0], FIRSTNM: row[1], LASTNM: row[2],
        Department1: row[3], Supervisor1: row[4],
        USERACCOUNTSTATUS: row[5], COMPANYHIREDTM: row[6]
      });
    }
  }
}

const activeEmployees = records.filter(e => (e.USERACCOUNTSTATUS || '').trim() === 'Active');
const deptMap = {};
activeEmployees.forEach(e => {
  const dept = (e.Department1 || 'Unknown').trim();
  deptMap[dept] = (deptMap[dept] || 0) + 1;
});
console.log('Total Active:', activeEmployees.length);
console.log('Sample Record:', records[0]);
console.log('Dept Map:', deptMap);
