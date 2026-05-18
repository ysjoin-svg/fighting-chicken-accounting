const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'accounting.db'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

db.exec(`
  CREATE TABLE IF NOT EXISTS daily_sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    store_amount REAL DEFAULT 0,
    uber_amount REAL DEFAULT 0,
    is_day_off INTEGER DEFAULT 0,
    UNIQUE(year, month, day)
  );
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    category TEXT NOT NULL,
    item_name TEXT NOT NULL,
    amount REAL DEFAULT 0,
    expense_date INTEGER,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS month_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    note TEXT,
    uber_monthly REAL DEFAULT 0,
    UNIQUE(year, month)
  );
`);

// 安全加欄位（若不存在）
try { db.exec('ALTER TABLE month_notes ADD COLUMN uber_monthly REAL DEFAULT 0'); } catch(e) {}

// ── 固定支出預設金額 ──
const DEFAULT_FIXED_AMOUNTS = {
  '店租': 15000, '倉庫': 3000, '網路費': 199, '瓦斯': 640,
  '廁所': 200, '清潔費': 200,
  '老婆': 42000, '勞健保': 5842,
};

// ── 每月固定支出模板 ──
const FIXED_EXPENSES = [
  { category: '支出', item_name: '店租',   amount: 15000, sort_order: 0 },
  { category: '支出', item_name: '倉庫',   amount: 3000,  sort_order: 1 },
  { category: '支出', item_name: '網路費', amount: 199,   sort_order: 2 },
  { category: '支出', item_name: '瓦斯',   amount: 640,   sort_order: 3 },
  { category: '薪資', item_name: '老婆',   amount: 42000, sort_order: 0 },
  { category: '薪資', item_name: '勞健保', amount: 5842,  sort_order: 1 },
];

// ── 下拉選單項目 ──
const DEFAULT_EXPENSE_ITEMS = {
  '支出': ['店租','倉庫','攤位電費','倉庫電費','冰塊','小北','酒','包材','菜單','洗碗精','瓦斯','文具','自強','網路費','清潔費','廁所','冰箱'],
  '原料': ['總部','壹百盛','鹿小姐','額外採買','豐收','翔一','米'],
  '薪資': ['老婆','收攤','勞健保','收攤支援'],
};

