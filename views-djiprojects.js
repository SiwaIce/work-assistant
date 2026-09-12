// ================================================================
// ทะเบียน Project ID — ไฟล์ Project export จากระบบ CRM ของ DJI
//
// Dealer ลงทะเบียนโครงการไว้กับ DJI เองแล้วได้ Project ID กลับมา ซึ่งหลายครั้งเขาไม่ได้บอกเรา ไฟล์นี้จึงเป็น
// ทางเดียวที่จะรู้ว่ามีโครงการอะไรวิ่งอยู่บ้าง — ของจริงจากไฟล์แรก: 120 โครงการ มีแค่ 5 ที่ขายออกไปแล้ว
// อีก 115 เราไม่เคยเห็นมาก่อนเลย
//
// ทะเบียนนี้เป็นของ "ฝั่ง DJI" เก็บแยกจาก pipeline โดยตั้งใจ แล้วผูกกันด้วย pipelineId ทีละอัน — ไม่ยัดเข้า
// pipeline อัตโนมัติ เพราะชื่อโครงการในไฟล์ซ้ำกันเยอะจนจับเองไม่ได้ (120 โครงการ ชื่อไม่ซ้ำแค่ 66 ชื่อ
// ชื่อเดียวโผล่ 32 ครั้ง คนละวิทยาลัยคนละจังหวัด) เดาผิดทีเดียวยอดไปโผล่ผิดโครงการ
//
// Dealer จับจากช่อง Created By ซึ่ง DJI เขียนเป็น "ชื่อ-รหัส" เช่น "PDA THAI CO., LTD.-50017170"
// ที่จับไม่ได้คือแถวที่พนักงานเราลงทะเบียนเอง ("SIS Distribution-Andree") — ต้องเลือก Dealer ให้เอง
// ================================================================

var DJP_COLS = [
  { key: 'djiId',   alias: ['id'] },
  { key: 'pid',     alias: ['project id', 'projectid'], required: true, label: 'Project ID' },
  { key: 'name',    alias: ['projects name', 'project name'], required: true, label: 'Projects Name' },
  { key: 'acct',    alias: ['account name'], label: 'Account Name' },
  { key: 'country', alias: ['project country/region', 'country'] },
  { key: 'prov',    alias: ['project province/state', 'province'] },
  { key: 'poc',     alias: ['poc project', 'poc'] },
  { key: 'created', alias: ['date created'], required: true, label: 'Date Created' },
  { key: 'by',      alias: ['created by'], required: true, label: 'Created By' },
  { key: 'updated', alias: ['date updated'] },
  { key: 'updatedBy', alias: ['updated by'] }
];

var djpTab = 'all', djpQ = '', djpPeriod = 'all', djpBasis = 'reg', djpAnchor = '', djpOpenDealer = null, djpSel = {};

// เลขที่ลงทะเบียนไว้ถูกเอาไปใช้ได้สองแบบ: เป็นโครงการจริง (ผูก Pipeline) หรือเป็นถังรับยอด Run rate
// ไฟล์ CRM ไม่ได้บอกว่าอันไหนเป็นอะไร จึงเริ่มที่ '' = ยังไม่รู้ แล้วรู้เอาทีหลังจาก 3 ทาง:
// เลือกเองในหน้านี้ · ผูกกับ Pipeline/ถังแล้วรู้เอง · หรือมีคนกรอกเลขนี้ลงใบเสนอราคา/SO ที่ระบุประเภทไว้แล้ว
var DJP_KINDS = {
  '':        { label: 'ยังไม่ระบุ', icon: '❔', color: 'var(--text2)' },
  project:   { label: 'โครงการ',    icon: '📋', color: '#60a5fa' },
  runrate:   { label: 'Run rate',   icon: '🏪', color: '#a78bfa' }
};
function djpKindOf(p) {
  if (p.kind) return p.kind;
  if (p.pipelineId) return 'project';
  if (p.runrateId) return 'runrate';
  return '';
}

// หาทะเบียนจากเลข — ใช้ pidSame เพื่อให้ "ID20260611-0022" กับ "20260611-0022" เจอกัน
function djpFindByPid(pid) {
  if (!pidNorm(pid)) return null;
  return ST.getAll('djiProjects').filter(function(p) { return pidSame(p.pid, pid); })[0] || null;
}

// เรียกจากตอนบันทึกใบเสนอราคา/SO — เอกสารพวกนั้นระบุประเภทไว้อยู่แล้ว ถ้าทะเบียนยังไม่รู้ว่าเลขนี้เป็นอะไร
// ก็ถือว่าได้คำตอบแล้ว เขียนให้เลยโดยไม่ต้องถาม (เขียนเฉพาะตอนยังว่าง — ไม่ไปทับสิ่งที่คนตั้งใจเลือกไว้เอง)
function djpNoteKindFromDoc(pid, kind) {
  if (!pidNorm(pid) || (kind !== 'project' && kind !== 'runrate')) return false;
  var p = djpFindByPid(pid);
  if (!p || p.kind) return false;
  var up = ST.update('djiProjects', p.id, { kind: kind });
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
  if (typeof toast === 'function') toast('🗂️ บันทึกไว้ในทะเบียนแล้วว่า ' + p.pid + ' เป็น' + DJP_KINDS[kind].label);
  return true;
}

function djpSetKind(id, kind) {
  var up = ST.update('djiProjects', id, { kind: kind });
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
  render();
}

// ---------------------------------------------------------------- ตัวช่วย
function _djpNorm(v) { return String(v === null || v === undefined ? '' : v).trim(); }
// ไฟล์ CRM เขียนวันที่เป็น DD/MM/YYYY HH:MM ซึ่งกลับหัวกับไฟล์สมุดเดินของที่เป็น ISO — แปลงเองทั้งคู่
// อย่าปล่อยให้ new Date() เดา เพราะวันที่ ≤ 12 จะถูกอ่านสลับวัน/เดือนเงียบๆ
function _djpDate(v) {
  if (v instanceof Date && !isNaN(v)) {
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  }
  var s = _djpNorm(v);
  var m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return m ? m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0') : '';
}
// "PDA THAI CO., LTD.-50017170" → { name, code } · "SIS Distribution-Andree" → code ว่าง (พนักงานเรา ไม่ใช่ dealer)
function _djpSplitCreatedBy(v) {
  var s = _djpNorm(v);
  var m = s.match(/^(.*)-(\d{7,9})$/);
  return m ? { name: m[1].trim(), code: m[2] } : { name: s, code: '' };
}
function djpDealerOf(p) {
  if (p.dealerId) { var d = ST.getOne('dealers', p.dealerId); if (d) return d; }
  var code = _djpNorm(p.dealerCode).toUpperCase();
  if (!code) return null;
  return ST.getAll('dealers').filter(function(d) { return _djpNorm(d.djiCode).toUpperCase() === code; })[0] || null;
}
function djpPipelineOf(p) { return p.pipelineId ? ST.getOne('pipeline', p.pipelineId) : null; }
function djpRunrateOf(p) { return p.runrateId ? ST.getOne('runrate', p.runrateId) : null; }
// ถังที่ใช้เลขเดียวกันอยู่แล้ว — ถังบังคับให้มี Project ID ตั้งแต่สร้าง เลขจึงเป็นตัวจับคู่ที่แน่นอนที่สุด
function djpBucketByPid(p) {
  return _djpRRs().filter(function(r) { return pidSame(r.projectId, p.pid); })[0] || null;
}

