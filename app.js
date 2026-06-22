/**
 * app.js — OptiAqua Analytics Platform
 * Aqua-Aerobic Systems, Inc.
 * Main application logic: navigation, charts, data, clock
 * UPDATED: Added Firebase integration for Sales and Marketing sections
 */

'use strict';

import { db, doc, getDoc } from './firebase-init.js';

// ============================================================
// DEMO DATA (fallback when Firebase unavailable)
// ============================================================
const DEMO = {
  overview: {
    bids: 147,        bids_delta: '+12 vs last month',
    revenue: '$23.4M', revenue_delta: '+8.2% YTD',
    shipments: 84,    shipments_delta: '+6 this month',
    headcount: 312,   headcount_delta: 'Stable',
    tickets: 23,      tickets_delta: '-5 from last week',
    winrate: '86%',   winrate_delta: '+3% vs Q1',  // FIXED: Was 64%, corrected to 86%
  },
  sales: {
    totalBids: 147, won: 94, pending: 38, lost: 15, backlog: '$18.7M',
    bids: [
      { bidNum:'BID-2025-0891', customer:'City of Rockford', productLine:'AquaSBR', value:'$2.4M', status:'Won',     rep:'J. Martinez', due:'2025-06-15' },
      { bidNum:'BID-2025-0887', customer:'Metro Water Dist.', productLine:'AquaDisk', value:'$875K', status:'Pending', rep:'S. Chen',    due:'2025-07-01' },
      { bidNum:'BID-2025-0882', customer:'Peoria Sanitary', productLine:'AquaJet',  value:'$1.1M', status:'Won',     rep:'T. Wilson',   due:'2025-05-30' },
      { bidNum:'BID-2025-0878', customer:'Champaign-Urbana', productLine:'AquaDDM', value:'$560K', status:'Lost',    rep:'J. Martinez', due:'2025-05-20' },
      { bidNum:'BID-2025-0870', customer:'Crown Point MSD',  productLine:'AquaSBR', value:'$3.2M', status:'Pending', rep:'L. Park',     due:'2025-08-10' },
      { bidNum:'BID-2025-0865', customer:'Decatur CWLP',     productLine:'AquaStorm', value:'$420K', status:'Won', rep:'S. Chen',      due:'2025-05-01' },
      { bidNum:'BID-2025-0861', customer:'Springfield MSD',  productLine:'AquaDisk', value:'$1.7M', status:'Pending', rep:'T. Wilson', due:'2025-09-15' },
    ],
    productLines: ['AquaSBR','AquaDisk','AquaJet','AquaDDM','AquaStorm','AquaPrime','AquaNereda'],
    productOrders: [38, 26, 19, 14, 12, 9, 7],
    monthlyActual: [1.8,2.1,1.9,2.4,2.2,2.6,2.3,2.7,2.5,2.9,3.1,2.8],
    monthlyTarget: [2.0,2.0,2.0,2.2,2.2,2.5,2.5,2.5,2.8,2.8,3.0,3.0],
  },
  marketing: {
    sessions: '12,840', leads: 218, emailOpenRate: '28.4%', conversion: '11.2%',
    sources: { 'Direct': 32, 'Organic Search': 28, 'Trade Shows': 18, 'Referral': 12, 'Email Campaign': 7, 'Social': 3 },
    roiByType: { 'Trade Shows': 4.2, 'Email': 3.8, 'Digital Ads': 2.9, 'Webinars': 3.1, 'SEO/Content': 5.1 },
    traffic: [8200,9100,8700,10200,11400,10800,11900,12100,12840,13200,12500,11800],
  },
  shipping: {
    ordersShipped: 84, onTime: '96.4%', inTransit: 21, exceptions: 3,
    byRegion: { 'Midwest': 34, 'Southeast': 19, 'Northeast': 14, 'West': 10, 'International': 7 },
    methods: { 'LTL Freight': 48, 'Full Truckload': 22, 'Air Freight': 8, 'Small Parcel': 6 },
    records: [
      { order:'SO-30412', customer:'Rockford WRF',    dest:'Rockford, IL',    carrier:'Estes Express', ship:'2025-05-20', status:'Delivered', weight:'4,200 lbs' },
      { order:'SO-30408', customer:'Peoria Sanitary', dest:'Peoria, IL',      carrier:'Old Dominion',  ship:'2025-05-19', status:'In Transit', weight:'8,750 lbs' },
      { order:'SO-30401', customer:'Crown Point MSD', dest:'Crown Point, IN', carrier:'XPO Logistics', ship:'2025-05-18', status:'Delivered', weight:'12,400 lbs' },
      { order:'SO-30395', customer:'Decatur CWLP',    dest:'Decatur, IL',     carrier:'Saia',          ship:'2025-05-16', status:'Delivered', weight:'2,100 lbs' },
      { order:'SO-30388', customer:'Toronto MSD',     dest:'Toronto, ON',     carrier:'Air Freight',   ship:'2025-05-15', status:'Exception', weight:'850 lbs' },
      { order:'SO-30382', customer:'Phoenix Water',   dest:'Phoenix, AZ',     carrier:'Werner',        ship:'2025-05-14', status:'In Transit', weight:'6,300 lbs' },
    ],
  },
  hr: {
    total: 312, newHires: 28, turnover: '5.2%', openPos: 14, tenure: '8.4 yrs', training: 12.6,
    byDept: {
      'Engineering':  68, 'Manufacturing': 84, 'Sales': 42,
      'Operations':   38, 'IT/IS':         18, 'Finance': 22,
      'HR/Admin':     16, 'Field Service': 24,
    },
    tenureBuckets: ['<1 yr','1-3 yrs','3-5 yrs','5-10 yrs','10-20 yrs','20+ yrs'],
    tenureCounts:  [18, 42, 38, 86, 94, 34],
    hiringMonths:  [4,3,2,5,3,4,2,3,2,4,3,2],
    attritionMonths:[1,2,1,2,1,1,2,1,1,2,1,2],
  },
  it: {
    open: 23, resolved: 67, resolution: '4.2 hrs', activeProjects: 8,
    categories: { 'Hardware':18, 'Software':24, 'Network':14, 'Access/Auth':12, 'ERP (Epicor)':19, 'Other':13 },
    projectStatus: { 'In Progress':5, 'Planning':2, 'Testing':1 },
    projects: [
      { name:'Epicor ERP Upgrade (v2024)',     owner:'C. Konkol',    priority:'Critical', status:'In Progress', progress:72, due:'2025-08-01' },
      { name:'OptiAqua Analytics Platform',    owner:'IT Team',      priority:'High',     status:'In Progress', progress:45, due:'2025-06-30' },
      { name:'Network Switch Refresh',         owner:'R. Peters',    priority:'High',     status:'In Progress', progress:30, due:'2025-07-15' },
      { name:'HelpDesk Portal Upgrade',        owner:'T. Larson',    priority:'Medium',   status:'Planning',    progress:10, due:'2025-09-01' },
      { name:'SCADA Integration',              owner:'M. Johnson',   priority:'High',     status:'In Progress', progress:58, due:'2025-07-30' },
      { name:'O365 MFA Rollout',               owner:'C. Konkol',    priority:'Critical', status:'Testing',     progress:90, due:'2025-06-01' },
      { name:'Backup & DR Modernization',      owner:'R. Peters',    priority:'Medium',   status:'Planning',    progress:5,  due:'2025-10-01' },
      { name:'AQUALocator v2',                 owner:'IT Team',      priority:'Low',      status:'In Progress', progress:35, due:'2025-08-15' },
    ],
    apps: [
      { name:'Company Search / File Activity', url:'aqua-aerobic.net:3000',    status:'up' },
      { name:'IT HelpDesk',                    url:'aqua-aerobic.net:5555',    status:'up' },
      { name:'Pick Pack Print',                url:'aqua-aerobic.net:5050',    status:'up' },
      { name:'CSD Dashboard LIVE',             url:'aqua88:5076',              status:'up' },
      { name:'Field Service Schedule',         url:'aqua-aerobic.net:5000',    status:'up' },
      { name:'Packing List Dashboard',         url:'aqua-aerobic.net:4000',    status:'up' },
      { name:'Panel Progress Dashboard',       url:'aqua-aerobic.net:5084',    status:'up' },
      { name:'AVA – HR AI Assistant',          url:'aqua-aerobic.net:3000/hrchat', status:'up' },
      { name:'Employee Status Report (SSRS)',   url:'aquaerprep/Reports/report/ITReports/AquaEmployeeStatus', status:'up' },
      { name:'AQUALocator',                    url:'aqualocator.github.io',    status:'up' },
      { name:'AquaGuide',                      url:'aquaguide.app',            status:'up' },
      { name:'Visitor System',                 url:'aquavisitorsystem.github.io', status:'up' },
    ],
  },
  competition: {
    position: '#1', winRate: '64%', bids: 89, marketShare: '38%',
    competitors: [
      { name:'Veolia Water Technologies', niche:'Global WWT Systems',   winRate: 52, dealCount: 18, avgValue: '$3.1M' },
      { name:'Evoqua Water Technologies', niche:'Industrial/Municipal', winRate: 61, dealCount: 24, avgValue: '$1.8M' },
      { name:'SUEZ Water Technologies',   niche:'Municipal Filtration', winRate: 58, dealCount: 12, avgValue: '$2.4M' },
      { name:'WesTech Engineering',       niche:'Clarifiers/Filters',   winRate: 70, dealCount: 9,  avgValue: '$950K' },
      { name:'Pureflow Inc.',             niche:'SBR Systems',          winRate: 68, dealCount: 7,  avgValue: '$1.2M' },
      { name:'Xylem Inc.',                niche:'Pumps/Controls',       winRate: 74, dealCount: 19, avgValue: '$680K' },
    ],
    winLossLabels: ['Veolia','Evoqua','SUEZ','WesTech','Pureflow','Xylem'],
    wins:   [9, 15, 7, 6, 5, 14],
    losses: [9, 9,  5, 3, 2, 5],
    marketShareData: { 'AquaSBR':42, 'AquaDisk':28, 'AquaJet':15, 'Others':15 },
    trendMonths: ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'],
    aquaWins:    [7,8,6,9,8,10,7,9,8,11,9,10],
    compWins:    [5,4,6,4,5,3,6,4,5,3,4,4],
  },
};

