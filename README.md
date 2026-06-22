# OptiAqua Analytics Platform
## Aqua-Aerobic Systems, Inc. — Internal Analytics Dashboard

[![GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-blue?logo=github)](https://optiqua.github.io/OptiAqua.github.io/)

---

## Overview

**OptiAqua Analytics** is a comprehensive, real-time analytics platform for Aqua-Aerobic Systems, Inc. It provides department-level KPIs, trend charts, and operational intelligence across:

| Section | Data Sources |
|---|---|
| **Sales** | EpicorLive (`aquaerpdb`), Neptune (`aqua26`) |
| **Marketing** | Campaign data, web analytics |
| **Shipping** | Neptune (`aqua26`), Neptune_Master (`aqua26`) |
| **HR** | AquaAerobic DB (`aqua18`), AVA HR AI |
| **IT Projects** | HelpDesk portal, project tracker |
| **Competition** | Win/loss data from EpicorLive |
| **Inventory** | `EpicorLive`, SSRS `MinInventoryOnHand` |
| **Production** | `EpicorLive`, SSRS `OpenJobsByDueDateNew` |

---

## Quickstart

### 1. Clone the repo

```bash
git clone https://github.com/OptiAqua/OptiAqua.github.io.git
cd OptiAqua.github.io
```

### 2. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create project: `OptiAqua-Analytics`
3. Enable **Firestore Database**
4. Register a **Web App** and copy the config
5. Paste config into `firebase-init.js`

### 3. Firestore Collection Schema

Create these collections in Firestore:

```
sales_kpis        { bids, won, pending, backlog, period, updatedAt }
sales_bids        { bidNum, customer, productLine, value, status, rep, dueDate }
shipping_records  { orderNum, customer, destination, carrier, shipDate, status, weight }
hr_data           { totalEmployees, newHires, turnoverRate, openPositions, avgTenure, trainingHours }
it_tickets        { title, category, priority, status, assignee, created, resolved }
it_projects       { name, owner, priority, status, progress, dueDate }
marketing_kpis    { sessions, leads, emailOpenRate, conversionRate, updatedAt }
inventory_kpis    { minBreaches, accuracy, shortages, updatedAt }
production_kpis   { pastDue, activity, updatedAt }
```

### 4. Deploy to GitHub Pages

```bash
git add .
git commit -m "Initial OptiAqua Analytics deployment"
git push origin main
```

GitHub Pages will serve from `main` branch root. Set this in:
**Repo Settings → Pages → Source → Deploy from branch → main / (root)**

---

## Database Connections

> ⚠️ These databases are on the internal Aqua-Aerobic network.
> SQL-to-Firebase sync should be done via the existing Node.js app at `aqua-aerobic.net:3000`
> or a dedicated backend sync service.

| Server | Database | Purpose |
|---|---|---|
| `aquaerpdb` | `EpicorLive` | Sales, Bids, Shop Orders |
| `aqua26` | `Neptune` | Shipping, Order Management |
| `aqua26` | `Neptune_Master` | Master data reference |
| `aqua18` | `AquaAerobic` | Warranty & Service |
| `aqua18` | `AquaReports` | Reporting data |

---

## Internal App Links

| App | URL |
|---|---|
| Company Search / File Activity | http://www.aqua-aerobic.net:3000/ |
| AquaGuide | https://aquaguide.app/ |
| IT HelpDesk | http://www.aqua-aerobic.net:5555/ |
| Pick Pack Print | http://www.aqua-aerobic.net:5050/ |
| Visitor System | https://aquavisitorsystem.github.io/ |
| Company Search | http://www.aqua-aerobic.net:3000/ |
| AQUALocator | https://aqualocator.github.io/ |
| AVA – HR AI | http://www.aqua-aerobic.net:3000/hrchat/ |
| CSD Dashboard | http://aqua88:5076/ |
| Field Service Schedule | http://www.aqua-aerobic.net:5000/ |
| Master Packing List | http://www.aqua-aerobic.net:4000/dashboard.html |
| Panel Progress | http://www.aqua-aerobic.net:5084/ |

---

## Architecture

```
index.html          — App shell, all sections (SPA)
styles.css          — Dark-mode design system, brand colors
app.js              — Navigation, Chart.js rendering, demo data
firebase-init.js    — Firebase setup & Firestore helpers
README.md           — This file
.nojekyll           — Disables GitHub Pages Jekyll processing
```

---

## Tech Stack

- **HTML5 / Vanilla CSS / JavaScript (ES Modules)**
- **Chart.js 4** — all charts and visualizations
- **Firebase 10** — Firestore real-time database + Analytics
- **Google Fonts** — Inter + Outfit typefaces
- **GitHub Pages** — Hosting

---

## Development Notes

- The app runs in **demo mode** if Firebase credentials are not configured
- All data in `app.js → DEMO` object is placeholder — replace with real Firebase reads
- SQL data (EpicorLive, Neptune) should be synced to Firestore via a scheduled Node.js job
- The sidebar links to internal apps will only work on the Aqua-Aerobic corporate network

---

*© 2025 Aqua-Aerobic Systems, Inc. — All rights reserved.*
