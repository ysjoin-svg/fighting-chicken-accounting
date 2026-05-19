// ── 狀態 ──
let currentYear = 2026;
let currentMonth = 1;
let monthData = { sales: [], expenses: [], note: '', defaultItems: {}, fixedAmounts: {}, uber_monthly: 0 };
let editingExpenseId = null;
let editingExpenseCategory = null;
let datePickMode = null; // 正在為哪個 cat 選日期

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const CATEGORIES = ['支出', '原料', '薪資'];

// ── 初始化 ──
(async () => {
  await loadMonth();
  loadAnnual();
})();

// ── 頁籤切換 ──
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('page-' + tab).classList.add('active');
  if (tab === 'annual') loadAnnual();
}

// ── 月份切換 ──
function changeMonth(delta) {
  datePickMode = null;
  currentMonth += delta;
  if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  if (currentMonth < 1) { currentMonth = 12; currentYear--; }
  loadMonth();
}

// ── 取得本月營業天數 ──
function getOperatingDays() {
  return monthData.sales.filter(s => !s.is_day_off && s.store_amount > 0).length;
}

// ── 載入月份資料 ──
async function loadMonth() {
  document.getElementById('month-label').textContent =
    `${currentYear}年${MONTHS[currentMonth - 1]}`;

  try {
    const res = await fetch(`/api/month/${currentYear}/${currentMonth}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    monthData = await res.json();
  } catch (e) {
    showToast('⚠️ 載入資料失敗，請確認伺服器連線');
    return;
  }

  renderCalendar();
  renderExpenses();
  renderSummary();
  renderUberMonthly();
  document.getElementById('note-area').value = monthData.note || '';
}

// ── 更新 Header YTD（輕量版，不刷新整個年度表格）──
async function refreshHeaderYtd() {
  try {
    const res = await fetch(`/api/summary/${currentYear}`);
    if (!res.ok) return;
    const data = await res.json();
    const ytd = data.ytd;
    if (!ytd) return;
    const headerYtd = document.getElementById('header-ytd');
    if (headerYtd) {
      headerYtd.innerHTML = `年度累計 <span style="font-weight:700; color:${ytd.profit >= 0 ? '#5EC882' : '#DC6E6E'}">${ytd.profit >= 0 ? '+' : ''}${ytd.profit.toLocaleString()}</span>`;
    }
  } catch (e) { /* 靜默，不影響主流程 */ }
}

// ── Uber 月度總額 ──
function renderUberMonthly() {
  const el = document.getElementById('uber-monthly-display');
  if (!el) return;
  el.value = monthData.uber_monthly || '';
}

async function saveUberMonthly() {
  const val = parseFloat(document.getElementById('uber-monthly-display').value) || 0;
  try {
    await fetch(`/api/month/${currentYear}/${currentMonth}/uber`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uber_monthly: val })
    });
    monthData.uber_monthly = val;
    renderSummary();
    showToast('Uber 月度總額已儲存');
    refreshHeaderYtd();
  } catch (e) { showToast('⚠️ 儲存失敗'); }
}

// ── 日曆渲染 ──
function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const headers = Array.from(grid.children).slice(0, 7);
  grid.innerHTML = '';
  headers.forEach(h => grid.appendChild(h));

  // 日期選取提示橫幅
  if (datePickMode) {
    const banner = document.createElement('div');
    banner.className = 'date-pick-banner';
    banner.style.gridColumn = '1 / -1';
    banner.innerHTML = `
      <span>📅 點選日期，為【${datePickMode}】設定收款日期</span>
      <button class="btn btn-secondary btn-small" onclick="cancelDatePick()">取消</button>
    `;
    grid.appendChild(banner);
  }

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  let firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  firstDay = (firstDay === 0) ? 6 : firstDay - 1;

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }

  const salesMap = {};
  monthData.sales.forEach(s => { salesMap[s.day] = s; });

  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = (firstDay + d - 1) % 7;
    const s = salesMap[d] || { store_amount: 0, uber_amount: 0, is_day_off: 0 };
    const cell = document.createElement('div');

    if (datePickMode) {
      cell.className = 'cal-day date-pick-active' + (dayOfWeek === 6 ? ' sunday' : '');
      cell.onclick = () => pickDate(d);
    } else {
      cell.className = 'cal-day' +
        (s.is_day_off ? ' day-off' : '') +
        ((s.store_amount > 0) && !s.is_day_off ? ' has-data' : '') +
        (dayOfWeek === 6 ? ' sunday' : '');
      cell.onclick = () => openDayModal(d, s);
    }

    let inner = `<div class="day-num">${d}</div>`;
    if (s.is_day_off) {
      inner += `<div class="day-off-tag">排休</div>`;
    } else {
      if (s.store_amount > 0)
        inner += `<div class="day-store num">門 ${s.store_amount.toLocaleString()}</div>`;
      const total = s.store_amount || 0;
      if (total > 0 && datePickMode)
        inner += `<div class="day-total num">∑ ${total.toLocaleString()}</div>`;
      else if (total > 0)
        inner += `<div class="day-total num">∑ ${total.toLocaleString()}</div>`;
    }
    cell.innerHTML = inner;
    grid.appendChild(cell);
  }
}

// ── 日期選取模式 ──
function startDatePick(cat) {
  datePickMode = cat;
  renderCalendar();
  document.querySelector('.section-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelDatePick() {
  datePickMode = null;
  renderCalendar();
}

function pickDate(day) {
  if (!datePickMode) return;
  const cat = datePickMode;
  datePickMode = null;
  document.getElementById(`date-${cat}`).value = day;
  renderCalendar();
  showToast(`已選取 ${day} 日為【${cat}】收款日期`);
}

// ── 支出渲染 ──
function renderExpenses() {
  const grid = document.getElementById('expense-grid');
  grid.innerHTML = '';

  const hasAnyExpense = monthData.expenses.length > 0;
  const opDays = getOperatingDays();

  if (!hasAnyExpense) {
    const initBar = document.createElement('div');
    initBar.className = 'init-fixed-bar';
    initBar.style.gridColumn = '1 / -1';
    initBar.innerHTML = `
      <span>本月尚無支出紀錄，可一鍵套用固定支出（店租、倉庫、網路費、瓦斯、老婆薪資、勞健保）</span>
      <button class="btn-init-fixed" onclick="initFixedExpenses()">⚡ 套用固定支出</button>
    `;
    grid.appendChild(initBar);
  }

  CATEGORIES.forEach(cat => {
    const items = monthData.expenses.filter(e => e.category === cat);
    const total = items.reduce((s, e) => s + (e.amount || 0), 0);
    const defaultItems = (monthData.defaultItems[cat] || []);

    const choutaiAmount = opDays * 250;
    const choutaiHint = (cat === '薪資')
      ? `<div style="margin-top:4px;"><span class="choutai-hint">📌 收攤 = ${opDays}天 × 250 = ${choutaiAmount.toLocaleString()}</span></div>`
      : '';

    const card = document.createElement('div');
    card.className = 'section-card';
    card.innerHTML = `
      <div class="section-title cat-title-${cat}">${cat}</div>
      <table class="expense-table">
        <thead>
          <tr class="cat-header-${cat}">
            <th>項目</th>
            <th>日期</th>
            <th class="text-right">金額</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items.map(e => `
            <tr>
              <td class="cat-${cat}">${e.item_name}</td>
              <td class="expense-date-tag">${e.expense_date ? e.expense_date + '日' : ''}</td>
              <td class="expense-amount num">${(e.amount || 0).toLocaleString()}</td>
              <td class="expense-actions">
                <button class="icon-btn" onclick="openExpenseModal(${e.id},'${cat}','${escHtml(e.item_name)}',${e.amount || 0},${e.expense_date || 0})" title="編輯">✏️</button>
                <button class="icon-btn del" onclick="quickDelete(${e.id})" title="刪除">✕</button>
              </td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2">小計</td>
            <td class="expense-amount num">${total.toLocaleString()}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      ${choutaiHint}
      <div class="add-expense-row" style="margin-top:${choutaiHint ? '6px' : '10px'}">
        <select id="sel-${cat}" onchange="onExpenseSelectChange('${cat}')" style="flex:2">
          ${defaultItems.map(n => `<option value="${n}">${n}</option>`).join('')}
          <option value="__custom__">自訂...</option>
        </select>
        <input type="number" id="amt-${cat}" placeholder="金額" min="0">
        <div style="display:flex;gap:4px;align-items:center;">
          <input type="number" id="date-${cat}" placeholder="日" min="1" max="31" class="date-input" style="width:52px;">
          <button class="btn-icon" onclick="startDatePick('${cat}')" title="從日曆選日期">📅</button>
        </div>
        <button class="btn btn-primary btn-small" onclick="addExpense('${cat}')">+ 新增</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ── 選取支出項目時自動帶入金額 ──
function onExpenseSelectChange(cat) {
  const sel = document.getElementById(`sel-${cat}`);
  const amtInput = document.getElementById(`amt-${cat}`);
  const name = sel.value;

  if (name === '__custom__') {
    amtInput.value = '';
    return;
  }

  if (name === '收攤') {
    amtInput.value = getOperatingDays() * 250;
    return;
  }

  const fixedAmt = monthData.fixedAmounts?.[name];
  if (fixedAmt) {
    amtInput.value = fixedAmt;
  } else {
    amtInput.value = '';
  }
}

// ── 初始化固定支出 ──
async function initFixedExpenses() {
  const choutai_amount = getOperatingDays() * 250;
  try {
    const res = await fetch(`/api/month/${currentYear}/${currentMonth}/init-fixed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choutai_amount })
    });
    const data = await res.json();
    await loadMonth();
    showToast(`已套用固定支出（新增 ${data.added} 項）`);
    refreshHeaderYtd();
  } catch (e) { showToast('⚠️ 套用失敗'); }
}

