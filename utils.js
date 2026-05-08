// ================================================================
// DATE CONSTANTS
// ================================================================
const MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const MONTHS_S = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_S = ['อา','จ','อ','พ','พฤ','ศ','ส'];
const DAY_NAMES = {
  mon:'จันทร์', tue:'อังคาร', wed:'พุธ', thu:'พฤหัสบดี',
  fri:'ศุกร์', sat:'เสาร์', sun:'อาทิตย์', daily:'ทุกวัน',
  'mon-wed':'จ.-พ.', 'mon-fri':'จ.-ศ.', 'thu':'พฤ.', 'fri':'ศ.'
};

// ================================================================
// CORE ID / DATE HELPERS
// ================================================================
function gid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function _td() { return new Date().toISOString().split('T')[0]; }
function _nw() { return new Date().toISOString(); }

function getTodayDow() {
  return ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()];
}

function getCurMonth() { return _td().substring(0, 7); }

function getCurQuarter() {
  const m = new Date().getMonth();
  const q = Math.floor(m / 3) + 1;
  return `Q${q}/${new Date().getFullYear()}`;
}

// ================================================================
// DATE FORMATTING
// ================================================================
function fD(iso) {
  if (!iso) return '-';
  const p = iso.split('T')[0].split('-');
  if (p.length !== 3) return '-';
  return `${p[2]}/${p[1]}/${p[0]}`;
}

function fDShort(iso) {
  if (!iso) return '-';
  const p = iso.split('T')[0].split('-');
  if (p.length !== 3) return '-';
  return `${p[2]}/${p[1]}/${p[0].substr(2)}`;
}

function fDT(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return '-';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fDRelative(iso) {
  if (!iso) return '';
  const days = dTo(iso);
  if (days === 0) return 'วันนี้';
  if (days === 1) return 'พรุ่งนี้';
  if (days === -1) return 'เมื่อวาน';
  if (days < 0) return `${Math.abs(days)} วันที่แล้ว`;
  return `อีก ${days} วัน`;
}

// ================================================================
// DATE CALCULATIONS
// ================================================================
function dTo(ds) {
  if (!ds) return 999;
  const d = ds.split('T')[0];
  return Math.ceil((new Date(d) - new Date(_td())) / 864e5);
}

function daysBetween(d1, d2) {
  if (!d1 || !d2) return 0;
  return Math.ceil((new Date(d2) - new Date(d1)) / 864e5);
}

function addD(iso, n) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function getWeekRange(refDate) {
  const ref = refDate ? new Date(refDate) : new Date();
  const dow = ref.getDay();
  const diffS = dow === 0 ? 6 : dow - 1;
  const ws = addD(ref.toISOString().split('T')[0], -diffS);
  return { start: ws, end: addD(ws, 6) };
}

function getMonthRange(refDate) {
  const d = refDate ? new Date(refDate) : new Date();
  const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
  const e = new Date(d.getFullYear(), d.getMonth()+1, 0);
  return { start: s, end: e.toISOString().split('T')[0] };
}

function getQuarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const start = `${now.getFullYear()}-${String(q*3+1).padStart(2,'0')}-01`;
  const endMonth = q * 3 + 3;
  const end = new Date(now.getFullYear(), endMonth, 0);
  return { start, end: end.toISOString().split('T')[0], label: `Q${q+1}/${now.getFullYear()}` };
}

function isInRange(date, start, end) {
  if (!date) return false;
  const d = date.split('T')[0];
  return d >= start && d <= end;
}

// ================================================================
// MONEY FORMATTING
// ================================================================
function fmtMoney(n) {
  if (n === null || n === undefined || n === '') return '-';
  return Number(n).toLocaleString('th-TH');
}

function fmtMoneyShort(n) {
  if (!n) return '-';
  n = Number(n);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return n.toLocaleString('th-TH');
}

