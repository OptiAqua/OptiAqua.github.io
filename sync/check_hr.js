require('dotenv').config({ path: '.env' });
const admin = require('firebase-admin');
const sa = require(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

db.collection('hr_kpis').doc('current').get().then(doc => {
  const d = doc.data();
  console.log('=== Firestore hr_kpis/current ===');
  console.log('totalEmployees:', d.totalEmployees);
  console.log('newHires:', d.newHires);
  console.log('avgTenure:', d.avgTenure);
  console.log('hiringMonths:', JSON.stringify(d.hiringMonths));
  console.log('attritionMonths:', JSON.stringify(d.attritionMonths));
  const buckets = d.tenureBuckets || {};
  console.log('tenureBuckets:', JSON.stringify(buckets));
  process.exit(0);
});
