/* ════════════════════════════════════════
   KISAANBOOK v2 — SCRIPT.JS
   Full Offline Farm Budget & Lifecycle App
   Developer: Tukaram Hankare
════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════
   LOCAL STORAGE DATABASE
════════════════════════════════════════ */
const DB = {
  getCrops()      { return JSON.parse(localStorage.getItem('kb2_crops')    || '[]'); },
  saveCrops(d)    { localStorage.setItem('kb2_crops', JSON.stringify(d)); },
  getExpenses()   { return JSON.parse(localStorage.getItem('kb2_expenses') || '[]'); },
  saveExpenses(d) { localStorage.setItem('kb2_expenses', JSON.stringify(d)); },

  addCrop(crop) {
    const list = this.getCrops();
    list.push(crop);
    this.saveCrops(list);
  },
  deleteCrop(id) {
    this.saveCrops(this.getCrops().filter(c => c.id !== id));
    this.saveExpenses(this.getExpenses().filter(e => e.cropId !== id));
  },
  addExpense(exp) {
    const list = this.getExpenses();
    list.push(exp);
    this.saveExpenses(list);
  },
  deleteExpense(id) {
    this.saveExpenses(this.getExpenses().filter(e => e.id !== id));
  }
};

/* ════════════════════════════════════════
   UTILITIES
════════════════════════════════════════ */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(d1Str, d2Str) {
  return Math.floor((new Date(d2Str) - new Date(d1Str)) / 86400000);
}

function formatDate(ds) {
  if (!ds) return '—';
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function formatDateShort(ds) {
  if (!ds) return '—';
  return new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short'
  });
}

function fmtCurrency(n) {
  n = Math.round(n || 0);
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000)     return '₹' + (n / 1000).toFixed(1) + 'K';
  return '₹' + n.toLocaleString('en-IN');
}

function monthKey(ds) { return ds ? ds.slice(0, 7) : ''; }

function monthLabel(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[parseInt(m) - 1] + ' ' + y;
}

function cropStatus(dc, harvestDays) {
  if (dc < 0) return 'early';
  if (dc > harvestDays) return 'overdue';
  if ((dc / harvestDays) >= 0.85) return 'harvest';
  return 'growing';
}

function statusLabel(st) {
  return { early:'Not Started', growing:'Growing', harvest:'Near Harvest', overdue:'Overdue' }[st] || 'Growing';
}

function chipClass(st) {
  return { early:'chip-early', growing:'chip-growing', harvest:'chip-harvest', overdue:'chip-overdue' }[st] || 'chip-growing';
}

function stripeClass(st) {
  return { early:'stripe-early', growing:'stripe-growing', harvest:'stripe-harvest', overdue:'stripe-overdue' }[st] || 'stripe-growing';
}

function pfillClass(st) {
  return st === 'overdue' ? 'pfill-overdue' : st === 'harvest' ? 'pfill-harvest' : 'pfill-growing';
}

function catEmoji(cat) {
  const map = {
    'Fertilizer':'🌿','Labor':'👷','Irrigation':'💧','Pesticide':'🧪',
    'Seeds':'🌱','Equipment':'🚜','Transport':'🚛','Land Rent':'🏡','Other':'📦'
  };
  return map[cat] || '📦';
}

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

/* ════════════════════════════════════════
   TOAST
════════════════════════════════════════ */
let _toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ════════════════════════════════════════
   MODAL CONFIRM
════════════════════════════════════════ */
let _pendingConfirm = null;

function showModal(msg, onConfirm) {
  document.getElementById('modalText').textContent = msg;
  document.getElementById('modalOverlay').classList.add('show');
  _pendingConfirm = onConfirm;
}

document.getElementById('modalCancel').onclick = () => {
  document.getElementById('modalOverlay').classList.remove('show');
  _pendingConfirm = null;
};

document.getElementById('modalConfirm').onclick = () => {
  if (_pendingConfirm) _pendingConfirm();
  document.getElementById('modalOverlay').classList.remove('show');
  _pendingConfirm = null;
};

/* ════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════ */
let _currentPage = 'dashboard';

function navigateTo(page, data) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Deactivate all nav buttons
  document.querySelectorAll('.bnav-btn, .snav-btn').forEach(b => b.classList.remove('active'));

  // Show target page
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // Activate nav buttons
  document.querySelectorAll(`[data-page="${page}"]`).forEach(b => b.classList.add('active'));

  _currentPage = page;
  window.scrollTo(0, 0);

  // Per-page init
  if (page === 'dashboard')    renderDashboard();
  else if (page === 'expenses') renderExpensesPage();
  else if (page === 'export')   renderExportPage();
  else if (page === 'add-crop') initAddCropForm();
  else if (page === 'crop-details' && data) renderCropDetail(data.cropId);
}