// ================================================================
// TIMER FORMATTING
// ================================================================
function fmtTimer(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function fmtDuration(minutes) {
  if (!minutes) return '0 น.';
  if (minutes < 60) return `${minutes} น.`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h} ชม. ${m} น.` : `${h} ชม.`;
}

// ================================================================
// DEADLINE HELPERS
// ================================================================
function dlC(ds, done) {
  if (done) return '';
  const d = dTo(ds);
  if (d < 0) return 'dlo';
  if (d <= 1) return 'dl1';
  if (d <= 3) return 'dl3';
  return '';
}

function dlB(ds, done) {
  if (done) return '';
  const d = dTo(ds);
  if (d < 0) return `<span class="dlb dlbo">เลยกำหนด ${Math.abs(d)} วัน</span>`;
  if (d === 0) return `<span class="dlb dlb1">🔴 วันนี้!</span>`;
  if (d === 1) return `<span class="dlb dlb1">🔴 พรุ่งนี้</span>`;
  if (d <= 3) return `<span class="dlb dlb3">🟡 อีก ${d} วัน</span>`;
  return '';
}

// ================================================================
// CONTACT FRESHNESS (วันที่ติดต่อล่าสุด)
// ================================================================
function contactColor(daysSince) {
  if (daysSince === null || daysSince === undefined) return 'health-none';
  if (daysSince <= 7) return 'health-good';
  if (daysSince <= 14) return 'health-warn';
  return 'health-bad';
}

function contactLabel(daysSince) {
  if (daysSince === null || daysSince === undefined) return '⚪ ไม่เคย';
  if (daysSince === 0) return '🟢 วันนี้';
  if (daysSince <= 7) return `🟢 ${daysSince} วัน`;
  if (daysSince <= 14) return `🟡 ${daysSince} วัน`;
  return `🔴 ${daysSince} วัน`;
}

// ================================================================
// TAG HELPERS
// ================================================================
function sTag(s) {
  const m = {active:'กำลังทำ', completed:'เสร็จ', 'on-hold':'พัก', cancelled:'ยกเลิก'};
  return `<span class="tag tag-${s}">${m[s]||s}</span>`;
}

function pTag(p) {
  return `<span class="tag tag-${p}">${{high:'🔴 สำคัญ', medium:'🟡 กลาง', low:'🟢 ทั่วไป'}[p]||p}</span>`;
}

function levelTag(lv) {
  const cls = {S:'tag-s', A:'tag-a', B:'tag-b'};
  return `<span class="tag ${cls[lv]||'tag-other'}">${lv||'Other'}</span>`;
}

function pipeTag(s) {
  const cfg = getConfig();
  const st = cfg.pipelineStatuses.find(x => x.id === s);
  const cls = {
    prospect:'tag-prospect', tor_review:'tag-bidding', quotation:'tag-bidding',
    bidding:'tag-bidding', negotiation:'tag-bidding', win:'tag-win',
    ordered:'tag-ordered', delivered:'tag-completed', lost:'tag-lost',
    on_hold:'tag-on-hold', recurring:'tag-active'
  };
  return `<span class="tag ${cls[s]||'tag-count'}">${st?.name||s}</span>`;
}

function modeTag(m) {
  return `<span class="tag tag-${m==='offline'?'offline':'online'}">${m==='offline'?'Onsite':'Online'}</span>`;
}

// ================================================================
// PROGRESS
// ================================================================
function prog(o) {
  if (!o.steps || !o.steps.length) return 0;
  return Math.round(o.steps.filter(s => s.done).length / o.steps.length * 100);
}

function isStepLocked(obj, idx) {
  if (!obj.sequential) return false;
  if (idx === 0) return false;
  return !obj.steps[idx - 1]?.done;
}

// ================================================================
// LOG TYPE LABELS
// ================================================================
function logL(t) {
  return {
    progress:'🟢 คืบหน้า', problem:'🔴 ปัญหา', solution:'🟡 แก้ไข',
    visit:'🤝 Visit', followup:'📞 Follow-up', line:'💬 LINE',
    note:'⚪ หมายเหตุ', completed:'✅ เสร็จ', update:'📝 อัพเดท',
    forecast:'📦 Forecast', status_change:'🔄 เปลี่ยนสถานะ',
    win:'✅ Win', lost:'❌ Lost'
  }[t] || t;
}

// ================================================================
// TOAST
// ================================================================
function toast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ================================================================
// ESCAPE FOR CSV
// ================================================================
function esc(s) {
  return (s || '').replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '');
}

// ================================================================
// DOWNLOAD BLOB (CSV)
// ================================================================
function dlBlob(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📤 Download แล้ว');
}

// ================================================================
// COPY TO CLIPBOARD
// ================================================================
function copyText(text, msg) {
  navigator.clipboard.writeText(text).then(() => {
    toast(msg || '📋 Copy แล้ว!');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast(msg || '📋 Copy แล้ว!');
  });
}

// Copy table as TSV (Tab-separated for Google Sheets)
function copyTable(tableId, msg) {
  const table = document.getElementById(tableId);
  if (!table) return toast('❌ ไม่พบตาราง', true);
  let tsv = '';
  table.querySelectorAll('tr').forEach(tr => {
    const cells = tr.querySelectorAll('th,td');
    tsv += Array.from(cells).map(c => c.textContent.replace(/[\t\n\r]/g, ' ').trim()).join('\t') + '\n';
  });
  copyText(tsv, msg || '📋 Copy แล้ว! วาง Google Sheets ได้');
}

// Download table as CSV
function dlTableCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return toast('❌', true);
  let csv = '\uFEFF'; // BOM for Thai
  table.querySelectorAll('tr').forEach(tr => {
    const cells = tr.querySelectorAll('th,td');
    csv += Array.from(cells).map(c => `"${esc(c.textContent.trim())}"`).join(',') + '\n';
  });
  dlBlob(csv, `${filename}-${_td()}.csv`);
}

// ================================================================
// DATE PICKER (Typeable + Calendar Dropdown)
// ================================================================
let _dpO = null;

function dpH(id, val, label, req) {
  return `<div class="fg"><label>${label}${req ? ' *' : ''}</label>
<div class="dpw" id="dpw_${id}">
  <input type="text" class="dpi" id="dpi_${id}"
    value="${val ? fD(val) : ''}"
    placeholder="วว/ดด/ปปปป"
    oninput="dpType('${id}')"
    onfocus="this.select()"
    onblur="setTimeout(()=>dpBlur('${id}'),250)"
    maxlength="10" autocomplete="off">
  <div class="dpbs">
    ${val ? `<span class="dpb" onclick="event.stopPropagation();dpClr('${id}')">✕</span>` : ''}
    <span class="dpb" onclick="event.stopPropagation();dpTog('${id}')">📅</span>
  </div>
  <input type="hidden" id="dpv_${id}" value="${val || ''}">
  <div class="dpp" id="dpp_${id}"></div>
</div></div>`;
}

function dpType(id) {
  const inp = document.getElementById('dpi_' + id);
  let v = inp.value.replace(/[^\d\/]/g, '');
  const nums = v.replace(/\//g, '');
  
  // Auto-insert slashes
  if (nums.length >= 2 && v.indexOf('/') === -1) {
    v = nums.substr(0, 2) + '/' + nums.substr(2);
  }
  if (nums.length >= 4) {
    const parts = v.split('/');
    if (parts.length === 2 && parts[1].length > 2) {
      v = parts[0] + '/' + parts[1].substr(0, 2) + '/' + parts[1].substr(2);
    }
  }
  if (v.length > 10) v = v.substr(0, 10);
  inp.value = v;
  
  // Validate complete date
  if (v.length === 10) {
    const parts = v.split('/');
    if (parts.length === 3) {
      const dd = parseInt(parts[0]), mm = parseInt(parts[1]), yyyy = parseInt(parts[2]);
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 2020 && yyyy <= 2099) {
        const testDate = new Date(yyyy, mm - 1, dd);
        if (testDate.getDate() === dd && testDate.getMonth() === mm - 1) {
          const iso = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
          document.getElementById('dpv_' + id).value = iso;
          dpUpdBtns(id, true);
          return;
        }
      }
    }
  }
  if (v.length < 10) document.getElementById('dpv_' + id).value = '';
}

function dpBlur(id) {
  const inp = document.getElementById('dpi_' + id);
  const hid = document.getElementById('dpv_' + id);
  if (inp && inp.value && hid && !hid.value) inp.value = '';
}

function dpUpdBtns(id, hasVal) {
  const w = document.getElementById('dpw_' + id);
  if (!w) return;
  w.querySelector('.dpbs').innerHTML = hasVal
    ? `<span class="dpb" onclick="event.stopPropagation();dpClr('${id}')">✕</span><span class="dpb" onclick="event.stopPropagation();dpTog('${id}')">📅</span>`
    : `<span class="dpb" onclick="event.stopPropagation();dpTog('${id}')">📅</span>`;
}

function dpTog(id) {
  const p = document.getElementById('dpp_' + id);
  if (!p) return;
  if (p.classList.contains('show')) { p.classList.remove('show'); _dpO = null; return; }
  document.querySelectorAll('.dpp.show').forEach(x => x.classList.remove('show'));
  const v = document.getElementById('dpv_' + id)?.value;
  const d = v ? new Date(v) : new Date();
  dpRn(id, d.getFullYear(), d.getMonth());
  p.classList.add('show');
  _dpO = id;
}

function dpRn(id, y, m) {
  const p = document.getElementById('dpp_' + id);
  if (!p) return;
  const fd = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const tdy = _td();
  const sel = document.getElementById('dpv_' + id)?.value || '';
  
  let h = `<div class="dp-hd">
    <button type="button" onclick="event.stopPropagation();dpNv('${id}',${y},${m},-1)">◀</button>
    <span>${MONTHS[m]} ${y}</span>
    <button type="button" onclick="event.stopPropagation();dpNv('${id}',${y},${m},1)">▶</button>
  </div><div class="dp-grid">`;
  
  DAYS_S.forEach(d => h += `<div class="dp-dh">${d}</div>`);
  
  const pv = new Date(y, m, 0).getDate();
  for (let i = fd - 1; i >= 0; i--) h += `<div class="dp-d other">${pv - i}</div>`;
  
  for (let d = 1; d <= dim; d++) {
    const iso = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    h += `<div class="dp-d${iso===tdy?' today':''}${iso===sel?' sel':''}" onclick="event.stopPropagation();dpSel('${id}','${iso}')">${d}</div>`;
  }
  
  const tot = fd + dim, rem = 7 - tot % 7;
  if (rem < 7) for (let i = 1; i <= rem; i++) h += `<div class="dp-d other">${i}</div>`;
  
  h += `</div><div class="dp-ft">
    <button type="button" onclick="event.stopPropagation();dpSel('${id}','${tdy}')">วันนี้</button>
    <button type="button" onclick="event.stopPropagation();dpSel('${id}','${addD(tdy,1)}')">พรุ่งนี้</button>
    <button type="button" onclick="event.stopPropagation();dpSel('${id}','${addD(tdy,7)}')">+1wk</button>
  </div>`;
  p.innerHTML = h;
}

function dpNv(id, y, m, d) {
  m += d;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  dpRn(id, y, m);
}

function dpSel(id, iso) {
  const vi = document.getElementById('dpv_' + id);
  const di = document.getElementById('dpi_' + id);
  if (vi) vi.value = iso;
  if (di) di.value = fD(iso);
  const p = document.getElementById('dpp_' + id);
  if (p) p.classList.remove('show');
  _dpO = null;
  dpUpdBtns(id, true);
}

function dpClr(id) {
  const vi = document.getElementById('dpv_' + id);
  const di = document.getElementById('dpi_' + id);
  if (vi) vi.value = '';
  if (di) di.value = '';
  dpUpdBtns(id, false);
}

function dpG(id) {
  return document.getElementById('dpv_' + id)?.value || '';
}

// Close date picker when clicking outside
document.addEventListener('click', e => {
  if (_dpO && !e.target.closest('.dpw')) {
    document.querySelectorAll('.dpp.show').forEach(x => x.classList.remove('show'));
    _dpO = null;
  }
});

// ================================================================
// HELPER: Generate Dropdown Options
// ================================================================
function optionsHTML(items, selected, emptyLabel) {
  let h = emptyLabel ? `<option value="">${emptyLabel}</option>` : '';
  items.forEach(item => {
    if (typeof item === 'string') {
      h += `<option value="${item}" ${item === selected ? 'selected' : ''}>${item}</option>`;
    } else {
      h += `<option value="${item.id||item.value}" ${(item.id||item.value) === selected ? 'selected' : ''}>${item.name||item.label}</option>`;
    }
  });
  return h;
}

// Dealer dropdown
function dealerOptions(selectedId) {
  const dealers = ST.getAll('dealers');
  return optionsHTML(
    dealers.map(d => ({ id: d.id, name: d.name })),
    selectedId,
    '-- เลือก Dealer --'
  );
}

// Model dropdown (backward compatible with Object models)
function modelOptions(selected) {
  return modelOptionsNew(selected);
}

// ================================================================
// HELPER: Sanitize HTML (prevent XSS)
// ================================================================
function sanitize(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Safe render (allow basic HTML but escape user content)
function safeText(str) {
  return sanitize(str).replace(/\n/g, '<br>');
}