// ── 2026 年歷史資料 ──
const HISTORY_2026 = {
  1: {
    sales: [
      {day:1,s:0,off:1},{day:2,s:4005},{day:3,s:7140},{day:4,s:5925},
      {day:5,s:4085},{day:6,s:6580},{day:7,s:4265},{day:8,s:0,off:1},
      {day:9,s:6140},{day:10,s:5026},{day:11,s:0,off:1},
      {day:12,s:6625},{day:13,s:6850},{day:14,s:9220},{day:15,s:0,off:1},
      {day:16,s:5475},{day:17,s:7170},{day:18,s:5015},
      {day:19,s:6825},{day:20,s:5530},{day:21,s:6400},{day:22,s:0,off:1},{day:23,s:0,off:1},
      {day:24,s:4705},{day:25,s:7300},
      {day:26,s:6425},{day:27,s:4665},{day:28,s:7160},{day:29,s:0,off:1},
      {day:30,s:7365},{day:31,s:4215},
    ],
    uber: 17872,
    expenses: [
      {cat:'支出',n:'店租',a:15000},{cat:'支出',n:'倉庫',a:4000},
      {cat:'支出',n:'倉庫電費',a:1800},{cat:'支出',n:'攤位電費',a:3593},
      {cat:'支出',n:'冰塊',a:800},{cat:'支出',n:'酒',a:1670},
      {cat:'支出',n:'瓦斯',a:640},{cat:'支出',n:'自強',a:5000},
      {cat:'支出',n:'網路費',a:199},{cat:'支出',n:'清潔費',a:200},
      {cat:'原料',n:'總部',a:96875},{cat:'原料',n:'壹百盛',a:20205},{cat:'原料',n:'鹿小姐',a:8406},
      {cat:'薪資',n:'老婆',a:38000},{cat:'薪資',n:'收攤',a:4500},
      {cat:'薪資',n:'勞健保',a:5842},{cat:'薪資',n:'收攤支援',a:1750},
    ],
  },
  2: {
    sales: [
      {day:1,s:5685},{day:2,s:5265},{day:3,s:6110},{day:4,s:6010},
      {day:5,s:9450},{day:6,s:6875},{day:7,s:4720},{day:8,s:0,off:1},
      {day:9,s:0,off:1},{day:10,s:5255},{day:11,s:5495},{day:12,s:6775},
      {day:13,s:0,off:1},{day:14,s:5005},{day:15,s:8124},
      {day:16,s:0,off:1},{day:17,s:0,off:1},{day:18,s:0,off:1},
      {day:19,s:0,off:1},{day:20,s:0,off:1},
      {day:21,s:7835},{day:22,s:4730},
      {day:23,s:9920},{day:24,s:8505},{day:25,s:9155},{day:26,s:0,off:1},
      {day:27,s:5805},{day:28,s:4355},
    ],
    uber: 9061,
    expenses: [
      {cat:'支出',n:'店租',a:15000},{cat:'支出',n:'倉庫',a:3000},
      {cat:'支出',n:'廁所',a:200},{cat:'支出',n:'攤位電費',a:3690},
      {cat:'支出',n:'冰塊',a:720},{cat:'支出',n:'瓦斯',a:640},
      {cat:'支出',n:'翔一',a:792},{cat:'支出',n:'自強',a:5340},{cat:'支出',n:'網路費',a:199},
      {cat:'原料',n:'總部',a:53690},{cat:'原料',n:'壹百盛',a:13392},{cat:'原料',n:'鹿小姐',a:5483},
      {cat:'薪資',n:'老婆',a:38000},{cat:'薪資',n:'收攤',a:4750},{cat:'薪資',n:'勞健保',a:5842},
    ],
  },
  3: {
    sales: [
      {day:1,s:0,off:1},{day:2,s:0,off:1},
      {day:3,s:11410},{day:4,s:7135},{day:5,s:5530},{day:6,s:5010},{day:7,s:7690},
      {day:8,s:0,off:1},
      {day:9,s:7215},{day:10,s:6005},{day:11,s:4605},{day:12,s:6550},
      {day:13,s:0,off:1},{day:14,s:9045},{day:15,s:8900},
      {day:16,s:9095},{day:17,s:8800},{day:18,s:8535},{day:19,s:0,off:1},
      {day:20,s:7565},{day:21,s:5205},{day:22,s:6690},
      {day:23,s:8960},{day:24,s:9835},{day:25,s:7795},{day:26,s:0,off:1},
      {day:27,s:9115},{day:28,s:6410},{day:29,s:7805},
      {day:30,s:8270},{day:31,s:9050},
    ],
    uber: 22249,
    expenses: [
      {cat:'支出',n:'店租',a:15000},{cat:'支出',n:'倉庫',a:3000},
      {cat:'支出',n:'廁所',a:200},{cat:'支出',n:'攤位電費',a:5183},
      {cat:'支出',n:'冰塊',a:1040},{cat:'支出',n:'包材',a:1230},
      {cat:'支出',n:'瓦斯',a:640},{cat:'支出',n:'網路費',a:199},{cat:'支出',n:'冰箱',a:6000},
      {cat:'原料',n:'總部',a:95235},{cat:'原料',n:'壹百盛',a:16858},
      {cat:'原料',n:'鹿小姐',a:10414},{cat:'原料',n:'豐收',a:1619},
      {cat:'原料',n:'額外採買',a:1605},{cat:'原料',n:'額外採買',a:540},
      {cat:'薪資',n:'老婆',a:42000},{cat:'薪資',n:'收攤',a:6250},{cat:'薪資',n:'勞健保',a:5842},
    ],
  },
  4: {
    sales: [
      {day:1,s:7630},{day:2,s:0,off:1},{day:3,s:8250},{day:4,s:0,off:1},{day:5,s:9525},
      {day:6,s:9760},{day:7,s:6688},{day:8,s:8905},{day:9,s:0,off:1},
      {day:10,s:8540},{day:11,s:0,off:1},{day:12,s:9665},
      {day:13,s:11540},{day:14,s:8200},{day:15,s:7170},{day:16,s:0,off:1},
      {day:17,s:10000},{day:18,s:7050},{day:19,s:7150},
      {day:20,s:9410},{day:21,s:7710},{day:22,s:8075},{day:23,s:6975},
      {day:24,s:0,off:1},{day:25,s:7610},{day:26,s:7055},
      {day:27,s:7840},{day:28,s:10165},{day:29,s:9355},{day:30,s:0,off:1},
    ],
    uber: 20540,
    expenses: [
      {cat:'支出',n:'店租',a:15000},{cat:'支出',n:'倉庫',a:3000},
      {cat:'支出',n:'廁所',a:200},{cat:'支出',n:'倉庫電費',a:1570},
      {cat:'支出',n:'攤位電費',a:5333},{cat:'支出',n:'冰塊',a:1200},
      {cat:'支出',n:'翔一',a:568},{cat:'支出',n:'包材',a:1750},
      {cat:'支出',n:'瓦斯',a:640},{cat:'支出',n:'網路費',a:199},
      {cat:'原料',n:'總部',a:102150},{cat:'原料',n:'鹿小姐',a:10844},
      {cat:'原料',n:'豐收',a:3136},{cat:'原料',n:'額外採買',a:5666},
      {cat:'原料',n:'額外採買',a:6037},{cat:'原料',n:'額外採買',a:5874},
      {cat:'原料',n:'幫師大店叫貨',a:-780},
      {cat:'薪資',n:'老婆',a:42000},{cat:'薪資',n:'收攤',a:5750},{cat:'薪資',n:'勞健保',a:5842},
    ],
  },
  5: {
    sales: [
      {day:1,s:5500},{day:2,s:8755},{day:3,s:9500},
      {day:4,s:9910},{day:5,s:8115},{day:6,s:9330},{day:7,s:0,off:1},
      {day:8,s:8462},{day:9,s:7940},{day:10,s:11420},
      {day:11,s:0,off:1},{day:12,s:11755},{day:13,s:12045},{day:14,s:0,off:1},
      {day:15,s:11520},{day:16,s:5875},{day:17,s:5905},{day:18,s:12630},
      {day:20,s:0,off:1},{day:21,s:0,off:1},{day:28,s:0,off:1},
    ],
    uber: 0,
    expenses: [
      {cat:'支出',n:'店租',a:15000},{cat:'支出',n:'倉庫',a:3000},
      {cat:'支出',n:'廁所',a:200},{cat:'支出',n:'翔一',a:594},
      {cat:'支出',n:'包材',a:1620},{cat:'支出',n:'網路費',a:199},
      {cat:'原料',n:'豐收',a:7045},{cat:'原料',n:'額外採買',a:6563},{cat:'原料',n:'額外採買',a:6494},
      {cat:'薪資',n:'勞健保',a:5842},{cat:'薪資',n:'收攤',a:3750},
    ],
  },
};