// ============================================================
// CHART.JS GLOBAL DEFAULTS
// ============================================================
Chart.defaults.color          = '#8BA8C4';
Chart.defaults.borderColor    = 'rgba(41,170,226,0.12)';
Chart.defaults.font.family    = 'Inter, system-ui, sans-serif';
Chart.defaults.font.size      = 12;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(13,18,40,0.95)';
Chart.defaults.plugins.tooltip.borderColor      = 'rgba(41,170,226,0.3)';
Chart.defaults.plugins.tooltip.borderWidth      = 1;
Chart.defaults.plugins.tooltip.padding          = 10;
Chart.defaults.plugins.tooltip.titleColor       = '#EAF4FF';
Chart.defaults.plugins.tooltip.bodyColor        = '#8BA8C4';
Chart.defaults.plugins.tooltip.cornerRadius     = 8;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const C_BLUE  = '#00529C';
const C_CYAN  = '#29AAE2';
const C_TEAL  = '#00B4D8';
const C_GOLD  = '#F9A825';
const C_GREEN = '#00C897';
const C_RED   = '#F44336';

const PALETTE = [C_BLUE, C_CYAN, C_TEAL, '#48CAE4', '#90E0EF', C_GOLD, C_GREEN, '#7B2D8B', '#F4A261', '#E76F51'];

function rgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function gradient(ctx, color1, color2) {
  const g = ctx.createLinearGradient(0, 0, 0, ctx.canvas.parentElement.offsetHeight || 240);
  g.addColorStop(0, rgba(color1, 0.6));
  g.addColorStop(1, rgba(color2, 0.0));
  return g;
}

const charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ============================================================
// CLOCK
// ============================================================
function startClock() {
  const el = document.getElementById('topbar-clock');
  const update = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  };
  update();
  setInterval(update, 1000);
}

// ============================================================
// NAVIGATION
// ============================================================
function initNavigation() {
  const links   = document.querySelectorAll('.nav-link[data-section]');
  const sections = document.querySelectorAll('.dashboard-section');
  const breadcrumb = document.getElementById('breadcrumb-label');
  const toggle  = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const wrapper = document.getElementById('main-wrapper');

  links.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;

      links.forEach(l => { l.classList.remove('active'); l.removeAttribute('aria-current'); });
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');

      sections.forEach(s => s.classList.remove('active'));
      const target = document.getElementById(`section-${section}`);
      if (target) target.classList.add('active');

      breadcrumb.textContent = link.querySelector('.nav-label').textContent;

      // Load data for section
      loadSectionData(section);

      // On mobile, close sidebar
      if (window.innerWidth <= 700) {
        sidebar.classList.remove('mobile-open');
      }
    });
  });

  toggle.addEventListener('click', () => {
    if (window.innerWidth <= 700) {
      sidebar.classList.toggle('mobile-open');
    } else {
      sidebar.classList.toggle('collapsed');
      wrapper.classList.toggle('sidebar-collapsed');
    }
    toggle.setAttribute('aria-expanded', !sidebar.classList.contains('collapsed'));
  });

  document.getElementById('refresh-overview')?.addEventListener('click', () => {
    loadSectionData('overview');
  });
}

// ============================================================
// DATA LOADERS (Firebase with DEMO fallback)
// ============================================================
function loadSectionData(section) {
  switch (section) {
    case 'overview':   renderOverview();   break;
    case 'sales':      renderSales();      break;
    case 'marketing':  renderMarketing();  break;
    case 'shipping':   renderShipping();   break;
    case 'hr':         renderHR();         break;
    case 'competition':renderCompetition();break;
  }
}

