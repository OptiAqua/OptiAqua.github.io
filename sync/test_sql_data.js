require('dotenv').config();
const sql = require('mssql');

const epicorConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: 'Epicor10Live',
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 5, min: 0, idleTimeoutMillis: 15000 }
};

async function test() {
  try {
    const pool = await sql.connect(epicorConfig);
    const result = await pool.request().query(`
      SELECT TOP 5
          qh.QuoteNum AS BidNumber, 
          cust.Name AS CustomerName, 
          Erp.QuoteHed_UD.Character01, 
          Erp.QuoteHed_UD.Character02, 
          Erp.QuoteHed_UD.Character03
      FROM Erp.QuoteHed AS qh 
      INNER JOIN Erp.QuoteHed_UD 
          ON qh.SysRowID = Erp.QuoteHed_UD.ForeignSysRowID 
      LEFT OUTER JOIN Erp.Customer AS cust 
          ON qh.Company = cust.Company AND qh.CustNum = cust.CustNum 
      WHERE qh.ExpirationDate >= GETDATE()
      ORDER BY qh.DateQuoted DESC;
    `);
    console.log(result.recordset);
    pool.close();
  } catch (err) {
    console.error(err);
  }
}

test();
