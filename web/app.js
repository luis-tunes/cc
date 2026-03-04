/* CC — app.js */
'use strict';

/* ── API ──────────────────────────────────────────── */
async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok) {
    let msg;
    try { const j = await r.json(); msg = j.detail || JSON.stringify(j); }
    catch { msg = await r.text(); }
    throw new Error(msg || 'Erro ' + r.status);
  }
  return r.json();
}

const fmt = v => Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amtCls = v => Number(v) < 0 ? 'neg' : 'pos';
function eur(v) { return '\u20ac\u202f' + fmt(v); }

/* ── TABS ─────────────────────────────────────────── */
const TAB_TITLES = { dashboard: 'Dashboard', faturas: 'Faturas', banco: 'Banco', reconciliar: 'Reconciliar', iva: 'IVA' };

function showTab(id, btn) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById('tab-' + id);
  pane.style.animation = 'none';
  pane.offsetHeight;
  pane.style.animation = '';
  pane.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('topbarTitle').textContent = TAB_TITLES[id];
  if (id === 'faturas')     loadDocs();
  if (id === 'banco')       loadTxs();
  if (id === 'reconciliar') loadRecs();
  if (id === 'iva')         loadMonthly();
}

/* ── CHARTS ───────────────────────────────────────── */
let chartInst = null, barInst = null;

function renderDonut(rec, unmatched) {
  const total = rec + unmatched;
  const pct = total > 0 ? Math.round(rec / total * 100) : 0;
  document.getElementById('donutPct').textContent = pct + '%';
  if (chartInst) chartInst.destroy();
  chartInst = new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: { datasets: [{ data: [rec || 0.001, unmatched], backgroundColor: ['#33bfb3', '#ff3366'], borderWidth: 0, borderRadius: 4, hoverOffset: 4 }] },
    options: {
      responsive: true, cutout: '76%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => '  ' + ctx.raw + ' docs' } }
      }
    }
  });
}

function renderBar(rows) {
  if (barInst) barInst.destroy();
  if (!rows.length) return;
  const labels = rows.map(r => r.month).reverse();
  const data   = rows.map(r => Number(r.vat)).reverse();
  barInst = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'IVA',
        data,
        backgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          g.addColorStop(0,   'rgba(255,220,80,.95)');  /* bright highlight at top */
          g.addColorStop(0.2, 'rgba(255,204,51,.82)');  /* main gold */
          g.addColorStop(1,   'rgba(255,204,51,.10)');
          return g;
        },
        hoverBackgroundColor: 'rgba(255,220,80,1)',
        borderRadius: 5, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#666666', font: { size: 11, family: 'Inter' } } },
        y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#666666', font: { size: 11, family: 'Inter' }, callback: v => '\u20ac' + v } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

/* ── SUMMARY BAR ──────────────────────────────────── */
function setSummaryBar(s) {
  const el = document.getElementById('summaryBar');
  const unmatched = s.unmatched_documents;
  el.innerHTML =
    sbarItem(s.documents.count, 'documentos') +
    '<div class="sbar-div"></div>' +
    sbarItem(eur(s.documents.total), 'faturado') +
    '<div class="sbar-div"></div>' +
    sbarItem(s.bank_transactions.count, 'movimentos') +
    '<div class="sbar-div"></div>' +
    sbarItem(s.reconciliations, 'reconciliados') +
    '<div class="sbar-div"></div>' +
    sbarItem(unmatched, 'por reconciliar', unmatched > 0 ? 'color:var(--red)' : 'color:var(--green)');
}

function sbarItem(val, lbl, style) {
  return `<div class="sbar-item"><span class="sbar-val"${style ? ' style="' + style + '"' : ''}>${val}</span><span class="sbar-lbl">${lbl}</span></div>`;
}

