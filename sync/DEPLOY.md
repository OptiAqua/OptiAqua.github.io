# OptiAqua Sync Server — Deployment Guide

## What this does

Runs on any internal server with network access to `aqua-aerobic.net` and `aquaerpdb`.
Fetches data from SQL + internal apps every 6am, 12pm, 6pm (CST) and pushes to Firestore.
The public dashboard at https://optiqua.github.io reads from Firestore — no VPN needed.

\---

## Server Requirements

* Windows or Linux
* Node.js 18+ installed
* Network access to: `aqua-aerobic.net`, `aquaerpdb`, `aqua26`, `aqua18`, `aquaerprep`, `aqua88`
* Outbound HTTPS to Firebase (`\*.googleapis.com`)

\---

## Step 1 — Copy files to the server

Copy the `sync/` folder to the server. Only these files are needed:

```
sync/
  sync.js
  package.json
  .env.example
```

**Do NOT copy** `node\_modules/` or any `.json` key files via git.

\---

## Step 2 — Get the Firebase Service Account key

> \*\*IMPORTANT:\*\* The previously generated key was accidentally pushed to GitHub and should be regenerated.

1. Go to [Firebase Console](https://console.firebase.google.com) → **optiaqua-1844b**
2. Click ⚙️ **Project Settings** → **Service Accounts** tab
3. Click **"Generate new private key"** → confirms → downloads a `.json` file
4. **Rename it** to `serviceaccount.json`
5. **Copy it directly to the server** (e.g. `C:\\OptiAqua\\sync\\serviceaccount.json`)
6. **Never commit it to git** — it's in `.gitignore`

\---

## Step 3 — Configure `.env`

```powershell
# On the server, in the sync folder:
copy .env.example .env
notepad .env
```

Edit `.env`:

```env
# Point to the JSON key file you copied in Step 2
GOOGLE\_APPLICATION\_CREDENTIALS=C:\\OptiAqua\\sync\\serviceaccount.json

# SQL Servers
SQL\_EPICOR\_SERVER=aquaerpdb
SQL\_EPICOR\_DB=EpicorLive
SQL\_EPICOR\_USER=odbcuser
SQL\_EPICOR\_PASS=odbcuser

SQL\_NEPTUNE\_SERVER=aqua26
SQL\_NEPTUNE\_DB=Neptune
SQL\_NEPTUNE\_USER=odbcuser
SQL\_NEPTUNE\_PASS=odbcuser

SQL\_AQUA\_SERVER=aqua18
SQL\_AQUA\_DB=AquaAerobic
SQL\_AQUA\_USER=odbcuser
SQL\_AQUA\_PASS=odbcuser

# SSRS
SSRS\_BASE\_URL=http://aquaerprep/Reports
SSRS\_HR\_REPORT=/report/ITReports/AquaEmployeeStatus

# Schedule: 6am, 12pm, 6pm CST
SYNC\_SCHEDULE=0 6,12,18 \* \* \*
```

\---

## Step 4 — Install and test

```powershell
cd C:\\OptiAqua\\sync
npm install

# Run once immediately to test all connections:
node sync.js -f --once
```

Expected output:

```
\[OptiAqua Sync] Firebase connected.
\[Sales] Syncing from EpicorLive...
\[Shipping] Syncing from Neptune...
\[HR] Syncing from SSRS...
\[AppHealth] Pinging all internal apps...
  \[Company Search] up (42ms) + API data
  \[Field Service] up (38ms) + API data
  \[Master Packing List] up (51ms) + API data
  \[Master Packing List/missingjobs] API pulled: 3 records
  \[Panel Progress] up (44ms) + API data
  ...
\[AppHealth] Done. 9/11 up | 5 with API data.
\[OptiAqua Sync] Complete — 8.3s
```

\---

## Step 5 — Keep it running (choose one)

### Option A: PM2 (recommended — auto-restarts on crash/reboot)

```powershell
npm install -g pm2
pm2 start sync.js -f --name optiaqua-sync
pm2 save
pm2 startup   # follow the instructions it prints to auto-start on boot
```

Useful PM2 commands:

```powershell
pm2 status                     # check running status
pm2 logs optiaqua-sync         # view live logs
pm2 restart optiaqua-sync      # restart after config change
pm2 stop optiaqua-sync         # stop
```

### Option B: Windows Task Scheduler (no extra tools)

1. Open **Task Scheduler** → Create Basic Task
2. **Name:** OptiAqua Sync
3. **Trigger:** Daily, repeat every 6 hours starting at 6:00 AM
4. **Action:** Start a program

   * Program: `node`
   * Arguments: `sync.js --once`
   * Start in: `C:\\OptiAqua\\sync`
5. Check **"Run whether user is logged on or not"**

### Option C: npm start (stays in terminal — good for testing)

```powershell
npm start
```

\---

## Troubleshooting

|Problem|Fix|
|-|-|
|`Cannot find module 'mssql'`|Run `npm install` in the sync folder|
|`Firebase: insufficient permissions`|Regenerate service account key (see Step 2)|
|`SSRS HTTP 401`|The server needs Windows auth to reach aquaerprep — run sync on a domain-joined machine|
|`SQL connection timeout`|Verify `aquaerpdb` is reachable: `ping aquaerpdb`|
|`App health all showing 'down'`|Server needs network access to `aqua-aerobic.net`|

\---

## Firestore Collections Written

|Collection|Source|Data|
|-|-|-|
|`sales\_kpis`|EpicorLive|Bid counts, revenue, monthly trend|
|`sales\_bids`|EpicorLive|Recent 20 bids with status|
|`shipping\_kpis`|Neptune|On-time rate, in-transit, exceptions|
|`shipping\_records`|Neptune|Recent 20 shipments|
|`hr\_kpis`|SSRS AquaEmployeeStatus|Headcount, dept breakdown, tenure|
|`warranty\_cases`|AquaAerobic|Open service cases|
|`app\_health`|HTTP ping|All 11 apps: status + response time|
|`app\_stats\_companysearch`|`:3000/api/stats`|File/search activity|
|`app\_stats\_fieldservice`|`:5000/api/grid`|Field service schedule|
|`app\_stats\_packinglist`|`:4000/api/allmasters`|Packing list masters|
|`app\_stats\_missingjobs`|`:4000/api/missingjobs`|Missing job exceptions|
|`app\_stats\_panelprogress`|`:5084/api/data`|Panel production progress|
|`meta/lastSync`|sync.js|Timestamp shown in dashboard topbar|