// Wire up nav buttons
document.querySelectorAll('.bnav-btn, .snav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

/* ════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════ */
function renderDashboard() {
  const crops    = DB.getCrops();
  const expenses = DB.getExpenses();
  const todayStr = today();
  const thisMon  = todayStr.slice(0, 7);

  // Header date
  const dateStr = new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  const el = document.getElementById('todayDate');
  if (el) el.textContent = dateStr;
  const hd = document.getElementById('headerDate');
  if (hd) hd.textContent = dateStr;

  // KPI
  const totalAmt   = expenses.reduce((s, e) => s + e.amount, 0);
  const monAmt     = expenses.filter(e => monthKey(e.date) === thisMon).reduce((s, e) => s + e.amount, 0);
  const nearH      = crops.filter(c => {
    const dc  = daysBetween(c.sowingDate, todayStr);
    const pct = dc / c.harvestDays;
    return pct >= 0.85 && dc <= c.harvestDays;
  }).length;

  document.getElementById('totalCrops').textContent       = crops.length;
  document.getElementById('totalExpenses').textContent    = fmtCurrency(totalAmt);
  document.getElementById('thisMonthExpenses').textContent = fmtCurrency(monAmt);
  document.getElementById('nearHarvest').textContent      = nearH;

  // KPI footer text
  const kpiCropFoot = document.getElementById('kpiCropFoot');
  if (kpiCropFoot) kpiCropFoot.textContent = crops.length ? `${crops.length} field(s) tracked` : 'Start by adding a crop';
  const kpiExpFoot = document.getElementById('kpiExpFoot');
  if (kpiExpFoot) kpiExpFoot.textContent = expenses.length ? `${expenses.length} entries` : 'Across all crops';
  const kpiMonFoot = document.getElementById('kpiMonFoot');
  if (kpiMonFoot) {
    const monCount = expenses.filter(e => monthKey(e.date) === thisMon).length;
    kpiMonFoot.textContent = monCount ? `${monCount} entries this month` : 'No spend this month';
  }

  // Crop list
  const listEl = document.getElementById('dashboardCropList');
  if (!crops.length) {
    listEl.innerHTML = `<div class="empty-block"><div class="empty-ico">🌾</div><p>No crops yet.<br>Tap <strong>+ New Crop</strong> to begin!</p></div>`;
  } else {
    listEl.innerHTML = crops.map(c => buildCropCard(c, todayStr, expenses)).join('');
  }

  // Recent expenses
  const recEl  = document.getElementById('recentExpenseList');
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (!sorted.length) {
    recEl.innerHTML = `<div class="empty-block small"><p>No expenses recorded yet.</p></div>`;
  } else {
    recEl.innerHTML = sorted.map(e => buildExpItem(e, crops, true)).join('');
  }
}

function buildCropCard(crop, todayStr, expenses) {
  const dc  = daysBetween(crop.sowingDate, todayStr);
  const rem = crop.harvestDays - dc;
  const pct = Math.min(100, Math.max(0, (dc / crop.harvestDays) * 100));
  const st  = cropStatus(dc, crop.harvestDays);
  const totEx = expenses.filter(e => e.cropId === crop.id).reduce((s, e) => s + e.amount, 0);

  return `
  <div class="crop-card" onclick="navigateTo('crop-details', {cropId: '${crop.id}'})">
    <div class="crop-card-stripe ${stripeClass(st)}"></div>
    <div class="crop-card-inner">
      <div class="crop-card-row1">
        <div>
          <div class="crop-name">${escHtml(crop.name)}</div>
          ${crop.variety ? `<div class="crop-variety">${escHtml(crop.variety)}</div>` : ''}
        </div>
        <span class="status-chip ${chipClass(st)}">${statusLabel(st)}</span>
      </div>
      <div class="crop-meta-grid">
        <div class="crop-meta-item">
          <div class="meta-lbl">Sown</div>
          <div class="meta-val">${formatDateShort(crop.sowingDate)}</div>
        </div>
        <div class="crop-meta-item">
          <div class="meta-lbl">${rem >= 0 ? 'Days Left' : 'Overdue'}</div>
          <div class="meta-val">${rem >= 0 ? rem + 'd' : Math.abs(rem) + 'd'}</div>
        </div>
        <div class="crop-meta-item">
          <div class="meta-lbl">Invested</div>
          <div class="meta-val">${fmtCurrency(totEx)}</div>
        </div>
      </div>
      <div class="prog-wrap">
        <div class="prog-labels">
          <span>Growth Progress</span>
          <span>${pct.toFixed(0)}%</span>
        </div>
        <div class="prog-track">
          <div class="prog-fill ${pfillClass(st)}" style="width:${pct}%"></div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ════════════════════════════════════════
   ADD CROP
════════════════════════════════════════ */
function initAddCropForm() {
  document.getElementById('sowingDate').value = today();
  ['cropName','harvestDays','landArea','cropVariety','cropNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

document.getElementById('saveCropBtn').onclick = () => {
  const name    = document.getElementById('cropName').value.trim();
  const sow     = document.getElementById('sowingDate').value;
  const days    = parseInt(document.getElementById('harvestDays').value);
  const area    = document.getElementById('landArea').value.trim();
  const variety = document.getElementById('cropVariety').value.trim();
  const notes   = document.getElementById('cropNotes').value.trim();

  if (!name)         return showToast('⚠️ Please enter a crop name.');
  if (!sow)          return showToast('⚠️ Please select sowing date.');
  if (!days || days < 1) return showToast('⚠️ Enter valid harvest duration (days).');

  DB.addCrop({ id: uid(), name, sowingDate: sow, harvestDays: days, area, variety, notes, createdAt: today() });
  showToast(`✅ Crop "${name}" added!`);
  initAddCropForm();
  navigateTo('dashboard');
};

/* ════════════════════════════════════════
   EXPENSES PAGE
════════════════════════════════════════ */
function renderExpensesPage() {
  const crops    = DB.getCrops();
  const expenses = DB.getExpenses();

  // Populate crop select
  const cropSel = document.getElementById('expenseCrop');
  cropSel.innerHTML = '<option value="">— Choose Crop —</option>' +
    crops.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

  document.getElementById('expenseDate').value = today();

  // Filter selects
  const fcEl = document.getElementById('filterCropExpense');
  fcEl.innerHTML = '<option value="all">All Crops</option>' +
    crops.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

  const months = [...new Set(expenses.map(e => monthKey(e.date)).filter(Boolean))].sort().reverse();
  const fmEl = document.getElementById('filterMonthExpense');
  fmEl.innerHTML = '<option value="all">All Months</option>' +
    months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');

  renderFilteredExpenses();
  renderMonthlyChart(expenses);
}

function renderFilteredExpenses() {
  const crops  = DB.getCrops();
  let exps     = DB.getExpenses();
  const fc     = document.getElementById('filterCropExpense').value;
  const fm     = document.getElementById('filterMonthExpense').value;

  if (fc !== 'all') exps = exps.filter(e => e.cropId === fc);
  if (fm !== 'all') exps = exps.filter(e => monthKey(e.date) === fm);
  exps.sort((a, b) => b.date.localeCompare(a.date));

  // Summary strip
  const strip = document.getElementById('summaryStrip');
  const total = exps.reduce((s, e) => s + e.amount, 0);
  if (exps.length) {
    strip.className = 'summary-strip visible';
    strip.innerHTML = `
      <div>
        <div class="strip-item-lbl">Total (Filtered)</div>
        <div class="strip-item-val">${fmtCurrency(total)}</div>
      </div>
      <div>
        <div class="strip-item-lbl">Entries</div>
        <div class="strip-item-val">${exps.length}</div>
      </div>
      <div>
        <div class="strip-item-lbl">Avg per Entry</div>
        <div class="strip-item-val">${fmtCurrency(exps.length ? total / exps.length : 0)}</div>
      </div>`;
  } else {
    strip.className = 'summary-strip';
    strip.innerHTML = '';
  }

  // List
  const el = document.getElementById('fullExpenseList');
  if (!exps.length) {
    el.innerHTML = `<div class="empty-block"><div class="empty-ico">💰</div><p>No expenses found.</p></div>`;
  } else {
    el.innerHTML = exps.map(e => buildExpItem(e, crops, false)).join('');
  }
}

function buildExpItem(exp, crops, compact) {
  const crop = crops.find(c => c.id === exp.cropId);
  const cName = crop ? escHtml(crop.name) : 'Unknown';
  const delBtn = compact ? '' : `
    <button class="exp-del-btn" onclick="event.stopPropagation();deleteExpense('${exp.id}')" title="Delete">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
    </button>`;

  return `
  <div class="exp-item">
    <div class="exp-cat-dot">${catEmoji(exp.category)}</div>
    <div class="exp-body">
      <div class="exp-cat-name">${escHtml(exp.category)}</div>
      ${exp.desc ? `<div class="exp-desc">${escHtml(exp.desc)}</div>` : ''}
      <span class="exp-crop-tag">🌱 ${cName}</span>
    </div>
    <div class="exp-right">
      <div class="exp-amount">${fmtCurrency(exp.amount)}</div>
      <div class="exp-date">${formatDateShort(exp.date)}</div>
    </div>
    ${delBtn}
  </div>`;
}

function deleteExpense(id) {
  showModal('Delete this expense entry? This cannot be undone.', () => {
    DB.deleteExpense(id);
    showToast('🗑️ Expense deleted.');
    renderExpensesPage();
  });
}

// Collapsible expense form
document.getElementById('expFormToggle').addEventListener('click', () => {
  const body = document.getElementById('expFormBody');
  const chev = document.getElementById('expFormToggle').querySelector('.chev');
  const open = body.classList.toggle('open');
  chev.classList.toggle('open', open);
});

// Save expense
document.getElementById('saveExpenseBtn').onclick = () => {
  const cropId = document.getElementById('expenseCrop').value;
  const date   = document.getElementById('expenseDate').value;
  const amount = parseFloat(document.getElementById('expenseAmount').value);
  const cat    = document.getElementById('expenseCategory').value;
  const desc   = document.getElementById('expenseDesc').value.trim();

  if (!cropId)         return showToast('⚠️ Please select a crop.');
  if (!date)           return showToast('⚠️ Please select a date.');
  if (!amount || amount <= 0) return showToast('⚠️ Enter a valid amount greater than 0.');

  DB.addExpense({ id: uid(), cropId, date, amount, category: cat, desc, createdAt: today() });
  showToast(`✅ Expense ₹${amount.toLocaleString('en-IN')} added.`);
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseDesc').value   = '';
  renderExpensesPage();
};

document.getElementById('filterCropExpense').onchange  = renderFilteredExpenses;
document.getElementById('filterMonthExpense').onchange = renderFilteredExpenses;

/* ════════════════════════════════════════
   MONTHLY BAR CHART
════════════════════════════════════════ */
function renderMonthlyChart(expenses) {
  const monthly = {};
  expenses.forEach(e => {
    const k = monthKey(e.date);
    if (k) monthly[k] = (monthly[k] || 0) + e.amount;
  });

  const keys = Object.keys(monthly).sort().slice(-7);
  const chartCard = document.getElementById('monthlyChartCard');

  if (keys.length < 2) { chartCard.style.display = 'none'; return; }

  chartCard.style.display = 'block';
  const maxVal = Math.max(...keys.map(k => monthly[k]));
  const barChart = document.getElementById('monthlyBarChart');

  barChart.innerHTML = keys.map(k => {
    const h   = Math.round(Math.max(4, (monthly[k] / maxVal) * 80));
    const lbl = monthLabel(k).replace(' ', '\u00A0');
    return `
      <div class="bar-col">
        <div class="bar-val">${fmtCurrency(monthly[k])}</div>
        <div class="bar-fill" style="height:${h}px"></div>
        <div class="bar-lbl">${lbl}</div>
      </div>`;
  }).join('');
}

/* ════════════════════════════════════════
   SMART CARE SUGGESTIONS ENGINE
════════════════════════════════════════ */
function getCropSuggestions(dc, harvestDays) {
  const pct  = dc / harvestDays;
  const sug  = [];

  if (dc < 0) {
    sug.push({ icon:'🏗️', bg:'background:#F5F5F5',
      title:'Pre-Sowing Field Preparation',
      desc:'Plough to 15–20 cm depth. Apply FYM (Farm Yard Manure) 5–10 tons/acre. Level the field. Test soil pH — aim for 6.0–7.5.',
      pri:'medium' });
    sug.push({ icon:'🌡️', bg:'background:#EDE9FE',
      title:'Soil Health Check',
      desc:'Get soil tested for NPK levels. Apply recommended base fertilizer before sowing. Ensure good drainage.',
      pri:'low' });
    return sug;
  }

  if (dc <= 10) {
    sug.push({ icon:'💧', bg:'background:#E0F2FE',
      title:'Daily Germination Watering',
      desc:'Water gently every morning. Keep soil moist but not waterlogged. Ideal moisture depth: 5–8 cm. Avoid water pooling near seeds.',
      pri:'high' });
    sug.push({ icon:'🌿', bg:'background:#D1FAE5',
      title:'Apply Starter Fertilizer',
      desc:'Use DAP (Di-Ammonium Phosphate) at sowing — promotes vigorous root development. Rate: 25 kg/acre mixed with seeds.',
      pri:'high' });
    sug.push({ icon:'👁️', bg:'background:#FEF3C7',
      title:'Monitor Germination Rate',
      desc:'By Day 7, expect 70–80% germination. Mark gaps and be ready to replant missed spots. Protect from birds early on.',
      pri:'medium' });
  } else if (dc <= 25) {
    sug.push({ icon:'🧪', bg:'background:#D1FAE5',
      title:'First Nitrogen Top Dressing',
      desc:'Apply Urea @ 20–25 kg/acre. Broadcast between rows and irrigate immediately after. Promotes rapid leaf and stem growth.',
      pri:'high' });
    sug.push({ icon:'🌱', bg:'background:#D1FAE5',
      title:'Weed Control Window',
      desc:'Critical weeding window: Day 14–21. Hand weed or apply recommended herbicide. Weeds compete heavily for N, P, K in this phase.',
      pri:'high' });
    sug.push({ icon:'💧', bg:'background:#E0F2FE',
      title:'Irrigate Every 2–3 Days',
      desc:'Reduce frequency. Irrigate every 2–3 days based on weather and soil moisture. Avoid over-irrigation — causes root rot.',
      pri:'medium' });
  } else if (dc <= 45) {
    sug.push({ icon:'🧫', bg:'background:#D1FAE5',
      title:'Second Fertilizer Application',
      desc:'Apply MOP (Muriate of Potash) or NPK complex fertilizer. Supports branching, tillers, and overall vegetative vigor.',
      pri:'high' });
    sug.push({ icon:'🐛', bg:'background:#FEF3C7',
      title:'Pest Scouting — Inspect Leaves',
      desc:'Check leaves for aphids, stem borers, jassids, thrips. If damage exceeds 10% leaf area, apply Chlorpyrifos or Neem oil spray.',
      pri:'medium' });
    sug.push({ icon:'💧', bg:'background:#E0F2FE',
      title:'Deep Weekly Irrigation',
      desc:'Increase water penetration to 8–10 cm. Crops are actively growing — consistent moisture is critical for yield formation.',
      pri:'medium' });
  } else if (pct < 0.60) {
    sug.push({ icon:'🍃', bg:'background:#D1FAE5',
      title:'Micronutrient Spray',
      desc:'Apply Zinc Sulphate (ZnSO₄) foliar spray @ 0.5% solution. Prevents zinc deficiency which reduces grain filling by 20–30%.',
      pri:'medium' });
    sug.push({ icon:'🛡️', bg:'background:#FEF3C7',
      title:'Preventive Fungicide Spray',
      desc:'Risk of blight, rust, and powdery mildew increases mid-season. Spray Mancozeb 75WP @ 2.5g/L or Propiconazole as preventive.',
      pri:'medium' });
    sug.push({ icon:'💧', bg:'background:#E0F2FE',
      title:'Critical Moisture Phase',
      desc:'This stage determines 60–70% of final yield. Maintain consistent soil moisture. Avoid any water stress for even 3–5 days.',
      pri:'high' });
  } else if (pct < 0.85) {
    sug.push({ icon:'🚫', bg:'background:#FEE2E2',
      title:'Stop Chemical Applications Now',
      desc:'Observe Pre-Harvest Interval (PHI). No pesticides or chemical fertilizers within 21–30 days of expected harvest. Food safety critical.',
      pri:'high' });
    sug.push({ icon:'💧', bg:'background:#E0F2FE',
      title:'Reduce Irrigation Gradually',
      desc:'Start tapering water supply. For cereal crops, stop irrigation 10–14 days before harvest to allow grain hardening and drying.',
      pri:'medium' });
    sug.push({ icon:'📊', bg:'background:#F5F5F5',
      title:'Yield Estimation',
      desc:'Count ears/cobs/pods per plant in 3–4 sample rows. Multiply to estimate field yield. Begin market price monitoring.',
      pri:'low' });
  } else {
    sug.push({ icon:'🌾', bg:'background:#FEF3C7',
      title:'Harvest Readiness Check',
      desc:'For cereals: check moisture content (target 14% or below). Look for golden-yellow color and dry leaves. Test a handful for hardness.',
      pri:'high' });
    sug.push({ icon:'🚜', bg:'background:#FEF3C7',
      title:'Arrange Harvesting Equipment',
      desc:'Book combine harvester or labor at least 7–10 days in advance. Plan harvesting on consecutive dry days to minimize losses.',
      pri:'high' });
    sug.push({ icon:'🏚️', bg:'background:#F5F5F5',
      title:'Prepare Storage Area',
      desc:'Clean godown/storage shed. Apply recommended fumigant. Dry grain/produce to safe moisture level before bagging to prevent mold.',
      pri:'medium' });
  }

  if (dc > harvestDays) {
    sug.unshift({ icon:'⚠️', bg:'background:#FEE2E2',
      title:`OVERDUE — Harvest ${dc - harvestDays} Days Late!`,
      desc:'Delayed harvest causes grain shattering, quality degradation, and increased pest/disease risk. Harvest immediately. Do not delay further.',
      pri:'high' });
  }

  return sug;
}

/* ════════════════════════════════════════
   CROP DETAIL PAGE
════════════════════════════════════════ */
function renderCropDetail(cropId) {
  const crops    = DB.getCrops();
  const expenses = DB.getExpenses();
  const crop     = crops.find(c => c.id === cropId);
  if (!crop) { navigateTo('dashboard'); return; }

  const todayStr = today();
  const dc   = daysBetween(crop.sowingDate, todayStr);
  const rem  = crop.harvestDays - dc;
  const pct  = Math.min(100, Math.max(0, (dc / crop.harvestDays) * 100));
  const st   = cropStatus(dc, crop.harvestDays);
  const harvestDate = addDays(crop.sowingDate, crop.harvestDays);

  const cropExps = expenses.filter(e => e.cropId === cropId);
  const totCost  = cropExps.reduce((s, e) => s + e.amount, 0);

  // Category breakdown
  const catMap = {};
  cropExps.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
  const catRows = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  const suggestions = getCropSuggestions(dc, crop.harvestDays);

  document.getElementById('detailCropName').textContent = crop.name;

  document.getElementById('cropDetailContent').innerHTML = `
    <!-- Hero -->
    <div class="detail-hero">
      <div class="detail-hero-name">${escHtml(crop.name)}</div>
      <div class="detail-hero-meta">
        Sown: ${formatDate(crop.sowingDate)}
        ${crop.area    ? ' · ' + escHtml(crop.area)    : ''}
        ${crop.variety ? ' · ' + escHtml(crop.variety) : ''}
      </div>
      <div class="detail-kpi-row">
        <div class="detail-kpi">
          <span class="dkpi-val">${Math.max(0, dc)}</span>
          <span class="dkpi-lbl">Days Done</span>
        </div>
        <div class="detail-kpi">
          <span class="dkpi-val">${rem >= 0 ? rem : Math.abs(rem)}</span>
          <span class="dkpi-lbl">${rem >= 0 ? 'Days Left' : 'Days Over'}</span>
        </div>
        <div class="detail-kpi">
          <span class="dkpi-val">${pct.toFixed(0)}%</span>
          <span class="dkpi-lbl">Progress</span>
        </div>
      </div>
    </div>

    <!-- Timeline -->
    <div class="info-card">
      <div class="info-card-title">📅 Harvest Timeline</div>
      <div class="timeline-row">
        <div class="timeline-harvest">Expected Harvest: <strong>${formatDate(harvestDate)}</strong></div>
        <span class="status-chip ${chipClass(st)}">${statusLabel(st)}</span>
      </div>
      <div class="prog-track" style="height:8px">
        <div class="prog-fill ${pfillClass(st)}" style="width:${pct}%"></div>
      </div>
      ${crop.notes ? `<div style="margin-top:12px;padding:10px 12px;background:var(--n050);border-radius:8px;font-size:0.8rem;color:var(--n600);line-height:1.5;">📝 ${escHtml(crop.notes)}</div>` : ''}
    </div>

    <!-- Smart Suggestions -->
    <div class="section-row" style="margin-bottom:10px;">
      <h2 class="section-title">🤖 Smart Suggestions</h2>
      <span style="font-size:0.7rem;color:var(--n400);font-weight:600;">Day ${Math.max(0,dc)} of ${crop.harvestDays}</span>
    </div>
    ${suggestions.map(s => `
      <div class="suggestion-card">
        <div class="sug-icon-box" style="${s.bg}">${s.icon}</div>
        <div class="sug-content">
          <div class="sug-title">${s.title}</div>
          <div class="sug-desc">${s.desc}</div>
          <span class="sug-priority pri-${s.pri}">${s.pri} priority</span>
        </div>
      </div>`).join('')}

    <!-- Expense Summary -->
    <div class="info-card" style="margin-top:16px;">
      <div class="info-card-title">💰 Expense Breakdown</div>
      ${catRows.length ? catRows.map(([cat, amt]) => `
        <div class="cat-row">
          <span class="cat-row-name">${catEmoji(cat)} ${escHtml(cat)}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="cat-row-pct">${totCost ? ((amt/totCost)*100).toFixed(0) : 0}%</span>
            <span class="cat-row-val">${fmtCurrency(amt)}</span>
          </div>
        </div>`).join('') : `<div style="font-size:0.82rem;color:var(--n400);padding:8px 0;">No expenses recorded for this crop yet.</div>`}
      <div class="total-row">
        <span class="total-lbl">Total Invested</span>
        <span class="total-val">${fmtCurrency(totCost)}</span>
      </div>
      <button class="btn-primary btn-full" onclick="goAddExpForCrop('${cropId}')" style="margin-top:14px;font-size:0.85rem;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Expense for this Crop
      </button>
    </div>

    <!-- Recent Transactions -->
    ${cropExps.length ? `
      <div class="section-row" style="margin-top:16px;margin-bottom:8px;">
        <h2 class="section-title">Recent Transactions</h2>
      </div>
      <div class="exp-list">
        ${[...cropExps].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6).map(e => buildExpItem(e, crops, false)).join('')}
      </div>` : ''}

    <!-- Delete Action -->
    <div class="detail-actions">
      <button class="btn-outline-danger" onclick="deleteCrop('${cropId}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        Delete Crop
      </button>
    </div>
  `;
}

function goAddExpForCrop(cropId) {
  navigateTo('expenses');
  setTimeout(() => {
    const sel = document.getElementById('expenseCrop');
    if (sel) sel.value = cropId;
    const body = document.getElementById('expFormBody');
    const chev = document.getElementById('expFormToggle').querySelector('.chev');
    if (body && !body.classList.contains('open')) {
      body.classList.add('open');
      chev.classList.add('open');
    }
  }, 120);
}

function deleteCrop(id) {
  const crop = DB.getCrops().find(c => c.id === id);
  showModal(`Delete "${crop ? crop.name : 'this crop'}" and ALL its expenses? This cannot be undone.`, () => {
    DB.deleteCrop(id);
    showToast('🗑️ Crop and expenses deleted.');
    navigateTo('dashboard');
  });
}

/* ════════════════════════════════════════
   EXPORT PAGE
════════════════════════════════════════ */
function renderExportPage() {
  const crops    = DB.getCrops();
  const expenses = DB.getExpenses();
  const total    = expenses.reduce((s, e) => s + e.amount, 0);

  const sc = document.getElementById('exportSummary');
  if (sc) {
    sc.innerHTML = `
      <div class="esc-item">
        <div class="esc-lbl">Crops</div>
        <div class="esc-val">${crops.length}</div>
        <div class="esc-sub">active crop records</div>
      </div>
      <div class="esc-item">
        <div class="esc-lbl">Expenses</div>
        <div class="esc-val">${expenses.length}</div>
        <div class="esc-sub">expense entries</div>
      </div>
      <div class="esc-item">
        <div class="esc-lbl">Total Spent</div>
        <div class="esc-val">${fmtCurrency(total)}</div>
        <div class="esc-sub">across all crops</div>
      </div>`;
  }
}

/* ════════════════════════════════════════
   EXPORT FUNCTIONS
════════════════════════════════════════ */

/* — JSON Export — */
function exportJSON() {
  const crops    = DB.getCrops();
  const expenses = DB.getExpenses();
  if (!crops.length && !expenses.length) return showToast('⚠️ No data to export.');

  const payload = {
    app: 'KisaanBook',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    exportedBy: 'Tukaram Hankare',
    crops,
    expenses
  };

  triggerDownload(
    JSON.stringify(payload, null, 2),
    `kisaanbook_backup_${today()}.json`,
    'application/json'
  );
  showToast('✅ JSON backup downloaded!');
}

/* — XLSX: Crops Only — */
function exportXLSX_Crops() {
  const crops    = DB.getCrops();
  const expenses = DB.getExpenses();
  if (!crops.length) return showToast('⚠️ No crops to export.');

  const todayStr = today();
  const rows = crops.map(c => {
    const dc  = daysBetween(c.sowingDate, todayStr);
    const rem = c.harvestDays - dc;
    const tot = expenses.filter(e => e.cropId === c.id).reduce((s, e) => s + e.amount, 0);
    return {
      'Crop Name':           c.name,
      'Variety':             c.variety || '',
      'Date of Sowing':      c.sowingDate,
      'Harvest Duration (Days)': c.harvestDays,
      'Expected Harvest Date': addDays(c.sowingDate, c.harvestDays),
      'Days Completed':      Math.max(0, dc),
      'Days Remaining':      rem >= 0 ? rem : 0,
      'Status':              statusLabel(cropStatus(dc, c.harvestDays)),
      'Land Area':           c.area || '',
      'Total Expenses (₹)':  tot,
      'Notes':               c.notes || '',
      'Added On':            c.createdAt || ''
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  applyColWidths(ws, [20,15,16,22,22,16,16,14,14,20,30,14]);
  XLSX.utils.book_append_sheet(wb, ws, 'Crops');
  XLSX.writeFile(wb, `kisaanbook_crops_${today()}.xlsx`);
  showToast('✅ Crops Excel downloaded!');
}

/* — XLSX: Expenses Only — */
function exportXLSX_Expenses() {
  const crops    = DB.getCrops();
  const expenses = DB.getExpenses();
  if (!expenses.length) return showToast('⚠️ No expenses to export.');

  const rows = [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const crop = crops.find(c => c.id === e.cropId);
      return {
        'Date':           e.date,
        'Crop Name':      crop ? crop.name : 'Unknown',
        'Category':       e.category,
        'Description':    e.desc || '',
        'Amount (₹)':     e.amount,
        'Month':          monthLabel(monthKey(e.date)),
        'Recorded On':    e.createdAt || ''
      };
    });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  applyColWidths(ws, [14,20,16,30,14,14,14]);
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  XLSX.writeFile(wb, `kisaanbook_expenses_${today()}.xlsx`);
  showToast('✅ Expenses Excel downloaded!');
}

/* — XLSX: Full Multi-Sheet Farm Report — */
function exportXLSX_Full() {
  const crops    = DB.getCrops();
  const expenses = DB.getExpenses();
  if (!crops.length && !expenses.length) return showToast('⚠️ No data to export.');

  const todayStr = today();
  const wb = XLSX.utils.book_new();

  /* Sheet 1: Summary */
  const totalAmt  = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMon   = todayStr.slice(0, 7);
  const monAmt    = expenses.filter(e => monthKey(e.date) === thisMon).reduce((s, e) => s + e.amount, 0);
  const summData  = [
    ['KisaanBook — Farm Report'],
    ['Generated On', new Date().toLocaleString('en-IN')],
    ['Developer', 'Tukaram Hankare'],
    [],
    ['SUMMARY', ''],
    ['Total Crops', crops.length],
    ['Total Expenses', expenses.length],
    ['Total Amount Spent (₹)', totalAmt],
    ['This Month Spent (₹)', monAmt],
    ['Near Harvest Crops', crops.filter(c => {
      const dc = daysBetween(c.sowingDate, todayStr);
      return (dc / c.harvestDays) >= 0.85 && dc <= c.harvestDays;
    }).length]
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summData);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  /* Sheet 2: Crops */
  if (crops.length) {
    const cropRows = crops.map(c => {
      const dc  = daysBetween(c.sowingDate, todayStr);
      const rem = c.harvestDays - dc;
      const tot = expenses.filter(e => e.cropId === c.id).reduce((s, e) => s + e.amount, 0);
      return {
        'Crop Name':           c.name,
        'Variety':             c.variety || '',
        'Date of Sowing':      c.sowingDate,
        'Harvest Duration(Days)': c.harvestDays,
        'Harvest Date':        addDays(c.sowingDate, c.harvestDays),
        'Days Done':           Math.max(0, dc),
        'Days Remaining':      rem >= 0 ? rem : 0,
        'Status':              statusLabel(cropStatus(dc, c.harvestDays)),
        'Progress (%)':        Math.min(100, Math.max(0, Math.round((dc / c.harvestDays) * 100))),
        'Land Area':           c.area || '',
        'Total Expense (₹)':   tot,
        'Notes':               c.notes || ''
      };
    });
    const wsCrops = XLSX.utils.json_to_sheet(cropRows);
    applyColWidths(wsCrops, [20,14,16,22,16,12,14,14,14,14,18,30]);
    XLSX.utils.book_append_sheet(wb, wsCrops, 'Crops');
  }

  /* Sheet 3: Expenses */
  if (expenses.length) {
    const expRows = [...expenses]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => {
        const crop = crops.find(c => c.id === e.cropId);
        return {
          'Date':        e.date,
          'Crop':        crop ? crop.name : 'Unknown',
          'Category':    e.category,
          'Description': e.desc || '',
          'Amount (₹)':  e.amount,
          'Month':       monthLabel(monthKey(e.date))
        };
      });
    const wsExp = XLSX.utils.json_to_sheet(expRows);
    applyColWidths(wsExp, [14,20,16,32,14,14]);
    XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses');
  }

  /* Sheet 4: Monthly Summary */
  const monthlyMap = {};
  expenses.forEach(e => {
    const k = monthKey(e.date);
    if (!k) return;
    if (!monthlyMap[k]) monthlyMap[k] = { total: 0, count: 0, cropSet: new Set() };
    monthlyMap[k].total += e.amount;
    monthlyMap[k].count++;
    monthlyMap[k].cropSet.add(e.cropId);
  });

  const monRows = Object.keys(monthlyMap).sort().map(k => ({
    'Month':           monthLabel(k),
    'Total Spent (₹)': monthlyMap[k].total,
    'Transactions':    monthlyMap[k].count,
    'Crops Involved':  monthlyMap[k].cropSet.size,
    'Avg per Entry (₹)': Math.round(monthlyMap[k].total / monthlyMap[k].count)
  }));

  if (monRows.length) {
    const wsMon = XLSX.utils.json_to_sheet(monRows);
    applyColWidths(wsMon, [18,18,14,16,20]);
    XLSX.utils.book_append_sheet(wb, wsMon, 'Monthly Summary');
  }

  /* Sheet 5: Category Breakdown */
  const catMap = {};
  expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
  const catRows = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => ({
    'Category':    cat,
    'Total (₹)':   amt,
    'Share (%)':   expenses.length ? parseFloat(((amt / expenses.reduce((s, e) => s + e.amount, 0)) * 100).toFixed(1)) : 0
  }));

  if (catRows.length) {
    const wsCat = XLSX.utils.json_to_sheet(catRows);
    applyColWidths(wsCat, [22, 16, 14]);
    XLSX.utils.book_append_sheet(wb, wsCat, 'Category Breakdown');
  }

  XLSX.writeFile(wb, `kisaanbook_farm_report_${today()}.xlsx`);
  showToast('✅ Full Farm Report (.xlsx) downloaded!');
}

/* — CSV Export — */
function exportCSV() {
  const crops    = DB.getCrops();
  const expenses = DB.getExpenses();
  if (!expenses.length) return showToast('⚠️ No expenses to export as CSV.');

  const headers = ['Date','Crop Name','Category','Description','Amount (INR)','Month'];
  const rows    = [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => {
      const crop = crops.find(c => c.id === e.cropId);
      return [
        e.date,
        crop ? crop.name : 'Unknown',
        e.category,
        e.desc || '',
        e.amount,
        monthLabel(monthKey(e.date))
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
    });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  triggerDownload(csv, `kisaanbook_expenses_${today()}.csv`, 'text/csv;charset=utf-8;');
  showToast('✅ CSV downloaded!');
}

/* — Helper: trigger file download — */
function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* — Helper: apply column widths to XLSX worksheet — */
function applyColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

/* ════════════════════════════════════════
   IMPORT
════════════════════════════════════════ */
document.getElementById('importFile').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data.crops) || !Array.isArray(data.expenses)) {
        throw new Error('Invalid format');
      }
      showModal(
        `Import ${data.crops.length} crops and ${data.expenses.length} expenses?\n\nThis will REPLACE all current data and cannot be undone.`,
        () => {
          DB.saveCrops(data.crops);
          DB.saveExpenses(data.expenses);
          showToast(`✅ Imported ${data.crops.length} crops, ${data.expenses.length} expenses.`);
          navigateTo('dashboard');
        }
      );
    } catch {
      showToast('❌ Invalid file. Please use a KisaanBook .json backup.');
    }
  };

  reader.readAsText(file);
  this.value = '';
});

/* ════════════════════════════════════════
   DRAG-AND-DROP IMPORT ZONE
════════════════════════════════════════ */
const dropZone = document.getElementById('importDropZone');
if (dropZone) {
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--g400)';
    dropZone.style.background  = 'var(--g050)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '';
    dropZone.style.background  = '';
  });

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    dropZone.style.background  = '';
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!Array.isArray(data.crops) || !Array.isArray(data.expenses)) throw new Error();
          showModal(
            `Import ${data.crops.length} crops and ${data.expenses.length} expenses? This REPLACES all current data.`,
            () => {
              DB.saveCrops(data.crops);
              DB.saveExpenses(data.expenses);
              showToast('✅ Data imported successfully!');
              navigateTo('dashboard');
            }
          );
        } catch {
          showToast('❌ Invalid JSON backup file.');
        }
      };
      reader.readAsText(file);
    } else {
      showToast('⚠️ Please drop a .json KisaanBook backup file.');
    }
  });
}

/* ════════════════════════════════════════
   INIT — APP STARTUP
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Set date fields
  document.getElementById('sowingDate').value  = today();
  document.getElementById('expenseDate').value = today();

  // First-run sample data
  if (!localStorage.getItem('kb2_visited')) {
    localStorage.setItem('kb2_visited', '1');

    const sampleSow = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 28);
      return d.toISOString().split('T')[0];
    })();

    const sampleId = uid();
    DB.addCrop({
      id: sampleId, name: 'Wheat', variety: 'HD-2967',
      sowingDate: sampleSow, harvestDays: 120, area: '2 acres',
      notes: 'Sample crop — feel free to delete this.', createdAt: today()
    });

    [[-26, 1500, 'Seeds',     'Wheat seed HD-2967, 40 kg'],
     [-20, 1200, 'Fertilizer','DAP 50 kg bag'],
     [-12, 2200, 'Labor',     'Sowing & field preparation labor'],
     [-5,  900,  'Irrigation','Drip irrigation charges'],
    ].forEach(([offset, amt, cat, desc]) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      DB.addExpense({
        id: uid(), cropId: sampleId,
        date: d.toISOString().split('T')[0],
        amount: amt, category: cat, desc, createdAt: today()
      });
    });

    showToast('👋 Welcome to KisaanBook! Sample crop loaded.');
  }

  // Render initial page
  renderDashboard();
});
