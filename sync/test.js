const httpntlm = require('httpntlm');
require('dotenv').config();

const userFull = process.env.SSRS_USER || '';
const domain = userFull.includes('\\') ? userFull.split('\\')[0] : '';
const username = userFull.includes('\\') ? userFull.split('\\')[1] : userFull;

httpntlm.get({
  url: 'http://aquaerprep/ReportServer?/ITReports/AquaEmployeeStatus&rs:Command=Render&rs:Format=CSV',
  username: username,
  password: process.env.SSRS_PASS || '',
  domain: domain
}, (err, res) => {
  if(err) {
    console.error('Error:', err);
  } else {
    require('fs').writeFileSync('full_csv_export.txt', res.body);
    console.log('Saved to full_csv_export.txt');
  }
});
