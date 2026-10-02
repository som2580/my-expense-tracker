/* ============================================================
   ບັນທຶກການເງິນສ່ວນຕົວ - FRONTEND
   ============================================================
   ພາກສ່ວນ:
   1. Config & Constants
   2. Utils
   3. API Layer
   4. State
   5. UI Helpers (Toast, Loading, Modal)
   6. Router / Navigation
   7. Dashboard
   8. Transactions
   9. Forms (Add / Edit)
   10. Modals (Detail / Confirm)
   11. Charts
   12. Init & Events
   ============================================================ */

/* ============ 1. CONFIG & CONSTANTS ============ */
const CONFIG = {
  // ⚠️ แก้ URL นี้หลังจาก Deploy Google Apps Script
  API_URL: localStorage.getItem('pf_api_url') || 'https://script.google.com/macros/s/AKfycbxl8euBNYOBUcOFy1zNSOwF0Q97NmNY8AFCThpKkmjImDCxBYj5MPmUpuOkIkbUwakj/exec',
  CURRENCY: localStorage.getItem('pf_currency') || 'LAK',
  CURRENCY_SYMBOLS: {
    LAK: '₭',
    THB: '฿',
    USD: '$'
  },
  RECENT_LIMIT: 8
};

const CATEGORIES = {
  income: ['ເງິນເດືອນ', 'ວຽກເສີມ', 'ຂາຍສິນຄ້າ', 'ໂບນັດ', 'ດອກເບ້ຍ', 'ລາຍໄດ້ອື່ນໆ'],
  expense: ['ອາຫານ', 'ເດີນທາງ', 'ຊື້ເຄື່ອງ', 'ຄ່າໄຟ', 'ຄ່ານ້ຳ', 'ອິນເຕີເນັດ', 'ຄ່າໂທລະສັບ', 'ສຸຂະພາບ', 'ການສຶກສາ', 'ຄວາມບັນເທີງ', 'ທີ່ພັກ', 'ອື່ນໆ']
};

const PAYMENT_METHODS = ['ເງິນສົດ', 'ທະນາຄານ', 'Mobile Banking', 'QR Payment', 'ບັດເຄຣດິດ', 'ອື່ນໆ'];

/* ============ 2. UTILS ============ */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function getCurrencySymbol() {
  return CONFIG.CURRENCY_SYMBOLS[CONFIG.CURRENCY] || '₭';
}

function formatCurrency(amount) {
  const n = Number(amount) || 0;
  const sign = n < 0 ? '-' : '';
  return sign + getCurrencySymbol() + Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayISO() { return toISODate(new Date()); }

function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ============ 3. API LAYER ============ */
const API = {
  async request(action, payload = null, method = 'POST') {
    if (!CONFIG.API_URL || CONFIG.API_URL.includes('AKfycbxxxx')) {
      throw new Error('ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ API URL ກະລຸນາໄປທີ່ໜ້າຕັ້ງຄ່າ');
    }

    const opts = {
      method: method,
      redirect: 'follow',
      headers: {}
    };

    let url = CONFIG.API_URL;

    if (method === 'GET') {
      url += `?action=${encodeURIComponent(action)}` +
             (payload && payload.id ? `&id=${encodeURIComponent(payload.id)}` : '');
    } else {
      opts.headers['Content-Type'] = 'text/plain;charset=utf-8';
      opts.body = JSON.stringify({ action, ...payload });
    }

    // ✅ ເພີ່ມ Timeout 15 ວິນາທີ
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    opts.signal = controller.signal;

    let res;
    try {
      res = await fetch(url, opts);
      clearTimeout(timeoutId);
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('ໝົດເວລາເຊື່ອມຕໍ່ ກະລຸນາລອງໃໝ່');
      }
      throw new Error('ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບເຊີບເວີໄດ້ ກະລຸນາກວດສອບອິນເຕີເນັດ');
    }

    if (!res.ok) {
      throw new Error('ເຊີບເວີຕອບກັບຜິດພາດ (HTTP ' + res.status + ')');
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('ຮູບແບບຂໍ້ມູນຕອບກັບບໍ່ຖືກຕ້ອງ');
    }

    if (!data.success) {
      throw new Error(data.message || 'ເກີດຂໍ້ຜິດພາດ');
    }

    return data.data;
  },

  list() { return this.request('list', null, 'GET'); },
  create(payload) { return this.request('create', payload, 'POST'); },
  update(payload) { return this.request('update', payload, 'POST'); },
  remove(id) { return this.request('delete', { id }, 'POST'); }
};

