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
  overview: { bids: '—', bids_delta: 'Active pipeline', revenue: '—', revenue_delta: 'YTD', shipments: '—', shipments_delta: 'Orders shipped', headcount: '—', headcount_delta: 'Active headcount', tickets: '—', tickets_delta: 'No Data', winrate: '—', winrate_delta: 'Win rate YTD' },
  sales: { totalBids: '—', won: '—', pending: '—', lost: '—', backlog: '—', bids: [], productLines: [], productOrders: [], monthlyActual: [], monthlyTarget: [] },
  marketing: { sessions: '—', leads: '—', emailOpenRate: '—', conversion: '—', sources: {}, roiByType: {}, traffic: [] },
  shipping: { ordersShipped: '—', onTime: '—', inTransit: '—', exceptions: '—', byRegion: {}, methods: {}, records: [] },
  hr: { total: '—', newHires: '—', turnover: '—', openPos: '—', tenure: '—', training: '—', byDept: {}, tenureBuckets: [], tenureCounts: [], hiringMonths: [], attritionMonths: [] },
  it: { open: '—', resolved: '—', resolution: '—', activeProjects: '—', categories: {}, projectStatus: {}, projects: [], apps: [] },
  competition: { position: '—', winRate: '—', bids: '—', marketShare: '—', competitors: [], winLossLabels: [], wins: [], losses: [], marketShareData: {}, trendMonths: [], aquaWins: [], compWins: [] },
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
// LOADING ANIMATION HELPERS
// ============================================================
const WAVE_HTML = `
  <div class="loader-wave">
    <span></span><span></span><span></span><span></span>
    <span></span><span></span><span></span>
  </div>
  <div class="section-loader-text">Loading data…</div>
`;

const LOADER_MIN_MS = 2000;   // minimum time the wave animation shows
const loaderStartTimes = {};  // sectionId → performance.now() at showLoader

function showLoader(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.style.position = 'relative';
  hideLoaderNow(sectionId);
  const el = document.createElement('div');
  el.className = 'section-loader';
  el.id = `loader-${sectionId}`;
  el.innerHTML = WAVE_HTML;
  section.appendChild(el);
  loaderStartTimes[sectionId] = performance.now();

  // Apply skeleton shimmer to all KPI values in this section
  section.querySelectorAll('.kpi-value').forEach(v => v.classList.add('kpi-loading'));
}

function hideLoader(sectionId) {
  const elapsed = performance.now() - (loaderStartTimes[sectionId] || 0);
  const remaining = Math.max(0, LOADER_MIN_MS - elapsed);

  const doHide = () => {
    const el = document.getElementById(`loader-${sectionId}`);
    if (!el) return;
    el.classList.add('hiding');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    const section = document.getElementById(sectionId);
    if (section) section.querySelectorAll('.kpi-value').forEach(v => v.classList.remove('kpi-loading'));
    delete loaderStartTimes[sectionId];
  };

  if (remaining > 0) {
    setTimeout(doHide, remaining);
  } else {
    doHide();
  }
}

function hideLoaderNow(sectionId) {
  document.getElementById(`loader-${sectionId}`)?.remove();
}

// Animated bouncing dots for table loading rows
function loadingDots(msg = 'Loading live data') {
  return `<div class="loader-dots" aria-label="${msg}">
    <span></span><span></span><span></span>
  </div>`;
}

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
    case 'fieldservice': renderFieldService(); break;
    case 'hr':         renderHR();         break;
    case 'competition':renderCompetition();break;
    case 'inventory':  renderInventory();  break;
    case 'production': renderProduction(); break;
  }
}