// ---- ยอดเงิน: คาดการณ์ กับ ขายจริง คนละแหล่งกัน จึงคืนคู่กันเสมอ ไม่ยุบเป็นตัวเดียว ----
// คาดการณ์ = forecast ของโครงการใน Pipeline ที่ผูกไว้ (ยังไม่ผูก = ยังไม่มีตัวเลข)
// ขายจริง   = ผลรวม SO ที่ถือ Project ID นี้ หรือผูกกับ pipeline เดียวกัน
function _djpSOTotal(s) {
  return (s.items || []).reduce(function(t, it) { return t + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);
}
function _djpSODate(s) { return (s.invoiceDate || (s.createdAt || '').slice(0, 10) || ''); }
// เดินตาม "ชนิด" ของทะเบียนเท่านั้น ไม่รวมสองฝั่งเข้าด้วยกัน — เดิมรวมทั้ง SO ฝั่งโครงการและ SO ในถังที่ใช้
// เลขเดียวกัน ทำให้เงินก้อนเดียวถูกนับทั้งใน "Project — ขายจริง" และ "Run rate — ขายจริง" พร้อมกัน
// อ่าน salesOrders/runrate ครั้งเดียวต่อรอบวาดจอ — เดิม djpSOsOf ถูกเรียกหลายรอบต่อโครงการ (สถิติ + หัวกลุ่ม
// + แถว) แต่ละรอบ parse localStorage ทั้งก้อน คูณ 120 โครงการ คูณทุกตัวอักษรที่พิมพ์ในช่องค้นหา
// แคชผูกกับเลขรุ่นของข้อมูล (ST.rev()) ไม่ใช่รอบวาดจออย่างเดียว — ถ้ามีการเขียน SO/ถังระหว่างทาง
// (เปิด SO จากในโมดัล, ข้อมูลใหม่ไหลมาจาก Firebase) แคชจะสร้างใหม่เอง ไม่ต้องรอใครเรียก _djpBust()
var _djpSOCache = null, _djpRRCache = null, _djpCacheRev = -1;
function _djpBust() { _djpSOCache = null; _djpRRCache = null; _djpCacheRev = -1; }
function _djpFresh() {
  var r = (typeof ST.rev === 'function') ? ST.rev() : 0;
  if (r !== _djpCacheRev) { _djpSOCache = null; _djpRRCache = null; _djpCacheRev = r; }
}
function _djpSOs() { _djpFresh(); return _djpSOCache || (_djpSOCache = ST.getAll('salesOrders')); }
function _djpRRs() { _djpFresh(); return _djpRRCache || (_djpRRCache = ST.getAll('runrate')); }

function djpSOsOf(p) {
  var kind = djpKindOf(p);
  var sos = _djpSOs();
  if (kind === 'runrate') {
    var rr = p.runrateId || (djpBucketByPid(p) || {}).id || '';
    if (!rr) return [];
    // SO แบบ run rate ไม่ถือเลขของตัวเอง ยอดผูกกับถังแทน (ดู saveCreateSO) จึงตามผ่านถังอย่างเดียว
    return sos.filter(function(s) { return s.runrateId === rr; });
  }
  return sos.filter(function(s) {
    if (s.runrateId) return false;                       // ใบนั้นเป็นยอดของถัง ไม่ใช่ของโครงการ
    if (s.projectId && pidSame(s.projectId, p.pid)) return true;
    return !!(p.pipelineId && s.pipelineId === p.pipelineId);
  });
}
function djpAmounts(p, range) {
  var pipe = djpPipelineOf(p);
  var sos = djpSOsOf(p);
  if (range && djpBasis === 'sale') {
    sos = sos.filter(function(s) { var d = _djpSODate(s); return d && d >= range.from && d <= range.to; });
  }
  return {
    forecast: pipe ? (Number(pipe.forecastAmount) || 0) : 0,
    actual: sos.reduce(function(t, s) { return t + _djpSOTotal(s); }, 0),
    soCount: sos.length
  };
}

// ---- ช่วงเวลา ----
// นับได้สองแกน: วันที่ลงทะเบียน CRM (ตอบว่าเดือนนี้ dealer ลงโครงการมากี่อัน) หรือวันที่ขายจริง
// (ตอบว่าเดือนนี้เก็บเงินได้เท่าไหร่) — คนละคำถาม เลยให้สลับได้ ไม่เลือกแทน
var DJP_PERIODS = [
  { id: 'all',   label: 'ทั้งหมด' },
  { id: 'day',   label: 'วัน' },
  { id: 'month', label: 'เดือน' },
  { id: 'q',     label: 'ไตรมาส' },
  { id: 'h',     label: 'ครึ่งปี' },
  { id: 'year',  label: 'ปี' }
];
var DJP_TH_MON = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function _djpAnchor() { return djpAnchor || (typeof _td === 'function' ? _td() : new Date().toISOString().slice(0, 10)); }
function _djpEndOfMonth(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
function djpRange() {
  if (djpPeriod === 'all') return null;
  var a = _djpAnchor().split('-'), y = +a[0], m = +a[1] - 1, d = +a[2];
  var pad = function(n) { return String(n).padStart(2, '0'); };
  var iso = function(yy, mm, dd) { return yy + '-' + pad(mm + 1) + '-' + pad(dd); };
  if (djpPeriod === 'day')   return { from: iso(y, m, d), to: iso(y, m, d), label: d + ' ' + DJP_TH_MON[m] + ' ' + y };
  if (djpPeriod === 'month') return { from: iso(y, m, 1), to: iso(y, m, _djpEndOfMonth(y, m)), label: DJP_TH_MON[m] + ' ' + y };
  if (djpPeriod === 'q') {
    var q = Math.floor(m / 3), s = q * 3, e = s + 2;
    return { from: iso(y, s, 1), to: iso(y, e, _djpEndOfMonth(y, e)), label: 'Q' + (q + 1) + ' ' + y };
  }
  if (djpPeriod === 'h') {
    var half = m < 6 ? 0 : 1, hs = half * 6, he = hs + 5;
    return { from: iso(y, hs, 1), to: iso(y, he, _djpEndOfMonth(y, he)), label: 'H' + (half + 1) + ' ' + y };
  }
  return { from: iso(y, 0, 1), to: iso(y, 11, 31), label: 'ปี ' + y };
}
function djpShiftPeriod(dir) {
  var a = _djpAnchor().split('-'), y = +a[0], m = +a[1] - 1, d = +a[2];
  var step = { day: 1, month: 1, q: 3, h: 6, year: 12 };
  if (djpPeriod === 'day') {
    var dt = new Date(Date.UTC(y, m, d + dir));
    djpAnchor = dt.toISOString().slice(0, 10);
  } else if (djpPeriod !== 'all') {
    var dt2 = new Date(Date.UTC(y, m + step[djpPeriod] * dir, 1));
    djpAnchor = dt2.toISOString().slice(0, 10);
  }
  render();
}
function djpSetPeriod(v) { djpPeriod = v; render(); }
function djpSetBasis(v) { djpBasis = v; render(); }
function djpSetTab(v) { djpTab = v; render(); }

// โครงการนี้อยู่ในช่วงที่เลือกไหม — ขึ้นกับว่านับตามวันลงทะเบียนหรือวันขาย
function djpInRange(p, range) {
  if (!range) return true;
  if (djpBasis === 'reg') return p.regDate && p.regDate >= range.from && p.regDate <= range.to;
  return djpSOsOf(p).some(function(s) { var d = _djpSODate(s); return d && d >= range.from && d <= range.to; });
}

// ---------------------------------------------------------------- นำเข้าไฟล์
function _djpBuildColMap(headerRow) {
  var map = {}, missing = [];
  var norm = (headerRow || []).map(function(h) { return _djpNorm(h).toLowerCase().replace(/\s+/g, ' '); });
  DJP_COLS.forEach(function(def) {
    for (var i = 0; i < norm.length; i++) {
      if (def.alias.indexOf(norm[i]) !== -1) { map[def.key] = i; return; }
    }
    if (def.required) missing.push(def.label || def.key);
  });
  return { map: map, missing: missing };
}

function importDjiProjectsXlsx() {
  if (typeof XLSX === 'undefined') { toast('⚠️ ตัวอ่านไฟล์ Excel ยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง', true); return; }
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: 'binary', cellDates: true });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        if (!aoa.length) { toast('⚠️ ไม่พบข้อมูลในไฟล์', true); return; }
        var col = _djpBuildColMap(aoa[0]);
        if (col.missing.length) {
          alert('ไฟล์นี้ไม่มีคอลัมน์ที่จำเป็น:\n\n' + col.missing.map(function(x) { return '· ' + x; }).join('\n') +
                '\n\nต้องเป็นไฟล์ Project ที่ export จากระบบ CRM ของ DJI');
          return;
        }
        var g = function(r, k) { return col.map[k] === undefined ? '' : _djpNorm(r[col.map[k]]); };
        var recs = [];
        aoa.slice(1).forEach(function(r) {
          if (!r || !_djpNorm(col.map.pid === undefined ? '' : r[col.map.pid])) return;
          var cb = _djpSplitCreatedBy(g(r, 'by'));
          recs.push({
            djiId: g(r, 'djiId'), pid: g(r, 'pid'), name: g(r, 'name'), acct: g(r, 'acct'),
            prov: g(r, 'prov'), poc: g(r, 'poc'),
            createdBy: g(r, 'by'), dealerName: cb.name, dealerCode: cb.code,
            regDate: _djpDate(col.map.created === undefined ? '' : r[col.map.created]),
            updatedBy: g(r, 'updatedBy'),
            updatedDate: _djpDate(col.map.updated === undefined ? '' : r[col.map.updated])
          });
        });
        if (!recs.length) { toast('⚠️ ไฟล์ไม่มีแถวข้อมูล', true); return; }
        _djpShowImportPreview(recs, file.name);
      } catch (err) {
        console.error(err);
        alert('อ่านไฟล์ไม่สำเร็จ: ' + (err && err.message ? err.message : err));
      }
    };
    reader.readAsBinaryString(file);
  };
  input.click();
}

function _djpShowImportPreview(recs, filename) {
  // Project ID เป็นตัวระบุตัวตนของโครงการ ไฟล์งวดถัดไปจะมีของเดิมทับมาเสมอ — ตัวที่เคยมีแล้วถือเป็น "อัปเดต"
  // ไม่ใช่ของใหม่ และต้องไม่ไปทับ pipelineId/dealerId ที่เราผูกไว้เองแล้ว
  var byPid = {};
  ST.getAll('djiProjects').forEach(function(p) { var c = pidCore(p.pid) || _djpNorm(p.pid); byPid[c] = p; });
  var fresh = [], upd = [], seen = {};
  recs.forEach(function(r) {
    var c = pidCore(r.pid) || _djpNorm(r.pid);
    if (seen[c]) return;
    seen[c] = 1;
    if (byPid[c]) upd.push({ rec: r, existing: byPid[c] }); else fresh.push(r);
  });

  var dealers = ST.getAll('dealers');
  var byCode = {};
  dealers.forEach(function(d) { var c = _djpNorm(d.djiCode).toUpperCase(); if (c) byCode[c] = d; });
  // จัดกลุ่มตามค่าใน Created By ก่อนถาม — ไฟล์จริง 120 โครงการมาจากบริษัทแค่ 9 ราย ถ้าถามรายแถวคือให้คน
  // เลือกซ้ำ 120 ครั้งเพื่อตอบคำถามเดียวกัน 9 คำตอบ (ผู้ใช้ทักมาเอง 2026-09-12)
  var matched = 0, groups = {};
  fresh.forEach(function(r) {
    if (r.dealerCode && byCode[r.dealerCode.toUpperCase()]) { matched++; return; }
    var key = r.createdBy || ('(' + (r.dealerName || 'ไม่ระบุ') + ')');
    var g = groups[key] || (groups[key] = { key: key, name: r.dealerName, code: r.dealerCode, rows: [] });
    g.rows.push(r);
  });
  var groupList = Object.keys(groups).map(function(k) { return groups[k]; })
    .sort(function(a, b) { return b.rows.length - a.rows.length; });
  var needDealer = groupList.reduce(function(t, g) { return t + g.rows.length; }, 0);
  window._djpPending = { fresh: fresh, upd: upd, groups: groupList };

  var h = '<div class="hint" style="margin-bottom:10px">📄 ' + sanitize(filename) + '</div>';
  h += '<div class="rr-stats" style="margin-bottom:12px">' +
    '<div class="rr-stat"><div class="n" style="color:#22c55e">' + fresh.length + '</div><div class="l">โครงการใหม่</div></div>' +
    '<div class="rr-stat"><div class="n">' + upd.length + '</div><div class="l">มีแล้ว อัปเดตให้</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:' + (needDealer ? 'var(--warn,#f59e0b)' : 'var(--text2)') + '">' + groupList.length + '</div><div class="l">บริษัทที่ต้องเลือก Dealer</div></div>' +
    '</div>';
  if (matched) h += '<div class="hint" style="margin-bottom:10px">✓ จับคู่ Dealer จากรหัสในช่อง Created By ได้เอง ' + matched + ' โครงการ</div>';

  if (groupList.length) {
    var dOpts = '<option value="">— ยังไม่ระบุ เก็บไว้ก่อน —</option>' +
      dealers.slice().sort(function(a, b) { return (a.name || '') > (b.name || '') ? 1 : -1; })
        .map(function(d) { return '<option value="' + d.id + '">' + sanitize(d.name) + (d.djiCode ? ' — ' + sanitize(d.djiCode) : '') + '</option>'; }).join('');
    h += '<div class="hint" style="color:var(--warn,#f59e0b);margin-bottom:8px">⚠️ ' + needDealer + ' โครงการจาก ' + groupList.length +
      ' บริษัทนี้ยังจับคู่ Dealer ไม่ได้ — เลือกทีเดียวใช้ได้ทั้งบริษัท หรือเว้นไว้แล้วมาผูกทีหลังก็ได้</div>';
    h += '<div id="djpGroupProgress" style="font-size:11px;color:var(--text2);margin-bottom:6px">0 / ' + groupList.length + ' บริษัท เลือกแล้ว</div>';
    h += '<div style="max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:12px">';
    groupList.forEach(function(g, i) {
      h += '<div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px">' +
        '<div style="font-size:12.5px;font-weight:600">' + sanitize(g.key) + '</div>' +
        '<div style="font-size:11px;color:var(--text2);margin:1px 0 5px">' + g.rows.length + ' โครงการ · ' +
        (g.code ? 'รหัส <span style="font-family:monospace">' + sanitize(g.code) + '</span> ยังไม่มีใน Dealer ของเรา'
                : 'ไม่มีรหัส DJI ต่อท้าย (ปกติคือคนของเราลงทะเบียนเอง)') + '</div>' +
        '<select class="inp" data-djp-group="' + i + '" style="font-size:12px" onchange="_djpGroupPicked(' + i + ')">' + dOpts + '</select>';
      // เขียนรหัสกลับให้ Dealer ที่เลือก = ครั้งหน้าไฟล์เดิมจับคู่ได้เอง ไม่ต้องมานั่งเลือกซ้ำทุกงวด
      if (g.code) {
        h += '<label style="display:flex;gap:6px;align-items:flex-start;margin-top:6px;font-size:11px;color:var(--text2);cursor:pointer">' +
          '<input type="checkbox" data-djp-savecode="' + i + '" checked style="margin-top:2px">' +
          '<span>บันทึกรหัส ' + sanitize(g.code) + ' ให้ Dealer ที่เลือกด้วย — งวดหน้าจะจับคู่ได้เอง</span></label>';
      }
      h += '</div>';
    });
    h += '</div>';
  }

  if (!fresh.length && !upd.length) {
    h += '<div class="empty"><p>ไฟล์นี้นำเข้าไปหมดแล้ว ไม่มีอะไรเปลี่ยน</p></div>';
    h += '<button class="btn bo btn-full" onclick="closeMForce()">ปิด</button>';
  } else {
    h += '<button class="btn bp btn-full" onclick="djpCommitImport()">💾 นำเข้า ' + fresh.length + ' ใหม่ · อัปเดต ' + upd.length + '</button>';
    h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="closeMForce()">ยกเลิก</button>';
  }
  openM('⬆️ นำเข้าทะเบียน Project ID', h);
}

