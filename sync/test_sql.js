const sql = require('mssql');
async function test() {
  const config = {
    server: 'Aqua18',
    database: 'AquaReports',
    user: 'sa',
    password: 'house/fire',
    options: { encrypt: false, trustServerCertificate: true }
  };
  try {
    await sql.connect(config);
    console.log('Connected to Aqua18!');
    process.exit(0);
  } catch (err) {
    console.log('Error:', err.message);
    process.exit(1);
  }
}
test();
