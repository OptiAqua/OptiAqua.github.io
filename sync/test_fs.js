const sql = require('mssql');
require('dotenv').config({ path: '.env' });

const aquaConfig = {
  user: 'odbcuser',
  password: 'odbcuser',
  server: 'Aqua18',
  database: 'AquaReports',
  options: { encrypt: false, trustServerCertificate: true, requestTimeout: 300000 }
};

async function test() {
  try {
    const pool = await sql.connect(aquaConfig);
    const result = await pool.request().query(`
      SELECT
          Company,
          FSTripID,
          Purpose,
          EmpNum,
          Name,
          SundayDate,
          RecordID,
          NumOfDays,
          TripTypeAbbrevDesc,
          TripSubTypeDesc,
          OrderNum,
          ProdAbbrevDesc,
          QFSClaimID,
          ENum,
          ProjectID,
          ProjName,
          ProjCity,
          ProjState,
          Sunday,
          Monday,
          Tuesday,
          Wednesday,
          Thursday,
          Friday,
          Saturday,
          SalesRep1,
          RepFax1,
          SalesRep2,
          RepFax2
      FROM [AquaAerobic].[dbo].[CustomerServiceScheduleReport]
      WHERE SundayDate >= DATEADD(wk, DATEDIFF(wk, 7, GETDATE()), 0) 
        AND SundayDate < DATEADD(wk, DATEDIFF(wk, 7, GETDATE()) + 1, 0)
    `);
    console.log(`Rows returned: ${result.recordset.length}`);
    if (result.recordset.length > 0) {
      console.log(result.recordset[0]);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