// ── API: 取得月份資料 ──
app.get('/api/month/:year/:month', (req, res) => {
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);
  const sales = db.prepare('SELECT * FROM daily_sales WHERE year=? AND month=? ORDER BY day').all(year, month);
  const expenses = db.prepare('SELECT * FROM expenses WHERE year=? AND month=? ORDER BY category, sort_order, id').all(year, month);
  const noteRow = db.prepare('SELECT note, uber_monthly FROM month_notes WHERE year=? AND month=?').get(year, month);
  res.json({
    sales, expenses,
    note: noteRow?.note || '',
    uber_monthly: noteRow?.uber_monthly || 0,
    defaultItems: DEFAULT_EXPENSE_ITEMS,
    fixedAmounts: DEFAULT_FIXED_AMOUNTS,
  });
});

// ── API: 儲存每日營業額 ──
app.post('/api/daily', (req, res) => {
  const { year, month, day, store_amount, uber_amount, is_day_off } = req.body;
  db.prepare(`
    INSERT INTO daily_sales (year,month,day,store_amount,uber_amount,is_day_off)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(year,month,day) DO UPDATE SET
      store_amount=excluded.store_amount,
      uber_amount=excluded.uber_amount,
      is_day_off=excluded.is_day_off
  `).run(year, month, day, store_amount||0, uber_amount||0, is_day_off?1:0);
  res.json({ ok: true });
});

// ── API: 儲存月度 Uber 總額 ──
app.post('/api/month/:year/:month/uber', (req, res) => {
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);
  const { uber_monthly } = req.body;
  db.prepare(`
    INSERT INTO month_notes (year,month,uber_monthly,note)
    VALUES (?,?,?,'')
    ON CONFLICT(year,month) DO UPDATE SET uber_monthly=excluded.uber_monthly
  `).run(year, month, uber_monthly||0);
  res.json({ ok: true });
});

// ── API: 新增支出項目 ──
app.post('/api/expense', (req, res) => {
  const { year, month, category, item_name, amount, expense_date, sort_order } = req.body;
  const result = db.prepare(`
    INSERT INTO expenses (year,month,category,item_name,amount,expense_date,sort_order)
    VALUES (?,?,?,?,?,?,?)
  `).run(year, month, category, item_name, amount||0, expense_date||null, sort_order||0);
  res.json({ ok: true, id: result.lastInsertRowid });
});

// ── API: 更新支出項目 ──
app.put('/api/expense/:id', (req, res) => {
  const { item_name, amount, expense_date } = req.body;
  db.prepare('UPDATE expenses SET item_name=?,amount=?,expense_date=? WHERE id=?')
    .run(item_name, amount||0, expense_date||null, req.params.id);
  res.json({ ok: true });
});