/* ============ 4. STATE ============ */
const State = {
  transactions: [],
  filtered: [],
  currentPage: 'dashboard',
  period: 'thisMonth',
  customRange: { start: null, end: null },
  filters: {
    search: '',
    type: '',
    category: '',
    payment: '',
    sort: 'date-desc'
  },
  charts: { bar: null, pie: null },
  pendingDeleteId: null,
  currentDetailId: null
};

/* ============ 5. UI HELPERS ============ */
const UI = {
  loadingCount: 0,

  showLoading() {
    this.loadingCount++;
    $('#loadingOverlay').classList.add('show');
  },

  hideLoading() {
    this.loadingCount = Math.max(0, this.loadingCount - 1);
    if (this.loadingCount === 0) {
      $('#loadingOverlay').classList.remove('show');
    }
  },

  toast(type, title, message = '') {
    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info'
    };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info}"></i>
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        ${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ''}
      </div>
    `;
    $('#toastContainer').appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s, transform 0.3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  },

  openModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.remove('show');
      if ($$('.modal-overlay.show').length === 0) {
        document.body.style.overflow = '';
      }
    }
  },

  closeAllModals() {
    $$('.modal-overlay.show').forEach(m => m.classList.remove('show'));
    document.body.style.overflow = '';
  }
};

/* ============ 6. ROUTER / NAVIGATION ============ */
function navigateTo(page) {
  State.currentPage = page;

  $$('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  $$('.nav-item, .mobile-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });

  const titles = {
    dashboard: 'ພາບລວມ',
    transactions: 'ລາຍການທັງໝົດ',
    add: 'ເພີ່ມລາຍການ',
    settings: 'ຕັ້ງຄ່າ'
  };
  $('#headerTitle').textContent = titles[page] || 'ພາບລວມ';

  closeSidebar();

  if (page === 'add') {
    resetAddForm();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSidebar() {
  $('#sidebar').classList.add('open');
  $('#sidebarBackdrop').classList.add('show');
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sidebarBackdrop').classList.remove('show');
}

/* ============ 7. DASHBOARD ============ */
function getPeriodRange() {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  switch (State.period) {
    case 'today':
      break;
    case '7days':
      start.setDate(now.getDate() - 6);
      break;
    case 'thisMonth':
      start.setDate(1);
      break;
    case 'lastMonth':
      start.setMonth(now.getMonth() - 1, 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisYear':
      start.setMonth(0, 1);
      break;
    case 'all':
      start.setFullYear(1970, 0, 1);
      end.setFullYear(2100, 11, 31);
      break;
    case 'custom':
      if (State.customRange.start && State.customRange.end) {
        return {
          start: new Date(State.customRange.start + 'T00:00:00'),
          end: new Date(State.customRange.end + 'T23:59:59')
        };
      }
      break;
  }
  return { start, end };
}

function filterByPeriod(list) {
  const { start, end } = getPeriodRange();
  return list.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date + 'T00:00:00');
    return d >= start && d <= end;
  });
}

function renderDashboard() {
  const periodList = filterByPeriod(State.transactions);

  let totalIncome = 0, totalExpense = 0;
  periodList.forEach(t => {
    if (t.type === 'income') totalIncome += t.amount;
    else if (t.type === 'expense') totalExpense += t.amount;
  });

  const balance = totalIncome - totalExpense;

  $('#cardIncome').textContent = formatCurrency(totalIncome);
  $('#cardExpense').textContent = formatCurrency(totalExpense);
  $('#cardBalance').textContent = formatCurrency(balance);
  $('#cardCount').textContent = periodList.length.toLocaleString();

  $('#cardIncomeSub').textContent = `${periodList.filter(t => t.type === 'income').length} ລາຍການ`;
  $('#cardExpenseSub').textContent = `${periodList.filter(t => t.type === 'expense').length} ລາຍການ`;
  $('#cardBalanceSub').textContent = balance >= 0 ? 'ຢູ່ໃນເກນດີ' : 'ໃຊ້ຈ່າຍເກີນລາຍຮັບ';
  $('#cardCountSub').textContent = getPeriodLabel();

  // ສະຫຼຸບເດືອນ
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const monthList = State.transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d >= monthStart && d <= monthEnd;
  });

  let mIncome = 0, mExpense = 0;
  const catTotals = {};
  monthList.forEach(t => {
    if (t.type === 'income') mIncome += t.amount;
    if (t.type === 'expense') {
      mExpense += t.amount;
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    }
  });

  $('#monthIncome').textContent = formatCurrency(mIncome);
  $('#monthExpense').textContent = formatCurrency(mExpense);
  $('#monthBalance').textContent = formatCurrency(mIncome - mExpense);

  let topCat = '—';
  let topAmt = 0;
  Object.entries(catTotals).forEach(([cat, amt]) => {
    if (amt > topAmt) { topAmt = amt; topCat = cat; }
  });
  $('#topCategory').textContent = topAmt > 0
    ? `${topCat} (${formatCurrency(topAmt)})`
    : '—';

  // ລາຍການຫຼ້າສຸດ
  renderRecent(State.transactions);
  renderCharts(periodList);
}

function getPeriodLabel() {
  const labels = {
    today: 'ມື້ນີ້',
    '7days': '7 ວັນຜ່ານມາ',
    thisMonth: 'ເດືອນນີ້',
    lastMonth: 'ເດືອນແລ້ວ',
    thisYear: 'ປີນີ້',
    all: 'ທັງໝົດ',
    custom: 'ຊ່ວງທີ່ກຳນົດ'
  };
  return labels[State.period] || '';
}

function renderRecent(list) {
  const container = $('#recentList');
  const recent = [...list]
    .sort((a, b) => {
      const da = new Date(`${a.date}T${a.time || '00:00'}`);
      const db = new Date(`${b.date}T${b.time || '00:00'}`);
      return db - da;
    })
    .slice(0, CONFIG.RECENT_LIMIT);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon"><i class="fa-regular fa-folder-open"></i></div>
        <h3>ຍັງບໍ່ມີລາຍການທຸລະກຳ</h3>
        <p>ເລີ່ມຕົ້ນບັນທຶກລາຍການທຳອິດຂອງທ່ານ</p>
        <button class="btn btn-primary" data-page="add">
          <i class="fa-solid fa-plus"></i> ເພີ່ມລາຍການທຳອິດ
        </button>
      </div>`;
    return;
  }

  container.innerHTML = recent.map(t => {
    const isIncome = t.type === 'income';
    return `
      <button class="recent-item" data-detail="${escapeHtml(t.id)}">
        <div class="trx-icon ${isIncome ? 'income' : 'expense'}">
          <i class="fa-solid ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
        </div>
        <div class="trx-main">
          <div class="trx-title">${escapeHtml(t.description || t.category || '(ບໍ່ມີລາຍລະອຽດ)')}</div>
          <div class="trx-meta">
            <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(formatDate(t.date))}</span>
            ${t.time ? `<span><i class="fa-regular fa-clock"></i> ${escapeHtml(t.time)}</span>` : ''}
            <span>· ${escapeHtml(t.category || '')}</span>
          </div>
        </div>
        <div class="trx-amount ${isIncome ? 'income' : 'expense'}">
          ${isIncome ? '+' : '−'}${formatCurrency(t.amount)}
        </div>
      </button>
    `;
  }).join('');
}