function djpCommitImport() {
  var pend = window._djpPending;
  if (!pend) { closeMForce(); return; }
  // เก็บ Dealer ที่เลือกไว้รายบริษัท แล้วกระจายลงทุกโครงการของบริษัทนั้น
  var assign = {}, codeWrites = [];
  var groups = pend.groups || [];
  document.querySelectorAll('[data-djp-group]').forEach(function(sel) {
    var idx = Number(sel.getAttribute('data-djp-group'));
    var g = groups[idx];
    if (!g || !sel.value) return;
    g.rows.forEach(function(r) { assign[r.pid] = sel.value; });
    var cb = document.querySelector('[data-djp-savecode="' + idx + '"]');
    if (g.code && cb && cb.checked) codeWrites.push({ dealerId: sel.value, code: g.code });
  });

  // เขียนรหัส DJI กลับให้ Dealer — ทำก่อนบันทึกโครงการ เพื่อให้ djpDealerOf() จับคู่ได้ทันทีโดยไม่ต้องพึ่ง
  // dealerId ที่ฝังไว้รายแถว และงวดหน้าจะจับคู่อัตโนมัติตั้งแต่ต้น
  var dealerUpd = [];
  codeWrites.forEach(function(w) {
    var d = ST.getOne('dealers', w.dealerId);
    if (!d || pidNorm(d.djiCode)) return;      // มีรหัสอยู่แล้วไม่ทับ
    var u = ST.update('dealers', w.dealerId, { djiCode: w.code });
    if (u) dealerUpd.push(u);
  });
  if (dealerUpd.length && typeof syncToFirebase === 'function') syncToFirebase('dealers', dealerUpd);

  var now = new Date().toISOString();
  var added = ST.addMany('djiProjects', pend.fresh.map(function(r) {
    return Object.assign({ importedAt: now, pipelineId: '', dealerId: assign[r.pid] || '' }, r);
  }));
  if (pend.fresh.length && !added.length) {
    closeMForce();
    toast('❌ นำเข้าไม่สำเร็จ — เนื้อที่เก็บข้อมูลในเบราว์เซอร์ไม่พอ', true);
    return;
  }

  // อัปเดตของเดิม: เขียนทับเฉพาะข้อมูลที่มาจาก DJI ไม่แตะ pipelineId/dealerId ที่เราผูกไว้เอง
  var touched = [];
  pend.upd.forEach(function(u) {
    var r = u.rec;
    var up = ST.update('djiProjects', u.existing.id, {
      djiId: r.djiId, pid: r.pid, name: r.name, acct: r.acct, prov: r.prov, poc: r.poc,
      createdBy: r.createdBy, dealerName: r.dealerName, dealerCode: r.dealerCode,
      regDate: r.regDate, updatedBy: r.updatedBy, updatedDate: r.updatedDate, importedAt: now
    });
    if (up) touched.push(up);
  });

  window._djpPending = null;

  // รอให้ขึ้น cloud เสร็จก่อนค่อยบอกว่าสำเร็จ — เหตุผลเดียวกับฝั่งสมุดเดินของ (ดู djlCommitImport)
  var body = document.getElementById('mBd');
  if (body) body.innerHTML = '<div style="padding:18px;text-align:center"><div style="font-size:26px;margin-bottom:8px">⏳</div>' +
    '<div style="font-size:13px">กำลังบันทึกขึ้น Cloud — อย่าเพิ่งปิดหรือรีเฟรชหน้านี้</div></div>';
  var done = function(okCloud) {
    closeMForce();
    toast((okCloud === false
      ? '✅ นำเข้าในเครื่องแล้ว (' + added.length + ' ใหม่ · ' + touched.length + ' อัปเดต) — แต่ยังไม่ขึ้น Cloud'
      : '✅ นำเข้า ' + added.length + ' โครงการ · อัปเดต ' + touched.length) +
      (dealerUpd.length ? ' · บันทึกรหัส DJI ให้ ' + dealerUpd.length + ' Dealer' : ''));
    go('djiProjects');
  };
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects').then(done, function() { done(false); });
  else done();
}

// ---------------------------------------------------------------- จับคู่กับ Pipeline
// ให้คะแนนความน่าจะเป็นแทนการเดาให้เลย — Dealer ตรงกันสำคัญที่สุด รองมาคือ End User แล้วค่อยชื่อโครงการ
// (ชื่อในไฟล์ซ้ำกันเยอะจนเชื่อชื่ออย่างเดียวไม่ได้) เรียงตัวที่น่าจะใช่ขึ้นก่อน แล้วให้คนตัดสิน
function _djpTokens(s) {
  return _djpNorm(s).toLowerCase().replace(/[()\[\].,\-–—/]/g, ' ').split(/\s+/).filter(function(w) { return w.length > 2; });
}
function _djpSimWord(a, b) {
  var ta = _djpTokens(a), tb = _djpTokens(b);
  if (!ta.length || !tb.length) return 0;
  var setB = {};
  tb.forEach(function(w) { setB[w] = 1; });
  var hit = ta.filter(function(w) { return setB[w]; }).length;
  return hit / Math.max(ta.length, tb.length);
}