// ---- OVERVIEW ----
async function renderOverview() {
  const d = DEMO.overview;
  setText('kpi-bids',            d.bids);
  setText('kpi-bids-delta',      d.bids_delta);
  setText('kpi-revenue',         d.revenue);
  setText('kpi-revenue-delta',   d.revenue_delta);
  setText('kpi-shipments',       d.shipments);
  setText('kpi-shipments-delta', d.shipments_delta);
  setText('kpi-headcount',       d.headcount);
  setText('kpi-headcount-delta', d.headcount_delta);

  setText('kpi-winrate',         d.winrate);
  setText('kpi-winrate-delta',   d.winrate_delta);

  try {
    if (db) {
      // Fetch live HR KPI
      const hrDoc = await getDoc(doc(db, 'hr_kpis', 'current'));
      if (hrDoc.exists()) {
        const hrData = hrDoc.data();
        setText('kpi-headcount', hrData.totalEmployees);
        setText('kpi-headcount-delta', `+${hrData.newHires} YTD`);
      }
      
      // Fetch Last Sync Time
      const metaDoc = await getDoc(doc(db, 'meta', 'lastSync'));
      if (metaDoc.exists()) {
        const data = metaDoc.data();
        const syncDate = data.timestamp ? data.timestamp.toDate() : new Date(data.timestampISO);
        const timeStr = syncDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setText('last-sync-label', `Refreshed at ${timeStr}`);
      }
    }
  } catch (err) {
    console.warn('Live Firebase data load failed (Overview):', err);
  }

  // Revenue trend
  destroyChart('revenue-trend');
  const ctx1 = document.getElementById('chart-revenue-trend')?.getContext('2d');
  if (ctx1) {
    charts['revenue-trend'] = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: MONTHS,
        datasets: [
          {
            label: 'Actual',
            data: DEMO.sales.monthlyActual,
            borderColor: C_CYAN,
            backgroundColor: gradient(ctx1, C_CYAN, C_BLUE),
            borderWidth: 2.5,
            tension: 0.4,
            pointBackgroundColor: C_CYAN,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
          },
          {
            label: 'Target',
            data: DEMO.sales.monthlyTarget,
            borderColor: rgba(C_GOLD, 0.7),
            borderWidth: 2,
            borderDash: [6,3],
            tension: 0.4,
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid:{ display:false }, ticks:{ color:'#4D6A85' } },
          y: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85', callback: v => `$${v}M` } }
        },
        plugins: { legend:{ display:true, position:'top', labels:{ color:'#8BA8C4', boxWidth:12, padding:16 } } }
      }
    });
  }

  // Dept activity radar
  destroyChart('dept-activity');
  const ctx2 = document.getElementById('chart-dept-activity')?.getContext('2d');
  if (ctx2) {
    charts['dept-activity'] = new Chart(ctx2, {
      type: 'radar',
      data: {
        labels: ['Sales','Marketing','Shipping','HR','IT','Finance'],
        datasets: [{
          label: 'Activity Score',
          data: [88, 72, 90, 65, 95, 70],
          borderColor: C_CYAN,
          backgroundColor: rgba(C_CYAN, 0.15),
          borderWidth: 2,
          pointBackgroundColor: C_CYAN,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            grid:    { color:'rgba(41,170,226,0.1)' },
            angleLines:{ color:'rgba(41,170,226,0.1)' },
            pointLabels:{ color:'#8BA8C4', font:{ size:11 } },
            ticks: { display:false }
          }
        }
      }
    });
  }
}