/* ============ 8. TRANSACTIONS ============ */
function applyFilters() {
  const f = State.filters;
  let list = [...State.transactions];

  if (f.search) {
    const q = f.search.toLowerCase();
    list = list.filter(t =>
      (t.description || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      (t.note || '').toLowerCase().includes(q)
    );
  }

  if (f.type) list = list.filter(t => t.type === f.type);
  if (f.category) list = list.filter(t => t.category === f.category);
  if (f.payment) list = list.filter(t => t.paymentMethod === f.payment);

  switch (f.sort) {
    case 'date-asc':
      list.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case 'amount-desc':
      list.sort((a, b) => b.amount - a.amount);
      break;
    case 'amount-asc':
      list.sort((a, b) => a.amount - b.amount);
      break;
    default: // date-desc
      list.sort((a, b) => {
        const da = new Date(`${a.date}T${a.time || '00:00'}`);
        const db = new Date(`${b.date}T${b.time || '00:00'}`);
        return db - da;
      });
  }

  State.filtered = list;
  renderTransactionTable();
}

function renderTransactionTable() {
  const tbody = $('#transactionTableBody');
  const empty = $('#transactionEmpty');
  const list = State.filtered;

  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = list.map(t => {
    const isIncome = t.type === 'income';
    return `
      <tr data-detail="${escapeHtml(t.id)}">
        <td>${escapeHtml(formatDate(t.date))}</td>
        <td>${escapeHtml(t.time || '—')}</td>
        <td>
          <span class="badge ${isIncome ? 'income' : 'expense'}">
            <i class="fa-solid ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
            ${isIncome ? 'ລາຍຮັບ' : 'ລາຍຈ່າຍ'}
          </span>
        </td>
        <td>${escapeHtml(t.category || '—')}</td>
        <td>${escapeHtml(t.description || '—')}</td>
        <td class="num ${isIncome ? 'income' : 'expense'}">
          ${isIncome ? '+' : '−'}${formatCurrency(t.amount)}
        </td>
        <td>${escapeHtml(t.paymentMethod || '—')}</td>
        <td>${escapeHtml(t.note || '—')}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-detail="${escapeHtml(t.id)}" title="ເບິ່ງລາຍລະອຽດ" aria-label="ເບິ່ງລາຍລະອຽດ">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="icon-btn edit" data-edit="${escapeHtml(t.id)}" title="ແກ້ໄຂ" aria-label="ແກ້ໄຂ">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="icon-btn danger" data-delete="${escapeHtml(t.id)}" title="ລຶບ" aria-label="ລຶບ">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function populateFilterOptions() {
  const catSet = new Set();
  const paySet = new Set();
  State.transactions.forEach(t => {
    if (t.category) catSet.add(t.category);
    if (t.paymentMethod) paySet.add(t.paymentMethod);
  });

  const catSel = $('#filterCategory');
  const currentCat = catSel.value;
  catSel.innerHTML = '<option value="">ທຸກໝວດໝູ່</option>' +
    [...catSet].sort().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  catSel.value = currentCat;

  const paySel = $('#filterPayment');
  const currentPay = paySel.value;
  paySel.innerHTML = '<option value="">ທຸກວິທີຊຳລະ</option>' +
    [...paySet].sort().map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
  paySel.value = currentPay;
}

/* ============ 9. FORMS ============ */
function populateCategorySelect(selectEl, type, selected = '') {
  const cats = CATEGORIES[type] || [];
  selectEl.innerHTML = '<option value="">-- ເລືອກໝວດໝູ່ --</option>' +
    cats.map(c => `<option value="${escapeHtml(c)}"${c === selected ? ' selected' : ''}>${escapeHtml(c)}</option>`).join('');

  // ຖ້າມີຄ່າທີ່ບໍ່ຕົງກັບ default list ໃຫ້ເພີ່ມເຂົ້າໄປ
  if (selected && !cats.includes(selected)) {
    const opt = document.createElement('option');
    opt.value = selected;
    opt.textContent = selected;
    opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function populatePaymentSelect(selectEl, selected = '') {
  selectEl.innerHTML = '<option value="">-- ເລືອກວິທີຊຳລະ --</option>' +
    PAYMENT_METHODS.map(p => `<option value="${escapeHtml(p)}"${p === selected ? ' selected' : ''}>${escapeHtml(p)}</option>`).join('');

  if (selected && !PAYMENT_METHODS.includes(selected)) {
    const opt = document.createElement('option');
    opt.value = selected;
    opt.textContent = selected;
    opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function resetAddForm() {
  $('#addForm').reset();
  $('#addDate').value = todayISO();
  $('#addTime').value = nowTime();
  $('#addType').value = 'expense';

  $$('#addForm .type-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.type === 'expense');
    el.setAttribute('aria-checked', el.dataset.type === 'expense');
  });

  populateCategorySelect($('#addCategory'), 'expense');
  populatePaymentSelect($('#addPayment'));

  $$('#addForm .form-error').forEach(e => e.classList.add('hidden'));
}

function showFieldError(form, field, msg) {
  const el = form.querySelector(`[data-error="${field}"]`);
  if (el) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}

function clearFieldErrors(form) {
  $$('.form-error', form).forEach(e => e.classList.add('hidden'));
}

function validateForm(data) {
  const errors = {};
  if (!data.type || !['income', 'expense'].includes(data.type)) errors.type = 'ກະລຸນາເລືອກປະເພດລາຍການ';
  if (!data.date) errors.date = 'ກະລຸນາລະບຸວັນທີ';
  if (!data.category) errors.category = 'ກະລຸນາເລືອກໝວດໝູ່';
  const amt = Number(data.amount);
  if (!amt || isNaN(amt) || amt <= 0) errors.amount = 'ກະລຸນາລະບຸຈຳນວນເງິນທີ່ຫຼາຍກວ່າ 0';
  return errors;
}

/* ============ 10. MODALS ============ */
function openDetail(id) {
  const t = State.transactions.find(x => x.id === id);
  if (!t) return;

  State.currentDetailId = id;
  const isIncome = t.type === 'income';

  $('#detailContent').innerHTML = `
    <div class="detail-row">
      <div class="detail-label">ວັນທີ</div>
      <div class="detail-value">${escapeHtml(formatDate(t.date))}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">ເວລາ</div>
      <div class="detail-value">${escapeHtml(t.time || '—')}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">ປະເພດ</div>
      <div class="detail-value">
        <span class="badge ${isIncome ? 'income' : 'expense'}">
          <i class="fa-solid ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
          ${isIncome ? 'ລາຍຮັບ' : 'ລາຍຈ່າຍ'}
        </span>
      </div>
    </div>
    <div class="detail-row">
      <div class="detail-label">ໝວດໝູ່</div>
      <div class="detail-value">${escapeHtml(t.category || '—')}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">ລາຍລະອຽດ</div>
      <div class="detail-value">${escapeHtml(t.description || '—')}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">ຈຳນວນເງິນ</div>
      <div class="detail-value ${isIncome ? 'amount-income' : 'amount-expense'}">
        ${isIncome ? '+' : '−'}${formatCurrency(t.amount)}
      </div>
    </div>
    <div class="detail-row">
      <div class="detail-label">ວິທີຊຳລະເງິນ</div>
      <div class="detail-value">${escapeHtml(t.paymentMethod || '—')}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">ໝາຍເຫດ</div>
      <div class="detail-value">${escapeHtml(t.note || '—')}</div>
    </div>
    <div class="detail-row">
      <div class="detail-label">ລະຫັດ</div>
      <div class="detail-value" style="font-family:monospace;font-size:12px;">${escapeHtml(t.id)}</div>
    </div>
  `;

  UI.openModal('detailModal');
}

function openEdit(id) {
  const t = State.transactions.find(x => x.id === id);
  if (!t) return;

  $('#editId').value = t.id;
  $('#editDate').value = t.date;
  $('#editTime').value = t.time || '';
  $('#editAmount').value = t.amount;
  $('#editDescription').value = t.description || '';
  $('#editNote').value = t.note || '';
  $('#editType').value = t.type;

  $$('#editForm .type-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.editType === t.type);
  });

  populateCategorySelect($('#editCategory'), t.type, t.category);
  populatePaymentSelect($('#editPayment'), t.paymentMethod);

  clearFieldErrors($('#editForm'));
  UI.openModal('editModal');
}

function openConfirmDelete(id) {
  State.pendingDeleteId = id;
  UI.openModal('confirmModal');
}

/* ============ 11. CHARTS ============ */
function renderCharts(list) {
  renderBarChart(list);
  renderPieChart(list);
}

function renderBarChart(list) {
  const ctx = $('#barChart');
  if (!ctx) return;

  // ຈັດກຸ່ມຕາມວັນທີ
  const groups = {};
  list.forEach(t => {
    if (!groups[t.date]) groups[t.date] = { income: 0, expense: 0 };
    if (t.type === 'income') groups[t.date].income += t.amount;
    else groups[t.date].expense += t.amount;
  });

  let labels = Object.keys(groups).sort();
  // ຖ້າມີຫຼາຍວັນເກີນໄປ ໃຫ້ຈັດກຸ່ມເປັນລາຍເດືອນ
  if (labels.length > 31) {
    const monthly = {};
    labels.forEach(d => {
      const key = d.slice(0, 7);
      if (!monthly[key]) monthly[key] = { income: 0, expense: 0 };
      monthly[key].income += groups[d].income;
      monthly[key].expense += groups[d].expense;
    });
    labels = Object.keys(monthly).sort();
    groups.income = labels.map(k => monthly[k].income);
    groups.expense = labels.map(k => monthly[k].expense);
  } else {
    groups.income = labels.map(k => groups[k].income);
    groups.expense = labels.map(k => groups[k].expense);
  }

  const displayLabels = labels.map(l => l.length === 7 ? l : formatDate(l).slice(0, 5));

  if (State.charts.bar) State.charts.bar.destroy();

  State.charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: displayLabels,
      datasets: [
        {
          label: 'ລາຍຮັບ',
          data: groups.income,
          backgroundColor: '#16a34a',
          borderRadius: 6,
          maxBarThickness: 32
        },
        {
          label: 'ລາຍຈ່າຍ',
          data: groups.expense,
          backgroundColor: '#dc2626',
          borderRadius: 6,
          maxBarThickness: 32
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => formatCurrency(v).replace(/[^\d.,]/g, '')
          },
          grid: { color: '#e2e8f0' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderPieChart(list) {
  const ctx = $('#pieChart');
  if (!ctx) return;

  const catTotals = {};
  list.forEach(t => {
    if (t.type === 'expense') {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    }
  });

  const labels = Object.keys(catTotals);
  const data = labels.map(k => catTotals[k]);

  if (State.charts.pie) State.charts.pie.destroy();

  if (labels.length === 0) {
    State.charts.pie = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['ບໍ່ມີຂໍ້ມູນ'],
        datasets: [{ data: [1], backgroundColor: ['#e2e8f0'], borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
    return;
  }

  const palette = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6', '#a855f7', '#64748b'];

  State.charts.pie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, padding: 10, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = data.reduce((a, b) => a + b, 0);
              const pct = total ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
              return `${ctx.label}: ${formatCurrency(ctx.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/* ============ 12. DATA LOADING & INIT ============ */

let isLoadingData = false;   // ⭐ ເພີ່ມບັນທັດນີ້ (Guard ປ້ອງກັນການເອີ້ນຊ້ອນ)

async function loadTransactions(silent = false) {
  // ✅ ຖ້າກຳລັງໂຫຼດຢູ່ ໃຫ້ຂ້າມໄປເລີຍ ປ້ອງກັນການເອີ້ນຊ້ອນ
  if (isLoadingData) {
    console.warn('ໂຫຼດຂໍ້ມູນຢູ່ແລ້ວ ຂ້າມການເອີ້ນຊ້ຳ');
    return;
  }

  isLoadingData = true;   // ⭐ ຕັ້ງຄ່າກຳລັງໂຫຼດ
  if (!silent) UI.showLoading();

  try {
    const data = await API.list();
    State.transactions = Array.isArray(data) ? data : [];
    populateFilterOptions();
    applyFilters();
    renderDashboard();
    if (!silent) UI.toast('success', 'ໂຫຼດຂໍ້ມູນສຳເລັດ', `ພົບ ${State.transactions.length} ລາຍການ`);
  } catch (err) {
    console.error(err);
    UI.toast('error', 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໄດ້', err.message);
    State.transactions = [];
    applyFilters();
    renderDashboard();
  } finally {
    isLoadingData = false;   // ⭐ ຣີເຊັດຄ່າກັບ (ສຳຄັນຫຼາຍ!)
    if (!silent) UI.hideLoading();
  }
}

async function handleAddSubmit(e) {
  e.preventDefault();
  const form = e.target;
  clearFieldErrors(form);

  const data = {
    type: $('#addType').value,
    date: $('#addDate').value,
    time: $('#addTime').value,
    category: $('#addCategory').value,
    description: $('#addDescription').value.trim(),
    amount: Number($('#addAmount').value),
    paymentMethod: $('#addPayment').value,
    note: $('#addNote').value.trim()
  };

  const errors = validateForm(data);
  if (Object.keys(errors).length) {
    Object.entries(errors).forEach(([k, v]) => showFieldError(form, k, v));
    UI.toast('warning', 'ກະລຸນາກວດສອບຂໍ້ມູນ', 'ມີຊ່ອງທີ່ຕ້ອງປ້ອນບໍ່ຄົບ ຫຼື ບໍ່ຖືກຕ້ອງ');
    return;
  }

  const btn = $('#addSubmitBtn');
  btn.disabled = true;
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> ກຳລັງບັນທຶກ...';

  UI.showLoading();
  try {
    const result = await API.create(data);
    UI.toast('success', 'ບັນທຶກຂໍ້ມູນສຳເລັດ', 'ລາຍການຂອງທ່ານຖືກບັນທຶກແລ້ວ');

    // ✅ ເພີ່ມເຂົ້າ State ໂດຍກົງ (ໄວຫຼາຍ ບໍ່ຕ້ອງລໍຖ້າໂຫຼດໃໝ່)
    if (result && result.id) {
      State.transactions.push({
        id: result.id,
        date: data.date,
        time: data.time,
        type: data.type,
        category: data.category,
        description: data.description,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        note: data.note,
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ')
      });

      populateFilterOptions();
      applyFilters();
      renderDashboard();
    }

    resetAddForm();
    UI.hideLoading();          // ✅ ຊ່ອນ Loading ທັນທີ
    navigateTo('dashboard');
  } catch (err) {
    console.error(err);
    UI.toast('error', 'ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້', err.message);
    UI.hideLoading();          // ✅ ຊ່ອນ Loading ເຖິງແມ່ນພົບ error
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}

async function handleEditSubmit(e) {
  e.preventDefault();
  const id = $('#editId').value;
  const data = {
    id: id,
    type: $('#editType').value,
    date: $('#editDate').value,
    time: $('#editTime').value,
    category: $('#editCategory').value,
    description: $('#editDescription').value.trim(),
    amount: Number($('#editAmount').value),
    paymentMethod: $('#editPayment').value,
    note: $('#editNote').value.trim()
  };

  const errors = validateForm(data);
  if (Object.keys(errors).length) {
    UI.toast('warning', 'ກະລຸນາກວດສອບຂໍ້ມູນ');
    return;
  }

  const btn = $('#editSubmitBtn');
  btn.disabled = true;
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> ກຳລັງບັນທຶກ...';

  UI.showLoading();
  try {
    await API.update(data);
    UI.toast('success', 'ແກ້ໄຂຂໍ້ມູນສຳເລັດ');
    UI.closeModal('editModal');
    await loadTransactions(true);
  } catch (err) {
    console.error(err);
    UI.toast('error', 'ບໍ່ສາມາດແກ້ໄຂຂໍ້ມູນໄດ້', err.message);
  } finally {
    UI.hideLoading();
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}

async function handleConfirmDelete() {
  const id = State.pendingDeleteId;
  if (!id) return;

  const btn = $('#confirmDeleteBtn');
  btn.disabled = true;
  const origHtml = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div> ກຳລັງລຶບ...';

  UI.showLoading();
  try {
    await API.remove(id);
    UI.toast('success', 'ລຶບຂໍ້ມູນສຳເລັດ');
    UI.closeModal('confirmModal');
    UI.closeModal('detailModal');
    State.pendingDeleteId = null;
    await loadTransactions(true);
  } catch (err) {
    console.error(err);
    UI.toast('error', 'ບໍ່ສາມາດລຶບຂໍ້ມູນໄດ້', err.message);
  } finally {
    UI.hideLoading();
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}

/* ============ 13. EVENT BINDINGS ============ */
function bindEvents() {
  // Navigation
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-page]');
    if (navBtn) {
      e.preventDefault();
      navigateTo(navBtn.dataset.page);
      return;
    }

    const detailBtn = e.target.closest('[data-detail]');
    if (detailBtn) {
      e.preventDefault();
      openDetail(detailBtn.dataset.detail);
      return;
    }

    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      e.preventDefault();
      openEdit(editBtn.dataset.edit);
      return;
    }

    const deleteBtn = e.target.closest('[data-delete]');
    if (deleteBtn) {
      e.preventDefault();
      openConfirmDelete(deleteBtn.dataset.delete);
      return;
    }

    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      UI.closeModal(closeBtn.dataset.close);
      return;
    }

    // ປິດ modal ເມື່ອຄລິກ overlay
    if (e.target.classList.contains('modal-overlay')) {
      UI.closeModal(e.target.id);
    }
  });

  // ESC ປິດ modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') UI.closeAllModals();
  });

  // Sidebar toggle
  $('#menuToggle').addEventListener('click', () => {
    const isOpen = $('#sidebar').classList.contains('open');
    isOpen ? closeSidebar() : openSidebar();
  });

  $('#sidebarBackdrop').addEventListener('click', closeSidebar);

  // Refresh
  $('#refreshBtn').addEventListener('click', () => loadTransactions(false));

  // Period buttons
  $$('#periodBar .period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#periodBar .period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      State.period = btn.dataset.period;

      $('#customRange').classList.toggle('show', State.period === 'custom');
      if (State.period !== 'custom') {
        renderDashboard();
      } else if (State.customRange.start && State.customRange.end) {
        renderDashboard();
      }
    });
  });

  $('#applyCustomRange').addEventListener('click', () => {
    const s = $('#customStart').value;
    const e = $('#customEnd').value;
    if (!s || !e) {
      UI.toast('warning', 'ກະລຸນາເລືອກຊ່ວງວັນທີ');
      return;
    }
    if (new Date(s) > new Date(e)) {
      UI.toast('warning', 'ວັນທີເລີ່ມຕ້ອງບໍ່ເກີນວັນທີສິ້ນສຸດ');
      return;
    }
    State.customRange = { start: s, end: e };
    renderDashboard();
  });

  // Add form
  $('#addForm').addEventListener('submit', handleAddSubmit);

  // Type toggles (Add)
  $$('#addForm .type-option').forEach(opt => {
    const handler = () => {
      const type = opt.dataset.type;
      $('#addType').value = type;
      $$('#addForm .type-option').forEach(o => {
        o.classList.toggle('selected', o === opt);
        o.setAttribute('aria-checked', o === opt);
      });
      populateCategorySelect($('#addCategory'), type);
    };
    opt.addEventListener('click', handler);
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
  });

  // Type toggles (Edit)
  $$('#editForm .type-option').forEach(opt => {
    const handler = () => {
      const type = opt.dataset.editType;
      $('#editType').value = type;
      $$('#editForm .type-option').forEach(o => o.classList.toggle('selected', o === opt));
      populateCategorySelect($('#editCategory'), type, $('#editCategory').value);
    };
    opt.addEventListener('click', handler);
    opt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
  });

  // Edit form
  $('#editForm').addEventListener('submit', handleEditSubmit);

  // Detail actions
  $('#detailEditBtn').addEventListener('click', () => {
    if (State.currentDetailId) {
      UI.closeModal('detailModal');
      openEdit(State.currentDetailId);
    }
  });

  $('#detailDeleteBtn').addEventListener('click', () => {
    if (State.currentDetailId) {
      UI.closeModal('detailModal');
      openConfirmDelete(State.currentDetailId);
    }
  });

  $('#confirmDeleteBtn').addEventListener('click', handleConfirmDelete);

  // Filters
  $('#searchInput').addEventListener('input', debounce((e) => {
    State.filters.search = e.target.value.trim();
    applyFilters();
  }, 250));

  $('#filterType').addEventListener('change', (e) => {
    State.filters.type = e.target.value;
    applyFilters();
  });

  $('#filterCategory').addEventListener('change', (e) => {
    State.filters.category = e.target.value;
    applyFilters();
  });

  $('#filterPayment').addEventListener('change', (e) => {
    State.filters.payment = e.target.value;
    applyFilters();
  });

  $('#sortBy').addEventListener('change', (e) => {
    State.filters.sort = e.target.value;
    applyFilters();
  });

  // Settings
  $('#settingApiUrl').value = CONFIG.API_URL.includes('AKfycbxxxx') ? '' : CONFIG.API_URL;
  $('#settingCurrency').value = CONFIG.CURRENCY;

  $('#saveSettingsBtn').addEventListener('click', () => {
    const url = $('#settingApiUrl').value.trim();
    const cur = $('#settingCurrency').value;

    if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
      UI.toast('warning', 'URL ບໍ່ຖືກຕ້ອງ', 'ກະລຸນາກວດສອບ URL ຂອງ Apps Script Web App');
      return;
    }

    CONFIG.API_URL = url;
    CONFIG.CURRENCY = cur;
    localStorage.setItem('pf_api_url', url);
    localStorage.setItem('pf_currency', cur);

    UI.toast('success', 'ບັນທຶກການຕັ້ງຄ່າສຳເລັດ', 'ກຳລັງໂຫຼດຂໍ້ມູນໃໝ່...');
    setTimeout(() => loadTransactions(false), 600);
  });
}

/* ============ 14. INIT ============ */
function init() {
  bindEvents();
  resetAddForm();

  // ຖ້າ API URL ຖືກຕັ້ງຄ່າໄວ້ແລ້ວ ໃຫ້ໂຫຼດຂໍ້ມູນ
  if (CONFIG.API_URL && !CONFIG.API_URL.includes('AKfycbxxxx')) {
    loadTransactions(true);
  } else {
    UI.toast('warning', 'ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ API URL', 'ໄປທີ່ໜ້າຕັ້ງຄ່າເພື່ອໃສ່ URL ຂອງ Google Apps Script');
  }
}

document.addEventListener('DOMContentLoaded', init);