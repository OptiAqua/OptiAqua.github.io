const sql = require('mssql');
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, val] = line.split('=');
  if (key && val) env[key.trim()] = val.trim();
});
const epicorConfig = {
  user: env.SQL_EPICOR_USER,
  password: env.SQL_EPICOR_PASSWORD,
  server: env.SQL_SERVER,
  database: 'Epicor10Live',
  options: { encrypt: false, trustServerCertificate: true }
};

async function test() {
  try {
    const pool = await sql.connect(epicorConfig);
    const result = await pool.request().query(`
      SELECT TOP 5 
        qh.QuoteNum, 
        ud.Character06 AS TargetCategory,
        ud.Bidformat_c AS BidFormat,
        qh.Character10 AS DeliveryMethod
      FROM Erp.QuoteHed qh
      LEFT JOIN Erp.QuoteHed_UD ud ON qh.SysRowID = ud.ForeignSysRowID
      WHERE ud.Character06 IS NOT NULL AND ud.Character06 != ''
    `);
    console.log(result.recordset);
    pool.close();
  } catch (err) {
    console.error(err);
  }
}
test();
