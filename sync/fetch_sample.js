const fs = require('fs');
const sql = require('mssql');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, val] = line.split('=');
  if (key && val) env[key.trim()] = val.trim();
});

const epicorConfig = {
  user: env.SQL_USER,
  password: env.SQL_PASSWORD,
  server: env.SQL_SERVER,
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
          Erp.QuoteHed_UD.Character03,
          Erp.QuoteHed_UD.Character04
      FROM Erp.QuoteHed AS qh 
      INNER JOIN Erp.QuoteHed_UD 
          ON qh.SysRowID = Erp.QuoteHed_UD.ForeignSysRowID 
      LEFT OUTER JOIN Erp.Customer AS cust 
          ON qh.Company = cust.Company AND qh.CustNum = cust.CustNum 
      WHERE qh.ExpirationDate >= GETDATE()
      ORDER BY qh.DateQuoted DESC;
    `);
    console.log(JSON.stringify(result.recordset, null, 2));
    pool.close();
  } catch (err) {
    console.error(err);
  }
}

test();