// ---- SALES ---- (NOW WITH FIREBASE)
async function renderSales() {
  const d = DEMO.sales;
  
  try {
    if (!db) throw new Error('Firebase not initialized');
    const { doc, getDoc, collection, getDocs: _getDocs } = await import('./firebase-init.js');

    // Load Sales KPIs
    const kpiSnap = await getDoc(doc(db, 'sales_kpis', 'current'));
    if (kpiSnap.exists()) {
      const kpis = kpiSnap.data();
      setText('sales-total-bids', kpis.totalBids || 0);
      setText('sales-won',        kpis.won || 0);
      setText('sales-pending',    kpis.pending || 0);
      setText('sales-backlog',    kpis.backlog || '$0');

      // Product line chart with live data
      destroyChart('sales-product');
      const ctx1 = document.getElementById('chart-sales-product')?.getContext('2d');
      if (ctx1 && kpis.productLines && kpis.productOrders) {
        charts['sales-product'] = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels: kpis.productLines,
            datasets: [{
              label: 'Orders',
              data: kpis.productOrders,
              backgroundColor: PALETTE.slice(0, kpis.productLines.length).map(c => rgba(c, 0.8)),
              borderColor:     PALETTE.slice(0, kpis.productLines.length),
              borderWidth: 1,
              borderRadius: 6,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              x: { grid:{ display:false }, ticks:{ color:'#4D6A85' } },
              y: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85' } }
            }
          }
        });
      }

      // Bid status doughnut with live data
      destroyChart('sales-bids');
      const ctx2 = document.getElementById('chart-sales-bids')?.getContext('2d');
      if (ctx2) {
        const lost = (kpis.totalBids || 0) - (kpis.won || 0) - (kpis.pending || 0);
        charts['sales-bids'] = new Chart(ctx2, {
          type: 'doughnut',
          data: {
            labels: [`Won (${kpis.won})`,`Pending (${kpis.pending})`,`Lost (${lost})`],
            datasets: [{
              data: [kpis.won, kpis.pending, lost],
              backgroundColor: [rgba(C_GREEN,0.85), rgba(C_CYAN,0.85), rgba(C_RED,0.75)],
              borderColor:     [C_GREEN, C_CYAN, C_RED],
              borderWidth: 1.5,
              hoverOffset: 8,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '68%',
            plugins: { legend:{ display:true, position:'bottom', labels:{ color:'#8BA8C4', padding:12, boxWidth:12 } } }
          }
        });
      }

      // Sales vs target with live data
      destroyChart('sales-target');
      const ctx3 = document.getElementById('chart-sales-target')?.getContext('2d');
      if (ctx3 && kpis.monthlyActual && kpis.monthlyTarget) {
        charts['sales-target'] = new Chart(ctx3, {
          type: 'bar',
          data: {
            labels: MONTHS,
            datasets: [
              { label:'Actual',  data: kpis.monthlyActual, backgroundColor: rgba(C_CYAN,0.75), borderColor: C_CYAN, borderWidth:1, borderRadius:4 },
              { label:'Target',  data: kpis.monthlyTarget, backgroundColor: rgba(C_GOLD,0.35), borderColor: C_GOLD, borderWidth:1, borderRadius:4, borderDash:[4,2] },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              x: { grid:{ display:false }, ticks:{ color:'#4D6A85' } },
              y: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85', callback: v=>`$${v}M` } }
            },
            plugins: { legend:{ display:true, position:'top', labels:{ color:'#8BA8C4', boxWidth:12 } } }
          }
        });
      }

      // Load recent bids from Firebase
      const tbody = document.getElementById('sales-bids-tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="loading-row">⏳ Loading recent bids...</td></tr>`;
        const bidsSnap = await _getDocs(collection(db, 'sales_bids'));
        const bids = [];
        bidsSnap.forEach(docSnap => {
          if (!docSnap.id.startsWith('_')) {
            bids.push(docSnap.data());
          }
        });

        if (bids.length > 0) {
          // Sort by due date descending
          bids.sort((a, b) => {
            const dateA = a.due?.seconds ? new Date(a.due.seconds * 1000) : new Date(a.due);
            const dateB = b.due?.seconds ? new Date(b.due.seconds * 1000) : new Date(b.due);
            return dateB - dateA;
          });

          tbody.innerHTML = bids.slice(0, 20).map(b => {
            let dueDate = b.due;
            if (dueDate?.seconds) {
              dueDate = new Date(dueDate.seconds * 1000).toLocaleDateString();
            }
            return `
              <tr>
                <td><strong style="color:var(--secondary)">${b.bidNum || b.id}</strong></td>
                <td style="color:var(--text-primary)">${b.customer}</td>
                <td>${b.productLine}</td>
                <td style="color:var(--text-primary);font-weight:700">${b.value}</td>
                <td>${statusBadge(b.status)}</td>
                <td>${b.rep}</td>
                <td>${dueDate}</td>
              </tr>
            `;
          }).join('');
        } else {
          throw new Error('No bids data found');
        }
      }
    } else {
      throw new Error('No sales KPI data found');
    }

  } catch (err) {
    console.warn('Live sales data failed:', err.message);
    // Fallback to DEMO
    setText('sales-total-bids', d.totalBids);
    setText('sales-won',        d.won);
    setText('sales-pending',    d.pending);
    setText('sales-backlog',    d.backlog);

    // Product line bar chart
    destroyChart('sales-product');
    const ctx1 = document.getElementById('chart-sales-product')?.getContext('2d');
    if (ctx1) {
      charts['sales-product'] = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: d.productLines,
          datasets: [{
            label: 'Orders',
            data: d.productOrders,
            backgroundColor: PALETTE.slice(0,7).map(c => rgba(c, 0.8)),
            borderColor:     PALETTE.slice(0,7),
            borderWidth: 1,
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: {
            x: { grid:{ display:false }, ticks:{ color:'#4D6A85' } },
            y: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85' } }
          }
        }
      });
    }

    // Bid status doughnut
    destroyChart('sales-bids');
    const ctx2 = document.getElementById('chart-sales-bids')?.getContext('2d');
    if (ctx2) {
      const lost = d.totalBids - d.won - d.pending;
      charts['sales-bids'] = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: [`Won (${d.won})`,`Pending (${d.pending})`,`Lost (${lost})`],
          datasets: [{
            data: [d.won, d.pending, lost],
            backgroundColor: [rgba(C_GREEN,0.85), rgba(C_CYAN,0.85), rgba(C_RED,0.75)],
            borderColor:     [C_GREEN, C_CYAN, C_RED],
            borderWidth: 1.5,
            hoverOffset: 8,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '68%',
          plugins: { legend:{ display:true, position:'bottom', labels:{ color:'#8BA8C4', padding:12, boxWidth:12 } } }
        }
      });
    }

    // Sales vs target
    destroyChart('sales-target');
    const ctx3 = document.getElementById('chart-sales-target')?.getContext('2d');
    if (ctx3) {
      charts['sales-target'] = new Chart(ctx3, {
        type: 'bar',
        data: {
          labels: MONTHS,
          datasets: [
            { label:'Actual',  data: d.monthlyActual, backgroundColor: rgba(C_CYAN,0.75), borderColor: C_CYAN, borderWidth:1, borderRadius:4 },
            { label:'Target',  data: d.monthlyTarget, backgroundColor: rgba(C_GOLD,0.35), borderColor: C_GOLD, borderWidth:1, borderRadius:4, borderDash:[4,2] },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: {
            x: { grid:{ display:false }, ticks:{ color:'#4D6A85' } },
            y: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85', callback: v=>`$${v}M` } }
          },
          plugins: { legend:{ display:true, position:'top', labels:{ color:'#8BA8C4', boxWidth:12 } } }
        }
      });
    }

    // Bids table
    const tbody = document.getElementById('sales-bids-tbody');
    if (tbody) {
      tbody.innerHTML = d.bids.map(b => `
        <tr>
          <td><strong style="color:var(--secondary)">${b.bidNum}</strong></td>
          <td style="color:var(--text-primary)">${b.customer}</td>
          <td>${b.productLine}</td>
          <td style="color:var(--text-primary);font-weight:700">${b.value}</td>
          <td>${statusBadge(b.status)}</td>
          <td>${b.rep}</td>
          <td>${b.due}</td>
        </tr>
      `).join('');
    }
  }
}