// ---- OVERVIEW ----
async function renderOverview() {
  showLoader('section-overview');
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
  let deptLabels = ['Sales','Marketing','Shipping','HR','IT','Finance'];
  let deptData = [0, 0, 0, 0, 0, 0];
  let revActual = DEMO.sales.monthlyActual;
  let revTarget = DEMO.sales.monthlyTarget;

  try {
    if (db) {
      const { doc, getDoc } = await import('./firebase-init.js');
      // Fetch live HR KPI
      const hrDoc = await getDoc(doc(db, 'hr_kpis', 'current'));

      if (hrDoc.exists()) {
        const hrData = hrDoc.data();
        setText('kpi-headcount', hrData.totalEmployees);
        setText('kpi-headcount-delta', `+${hrData.newHires} YTD`);
        
        if (hrData.byDept) {
            const depts = { ...hrData.byDept };
            delete depts['Unknown'];
            const sortedDepts = Object.entries(depts).sort((a,b) => b[1] - a[1]).slice(0, 6);
            if (sortedDepts.length > 0) {
              deptLabels = sortedDepts.map(x => x[0]);
              deptData = sortedDepts.map(x => x[1]);
            }
        }
      }

      // Fetch live Sales KPI
      const salesYear = new Date().getFullYear().toString();
      const salesDoc = await getDoc(doc(db, 'sales_kpis', salesYear));

      if (salesDoc.exists()) {
        const salesData = salesDoc.data();
        setText('kpi-bids', salesData.totalBids || '0');
        setText('kpi-bids-delta', 'Active pipeline');
        setText('kpi-revenue', salesData.backlog || '$0');
        setText('kpi-revenue-delta', 'Backlog value');
        if (salesData.totalBids && salesData.won) {
            const winrate = Math.round((salesData.won / salesData.totalBids) * 100);
            setText('kpi-winrate', `${winrate}%`);
            setText('kpi-winrate-delta', 'Win rate YTD');
        }
        if (salesData.monthlyActual) revActual = salesData.monthlyActual;
        if (salesData.monthlyTarget) revTarget = salesData.monthlyTarget;
      }

      // Fetch live Shipping KPI
      const shippingDoc = await getDoc(doc(db, 'shipping_kpis', 'current'));
      if (shippingDoc.exists()) {
        const shippingData = shippingDoc.data();
        setText('kpi-shipments', shippingData.shipmentsThisMonth ?? shippingData.totalLines ?? '0');
        const now = new Date();
        setText('kpi-shipments-delta', `${now.toLocaleString('default',{month:'long'})} orders`);
      }

      // Fetch live IT KPI
      const itDoc = await getDoc(doc(db, 'it_kpis', 'current'));
      if (itDoc.exists()) {
        const itData = itDoc.data();
        setText('kpi-tickets', itData.open || '0');
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
            data: revActual,
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
            data: revTarget,
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
        labels: deptLabels,
        datasets: [{
          label: 'Activity Score',
          data: deptData,
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
  hideLoader('section-overview');
}

async function renderSales() {
  showLoader('section-sales');
  const d = DEMO.sales;
  
  try {
    if (!db) throw new Error('Firebase not initialized');
    const { doc, getDoc, collection, getDocs: _getDocs } = await import('./firebase-init.js');

    const yearSelect = document.getElementById('sales-year-filter');
    const selectedYear = yearSelect ? yearSelect.value : new Date().getFullYear().toString();

    // Load Sales KPIs
    const kpiSnap = await getDoc(doc(db, 'sales_kpis', selectedYear));
    if (kpiSnap.exists()) {
      const kpis = kpiSnap.data();
      setText('sales-total-bids', kpis.totalBids || 0);
      setText('sales-won',        kpis.won || 0);
      setText('sales-won-value',  kpis.wonValue || '—');
      setText('sales-pending',    kpis.pending || 0);
      setText('sales-backlog',    kpis.backlog || '$0');
      setText('sales-bids-delta', `${selectedYear} YTD`);
      setText('sales-won-value-delta', `${selectedYear} YTD`);

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
          }
        });
      }

      // Pending Pipeline by Target Category
      destroyChart('sales-categories');
      const ctxCat = document.getElementById('chart-sales-categories')?.getContext('2d');
      if (ctxCat && kpis.pipelineCategories) {
        const catLabels = Object.keys(kpis.pipelineCategories);
        const catData = Object.values(kpis.pipelineCategories).map(val => val / 1000000); // Convert to millions

        charts['sales-categories'] = new Chart(ctxCat, {
          type: 'bar',
          data: {
            labels: catLabels,
            datasets: [{
              label: 'Pipeline Value ($M)',
              data: catData,
              backgroundColor: PALETTE.slice(2, catLabels.length + 2).map(c => rgba(c, 0.75)),
              borderColor: PALETTE.slice(2, catLabels.length + 2),
              borderWidth: 1,
              borderRadius: 4
            }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              x: { grid:{ display:false }, ticks:{ color:'#4D6A85' } },
              y: { grid:{ color:'rgba(41,170,226,0.07)' }, ticks:{ color:'#4D6A85', callback: v=>`$${v}M` } }
            },
            plugins: { legend:{ display:false } }
          }
        });
      }

      // Load recent bids from Firebase
      try {
        const tbody = document.getElementById('sales-bids-tbody');
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="7" class="loading-row">${loadingDots('Loading sales bids')}</td></tr>`;
          
          const summarySnap = await getDoc(doc(db, 'sales_bids', 'summary'));
          const validChunkCount = summarySnap.exists() ? (summarySnap.data().chunkCount || 0) : null;

          const snap = await _getDocs(collection(db, 'sales_bids'));
          let allBids = [];
          snap.forEach(docSnap => {
            if (docSnap.id.startsWith('chunk_')) {
              const chunkData = docSnap.data();
              if (validChunkCount === null || chunkData.chunkIndex < validChunkCount) {
                allBids = allBids.concat(chunkData.data || []);
              }
            }
          });

          if (allBids.length > 0) {
            allBids = allBids.filter(b => b.year === selectedYear);

            allBids.sort((a, b) => {
              const dateA = a.due ? new Date(a.due).getTime() : 0;
              const dateB = b.due ? new Date(b.due).getTime() : 0;
              return dateB - dateA;
            });

            // Calculate Won Sales Value from the bid data directly
            const parseVal = (str) => {
              if (!str) return 0;
              const s = String(str).replace(/[$,\s]/g, '');
              if (s.endsWith('M')) return parseFloat(s) * 1000000;
              if (s.endsWith('K')) return parseFloat(s) * 1000;
              return parseFloat(s) || 0;
            };
            const wonTotal = allBids
              .filter(b => b.status === 'Won')
              .reduce((sum, b) => sum + parseVal(b.value), 0);
            const wonDisplay = wonTotal >= 1000000
              ? `$${(wonTotal / 1000000).toFixed(1)}M`
              : `$${(wonTotal / 1000).toFixed(0)}K`;
            setText('sales-won-value', wonDisplay);
            setText('sales-won-value-delta', `${selectedYear} YTD`);

            const countSpan = document.getElementById('sales-table-count');
            if (countSpan) countSpan.textContent = `— ${allBids.length.toLocaleString()} bids`;

            let currentPage = 0;
            let pageSize = 25;
            let searchTerm = '';
            let currentFilter = 'all';

            const getFilteredBids = () => {
              let rows = allBids;
              if (currentFilter === 'won') {
                rows = rows.filter(r => r.status === 'Won');
              } else if (currentFilter === 'pending') {
                rows = rows.filter(r => r.status === 'PENDING');
              }
              if (searchTerm) {
                rows = rows.filter(r =>
                  Object.values(r).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(searchTerm))
                );
              }
              return rows;
            };

            const renderPagination = (filteredRows) => {
              const paginationEl = document.getElementById('sales-pagination');
              if (!paginationEl) return;
              const isAll = pageSize === Infinity;
              const totalPages = isAll ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
              paginationEl.style.display = 'flex';
              paginationEl.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-secondary)">
                  <label for="sales-page-size" style="white-space:nowrap">Rows per page:</label>
                  <select id="sales-page-size" aria-label="Rows per page" style="padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:0.85rem;">
                  ${(() => {
                      const standard = [25, 50, 75, 100, 500, 1000];
                      const numericOpts = standard.includes(pageSize) || isAll ? standard : [pageSize, ...standard];
                      const opts = numericOpts.map(n =>
                        `<option value="${n}" ${!isAll && n === pageSize ? 'selected' : ''}>${n === pageSize && !standard.includes(pageSize) && !isAll ? `Auto (${n})` : n}</option>`
                      ).join('');
                      return opts + `<option value="all" ${isAll ? 'selected' : ''}>ALL</option>`;
                  })()}
                  </select>
                </div>
                <div style="display:flex;align-items:center;gap:10px;font-size:0.85rem;color:var(--text-secondary)">
                  ${isAll ? `<span>${filteredRows.length.toLocaleString()} rows (all)</span>` : `
                  <button id="sales-page-prev" aria-label="Previous page"
                    style="padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);cursor:pointer;font-size:0.85rem;"
                    ${currentPage === 0 ? 'disabled' : ''}>&#8592; Prev</button>
                  <span>Page ${currentPage + 1} of ${totalPages} &nbsp;(${filteredRows.length.toLocaleString()} rows)</span>
                  <button id="sales-page-next" aria-label="Next page"
                    style="padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);cursor:pointer;font-size:0.85rem;"
                    ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Next &#8594;</button>
                  `}
                </div>
              `;
              document.getElementById('sales-page-size').addEventListener('change', (e) => {
                pageSize = e.target.value === 'all' ? Infinity : parseInt(e.target.value, 10);
                currentPage = 0;
                renderTable();
              });
              if (!isAll) {
                document.getElementById('sales-page-prev').addEventListener('click', () => {
                  if (currentPage > 0) { currentPage--; renderTable(); }
                });
                document.getElementById('sales-page-next').addEventListener('click', () => {
                  if (currentPage < totalPages - 1) { currentPage++; renderTable(); }
                });
              }
            };

            const renderTable = () => {
              const filteredRows = getFilteredBids();
              
              const isAll = pageSize === Infinity;
              const totalPages = isAll ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
              if (!isAll && currentPage >= totalPages) currentPage = totalPages - 1;
              const pageRows = isAll ? filteredRows : filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

              if (pageRows.length > 0) {
                tbody.innerHTML = pageRows.map(b => {
                  let dueDate = b.due;
                  if (dueDate) {
                    dueDate = new Date(dueDate).toLocaleDateString();
                  }
                  return `
                    <tr>
                      <td><strong style="color:var(--secondary)">${b.bidNum || b.id}</strong></td>
                      <td style="color:var(--text-primary)">${b.customer}</td>
                      <td>${b.productLine}</td>
                      <td style="color:var(--text-primary);font-weight:700">${b.value}</td>
                      <td>${statusBadge(b.status)}</td>
                      <td>${b.rep}</td>
                      <td>${dueDate || ''}</td>
                    </tr>
                  `;
                }).join('');
              } else {
                tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No records match this filter.</td></tr>';
              }

              if (countSpan) {
                const label = currentFilter === 'all'
                  ? `— ${filteredRows.length.toLocaleString()} bids`
                  : `— ${filteredRows.length.toLocaleString()} of ${allBids.length.toLocaleString()} bids`;
                countSpan.textContent = label;
              }

              renderPagination(filteredRows);
            };

            const kpiTotal = document.getElementById('kpi-card-sales-total');
            const kpiWon = document.getElementById('kpi-card-sales-won');
            const kpiPending = document.getElementById('kpi-card-sales-pending');
            const kpiBacklog = document.getElementById('kpi-card-sales-backlog');

            const resetSalesKpis = () => {
              [kpiTotal, kpiWon, kpiPending, kpiBacklog].forEach(el => {
                if (el) el.style.borderColor = 'var(--border)';
              });
            };

            if (kpiTotal) {
              kpiTotal.onclick = () => {
                currentFilter = 'all';
                currentPage = 0;
                resetSalesKpis();
                kpiTotal.style.borderColor = 'var(--secondary)';
                renderTable();
              };
            }
            if (kpiWon) {
              kpiWon.onclick = () => {
                currentFilter = currentFilter === 'won' ? 'all' : 'won';
                currentPage = 0;
                resetSalesKpis();
                if (currentFilter === 'won') kpiWon.style.borderColor = 'var(--status-green)';
                renderTable();
              };
            }
            if (kpiPending) {
              kpiPending.onclick = () => {
                currentFilter = currentFilter === 'pending' ? 'all' : 'pending';
                currentPage = 0;
                resetSalesKpis();
                if (currentFilter === 'pending') kpiPending.style.borderColor = 'var(--status-yellow)';
                renderTable();
              };
            }
            if (kpiBacklog) {
              kpiBacklog.onclick = () => {
                currentFilter = currentFilter === 'pending' ? 'all' : 'pending';
                currentPage = 0;
                resetSalesKpis();
                if (currentFilter === 'pending') kpiBacklog.style.borderColor = 'var(--status-yellow)';
                renderTable();
              };
            }

            renderTable();

            requestAnimationFrame(() => {
              const tableScroll = document.querySelector('#section-sales .table-scroll');
              const firstRow = tbody.querySelector('tr');
              const thead = document.querySelector('#sales-bids-table thead');
              if (tableScroll && firstRow && thead) {
                const availableHeight = tableScroll.clientHeight - thead.offsetHeight;
                const rowHeight = firstRow.offsetHeight || 38;
                const fitCount = Math.max(5, Math.floor(availableHeight / rowHeight));
                if (fitCount !== pageSize) {
                  pageSize = fitCount;
                  currentPage = 0;
                  renderTable();
                }
              }
            });

            const searchInput = document.getElementById('sales-search');
            if (searchInput) {
               searchInput.addEventListener('input', (e) => {
                 searchTerm = e.target.value.toLowerCase().trim();
                 currentPage = 0;
                 renderTable();
               });
            }
          } else {
            console.warn('No bids data found in chunks');
            tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No bids data found.</td></tr>';
          }
        }
      } catch(bidErr) {
        console.warn('Bids fetch failed:', bidErr.message);
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
  hideLoader('section-sales');
}

// ---- MARKETING ---- (NOW WITH FIREBASE)
async function renderMarketing() {
  showLoader('section-marketing');
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
  hideLoader('section-marketing');
}

// ---- SHIPPING ----
async function renderShipping() {
  showLoader('section-shipping');
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
      setText('ship-overdue',    kpis.overdueOrders || 0);
      setText('ship-ontime',     (kpis.shippedOnTimeYTD || 0) + '%');
      setText('ship-hold',       kpis.jobsOnHold  || 0);
      setText('ship-withjobs',   kpis.ordersWithJobs || 0);
    }

    // Load Vantage Engineering Schedule (chunks)
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="loading-row">${loadingDots('Loading engineering schedule')}</td></tr>`;
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
        let currentPage = 0;
        let pageSize = 25;
        let searchTerm = '';

        const getFilteredRows = () => {
          let rows = allRows;
          if (currentFilter === 'open') {
            rows = allRows.filter(r => !parseBit(r.OrderStatus));
          } else if (currentFilter === 'hold') {
            rows = allRows.filter(r => r.isOnHold === true);
          } else if (currentFilter === 'withjobs') {
            rows = allRows.filter(r => r.isReleasedToShop === true);
          } else if (currentFilter === 'overdue') {
            const nowTime = Date.now();
            rows = allRows.filter(r => !parseBit(r.OrderStatus) && r.ReqDueDate && getSortTime(r.ReqDueDate) < nowTime);
          } else if (currentFilter === 'ontime') {
            const currentYear = new Date().getFullYear();
            rows = allRows.filter(r => {
              if (!r.ShipDate) return false;
              const shipTime = getSortTime(r.ShipDate);
              if (new Date(shipTime).getFullYear() !== currentYear) return false;
              if (!r.ReqDueDate) return true;
              return shipTime <= getSortTime(r.ReqDueDate);
            });
          }
          if (searchTerm) {
            rows = rows.filter(r =>
              Object.values(r).some(v => v !== null && v !== undefined && String(v).toLowerCase().includes(searchTerm))
            );
          }
          return rows;
        };

        const renderPagination = (filteredRows) => {
          const paginationEl = document.getElementById('ship-pagination');
          if (!paginationEl) return;
          const isAll = pageSize === Infinity;
          const totalPages = isAll ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
          paginationEl.style.display = 'flex';
          paginationEl.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-secondary)">
              <label for="ship-page-size" style="white-space:nowrap">Rows per page:</label>
              <select id="ship-page-size" aria-label="Rows per page" style="padding:3px 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);font-size:0.85rem;">
               ${(() => {
                  const standard = [25, 50, 75, 100, 500, 1000];
                  const numericOpts = standard.includes(pageSize) || isAll ? standard : [pageSize, ...standard];
                  const opts = numericOpts.map(n =>
                    `<option value="${n}" ${!isAll && n === pageSize ? 'selected' : ''}>${n === pageSize && !standard.includes(pageSize) && !isAll ? `Auto (${n})` : n}</option>`
                  ).join('');
                  return opts + `<option value="all" ${isAll ? 'selected' : ''}>ALL</option>`;
               })()}
              </select>
            </div>
            <div style="display:flex;align-items:center;gap:10px;font-size:0.85rem;color:var(--text-secondary)">
              ${isAll ? `<span>${filteredRows.length.toLocaleString()} rows (all)</span>` : `
              <button id="ship-page-prev" aria-label="Previous page"
                style="padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);cursor:pointer;font-size:0.85rem;"
                ${currentPage === 0 ? 'disabled' : ''}>&#8592; Prev</button>
              <span>Page ${currentPage + 1} of ${totalPages} &nbsp;(${filteredRows.length.toLocaleString()} rows)</span>
              <button id="ship-page-next" aria-label="Next page"
                style="padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-primary);cursor:pointer;font-size:0.85rem;"
                ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Next &#8594;</button>
              `}
            </div>
          `;
          document.getElementById('ship-page-size').addEventListener('change', (e) => {
            pageSize = e.target.value === 'all' ? Infinity : parseInt(e.target.value, 10);
            currentPage = 0;
            renderTable();
          });
          if (!isAll) {
            document.getElementById('ship-page-prev').addEventListener('click', () => {
              if (currentPage > 0) { currentPage--; renderTable(); }
            });
            document.getElementById('ship-page-next').addEventListener('click', () => {
              if (currentPage < totalPages - 1) { currentPage++; renderTable(); }
            });
          }
        };

        const renderTable = () => {
          const searchInput = document.getElementById('shipping-search');
          // Don't clear the search input — search drives renderTable now

          const filteredRows = getFilteredRows();
          
          const isAll = pageSize === Infinity;
          const totalPages = isAll ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
          if (!isAll && currentPage >= totalPages) currentPage = totalPages - 1;
          const pageRows = isAll ? filteredRows : filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

          if (pageRows.length > 0) {
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

            tbody.innerHTML = pageRows.map(r => {
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

          renderPagination(filteredRows);
        };

        const kpiOpen = document.getElementById('kpi-open-orders');
        const kpiHold = document.getElementById('kpi-jobs-on-hold');
        const kpiWithJobs = document.getElementById('kpi-with-jobs');
        const kpiOverdue = document.getElementById('kpi-overdue-orders');
        const kpiOntime = document.getElementById('kpi-ontime-orders');

        const resetKpis = () => {
           [kpiOpen, kpiHold, kpiWithJobs, kpiOverdue, kpiOntime].forEach(el => {
             if (el) el.style.borderColor = 'var(--border)';
           });
        };

        if (kpiOpen) {
           kpiOpen.onclick = () => {
             currentFilter = currentFilter === 'open' ? 'all' : 'open';
             currentPage = 0;
             resetKpis();
             if (currentFilter === 'open') kpiOpen.style.borderColor = 'var(--secondary)';
             renderTable();
           };
        }
        if (kpiHold) {
           kpiHold.onclick = () => {
             currentFilter = currentFilter === 'hold' ? 'all' : 'hold';
             currentPage = 0;
             resetKpis();
             if (currentFilter === 'hold') kpiHold.style.borderColor = 'var(--status-yellow)';
             renderTable();
           };
        }
        if (kpiWithJobs) {
           kpiWithJobs.onclick = () => {
             currentFilter = currentFilter === 'withjobs' ? 'all' : 'withjobs';
             currentPage = 0;
             resetKpis();
             if (currentFilter === 'withjobs') kpiWithJobs.style.borderColor = 'var(--primary)';
             renderTable();
           };
        }
        if (kpiOverdue) {
           kpiOverdue.onclick = () => {
             currentFilter = currentFilter === 'overdue' ? 'all' : 'overdue';
             currentPage = 0;
             resetKpis();
             if (currentFilter === 'overdue') kpiOverdue.style.borderColor = 'var(--status-teal)';
             renderTable();
           };
        }
        if (kpiOntime) {
           kpiOntime.onclick = () => {
             currentFilter = currentFilter === 'ontime' ? 'all' : 'ontime';
             currentPage = 0;
             resetKpis();
             if (currentFilter === 'ontime') kpiOntime.style.borderColor = 'var(--status-green)';
             renderTable();
           };
        }

        renderTable();

          // Auto-fit pageSize to table's visible height after first render
          requestAnimationFrame(() => {
            const tableScroll = document.querySelector('#section-shipping .table-scroll');
            const firstRow = tbody.querySelector('tr');
            const thead = document.querySelector('#shipping-table thead');
            if (tableScroll && firstRow && thead) {
              const availableHeight = tableScroll.clientHeight - thead.offsetHeight;
              const rowHeight = firstRow.offsetHeight || 38;
              const fitCount = Math.max(5, Math.floor(availableHeight / rowHeight));
              if (fitCount !== pageSize) {
                pageSize = fitCount;
                currentPage = 0;
                renderTable();
              }
            }
          });

          // Search across ALL rows, then re-render table + pagination
          const searchInput = document.getElementById('shipping-search');
          if (searchInput) {
             searchInput.addEventListener('input', (e) => {
               searchTerm = e.target.value.toLowerCase().trim();
               currentPage = 0;
               renderTable();
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
  hideLoader('section-shipping');
}

// ---- HR ----
// ---- FIELD SERVICE ----
async function renderFieldService() {
  showLoader('section-fieldservice');
  const tbody = document.getElementById('fs-tbody');
  
  try {
    if (!db) throw new Error('Firebase not initialized');
    const { doc, getDoc, collection, getDocs } = await import('./firebase-init.js');

    // Read summary (totalTrips KPI) + all schedule chunks
    const [summarySnap, chunksSnap] = await Promise.all([
      getDoc(doc(db, 'field_service_kpis', 'summary')),
      getDocs(collection(db, 'field_service_schedule')),
    ]);

    if (summarySnap.exists() || !chunksSnap.empty) {
      const totalTrips = summarySnap.exists() ? (summarySnap.data().totalTrips || 0) : 0;
      setText('fs-total-trips', totalTrips);

      // Reassemble chunks (ignore the 'summary' doc if present)
      const chunkDocs = chunksSnap.docs
        .filter(d => d.id !== 'summary')
        .sort((a, b) => {
          const ai = parseInt(a.id.replace('chunk_', ''), 10);
          const bi = parseInt(b.id.replace('chunk_', ''), 10);
          return ai - bi;
        });
      const schedule = chunkDocs.flatMap(d => d.data().data || []);
      
      const searchInput = document.getElementById('fs-search');
      const startDateInput = document.getElementById('fs-start-date');
      const endDateInput = document.getElementById('fs-end-date');
      
      const selects = {
        tech: document.getElementById('fs-tech'),
        equip: document.getElementById('fs-equip'),
        state: document.getElementById('fs-state'),
        triptype: document.getElementById('fs-triptype')
      };

      // Populate dropdowns
      const populateDropdown = (selectEl, field) => {
        if (!selectEl) return;
        const uniqueVals = [...new Set(schedule.map(t => t[field]))].filter(v => v).sort();
        const currentVal = selectEl.value;
        selectEl.innerHTML = '<option value="">ALL</option>' + uniqueVals.map(v => `<option value="${v}">${v}</option>`).join('');
        if (uniqueVals.includes(currentVal)) selectEl.value = currentVal;
      };
      
      populateDropdown(selects.tech, 'EmpName');
      populateDropdown(selects.equip, 'Equip');
      populateDropdown(selects.state, 'State');
      populateDropdown(selects.triptype, 'TripType');

      // Default to Next Sunday
      const now = new Date();
      const nextSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()));
      
      const formatYYYYMMDD = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      if (startDateInput && !startDateInput.value) {
        startDateInput.value = formatYYYYMMDD(nextSunday);
      }
      
      const renderFSTable = () => {
        let filtered = schedule;
        
        // Start date parsing
        let start = nextSunday;
        if (startDateInput && startDateInput.value) {
          const parts = startDateInput.value.split('-');
          start = new Date(parts[0], parts[1] - 1, parts[2]);
        }
        
        // End date parsing
        let end = new Date(start);
        if (endDateInput && endDateInput.value) {
          const parts = endDateInput.value.split('-');
          end = new Date(parts[0], parts[1] - 1, parts[2]);
        } else {
          end.setDate(start.getDate() + 6);
        }
        
        // Ensure start and end include full days
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        
        filtered = filtered.filter(t => {
          if (!t.WeekOf) return false;
          // Parse as local time (not UTC) to avoid timezone offset issues.
          // t.WeekOf is stored as 'YYYY-MM-DD' string; new Date('YYYY-MM-DD') parses UTC
          // which causes off-by-one errors in CDT/CST. Use parts to force local.
          let weekDate;
          if (typeof t.WeekOf === 'string' && t.WeekOf.includes('-')) {
            const [y, mo, d] = t.WeekOf.slice(0, 10).split('-').map(Number);
            weekDate = new Date(y, mo - 1, d);
          } else if (t.WeekOf && t.WeekOf.seconds !== undefined) {
            // Firestore Timestamp fallback (old data)
            weekDate = new Date(t.WeekOf.seconds * 1000);
          } else {
            weekDate = new Date(t.WeekOf);
          }
          if (isNaN(weekDate)) return false;
          return weekDate >= start && weekDate <= end;
        });
        
        // Apply Dropdown Filters
        if (selects.tech && selects.tech.value) filtered = filtered.filter(t => t.EmpName === selects.tech.value);
        if (selects.equip && selects.equip.value) filtered = filtered.filter(t => t.Equip === selects.equip.value);
        if (selects.state && selects.state.value) filtered = filtered.filter(t => t.State === selects.state.value);
        if (selects.triptype && selects.triptype.value) filtered = filtered.filter(t => t.TripType === selects.triptype.value);
        
        const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
        if (term) {
          filtered = filtered.filter(t => 
             Object.values(t).some(v => v && String(v).toLowerCase().includes(term))
          );
        }
        
        setText('fs-total-trips', filtered.length);
        
        if (filtered.length > 0 && tbody) {
          tbody.innerHTML = filtered.map(t => `
            <tr>
              <td><strong style="color:var(--text-primary)">${t.EmpName || ''}</strong></td>
              <td style="color:var(--text-secondary)">${t.WeekOf || ''}</td>
              <td style="color:${t.SUN ? 'var(--status-green)' : 'var(--border)'}">${t.SUN ? 'S' : '-'}</td>
              <td style="color:${t.MON ? 'var(--status-green)' : 'var(--border)'}">${t.MON ? 'M' : '-'}</td>
              <td style="color:${t.TUE ? 'var(--status-green)' : 'var(--border)'}">${t.TUE ? 'T' : '-'}</td>
              <td style="color:${t.WED ? 'var(--status-green)' : 'var(--border)'}">${t.WED ? 'W' : '-'}</td>
              <td style="color:${t.THU ? 'var(--status-green)' : 'var(--border)'}">${t.THU ? 'Th' : '-'}</td>
              <td style="color:${t.FRI ? 'var(--status-green)' : 'var(--border)'}">${t.FRI ? 'F' : '-'}</td>
              <td style="color:${t.SAT ? 'var(--status-green)' : 'var(--border)'}">${t.SAT ? 'Sa' : '-'}</td>
              <td><span class="status-badge" style="background:var(--bg-hover);color:var(--text-primary)">${t.TripType || ''}</span></td>
              <td>
                <div style="font-weight:600;color:var(--secondary)">${t.ProjectID ? '#' + t.ProjectID : ''} ${t.ProjectName || ''} ${t.State ? '(' + t.State + ')' : ''}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${t.Purpose || ''}">${t.Purpose || ''}</div>
              </td>
            </tr>
          `).join('');
        } else if (tbody) {
          tbody.innerHTML = '<tr><td colspan="11" class="loading-row">No field service trips found for current schedule.</td></tr>';
        }
      };
      
      if (searchInput) searchInput.addEventListener('input', renderFSTable);
      if (startDateInput) startDateInput.addEventListener('change', renderFSTable);
      if (endDateInput) endDateInput.addEventListener('change', renderFSTable);
      Object.values(selects).forEach(sel => {
        if (sel) sel.addEventListener('change', renderFSTable);
      });
      
      renderFSTable();
    } else {
      if (tbody) tbody.innerHTML = '<tr><td colspan="11" class="loading-row">Field Service data not available yet. Waiting for sync...</td></tr>';
    }
  } catch (err) {
    console.error('Field Service render failed:', err.message);
    if (tbody) tbody.innerHTML = `<tr><td colspan="11" class="loading-row error-text">Failed to load Field Service schedule: ${err.message}</td></tr>`;
  }
  hideLoader('section-fieldservice');
}

// ---- HR ----
async function renderHR() {
  showLoader('section-hr');
  const d = DEMO.hr;
  let kpis = null;
  
  try {
    if (!db) throw new Error('Firebase not initialized');
    const { doc, getDoc } = await import('./firebase-init.js');
    const kpiSnap = await getDoc(doc(db, 'hr_kpis', 'current'));
    
    if (kpiSnap.exists()) {
      kpis = kpiSnap.data();
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
          { label:'New Hires', data: kpis?.hiringMonths || d.hiringMonths || [0,0,0,0,0,0,0,0,0,0,0,0],   backgroundColor:rgba(C_GREEN,0.75), borderColor:C_GREEN, borderWidth:1, borderRadius:4 },
          { label:'Attrition', data: kpis?.attritionMonths || d.attritionMonths || [0,0,0,0,0,0,0,0,0,0,0,0], backgroundColor:rgba(C_RED,0.65),   borderColor:C_RED,   borderWidth:1, borderRadius:4 },
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
  hideLoader('section-hr');
}

// ---- COMPETITION ----
async function renderCompetition() {
  showLoader('section-competition');

  // ── LIVE FIREBASE DATA ────────────────────────────────────
  const grid = document.querySelector('.competitor-cards-grid');
  if (!grid) return;

  // Show loading state
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 0;">${loadingDots('Loading competitor data')}</div>`;

  try {
    if (!db) throw new Error('Firebase not initialized');

    const { collection, getDocs: _getDocs } = await import('./firebase-init.js');
    const snap = await _getDocs(collection(db, 'competition_intel'));

    const comps = [];
    snap.forEach(docSnap => {
      if (docSnap.id !== '_index') comps.push(docSnap.data());
    });

    // Sort: public (with stock) first, then private alphabetically
    comps.sort((a, b) => {
      if (a.isPublic !== b.isPublic) return a.isPublic ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Pull shared industry news from first competitor that has it
    const industryNews = comps.find(c => c.news?.length)?.news || [];

    // Render industry news strip if headlines exist
    const newsEl = document.getElementById('comp-news-strip');
    if (newsEl && industryNews.length) {
      newsEl.innerHTML = industryNews.slice(0, 5).map(n => `
        <a href="${n.link}" target="_blank" rel="noopener" class="news-pill" title="${n.source}">
          <span class="news-pill-dot"></span>
          <span>${n.title.length > 80 ? n.title.slice(0, 80) + '…' : n.title}</span>
          <span class="news-pill-source">${n.source || ''}</span>
        </a>
      `).join('');
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
      const newsBlock = latestNews ? `
        <div class="comp-latest-news">
          <span class="comp-news-label">Latest</span>
          <a href="${latestNews.link}" target="_blank" rel="noopener" class="comp-news-link">
            ${latestNews.title.length > 70 ? latestNews.title.slice(0, 70) + '…' : latestNews.title}
          </a>
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
  hideLoader('section-competition');
}

// ---- INVENTORY ----
async function renderInventory() {
  showLoader('section-inventory');
  try {
    if (!db) throw new Error('Firebase not initialized');

    const kpiSnap = await getDoc(doc(db, 'inventory_kpis', 'current'));
    if (kpiSnap.exists()) {
      const kpis = kpiSnap.data();
      setText('inv-min-breaches', kpis.minBreaches || '0');
      setText('inv-accuracy', (kpis.accuracy || '0') + '%');
      setText('inv-shortages', kpis.shortages || '0');
    } else {
      throw new Error('No inventory KPI data');
    }
  } catch (err) {
    console.warn('Live inventory data failed:', err.message);
    setText('inv-min-breaches', '142');
    setText('inv-accuracy', '96.5%');
    setText('inv-shortages', '38');
  }
  hideLoader('section-inventory');
}

// ---- PRODUCTION ----
async function renderProduction() {
  showLoader('section-production');
  try {
    if (!db) throw new Error('Firebase not initialized');

    const kpiSnap = await getDoc(doc(db, 'production_kpis', 'current'));
    if (kpiSnap.exists()) {
      const kpis = kpiSnap.data();
      setText('prod-past-due', kpis.pastDue || '0');
      setText('prod-activity', (kpis.activity || '0') + '%');
    } else {
      throw new Error('No production KPI data');
    }
  } catch (err) {
    console.warn('Live production data failed:', err.message);
    setText('prod-past-due', '24');
    setText('prod-activity', '88%');
  }
  hideLoader('section-production');
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

  const yearFilter = document.getElementById('sales-year-filter');
  if (yearFilter) {
    yearFilter.addEventListener('change', () => {
      if (document.getElementById('section-sales').classList.contains('active')) {
        renderSales();
      }
    });
  }

  // Refresh the sync badge every 5 minutes
  setInterval(fetchLastSync, 5 * 60 * 1000);
});