/* ── KPI GRID ─────────────────────────────────────── */
function setKpis(s) {
  const unmatched = s.unmatched_documents;
  document.getElementById('kpiGrid').innerHTML =
    kpi('DOCS',  s.documents.count,        'Documentos',      'blue') +
    kpi('EUR',   eur(s.documents.total),    'Total Faturado',  'blue') +
    kpi('BANK',  s.bank_transactions.count, 'Movimentos',      'neutral') +
    kpi('OK',    s.reconciliations,          'Reconciliados',   'green') +
    kpi('PEND',  unmatched,                 'Por Reconciliar', unmatched > 0 ? 'red' : 'green');
}

function kpi(tag, val, lbl, dot) {
  const dd = (dot === 'blue' || dot === 'green' || dot === 'red') ? ` data-dot="${dot}"` : '';
  return `<div class="kpi"${dd}><div class="kpi-header"><span class="kpi-tag">${tag}</span><span class="kpi-dot ${dot}"></span></div><div class="kpi-val">${val}</div><div class="kpi-label">${lbl}</div></div>`;
}

/* ── BADGE ────────────────────────────────────────── */
function setBadge(unmatched) {
  const b = document.getElementById('badge');
  b.className = unmatched > 0 ? 'pill pill-warn' : 'pill pill-ok';
  b.textContent = unmatched > 0 ? unmatched + ' por reconciliar' : '\u2713 ok';
}

/* ── LOAD SUMMARY ─────────────────────────────────── */
async function loadSummary() {
  try {
    const s = await api('/dashboard/summary');
    setBadge(s.unmatched_documents);
    setSummaryBar(s);
    setKpis(s);
    renderDonut(s.reconciliations, s.unmatched_documents);
  } catch (e) { console.error('summary:', e); }
}

