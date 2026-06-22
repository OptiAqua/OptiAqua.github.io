const fs = require('fs');
const httpntlm = require('httpntlm');
require('dotenv').config({ path: 'Z:\\OptiAqua\\sync\\.env' });

function getSSRS(urlPath, outFile) {
  const url = `${process.env.SSRS_BASE_URL}${urlPath}&rs:Format=CSV`;
  console.log(`Fetching: ${url}`);
  const userFull = process.env.SSRS_USER || '';
  const domain = userFull.includes('\\') ? userFull.split('\\')[0] : '';
  const username = userFull.includes('\\') ? userFull.split('\\')[1] : userFull;

  httpntlm.get({
    url: url,
    username: username,
    password: process.env.SSRS_PASS || '',
    domain: domain,
  }, (err, res) => {
    if (err) return console.error(err);
    fs.writeFileSync(outFile, res.body);
    console.log(`Saved ${outFile} (Size: ${res.body.length})`);
  });
}

getSSRS('?/Epicor10Live/reports/AquaCustom/MinimumInventory/MinInventoryOnHand&rs:Command=Render', 'n:\\Documentation\\OptiAqua\\inv.csv');
getSSRS('?/Epicor10Live/reports/Dashboard/OpenJobsByDueDateNew&rs:Command=Render', 'n:\\Documentation\\OptiAqua\\prod.csv');