// ---- MARKETING ---- (NOW WITH FIREBASE)
async function renderMarketing() {
  const d = DEMO.marketing;
  
  try {
    if (!db) throw new Error('Firebase not initialized');
    const { doc, getDoc } = await import('./firebase-init.js');

    // Load Marketing KPIs
    const kpiSnap = await getDoc(doc(db, 'marketing_kpis', 'current'));
    if (kpiSnap.exists()) {
      const kpis = kpiSnap.data();
      setText('mkt-sessions',    kpis.sessions || '0');
      setText('mkt-leads',       kpis.leads || 0);
      setText('mkt-email-rate',  kpis.emailOpenRate || '0%');
      setText('mkt-conversion',  kpis.conversion || '0%');

      // Lead sources bar chart
      destroyChart('mkt-sources');
      const ctx1 = document.getElementById('chart-mkt-sources')?.getContext('2d');
      if (ctx1 && kpis.sources) {
        const labels = Object.keys(kpis.sources);
        const values = Object.values(kpis.sources);
        charts['mkt-sources'] = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: '% of Leads',
              data: values,
              backgroundColor: PALETTE.slice(0, labels.length).map(c => rgba(c, 0.8)),
              borderColor: PALETTE.slice(0, labels.length),
              borderWidth: 1,
              borderRadius: 6,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
              x: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85', callback:v=>`${v}%` } },
              y: { grid:{ display:false }, ticks:{ color:'#8BA8C4' } }
            }
          }
        });
      }

      // Campaign ROI doughnut
      destroyChart('mkt-roi');
      const ctx2 = document.getElementById('chart-mkt-roi')?.getContext('2d');
      if (ctx2 && kpis.roiByType) {
        charts['mkt-roi'] = new Chart(ctx2, {
          type: 'doughnut',
          data: {
            labels: Object.keys(kpis.roiByType),
            datasets: [{
              data: Object.values(kpis.roiByType),
              backgroundColor: PALETTE.slice(0, Object.keys(kpis.roiByType).length).map(c=>rgba(c,0.85)),
              borderColor: PALETTE.slice(0, Object.keys(kpis.roiByType).length),
              borderWidth: 1.5,
              hoverOffset: 8,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '60%',
            plugins: { legend:{ display:true, position:'bottom', labels:{ color:'#8BA8C4', padding:10, boxWidth:12 } } }
          }
        });
      }

      // Traffic line chart
      destroyChart('mkt-traffic');
      const ctx3 = document.getElementById('chart-mkt-traffic')?.getContext('2d');
      if (ctx3 && kpis.traffic) {
        charts['mkt-traffic'] = new Chart(ctx3, {
          type: 'line',
          data: {
            labels: MONTHS,
            datasets: [{
              label: 'Monthly Visitors',
              data: kpis.traffic,
              borderColor: C_BLUE,
              backgroundColor: gradient(ctx3, C_BLUE, C_CYAN),
              borderWidth: 2.5,
              tension: 0.4,
              pointBackgroundColor: C_BLUE,
              pointRadius: 4,
              fill: true,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              x: { grid:{ display:false }, ticks:{ color:'#4D6A85' } },
              y: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85', callback: v => v.toLocaleString() } }
            }
          }
        });
      }
    } else {
      throw new Error('No marketing KPI data found');
    }

  } catch (err) {
    console.warn('Live marketing data failed:', err.message);
    // Fallback to DEMO
    setText('mkt-sessions',    d.sessions);
    setText('mkt-leads',       d.leads);
    setText('mkt-email-rate',  d.emailOpenRate);
    setText('mkt-conversion',  d.conversion);

    // Lead sources polar
    destroyChart('mkt-sources');
    const ctx1 = document.getElementById('chart-mkt-sources')?.getContext('2d');
    if (ctx1) {
      const labels = Object.keys(d.sources);
      const values = Object.values(d.sources);
      charts['mkt-sources'] = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: '% of Leads',
            data: values,
            backgroundColor: PALETTE.slice(0,6).map(c => rgba(c, 0.8)),
            borderColor: PALETTE.slice(0,6),
            borderWidth: 1,
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85', callback:v=>`${v}%` } },
            y: { grid:{ display:false }, ticks:{ color:'#8BA8C4' } }
          }
        }
      });
    }

    // Campaign ROI
    destroyChart('mkt-roi');
    const ctx2 = document.getElementById('chart-mkt-roi')?.getContext('2d');
    if (ctx2) {
      charts['mkt-roi'] = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: Object.keys(d.roiByType),
          datasets: [{
            data: Object.values(d.roiByType),
            backgroundColor: PALETTE.slice(0,5).map(c=>rgba(c,0.85)),
            borderColor: PALETTE.slice(0,5),
            borderWidth: 1.5,
            hoverOffset: 8,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          cutout: '60%',
          plugins: { legend:{ display:true, position:'bottom', labels:{ color:'#8BA8C4', padding:10, boxWidth:12 } } }
        }
      });
    }

    // Traffic line
    destroyChart('mkt-traffic');
    const ctx3 = document.getElementById('chart-mkt-traffic')?.getContext('2d');
    if (ctx3) {
      charts['mkt-traffic'] = new Chart(ctx3, {
        type: 'line',
        data: {
          labels: MONTHS,
          datasets: [{
            label: 'Monthly Visitors',
            data: d.traffic,
            borderColor: C_BLUE,
            backgroundColor: gradient(ctx3, C_BLUE, C_CYAN),
            borderWidth: 2.5,
            tension: 0.4,
            pointBackgroundColor: C_BLUE,
            pointRadius: 4,
            fill: true,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: {
            x: { grid:{ display:false }, ticks:{ color:'#4D6A85' } },
            y: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85', callback: v => v.toLocaleString() } }
          }
        }
      });
    }
  }
}

