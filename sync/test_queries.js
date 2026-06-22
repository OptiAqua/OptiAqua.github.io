const sql = require('mssql');
require('dotenv').config({ path: '.env' });

const epicorConfig = {
  server: process.env.SQL_EPICOR_SERVER || 'aquaerpdb',
  database: process.env.SQL_EPICOR_DB || 'Epicor10Live',
  user: process.env.SQL_EPICOR_USER || 'odbcuser',
  password: process.env.SQL_EPICOR_PASS || 'odbcuser',
  options: { encrypt: false, trustServerCertificate: true },
};

async function test() {
  try {
    const pool = await sql.connect(epicorConfig);
    
    console.log('Testing Inventory...');
    const inv = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM (
        SELECT Part.PartNum
        FROM Erp.Part 
        INNER JOIN Erp.PartPlant ON Part.Company = PartPlant.Company AND Part.PartNum = PartPlant.PartNum
        LEFT JOIN Erp.PartBin ON Part.Company = PartBin.Company AND Part.PartNum = PartBin.PartNum
        WHERE Part.InActive = 0
        GROUP BY Part.PartNum, PartPlant.MinimumQty
        HAVING SUM(ISNULL(PartBin.OnhandQty, 0)) < PartPlant.MinimumQty
      ) as sub
    `);
    console.log('Min breaches:', inv.recordset[0].count);

    console.log('Testing Production...');
    const prod = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM Erp.JobHead 
      WHERE JobClosed = 0 AND JobComplete = 0
      AND ReqDueDate < GETDATE()
    `);
    console.log('Past due jobs:', prod.recordset[0].count);

    pool.close();
  } catch(err) {
    console.error(err);
  }
}
test();