// ภาษาไทยไม่เว้นวรรคระหว่างคำ การตัดคำด้วยช่องว่างจึงพังเงียบๆ — วัดกับข้อความจริงแล้ว
// "จัดซื้ออากาศยานไร้คนขับ สตง." เทียบกับชื่อเต็มใน CRM ได้ 0.00 ทั้งที่เป็นโครงการเดียวกัน
// ส่วน 3-gram ตัวอักษรได้ 0.88 · "อบต.มาบยางพร" ↔ "องค์การบริหารส่วนตำบลมาบยางพร" 0.00 → 0.67
// หารด้วยชุดที่เล็กกว่า เพราะชื่อฝั่งหนึ่งมักเป็นชื่อย่อของอีกฝั่ง ไม่ใช่ข้อความยาวเท่ากัน
function _djpGrams(s, n) {
  s = _djpNorm(s).toLowerCase().replace(/[\s()\[\].,\-–—/ๆฯ"'‘’“”]/g, '');
  var out = {};
  for (var i = 0; i + n <= s.length; i++) out[s.substr(i, n)] = 1;
  return out;
}
function _djpSimGram(a, b) {
  var A = _djpGrams(a, 3), B = _djpGrams(b, 3);
  var ka = Object.keys(A), kb = Object.keys(B);
  if (!ka.length || !kb.length) return 0;
  var hit = ka.filter(function(g) { return B[g]; }).length;
  return hit / Math.min(ka.length, kb.length);
}
// เอาค่าที่สูงกว่า — สองวิธีเก่งคนละแบบ ตัดคำเก่งกับข้อความอังกฤษ/มีช่องว่าง n-gram เก่งกับไทยติดกัน
function _djpSimilar(a, b) { return Math.max(_djpSimWord(a, b), _djpSimGram(a, b)); }

// วันที่ใกล้กันเป็นสัญญาณที่ใช้ได้จริงเวลาชื่อช่วยอะไรไม่ได้: โครงการที่ dealer ลงทะเบียนกับ DJI มักลงใน
// ช่วงเดียวกับที่เราบันทึกเข้า Pipeline หรือช่วงใกล้วันยื่นประมูล — คืนจำนวนวันที่ห่างกันน้อยที่สุด
function _djpDaysApart(a, b) {
  if (!a || !b) return null;
  var d = Math.abs(new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z'));
  return isNaN(d) ? null : Math.round(d / 864e5);
}
function _djpDateHint(p, pipe) {
  var best = null, from = '';
  [['registerDate', 'วันบันทึกโครงการ'], ['biddingDate', 'วัน Bidding']].forEach(function(f) {
    var gap = _djpDaysApart(p.regDate, pipe[f[0]]);
    if (gap !== null && (best === null || gap < best)) { best = gap; from = f[1]; }
  });
  return best === null ? null : { days: best, from: from };
}
// สัญญาณที่ไม่ได้มาจากชื่อ — ใช้ตอนชื่อสองฝั่งช่วยอะไรไม่ได้ ซึ่งเป็นเคสที่ยากที่สุด
// ให้น้ำหนักน้อยกว่าเลข/Dealer โดยตั้งใจ: มันเป็นตัวช่วย "เรียงลำดับ" ไม่ใช่หลักฐานว่าใช่
function _djpExtraSignals(p, pipe) {
  var score = 0, why = [];
  // โครงการที่ยังไม่มี Project ID คือตัวที่กำลังตามหาอยู่จริงๆ ดันขึ้นก่อนตัวที่มีเลขแล้ว
  if (!pidNorm(pipe.projectId)) { score += 1; why.push('ยังไม่มี Project ID'); }
  var dt = _djpDateHint(p, pipe);
  if (dt) {
    if (dt.days <= 7)       { score += 2;   why.push('ลงทะเบียนห่าง' + dt.from + ' ' + dt.days + ' วัน'); }
    else if (dt.days <= 30) { score += 1;   why.push('ลงทะเบียนห่าง' + dt.from + ' ' + dt.days + ' วัน'); }
    else if (dt.days <= 90) { score += 0.4; }
  }
  // Pipeline ไม่มีช่องจังหวัด แต่ชื่อหน่วยงานมักมีจังหวัดติดอยู่ ("...จ.ลพบุรี") — เช็คแบบได้เปล่าๆ
  var prov = _djpNorm(p.prov);
  if (prov) {
    var hay = (_djpNorm(pipe.endUserTH) + ' ' + _djpNorm(pipe.endUserEN) + ' ' + _djpNorm(pipe.projectName)).toLowerCase();
    if (hay.indexOf(prov.toLowerCase()) !== -1) { score += 1; why.push('มีชื่อจังหวัด ' + prov); }
  }
  return { score: score, why: why };
}

function djpSuggestPipelines(p) {
  var dealer = djpDealerOf(p);
  var used = {};
  ST.getAll('djiProjects').forEach(function(x) { if (x.pipelineId && x.id !== p.id) used[x.pipelineId] = 1; });
  return ST.getAll('pipeline').map(function(pipe) {
    var score = 0, why = [];
    if (pidNorm(pipe.projectId) && pidSame(pipe.projectId, p.pid)) { score += 10; why.push('เลข Project ID ตรงกัน'); }
    if (dealer && pipe.dealerId === dealer.id) { score += 3; why.push('Dealer เดียวกัน'); }
    var su = _djpSimilar(pipe.endUserTH, p.acct);
    if (su > 0.3) { why.push('End User ' + (su > 0.7 ? 'ตรงกัน' : 'คล้ายกัน')); }
    score += su * 3;
    var sn = _djpSimilar(pipe.projectName, p.name);
    if (sn > 0.3) { why.push('ชื่อโครงการ' + (sn > 0.7 ? 'ตรงกัน' : 'คล้ายกัน')); }
    score += sn * 2;
    var extra = _djpExtraSignals(p, pipe);
    score += extra.score; extra.why.forEach(function(w) { why.push(w); });
    if (used[pipe.id]) score -= 4;                      // ถูกผูกกับ Project ID อื่นไปแล้ว
    return { pipe: pipe, score: score, taken: !!used[pipe.id], why: why };
  }).filter(function(x) { return x.score > 0.4; })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, 12);
}

// ---- จับคู่อัตโนมัติ: เฉพาะคู่ที่เลข Project ID ตรงกันเป๊ะ ----
// เลขตรงกันคือหลักฐานที่แน่นอนที่สุดที่มี ไม่ใช่การเดาจากชื่อ จึงผูกให้ได้เลยโดยไม่ต้องถามทีละอัน
// แต่ "ชื่อ" ไม่แตะ — การเลือกว่าจะใช้ชื่อไหนเป็นการตัดสินใจ ไม่ควรทำแทนตอนกดปุ่มเดียว 30 รายการ
function djpAutoLinkPlan() {
  var out = { pipe: [], bucket: [], conflict: [], nameDiff: 0 };
  var pipes = ST.getAll('pipeline'), buckets = ST.getAll('runrate');
  ST.getAll('djiProjects').forEach(function(p) {
    if (p.pipelineId || p.runrateId) return;
    var kind = djpKindOf(p);
    var mp = (kind === 'runrate') ? [] : pipes.filter(function(x) { return pidNorm(x.projectId) && pidSame(x.projectId, p.pid); });
    var mb = (kind === 'project') ? [] : buckets.filter(function(x) { return pidSame(x.projectId, p.pid); });
    var total = mp.length + mb.length;
    if (!total) return;
    if (total > 1) { out.conflict.push(p); return; }
    if (mp.length) {
      out.pipe.push({ p: p, target: mp[0] });
      if (_djpNorm(p.name) !== _djpNorm(mp[0].projectName)) out.nameDiff++;
    } else {
      out.bucket.push({ p: p, target: mb[0] });
    }
  });
  return out;
}

function showDjpAutoLinkM() {
  var plan = djpAutoLinkPlan();
  window._djpAutoPlan = plan;
  var total = plan.pipe.length + plan.bucket.length;
  var h = '<div class="hint" style="margin-bottom:10px">ผูกให้เฉพาะคู่ที่<b>เลข Project ID ตรงกันเป๊ะ</b> — เป็นหลักฐานที่แน่นอน ไม่ใช่การเดาจากชื่อ</div>';
  h += '<div class="rr-stats" style="margin-bottom:12px">' +
    '<div class="rr-stat"><div class="n" style="color:#60a5fa">' + plan.pipe.length + '</div><div class="l">ผูกกับโครงการ</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:#a78bfa">' + plan.bucket.length + '</div><div class="l">ผูกกับถัง Run rate</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:' + (plan.conflict.length ? 'var(--warn,#f59e0b)' : 'var(--text2)') + '">' + plan.conflict.length + '</div><div class="l">เลขซ้ำหลายที่ ข้ามไป</div></div>' +
    '</div>';
  if (plan.nameDiff) {
    h += '<div class="hint" style="margin-bottom:10px">ℹ️ ในนั้นมี ' + plan.nameDiff + ' คู่ที่ชื่อโครงการสองฝั่งไม่ตรงกัน — ผูกให้ก่อนโดย<b>ไม่แตะชื่อ</b> ' +
      'แล้วค่อยกดเข้าไปเลือกทีละอันว่าจะใช้ชื่อไหน (เลือกชื่อเป็นการตัดสินใจ ไม่ควรทำแทนรวดเดียว)</div>';
  }
  if (plan.conflict.length) {
    h += '<div class="hint" style="color:var(--warn,#f59e0b);margin-bottom:10px">⚠️ เลขเหล่านี้ไปตรงกับหลายที่พร้อมกัน ต้องเลือกเอง: ' +
      plan.conflict.slice(0, 5).map(function(p) { return '<span style="font-family:monospace">' + sanitize(p.pid) + '</span>'; }).join(', ') +
      (plan.conflict.length > 5 ? ' …อีก ' + (plan.conflict.length - 5) : '') + '</div>';
  }
  if (!total) {
    h += '<div class="empty"><p>ไม่มีคู่ที่เลขตรงกันเหลือให้ผูกแล้ว</p></div><button class="btn bo btn-full" onclick="closeMForce()">ปิด</button>';
  } else {
    h += '<button class="btn bp btn-full" onclick="djpCommitAutoLink()">🔗 ผูกให้เลย ' + total + ' คู่</button>';
    h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="closeMForce()">ยกเลิก</button>';
  }
  openM('⚡ จับคู่อัตโนมัติจากเลขที่ตรงกัน', h);
}

function djpCommitAutoLink() {
  var plan = window._djpAutoPlan;
  if (!plan) { closeMForce(); return; }
  var upd = [], pipeUpd = [];
  plan.pipe.forEach(function(x) {
    var u = ST.update('djiProjects', x.p.id, { pipelineId: x.target.id, kind: 'project' });
    if (u) upd.push(u);
    if (!x.target.djiCrmRegistered) {
      var pu = ST.update('pipeline', x.target.id, { djiCrmRegistered: true, djiCrmDate: x.target.djiCrmDate || x.p.regDate || _td() });
      if (pu) pipeUpd.push(pu);
    }
  });
  plan.bucket.forEach(function(x) {
    var u = ST.update('djiProjects', x.p.id, { runrateId: x.target.id, kind: 'runrate' });
    if (u) upd.push(u);
  });
  window._djpAutoPlan = null;
  if (typeof syncToFirebase === 'function') {
    if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
    if (pipeUpd.length) syncToFirebase('pipeline', pipeUpd);
  }
  closeMForce();
  toast('🔗 ผูกให้แล้ว ' + upd.length + ' คู่');
  render();
}

function showDjpLinkM(id) {
  var p = ST.getOne('djiProjects', id);
  if (!p) return;
  var sug = djpSuggestPipelines(p);
  var dealer = djpDealerOf(p);

  var h = '<div style="border:1px solid var(--border);border-radius:8px;padding:9px 11px;margin-bottom:10px">';
  h += '<div style="font-family:monospace;font-weight:700">' + sanitize(p.pid) + '</div>';
  h += '<div style="font-size:12px;margin-top:2px">' + sanitize(p.name) + '</div>';
  h += '<div style="font-size:11px;color:var(--text2);margin-top:2px">🏢 ' + sanitize(p.acct || '-') +
       ' · 📍 ' + sanitize(p.prov || '-') + ' · 🏪 ' + sanitize(dealer ? dealer.name : (p.dealerName || '—')) + '</div></div>';

  if (p.pipelineId) {
    var cur = djpPipelineOf(p);
    h += '<div class="hint" style="margin-bottom:10px">ตอนนี้ผูกอยู่กับ: <b>' + sanitize(cur ? cur.projectName : '(โครงการถูกลบไปแล้ว)') + '</b>' +
      ' <a href="#" onclick="djpUnlink(\'' + p.id + '\');return false" style="color:var(--danger,#ef4444)">ยกเลิกการผูก</a></div>';
  }

  // เลือกชนิดได้ตรงนี้ หรือปล่อยให้รู้เองตอนกรอกเลขนี้ในใบเสนอราคา/SO ก็ได้ — ชนิดเป็นตัวกำหนดว่า
  // "ผูก" หมายถึงผูกกับโครงการใน Pipeline หรือผูกกับถังรับยอด Run rate ซึ่งคนละที่กันคนละความหมาย
  var kind = djpKindOf(p);
  h += '<div class="hint" style="margin-bottom:6px">เลขนี้ใช้เป็นอะไร</div>';
  h += '<div class="rr-toolbar" style="margin-bottom:10px">';
  ['project', 'runrate'].forEach(function(k) {
    h += '<button class="btn bsm ' + (kind === k ? 'bp' : 'bo') + '" onclick="djpSetKindInModal(\'' + p.id + '\',\'' + k + '\')">' +
      DJP_KINDS[k].icon + ' ' + DJP_KINDS[k].label + '</button>';
  });
  if (kind) h += '<button class="btn bsm bo" onclick="djpSetKindInModal(\'' + p.id + '\',\'\')">ล้าง</button>';
  h += '</div>';

  if (kind === 'runrate') {
    // ฝั่ง Run rate: ถังบังคับให้มี Project ID ตั้งแต่สร้าง เลขจึงจับคู่กันได้ตรงๆ ไม่ต้องเดา
    var cur = djpRunrateOf(p);
    if (cur) {
      h += '<div class="hint" style="margin-bottom:10px">ตอนนี้ผูกอยู่กับถัง <b>' + sanitize(cur.projectId || '(ไม่มีเลข)') + '</b> ' +
        '<a href="#" onclick="djpUnlink(\'' + p.id + '\');return false" style="color:var(--danger,#ef4444)">ยกเลิกการผูก</a></div>';
    }
    var same = djpBucketByPid(p);
    if (same && (!cur || cur.id !== same.id)) {
      h += '<div style="border:1px solid var(--ok,#22c55e);border-radius:8px;padding:9px 11px;margin-bottom:8px;cursor:pointer" onclick="djpLinkBucket(\'' + p.id + '\',\'' + same.id + '\')">' +
        '<div style="font-size:12.5px;font-weight:600">✓ มีถังที่ใช้เลขนี้อยู่แล้ว — กดผูกได้เลย</div>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:2px">' + sanitize(same.projectId) +
        (same.models ? ' · ' + sanitize(String(same.models).substr(0, 26)) : '') + '</div></div>';
    }
    var others = ST.getAll('runrate').filter(function(r) {
      return (!same || r.id !== same.id) && (!dealer || r.dealerId === dealer.id);
    });
    if (others.length) {
      h += '<div class="hint" style="margin-bottom:6px">หรือเลือกถังอื่นของ Dealer รายนี้</div>';
      h += '<div style="max-height:180px;overflow:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:10px">';
      others.forEach(function(r) {
        h += '<div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;cursor:pointer" onclick="djpLinkBucket(\'' + p.id + '\',\'' + r.id + '\')">' +
          '<div style="font-family:monospace;font-size:12px">' + sanitize(r.projectId || '(ไม่มีเลข)') + '</div>' +
          (r.models ? '<div style="font-size:11px;color:var(--text2)">' + sanitize(r.models) + '</div>' : '') + '</div>';
      });
      h += '</div>';
    }
    if (!same) {
      h += '<button class="btn bo btn-full" onclick="djpCreateBucketFrom(\'' + p.id + '\')">➕ ยังไม่มีถัง — สร้างถัง Run rate ด้วยเลขนี้</button>';
    }
    h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="closeMForce()">ปิด</button>';
    openM('🔗 ผูกกับถัง Run rate', h);
    return;
  }

  h += '<div class="hint" style="margin-bottom:6px">เลือกโครงการใน Pipeline ที่ตรงกัน — เรียงตัวที่น่าจะใช่ขึ้นก่อน พร้อมบอกว่าเสนอเพราะอะไร</div>';
  if (!sug.length) {
    h += '<div class="empty" style="padding:12px"><p>ไม่เจอโครงการที่ใกล้เคียงเลย — สร้างใหม่จากทะเบียนนี้ได้</p></div>';
  } else {
    h += '<div style="max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:10px">';
    sug.forEach(function(x) {
      var d = ST.getOne('dealers', x.pipe.dealerId);
      var exact = x.why.indexOf('เลข Project ID ตรงกัน') !== -1;
      h += '<div style="border:1px solid ' + (exact ? 'var(--ok,#22c55e)' : 'var(--border)') + ';border-radius:8px;padding:8px 10px;cursor:pointer" onclick="djpPickPipeline(\'' + p.id + '\',\'' + x.pipe.id + '\')">' +
        '<div style="font-size:12.5px;font-weight:600">' + (exact ? '✓ ' : '') + sanitize(String(x.pipe.projectName || '(ไม่มีชื่อ)').substr(0, 60)) + '</div>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:2px">' +
          (d ? '🏪 ' + sanitize(d.name) + ' · ' : '') +
          (x.pipe.endUserTH ? '🏢 ' + sanitize(String(x.pipe.endUserTH).substr(0, 26)) + ' · ' : '') +
          (pidNorm(x.pipe.projectId) ? '🗂️ ' + sanitize(x.pipe.projectId) : 'ยังไม่มี Project ID') +
        '</div>' +
        (x.why.length ? '<div style="font-size:10.5px;color:' + (exact ? 'var(--ok,#22c55e)' : 'var(--text2)') + ';margin-top:3px">เสนอเพราะ: ' + sanitize(x.why.join(' · ')) + '</div>' : '') +
        (x.taken ? '<div style="font-size:10.5px;color:var(--warn,#f59e0b);margin-top:2px">⚠ ผูกกับเลขอื่นอยู่แล้ว</div>' : '') +
        '</div>';
    });
    h += '</div>';
  }
  h += '<button class="btn bo btn-full" onclick="djpCreatePipelineFrom(\'' + p.id + '\')">➕ ไม่มีในระบบ — สร้างโครงการใหม่จากทะเบียนนี้</button>';
  h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="closeMForce()">ปิด</button>';
  openM('🔗 ผูกกับโครงการใน Pipeline', h);
}

// เปลี่ยนชนิดจากในโมดัลแล้วเปิดใหม่ทันที เพราะทั้งหน้าตาและความหมายของ "ผูก" เปลี่ยนตามชนิด
function djpSetKindInModal(id, kind) {
  var up = ST.update('djiProjects', id, { kind: kind });
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
  showDjpLinkM(id);
}

function djpLinkBucket(id, rrId) {
  var p = ST.getOne('djiProjects', id), r = ST.getOne('runrate', rrId);
  if (!p || !r) return;
  if (!pidSame(r.projectId, p.pid) &&
      !confirm('เลขไม่ตรงกัน\n\nทะเบียน: ' + p.pid + '\nถัง: ' + (r.projectId || '(ไม่มีเลข)') +
               '\n\nยอดของ SO จะเข้าถังตามที่เลือก ไม่ใช่ตามเลขในทะเบียน\n\nตกลง = ผูกตามนี้')) return;
  var up = ST.update('djiProjects', id, { runrateId: rrId, kind: 'runrate', pipelineId: '' });
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
  closeMForce();
  toast('🔗 ผูกกับถัง ' + (r.projectId || '') + ' แล้ว');
  render();
}

// สร้างถังใหม่ด้วยเลขของทะเบียนนี้ — ถัง Run rate บังคับว่าต้องมี Dealer และเลข จึงต้องรู้ Dealer ก่อน
function djpCreateBucketFrom(id) {
  var p = ST.getOne('djiProjects', id);
  if (!p) return;
  var dealer = djpDealerOf(p);
  if (!dealer) { alert('ยังไม่รู้ว่าเลขนี้เป็นของ Dealer ไหน — ระบุ Dealer ก่อนถึงจะสร้างถังได้'); return; }
  var dup = (typeof _rrFindByProjectId === 'function') ? _rrFindByProjectId(p.pid, null) : null;
  if (dup) { djpLinkBucket(id, dup.id); return; }
  _djpBust();
  var saved = ST.add('runrate', {
    dealerId: dealer.id, projectId: p.pid, models: '', status: 'active',
    note: 'สร้างจากทะเบียน Project ID ของ DJI CRM', createdAt: new Date().toISOString()
  });
  if (!saved) { toast('สร้างถังไม่สำเร็จ', true); return; }
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('runrate', saved);
  var up = ST.update('djiProjects', id, { runrateId: saved.id, kind: 'runrate', pipelineId: '' });
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
  closeMForce();
  toast('✅ สร้างถัง Run rate ' + p.pid + ' แล้ว');
  render();
}

// ชื่อสองฝั่งไม่ตรงกันเป็นเรื่องปกติ (คนละคนตั้ง คนละเวลา) — ถามว่าจะใช้ชื่อไหน แล้วเขียนให้ตรงกันทั้งคู่
// จะได้ไม่ต้องมานั่งเดาทีหลังว่าโครงการเดียวกันหรือคนละอัน
function djpPickPipeline(projId, pipeId) {
  var p = ST.getOne('djiProjects', projId), pipe = ST.getOne('pipeline', pipeId);
  if (!p || !pipe) return;
  var a = _djpNorm(p.name), b = _djpNorm(pipe.projectName);
  if (a === b) { _djpApplyLink(projId, pipeId, null); return; }

  var h = '<div class="hint" style="margin-bottom:10px">ทั้งสองที่ใช้คนละชื่อ เลือกชื่อที่จะใช้ แล้วจะบันทึกชื่อนั้นให้ทั้งสองฝั่งตรงกันตั้งแต่นี้ไป</div>';
  h += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">';
  h += '<div style="border:1px solid var(--border);border-radius:8px;padding:9px 11px;cursor:pointer" onclick="_djpApplyLink(\'' + projId + '\',\'' + pipeId + '\',\'crm\')">' +
    '<div style="font-size:10.5px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">ชื่อจากทะเบียน CRM</div>' +
    '<div style="font-size:12.5px;margin-top:2px">' + sanitize(a) + '</div></div>';
  h += '<div style="border:1px solid var(--border);border-radius:8px;padding:9px 11px;cursor:pointer" onclick="_djpApplyLink(\'' + projId + '\',\'' + pipeId + '\',\'pipe\')">' +
    '<div style="font-size:10.5px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">ชื่อที่ใช้อยู่ใน Pipeline</div>' +
    '<div style="font-size:12.5px;margin-top:2px">' + sanitize(b) + '</div></div>';
  h += '<div style="border:1px solid var(--border);border-radius:8px;padding:9px 11px">' +
    '<div style="font-size:10.5px;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">พิมพ์ชื่อใหม่เอง</div>' +
    '<input id="djpCustomName" class="inp" style="margin-top:4px" placeholder="พิมพ์ชื่อที่อยากให้ใช้ทั้งสองที่…">' +
    '<button class="btn bo bsm" style="margin-top:6px" onclick="_djpApplyLink(\'' + projId + '\',\'' + pipeId + '\',\'custom\')">ใช้ชื่อนี้</button></div>';
  h += '</div>';
  h += '<button class="btn bo btn-full" onclick="_djpApplyLink(\'' + projId + '\',\'' + pipeId + '\',null)">ผูกเฉยๆ ไม่แก้ชื่อทั้งสองฝั่ง</button>';
  openM('ชื่อโครงการไม่ตรงกัน', h);
}

function _djpApplyLink(projId, pipeId, nameFrom) {
  var p = ST.getOne('djiProjects', projId), pipe = ST.getOne('pipeline', pipeId);
  if (!p || !pipe) return;
  var name = null;
  if (nameFrom === 'crm') name = _djpNorm(p.name);
  else if (nameFrom === 'pipe') name = _djpNorm(pipe.projectName);
  else if (nameFrom === 'custom') {
    name = _djpNorm((document.getElementById('djpCustomName') || {}).value);
    if (!name) { alert('พิมพ์ชื่อก่อนนะครับ'); return; }
  }

  // ผูกฝั่งโครงการแล้วต้องล้างฝั่งถังทิ้ง ไม่งั้นทะเบียนเดียวค้างอยู่ทั้งสองทางแล้วยอดถูกนับซ้ำ
  var projUpd = { pipelineId: pipeId, runrateId: '', kind: 'project' };
  if (name) projUpd.name = name;
  var savedProj = ST.update('djiProjects', projId, projUpd);
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');

  var pipeUpd = {};
  if (name && name !== _djpNorm(pipe.projectName)) pipeUpd.projectName = name;
  // ผูกแล้วก็ถือโอกาสเติม Project ID ให้โครงการด้วย ถ้ายังว่าง — นี่คือทั้งประเด็นของการผูก
  if (!pidNorm(pipe.projectId)) {
    pipeUpd.projectId = p.pid;
    if (!pipe.djiCrmRegistered) { pipeUpd.djiCrmRegistered = true; pipeUpd.djiCrmDate = pipe.djiCrmDate || p.regDate || _td(); }
  }
  if (Object.keys(pipeUpd).length) {
    var savedPipe = ST.update('pipeline', pipeId, pipeUpd);
    if (savedPipe && typeof syncItemToFirebase === 'function') syncItemToFirebase('pipeline', savedPipe);
    try {
      var lg = ST.add('pipeLog', { pipeId: pipeId, type: 'note', date: _td(),
        content: 'ผูกกับทะเบียน Project ID ' + p.pid + (pipeUpd.projectName ? ' · เปลี่ยนชื่อโครงการเป็น "' + name + '"' : ''),
        created: new Date().toISOString() });
      if (lg && typeof syncItemToFirebase === 'function') syncItemToFirebase('pipeLog', lg);
    } catch (e) {}
  }
  closeMForce();
  toast('🔗 ผูกกับ ' + (name || pipe.projectName) + ' แล้ว');
  render();
}

function djpUnlink(id) {
  var p = ST.getOne('djiProjects', id);
  if (!p || !confirm('ยกเลิกการผูก?\n\nชื่อและ Project ID ที่เขียนไปแล้วจะไม่ถูกย้อนกลับ')) return;
  var up = ST.update('djiProjects', id, { pipelineId: '', runrateId: '' });
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
  closeMForce();
  toast('ยกเลิกการผูกแล้ว');
  render();
}

// สร้างโครงการใน Pipeline จากทะเบียน — ใช้กับโครงการที่ dealer ลงทะเบียนไว้แต่เราไม่เคยรู้มาก่อน
// ตั้งสถานะเป็นตัวแรกสุดเสมอ (ยังไม่รู้ว่าไปถึงไหนแล้ว) ยอด forecast ปล่อยว่างให้ไปกรอกเอง
function _djpNewPipelineData(p) {
  var dealer = djpDealerOf(p);
  var statuses = (getConfig().pipelineStatuses || []);
  var first = (statuses.filter(function(s) { return s.category === 'active'; })[0] || statuses[0] || { id: 'initial' }).id;
  return {
    projectName: p.name, dealerId: dealer ? dealer.id : '', dealerName: dealer ? dealer.name : '',
    endUserTH: p.acct || '', status: first,
    projectId: p.pid, djiCrmRegistered: true, djiCrmDate: p.regDate || _td(),
    forecastAmount: 0, registerDate: p.regDate || _td(),
    remark: 'สร้างจากทะเบียน Project ID ของ DJI CRM' + (p.prov ? ' · ' + p.prov : ''),
    createdAt: new Date().toISOString()
  };
}

function djpCreatePipelineFrom(id) {
  var p = ST.getOne('djiProjects', id);
  if (!p) return;
  var dealer = djpDealerOf(p);
  if (!dealer) { alert('โครงการนี้ยังไม่รู้ว่าเป็นของ Dealer ไหน — ระบุ Dealer ก่อนถึงจะสร้างโครงการได้'); return; }
  var pipe = ST.add('pipeline', _djpNewPipelineData(p));
  if (!pipe) { toast('สร้างโครงการไม่สำเร็จ', true); return; }
  if (typeof syncItemToFirebase === 'function') syncItemToFirebase('pipeline', pipe);
  try {
    var lg = ST.add('pipeLog', { pipeId: pipe.id, type: 'note', date: _td(),
      content: 'สร้างจากทะเบียน Project ID ' + p.pid + ' (ลงทะเบียนโดย ' + (p.createdBy || '-') + ')', created: new Date().toISOString() });
    if (lg && typeof syncItemToFirebase === 'function') syncItemToFirebase('pipeLog', lg);
  } catch (e) {}
  var up = ST.update('djiProjects', id, { pipelineId: pipe.id, runrateId: '', kind: 'project' });
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
  closeMForce();
  toast('✅ สร้างโครงการแล้ว');
  go('pipeDetail', { pipeId: pipe.id });
}

// ---- ทำทีเดียวหลายอัน ----
function djpToggleSel(id, el) { if (el && el.checked) djpSel[id] = 1; else delete djpSel[id]; _djpUpdateBulkBar(); }
function _djpSelIds() { return Object.keys(djpSel); }
function _djpUpdateBulkBar() {
  var bar = document.getElementById('djpBulkBar');
  if (!bar) return;
  var n = _djpSelIds().length;
  bar.style.display = n ? 'flex' : 'none';
  var cnt = document.getElementById('djpBulkCount');
  if (cnt) cnt.textContent = n;
}
function djpSelectAllVisible(el) {
  document.querySelectorAll('[data-djp-row]').forEach(function(cb) {
    cb.checked = el.checked;
    if (el.checked) djpSel[cb.getAttribute('data-djp-row')] = 1; else delete djpSel[cb.getAttribute('data-djp-row')];
  });
  _djpUpdateBulkBar();
}
function djpClearSel() { djpSel = {}; render(); }

function djpBulkCreatePipelines() {
  var ids = _djpSelIds().filter(function(id) { var p = ST.getOne('djiProjects', id); return p && !p.pipelineId; });
  if (!ids.length) { toast('ที่เลือกไว้ผูกโครงการไปหมดแล้ว'); return; }
  var noDealer = ids.filter(function(id) { return !djpDealerOf(ST.getOne('djiProjects', id)); });
  if (!confirm('สร้างโครงการใน Pipeline จาก ' + ids.length + ' ทะเบียนที่เลือก?\n\n' +
      'สถานะจะเป็นขั้นแรกสุดทั้งหมด ยอด forecast เว้นว่างไว้ให้ไปกรอกเอง' +
      (noDealer.length ? '\n\n⚠️ ' + noDealer.length + ' รายการยังไม่รู้ว่าเป็นของ Dealer ไหน จะถูกข้ามไป' : ''))) return;

  var made = 0, pipes = [], logs = [], projUpd = [];
  ids.forEach(function(id) {
    var p = ST.getOne('djiProjects', id);
    if (!p || !djpDealerOf(p)) return;
    var pipe = ST.add('pipeline', _djpNewPipelineData(p));
    if (!pipe) return;
    pipes.push(pipe);
    try { logs.push(ST.add('pipeLog', { pipeId: pipe.id, type: 'note', date: _td(),
      content: 'สร้างจากทะเบียน Project ID ' + p.pid, created: new Date().toISOString() })); } catch (e) {}
    var up = ST.update('djiProjects', id, { pipelineId: pipe.id, runrateId: '', kind: 'project' });
    if (up) projUpd.push(up);
    made++;
  });
  if (typeof syncToFirebase === 'function') {
    if (pipes.length) syncToFirebase('pipeline', pipes);
    if (logs.length) syncToFirebase('pipeLog', logs.filter(Boolean));
    if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
  }
  djpSel = {};
  toast('✅ สร้าง ' + made + ' โครงการแล้ว');
  render();
}

function djpBulkSetKind(kind) {
  var ids = _djpSelIds();
  if (!ids.length) return;
  var upd = [];
  ids.forEach(function(id) { var u = ST.update('djiProjects', id, { kind: kind }); if (u) upd.push(u); });
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
  djpSel = {};
  toast('✅ ตั้งเป็น' + DJP_KINDS[kind].label + ' ' + upd.length + ' รายการ');
  render();
}

function djpBulkAssignDealer() {
  var ids = _djpSelIds();
  if (!ids.length) return;
  var dealers = ST.getAll('dealers').slice().sort(function(a, b) { return (a.name || '') > (b.name || '') ? 1 : -1; });
  var h = '<div class="hint" style="margin-bottom:10px">ระบุ Dealer ให้ ' + ids.length + ' ทะเบียนที่เลือกพร้อมกัน — ใช้กับแถวที่ช่อง Created By ไม่มีรหัส DJI ให้จับคู่</div>';
  h += '<select id="djpBulkDealer" class="inp"><option value="">— เลือก Dealer —</option>' +
    dealers.map(function(d) { return '<option value="' + d.id + '">' + sanitize(d.name) + (d.djiCode ? ' — ' + sanitize(d.djiCode) : '') + '</option>'; }).join('') + '</select>';
  h += '<button class="btn bp btn-full" style="margin-top:10px" onclick="djpCommitBulkDealer()">💾 บันทึก</button>';
  openM('🏪 ระบุ Dealer หลายรายการ', h);
}
function djpCommitBulkDealer() {
  var did = (document.getElementById('djpBulkDealer') || {}).value || '';
  if (!did) { alert('เลือก Dealer ก่อนนะครับ'); return; }
  var upd = [];
  _djpSelIds().forEach(function(id) { var u = ST.update('djiProjects', id, { dealerId: did }); if (u) upd.push(u); });
  if (typeof pushDjiDataToCloud === 'function') pushDjiDataToCloud('djiProjects');
  djpSel = {};
  closeMForce();
  toast('✅ ระบุ Dealer ให้ ' + upd.length + ' รายการแล้ว');
  render();
}

// ---------------------------------------------------------------- หน้าจอ
function _djpVisible() {
  var range = djpRange();
  var q = djpQ.trim().toLowerCase();
  return ST.getAll('djiProjects').filter(function(p) {
    if (djpTab === 'linked' && !p.pipelineId) return false;
    if (djpTab === 'unlinked' && p.pipelineId) return false;
    if (djpTab === 'nodealer' && djpDealerOf(p)) return false;
    if (djpTab === 'nokind' && djpKindOf(p)) return false;
    if (!djpInRange(p, range)) return false;
    if (!q) return true;
    return (p.pid || '').toLowerCase().indexOf(q) !== -1 ||
           (p.name || '').toLowerCase().indexOf(q) !== -1 ||
           (p.acct || '').toLowerCase().indexOf(q) !== -1 ||
           (p.prov || '').toLowerCase().indexOf(q) !== -1 ||
           (p.dealerName || '').toLowerCase().indexOf(q) !== -1;
  });
}

function _djpRowHtml(p, range) {
  var amt = djpAmounts(p, range);
  var pipe = djpPipelineOf(p);
  var dealer = djpDealerOf(p);
  var h = '<tr>';
  h += '<td style="width:26px"><input type="checkbox" data-djp-row="' + p.id + '"' + (djpSel[p.id] ? ' checked' : '') +
       ' onchange="djpToggleSel(\'' + p.id + '\',this)"></td>';
  h += '<td style="font-family:monospace;white-space:nowrap">' + qcopyHtml(p.pid) + '</td>';
  h += '<td><div>' + sanitize(String(p.name || '').substr(0, 70)) + '</div>' +
       '<div style="font-size:11px;color:var(--text2)">' + (p.acct ? '🏢 ' + sanitize(p.acct) : '') +
       (p.prov ? ' · 📍 ' + sanitize(p.prov) : '') + '</div></td>';
  if (!dealer) h += '<td><span style="color:var(--warn,#f59e0b)">⚠️ ' + sanitize(p.dealerName || '-') + '</span></td>';
  else h += '<td>' + sanitize(dealer.name) + '</td>';
  h += '<td style="font-family:monospace;white-space:nowrap">' + sanitize(p.regDate || '-') + '</td>';
  h += '<td style="text-align:right;white-space:nowrap">' + (amt.forecast ? '฿' + fmtMoney(amt.forecast) : '<span style="color:var(--text2)">—</span>') + '</td>';
  h += '<td style="text-align:right;white-space:nowrap">' + (amt.actual ? '<b style="color:#22c55e">฿' + fmtMoney(amt.actual) + '</b>' : '<span style="color:var(--text2)">—</span>') +
       (amt.soCount ? '<div style="font-size:10px;color:var(--text2)">' + amt.soCount + ' SO</div>' : '') + '</td>';
  var kind = djpKindOf(p), ki = DJP_KINDS[kind];
  h += '<td style="white-space:nowrap"><span style="color:' + ki.color + ';font-size:11px">' + ki.icon + ' ' + ki.label + '</span></td>';
  var bucket = djpRunrateOf(p);
  h += '<td style="white-space:nowrap">' + (pipe
    ? '<a href="#" onclick="go(\'pipeDetail\',{pipeId:\'' + pipe.id + '\'});return false" style="color:var(--accent)">🔗 ' + sanitize(String(pipe.projectName || '').substr(0, 22)) + '</a>'
    : bucket
      ? '<a href="#" onclick="go(\'runrate\');return false" style="color:#a78bfa">🏪 ถัง ' + sanitize(bucket.projectId || '') + '</a>'
      : '<button class="btn bsm bo" onclick="showDjpLinkM(\'' + p.id + '\')">+ ผูก</button>') + '</td>';
  return h + '</tr>';
}

function rDjiProjects(el) {
  document.getElementById('pgT').textContent = '🗂️ ทะเบียน Project ID';
  _djpBust();
  var all = ST.getAll('djiProjects');

  var h = '<div class="card" style="margin-bottom:12px">';
  h += '<div class="hint" style="margin-bottom:10px">โครงการที่ Dealer ลงทะเบียนไว้ในระบบ CRM ของ DJI — เห็นได้แม้เขาไม่ได้แจ้งเรา ' +
    'ผูกเข้ากับโครงการใน Pipeline ทีละอัน หรือกดสร้างใหม่จากทะเบียนนี้ก็ได้</div>';
  if (!all.length) {
    h += '<div class="empty"><div class="icon">🗂️</div><p>ยังไม่มีข้อมูล — นำเข้าไฟล์ Project ที่ export จาก DJI CRM</p></div>';
    h += '<button class="btn bp btn-full" onclick="importDjiProjectsXlsx()">⬆️ นำเข้าไฟล์ Excel</button></div>';
    el.innerHTML = h;
    return;
  }

  var range = djpRange();
  var inRange = all.filter(function(p) { return djpInRange(p, range); });
  var linked = inRange.filter(function(p) { return !!p.pipelineId; }).length;
  var noDealer = inRange.filter(function(p) { return !djpDealerOf(p); }).length;
  var sumF = 0, sumA = 0, sold = 0;
  inRange.forEach(function(p) { var a = djpAmounts(p, range); sumF += a.forecast; sumA += a.actual; if (a.actual) sold++; });
  // ยอด Run rate ไม่ผูกกับ Project ID (คนละเรื่องกันโดยตั้งใจ) แต่ต้องโชว์คู่กันเพื่อเทียบสัดส่วน
  var rrTotal = ST.getAll('runrate').reduce(function(t, r) { return t + (typeof _rrTotal === 'function' ? _rrTotal(r.id) : 0); }, 0);

  h += '<div class="rr-stats">' +
    '<div class="rr-stat"><div class="n">' + inRange.length + '</div><div class="l">ลงทะเบียนไว้</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:' + (inRange.length - sold ? 'var(--warn,#f59e0b)' : '#22c55e') + '">' + (inRange.length - sold) + '</div><div class="l">ยังไม่มีการขาย</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:' + (inRange.length - linked ? 'var(--warn,#f59e0b)' : '#22c55e') + '">' + (inRange.length - linked) + '</div><div class="l">ยังไม่ผูก Pipeline</div></div>' +
    '<div class="rr-stat"><div class="n" style="font-size:15px">฿' + fmtMoney(sumF) + '</div><div class="l">Project — คาดการณ์</div></div>' +
    '<div class="rr-stat"><div class="n" style="font-size:15px;color:#22c55e">฿' + fmtMoney(sumA) + '</div><div class="l">Project — ขายจริง</div></div>' +
    '<div class="rr-stat"><div class="n" style="font-size:15px;color:#a78bfa">฿' + fmtMoney(rrTotal) + '</div><div class="l">Run rate — ขายจริง</div></div>' +
    '</div>';
  var auto = djpAutoLinkPlan();
  var autoN = auto.pipe.length + auto.bucket.length;
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' +
    '<button class="btn bp bsm" onclick="importDjiProjectsXlsx()">⬆️ นำเข้าไฟล์</button>' +
    (autoN ? '<button class="btn bsm bo" style="border-color:var(--ok,#22c55e);color:var(--ok,#22c55e)" onclick="showDjpAutoLinkM()">⚡ จับคู่อัตโนมัติได้ ' + autoN + ' คู่</button>' : '') +
    '<button class="btn bsm bo" onclick="showDjpMatchBoardM(\'\')">🔀 จับคู่ทีละคู่</button>' +
    '</div>';
  if (autoN) h += '<div class="hint" style="margin-top:8px">มี ' + autoN + ' คู่ที่เลข Project ID ตรงกับโครงการ/ถังในระบบอยู่แล้ว — กดผูกให้ทีเดียวได้ ไม่ต้องไล่ทีละอัน</div>';
  h += '</div>';

  // ---- ช่วงเวลา ----
  h += '<div class="rr-toolbar" style="align-items:center">';
  DJP_PERIODS.forEach(function(pd) {
    h += '<button class="btn bsm ' + (djpPeriod === pd.id ? 'bp' : 'bo') + '" onclick="djpSetPeriod(\'' + pd.id + '\')">' + pd.label + '</button>';
  });
  if (range) {
    h += '<span style="display:inline-flex;align-items:center;gap:4px;margin-left:4px">' +
      '<button class="btn bsm bo" onclick="djpShiftPeriod(-1)">‹</button>' +
      '<b style="font-size:12px;min-width:74px;text-align:center">' + sanitize(range.label) + '</b>' +
      '<button class="btn bsm bo" onclick="djpShiftPeriod(1)">›</button></span>';
  }
  h += '</div>';
  h += '<div class="rr-toolbar">' +
    '<span style="font-size:11px;color:var(--text2);align-self:center">นับตาม</span>' +
    '<button class="btn bsm ' + (djpBasis === 'reg' ? 'bp' : 'bo') + '" onclick="djpSetBasis(\'reg\')">วันลงทะเบียน CRM</button>' +
    '<button class="btn bsm ' + (djpBasis === 'sale' ? 'bp' : 'bo') + '" onclick="djpSetBasis(\'sale\')">วันที่ขายจริง</button>' +
    '</div>';
  h += '<div class="hint" style="margin-bottom:8px">' + (djpBasis === 'reg'
    ? 'นับตามวันที่ Dealer ลงทะเบียนใน CRM — ตอบว่าช่วงนี้มีโครงการเข้ามากี่โครงการ ยอดที่โชว์เป็นยอดรวมทั้งหมดของโครงการนั้น'
    : 'นับตามวันที่ขายจริง (วันที่ Invoice) — ตอบว่าช่วงนี้เก็บเงินได้เท่าไหร่ โครงการที่ยังไม่มีการขายจะไม่ขึ้นในช่วงนี้') + '</div>';

  // ---- แท็บ + ค้นหา ----
  var counts = {
    all: all.filter(function(p) { return djpInRange(p, range); }).length,
    linked: linked,
    unlinked: inRange.length - linked,
    nodealer: noDealer,
    nokind: inRange.filter(function(p) { return !djpKindOf(p); }).length
  };
  h += '<div class="rr-toolbar">';
  [['all', 'ทั้งหมด'], ['unlinked', 'ยังไม่ผูก'], ['linked', 'ผูกแล้ว'], ['nokind', 'ยังไม่ระบุว่าใช้เป็นอะไร'], ['nodealer', 'ยังไม่รู้ Dealer']].forEach(function(t) {
    h += '<button class="btn bsm ' + (djpTab === t[0] ? 'bp' : 'bo') + '" onclick="djpSetTab(\'' + t[0] + '\')">' + t[1] + ' (' + counts[t[0]] + ')</button>';
  });
  h += '</div>';
  h += '<input type="text" class="inp" style="margin-bottom:10px" placeholder="🔍 ค้นหา Project ID / ชื่อโครงการ / End User / จังหวัด / Dealer" value="' +
    sanitize(djpQ) + '" oninput="djpQ=this.value;render()" autocomplete="off">';

  // ---- แถบทำทีเดียวหลายอัน ----
  h += '<div id="djpBulkBar" class="card" style="padding:9px 12px;margin-bottom:10px;gap:8px;flex-wrap:wrap;align-items:center;display:' +
    (_djpSelIds().length ? 'flex' : 'none') + '">' +
    '<b style="font-size:12px">เลือกไว้ <span id="djpBulkCount">' + _djpSelIds().length + '</span> รายการ</b>' +
    '<button class="btn bsm bp" onclick="djpBulkCreatePipelines()">➕ สร้างโครงการใน Pipeline</button>' +
    '<button class="btn bsm bo" onclick="djpBulkAssignDealer()">🏪 ระบุ Dealer</button>' +
    '<button class="btn bsm bo" onclick="djpBulkSetKind(\'project\')">📋 ตั้งเป็นโครงการ</button>' +
    '<button class="btn bsm bo" onclick="djpBulkSetKind(\'runrate\')">🏪 ตั้งเป็น Run rate</button>' +
    '<button class="btn bsm bo" onclick="djpClearSel()">ล้างที่เลือก</button></div>';

  var list = _djpVisible();
  if (!list.length) {
    h += '<div class="empty"><p>ไม่มีรายการในเงื่อนไขนี้</p></div>';
    el.innerHTML = h;
    return;
  }

  // ---- จัดกลุ่มตาม Dealer ----
  var groups = {};
  list.forEach(function(p) {
    var d = djpDealerOf(p);
    var key = d ? d.id : ('?' + (p.dealerName || 'ไม่ระบุ'));
    (groups[key] = groups[key] || { dealer: d, name: d ? d.name : (p.dealerName || 'ยังไม่ระบุ Dealer'), items: [] }).items.push(p);
  });
  var keys = Object.keys(groups).sort(function(a, b) { return groups[b].items.length - groups[a].items.length; });

  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11px;color:var(--text2)">' +
    '<input type="checkbox" onchange="djpSelectAllVisible(this)"> เลือกทั้งหมดที่เห็น</div>';

  keys.forEach(function(k) {
    var g = groups[k];
    var gf = 0, ga = 0, gl = 0;
    g.items.forEach(function(p) { var a = djpAmounts(p, range); gf += a.forecast; ga += a.actual; if (p.pipelineId) gl++; });
    var rr = g.dealer ? ST.runrateByDealer(g.dealer.id).reduce(function(t, r) { return t + (typeof _rrTotal === 'function' ? _rrTotal(r.id) : 0); }, 0) : 0;

    h += '<details class="card" style="margin-bottom:8px;padding:0" ' + (keys.length <= 3 ? 'open' : '') + '>';
    h += '<summary style="cursor:pointer;padding:11px 14px;list-style:none">';
    h += '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline">';
    h += '<div><span class="djp-ar">▸</span> <b>' + sanitize(g.name) + '</b>' + (g.dealer && g.dealer.djiCode ? ' <span style="font-family:monospace;font-size:11px;color:var(--text2)">' + sanitize(g.dealer.djiCode) + '</span>' : '') +
      '<div style="font-size:11px;color:var(--text2)">' + g.items.length + ' Project ID · ผูกแล้ว ' + gl + ' · ยังไม่ผูก ' + (g.items.length - gl) + '</div></div>';
    h += '<div style="text-align:right;font-size:12px">' +
      '<div><span style="color:var(--text2);font-size:10px">Project คาดการณ์</span> ฿' + fmtMoney(gf) + '</div>' +
      '<div><span style="color:var(--text2);font-size:10px">Project ขายจริง</span> <b style="color:#22c55e">฿' + fmtMoney(ga) + '</b></div>' +
      (rr ? '<div><span style="color:var(--text2);font-size:10px">Run rate</span> <b style="color:#a78bfa">฿' + fmtMoney(rr) + '</b></div>' : '') +
      '</div>';
    h += '</div></summary>';
    h += '<div style="overflow-x:auto;border-top:1px solid var(--border)"><table class="rr-tbl" style="min-width:820px"><thead><tr>' +
      '<th></th><th>Project ID</th><th>โครงการ / End User</th><th>Dealer</th><th>ลงทะเบียน</th>' +
      '<th style="text-align:right">คาดการณ์</th><th style="text-align:right">ขายจริง</th><th>ใช้เป็น</th><th>ผูกกับ</th>' +
      '</tr></thead><tbody>';
    g.items.sort(function(a, b) { return (b.pid || '').localeCompare(a.pid || ''); })
      .forEach(function(p) { h += _djpRowHtml(p, range); });
    h += '</tbody></table></div></details>';
  });

  el.innerHTML = h;
}

// ---------------------------------------------------------------- ผูกจากฝั่ง Pipeline
// ทางเดียวกันแต่เดินกลับด้าน: ยืนอยู่ที่โครงการแล้วมองหาทะเบียนที่ใช่ ให้คะแนนด้วยเกณฑ์ชุดเดียวกับ
// djpSuggestPipelines จะได้ไม่มีสองมาตรฐาน — เปิดจากหน้า Pipeline ตอนเพิ่งรู้ว่าลูกค้าลงทะเบียนไว้แล้ว
function djpSuggestForPipeline(pipe) {
  var dealer = pipe.dealerId ? ST.getOne('dealers', pipe.dealerId) : null;
  return ST.getAll('djiProjects').map(function(p) {
    var score = 0, why = [];
    if (pidNorm(pipe.projectId) && pidSame(pipe.projectId, p.pid)) { score += 10; why.push('เลข Project ID ตรงกัน'); }
    var pd = djpDealerOf(p);
    if (dealer && pd && pd.id === dealer.id) { score += 3; why.push('Dealer เดียวกัน'); }
    var su = _djpSimilar(pipe.endUserTH, p.acct);
    if (su > 0.3) why.push('End User ' + (su > 0.7 ? 'ตรงกัน' : 'คล้ายกัน'));
    score += su * 3;
    var sn = _djpSimilar(pipe.projectName, p.name);
    if (sn > 0.3) why.push('ชื่อโครงการ' + (sn > 0.7 ? 'ตรงกัน' : 'คล้ายกัน'));
    score += sn * 2;
    var extra = _djpExtraSignals(p, pipe);
    score += extra.score; extra.why.forEach(function(w) { why.push(w); });
    if (p.pipelineId && p.pipelineId !== pipe.id) score -= 4;
    return { p: p, score: score, why: why, taken: !!(p.pipelineId && p.pipelineId !== pipe.id) };
  }).filter(function(x) { return x.score > 0.4; })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, 12);
}

function showDjpLinkFromPipeM(pipeId) {
  var pipe = ST.getOne('pipeline', pipeId);
  if (!pipe) return;
  var all = ST.getAll('djiProjects');
  if (!all.length) {
    alert('ยังไม่มีทะเบียน Project ID ในระบบ — นำเข้าไฟล์ Project ที่ export จาก DJI CRM ก่อน (เมนู 🗂️ ทะเบียน Project ID)');
    return;
  }
  var linked = all.filter(function(p) { return p.pipelineId === pipeId; })[0];
  var sug = djpSuggestForPipeline(pipe);

  var h = '<div style="border:1px solid var(--border);border-radius:8px;padding:9px 11px;margin-bottom:10px">' +
    '<div style="font-size:12.5px;font-weight:600">' + sanitize(pipe.projectName || '(ไม่มีชื่อ)') + '</div>' +
    '<div style="font-size:11px;color:var(--text2);margin-top:2px">🏢 ' + sanitize(pipe.endUserTH || '-') +
    ' · 🗂️ ' + (pidNorm(pipe.projectId) ? sanitize(pipe.projectId) : 'ยังไม่มี Project ID') + '</div></div>';

  if (linked) {
    h += '<div class="hint" style="margin-bottom:10px">ผูกอยู่กับทะเบียน <b style="font-family:monospace">' + sanitize(linked.pid) + '</b> ' +
      '<a href="#" onclick="djpUnlink(\'' + linked.id + '\');return false" style="color:var(--danger,#ef4444)">ยกเลิกการผูก</a></div>';
  }

  h += '<div class="hint" style="margin-bottom:6px">เลือกทะเบียน Project ID ที่ตรงกับโครงการนี้ — เรียงตัวที่น่าจะใช่ขึ้นก่อน</div>';
  if (!sug.length) {
    h += '<div class="empty" style="padding:12px"><p>ไม่เจอทะเบียนที่ใกล้เคียง — ลองค้นในเมนู 🗂️ ทะเบียน Project ID</p></div>';
  } else {
    h += '<div style="max-height:280px;overflow:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:10px">';
    sug.forEach(function(x) {
      var d = djpDealerOf(x.p);
      var exact = x.why.indexOf('เลข Project ID ตรงกัน') !== -1;
      h += '<div style="border:1px solid ' + (exact ? 'var(--ok,#22c55e)' : 'var(--border)') + ';border-radius:8px;padding:8px 10px;cursor:pointer" onclick="djpPickPipeline(\'' + x.p.id + '\',\'' + pipeId + '\')">' +
        '<div style="font-family:monospace;font-size:12px;font-weight:600">' + (exact ? '✓ ' : '') + sanitize(x.p.pid) + '</div>' +
        '<div style="font-size:12px;margin-top:2px">' + sanitize(String(x.p.name || '').substr(0, 58)) + '</div>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:2px">' +
          (x.p.acct ? '🏢 ' + sanitize(String(x.p.acct).substr(0, 26)) + ' · ' : '') +
          (d ? '🏪 ' + sanitize(d.name) : sanitize(x.p.dealerName || '')) +
          (x.p.regDate ? ' · ' + sanitize(x.p.regDate) : '') + '</div>' +
        (x.why.length ? '<div style="font-size:10.5px;color:' + (exact ? 'var(--ok,#22c55e)' : 'var(--text2)') + ';margin-top:3px">เสนอเพราะ: ' + sanitize(x.why.join(' · ')) + '</div>' : '') +
        (x.taken ? '<div style="font-size:10.5px;color:var(--warn,#f59e0b);margin-top:2px">⚠ ผูกกับโครงการอื่นอยู่แล้ว</div>' : '') +
        '</div>';
    });
    h += '</div>';
  }
  h += '<button class="btn bo btn-full" onclick="closeMForce();go(\'djiProjects\')">เปิดเมนูทะเบียน Project ID</button>';
  h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="closeMForce()">ปิด</button>';
  openM('🗂️ ผูกกับทะเบียน Project ID', h);
}

// ป้ายเล็กๆ ข้างช่อง Project ID ในหน้าโครงการ — บอกว่าผูกทะเบียนไว้แล้วหรือยัง แล้วกดผูกได้จากตรงนั้นเลย
function djpPipeBadgeHtml(pipeId) {
  var linked = ST.getAll('djiProjects').filter(function(p) { return p.pipelineId === pipeId; })[0];
  if (linked) {
    return '<a href="#" onclick="go(\'djiProjects\');return false" style="font-size:11px;color:#22c55e;text-decoration:none" ' +
      'title="ผูกกับทะเบียน Project ID ของ DJI CRM แล้ว">🗂️ ผูกทะเบียนแล้ว</a>' +
      ' <a href="#" onclick="showDjpLinkFromPipeM(\'' + pipeId + '\');return false" style="font-size:11px;color:var(--text2)">เปลี่ยน</a>';
  }
  return '<a href="#" onclick="showDjpLinkFromPipeM(\'' + pipeId + '\');return false" style="font-size:11px;color:var(--accent)">🗂️ ผูกทะเบียน Project ID</a>';
}

// ---------------------------------------------------------------- กระดานจับคู่
// เคสที่ยากที่สุดคือ Pipeline ยังไม่มี Project ID และชื่อโครงการ/หน่วยงานสองฝั่งเขียนคนละแบบ ซึ่งวัดกับ
// ข้อความจริงแล้วไม่มีวิธีไหนชี้ขาดได้: ชื่อย่อที่ไม่มีตัวอักษรร่วมกันเลย ("สตง." กับ "สำนักงานการตรวจเงิน
// แผ่นดิน") ได้ 0 ส่วนโครงการคนละอันที่ชื่อพิมพ์เหมือนกันเป๊ะ (วิทยาลัยเทคนิคคนละจังหวัด) ได้ 0.78
// การเรียงลำดับจึงช่วยได้แค่ดันตัวที่น่าจะใช่ขึ้นมา คนต้องเป็นคนชี้ — หน้านี้ทำให้การชี้นั้นเร็ว:
// ล็อก Dealer ไว้ (สัญญาณเดียวที่เชื่อได้เสมอ) เอาเฉพาะที่ยังไม่ผูกมาเรียงคู่กัน แล้วกดทีละคู่รวดเดียว
var djpBoardDealer = '', djpBoardProj = '', djpBoardQ = '', djpBoardShowList = false;

function showDjpMatchBoardM(dealerId) {
  if (dealerId !== undefined) { djpBoardDealer = dealerId || ''; djpBoardProj = ''; djpBoardQ = ''; }
  _djpRenderBoard();
}
function djpBoardPickDealer(v) { djpBoardDealer = v; djpBoardProj = ''; djpBoardQ = ''; _djpRenderBoard(); }
function djpBoardPickProj(id)  { djpBoardProj = id; djpBoardQ = ''; _djpRenderBoard(); }
function djpBoardSearch(v)     { djpBoardQ = v; _djpRenderBoard(true); }

function _djpBoardUnlinked(dealerId) {
  return ST.getAll('djiProjects').filter(function(p) {
    if (p.pipelineId || p.runrateId) return false;
    if (djpKindOf(p) === 'runrate') return false;   // ฝั่ง run rate ผูกกับถัง ไม่ใช่โครงการ คนละกระดาน
    var d = djpDealerOf(p);
    return dealerId ? (d && d.id === dealerId) : true;
  }).sort(function(a, b) { return (b.regDate || '').localeCompare(a.regDate || ''); });
}

function _djpRenderBoard(keepFocus) {
  var dealers = ST.getAll('dealers').slice().sort(function(a, b) { return (a.name || '') > (b.name || '') ? 1 : -1; });
  var counts = {};
  _djpBoardUnlinked('').forEach(function(p) {
    var d = djpDealerOf(p);
    var k = d ? d.id : '?';
    counts[k] = (counts[k] || 0) + 1;
  });

  var list = _djpBoardUnlinked(djpBoardDealer);
  if (djpBoardProj && !list.some(function(p) { return p.id === djpBoardProj; })) djpBoardProj = '';
  if (!djpBoardProj && list.length) djpBoardProj = list[0].id;
  var cur = djpBoardProj ? ST.getOne('djiProjects', djpBoardProj) : null;

  var h = '<div class="hint" style="margin-bottom:8px">ล็อก Dealer ไว้ก่อน แล้วจับทีละคู่ — ซ้ายคือทะเบียนที่ยังไม่ผูก ขวาคือโครงการใน Pipeline เรียงตัวที่น่าจะใช่ขึ้นก่อน ถ้าไม่เจอให้พิมพ์ค้นเอง</div>';

  h += '<select class="inp" style="margin-bottom:10px" onchange="djpBoardPickDealer(this.value)">' +
    '<option value="">ทุก Dealer (' + _djpBoardUnlinked('').length + ' รายการ)</option>' +
    dealers.filter(function(d) { return counts[d.id]; }).map(function(d) {
      return '<option value="' + d.id + '"' + (djpBoardDealer === d.id ? ' selected' : '') + '>' +
        sanitize(d.name) + ' — ' + counts[d.id] + ' รายการ</option>';
    }).join('') + '</select>';

  if (!list.length) {
    h += '<div class="empty"><div class="icon">✅</div><p>ผูกครบแล้วสำหรับตัวกรองนี้</p></div>' +
         '<button class="btn bo btn-full" onclick="closeMForce()">ปิด</button>';
    openM('🔀 จับคู่ทะเบียนเข้า Pipeline', h);
    return;
  }

  // เดิมโชว์รายการที่เลือกไว้สองที่ (ในลิสต์ซ้าย + การ์ดรายละเอียด) ซึ่งพอ modal แคบจนคอลัมน์ตกลงมาซ้อนกัน
  // มันกลายเป็นของซ้ำติดกันอ่านสับสน — เปลี่ยนเป็นเลื่อนทีละอันแทน ได้ผลเหมือนกันแต่ไม่ซ้ำ และใช้บนมือถือได้
  var idx = list.findIndex(function(x) { return x.id === djpBoardProj; });
  if (idx < 0) idx = 0;
  h += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">' +
    '<button class="btn bsm bo" onclick="djpBoardStep(-1)">‹</button>' +
    '<b style="flex:1;text-align:center;font-size:12px">' + (idx + 1) + ' / ' + list.length + ' ที่ยังไม่ผูก</b>' +
    '<button class="btn bsm bo" onclick="djpBoardStep(1)">›</button>' +
    '<button class="btn bsm bo" onclick="djpBoardToggleList()">' + (djpBoardShowList ? 'ซ่อนรายการ' : 'ดูรายการ') + '</button></div>';

  if (djpBoardShowList) {
    h += '<div style="max-height:160px;overflow:auto;display:flex;flex-direction:column;gap:4px;margin-bottom:10px">';
    list.slice(0, 80).forEach(function(p) {
      var on = p.id === djpBoardProj;
      h += '<div onclick="djpBoardPickProj(\'' + p.id + '\')" style="cursor:pointer;border:1px solid ' +
        (on ? 'var(--accent)' : 'var(--border)') + ';background:' + (on ? 'var(--accent-light,rgba(59,130,246,.1))' : 'transparent') +
        ';border-radius:7px;padding:6px 8px">' +
        '<div style="font-family:monospace;font-size:11.5px;font-weight:600">' + sanitize(p.pid) + '</div>' +
        '<div style="font-size:11px;color:var(--text2)">' + sanitize(String(p.name || '').substr(0, 44)) + '</div></div>';
    });
    if (list.length > 80) h += '<div style="font-size:11px;color:var(--text2);padding:4px">…อีก ' + (list.length - 80) + ' — เลือก Dealer เพื่อให้สั้นลง</div>';
    h += '</div>';
  }

  if (cur) {
    var cd = djpDealerOf(cur);
    h += '<div style="border:1px solid var(--accent);border-radius:8px;padding:9px 11px;margin-bottom:8px">' +
      '<div style="font-family:monospace;font-size:12.5px;font-weight:700">' + sanitize(cur.pid) + '</div>' +
      '<div style="font-size:12px;margin-top:2px">' + sanitize(cur.name) + '</div>' +
      '<div style="font-size:11px;color:var(--text2);margin-top:3px">🏢 ' + sanitize(cur.acct || '-') +
      (cur.prov ? ' · 📍 ' + sanitize(cur.prov) : '') + (cur.regDate ? ' · 🗓️ ' + sanitize(cur.regDate) : '') +
      (cd ? ' · 🏪 ' + sanitize(cd.name) : '') + '</div></div>';

    h += '<input type="text" id="djpBoardQ" class="inp" style="margin-bottom:6px" placeholder="🔍 ค้นหาโครงการใน Pipeline ด้วยคำอะไรก็ได้" value="' +
      sanitize(djpBoardQ) + '" oninput="djpBoardSearch(this.value)" autocomplete="off">';

    var cands;
    if (djpBoardQ.trim()) {
      // พิมพ์ค้นเองแล้วต้องหาได้ทุกโครงการ ไม่ใช่แค่ในลิสต์ที่ระบบเสนอ — ไม่งั้นตัวที่ระบบมองไม่เห็นจะเข้าไม่ถึงเลย
      var q = djpBoardQ.trim().toLowerCase();
      cands = ST.getAll('pipeline').filter(function(pipe) {
        return (pipe.projectName || '').toLowerCase().indexOf(q) !== -1 ||
               (pipe.endUserTH || '').toLowerCase().indexOf(q) !== -1 ||
               (pipe.endUserEN || '').toLowerCase().indexOf(q) !== -1 ||
               (pipe.projectId || '').toLowerCase().indexOf(q) !== -1;
      }).slice(0, 20).map(function(pipe) { return { pipe: pipe, why: [], taken: false }; });
    } else {
      cands = djpSuggestPipelines(cur);
    }

    h += '<div style="font-size:11px;color:var(--text2);margin-bottom:4px">' +
      (djpBoardQ.trim() ? 'ผลการค้นหา' : 'โครงการที่น่าจะใช่') + ' (' + cands.length + ')</div>';
    h += '<div style="max-height:250px;overflow:auto;display:flex;flex-direction:column;gap:5px">';
    if (!cands.length) {
      h += '<div class="empty" style="padding:10px"><p>' + (djpBoardQ.trim() ? 'ไม่เจอที่ตรงกับคำค้น' : 'ระบบไม่เจอตัวที่ใกล้เคียง — ลองพิมพ์ค้นเอง') + '</p></div>';
    }
    cands.forEach(function(x) {
      var d = ST.getOne('dealers', x.pipe.dealerId);
      var exact = x.why.indexOf('เลข Project ID ตรงกัน') !== -1;
      h += '<div onclick="closeMForce();djpPickPipeline(\'' + cur.id + '\',\'' + x.pipe.id + '\')" style="cursor:pointer;border:1px solid ' +
        (exact ? 'var(--ok,#22c55e)' : 'var(--border)') + ';border-radius:7px;padding:7px 9px">' +
        '<div style="font-size:12px;font-weight:600">' + (exact ? '✓ ' : '') + sanitize(String(x.pipe.projectName || '(ไม่มีชื่อ)').substr(0, 52)) + '</div>' +
        '<div style="font-size:10.5px;color:var(--text2);margin-top:2px">' +
          (x.pipe.endUserTH ? '🏢 ' + sanitize(String(x.pipe.endUserTH).substr(0, 24)) + ' · ' : '') +
          (d ? '🏪 ' + sanitize(d.name) + ' · ' : '') +
          (pidNorm(x.pipe.projectId) ? '🗂️ ' + sanitize(x.pipe.projectId) : 'ยังไม่มี Project ID') + '</div>' +
        (x.why.length ? '<div style="font-size:10px;color:' + (exact ? 'var(--ok,#22c55e)' : 'var(--text2)') + ';margin-top:2px">' + sanitize(x.why.join(' · ')) + '</div>' : '') +
        '</div>';
    });
    h += '</div>';
    h += '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">' +
      '<button class="btn bsm bo" onclick="closeMForce();djpCreatePipelineFrom(\'' + cur.id + '\')">➕ ไม่มีในระบบ — สร้างใหม่</button>' +
      '<button class="btn bsm bo" onclick="djpBoardStep(1)">ข้ามไปอันถัดไป ›</button></div>';
  }
  h += '</div></div>';
  h += '<button class="btn bo btn-full" style="margin-top:10px" onclick="closeMForce();render()">ปิด</button>';

  openM('🔀 จับคู่ทะเบียนเข้า Pipeline', h);
  if (keepFocus) {
    var el = document.getElementById('djpBoardQ');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }
}

// เดินหน้า/ถอยหลังทีละรายการ วนรอบได้ทั้งสองทาง — ของที่ยังไม่ผูกมีเป็นร้อย การไล่ทีละอันคือการใช้งานจริง
function djpBoardStep(dir) {
  var list = _djpBoardUnlinked(djpBoardDealer);
  if (!list.length) { djpBoardProj = ''; _djpRenderBoard(); return; }
  var i = list.findIndex(function(p) { return p.id === djpBoardProj; });
  if (i < 0) i = 0;
  djpBoardProj = list[(i + dir + list.length) % list.length].id;
  djpBoardQ = '';
  _djpRenderBoard();
}
function djpBoardToggleList() { djpBoardShowList = !djpBoardShowList; _djpRenderBoard(); }
// ชื่อเดิม เผื่อมีที่อื่นเรียกอยู่
function djpBoardSkip() { djpBoardStep(1); }

// เลือก Dealer ให้บริษัทหนึ่งแล้ว ถ้าบริษัทอื่นในรายการยังว่างและชื่อใกล้เคียงกันมาก ก็ไม่เดาให้ — แค่ทำให้
// เห็นว่าเลือกไปแล้วกี่บริษัท เพื่อให้รู้ว่าเหลืออีกเท่าไหร่โดยไม่ต้องเลื่อนดูทั้งรายการ
function _djpGroupPicked() {
  var sels = document.querySelectorAll('[data-djp-group]');
  var done = 0;
  sels.forEach(function(s) { if (s.value) done++; });
  var note = document.getElementById('djpGroupProgress');
  if (note) note.textContent = done + ' / ' + sels.length + ' บริษัท เลือกแล้ว';
}