// ---- SHIPPING ----
async function renderShipping() {
  const d = DEMO.shipping;

  // Charts will be rendered dynamically after fetching Firebase data.


  // ── LIVE FIREBASE DATA ────────────────────────────────────
  const tbody = document.getElementById('shipping-tbody');
  try {
    if (!db) throw new Error('Firebase not initialized');
    const { doc, getDoc, collection, getDocs: _getDocs } = await import('./firebase-init.js');

    let kpis = {};
    const kpiSnap = await getDoc(doc(db, 'shipping_kpis', 'current'));
    if (kpiSnap.exists()) {
      kpis = kpiSnap.data();
      setText('ship-orders',     kpis.openOrders  || 0);
      setText('ship-total',      kpis.totalLines  || 0);
      setText('ship-hold',       kpis.jobsOnHold  || 0);
      setText('ship-withjobs',   kpis.ordersWithJobs || 0);
    }

    // Load Vantage Engineering Schedule (chunks)
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row">⏳ Loading live engineering schedule...</td></tr>`;
      // Read summary first to get the authoritative chunk count
      // This prevents stale old chunks from inflating the row count
      const summarySnap = await getDoc(doc(db, 'shipping_vantage', 'summary'));
      const validChunkCount = summarySnap.exists() ? (summarySnap.data().chunkCount || 0) : null;

      const snap = await _getDocs(collection(db, 'shipping_vantage'));
      let allRows = [];
      snap.forEach(docSnap => {
        if (docSnap.id.startsWith('chunk_')) {
          const chunkData = docSnap.data();
          // Only include chunks within the current valid range
          if (validChunkCount === null || chunkData.chunkIndex < validChunkCount) {
            allRows = allRows.concat(chunkData.data || []);
          }
        }
      });

      if (allRows.length > 0) {
        // Update the table header count
        const countSpan = document.getElementById('ship-table-count');
        if (countSpan) countSpan.textContent = `— ${allRows.length.toLocaleString()} orders`;
        // --- DYNAMIC CHARTS ---
        const currentYear = new Date().getFullYear();
        const monthNames = kpis.shipmentsByMonth ? kpis.shipmentsByMonth.map(r => r.MonthName.substring(0, 3)) : [];
        const monthCounts = kpis.shipmentsByMonth ? kpis.shipmentsByMonth.map(r => r.TotalShipments) : [];

        destroyChart('ship-region');
        const ctx1 = document.getElementById('chart-ship-region')?.getContext('2d');
        if (ctx1) {
          charts['ship-region'] = new Chart(ctx1, {
            type: 'bar',
            data: {
              labels: monthNames,
              datasets: [{
                label: 'Shipments (Last Year)',
                data: monthCounts,
                backgroundColor: 'rgba(41,170,226,0.8)',
                borderColor: '#29AAE2',
                borderWidth: 1, borderRadius: 6,
              }]
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              scales: {
                x: { grid:{ display:false }, ticks:{ color:'#4D6A85' } },
                y: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85' } }
              }
            }
          });
        }

        destroyChart('ship-methods');
        const ctx2 = document.getElementById('chart-ship-methods')?.getContext('2d');
        if (ctx2) {
          charts['ship-methods'] = new Chart(ctx2, {
            type: 'doughnut',
            data: {
              labels: ['Jobs On Hold', 'With Job(s) Released to Shop'],
              datasets: [{
                data: [kpis.jobsOnHold || 0, kpis.ordersWithJobs || 0],
                backgroundColor: [rgba(C_CYAN,0.85), rgba(C_BLUE,0.85)],
                borderColor: [C_CYAN, C_BLUE],
                borderWidth: 1.5, hoverOffset: 8,
              }]
            },
            options: {
              responsive: true, maintainAspectRatio: false, cutout: '65%',
              plugins: { legend:{ display:true, position:'bottom', labels:{ color:'#8BA8C4', padding:10, boxWidth:12 } } }
            }
          });
        }

        const getSortTime = (v) => {
          if (!v) return Infinity;
          return v.seconds ? v.seconds * 1000 : new Date(v).getTime();
        };

        const parseBit = (v) => {
          if (v === null || v === undefined) return false;
          if (typeof v === 'boolean') return v;
          if (v === 1 || v === '1') return true;
          if (v === 0 || v === '0') return false;
          if (v && v.type === 'Buffer' && v.data) return v.data[0] === 1;
          return !!v;
        };

        // Sort: Open orders (JobClosed=0) first, sorted by ReqDueDate ascending;
        // then Closed orders (JobClosed=1) sorted by ShipDate descending.
        allRows.sort((a, b) => {
          const closedA = parseBit(a.OrderStatus) ? 1 : 0; // 1=Closed, 0=Open
          const closedB = parseBit(b.OrderStatus) ? 1 : 0;
          if (closedA !== closedB) return closedA - closedB; // Open (0) first
          if (closedA === 0) {
            // Both open: sort by ReqDueDate ascending (most urgent first)
            return getSortTime(a.ReqDueDate) - getSortTime(b.ReqDueDate);
          } else {
            // Both closed: sort by ShipDate descending (most recent first)
            return getSortTime(b.ShipDate) - getSortTime(a.ShipDate);
          }
        });

        let currentFilter = 'all';

        const renderTable = () => {
          const searchInput = document.getElementById('shipping-search');
          if (searchInput && searchInput.value) searchInput.value = '';

          let filteredRows = allRows;
          if (currentFilter === 'open') {
             filteredRows = allRows.filter(r => !parseBit(r.OrderStatus));
          } else if (currentFilter === 'hold') {
             filteredRows = allRows.filter(r => r.isOnHold === true);
          } else if (currentFilter === 'withjobs') {
             filteredRows = allRows.filter(r => r.isReleasedToShop === true);
          }
          
          const limitRows = filteredRows.slice(0, 500);

          if (limitRows.length > 0) {
            const colDef = [
              { label: 'STATUS', key: 'OrderStatus', style: 'white-space:nowrap;', render: (val) => {
                const isClosed = parseBit(val);
                // JobClosed=1 → Closed (green badge)  |  JobClosed=0 → Open (yellow badge)
                return `<span class="badge ${isClosed ? 'badge-green' : 'badge-yellow'}">${isClosed ? 'Closed' : 'Open'}</span>`;
              }},
              { label: 'OrderNum', key: 'OrderNum', style: 'white-space:nowrap;', render: (val) => `<strong style="color:var(--secondary)">${val}</strong>` },
              { label: 'JOB', key: 'JobNum', style: 'white-space:nowrap; font-size:0.85rem;' },
              { label: 'ProjectID', key: 'ProjectID', style: 'white-space:nowrap; font-size:0.85rem;' },
              { label: 'Company', key: 'ProjName', style: 'white-space:nowrap; font-size:0.85rem;' },
              { label: 'ShipDate', key: 'ShipDate', style: 'white-space:nowrap;', render: (val) => val ? new Date(val).toLocaleDateString() : '' },
              { label: 'REQDATE', key: 'ReqDueDate', style: 'white-space:nowrap; font-weight:600;', render: (val, r) => `<span style="color:${!parseBit(r.OrderStatus) && new Date(val) < new Date() ? 'var(--status-yellow)' : 'var(--text-primary)'}">${val ? new Date(val).toLocaleDateString() : ''}</span>` }
            ];
            
            const thead = document.querySelector('#shipping-table thead');
            if (thead) {
              thead.innerHTML = `<tr>${colDef.map(c => `<th scope="col" style="${c.style || ''}">${c.label}</th>`).join('')}</tr>`;
            }

            tbody.innerHTML = limitRows.map(r => {
              const cells = colDef.map(c => {
                let val = r[c.key];
                if (val && typeof val === 'object' && val.seconds) {
                  val = new Date(val.seconds * 1000).toLocaleDateString();
                } else if (val && typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
                  val = new Date(val).toLocaleDateString();
                }
                if (val === null || val === undefined) val = '';
                if (c.render) return `<td style="${c.style || ''}">${c.render(val, r)}</td>`;
                return `<td style="${c.style || ''}">${val}</td>`;
              }).join('');
              
              return `<tr>${cells}</tr>`;
            }).join('');
          } else {
            tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No records match this filter.</td></tr>';
          }

          // Update the title count to reflect current filter
          const countSpan = document.getElementById('ship-table-count');
          if (countSpan) {
            const label = currentFilter === 'all'
              ? `— ${filteredRows.length.toLocaleString()} orders`
              : `— ${filteredRows.length.toLocaleString()} of ${allRows.length.toLocaleString()} orders`;
            countSpan.textContent = label;
          }
        };

        const kpiOpen = document.getElementById('kpi-open-orders');
        const kpiHold = document.getElementById('kpi-jobs-on-hold');
        const kpiWithJobs = document.getElementById('kpi-with-jobs');

        const resetKpis = () => {
           [kpiOpen, kpiHold, kpiWithJobs].forEach(el => {
             if (el) el.style.borderColor = 'var(--border)';
           });
        };

        if (kpiOpen) {
           kpiOpen.onclick = () => {
             currentFilter = currentFilter === 'open' ? 'all' : 'open';
             resetKpis();
             if (currentFilter === 'open') kpiOpen.style.borderColor = 'var(--secondary)';
             renderTable();
           };
        }
        if (kpiHold) {
           kpiHold.onclick = () => {
             currentFilter = currentFilter === 'hold' ? 'all' : 'hold';
             resetKpis();
             if (currentFilter === 'hold') kpiHold.style.borderColor = 'var(--status-yellow)';
             renderTable();
           };
        }
        if (kpiWithJobs) {
           kpiWithJobs.onclick = () => {
             currentFilter = currentFilter === 'withjobs' ? 'all' : 'withjobs';
             resetKpis();
             if (currentFilter === 'withjobs') kpiWithJobs.style.borderColor = 'var(--primary)';
             renderTable();
           };
        }

        renderTable();

          // Search logic — hide/show rows and update count live
          const searchInput = document.getElementById('shipping-search');
          if (searchInput) {
             searchInput.addEventListener('input', (e) => {
               const term = e.target.value.toLowerCase();
               const rows = tbody.querySelectorAll('tr');
               let visibleCount = 0;
               rows.forEach(row => {
                 const matches = row.textContent.toLowerCase().includes(term);
                 row.style.display = matches ? '' : 'none';
                 if (matches) visibleCount++;
               });
               // Update count span to reflect search results
               const countSpan = document.getElementById('ship-table-count');
               if (countSpan) {
                 if (term) {
                   countSpan.textContent = `— ${visibleCount.toLocaleString()} matching`;
                 } else {
                   // Restore filter count when search cleared
                   const base = currentFilter === 'all' ? allRows : (tbody._filteredRows || allRows);
                   countSpan.textContent = `— ${allRows.length.toLocaleString()} orders`;
                   renderTable(); // re-run to restore proper count
                 }
               }
             });
          }
        } else {
          throw new Error('No Vantage rows found');
        }
      }

  } catch (err) {
    console.warn('Live shipping data failed:', err.message);
    // Fallback to DEMO
    setText('ship-orders',     d.ordersShipped);
    setText('ship-ontime',     d.onTime);
    setText('ship-transit',    d.inTransit);
    setText('ship-exceptions', d.exceptions);

    if (tbody) {
      tbody.innerHTML = d.records.map(r => `
        <tr>
          <td><strong style="color:var(--secondary)">${r.order}</strong></td>
          <td style="color:var(--text-primary)">${r.customer}</td>
          <td>${r.dest}</td>
          <td>${r.carrier}</td>
          <td>${r.ship}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${r.weight}</td>
        </tr>
      `).join('');
    }
  }
}

