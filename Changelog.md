# Changelog

All notable changes to **OptiAqua Analytics Platform** are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) - versions use [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### 2026-06-22 | Aqua-Aerobic IT
**ui: Add tooltips to all menu links and Quick Launch tiles**
- Added `title` attributes with descriptions and URLs to all 8 Dashboard nav links
- Added `title` attributes to all 11 Internal Tools sidebar links
- Added `title` attributes to all 11 Overview Quick Launch app tiles

### 2026-06-22 | Aqua-Aerobic IT
**feat: Add ACE – AI to Internal Tools**
- Added ACE – AI (🧠) to sidebar nav and Overview Quick Launch grid
- URL: `http://www.aqua-aerobic.net:3000/ace/`

### 2026-06-22 | Aqua-Aerobic IT
**feat: Full sync from N:\Documentation\OptiAqua — restore all latest features**

#### Added
- **Inventory** dashboard section with KPIs: Below Min Inventory, Cycle Count Accuracy, Material Shortages
- **Production** dashboard section with KPIs: Open Jobs Past Due, Industrial Activity
- **Field Service** dashboard section with date range, tech, equipment, state, and trip type filters
- Sales **year filter** dropdown (2026/2025/2024/2023) replacing old period filter
- Sales **Won Sales Value** KPI card with live calculation from bid data
- Sales **Pending Pipeline by Target Category** chart (100%, Reserve, Watch List, Target)
- **Pagination** system for Sales bids table and Shipping orders table (rows per page selector, prev/next)
- **Loading animations** with wave overlay and skeleton shimmer on KPI cards
- Sales and Shipping **KPI click-to-filter** with highlighted border states
- Shipping **Jobs Overdue** and **Shipped On-Time** KPI cards
- Sales and Shipping **search input** with live filtering across all data
- Auto-fit page size to table visible height on first render

#### Changed
- Overview "YTD Revenue" KPI renamed to "Backlog Value"
- Overview now pulls live Sales KPIs (bids, backlog, win rate), Shipping KPIs, and IT KPIs from Firebase
- Overview radar chart uses real department headcount data from Firebase
- Revenue trend chart uses live monthly actual/target data when available
- Marketing KPI labels updated: Total SEO Reach, Performance Metric, Avg SEO Score, Avg Perf Score
- Sales KPIs now load from `sales_kpis/{year}` (year-specific documents)
- Sales bids now load from chunked `sales_bids/chunk_*` documents
- HR hiring/attrition chart uses live `hiringMonths`/`attritionMonths` from Firebase when available
- Competition section simplified (removed `_index` doc handling)
- DEMO data stripped to placeholder dashes (no more hardcoded fake numbers)
- Shipping KPI `kpi-with-jobs` card uses `grid-column: span 2` instead of `1 / -1`

#### Removed
- IT HelpDesk link from sidebar Internal Tools nav

#### Files synced
  - `.gitignore`, `.nojekyll`, `app.js`, `CHANGELOG.md`, `check_ssrs.js`, `check_ssrs2.js`
  - `CommitSteps`, `Epicor10Live_Reports.csv`, `firebase-init.js`, `index.html`
  - `inv.csv`, `OpenJobs_SSRS.csv`, `OptiAqua.code-workspace`, `prod.csv`
  - `push.ps1`, `queries.txt`, `README.md`, `setup.txt`, `styles.css`, `Update-Changelog.ps1`


### [5aef36d] 2026-06-08 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`


### [c7d3166] 2026-06-08 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [ba28ff6] 2026-06-06 | Aqua-Aerobic IT
**Remove IT HelpDesk tile from Overview Quick Launch**
  - `CHANGELOG.md`
  - `index.html`


### [54b7b33] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`


### [b3c802e] 2026-06-06 | Aqua-Aerobic IT
**Remove Field Service from sync.js: drop syncFieldService function, INTERNAL_APPS entry, and runFullSync call**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [5d1a3a3] 2026-06-06 | Aqua-Aerobic IT
**Remove Field Service from Dashboards nav, remove IT HelpDesk from Internal Tools nav**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [389c94a] 2026-06-06 | Aqua-Aerobic IT
**Field Service: remove 60-day SQL limit, remove AppHealth 500-record trim**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [5bc6124] 2026-06-06 | Aqua-Aerobic IT
**Fix Field Service - convert SundayDate to ISO string, fix UTC timezone bug in date filter**
  - `CHANGELOG.md`
  - `app.js`
  - `sync/sync.js`


### [b903c89] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`


### [d8897c0] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`


### [4287171] 2026-06-06 | Aqua-Aerobic IT
**Fix Field Service API switch to SQL**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [f5a0044] 2026-06-06 | Aqua-Aerobic IT
**Add complex filter dropdowns for Field Service**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [4c180c3] 2026-06-06 | Aqua-Aerobic IT
**Fix Shipping date filters for datagrid**
  - `CHANGELOG.md`
  - `app.js`


### [79e9ddc] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [23ab096] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`


### [91daf2a] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`


### [2b8d4a9] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/SSRSReports/CustomerServiceScheduleLive.rdl`
  - `sync/sync.js`


### [bb263e2] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [e1b8184] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`


### [567b690] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [a553d2b] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `OpenJobs_SSRS.csv`
  - `check_ssrs2.js`
  - `sync/SSRSReports/Analysis-TgtBidTracking.rdl`
  - `sync/SSRSReports/CurMonthly.rdl`
  - `sync/SSRSReports/Dashboard.rdl`
  - `sync/SSRSReports/NewProjectList.rdl`
  - `sync/SSRSReports/OpenJobsByDueDateNew.rdl`
  - `sync/SSRSReports/PendingBIDS.rdl`
  - `sync/SSRSReports/Reports1a-3aTargetByBookingPeriod.rdl`
  - `sync/SSRSReports/detail-TgtRegionbyRep.rdl`
  - `sync/SSRS_Queries.txt`


### [3194dad] 2026-06-06 | Aqua-Aerobic IT
**Fix UI rendering bugs in index.html and app.js**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [58bd21d] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [b75921f] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `CommitSteps`
  - `check_ssrs.js`
  - `inv.csv`
  - `prod.csv`
  - `sync/sync.js`


### [e1a1096] 2026-06-06 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `Epicor10Live_Reports.csv`
  - `README.md`
  - `app.js`
  - `index.html`
  - `queries.txt`
  - `sync/sync.js`


### [7b70aea] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`


### [e1f0f1f] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `styles.css`
  - `sync/sync.js`


### [cc125d3] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`
  - `sync/sync.js`


### [3035e93] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`


### [14e4b49] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `sync/check_hr.js`
  - `sync/diagnose_hr.js`
  - `sync/sync.js`


### [c28a8f1] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [7de61e7] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [a6ab9b6] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [31134c3] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `CommitSteps`
  - `sync/sync.js`


### [b15aad6] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [ea34343] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [6df4b02] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`


### [c4e6d6d] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`


### [e304a3b] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`
  - `sync/sync.js`


### [d073ea9] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`


### [e9cb024] 2026-06-02 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [9d31bfd] 2026-06-01 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `ssrs/PendingBIDS.rdl`
  - `sync/sync.js`


### [e2cb4f7] 2026-06-01 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `ssrs/Analysis-TgtBidTracking.rdl`
  - `sync/fetch_sample.js`
  - `sync/sync.js`
  - `sync/test_sql_data.js`


### [1d7609b] 2026-06-01 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [a00796e] 2026-06-01 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `app.js`


### [0392354] 2026-06-01 | Aqua-Aerobic IT
**docs: update README**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [9024c49] 2026-06-01 | Aqua-Aerobic IT
**minor updates Read CHANGELOG.md**
  - `CHANGELOG.md`
  - `CommitSteps`
  - `app.js`


### [9de42c4] 2026-05-22 | Aqua-Aerobic IT
**minor updates**
  - `CHANGELOG.md`
  - `CommitSteps`


### [1ab7670] 2026-05-22 | Aqua-Aerobic IT
**minor updates**
  - `CHANGELOG.md`
  - `CommitSteps`


### [81f58bc] 2026-05-22 | Aqua-Aerobic IT
**let default be to show for at least 2 seconds before loading data**
  - `CHANGELOG.md`
  - `app.js`


### [aa1049f] 2026-05-22 | Aqua-Aerobic IT
**feat: Add a cool wait animation while data loads throughout app.**
  - `CHANGELOG.md`
  - `app.js`
  - `styles.css`


### [d418141] 2026-05-22 | Aqua-Aerobic IT
**feat: Add a cool wait animation while data loads throughout app.**
  - `CHANGELOG.md`
  - `CommitSteps`


### [d69ecdf] 2026-05-22 | Aqua-Aerobic IT
**fix: Total Orders (7 yrs)**
  - `CHANGELOG.md`
  - `index.html`


### [1586924] 2026-05-22 | Aqua-Aerobic IT
**fix: Total Orders (7 yrs)**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [741a91f] 2026-05-22 | Aqua-Aerobic IT
**fix: Total Orders (7 yrs)**
  - `CHANGELOG.md`
  - `app.js`


### [289b257] 2026-05-22 | Aqua-Aerobic IT
**fix: Total Orders (7 yrs)**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [7cfa7e6] 2026-05-22 | Aqua-Aerobic IT
**fix: Total Orders (7 yrs)**
  - `CHANGELOG.md`
  - `index.html`
  - `sync/sync.js`


### [7deed86] 2026-05-22 | Aqua-Aerobic IT
**fix firebase**
  - `CHANGELOG.md`
  - `app.js`
  - `sync/sync.js`


### [f55c466] 2026-05-22 | Aqua-Aerobic IT
**fix firebase**
  - `CHANGELOG.md`
  - `app.js`
  - `sync/sync.js`


### [bc29612] 2026-05-22 | Aqua-Aerobic IT
**fix firebase**
  - `CHANGELOG.md`
  - `app.js`


### [0782905] 2026-05-22 | Aqua-Aerobic IT
**fix firebase**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [e8cd9e2] 2026-05-22 | Aqua-Aerobic IT
**fix firebase**
  - `CHANGELOG.md`
  - `app.js`
  - `sync/sync.js`


### [6c24f34] 2026-05-22 | Aqua-Aerobic IT
**fix firebase**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [ee074ca] 2026-05-22 | Aqua-Aerobic IT
**fix firebase**
  - `CHANGELOG.md`
  - `CommitSteps`
  - `app.js`
  - `queries.txt`
  - `sync/.env.example`
  - `sync/sync.js`


### [3f1665e] 2026-05-22 | Aqua-Aerobic IT
**fix: removed ORDERS DIRECT SHIP**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [0b5fab9] 2026-05-22 | Aqua-Aerobic IT
**fix: removed ORDERS DIRECT SHIP**
  - `CHANGELOG.md`
  - `index.html`
  - `sync/sync.js`


### [8ca0b0a] 2026-05-22 | Aqua-Aerobic IT
**fix: remove trailing brace causing SyntaxError in app.js**
  - `CHANGELOG.md`
  - `app.js`


### [5a386e8] 2026-05-22 | Aqua-Aerobic IT
**update sql queries and click filters on Shipping page**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [0291692] 2026-05-22 | Aqua-Aerobic IT
**update sql queries for data for charts on Shipping page**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `setup.txt`
  - `sync/sync.js`


### [87de02c] 2026-05-22 | Aqua-Aerobic IT
**update sql queries for data for charts on Shipping page**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [7e7fed2] 2026-05-22 | Aqua-Aerobic IT
**update sql queries for data for charts on Shipping page**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [717631e] 2026-05-22 | Aqua-Aerobic IT
**fix: C_NAVY and sync.js scope errors**
  - `CHANGELOG.md`
  - `app.js`
  - `sync/sync.js`


### [0137093] 2026-05-22 | Aqua-Aerobic IT
**updated query for shipping**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [838afd1] 2026-05-22 | Aqua-Aerobic IT
**feat: update shipping KPIs and add table search**
  - `CHANGELOG.md`
  - `sync/sync.js`


### [3e19e84] 2026-05-22 | Aqua-Aerobic IT
**feat: update shipping KPIs and add table search**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`


### [6044f8b] 2026-05-22 | Aqua-Aerobic IT
**fix: shipping charts and boolean logic**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/sync.js`
  - `sync/test_sql.js`


### [1aae900] 2026-05-22 | Aqua-Aerobic IT
**fix: shipping kpi**
  - `CHANGELOG.md`
  - `CommitSteps`


### [845f701] 2026-05-22 | Aqua-Aerobic IT
**feat: update Shipping KPI query to MasterPackingSSRS**
  - `CHANGELOG.md`
  - `app.js`
  - `sync/sync.js`


### [5d7d4cf] 2026-05-21 | AquaDevelopers - Chuck Konkol
**Update KPI icons and labels in index.html**
  - `index.html`

### [a6509cb] 2026-05-21 | AquaDevelopers - Chuck Konkol
**Integrate Firebase for Sales and Marketing data**
  - `app.js`

### [5720ebb] 2026-05-21 | Aqua-Aerobic IT
**fix: remove Turnover Rate KPI from HR dashboard**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [a42d732] 2026-05-21 | Aqua-Aerobic IT
**fix: restore missing brackets from renderHR chart removal**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [57d7f55] 2026-05-21 | Aqua-Aerobic IT
**fix: remove placeholder Competitive Intelligence charts and KPIs**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [e8284ca] 2026-05-21 | Aqua-Aerobic IT
**style: rename Project Mgr to PM in shipping table**
  - `CHANGELOG.md`
  - `CommitSteps`
  - `app.js`


### [c2cb583] 2026-05-21 | Aqua-Aerobic IT
**fix: hide stale Unknown department from chart**
  - `CHANGELOG.md`
  - `app.js`


### [f2b1bb2] 2026-05-21 | Aqua-Aerobic IT
**feat: expand HR dept chart to show all departments without limit**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [740f683] 2026-05-21 | Aqua-Aerobic IT
**fix: remove training hours KPI from HR dashboard**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [ecacbf9] 2026-05-21 | Aqua-Aerobic IT
**fix: apply text updates and remove disclaimers**
  - `CHANGELOG.md`
  - `index.html`


### [7e59b8a] 2026-05-21 | Aqua-Aerobic IT
**style: reorder shipping columns and adjust widths to fit screen better**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [cfa5e15] 2026-05-21 | Aqua-Aerobic IT
**feat: reorder shipping table columns and remove IT Projects dashboard**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [571de93] 2026-05-21 | Aqua-Aerobic IT
**fix: limit Engineering Schedule columns to match SSRS report**
  - `CHANGELOG.md`
  - `app.js`


### [d4586f4] 2026-05-21 | Aqua-Aerobic IT
**fix: syntax error in shipping table rendering**
  - `CHANGELOG.md`
  - `app.js`


### [7347e9d] 2026-05-21 | Aqua-Aerobic IT
**fix: parse Firebase dates and render all Vantage columns in Shipping table**
  - `CHANGELOG.md`
  - `app.js`


### [5ccc81f] 2026-05-21 | Aqua-Aerobic IT
**feat: wire shipping dashboard to live Vantage PM engineering schedule**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `sync/.env.example`


### [2a650dd] 2026-05-21 | Aqua-Aerobic IT
**updated competitors api**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`
  - `styles.css`
  - `sync/.env.example`


### [f8ee406] 2026-05-21 | Aqua-Aerobic IT
**ui: update internal tools**
  - `CHANGELOG.md`
  - `index.html`


### [e7a81f5] 2026-05-21 | Aqua-Aerobic IT
**feat: wire up firebase overview**
  - `CHANGELOG.md`
  - `app.js`
  - `push.ps1`


### [f34e350] 2026-05-21 | Aqua-Aerobic IT
**docs: update README**
  - `CHANGELOG.md`
  - `sync/.env.example`
  - `sync/package.json`
  - `sync/sync.js`


### [2778d5f] 2026-05-21 | Aqua-Aerobic IT
**security: add Windows auth support for SQL, remove all credentials from tracked files**
  - `CHANGELOG.md`
  - `sync/.env.example`
  - `sync/sync.js`


### [fa86a61] 2026-05-21 | Aqua-Aerobic IT
**docs: update README**
  - `.gitignore`
  - `CHANGELOG.md`
  - `sync/.env.example`
  - `sync/DEPLOY.md`
  - `sync/sync.js`

### [b232103] 2026-05-21 | Aqua-Aerobic IT
**update api's**
  - `CHANGELOG.md`
  - `app.js`
  - `firebase-init.js`
  - `index.html`
  - `styles.css`
  - `sync/.env.example`
  - `sync/package.json`
  - `sync/sync.js`


### [87b2890] 2026-05-21 | Aqua-Aerobic IT
**update api's**
  - `CHANGELOG.md`
  - `app.js`
  - `firebase-init.js`
  - `index.html`
  - `styles.css`
  - `sync/.env.example`
  - `sync/optiaqua-1844b-firebase-adminsdk-fbsvc-85b3fb9c36.json`
  - `sync/package.json`
  - `sync/sync.js`


### [0e1187f] 2026-05-21 | Aqua-Aerobic IT
**update source**
  - `CHANGELOG.md`
  - `app.js`
  - `index.html`


### [eaceef4] 2026-05-21 | Aqua-Aerobic IT
**feat: add push.ps1 one-command deploy script and update CommitSteps**
  - `CHANGELOG.md`
  - `CommitSteps`
  - `push.ps1`




### [58b5e4f] 2026-05-21 | Aqua-Aerobic IT
**fix: deduplicate changelog entries and clean encoding artifacts**
  - `CHANGELOG.md`
  - `Update-Changelog.ps1`




### [6affd7d] 2026-05-21 | Aqua-Aerobic IT
**docs: add CommitSteps workflow reference guide**
  - `CommitSteps`

### [a79837e] 2026-05-21 | Aqua-Aerobic IT
**fix: Update-Changelog.ps1 encoding and git describe error handling**
  - `CHANGELOG.md`
  - `Update-Changelog.ps1`

### [4cd957d] 2026-05-21 | Aqua-Aerobic IT
**feat: add CHANGELOG.md, auto-update hook, and Firebase live config (optiaqua-1844b)**
  - `CHANGELOG.md`
  - `Update-Changelog.ps1`
  - `firebase-init.js`

### [60f8fef] 2026-05-21 | Aqua-Aerobic IT
**feat: Initial OptiAqua Analytics Platform - Sales, Marketing, Shipping, HR, IT, Competition dashboards**
  - `index.html`
  - `styles.css`
  - `app.js`
  - `firebase-init.js`
  - `README.md`
  - `.nojekyll`

---

## [0.2.0] -- 2026-05-21

### Changed
- **Firebase:** Replaced placeholder config with live OptiAqua project credentials (`optiaqua-1844b`)
- **Firebase:** Connected to production Firestore database (`optiaqua-1844b.firebasestorage.app`)
- **Firebase:** Enabled Google Analytics measurement (`G-ZBTH0F423Z`)

---

## [0.1.0] -- 2026-05-21

### Added
- **Project initialization** -- OptiAqua Analytics Platform created for Aqua-Aerobic Systems, Inc.
- **`index.html`** -- Single-page app shell with 7 dashboard sections:
  - Overview (Command Center with KPI grid + app launcher)
  - Sales (EpicorLive / Neptune bid & order tracking)
  - Marketing (campaigns, leads, web traffic)
  - Shipping (Neptune / Master Packing List integration)
  - HR (headcount, hiring, tenure, AVA HR AI link)
  - IT Projects (HelpDesk tickets, project tracker, app health grid)
  - Competition (win/loss analysis, market share, competitor cards)
- **`styles.css`** -- Full dark-mode design system using Aqua-Aerobic brand colors (`#00529C` / `#29AAE2`)
- **`app.js`** -- Chart.js 4 rendering engine, SPA navigation, clock, demo data for all 6 departments
- **`firebase-init.js`** -- Firebase 10 SDK initialization with Firestore + Analytics
- **`README.md`** -- Project setup guide: Firebase schema, database references, SQL sync strategy
- **`.nojekyll`** -- GitHub Pages Jekyll bypass
- **GitHub Pages deployment** -- Pushed to `https://github.com/OptiAqua/OptiAqua.github.io` (`main` branch)

### Internal Data Sources Referenced
| Server | Database | Purpose |
|---|---|---|
| `aquaerpdb` | `EpicorLive` | Sales, Bids, Shop Orders |
| `aqua26` | `Neptune` | Shipping, Order Management |
| `aqua26` | `Neptune_Master` | Master reference data |
| `aqua18` | `AquaAerobic` | Warranty & Service |
| `aqua18` | `AquaReports` | Reporting data |

---

*Maintained by the Aqua-Aerobic IT Department -- ITHelpDesk@aqua-aerobic.com*
