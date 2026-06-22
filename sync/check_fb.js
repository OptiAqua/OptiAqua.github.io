const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function check() {
  const inv = await db.collection('inventory_kpis').doc('current').get();
  console.log('Inventory:', JSON.stringify(inv.data(), null, 2));
  const prod = await db.collection('production_kpis').doc('current').get();
  console.log('Production:', JSON.stringify(prod.data(), null, 2));
  process.exit(0);
}
check();