// ---- HR ----
async function renderHR() {
  const d = DEMO.hr;
  
  try {
    if (!db) throw new Error('Firebase not initialized');
    const { doc, getDoc } = await import('./firebase-init.js');
    const kpiSnap = await getDoc(doc(db, 'hr_kpis', 'current'));
    
    if (kpiSnap.exists()) {
      const kpis = kpiSnap.data();
      setText('hr-total',    kpis.totalEmployees || 0);
      setText('hr-newhires', kpis.newHires || 0);

      setText('hr-openpos',  kpis.openPos || 0);
      setText('hr-tenure',   (kpis.avgTenure || 0) + ' yrs');


      // By dept
      destroyChart('hr-dept');
      const ctx1 = document.getElementById('chart-hr-dept')?.getContext('2d');
      if (ctx1 && kpis.byDept) {
        // Remove stale 'Unknown' data that was merged by Firestore
        delete kpis.byDept['Unknown'];
        
        // Sort departments by count descending
        const sortedDepts = Object.entries(kpis.byDept)
          .sort((a,b) => b[1] - a[1]);
        charts['hr-dept'] = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels: sortedDepts.map(x => x[0]),
            datasets: [{
              label: 'Employees',
              data: sortedDepts.map(x => x[1]),
              backgroundColor: sortedDepts.map((_, i) => rgba(PALETTE[i % PALETTE.length], 0.8)),
              borderColor: sortedDepts.map((_, i) => PALETTE[i % PALETTE.length]),
              borderWidth: 1, borderRadius: 6,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
              x: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85' } },
              y: { grid:{ display:false }, ticks:{ color:'#8BA8C4', font:{ size: 10 } } }
            }
          }
        });
      }

      // Tenure pie
      destroyChart('hr-tenure');
      const ctx2 = document.getElementById('chart-hr-tenure')?.getContext('2d');
      if (ctx2 && kpis.tenureBuckets) {
        charts['hr-tenure'] = new Chart(ctx2, {
          type: 'doughnut',
          data: {
            labels: Object.keys(kpis.tenureBuckets),
            datasets: [{
              data: Object.values(kpis.tenureBuckets),
              backgroundColor: PALETTE.slice(0,6).map(c=>rgba(c,0.85)),
              borderColor: PALETTE.slice(0,6),
              borderWidth: 1.5, hoverOffset: 8,
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: { legend:{ display:true, position:'bottom', labels:{ color:'#8BA8C4', padding:10, boxWidth:12, font:{ size:11 } } } }
          }
        });
      }
    } else {
      throw new Error('No HR KPI data found');
    }
  } catch (err) {
    console.warn('Live HR data failed:', err.message);
    // Fallback to DEMO
    setText('hr-total',    d.total);
    setText('hr-newhires', d.newHires);

    setText('hr-openpos',  d.openPos);
    setText('hr-tenure',   d.tenure);


    // By dept
    destroyChart('hr-dept');
    const ctx1 = document.getElementById('chart-hr-dept')?.getContext('2d');
    if (ctx1) {
      charts['hr-dept'] = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: Object.keys(d.byDept),
          datasets: [{
            label: 'Employees',
            data: Object.values(d.byDept),
            backgroundColor: Object.keys(d.byDept).map((_, i) => rgba(PALETTE[i % PALETTE.length], 0.8)),
            borderColor: Object.keys(d.byDept).map((_, i) => PALETTE[i % PALETTE.length]),
            borderWidth: 1, borderRadius: 6,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          scales: {
            x: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85' } },
            y: { grid:{ display:false }, ticks:{ color:'#8BA8C4' } }
          }
        }
      });
    }

    // Tenure pie
    destroyChart('hr-tenure');
    const ctx2 = document.getElementById('chart-hr-tenure')?.getContext('2d');
    if (ctx2) {
      charts['hr-tenure'] = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: d.tenureBuckets,
          datasets: [{
            data: d.tenureCounts,
            backgroundColor: PALETTE.slice(0,6).map(c=>rgba(c,0.85)),
            borderColor: PALETTE.slice(0,6),
            borderWidth: 1.5, hoverOffset: 8,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '60%',
          plugins: { legend:{ display:true, position:'bottom', labels:{ color:'#8BA8C4', padding:10, boxWidth:12, font:{ size:11 } } } }
        }
      });
    }
  }

  // Hiring/attrition (Keep Demo)
  destroyChart('hr-trend');
  const ctx3 = document.getElementById('chart-hr-trend')?.getContext('2d');
  if (ctx3) {
    charts['hr-trend'] = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: MONTHS,
        datasets: [
          { label:'New Hires', data:d.hiringMonths,   backgroundColor:rgba(C_GREEN,0.75), borderColor:C_GREEN, borderWidth:1, borderRadius:4 },
          { label:'Attrition', data:d.attritionMonths, backgroundColor:rgba(C_RED,0.65),   borderColor:C_RED,   borderWidth:1, borderRadius:4 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid:{ display:false }, ticks:{ color:'#4D6A85' } },
          y: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85' } }
        },
        plugins: { legend:{ display:true, position:'top', labels:{ color:'#8BA8C4', boxWidth:12 } } }
      }
    });
  }
}

