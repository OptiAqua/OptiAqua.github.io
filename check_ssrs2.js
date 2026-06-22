const fs = require('fs');
const httpntlm = require('httpntlm');

function getSSRS(urlPath, outFile) {
  const url = `http://aquaerprep/ReportServer${urlPath}&rs:Format=CSV`;
  console.log(`Fetching: ${url}`);
  
  httpntlm.get({
    url: url,
    username: 'odbcuser',
    password: 'odbcuser',
    domain: '',
  }, (err, res) => {
    if (err) return console.error(err);
    if (res.statusCode !== 200) {
      console.error(`Error ${res.statusCode}:`, res.body.substring(0, 500));
      return;
    }
    fs.writeFileSync(outFile, res.body);
    console.log(`Saved ${outFile} (Size: ${res.body.length})`);
  });
}

getSSRS('?/Epicor10Live/reports/AquaCustom/MinimumInventory/MinInventoryOnHand&rs:Command=Render', 'n:\\Documentation\\OptiAqua\\inv.csv');
getSSRS('?/Epicor10Live/reports/Dashboard/OpenJobsByDueDateNew&rs:Command=Render', 'n:\\Documentation\\OptiAqua\\prod.csv');