/* ── LOAD MONTHLY ─────────────────────────────────── */
async function loadMonthly() {
  try {
    const rows = await api('/dashboard/monthly');
    renderBar(rows);
    const el = document.getElementById('ivaTable');
    if (!rows.length) { el.innerHTML = emptyState('iva', 'Sem dados de IVA', 'Carrega faturas para ver resumo mensal'); return; }
    el.innerHTML = `
      <div class="card">
        <div class="card-hdr"><span class="card-title">IVA por M\u00eas</span></div>
        <table class="iva-table">
          <thead><tr><th>M\u00eas</th><th>Docs</th><th>Total</th><th>IVA</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr>
              <td>${r.month}</td>
              <td class="dimid">${r.doc_count}</td>
              <td class="mono">${eur(r.total)}</td>
              <td class="mono" style="color:var(--amber)">${eur(r.vat)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) { console.error('monthly:', e); }
}

/* ── LOAD DOCS ────────────────────────────────────── */
async function loadDocs() {
  try {
    const docs = await api('/documents');
    const el = document.getElementById('docsTable');
    if (!docs.length) { el.innerHTML = emptyState('doc', 'Sem documentos', 'Arrasta PDFs para come\u00e7ar'); return; }
    el.innerHTML = `
      <table>
        <thead><tr><th>ID</th><th>Fornecedor</th><th>Cliente</th><th>Total</th><th>IVA</th><th>Data</th><th>Tipo</th></tr></thead>
        <tbody>
          ${docs.map(d => `<tr>
            <td class="dimid mono">#${d.id}</td>
            <td><span class="chip">${d.supplier_nif}</span></td>
            <td><span class="chip">${d.client_nif}</span></td>
            <td class="mono pos">${eur(d.total)}</td>
            <td class="mono" style="color:var(--amber)">${eur(d.vat)}</td>
            <td class="dimid">${d.date}</td>
            <td><span class="tag">${d.type}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) { console.error('docs:', e); }
}

/* ── LOAD TXS ─────────────────────────────────────── */
async function loadTxs() {
  try {
    const txs = await api('/bank-transactions');
    const el = document.getElementById('txsTable');
    if (!txs.length) { el.innerHTML = emptyState('bank', 'Sem movimentos', 'Importa um extracto banc\u00e1rio em CSV'); return; }
    el.innerHTML = `
      <table>
        <thead><tr><th>ID</th><th>Data</th><th>Descri\u00e7\u00e3o</th><th>Valor</th></tr></thead>
        <tbody>
          ${txs.map(t => `<tr>
            <td class="dimid mono">#${t.id}</td>
            <td class="dimid">${t.date}</td>
            <td>${t.description}</td>
            <td class="mono ${amtCls(t.amount)}">${eur(t.amount)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) { console.error('txs:', e); }
}

/* ── LOAD RECS ────────────────────────────────────── */
async function loadRecs() {
  try {
    const recs = await api('/reconciliations');
    const el = document.getElementById('recsView');
    if (!recs.length) { el.innerHTML = emptyState('shuffle', 'Sem reconcilia\u00e7\u00f5es', 'Carrega documentos e movimentos, depois clica Reconciliar'); return; }
    el.innerHTML = recs.map(r => `
      <div class="match-grid">
        <div class="match-side">
          <div class="m-tag">Fatura #${r.document_id}</div>
          <div><span class="m-nif">${r.supplier_nif}</span></div>
          <div class="m-amount">${eur(r.total)}</div>
          <div class="m-date">${r.doc_date}</div>
        </div>
        <div class="match-mid">
          <div class="m-arrow">\u21c4</div>
          <div class="m-conf">${(Number(r.match_confidence) * 100).toFixed(0)}%</div>
        </div>
        <div class="match-side right">
          <div class="m-tag">Movimento #${r.bank_transaction_id}</div>
          <div class="m-amount">${eur(r.amount)}</div>
          <div class="m-desc">${r.description}</div>
          <div class="m-date">${r.tx_date}</div>
        </div>
      </div>`).join('');
  } catch (e) { console.error('recs:', e); }
}

/* ── EMPTY STATES ─────────────────────────────────── */
const EMPTY_ICONS = {
  doc:     '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></svg>',
  bank:    '<svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>',
  iva:     '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
};

function emptyState(icon, title, sub) {
  return `<div class="empty"><div class="empty-icon">${EMPTY_ICONS[icon] || ''}</div><div class="empty-title">${title}</div><div class="empty-sub">${sub}</div></div>`;
}

/* ── UPLOAD PDFs — XHR with progress bar ─────────── */
function initDropzone() {
  const zone  = document.getElementById('dropzone');
  const input = document.getElementById('pdfInput');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); handleFiles(e.dataTransfer.files); });
  input.addEventListener('change', () => { handleFiles(input.files); input.value = ''; });
}

async function handleFiles(files) {
  const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) return;

  const list = document.getElementById('fileList');

  for (const f of pdfs) {
    const id = 'fr' + Date.now() + Math.random().toString(36).slice(2, 5);

    // Row with progress bar
    list.insertAdjacentHTML('beforeend', `
      <div class="file-row" id="${id}">
        <span class="fr-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></svg></span>
        <div class="fr-body">
          <div class="fr-top">
            <span class="fr-name">${f.name}</span>
            <span class="fr-status pending" id="${id}-s">A enviar\u2026</span>
          </div>
          <div class="fr-progress" id="${id}-p"><div class="fr-bar" id="${id}-b"></div></div>
        </div>
      </div>`);

    await uploadWithProgress(f, id);
  }
}

function uploadWithProgress(file, id) {
  return new Promise(resolve => {
    const bar    = document.getElementById(id + '-b');
    const status = document.getElementById(id + '-s');
    const prog   = document.getElementById(id + '-p');

    const fd  = new FormData();
    fd.append('file', file);
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', e => {
      if (!e.lengthComputable) return;
      const pct = Math.round(e.loaded / e.total * 100);
      bar.style.width = pct + '%';
      status.textContent = pct < 100 ? pct + '%' : 'A enviar\u2026';
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200 || xhr.status === 202) {
        bar.style.width = '100%';
        bar.classList.add('done');
        status.textContent = 'Enviado \u2713';
        status.className = 'fr-status done';
        prog.style.opacity = '0';
        // Start OCR polling — show persistent banner
        showOcrBanner(file.name);
        pollForNewDoc(Date.now());
      } else {
        let detail = 'Erro ' + xhr.status;
        try { detail = JSON.parse(xhr.responseText).detail || detail; } catch {}
        status.textContent = detail;
        status.className = 'fr-status fail';
        bar.classList.add('fail');
      }
      resolve();
    });

    xhr.addEventListener('error', () => {
      status.textContent = 'Falha de rede';
      status.className = 'fr-status fail';
      bar.classList.add('fail');
      resolve();
    });

    xhr.open('POST', '/documents/upload');
    xhr.send(fd);
  });
}

/* OCR in-progress banner */
let ocrBannerTimer = null;
function showOcrBanner(filename) {
  clearOcrBanner();
  const el = document.getElementById('uploadInfo');
  el.innerHTML = `
    <div class="ocr-banner" id="ocrBanner">
      <div class="ocr-spin"></div>
      <div class="ocr-text">
        <strong>${filename}</strong> enviado — Paperless a processar OCR
        <span class="ocr-sub">O documento aparece abaixo assim que estiver pronto (~30s)</span>
      </div>
    </div>`;
}

function clearOcrBanner() {
  clearTimeout(ocrBannerTimer);
  const el = document.getElementById('ocrBanner');
  if (el) el.remove();
}

/* Poll until a new doc appears (or 90s timeout) */
let _pollStart = 0, _pollTimer = null;
async function pollForNewDoc(startTs) {
  clearTimeout(_pollTimer);
  _pollStart = startTs;
  let prevCount = 0;
  try { const s = await api('/dashboard/summary'); prevCount = s.documents.count; } catch {}

  async function tick() {
    if (Date.now() - _pollStart > 90000) { clearOcrBanner(); return; }
    try {
      const s = await api('/dashboard/summary');
      if (s.documents.count > prevCount) {
        clearOcrBanner();
        const el = document.getElementById('uploadInfo');
        el.innerHTML = '<div class="toast ok">\u2713 Documento importado com sucesso.</div>';
        setTimeout(() => { if (el.querySelector('.toast.ok')) el.innerHTML = ''; }, 5000);
        loadDocs();
        setSummaryBar(s);
        setKpis(s);
        renderDonut(s.reconciliations, s.unmatched_documents);
        setBadge(s.unmatched_documents);
        return;
      }
    } catch {}
    _pollTimer = setTimeout(tick, 3000);
  }
  _pollTimer = setTimeout(tick, 3000);
}

/* ── BANK CSV ─────────────────────────────────────── */
async function uploadCSV() {
  const f   = document.getElementById('csvFile').files[0];
  const msg = document.getElementById('uploadMsg');
  if (!f) { msg.innerHTML = '<div class="toast err">Selecciona um CSV primeiro.</div>'; return; }
  const fd = new FormData();
  fd.append('file', f);
  try {
    const r = await api('/bank-transactions/upload', { method: 'POST', body: fd });
    msg.innerHTML = `<div class="toast ok">\u2713 ${r.imported} movimentos importados.</div>`;
    loadTxs();
    loadSummary();
  } catch (e) { msg.innerHTML = `<div class="toast err">Erro: ${e.message}</div>`; }
}

/* ── RECONCILE ────────────────────────────────────── */
async function runReconcile() {
  const btn = document.getElementById('reconcileBtn');
  btn.disabled = true;
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> A reconciliar\u2026';
  try {
    const r = await api('/reconcile', { method: 'POST' });
    const msg = r.matched > 0
      ? `<div class="toast ok">\u2713 ${r.matched} correspond\u00eancia(s) encontrada(s).</div>`
      : '<div class="toast info">Sem novas correspond\u00eancias. Verifica valores e datas.</div>';
    document.getElementById('reconMsg').innerHTML = msg;
    loadRecs();
    loadSummary();
  } catch (e) { document.getElementById('reconMsg').innerHTML = `<div class="toast err">Erro: ${e.message}</div>`; }
  finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Reconciliar agora';
  }
}

function exportCSV() { window.location.href = '/export/csv'; }

/* ── INIT ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initDropzone();
  loadSummary();
  loadMonthly();
  setInterval(() => { loadSummary(); loadMonthly(); }, 30000);
});