// ---- COMPETITION ----
// Helper: format a date string as relative time (e.g. "2d ago", "3h ago")
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function renderCompetition() {

  // ── LIVE FIREBASE DATA ────────────────────────────────────
  const grid = document.querySelector('.competitor-cards-grid');
  if (!grid) return;

  // Show loading state
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--secondary);padding:40px 0;">
    <div style="font-size:1.5rem;margin-bottom:8px;">⏳</div>Loading live competitor data from Firebase…</div>`;

  try {
    if (!db) throw new Error('Firebase not initialized');

    const { collection, getDocs: _getDocs } = await import('./firebase-init.js');
    const snap = await _getDocs(collection(db, 'competition_intel'));

    const comps = [];
    let indexDoc = null;
    snap.forEach(docSnap => {
      if (docSnap.id === '_index') { indexDoc = docSnap.data(); }
      else comps.push(docSnap.data());
    });

    // Sort: public (with stock) first, then private alphabetically
    comps.sort((a, b) => {
      if (a.isPublic !== b.isPublic) return a.isPublic ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Use industry news from _index doc (populated by sync), fallback to first competitor
    const industryNews = indexDoc?.newsHeadlines?.length
      ? indexDoc.newsHeadlines
      : comps.find(c => c.news?.length)?.news || [];

    // Render industry news strip if headlines exist
    const newsEl = document.getElementById('comp-news-strip');
    if (newsEl && industryNews.length) {
      newsEl.innerHTML = industryNews.slice(0, 5).map(n => {
        const ago = timeAgo(n.pubDate);
        return `
        <a href="${n.link}" target="_blank" rel="noopener" class="news-pill" title="${n.source}${ago ? ' · ' + ago : ''}">
          <span class="news-pill-dot"></span>
          <span>${n.title.length > 80 ? n.title.slice(0, 80) + '…' : n.title}</span>
          <span class="news-pill-source">${ago || n.source || ''}</span>
        </a>
      `;
      }).join('');
      newsEl.style.display = 'flex';
    }

    // Render live competitor cards
    grid.innerHTML = comps.map(c => {
      const isUp   = c.stock?.changePct >= 0;
      const arrow  = c.stock ? (isUp ? '▲' : '▼') : '';
      const color  = c.stock ? (isUp ? 'var(--status-green)' : 'var(--status-red)') : 'var(--secondary)';
      const capStr = c.profile?.marketCapM
        ? (c.profile.marketCapM >= 1000
            ? `$${(c.profile.marketCapM / 1000).toFixed(1)}B`
            : `$${c.profile.marketCapM}M`)
        : null;

      const stockBlock = c.isPublic ? `
        <div class="comp-stock-row">
          ${c.stock ? `
            <span class="comp-stock-price">$${c.stock.price.toFixed(2)}</span>
            <span class="comp-stock-change" style="color:${color}">${arrow} ${Math.abs(c.stock.changePct).toFixed(2)}%</span>
            <span class="comp-stock-ticker">${c.ticker} · ${c.exchange}</span>
          ` : `<span class="comp-stock-ticker" style="color:var(--secondary)">${c.ticker} · Market closed</span>`}
        </div>
        ${capStr ? `<div class="comp-market-cap">Market Cap: <strong>${capStr}</strong>${c.profile?.employees ? ` · ${(c.profile.employees/1000).toFixed(1)}K employees` : ''}</div>` : ''}
      ` : `
        <div class="comp-private-badge">🔒 Private Company</div>
        ${c.note ? `<div class="comp-note">${c.note}</div>` : ''}
      `;

      const latestNews = c.news?.[0];
      const newsAgo = latestNews ? timeAgo(latestNews.pubDate) : '';
      const newsBlock = latestNews ? `
        <div class="comp-latest-news">
          <span class="comp-news-label">Latest${newsAgo ? ` · ${newsAgo}` : ''}</span>
          <a href="${latestNews.link}" target="_blank" rel="noopener" class="comp-news-link">
            ${latestNews.title.length > 70 ? latestNews.title.slice(0, 70) + '…' : latestNews.title}
          </a>
          ${latestNews.source ? `<span class="comp-news-source">${latestNews.source}</span>` : ''}
        </div>
      ` : '';

      return `
        <div class="competitor-card${c.isPublic ? ' comp-public' : ' comp-private'}">
          <div class="comp-header">
            ${c.profile?.logo ? `<img src="${c.profile.logo}" class="comp-logo" alt="${c.name}" onerror="this.style.display='none'"/>` : ''}
            <div>
              <div class="comp-name">${c.name}</div>
              <div class="comp-niche">${c.niche}</div>
            </div>
          </div>
          ${stockBlock}
          <div class="comp-website"><a href="https://${c.website}" target="_blank" rel="noopener">🌐 ${c.website}</a></div>
          ${newsBlock}
        </div>
      `;
    }).join('');

  } catch (err) {
    console.warn('Live competition data failed:', err.message);
    const d = DEMO.competition;
    // Graceful fallback to DEMO competitor cards
    grid.innerHTML = d.competitors.map(c => `
      <div class="competitor-card">
        <div class="comp-name">${c.name}</div>
        <div class="comp-niche">${c.niche}</div>
        <div class="comp-stats">
          <div class="comp-stat-row">
            <span class="comp-stat-label">Win Rate vs Them</span>
            <span class="comp-stat-val" style="color:${c.winRate >= 60 ? 'var(--status-green)' : c.winRate >= 50 ? 'var(--accent-gold)' : 'var(--status-red)'}">${c.winRate}%</span>
          </div>
          <div class="comp-win-bar"><div class="comp-win-fill" style="width:${c.winRate}%"></div></div>
          <div class="comp-stat-row">
            <span class="comp-stat-label">Head-to-Head Bids</span>
            <span class="comp-stat-val">${c.dealCount}</span>
          </div>
          <div class="comp-stat-row">
            <span class="comp-stat-label">Avg Deal Value</span>
            <span class="comp-stat-val">${c.avgValue}</span>
          </div>
        </div>
      </div>
    `).join('');
  }
}

// ============================================================
// HELPERS
// ============================================================
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function statusBadge(status) {
  const map = {
    'Won':       'badge-green',
    'Delivered': 'badge-green',
    'Active':    'badge-green',
    'In Progress':'badge-blue',
    'In Transit':'badge-blue',
    'Pending':   'badge-yellow',
    'Planning':  'badge-yellow',
    'Testing':   'badge-yellow',
    'Held':      'badge-yellow',
    'Lost':      'badge-red',
    'Exception': 'badge-red',
    'Cancelled': 'badge-red',
  };
  const cls = map[status] || 'badge-gray';
  return `<span class="badge ${cls}">${status}</span>`;
}

function priorityBadge(p) {
  const map = { 'Critical':'badge-red', 'High':'badge-yellow', 'Medium':'badge-blue', 'Low':'badge-gray' };
  return `<span class="badge ${map[p]||'badge-gray'}">${p}</span>`;
}

// ============================================================
// LAST SYNC BADGE — reads meta/lastSync from Firestore
// ============================================================
async function fetchLastSync() {
  const label = document.getElementById('last-sync-label');
  if (!label) return;

  try {
    // Attempt to read from Firestore (requires firebase-init.js to be configured)
    const { db, doc, getDoc } = await import('./firebase-init.js');
    if (!db) throw new Error('Firestore not initialized');

    const snap = await getDoc(doc(db, 'meta', 'lastSync'));
    if (!snap.exists()) {
      label.textContent = 'No sync yet';
      return;
    }

    const data      = snap.data();
    const syncTime  = data.timestamp?.toDate?.() || new Date(data.timestampISO);
    const diffMs    = Date.now() - syncTime.getTime();
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    let ago;
    if (diffMins < 1)       ago = 'just now';
    else if (diffMins < 60) ago = `${diffMins}m ago`;
    else if (diffHours < 24) ago = `${diffHours}h ago`;
    else                     ago = syncTime.toLocaleDateString();

    const timeStr = syncTime.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
    label.textContent = `Refreshed ${ago} (${timeStr})`;
    label.title       = `Last full sync: ${syncTime.toLocaleString()} from ${data.server || 'sync server'}`;

  } catch (err) {
    // Firebase not configured or unreachable — show demo mode
    label.textContent = 'Demo data (no sync)';
    label.title       = 'Connect Firebase to show live last-refreshed time';
    console.info('[OptiAqua] Running in demo mode — ', err.message);
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  initNavigation();
  loadSectionData('overview');
  fetchLastSync();

  // Refresh the sync badge every 5 minutes
  setInterval(fetchLastSync, 5 * 60 * 1000);
});