// ── 匯入歷史資料 ──
async function importHistory() {
  if (!confirm('確定匯入 2026 年 1~5 月歷史資料？\n⚠️ 這會清除並覆蓋已有的 1~5 月資料。')) return;
  try {
    const res = await fetch('/api/import-history/2026', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      await loadMonth();
      await loadAnnual();
      showToast(`歷史資料匯入完成（共 ${data.months} 個月份）`);
    } else {
      showToast('匯入失敗：' + (data.error || '未知錯誤'));
    }
  } catch (e) { showToast('⚠️ 匯入失敗，請確認伺服器連線'); }
}

function escHtml(s) {
  return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ── 損益摘要 ──
function renderSummary() {
  const sales = monthData.sales;
  const storeTotal = sales.filter(s => !s.is_day_off).reduce((a, s) => a + (s.store_amount || 0), 0);
  const dailyUber = sales.filter(s => !s.is_day_off).reduce((a, s) => a + (s.uber_amount || 0), 0);
  const uberMonthly = monthData.uber_monthly || 0;
  const uberTotal = uberMonthly + dailyUber;
  const revenue = storeTotal + uberTotal;
  const opDays = getOperatingDays();
  const avgDaily = opDays > 0 ? revenue / opDays : 0;

  const expBycat = {};
  CATEGORIES.forEach(cat => {
    expBycat[cat] = monthData.expenses.filter(e => e.category === cat).reduce((a, e) => a + (e.amount || 0), 0);
  });
  const totalExp = CATEGORIES.reduce((a, cat) => a + (expBycat[cat] || 0), 0);
  const profit = revenue - totalExp;

  const mini = document.getElementById('mini-summary');
  const uberSub = dailyUber > 0 && uberMonthly > 0
    ? `每日累計 ${dailyUber.toLocaleString()} ＋ 月度 ${uberMonthly.toLocaleString()}`
    : `Uber ${uberTotal.toLocaleString()}`;
  mini.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">本月營業額</div>
      <div class="summary-value highlight num">${revenue.toLocaleString()}</div>
      <div class="summary-sub">門市 ${storeTotal.toLocaleString()} ＋ ${uberSub}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">本月損益</div>
      <div class="summary-value ${profit >= 0 ? 'positive' : 'negative'} num">${profit >= 0 ? '+' : ''}${profit.toLocaleString()}</div>
      <div class="summary-sub">支出合計 ${totalExp.toLocaleString()}</div>
    </div>
  `;

  const plEl = document.getElementById('pl-summary');
  const plClass = profit >= 0 ? 'pl-positive' : 'pl-negative';
  const uberRow = dailyUber > 0 && uberMonthly > 0
    ? `<div class="summary-row"><span>🛵 Uber（每日累計）</span><span class="num">${dailyUber.toLocaleString()}</span></div>
       <div class="summary-row"><span>🛵 Uber（月度手填）</span><span class="num">${uberMonthly.toLocaleString()}</span></div>`
    : `<div class="summary-row"><span>🛵 Uber Eats</span><span class="num">${uberTotal.toLocaleString()}</span></div>`;
  plEl.innerHTML = `
    <div class="section-title">損益明細</div>
    <div class="summary-row"><span>🏪 門市營業額</span><span class="num">${storeTotal.toLocaleString()}</span></div>
    ${uberRow}
    <div class="summary-row total"><span>營業額合計</span><span class="num">${revenue.toLocaleString()}</span></div>
    <div style="height:8px"></div>
    <div class="summary-row"><span>📋 支出小計</span><span class="num">${expBycat['支出'].toLocaleString()}</span></div>
    <div class="summary-row"><span>🥦 原料小計</span><span class="num">${expBycat['原料'].toLocaleString()}</span></div>
    <div class="summary-row"><span>💰 薪資小計</span><span class="num">${expBycat['薪資'].toLocaleString()}</span></div>
    <div class="summary-row total"><span>支出合計</span><span class="num">${totalExp.toLocaleString()}</span></div>
    <div style="height:8px"></div>
    <div class="summary-row ${plClass}">
      <span>本月損益</span>
      <span class="num">${profit >= 0 ? '+' : ''}${profit.toLocaleString()}</span>
    </div>
    <div class="summary-row" style="color:var(--text-light); font-size:0.78rem;">
      <span>營業天數 ${opDays} 天</span>
      <span>日均 ${Math.round(avgDaily).toLocaleString()}</span>
    </div>
  `;

  document.getElementById('header-summary').innerHTML =
    `本月損益 <span style="font-weight:700; color:${profit >= 0 ? '#5EC882' : '#DC6E6E'}">${profit >= 0 ? '+' : ''}${profit.toLocaleString()}</span>`;
}

// ── 每日 Modal ──
function openDayModal(day, s) {
  document.getElementById('modal-title').textContent =
    `${currentYear}年${MONTHS[currentMonth-1]} ${day}日`;
  document.getElementById('modal-day').value = day;
  document.getElementById('modal-dayoff').checked = !!s.is_day_off;
  document.getElementById('modal-store').value = s.store_amount || '';
  document.getElementById('modal-uber').value = s.uber_amount || '';
  document.getElementById('modal-inputs').style.opacity = s.is_day_off ? '0.4' : '1';
  document.getElementById('day-modal').classList.add('open');
  setTimeout(() => document.getElementById('modal-store').focus(), 50);
}

function toggleDayOff() {
  const isDayOff = document.getElementById('modal-dayoff').checked;
  document.getElementById('modal-inputs').style.opacity = isDayOff ? '0.4' : '1';
}

async function saveDay() {
  const day = parseInt(document.getElementById('modal-day').value);
  const isDayOff = document.getElementById('modal-dayoff').checked;
  const store = parseFloat(document.getElementById('modal-store').value) || 0;
  const uber = parseFloat(document.getElementById('modal-uber').value) || 0;

  try {
    await fetch('/api/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: currentYear, month: currentMonth, day,
        store_amount: isDayOff ? 0 : store,
        uber_amount: isDayOff ? 0 : uber,
        is_day_off: isDayOff
      })
    });
    closeDayModal();
    await loadMonth();
    showToast('已儲存');
    refreshHeaderYtd();
  } catch (e) { showToast('⚠️ 儲存失敗'); }
}

function closeDayModal() {
  document.getElementById('day-modal').classList.remove('open');
}

// ── 新增支出 ──
async function addExpense(cat) {
  const selEl = document.getElementById(`sel-${cat}`);
  let name = selEl.value;
  if (name === '__custom__') {
    name = prompt('請輸入自訂項目名稱：');
    if (!name) return;
  }
  const amount = parseFloat(document.getElementById(`amt-${cat}`).value) || 0;
  const dateVal = parseInt(document.getElementById(`date-${cat}`).value) || null;

  try {
    await fetch('/api/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: currentYear, month: currentMonth,
        category: cat, item_name: name,
        amount, expense_date: dateVal,
        sort_order: monthData.expenses.filter(e => e.category === cat).length
      })
    });
    document.getElementById(`amt-${cat}`).value = '';
    document.getElementById(`date-${cat}`).value = '';
    await loadMonth();
    showToast('已新增');
    refreshHeaderYtd();
  } catch (e) { showToast('⚠️ 新增失敗'); }
}

// ── 支出編輯 Modal ──
function openExpenseModal(id, cat, name, amount, date) {
  editingExpenseId = id;
  editingExpenseCategory = cat;
  document.getElementById('exp-modal-title').textContent = `編輯${cat}項目`;
  document.getElementById('exp-modal-id').value = id;
  document.getElementById('exp-modal-name').value = name;
  document.getElementById('exp-modal-amount').value = amount;
  document.getElementById('exp-modal-date').value = date || '';
  document.getElementById('expense-modal').classList.add('open');
  setTimeout(() => document.getElementById('exp-modal-amount').focus(), 50);
}

async function saveExpense() {
  const id = document.getElementById('exp-modal-id').value;
  const name = document.getElementById('exp-modal-name').value.trim();
  const amount = parseFloat(document.getElementById('exp-modal-amount').value) || 0;
  const date = parseInt(document.getElementById('exp-modal-date').value) || null;
  if (!name) { showToast('請填寫項目名稱'); return; }

  try {
    await fetch(`/api/expense/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_name: name, amount, expense_date: date })
    });
    closeExpenseModal();
    await loadMonth();
    showToast('已更新');
    refreshHeaderYtd();
  } catch (e) { showToast('⚠️ 更新失敗'); }
}

