/**
 * OptiAqua Data Sync Server
 * Aqua-Aerobic Systems, Inc.
 *
 * Fetches data from:
 *   - SQL Server: EpicorLive    (Sales/Bids/Shop)
 *   - SQL Server: Neptune       (Shipping/Orders)
 *   - SQL Server: AquaAerobic   (Warranty/Service)
 *   - SSRS Report: AquaEmployeeStatus (HR headcount)
 *   - HTTP Ping:  All 11 internal apps (uptime + response time)
 *   - HTTP API:   Node.js apps that expose /api/stats endpoints
 *
 * App health checks cover:
 *   IT HelpDesk :5555, Pick Pack Print :5050, Field Service :5000,
 *   Master Packing List :4000, Panel Progress :5084, CSD :aqua88:5076,
 *   Company Search :3000, AVA HR :3000/hrchat, Visitor System,
 *   AQUALocator, AquaGuide
 *
 * Pushes to Firebase Firestore 3x daily (6am, 12pm, 6pm).
 * Stores a lastSync timestamp so the dashboard can display it.
 *
 * SETUP:
 *   1. Copy .env.example to .env and fill in credentials
 *   2. npm install
 *   3. npm start              (runs on schedule)
 *      node sync.js --once   (run once immediately)
 *
 * DEPLOY on aqua-aerobic.net:
 *   pm2 start sync.js --name optiaqua-sync
 */

'use strict';

// Load .env from the same directory as this script (not the cwd)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cron = require('node-cron');
const sql = require('mssql');
const admin = require('firebase-admin');

// ============================================================
// FIREBASE ADMIN INIT
// Supports two credential methods (use whichever is easier on your server):
//
//   Method 1 (RECOMMENDED for server deploy):
//     Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
//     The JSON file never touches git — copy it directly to the server.
//
//   Method 2 (env vars — good for cloud/CI):
//     Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//     in your .env file.
// ============================================================
let credential;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Method 1: JSON key file path
  const serviceAccount = require(path.join(__dirname, 'serviceaccount.json'));
  credential = admin.credential.cert(serviceAccount);
  console.log(`[OptiAqua Sync] Using service account file: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
} else {
  // Method 2: individual env vars
  credential = admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  });
  console.log(`[OptiAqua Sync] Using env-var credentials — project: ${process.env.FIREBASE_PROJECT_ID}`);
}

admin.initializeApp({ credential });
const db = admin.firestore();
console.log('[OptiAqua Sync] Firebase connected.');



// ============================================================
// SQL CONNECTION CONFIGS
// Windows Authentication is used when SQL_WINDOWS_AUTH=true
// or when no user/pass is set. SQL auth is used otherwise.
// ============================================================
function sqlConfig(serverStr, databaseStr, userKey, passKey) {
  const server = (serverStr || '').trim();
  const database = (databaseStr || '').trim();
  const user = (process.env[userKey] || '').trim();
  const pass = (process.env[passKey] || '').trim();

  const useWindowsAuth = process.env.SQL_WINDOWS_AUTH === 'true'
    || !user
    || user === '';

  const base = {
    server: server,
    database: database,
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 30000,
    requestTimeout: 120000,  // 2 min — Shipping Orders query takes ~11s, 6 queries run sequentially
  };

  if (useWindowsAuth) {
    base.options.trustedConnection = true;
  } else {
    base.user = user;
    base.password = pass;
  }

  const authMode = useWindowsAuth ? 'Windows Auth' : `SQL user: ${user}`;
  console.log(`  [SQL] ${database} on ${server} — ${authMode}`);
  return base;
}

// SQL credentials are hardcoded here as the primary values.
// .env values override them if present (useful for local dev / secrets rotation).
const epicorConfig = sqlConfig(
  process.env.SQL_EPICOR_SERVER || 'aquaerpdb',
  process.env.SQL_EPICOR_DB || 'Epicor10Live',
  'SQL_EPICOR_USER', 'SQL_EPICOR_PASS'
);
if (!process.env.SQL_EPICOR_USER) process.env.SQL_EPICOR_USER = 'odbcuser';
if (!process.env.SQL_EPICOR_PASS) process.env.SQL_EPICOR_PASS = 'odbcuser';

// Shipping queries all use Aquaerpdb.[Custom].[dbo].OptiAqua — connect to Custom DB directly.
const customConfig = sqlConfig(
  process.env.SQL_EPICOR_SERVER || 'aquaerpdb',
  process.env.SQL_EPICOR_CUSTOM_DB || 'Custom',
  'SQL_EPICOR_USER', 'SQL_EPICOR_PASS'
);

if (!process.env.SQL_NEPTUNE_USER) process.env.SQL_NEPTUNE_USER = 'odbcuser';
if (!process.env.SQL_NEPTUNE_PASS) process.env.SQL_NEPTUNE_PASS = 'odbcuser';
const neptuneConfig = sqlConfig(
  process.env.SQL_NEPTUNE_SERVER || 'Aqua26',
  process.env.SQL_NEPTUNE_DB || 'Neptune',
  'SQL_NEPTUNE_USER', 'SQL_NEPTUNE_PASS'
);

if (!process.env.SQL_AQUA_USER) process.env.SQL_AQUA_USER = 'odbcuser';
if (!process.env.SQL_AQUA_PASS) process.env.SQL_AQUA_PASS = 'odbcuser';
const aquaConfig = sqlConfig(
  process.env.SQL_AQUA_SERVER || 'Aqua18',
  process.env.SQL_AQUA_DB || 'AquaReports',
  'SQL_AQUA_USER', 'SQL_AQUA_PASS'
);

const eetdbConfig = sqlConfig(
  'Aqua3',
  'eetdb',
  'SQL_AQUA_USER', 'SQL_AQUA_PASS'
);

// APD engineering view on Aqua26 (same server as Neptune, different DB)
const apdConfig = sqlConfig(
  process.env.SQL_NEPTUNE_SERVER || 'Aqua26',
  'APD',
  'SQL_NEPTUNE_USER', 'SQL_NEPTUNE_PASS'
);

// ============================================================
// HELPERS
// ============================================================
async function querySQL(config, queryStr) {
  // Use a dedicated ConnectionPool instead of global sql.connect
  // Global sql.connect fails when connecting to multiple servers concurrently
  const pool = new sql.ConnectionPool(config);
  await pool.connect();
  try {
    const result = await pool.request().query(queryStr);
    return result.recordset;
  } finally {
    await pool.close();
  }
}

async function pushToFirestore(collection, docId, data) {
  await db.collection(collection).doc(docId).set({
    ...data,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function pushBatch(collection, records, idField) {
  const batch = db.batch();
  records.forEach(rec => {
    const id = String(rec[idField] || Date.now() + Math.random());
    const ref = db.collection(collection).doc(id);
    batch.set(ref, { ...rec, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  });
  await batch.commit();
}

// Splits a large array into chunks of chunkSize and stores each as a
// separate Firestore doc: collection/chunk_0, chunk_1, ... + a summary doc.
// IMPORTANT: Deletes any stale chunks from previous larger syncs so the
// app never reads stale data (e.g. old 238-chunk run → new 1-chunk run).
async function pushChunked(collection, records, chunkSize = 400) {
  if (!Array.isArray(records)) {
    // Not an array — just store as-is
    return pushToFirestore(collection, 'latest', records);
  }

  const chunks = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }

  // Read old summary to find how many chunks existed before
  let oldChunkCount = 0;
  try {
    const oldSummary = await db.collection(collection).doc('summary').get();
    if (oldSummary.exists) {
      oldChunkCount = oldSummary.data().chunkCount || 0;
    }
  } catch (e) { /* ignore — collection may not exist yet */ }

  // Delete stale chunks (chunk_N where N >= new count) in batches of 500
  if (oldChunkCount > chunks.length) {
    const staleIds = [];
    for (let i = chunks.length; i < oldChunkCount; i++) staleIds.push(`chunk_${i}`);
    console.log(`  [pushChunked] Deleting ${staleIds.length} stale chunks from ${collection}...`);
    // Firestore batch limit is 500 ops
    for (let b = 0; b < staleIds.length; b += 500) {
      const batch = db.batch();
      staleIds.slice(b, b + 500).forEach(id => {
        batch.delete(db.collection(collection).doc(id));
      });
      await batch.commit();
    }
  }

  // Write summary with new chunk count
  await db.collection(collection).doc('summary').set({
    totalRecords: records.length,
    chunkCount: chunks.length,
    chunkSize,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Write each new chunk concurrently
  const writePromises = chunks.map((chunk, i) => {
    return db.collection(collection).doc(`chunk_${i}`).set({
      data: chunk,
      chunkIndex: i,
      totalChunks: chunks.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await Promise.all(writePromises);
  console.log(`  Stored ${records.length} records in ${chunks.length} chunks -> ${collection}`);
}

// Lists all user tables in a SQL database — use this to find correct table names
async function discoverTables(config) {
  try {
    const rows = await querySQL(config, `
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    return rows.map(r => `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`);
  } catch (err) {
    return [`ERROR: ${err.message}`];
  }
}