// ── API: 刪除支出項目 ──
app.delete('/api/expense/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── API: 儲存備註 ──
app.post('/api/note', (req, res) => {
  const { year, month, note } = req.body;
  db.prepare(`
    INSERT INTO month_notes (year,month,note,uber_monthly) VALUES (?,?,?,0)
    ON CONFLICT(year,month) DO UPDATE SET note=excluded.note
  `).run(year, month, note);
  res.json({ ok: true });
});

// ── API: 初始化固定支出（含收攤計算）──
app.post('/api/month/:year/:month/init-fixed', (req, res) => {
  const year = parseInt(req.params.year);
  const month = parseInt(req.params.month);
  const { choutai_amount } = req.body; // 前端傳入收攤金額

  const existing = db.prepare('SELECT item_name,category FROM expenses WHERE year=? AND month=?').all(year, month);
  const existingKeys = new Set(existing.map(e => `${e.category}:${e.item_name}`));

  const insertStmt = db.prepare('INSERT INTO expenses (year,month,category,item_name,amount,sort_order) VALUES (?,?,?,?,?,?)');
  let added = 0;
  db.transaction(() => {
    for (const fe of FIXED_EXPENSES) {
      if (!existingKeys.has(`${fe.category}:${fe.item_name}`)) {
        insertStmt.run(year, month, fe.category, fe.item_name, fe.amount, fe.sort_order);
        added++;
      }
    }
    // 加入收攤（若不存在且有天數）
    if (!existingKeys.has('薪資:收攤') && choutai_amount > 0) {
      insertStmt.run(year, month, '薪資', '收攤', choutai_amount, 2);
      added++;
    }
  })();
  res.json({ ok: true, added });
});

// ── API: 匯入歷史資料 ──
app.post('/api/import-history/:year', (req, res) => {
  const year = parseInt(req.params.year);
  const data = year === 2026 ? HISTORY_2026 : null;
  if (!data) return res.status(400).json({ error: '無此年度資料' });

  const delSales = db.prepare('DELETE FROM daily_sales WHERE year=? AND month=?');
  const delExp   = db.prepare('DELETE FROM expenses WHERE year=? AND month=?');
  const insSale  = db.prepare(`
    INSERT INTO daily_sales (year,month,day,store_amount,is_day_off)
    VALUES (?,?,?,?,?)
    ON CONFLICT(year,month,day) DO UPDATE SET store_amount=excluded.store_amount,is_day_off=excluded.is_day_off
  `);
  const insExp = db.prepare('INSERT INTO expenses (year,month,category,item_name,amount,sort_order) VALUES (?,?,?,?,?,?)');
  const insUber = db.prepare(`
    INSERT INTO month_notes (year,month,uber_monthly,note) VALUES (?,?,?,'')
    ON CONFLICT(year,month) DO UPDATE SET uber_monthly=excluded.uber_monthly
  `);

  db.transaction(() => {
    for (const [m, md] of Object.entries(data)) {
      const month = parseInt(m);
      delSales.run(year, month);
      delExp.run(year, month);
      md.sales.forEach(s => insSale.run(year, month, s.day, s.s||0, s.off?1:0));
      md.expenses.forEach((e, i) => insExp.run(year, month, e.cat, e.n, e.a, i));
      insUber.run(year, month, md.uber);
    }
  })();
  res.json({ ok: true, months: Object.keys(data).length });
});

// ── API: 年度摘要 ──
app.get('/api/summary/:year', (req, res) => {
  const year = parseInt(req.params.year);
  const today = new Date();
  const curMonth = (year === today.getFullYear()) ? today.getMonth() + 1 : 12;
  const summary = [];
  let ytdRevenue = 0, ytdExpenses = 0;

  for (let m = 1; m <= 12; m++) {
    const sr = db.prepare(`SELECT SUM(store_amount) as store, COUNT(CASE WHEN is_day_off=0 AND store_amount>0 THEN 1 END) as days FROM daily_sales WHERE year=? AND month=?`).get(year, m);
    const uberRow = db.prepare('SELECT uber_monthly FROM month_notes WHERE year=? AND month=?').get(year, m);
    const expRow  = db.prepare('SELECT SUM(amount) as total FROM expenses WHERE year=? AND month=?').get(year, m);
    const storeTotal = sr.store || 0;
    const uberTotal  = uberRow?.uber_monthly || 0;
    const revenue    = storeTotal + uberTotal;
    const expenses   = expRow.total || 0;
    if (m <= curMonth) { ytdRevenue += revenue; ytdExpenses += expenses; }
    summary.push({
      month: m, store_total: storeTotal, uber_total: uberTotal,
      revenue, expenses, profit: revenue - expenses,
      operating_days: sr.days || 0,
      is_current: m === curMonth,
    });
  }
  res.json({ summary, ytd: { revenue: ytdRevenue, expenses: ytdExpenses, profit: ytdRevenue - ytdExpenses } });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`戰鬥雞記帳軟體已啟動：http://localhost:${PORT}`));