async function deleteExpense() {
  if (!confirm('確定刪除此支出項目？')) return;
  const id = document.getElementById('exp-modal-id').value;
  try {
    await fetch(`/api/expense/${id}`, { method: 'DELETE' });
    closeExpenseModal();
    await loadMonth();
    showToast('已刪除');
    refreshHeaderYtd();
  } catch (e) { showToast('⚠️ 刪除失敗'); }
}

async function quickDelete(id) {
  if (!confirm('確定刪除？')) return;
  try {
    await fetch(`/api/expense/${id}`, { method: 'DELETE' });
    await loadMonth();
    showToast('已刪除');
    refreshHeaderYtd();
  } catch (e) { showToast('⚠️ 刪除失敗'); }
}

function closeExpenseModal() {
  document.getElementById('expense-modal').classList.remove('open');
}

// ── 備註 ──
async function saveNote() {
  const note = document.getElementById('note-area').value;
  await fetch('/api/note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: currentYear, month: currentMonth, note })
  });
  showToast('備註已儲存');
}

// ── 年度總覽 ──
async function loadAnnual() {
  const year = document.getElementById('year-select')?.value || currentYear;
  const res = await fetch(`/api/summary/${year}`);
  const data = await res.json();
  const summary = data.summary;
  const ytd = data.ytd;

  const tbody = document.getElementById('annual-tbody');
  const tfoot = document.getElementById('annual-total');

  let totalStore = 0, totalUber = 0, totalRev = 0, totalExp = 0, totalProfit = 0, totalDays = 0;

  tbody.innerHTML = summary.map(m => {
    totalStore += m.store_total;
    totalUber += m.uber_total;
    totalRev += m.revenue;
    totalExp += m.expenses;
    totalProfit += m.profit;
    totalDays += m.operating_days;
    const pl = m.profit;
    const plClass = pl > 0 ? 'positive-cell' : pl < 0 ? 'negative-cell' : '';
    const avg = m.operating_days > 0 ? Math.round(m.revenue / m.operating_days) : 0;
    const isCurrent = m.is_current;
    return `
      <tr${isCurrent ? ' class="current-month-row"' : ''}>
        <td><span class="month-link" onclick="goToMonth(${year}, ${m.month})">${m.month}月${isCurrent ? ' ▶' : ''}</span></td>
        <td class="num">${m.store_total > 0 ? m.store_total.toLocaleString() : '—'}</td>
        <td class="num">${m.uber_total > 0 ? m.uber_total.toLocaleString() : '—'}</td>
        <td class="num">${m.revenue > 0 ? m.revenue.toLocaleString() : '—'}</td>
        <td class="num">${m.expenses > 0 ? m.expenses.toLocaleString() : '—'}</td>
        <td class="num ${plClass}">${m.revenue > 0 || m.expenses > 0 ? (pl >= 0 ? '+' : '') + pl.toLocaleString() : '—'}</td>
        <td class="num">${m.operating_days > 0 ? m.operating_days : '—'}</td>
        <td class="num">${avg > 0 ? avg.toLocaleString() : '—'}</td>
      </tr>
    `;
  }).join('');

  const totalPLClass = totalProfit > 0 ? 'positive-cell' : totalProfit < 0 ? 'negative-cell' : '';
  const totalAvg = totalDays > 0 ? Math.round(totalRev / totalDays) : 0;
  tfoot.innerHTML = `
    <td>全年合計</td>
    <td class="num">${totalStore.toLocaleString()}</td>
    <td class="num">${totalUber.toLocaleString()}</td>
    <td class="num">${totalRev.toLocaleString()}</td>
    <td class="num">${totalExp.toLocaleString()}</td>
    <td class="num ${totalPLClass}">${totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString()}</td>
    <td class="num">${totalDays}</td>
    <td class="num">${totalAvg.toLocaleString()}</td>
  `;

  // 截至目前累計損益
  const ytdEl = document.getElementById('ytd-summary');
  if (ytdEl && ytd) {
    const ytdPLClass = ytd.profit >= 0 ? 'positive' : 'negative';
    ytdEl.innerHTML = `
      <div class="ytd-row">
        <span class="ytd-label">📊 截至目前年度累計損益</span>
        <span class="ytd-profit ${ytdPLClass} num">${ytd.profit >= 0 ? '+' : ''}${ytd.profit.toLocaleString()}</span>
      </div>
      <div class="ytd-detail">
        累計營收 <strong>${ytd.revenue.toLocaleString()}</strong> 元 ／ 累計支出 <strong>${ytd.expenses.toLocaleString()}</strong> 元
      </div>
    `;
  }

  // 同步更新 header YTD
  const headerYtd = document.getElementById('header-ytd');
  if (headerYtd && ytd && parseInt(year) === new Date().getFullYear()) {
    headerYtd.innerHTML = `年度累計 <span style="font-weight:700; color:${ytd.profit >= 0 ? '#5EC882' : '#DC6E6E'}">${ytd.profit >= 0 ? '+' : ''}${ytd.profit.toLocaleString()}</span>`;
  }
}

function goToMonth(year, month) {
  currentYear = parseInt(year);
  currentMonth = parseInt(month);
  switchTabDirect('monthly');
  loadMonth();
}

function switchTabDirect(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', (tab === 'monthly' && i === 0) || (tab === 'annual' && i === 1));
  });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + tab).classList.add('active');
}

// ── 通用 ──
function closeModal(event) {
  if (event.target.classList.contains('modal-overlay')) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    datePickMode = null;
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
    if (datePickMode) { datePickMode = null; renderCalendar(); }
  }
});