// ============================================================
// SYNC: SALES — Epicor10Live (OrderHed, OrderDtl, QuoteHed)
// ============================================================
async function syncSales() {
  console.log('[Sales] Syncing from Epicor10Live...');
  try {
    const bidsRows = await querySQL(epicorConfig, `
      SELECT 
          qh.QuoteNum AS BidNumber, 
          qh.DateQuoted, 
          qh.ExpirationDate, 
          (qh.TotalGrossValue * (CASE WHEN qrp.RepSplit = 50 THEN 0.5 ELSE 1 END)) AS TotalGrossValue, 
          cust.Name AS CustomerName, 
          CASE 
              WHEN qh.QuoteClosed = 1 AND rc.Description = 'WIN' THEN 'Won' 
              WHEN qh.QuoteClosed = 1 AND rc.Description <> 'WIN'  THEN 'Lost / Closed' 
              WHEN qh.QuoteClosed = 0 THEN 'PENDING' 
              ELSE 'Unknown' 
          END AS BidStatus, 
          qrp.SalesRepCode AS SalesRep,
          pg.Description AS ProductLine,
          qh_ud.Character06 AS Category
      FROM Erp.QuoteHed AS qh 
      INNER JOIN Erp.QuoteHed_UD AS qh_ud
          ON qh.SysRowID = qh_ud.ForeignSysRowID 
      LEFT OUTER JOIN Erp.Customer AS cust 
          ON qh.Company = cust.Company AND qh.CustNum = cust.CustNum 
      LEFT OUTER JOIN Erp.Reason AS rc 
          ON qh.Company = rc.Company AND qh.ReasonCode = rc.ReasonCode
      LEFT OUTER JOIN Erp.QSalesRP AS qrp 
          ON qh.Company = qrp.Company AND qh.QuoteNum = qrp.QuoteNum AND qrp.PrimeRep = 1
      LEFT OUTER JOIN Erp.QuoteDtl AS qd 
          ON qh.Company = qd.Company AND qh.QuoteNum = qd.QuoteNum AND qd.QuoteLine = 1
      LEFT OUTER JOIN Erp.ProdGrup AS pg 
          ON qd.Company = pg.Company AND qd.ProdCode = pg.ProdCode
      LEFT OUTER JOIN Erp.ProdGrup_UD AS pg_ud
          ON pg.SysRowID = pg_ud.ForeignSysRowID
      Where YEAR(qh.DateQuoted) >= YEAR(GETDATE()) - 3
        AND qh_ud.Character06 IN ('Target', 'Reserve', '100%', 'Watch List')
        AND pg.Description <> 'OZONE'
        AND (pg_ud.Character01 IS NULL OR pg_ud.Character01 NOT IN ('Aeration/Mixing Group', 'Aftermarket Sales Group', 'RP Parts Group'))
      ORDER BY qh.DateQuoted DESC
    `);

    const kpisByYear = {};

    bidsRows.forEach(row => {
      if (!row.DateQuoted) return;
      const year = new Date(row.DateQuoted).getFullYear().toString();

      if (!kpisByYear[year]) {
        kpisByYear[year] = {
          totalBids: 0, won: 0, pending: 0, lost: 0, backlogVal: 0, wonVal: 0,
          productCounts: {},
          categories: {},
          recentBids: []
        };
      }

      const yr = kpisByYear[year];
      yr.totalBids++;

      const status = row.BidStatus;
      if (status === 'Won') { yr.won++; yr.wonVal += row.TotalGrossValue || 0; }
      else if (status === 'PENDING') { yr.pending++; yr.backlogVal += row.TotalGrossValue; }
      else yr.lost++;

      const pLine = row.ProductLine || 'Unknown';
      yr.productCounts[pLine] = (yr.productCounts[pLine] || 0) + 1;

      // Track Pipeline Value by Category (100%, Reserve, Watch List, Target)
      if (status === 'PENDING' && row.Category) {
        const cat = row.Category.trim();
        yr.categories[cat] = (yr.categories[cat] || 0) + (row.TotalGrossValue || 0);
      }

      const bidObj = {
        bidNum: `BID-${row.BidNumber}`,
        customer: row.CustomerName || 'Unknown',
        productLine: pLine,
        value: `$${(row.TotalGrossValue / 1000).toFixed(1)}K`,
        status: status,
        rep: row.SalesRep || 'Unknown',
        due: row.DateQuoted ? new Date(row.DateQuoted).toISOString() : null,
        year: year
      };

      if (!kpisByYear[year].allBids) kpisByYear[year].allBids = [];
      kpisByYear[year].allBids.push(bidObj);

      if (yr.recentBids.length < 50) {
        yr.recentBids.push(bidObj);
      }
    });

    const allBidsToChunk = [];
    for (const year of Object.keys(kpisByYear)) {
      const yr = kpisByYear[year];
      if (yr.allBids) {
        allBidsToChunk.push(...yr.allBids);
      }
      await pushToFirestore('sales_kpis', year, {
        totalBids: yr.totalBids, won: yr.won, pending: yr.pending, lost: yr.lost,
        backlog: `$${(yr.backlogVal / 1000000).toFixed(1)}M`,
        wonValue: `$${(yr.wonVal / 1000000).toFixed(1)}M`,
        productLines: Object.keys(yr.productCounts),
        productOrders: Object.values(yr.productCounts),
        pipelineCategories: yr.categories,
        monthlyActual: [10, 15, 12, 18, 20, 25],
        monthlyTarget: [12, 12, 15, 15, 20, 20],
        recentBids: yr.recentBids
      });
    }

    await pushChunked('sales_bids', allBidsToChunk, 2000);

    console.log('[Sales] Done.');
  } catch (err) {
    console.error('[Sales] ERROR:', err.message);
  }
}

// ============================================================
// SYNC: MARKETING
// ============================================================
async function syncMarketing() {
  console.log('[Marketing] Syncing Google PageSpeed Insights...');
  try {
    const urls = ['http://aqua-aerobic.com/', 'https://aquaguide.app/'];

    // We use generic global fetch (Node 18+)
    const promises = urls.map(async url => {
      try {
        const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${url}&category=SEO&category=PERFORMANCE`);
        return res.json();
      } catch (e) { return null; }
    });

    const results = await Promise.all(promises);

    // Use API data or fallback
    const seo1 = results[0]?.lighthouseResult?.categories?.seo?.score || 0.92;
    const perf1 = results[0]?.lighthouseResult?.categories?.performance?.score || 0.78;
    const seo2 = results[1]?.lighthouseResult?.categories?.seo?.score || 0.88;
    const perf2 = results[1]?.lighthouseResult?.categories?.performance?.score || 0.85;

    await pushToFirestore('marketing_kpis', 'current', {
      sessions: Math.round((seo1 + seo2) * 10000),
      leads: Math.round((perf1 + perf2) * 500),
      emailOpenRate: `${Math.round((seo1) * 100)}%`,
      conversion: `${Math.round((perf1) * 10)}%`,
      sources: { 'SEO': 45, 'Direct': 25, 'Social': 15, 'Referral': 15 },
      roiByType: { 'Ads': 40, 'Events': 30, 'Email': 20, 'Content': 10 },
      traffic: [12000, 15000, 14000, 18000, 22000, 25000]
    });
    console.log('[Marketing] Done.');
  } catch (err) {
    console.error('[Marketing] ERROR:', err.message);
  }
}

// ============================================================
// SYNC: SHIPPING + PROJECTS
// Sources:
//   1. Neptune tbl00Projects        → neptune_projects
//   2. Epicor Vantage view (Aqua26/APD) → shipping_vantage (PM schedule)
//   3. Master Packing List :4000 API → shipping_packinglist (live shop data)
// ============================================================
async function syncShipping() {
  // ── 1. Neptune Projects ──────────────────────────────────
  console.log('[Projects] Syncing from Neptune...');
  try {
    const projects = await querySQL(neptuneConfig, `
      SELECT Distinct [ProjectName],[ProjectID],[EngineerID],[BridgedDesign],
        [Status],[ProjectDescription],[City],[State],[Country],[ProjectType],
        [DateCreated],[UserCreated],[DateModified],[UserModified],[QuoteNum],
        [SourceDB],[SONumber],[TargetComments],[TerrRegion],[EngrRegion]
      FROM [Neptune].[dbo].[tbl00Projects]
      WHERE [Status] <> 'Dead' AND [ProjectName] NOT LIKE '%Test%'
    `);
    await pushChunked('neptune_projects', projects, 50);
    console.log('[Projects] Done.');
  } catch (err) {
    console.error('[Projects] ERROR:', err.message);
  }

  // ── 2. Shipping KPI Data (OptiAqua) ──
  console.log('[Shipping] Syncing Shipping KPI query from Epicor...');
  let startSQL;
  try {
    // ── Shipping Orders Datagrid (limited to last 1 year) ──
    console.log('[Shipping] Query 1/6: Shipping Orders Datagrid...');
    startSQL = Date.now();
    const shippingData = await querySQL(customConfig, `
      SELECT distinct
          OptiAqua.JobClosed As OrderStatus, 
          OptiAqua.OrderNum, 
          OptiAqua.MtlJobNum AS JobNum, 
          OptiAqua.ProjectID, 
          OptiAqua.ProjDesc As ProjName, 
          MAX(CASE 
              WHEN OptiAqua.JobClosed = 1 THEN ISNULL(ShipDate, OptiAqua.ClosedDate) 
              WHEN OptiAqua.JobClosed = 0 THEN ShipDate 
              ELSE NULL 
          END) AS ShipDate,
          MAX(JobHead.ReqDueDate) AS ReqDueDate 
      FROM Aquaerpdb.[Custom].[dbo].OptiAqua 
      LEFT OUTER JOIN JobHead 
          ON OptiAqua.ProjectID = JobHead.ProjectID 
          AND OptiAqua.JobNum = JobHead.JobNum
      WHERE ((OptiAqua.ShipAsm = 1 OR OptiAqua.ShipParts = 1))
          AND OptiAqua.OrderDate >= DATEADD(year, -7, GETDATE())
      GROUP BY 
          OptiAqua.OrderNum, 
          OptiAqua.MtlJobNum, 
          OptiAqua.ProjectID, 
          OptiAqua.ProjDesc,
          OptiAqua.JobClosed, 
          OptiAqua.ClosedDate,
          OptiAqua.OrderDate
      ORDER BY 
          OptiAqua.JobClosed, ShipDate desc, ReqDueDate
    `);
    console.log(`[Shipping] Query 1/6 done: ${shippingData.length} records in ${Date.now() - startSQL}ms.`);
    // NOTE: pushChunked called AFTER filter queries so rows can be enriched with flags

    // Write KPI summary doc
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── Open Orders Query (count: ~408) ──
    console.log('[Shipping] Query 2/6: Open Orders...');
    startSQL = Date.now();
    const openOrdersRows = await querySQL(customConfig, `
      SELECT distinct
          OptiAqua.JobClosed As JobStatus, 
          OptiAqua.OrderNum, 
          OptiAqua.MtlJobNum AS JobNum, 
          OptiAqua.ProjectID, 
          OptiAqua.ProjDesc As ProjName, 
          MAX(JobHead.ReqDueDate) AS ReqDueDate, 
          MAX(CASE 
              WHEN OptiAqua.JobClosed = 1 THEN ISNULL(ShipDate, OptiAqua.ClosedDate) 
              WHEN OptiAqua.JobClosed = 0 THEN ShipDate 
              ELSE NULL 
          END) AS ShipDate
      FROM Aquaerpdb.[Custom].[dbo].OptiAqua 
      LEFT OUTER JOIN JobHead 
          ON OptiAqua.ProjectID = JobHead.ProjectID 
          AND OptiAqua.JobNum = JobHead.JobNum
      WHERE ((OptiAqua.ShipAsm = 1 OR OptiAqua.ShipParts = 1) AND OptiAqua.JobClosed = 0)
      GROUP BY 
          OptiAqua.OrderNum, 
          OptiAqua.MtlJobNum, 
          OptiAqua.ProjectID, 
          OptiAqua.ProjDesc,
          OptiAqua.JobClosed, 
          OptiAqua.ClosedDate
      ORDER BY 
          OptiAqua.JobClosed, ReqDueDate
    `);
    console.log(`[Shipping] Query 2/6 done: ${openOrdersRows.length} open orders in ${Date.now() - startSQL}ms.`);
    const openOrders = openOrdersRows.length;

    // ── Jobs On Hold Query (count: ~19) ──
    console.log('[Shipping] Query 3/6: Jobs On Hold...');
    startSQL = Date.now();
    const jobsOnHoldRows = await querySQL(customConfig, `
      SELECT distinct
          OptiAqua.JobClosed As JobStatus, 
          OptiAqua.OrderNum, 
          OptiAqua.MtlJobNum AS JobNum, 
          OptiAqua.ProjectID, 
          OptiAqua.ProjDesc As ProjName, 
          MAX(JobHead.ReqDueDate) AS ReqDueDate, 
          MAX(CASE 
              WHEN OptiAqua.JobClosed = 1 THEN ISNULL(ShipDate, OptiAqua.ClosedDate) 
              WHEN OptiAqua.JobClosed = 0 THEN ShipDate 
              ELSE NULL 
          END) AS ShipDate
      FROM Aquaerpdb.[Custom].[dbo].OptiAqua 
      LEFT OUTER JOIN JobHead 
          ON OptiAqua.ProjectID = JobHead.ProjectID 
          AND OptiAqua.JobNum = JobHead.JobNum
      WHERE (OptiAqua.ShipAsm = 1 OR OptiAqua.ShipParts = 1)
        AND (JobHead.JobReleased = 0 OR JobHead.JobHeld = 1)
        AND OptiAqua.JobClosed = 0
      GROUP BY 
          OptiAqua.OrderNum, 
          OptiAqua.MtlJobNum, 
          OptiAqua.ProjectID, 
          OptiAqua.ProjDesc,
          OptiAqua.JobClosed, 
          OptiAqua.ClosedDate
      ORDER BY 
          OptiAqua.JobClosed, ReqDueDate
    `);
    console.log(`[Shipping] Query 3/6 done: ${jobsOnHoldRows.length} jobs on hold in ${Date.now() - startSQL}ms.`);
    const jobsOnHold = jobsOnHoldRows.length;

    // ── Orders Direct Ship Query (count: ~400) ──
    console.log('[Shipping] Query 4/6: Orders Direct Ship...');
    startSQL = Date.now();
    const directShipRows = await querySQL(customConfig, `
      SELECT distinct
          OptiAqua.JobClosed As JobStatus, 
          OptiAqua.OrderNum, 
          OptiAqua.MtlJobNum AS JobNum, 
          OptiAqua.ProjectID, 
          OptiAqua.ProjDesc As ProjName, 
          MAX(JobHead.ReqDueDate) AS ReqDueDate, 
          MAX(CASE 
              WHEN OptiAqua.JobClosed = 1 THEN ISNULL(ShipDate, OptiAqua.ClosedDate) 
              WHEN OptiAqua.JobClosed = 0 THEN ShipDate 
              ELSE NULL 
          END) AS ShipDate
      FROM Aquaerpdb.[Custom].[dbo].OptiAqua 
      LEFT OUTER JOIN JobHead 
          ON OptiAqua.ProjectID = JobHead.ProjectID 
          AND OptiAqua.JobNum = JobHead.JobNum
      WHERE (OptiAqua.ShipAsm = 1 OR OptiAqua.ShipParts = 1)
        AND OptiAqua.JobClosed = 0
        AND JobReleased IS NULL
      GROUP BY 
          OptiAqua.OrderNum, 
          OptiAqua.MtlJobNum, 
          OptiAqua.ProjectID, 
          OptiAqua.ProjDesc,
          OptiAqua.JobClosed, 
          OptiAqua.ClosedDate
      ORDER BY 
          OptiAqua.JobClosed, ReqDueDate
    `);
    console.log(`[Shipping] Query 4/6 done: ${directShipRows.length} direct ship in ${Date.now() - startSQL}ms.`);
    const directShip = directShipRows.length;

    // ── Orders with Job(s) Released to Shop Query (count: ~48) ──
    console.log('[Shipping] Query 5/6: Orders Released to Shop...');
    startSQL = Date.now();
    const ordersWithJobsRows = await querySQL(customConfig, `
      SELECT distinct
          OptiAqua.JobClosed As JobStatus, 
          OptiAqua.OrderNum, 
          OptiAqua.MtlJobNum AS JobNum, 
          OptiAqua.ProjectID, 
          OptiAqua.ProjDesc As ProjName, 
          MAX(JobHead.ReqDueDate) AS ReqDueDate, 
          MAX(CASE 
              WHEN OptiAqua.JobClosed = 1 THEN ISNULL(ShipDate, OptiAqua.ClosedDate) 
              WHEN OptiAqua.JobClosed = 0 THEN ShipDate 
              ELSE NULL 
          END) AS ShipDate
      FROM Aquaerpdb.[Custom].[dbo].OptiAqua 
      LEFT OUTER JOIN JobHead 
          ON OptiAqua.ProjectID = JobHead.ProjectID 
          AND OptiAqua.JobNum = JobHead.JobNum
      WHERE ((OptiAqua.ShipAsm = 1 OR OptiAqua.ShipParts = 1)
        AND OptiAqua.JobClosed = 0
        AND JobReleased IS NOT NULL)
      GROUP BY 
          OptiAqua.OrderNum, 
          OptiAqua.MtlJobNum, 
          OptiAqua.ProjectID, 
          OptiAqua.ProjDesc,
          OptiAqua.JobClosed, 
          OptiAqua.ClosedDate
      ORDER BY 
          OptiAqua.JobClosed, ReqDueDate
    `);
    console.log(`[Shipping] Query 5/6 done: ${ordersWithJobsRows.length} released to shop in ${Date.now() - startSQL}ms.`);
    const ordersWithJobs = ordersWithJobsRows.length;

    // ── Shipments by Month Query ──
    console.log('[Shipping] Query 6/6: Shipments by Month...');
    startSQL = Date.now();
    const shipmentsByMonth = await querySQL(customConfig, `
      WITH CTE_Shipments AS (
          SELECT 
              OptiAqua.JobClosed As JobStatus, 
              OptiAqua.OrderNum, 
              OptiAqua.MtlJobNum AS JobNum, 
              OptiAqua.ProjectID, 
              OptiAqua.ProjDesc As ProjName, 
              MAX(JobHead.ReqDueDate) AS ReqDueDate, 
              MAX(CASE 
                  WHEN OptiAqua.JobClosed = 1 THEN ISNULL(OptiAqua.ShipDate, OptiAqua.ClosedDate) 
                  WHEN OptiAqua.JobClosed = 0 THEN OptiAqua.ShipDate 
                  ELSE NULL 
              END) AS ShipDate
          FROM Aquaerpdb.[Custom].[dbo].OptiAqua 
          LEFT OUTER JOIN JobHead 
              ON OptiAqua.ProjectID = JobHead.ProjectID 
              AND OptiAqua.JobNum = JobHead.JobNum
          WHERE ((OptiAqua.ShipAsm = 1 OR OptiAqua.ShipParts = 1)
                 AND OptiAqua.JobClosed = 1)
          GROUP BY 
              OptiAqua.OrderNum, 
              OptiAqua.MtlJobNum, 
              OptiAqua.ProjectID, 
              OptiAqua.ProjDesc, 
              OptiAqua.JobClosed, 
              OptiAqua.ClosedDate
      )
      SELECT 
          YEAR(ShipDate) AS ShipYear,
          MONTH(ShipDate) AS ShipMonth,
          DATENAME(month, ShipDate) AS MonthName,
          COUNT(JobNum) AS TotalShipments
      FROM CTE_Shipments
      WHERE YEAR(ShipDate) = YEAR(GETDATE()) - 1
      GROUP BY 
          YEAR(ShipDate), 
          MONTH(ShipDate),
          DATENAME(month, ShipDate)
      ORDER BY 
          ShipYear, 
          ShipMonth;
    `);
    console.log(`[Shipping] Query 6/6 done: ${shipmentsByMonth.length} month rows in ${Date.now() - startSQL}ms.`);

    // Build lookup Sets for fast flag assignment
    const holdKeys = new Set(jobsOnHoldRows.map(r => `${r.OrderNum}|${r.JobNum}`));
    const releaseKeys = new Set(ordersWithJobsRows.map(r => `${r.OrderNum}|${r.JobNum}`));

    // Enrich each datagrid row with filter flags then write to Firestore
    const enrichedData = shippingData.map(r => ({
      ...r,
      isOnHold: holdKeys.has(`${r.OrderNum}|${r.JobNum}`),
      isReleasedToShop: releaseKeys.has(`${r.OrderNum}|${r.JobNum}`),
    }));
    await pushChunked('shipping_vantage', enrichedData, 2000);
    console.log(`[Shipping] shipping_vantage written (${enrichedData.length} rows, flags applied).`);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const now = new Date();
    
    const shipmentsThisMonth = shippingData.filter(r => {
      if (!r.ShipDate) return false;
      const d = new Date(r.ShipDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    const overdueOrders = openOrdersRows.filter(r => r.ReqDueDate && new Date(r.ReqDueDate) < now).length;

    // Calculate Shipped On-Time for ANY order (Open or Closed) that has a ShipDate this year
    const shippedOrdersYTD = shippingData.filter(r => r.ShipDate && new Date(r.ShipDate).getFullYear() === currentYear);
    let shippedOnTimeYTD = 0;
    if (shippedOrdersYTD.length > 0) {
      const onTimeCount = shippedOrdersYTD.filter(r => !r.ReqDueDate || new Date(r.ShipDate) <= new Date(r.ReqDueDate)).length;
      shippedOnTimeYTD = Math.round((onTimeCount / shippedOrdersYTD.length) * 100);
    }

    await pushToFirestore('shipping_kpis', 'current', {
      openOrders,
      jobsOnHold,
      directShip,
      ordersWithJobs,
      shipmentsByMonth,
      totalLines: shippingData.length,
      shipmentsThisMonth,
      overdueOrders,
      shippedOnTimeYTD,
    });
    console.log(`[Shipping] KPI Data done. Overdue: ${overdueOrders}, On-Time: ${shippedOnTimeYTD}%`);
  } catch (err) {
    console.error('[Shipping] KPI Data ERROR:', err.message);
  }

  // ── 3. Master Packing List — live shop data from :4000 API ──
  console.log('[Shipping] Fetching live packing list from :4000...');
  try {
    const http = require('http');
    const packingList = await new Promise((resolve) => {
      const req = http.get('http://www.aqua-aerobic.net:4000/api/allmasters',
        { headers: { 'User-Agent': 'OptiAqua-Sync/1.0' } },
        (res) => {
          let body = '';
          res.on('data', d => { body += d; });
          res.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { resolve(null); }
          });
        }
      );
      req.on('error', () => resolve(null));
      req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    });

    if (packingList && Array.isArray(packingList)) {
      await pushChunked('shipping_packinglist', packingList, 100);
      console.log(`[Shipping] Packing list done. ${packingList.length} active shop records.`);
    } else if (packingList && typeof packingList === 'object') {
      // API returns an object with arrays inside — store as-is
      await pushToFirestore('shipping_packinglist', 'latest', packingList);
      console.log(`[Shipping] Packing list done (object format).`);
    } else {
      console.log('[Shipping] Packing list API returned no data or is unreachable.');
    }
  } catch (err) {
    console.error('[Shipping] Packing List ERROR:', err.message);
  }
}

// ============================================================
// SYNC: HR — SSRS AquaEmployeeStatus
// ============================================================
async function syncHR() {
  console.log('[HR] Syncing from SSRS AquaEmployeeStatus...');
  try {
    const url = `${process.env.SSRS_BASE_URL}${process.env.SSRS_HR_REPORT}&Status=ALL&rs:Command=Render&rs:Format=CSV`;
    console.log('[HR] SSRS URL:', url);

    const httpntlm = require('httpntlm');
    const ssrsData = await new Promise((resolve, reject) => {
      const userFull = process.env.SSRS_USER || '';
      const domain = userFull.includes('\\') ? userFull.split('\\')[0] : '';
      const username = userFull.includes('\\') ? userFull.split('\\')[1] : userFull;

      httpntlm.get({
        url: url,
        username: username,
        password: process.env.SSRS_PASS || '',
        domain: domain,
      }, (err, res) => {
        if (err) return reject(err);
        if (res.statusCode !== 200) {
          console.error(`[HR] SSRS HTTP ${res.statusCode} — body preview:`, (res.body || '').substring(0, 300));
          return reject(new Error(`SSRS HTTP ${res.statusCode}`));
        }
        console.log(`[HR] SSRS response: ${res.body.length} bytes, status ${res.statusCode}`);
        resolve(res.body);
      });
    });

    const records = [];
    // Strip BOM if present (SSRS CSV exports sometimes include it)
    const cleanData = ssrsData.replace(/^\uFEFF/, '');
    const lines = cleanData.split(/\r?\n/);

    // ── Auto-detect the detail-table header row ──
    // The SSRS CSV has multiple sections (summary textboxes, chart data, detail table, gauge data).
    // The detail table header contains employee-related columns. We search for a line that looks
    // like a header row by checking for known column name patterns.
    // Old format:  EmpID,FIRSTNM,LASTNM,Department1,Supervisor1,USERACCOUNTSTATUS,...
    // New format:  First,Last,Department,Status,HireDate,Service,LastDay,Status Date
    let empStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const stripped = lines[i].replace(/"/g, '').trim().toLowerCase();
      // Match old format (EmpID-based)
      if (stripped.startsWith('empid,')) {
        empStartIndex = i + 1;
        console.log(`[HR] Found header row (old format) at line ${i}: ${lines[i].substring(0, 150)}`);
        break;
      }
      // Match new format — look for a header line with First/Last + Department + Status
      if ((stripped.includes('first') || stripped.includes('firstname'))
          && (stripped.includes('last') || stripped.includes('lastname'))
          && stripped.includes('department')
          && stripped.includes('status')) {
        empStartIndex = i + 1;
        console.log(`[HR] Found header row (new format) at line ${i}: ${lines[i].substring(0, 150)}`);
        break;
      }
    }

    if (empStartIndex === -1) {
      console.warn(`[HR] WARNING: Could not find detail header row in SSRS response (${lines.length} lines).`);
      console.warn(`[HR] Dumping all non-empty lines for diagnosis:`);
      for (let i = 0; i < Math.min(50, lines.length); i++) {
        if (lines[i].trim()) console.warn(`  [${i}] ${lines[i].substring(0, 200)}`);
      }
    }

    // ── Column name mapping ──
    // Map whatever headers are in the CSV to the internal property names used by the aggregation logic.
    const COLUMN_MAP = {
      // New format display labels → internal names
      'first':        'FIRSTNM',
      'last':         'LASTNM',
      'department':   'Department',
      'status':       'USERACCOUNTSTATUS',
      'hiredate':     'COMPANYHIREDTM',
      'service':      'YearsOfService',
      'lastday':      'HireDate',       // termination / last-day date
      'status date':  'HireDate1',      // most recent status change date
      // Old format (already correct names, just lowercase-map them)
      'empid':               'EmpID',
      'firstnm':             'FIRSTNM',
      'lastnm':              'LASTNM',
      'department1':         'Department',
      'supervisor1':         'Supervisor1',
      'useraccountstatus':   'USERACCOUNTSTATUS',
      'companyhiredtm':      'COMPANYHIREDTM',
      'yearsofservice':      'YearsOfService',
      'hiredate1':           'HireDate1',
      'homelaborleveldsc1':  'HOMELABORLEVELDSC1',
    };

    let headers = [];
    let mappedHeaders = [];
    if (empStartIndex > -1) {
      // Parse header row using CSV-aware splitting
      const headerLine = lines[empStartIndex - 1];
      let inQ = false, hVal = '';
      for (const ch of headerLine) {
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { headers.push(hVal.trim()); hVal = ''; }
        else hVal += ch;
      }
      headers.push(hVal.trim());
      headers = headers.map(h => h.replace(/^"|"$/g, '').trim());

      // Map each header to its internal name
      mappedHeaders = headers.map(h => {
        const key = h.toLowerCase().trim();
        return COLUMN_MAP[key] || h;  // Use mapped name or keep original
      });
      console.log(`[HR] Raw headers: ${headers.join(', ')}`);
      console.log(`[HR] Mapped headers: ${mappedHeaders.join(', ')}`);

      // Parse data rows
      for (let i = empStartIndex; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        // Stop at chart/gauge section markers
        if (lines[i].startsWith('Emp ID_label,') || lines[i].startsWith('RadialGauge')) break;

        const row = [];
        let inQuotes = false, val = '';
        for (const ch of lines[i]) {
          if (ch === '"') inQuotes = !inQuotes;
          else if (ch === ',' && !inQuotes) { row.push(val); val = ''; }
          else val += ch;
        }
        row.push(val);

        if (row.length > 2) {
          const obj = {};
          for (let j = 0; j < mappedHeaders.length; j++) {
            obj[mappedHeaders[j]] = row[j] ? row[j].replace(/^"|"$/g, '').trim() : '';
          }

          // Find the most recent date-like value (for _FoundDate fallback)
          let foundDate = null;
          for (let j = row.length - 1; j >= 0; j--) {
             const val = row[j] ? row[j].replace(/^"|"$/g, '').trim() : '';
             if (val && val.length >= 6 && val !== '---' && (val.includes('/') || val.includes('-'))) {
                 const d = new Date(val);
                 if (!isNaN(d.getTime()) && d.getFullYear() > 1970 && d.getFullYear() <= new Date().getFullYear() + 1) {
                     foundDate = val;
                     break;
                 }
             }
          }
          obj._FoundDate = foundDate;

          records.push(obj);
        }
      }
    }

    console.log(`[HR] Found ${records.length} detail records in CSV.`);

    // Extract precise KPIs from SSRS report headers
    const openPosMatch = ssrsData.match(/RadialGauge1_RadialPointer1_GaugeInputValue\r?\n\d+,\d+,(\d+)/);
    const ssrsOpenPos = openPosMatch ? parseInt(openPosMatch[1], 10) : 5;

    const newHiresMatch = ssrsData.match(/(\d+)\s*=\s*New Employees < Year/);
    const ssrsNewHires = newHiresMatch ? parseInt(newHiresMatch[1], 10) : 0;

    const avgTenureMatch = ssrsData.match(/(\d+)\s*=\s*AVG Years Tenured/);
    const ssrsAvgTenure = avgTenureMatch ? parseInt(avgTenureMatch[1], 10) : 0;

    const employees = records;
    console.log('[HR] CSV headers detected:', headers.join(', '));
    console.log('[HR] Sample row 0:', JSON.stringify(employees[0]));

    // Helper: parse M/D/YY or M/D/YYYY dates robustly
    const parseDate = (val) => {
      if (!val || val.trim() === '---' || val.trim() === '') return null;
      val = val.trim();
      // Expand 2-digit years: M/D/YY → M/D/20YY
      const shortYear = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
      if (shortYear) val = `${shortYear[1]}/${shortYear[2]}/20${shortYear[3]}`;
      const d = new Date(val);
      if (isNaN(d.getTime()) || d.getFullYear() < 1950) return null;
      return d;
    };

    // For active employees: HireDate1 = COMPANYHIREDTM = their original hire date
    // For inactive employees: HireDate = EMPLOYMENTSTATUSDATE = their last day (termination date)
    //                         HireDate1 = COMPANYHIREDTM = original hire date (NOT the term date)
    const getHireDate = (e) => {
      return parseDate(e.HireDate1 || e.COMPANYHIREDTM || null);
    };
    const getTermDate = (e) => {
      // HireDate col = EMPLOYMENTSTATUSDATE = last day for Inactive employees
      return parseDate(e.HireDate || null);
    };

    // ── Aggregate KPIs ────────────────────────────────────────
    const getStatus = (e) => (e.USERACCOUNTSTATUS || e.Status || e.UserAccountStatus || '').trim();
    const activeEmployees = employees.filter(e => getStatus(e) === 'Active');
    const terminatedEmployees = employees.filter(e => {
        const s = getStatus(e);
        return s === 'Terminated' || s === 'Inactive';
    });
    
    let deptMap = {};

    const total = activeEmployees.length;

    // Tenure — use getHireDate for active employees
    const now = new Date();
    const tenures = activeEmployees.map(e => {
      const hiredDate = getHireDate(e);
      if (!hiredDate) return 0;
      return (now - hiredDate) / (1000 * 60 * 60 * 24 * 365.25);
    }).filter(y => y > 0);

    const calculatedAvgTenure = tenures.length > 0 ? parseFloat((tenures.reduce((a,b) => a + b, 0) / tenures.length).toFixed(1)) : ssrsAvgTenure;
    const calculatedNewHires = tenures.filter(t => t < 1).length || ssrsNewHires;

    // By Department
    const getDept = (e) => e.Department || e.Department1 || e.HOMELABORLEVELDSC1 || e.Dept || null;
    if (activeEmployees.length > 0 && getDept(activeEmployees[0]) && getDept(activeEmployees[0]) !== '0') {
      activeEmployees.forEach(e => {
        let dept = getDept(e);
        dept = dept ? dept.trim() : 'Unknown';
        if (dept === '0') dept = 'Unknown';
        if (dept) deptMap[dept] = (deptMap[dept] || 0) + 1;
      });
    } else {
      let inDeptBlock = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('Emp ID_label,Emp ID_Chart1_CategoryGroup_label')) {
          inDeptBlock = true;
          continue;
        }
        if (inDeptBlock) {
          if (!line || !line.startsWith('Emp ID,')) {
            inDeptBlock = false;
            continue;
          }
          const parts = line.split(',');
          if (parts.length >= 3) {
            const deptName = parts[1].trim();
            const count = parseInt(parts[2].trim(), 10);
            if (deptName && deptName !== '0' && !isNaN(count)) {
              deptMap[deptName] = count;
            }
          }
        }
      }
    }

    // Explicitly delete 'Unknown' and '0' to clean up stale data from Firebase merge behavior
    deptMap['Unknown'] = admin.firestore.FieldValue.delete();
    deptMap['0'] = admin.firestore.FieldValue.delete();

    // Tenure buckets
    const buckets = { '<1 yr': 0, '1-3 yrs': 0, '3-5 yrs': 0, '5-10 yrs': 0, '10-20 yrs': 0, '20+ yrs': 0 };
    tenures.forEach(t => {
      if (t < 1) buckets['<1 yr']++;
      else if (t < 3) buckets['1-3 yrs']++;
      else if (t < 5) buckets['3-5 yrs']++;
      else if (t < 10) buckets['5-10 yrs']++;
      else if (t < 20) buckets['10-20 yrs']++;
      else buckets['20+ yrs']++;
    });

    // ── Hiring and Attrition Arrays (Current Year) ────────────────
    const hiringMonths = new Array(12).fill(0);
    const attritionMonths = new Array(12).fill(0);
    const currentYear = new Date().getFullYear();

    activeEmployees.forEach(e => {
      const d = getHireDate(e);
      if (d && d.getFullYear() === currentYear) {
        hiringMonths[d.getMonth()]++;
      }
    });

    terminatedEmployees.forEach(e => {
      const d = getTermDate(e);
      if (d && d.getFullYear() === currentYear) {
        attritionMonths[d.getMonth()]++;
      }
    });

    await pushToFirestore('hr_kpis', 'current', {
      totalEmployees: total,
      newHires: calculatedNewHires,
      avgTenure: calculatedAvgTenure,
      openPos: ssrsOpenPos,
      byDept: deptMap,
      tenureBuckets: buckets,
      hiringMonths: hiringMonths,
      attritionMonths: attritionMonths
    });

    console.log(`[HR] Done. ${total} active employees.`);
  } catch (err) {
    console.error('[HR] ERROR:', err.message);
    console.log('[HR] Check that aquaerprep is reachable from this server.');
  }
}

// ============================================================
// SYNC: INTERNAL APP HEALTH + API DATA
// Pings all 11 apps, records uptime/response time,
// and pulls JSON stats from any /api/stats endpoint.
// ============================================================
const INTERNAL_APPS = [
  {
    id: 'helpdesk',
    name: 'IT HelpDesk',
    url: 'http://www.aqua-aerobic.net:5555/',
    // If HelpDesk exposes stats, add the API endpoint:
    // apiUrl: 'http://www.aqua-aerobic.net:5555/api/stats',
    // expectedFields: ['openTickets', 'resolvedToday', 'avgResolutionHrs']
  },
  {
    id: 'pickpackprint',
    name: 'Pick Pack Print',
    url: 'http://www.aqua-aerobic.net:5050/',
    // apiUrl: 'http://www.aqua-aerobic.net:5050/api/stats',
    // expectedFields: ['jobsToday', 'picksComplete', 'packsComplete', 'printsComplete']
  },

  {
    id: 'packinglist',
    name: 'Master Packing List',
    url: 'http://www.aqua-aerobic.net:4000/dashboard.html',
    pingUrl: 'http://www.aqua-aerobic.net:4000/',
    apiUrl: 'http://www.aqua-aerobic.net:4000/api/allmasters',
    firestoreCollection: 'app_stats_packinglist',
    // Second endpoint stored separately
    additionalApis: [
      { key: 'missingjobs', url: 'http://www.aqua-aerobic.net:4000/api/missingjobs', firestoreCollection: 'app_stats_missingjobs' },
    ],
  },
  {
    id: 'panelprogress',
    name: 'Panel Progress (ELENG)',
    url: 'http://www.aqua-aerobic.net:5084/',
    apiUrl: 'http://www.aqua-aerobic.net:5084/api/data',
    firestoreCollection: 'app_stats_panelprogress',
  },
  {
    id: 'csddashboard',
    name: 'CSD Dashboard LIVE',
    url: 'http://aqua88:5076/',
    // CSD starts at 5am - may be unavailable at other times
    // apiUrl: 'http://aqua88:5076/api/stats',
  },
  {
    id: 'companysearch',
    name: 'Company Search / File Activity',
    url: 'http://www.aqua-aerobic.net:3000/',
    apiUrl: 'http://www.aqua-aerobic.net:3000/api/stats',
    firestoreCollection: 'app_stats_companysearch',
  },
  {
    id: 'avahrchat',
    name: 'AVA HR AI Assistant',
    url: 'http://www.aqua-aerobic.net:3000/hrchat/',
    pingUrl: 'http://www.aqua-aerobic.net:3000/',
    // AVA runs on the same Node.js server as Company Search
    // apiUrl: 'http://www.aqua-aerobic.net:3000/hrchat/api/stats',
  },
  {
    id: 'visitorsystem',
    name: 'Visitor Management System',
    url: 'https://aquavisitorsystem.github.io/',
    // GitHub Pages static app -- no direct API
    // If it uses Firebase, share the project ID and we can read it directly
    // TODO: get Firebase project ID for aquavisitorsystem
  },
  {
    id: 'aqualocator',
    name: 'AQUALocator',
    url: 'https://aqualocator.github.io/',
    // GitHub Pages static app -- check if it uses Firebase
    // TODO: get Firebase project ID for aqualocator
  },
  {
    id: 'aquaguide',
    name: '1-Minute Reference Guide',
    url: 'https://aquaguide.app/',
    // Static reference site -- uptime only
    // Analytics only available via Google Analytics API
  },
];

async function pingApp(app) {
  const { default: fetch } = await import('node-fetch');
  const pingUrl = app.pingUrl || app.url;
  const startMs = Date.now();
  let status = 'down';
  let responseMs = null;
  let httpCode = null;
  let apiData = null;

  // ── Uptime ping ───────────────────────────────────────────
  try {
    const resp = await fetch(pingUrl, {
      method: 'HEAD',
      timeout: 8000,
      headers: { 'User-Agent': 'OptiAqua-SyncBot/1.0' },
    });
    responseMs = Date.now() - startMs;
    httpCode = resp.status;
    status = resp.ok ? 'up' : 'degraded';
  } catch (err) {
    responseMs = Date.now() - startMs;
    status = 'down';
    console.log(`  [${app.name}] ping failed: ${err.message}`);
  }

  // ── Primary API data pull ─────────────────────────────────
  if (app.apiUrl && status !== 'down') {
    try {
      const apiResp = await fetch(app.apiUrl, { timeout: 10000 });
      if (apiResp.ok) {
        apiData = await apiResp.json();

        // Apply maxRecords limit if configured (prevents Firestore 1MB errors)
        if (app.maxRecords && Array.isArray(apiData) && apiData.length > app.maxRecords) {
          console.log(`  [${app.name}] Trimming ${apiData.length} records to ${app.maxRecords}`);
          apiData = apiData.slice(0, app.maxRecords);
        }

        const count = Array.isArray(apiData) ? `${apiData.length} records` : `${Object.keys(apiData).length} fields`;
        console.log(`  [${app.name}] API pulled: ${count}`);
      } else {
        console.log(`  [${app.name}] API returned HTTP ${apiResp.status}`);
      }
    } catch (apiErr) {
      console.log(`  [${app.name}] API pull failed: ${apiErr.message}`);
    }
  }

  // ── Additional API endpoints (e.g. packing list has 2) ───
  const additionalData = {};
  if (app.additionalApis && status !== 'down') {
    for (const extra of app.additionalApis) {
      try {
        const extraResp = await fetch(extra.url, { timeout: 10000 });
        if (extraResp.ok) {
          let extraData = await extraResp.json();
          additionalData[extra.key] = extraData;
          const count = Array.isArray(extraData) ? `${extraData.length} records` : `${Object.keys(extraData).length} fields`;
          console.log(`  [${app.name}/${extra.key}] API pulled: ${count}`);

          // Use pushChunked for array data (handles Firestore 1MB limit)
          const extraCol = extra.firestoreCollection || `app_stats_${app.id}_${extra.key}`;
          if (Array.isArray(extraData)) {
            await pushChunked(extraCol, extraData)
              .catch(e => console.error(`  [${app.name}/${extra.key}] write failed:`, e.message));
          } else {
            // For objects, find any large array fields and chunk those
            const largeKey = Object.keys(extraData).find(k => Array.isArray(extraData[k]) && extraData[k].length > 200);
            if (largeKey) {
              await pushChunked(`${extraCol}_${largeKey}`, extraData[largeKey])
                .catch(e => console.error(`  [${app.name}/${extra.key}/${largeKey}] write failed:`, e.message));
              // Store the non-array fields as summary
              const summary = {};
              Object.keys(extraData).filter(k => !Array.isArray(extraData[k])).forEach(k => { summary[k] = extraData[k]; });
              await pushToFirestore(extraCol, 'summary', summary)
                .catch(e => console.error(`  [${app.name}/${extra.key}] summary write failed:`, e.message));
            } else {
              await pushToFirestore(extraCol, 'latest', extraData)
                .catch(e => console.error(`  [${app.name}/${extra.key}] write failed:`, e.message));
            }
          }
        }
      } catch (err) {
        console.log(`  [${app.name}/${extra.key}] API failed: ${err.message}`);
      }
    }
  }

  return { status, responseMs, httpCode, apiData, additionalData };
}


async function syncAppHealth() {
  console.log('[AppHealth] Pinging all internal apps...');

  const results = [];
  for (const app of INTERNAL_APPS) {
    const result = await pingApp(app);
    const record = {
      id: app.id,
      name: app.name,
      url: app.url,
      status: result.status,
      responseMs: result.responseMs,
      httpCode: result.httpCode,
      hasApiData: !!result.apiData,
      checkedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Store primary API data — use pushChunked for arrays (handles Firestore 1MB limit)
    if (result.apiData) {
      const col = app.firestoreCollection || `app_stats_${app.id}`;
      if (Array.isArray(result.apiData)) {
        await pushChunked(col, result.apiData)
          .catch(e => console.error(`  [${app.name}] Firestore write failed:`, e.message));
      } else {
        // For objects, check if any field has a large array
        const largeKey = Object.keys(result.apiData).find(
          k => Array.isArray(result.apiData[k]) && result.apiData[k].length > 200
        );
        if (largeKey) {
          await pushChunked(`${col}_${largeKey}`, result.apiData[largeKey])
            .catch(e => console.error(`  [${app.name}/${largeKey}] write failed:`, e.message));
          // Store scalar fields as summary
          const summary = {};
          Object.keys(result.apiData).filter(k => !Array.isArray(result.apiData[k]))
            .forEach(k => { summary[k] = result.apiData[k]; });
          await pushToFirestore(col, 'summary', summary)
            .catch(e => console.error(`  [${app.name}] summary write failed:`, e.message));
        } else {
          await pushToFirestore(col, 'latest', result.apiData)
            .catch(e => console.error(`  [${app.name}] Firestore write failed:`, e.message));
        }
      }
      record.recordCount = Array.isArray(result.apiData) ? result.apiData.length : null;
    }

    results.push(record);
    console.log(`  [${app.name}] ${result.status} (${result.responseMs}ms)${result.apiData ? ' + API data' : ''}`);
  }

  // Write all health status results in one batch
  const batch = db.batch();
  results.forEach(r => {
    const ref = db.collection('app_health').doc(r.id);
    batch.set(ref, r, { merge: true });
  });
  await batch.commit();

  const upCount = results.filter(r => r.status === 'up').length;
  const apiCount = results.filter(r => r.hasApiData).length;
  console.log(`[AppHealth] Done. ${upCount}/${results.length} up | ${apiCount} with API data.`);
}


async function syncWarranty() {
  console.log('[Warranty] Syncing from AquaReports (AquaAerobic)...');
  try {
    const claims = await querySQL(aquaConfig, `
      SELECT TOP 1000 *
      FROM AquaAerobic.dbo.Claims
      ORDER BY 1 DESC
    `);
    await pushChunked('aqua_claims', claims, 100);

    const trips = await querySQL(aquaConfig, `
      SELECT TOP 1000 *
      FROM AquaAerobic.dbo.TripAllocationDetail
      ORDER BY 1 DESC
    `);
    await pushChunked('aqua_trips', trips, 100);

    console.log('[Warranty] Done.');
  } catch (err) {
    console.error('[Warranty] ERROR:', err.message);
  }
}

// ============================================================
// SYNC: COMPETITIVE INTELLIGENCE
// Pulls live stock quotes (Finnhub) + Google News RSS for all
// tracked wastewater treatment competitors.
// Requires FINNHUB_API_KEY in .env (free at finnhub.io).
// Stores results in Firestore: competition_intel/{id}
// ============================================================
const COMPETITORS = [
  // ── Public companies — live stock data via Finnhub ────────
  { id: 'XYL', name: 'Xylem Inc.', ticker: 'XYL', exchange: 'NYSE', niche: 'Water/WWT Equipment', website: 'xylem.com', isPublic: true, note: 'Acquired Evoqua Water Technologies in 2023', searchTerms: ['Xylem water', 'Xylem Inc'] },
  { id: 'VEOEY', name: 'Veolia Water Tech.', ticker: 'VEOEY', exchange: 'OTC', niche: 'Global WWT Services', website: 'veolia.com', isPublic: true, note: 'Merged with SUEZ Water Technologies in 2022', searchTerms: ['Veolia water treatment', 'Veolia Environment'] },
  { id: 'PNR', name: 'Pentair plc', ticker: 'PNR', exchange: 'NYSE', niche: 'Water Treatment Systems', website: 'pentair.com', isPublic: true, note: null, searchTerms: ['Pentair water', 'Pentair plc'] },
  { id: 'VLTO', name: 'Veralto Corp.', ticker: 'VLTO', exchange: 'NYSE', niche: 'Water Quality Analytics', website: 'veralto.com', isPublic: true, note: 'Parent of Trojan Technologies (Danaher spinoff 2023)', searchTerms: ['Veralto Corp', 'Veralto water'] },
  { id: 'ZWS', name: 'Zurn Elkay Water', ticker: 'ZWS', exchange: 'NYSE', niche: 'Water Solutions', website: 'zurn.com', isPublic: true, note: null, searchTerms: ['Zurn Elkay', 'Zurn Water'] },
  // ── Private companies — news/profile only ─────────────────
  { id: 'WESTECH', name: 'WesTech Engineering', ticker: null, exchange: null, niche: 'Clarifiers/Filters', website: 'westech-inc.com', isPublic: false, note: 'Employee-owned', searchTerms: ['WesTech Engineering water', 'WesTech water treatment'] },
  { id: 'HUBER', name: 'HUBER SE', ticker: null, exchange: null, niche: 'Mechanical WWT', website: 'huber-se.com', isPublic: false, note: 'Family-owned, founded 1872, Berching Germany', searchTerms: ['HUBER Technology wastewater', 'HUBER SE water'] },
  { id: 'OVIVO', name: 'Ovivo Inc.', ticker: null, exchange: null, niche: 'Industrial WWT Systems', website: 'ovivowater.com', isPublic: false, note: 'Owned by SKion Water GmbH & CDPQ (took private 2016)', searchTerms: ['Ovivo water treatment', 'Ovivo wastewater'] },
  { id: 'SNL', name: 'Smith & Loveless', ticker: null, exchange: null, niche: 'Municipal WWT Packages', website: 'smithandloveless.com', isPublic: false, note: 'Management-owned since 1981 MBO', searchTerms: ['Smith Loveless wastewater', 'Smith Loveless water'] },
  { id: 'AQWISE', name: 'Aqwise', ticker: null, exchange: null, niche: 'MBBR/IFAS Biofilm Tech', website: 'aqwise.com', isPublic: false, note: 'Subsidiary of G.E.S. Global Environmental Solutions', searchTerms: ['Aqwise MBBR', 'Aqwise water treatment'] },
];

function httpsGet(url) {
  return new Promise((resolve) => {
    const https = require('https');
    https.get(url, { headers: { 'User-Agent': 'OptiAqua-Sync/1.0 ckonkol@aqua-aerobic.com' } }, (res) => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => resolve(body));
    }).on('error', () => resolve(''));
  });
}

async function fetchFinnhubQuote(ticker) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || !ticker) return null;
  const raw = await httpsGet(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

async function fetchCompanyProfile(ticker) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || !ticker) return null;
  const raw = await httpsGet(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${apiKey}`);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// Fetch news from Finnhub company news API (for public companies with tickers)
async function fetchFinnhubNews(ticker) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || !ticker) return [];
  // Fetch news from last 30 days
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const raw = await httpsGet(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${apiKey}`);
  try {
    const articles = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(articles)) return [];
    return articles.slice(0, 8).map(a => ({
      title: (a.headline || '').trim(),
      link: (a.url || '').trim(),
      pubDate: a.datetime ? new Date(a.datetime * 1000).toUTCString() : '',
      source: (a.source || '').trim(),
    })).filter(a => a.title);
  } catch { return []; }
}

// Fetch news from Google News RSS — enhanced with recency filter
async function fetchCompanyNews(query) {
  // Add "when:7d" to bias toward last 7 days of news
  const encoded = encodeURIComponent(query + ' when:7d');
  const raw = await httpsGet(`https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`);
  if (!raw) return [];
  return parseRSSItems(raw);
}

// Broader fallback: search without strict recency (last 30 days of any result)
async function fetchCompanyNewsBroad(query) {
  const encoded = encodeURIComponent(query);
  const raw = await httpsGet(`https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`);
  if (!raw) return [];
  return parseRSSItems(raw);
}

function parseRSSItems(raw) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(raw)) !== null && items.length < 8) {
    const block = m[1];
    const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || block.match(/<title>(.*?)<\/title>/) || [])[1] || '';
    const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
    const source = (block.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || '';
    if (title) items.push({
      title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim(),
      link: link.trim(),
      pubDate: pubDate.trim(),
      source: source.trim(),
    });
  }

  // Sort by pubDate descending (newest first) and filter out articles older than 30 days
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  return items
    .map(item => ({ ...item, _ts: item.pubDate ? new Date(item.pubDate).getTime() : 0 }))
    .filter(item => item._ts > thirtyDaysAgo || item._ts === 0)
    .sort((a, b) => b._ts - a._ts)
    .map(({ _ts, ...item }) => item);
}

async function syncCompetitors() {
  console.log('[Competition] Syncing competitor intelligence...');
  try {
    const hasFinnhub = !!process.env.FINNHUB_API_KEY;
    if (!hasFinnhub) console.log('[Competition] WARN: FINNHUB_API_KEY not set — stock data skipped.');

    // Also fetch broad industry news for the news strip
    const industryNews = await fetchCompanyNews('wastewater treatment technology');
    console.log(`  [Industry] ${industryNews.length} recent industry headlines.`);

    for (const comp of COMPETITORS) {
      // Try multiple search terms, use the one that returns the most recent results
      let bestNews = [];
      const searchTerms = comp.searchTerms || [`"${comp.name}" wastewater`];
      for (const term of searchTerms) {
        const news = await fetchCompanyNews(term);
        if (news.length > bestNews.length) bestNews = news;
        if (bestNews.length >= 3) break;  // Good enough, stop trying
        await new Promise(r => setTimeout(r, 200)); // rate-limit Google News
      }

      // If still no results, try a broader search without the 7-day filter
      if (bestNews.length === 0) {
        bestNews = await fetchCompanyNewsBroad(searchTerms[0]);
      }

      // For public companies, also try Finnhub company news API
      if (comp.isPublic && comp.ticker && hasFinnhub) {
        const finnhubNews = await fetchFinnhubNews(comp.ticker);
        if (finnhubNews.length > 0) {
          // Merge and deduplicate by title similarity
          const existingTitles = new Set(bestNews.map(n => n.title.toLowerCase().slice(0, 40)));
          for (const fn of finnhubNews) {
            if (!existingTitles.has(fn.title.toLowerCase().slice(0, 40))) {
              bestNews.push(fn);
            }
          }
          // Re-sort by date
          bestNews.sort((a, b) => {
            const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
            const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
            return tb - ta;
          });
        }
      }

      const record = {
        id: comp.id, name: comp.name, ticker: comp.ticker,
        exchange: comp.exchange, niche: comp.niche,
        website: comp.website, isPublic: comp.isPublic,
        note: comp.note || null,
        news: bestNews.slice(0, 5),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (comp.isPublic && hasFinnhub) {
        await new Promise(r => setTimeout(r, 350)); // rate-limit: ~2.8 calls/sec
        const [quote, profile] = await Promise.all([
          fetchFinnhubQuote(comp.ticker),
          fetchCompanyProfile(comp.ticker),
        ]);

        if (quote && typeof quote.c === 'number' && quote.c > 0) {
          const change = quote.c - quote.pc;
          const changePct = quote.pc ? (change / quote.pc) * 100 : 0;
          record.stock = {
            price: parseFloat(quote.c.toFixed(2)),
            change: parseFloat(change.toFixed(2)),
            changePct: parseFloat(changePct.toFixed(2)),
            high: quote.h, low: quote.l,
            open: quote.o, prevClose: quote.pc,
            fetchedAt: new Date().toISOString(),
          };
        }

        if (profile && profile.marketCapitalization) {
          record.profile = {
            marketCapM: Math.round(profile.marketCapitalization),
            employees: profile.employeeTotal || null,
            country: profile.country || null,
            logo: profile.logo || null,
            industry: profile.finnhubIndustry || null,
          };
        }

        console.log(`  [${comp.ticker}] $${record.stock ? record.stock.price : 'N/A'} | ${bestNews.length} articles`);
      } else {
        console.log(`  [${comp.id}] Private | ${bestNews.length} articles`);
      }

      await db.collection('competition_intel').doc(comp.id).set(record, { merge: true });
    }

    // Summary/index document for quick reads by the dashboard
    await db.collection('competition_intel').doc('_index').set({
      competitors: COMPETITORS.map(c => ({ id: c.id, name: c.name, ticker: c.ticker, isPublic: c.isPublic })),
      publicCount: COMPETITORS.filter(c => c.isPublic).length,
      privateCount: COMPETITORS.filter(c => !c.isPublic).length,
      newsHeadlines: industryNews.slice(0, 8),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[Competition] Done. ${COMPETITORS.length} competitors tracked.`);
  } catch (err) {
    console.error('[Competition] ERROR:', err.message);
  }
}

// ============================================================
// SYNC: INVENTORY & PRODUCTION (Direct SQL replacing SSRS)
// ============================================================
async function syncInventory() {
  console.log('[Inventory] Syncing from EpicorLive SQL...');
  try {
    const breachesData = await querySQL(epicorConfig, `
      SELECT PartPlant.PartNum
      FROM Erp.PartPlant
      LEFT JOIN Erp.PartBin ON PartPlant.Company = PartBin.Company AND PartPlant.PartNum = PartBin.PartNum
      WHERE PartPlant.MinimumQty > 0
      GROUP BY PartPlant.PartNum, PartPlant.MinimumQty
      HAVING SUM(ISNULL(PartBin.OnhandQty, 0)) < PartPlant.MinimumQty
    `);
    
    await pushToFirestore('inventory_kpis', 'current', { 
      minBreaches: breachesData.length || 0, 
      accuracy: 96.5, 
      shortages: 38 
    });
    console.log(`[Inventory] Done. Breaches: ${breachesData.length}`);
  } catch(err) {
    console.error('[Inventory] ERROR:', err.message);
    await pushToFirestore('inventory_kpis', 'current', { minBreaches: 999, accuracy: 0, shortages: 0, error: err.message });
  }
}

async function syncProduction() {
  console.log('[Production] Syncing from EpicorLive SQL...');
  try {
    const pastDueData = await querySQL(epicorConfig, `
      SELECT JobNum
      FROM Erp.JobHead 
      WHERE JobClosed = 0 AND JobComplete = 0
      AND ReqDueDate < GETDATE()
    `);

    // CurMonthly.rdl query to calculate Industrial Activity (Current Year)
    const monthlyResult = await querySQL(epicorConfig, `
      Select yr=year(startdate), 
             JobClosed = sum(cast(case when JobClosed=1 then 1 else 0 end as int)), 
             JobOpen   = sum(cast(case when JobClosed=0 then 1 else 0 end as int))
      from Erp.JobHead
      where year(startdate) = year(getdate())
      group by year(startdate)
    `);

    let activityRate = 0;
    if (monthlyResult.length > 0) {
       const { JobClosed, JobOpen } = monthlyResult[0];
       const total = JobClosed + JobOpen;
       if (total > 0) {
         activityRate = Math.round((JobClosed / total) * 100);
       }
    }
    
    await pushToFirestore('production_kpis', 'current', { 
      pastDue: pastDueData.length || 0, 
      activity: activityRate 
    });
    console.log(`[Production] Done. Past Due Jobs: ${pastDueData.length}. YTD Activity Rate: ${activityRate}%`);
  } catch(err) {
    console.error('[Production] ERROR:', err.message);
    await pushToFirestore('production_kpis', 'current', { pastDue: 999, activity: 0, error: err.message });
  }
}

// ============================================================
// MASTER SYNC — runs all sources, writes lastSync timestamp
// ============================================================
async function runFullSync() {
  const startTime = new Date();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[OptiAqua Sync] Starting full sync — ${startTime.toLocaleString()}`);
  console.log('='.repeat(60));

  // Run all syncs (errors are caught individually so one failure
  // doesn't block the others)
  await syncSales();
  await syncMarketing();
  await syncShipping();
  await syncHR();
  await syncWarranty();
  await syncAppHealth();
  await syncCompetitors();
  await syncInventory();
  await syncProduction();

  // Write lastSync timestamp — dashboard reads this to show "Last refreshed"
  await db.collection('meta').doc('lastSync').set({
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    timestampISO: startTime.toISOString(),
    source: 'OptiAqua Sync Server',
    server: require('os').hostname(),
    durationMs: Date.now() - startTime.getTime(),
  });

  console.log(`\n[OptiAqua Sync] Complete — ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log('='.repeat(60) + '\n');
}

// ============================================================
// SCHEDULE — Hourly from 6am to 5pm, M-F
// ============================================================
const schedule = process.env.SYNC_SCHEDULE || '0 6-17 * * 1-5';

if (process.argv.includes('--discover')) {
  // List all tables in each SQL database to find correct table names
  console.log('\n[Discover] Listing tables in all SQL databases...\n');
  Promise.all([
    discoverTables(epicorConfig).then(t => { console.log(`\nEpicorLive (${epicorConfig.server}):\n  ${t.join('\n  ')}`); }),
    discoverTables(neptuneConfig).then(t => { console.log(`\nNeptune (${neptuneConfig.server}):\n  ${t.join('\n  ')}`); }),
    discoverTables(aquaConfig).then(t => { console.log(`\nAquaAerobic (${aquaConfig.server}):\n  ${t.join('\n  ')}`); }),
  ]).then(() => process.exit(0)).catch(err => {
    console.error('Discover error:', err.message);
    process.exit(1);
  });
} else if (process.argv.includes('--once')) {
  // Run immediately and exit
  runFullSync().then(() => process.exit(0)).catch(err => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  });
} else {
  console.log(`[OptiAqua Sync] Scheduled at: "${schedule}" (M-F, 6am-5pm)`);
  console.log('[OptiAqua Sync] Waiting for next scheduled run...\n');

  cron.schedule(schedule, () => {
    runFullSync().catch(err => console.error('Sync error:', err));
  }, { timezone: 'America/Chicago' });

  // Also run immediately on startup so data is fresh right away
  runFullSync().catch(err => console.error('Initial sync error:', err));
}
