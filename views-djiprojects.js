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

// ---- ยอดเงิน: คาดการณ์ กับ ขายจริง คนละแหล่งกัน จึงคืนคู่กันเสมอ ไม่ยุบเป็นตัวเดียว ----
// คาดการณ์ = forecast ของโครงการใน Pipeline ที่ผูกไว้ (ยังไม่ผูก = ยังไม่มีตัวเลข)
// ขายจริง   = ผลรวม SO ที่ถือ Project ID นี้ หรือผูกกับ pipeline เดียวกัน
function _djpSOTotal(s) {
  return (s.items || []).reduce(function(t, it) { return t + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }, 0);
}
function _djpSODate(s) { return (s.invoiceDate || (s.createdAt || '').slice(0, 10) || ''); }
function djpSOsOf(p) {
  return ST.getAll('salesOrders').filter(function(s) {
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
  var needDealer = [];
  var matched = 0;
  fresh.forEach(function(r) {
    if (r.dealerCode && byCode[r.dealerCode.toUpperCase()]) matched++;
    else needDealer.push(r);
  });
  window._djpPending = { fresh: fresh, upd: upd };

  var h = '<div class="hint" style="margin-bottom:10px">📄 ' + sanitize(filename) + '</div>';
  h += '<div class="rr-stats" style="margin-bottom:12px">' +
    '<div class="rr-stat"><div class="n" style="color:#22c55e">' + fresh.length + '</div><div class="l">โครงการใหม่</div></div>' +
    '<div class="rr-stat"><div class="n">' + upd.length + '</div><div class="l">มีแล้ว อัปเดตให้</div></div>' +
    '<div class="rr-stat"><div class="n" style="color:' + (needDealer.length ? 'var(--warn,#f59e0b)' : 'var(--text2)') + '">' + needDealer.length + '</div><div class="l">ต้องเลือก Dealer เอง</div></div>' +
    '</div>';
  if (matched) h += '<div class="hint" style="margin-bottom:10px">✓ จับคู่ Dealer จากรหัสในช่อง Created By ได้เอง ' + matched + ' โครงการ</div>';

  if (needDealer.length) {
    var dOpts = '<option value="">— ยังไม่ระบุ เก็บไว้ก่อน —</option>' +
      dealers.slice().sort(function(a, b) { return (a.name || '') > (b.name || '') ? 1 : -1; })
        .map(function(d) { return '<option value="' + d.id + '">' + sanitize(d.name) + (d.djiCode ? ' — ' + sanitize(d.djiCode) : '') + '</option>'; }).join('');
    h += '<div class="hint" style="color:var(--warn,#f59e0b);margin-bottom:8px">⚠️ ช่อง Created By ของแถวเหล่านี้ไม่มีรหัส DJI ต่อท้าย (ปกติคือคนของเราลงทะเบียนเอง ไม่ใช่ Dealer) เลือก Dealer ให้เลย หรือเว้นไว้แล้วมาผูกทีหลังก็ได้</div>';
    h += '<div style="max-height:200px;overflow:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:12px">';
    needDealer.forEach(function(r, i) {
      h += '<div style="border:1px solid var(--border);border-radius:8px;padding:7px 9px">' +
        '<div style="font-size:11px;color:var(--text2)"><span style="font-family:monospace">' + sanitize(r.pid) + '</span> · ' + sanitize(r.createdBy) + '</div>' +
        '<div style="font-size:11px;margin:2px 0 4px">' + sanitize(String(r.name).substr(0, 60)) + '</div>' +
        '<select class="inp" data-djp-assign="' + sanitize(r.pid) + '" style="font-size:12px">' + dOpts + '</select></div>';
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
  // เก็บ Dealer ที่เลือกให้แถวที่จับเองไม่ได้ ก่อนปิด modal
  var assign = {};
  document.querySelectorAll('[data-djp-assign]').forEach(function(sel) {
    if (sel.value) assign[sel.getAttribute('data-djp-assign')] = sel.value;
  });

  var now = new Date().toISOString();
  var added = ST.addMany('djiProjects', pend.fresh.map(function(r) {
    return Object.assign({ importedAt: now, pipelineId: '', dealerId: assign[r.pid] || '' }, r);
  }));

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
  var all = added.concat(touched);
  if (all.length && typeof syncToFirebase === 'function') syncToFirebase('djiProjects', all);
  closeMForce();
  toast('✅ นำเข้า ' + added.length + ' โครงการ · อัปเดต ' + touched.length);
  go('djiProjects');
}

// ---------------------------------------------------------------- จับคู่กับ Pipeline
// ให้คะแนนความน่าจะเป็นแทนการเดาให้เลย — Dealer ตรงกันสำคัญที่สุด รองมาคือ End User แล้วค่อยชื่อโครงการ
// (ชื่อในไฟล์ซ้ำกันเยอะจนเชื่อชื่ออย่างเดียวไม่ได้) เรียงตัวที่น่าจะใช่ขึ้นก่อน แล้วให้คนตัดสิน
function _djpTokens(s) {
  return _djpNorm(s).toLowerCase().replace(/[()\[\].,\-–—/]/g, ' ').split(/\s+/).filter(function(w) { return w.length > 2; });
}
function _djpSimilar(a, b) {
  var ta = _djpTokens(a), tb = _djpTokens(b);
  if (!ta.length || !tb.length) return 0;
  var setB = {};
  tb.forEach(function(w) { setB[w] = 1; });
  var hit = ta.filter(function(w) { return setB[w]; }).length;
  return hit / Math.max(ta.length, tb.length);
}
function djpSuggestPipelines(p) {
  var dealer = djpDealerOf(p);
  var used = {};
  ST.getAll('djiProjects').forEach(function(x) { if (x.pipelineId && x.id !== p.id) used[x.pipelineId] = 1; });
  return ST.getAll('pipeline').map(function(pipe) {
    var score = 0;
    if (dealer && pipe.dealerId === dealer.id) score += 3;
    if (pidSame(pipe.projectId, p.pid)) score += 10;   // เลขตรงกันแล้ว = ตัวเดียวกันแน่นอน
    score += _djpSimilar(pipe.endUserTH, p.acct) * 3;
    score += _djpSimilar(pipe.projectName, p.name) * 2;
    if (used[pipe.id]) score -= 4;                      // ถูกผูกกับ Project ID อื่นไปแล้ว
    return { pipe: pipe, score: score, taken: !!used[pipe.id] };
  }).filter(function(x) { return x.score > 0.4; })
    .sort(function(a, b) { return b.score - a.score; })
    .slice(0, 12);
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

  h += '<div class="hint" style="margin-bottom:6px">เลือกโครงการใน Pipeline ที่ตรงกัน — เรียงตัวที่น่าจะใช่ขึ้นก่อน โดยดู Dealer, End User และชื่อประกอบกัน</div>';
  if (!sug.length) {
    h += '<div class="empty" style="padding:12px"><p>ไม่เจอโครงการที่ใกล้เคียงเลย — สร้างใหม่จากทะเบียนนี้ได้</p></div>';
  } else {
    h += '<div style="max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:10px">';
    sug.forEach(function(x) {
      var d = ST.getOne('dealers', x.pipe.dealerId);
      h += '<div style="border:1px solid var(--border);border-radius:8px;padding:8px 10px;cursor:pointer" onclick="djpPickPipeline(\'' + p.id + '\',\'' + x.pipe.id + '\')">' +
        '<div style="font-size:12.5px;font-weight:600">' + sanitize(String(x.pipe.projectName || '(ไม่มีชื่อ)').substr(0, 60)) + '</div>' +
        '<div style="font-size:11px;color:var(--text2);margin-top:2px">' +
          (d ? '🏪 ' + sanitize(d.name) + ' · ' : '') +
          (x.pipe.endUserTH ? '🏢 ' + sanitize(String(x.pipe.endUserTH).substr(0, 28)) + ' · ' : '') +
          (pidNorm(x.pipe.projectId) ? '🗂️ ' + sanitize(x.pipe.projectId) : 'ยังไม่มี Project ID') +
          (x.taken ? ' · <span style="color:var(--warn,#f59e0b)">ผูกกับเลขอื่นอยู่</span>' : '') +
        '</div></div>';
    });
    h += '</div>';
  }
  h += '<button class="btn bo btn-full" onclick="djpCreatePipelineFrom(\'' + p.id + '\')">➕ ไม่มีในระบบ — สร้างโครงการใหม่จากทะเบียนนี้</button>';
  h += '<button class="btn bo btn-full" style="margin-top:6px" onclick="closeMForce()">ปิด</button>';
  openM('🔗 ผูกกับโครงการใน Pipeline', h);
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

  var projUpd = { pipelineId: pipeId };
  if (name) projUpd.name = name;
  var savedProj = ST.update('djiProjects', projId, projUpd);
  if (savedProj && typeof syncItemToFirebase === 'function') syncItemToFirebase('djiProjects', savedProj);

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
  if (!p || !confirm('ยกเลิกการผูกกับโครงการใน Pipeline?\n\nชื่อและ Project ID ที่เขียนไปแล้วจะไม่ถูกย้อนกลับ')) return;
  var up = ST.update('djiProjects', id, { pipelineId: '' });
  if (up && typeof syncItemToFirebase === 'function') syncItemToFirebase('djiProjects', up);
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
  var up = ST.update('djiProjects', id, { pipelineId: pipe.id });
  if (up && typeof syncItemToFirebase === 'function') syncItemToFirebase('djiProjects', up);
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
  bar.style.display = n ? '' : 'none';
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
    var up = ST.update('djiProjects', id, { pipelineId: pipe.id });
    if (up) projUpd.push(up);
    made++;
  });
  if (typeof syncToFirebase === 'function') {
    if (pipes.length) syncToFirebase('pipeline', pipes);
    if (logs.length) syncToFirebase('pipeLog', logs.filter(Boolean));
    if (projUpd.length) syncToFirebase('djiProjects', projUpd);
  }
  djpSel = {};
  toast('✅ สร้าง ' + made + ' โครงการแล้ว');
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
  if (upd.length && typeof syncToFirebase === 'function') syncToFirebase('djiProjects', upd);
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
  h += '<td style="white-space:nowrap">' + (pipe
    ? '<a href="#" onclick="go(\'pipeDetail\',{pipeId:\'' + pipe.id + '\'});return false" style="color:var(--accent)">🔗 ' + sanitize(String(pipe.projectName || '').substr(0, 22)) + '</a>'
    : '<button class="btn bsm bo" onclick="showDjpLinkM(\'' + p.id + '\')">+ ผูกโครงการ</button>') + '</td>';
  return h + '</tr>';
}

function rDjiProjects(el) {
  document.getElementById('pgT').textContent = '🗂️ ทะเบียน Project ID';
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
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' +
    '<button class="btn bp bsm" onclick="importDjiProjectsXlsx()">⬆️ นำเข้าไฟล์</button></div></div>';

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
    nodealer: noDealer
  };
  h += '<div class="rr-toolbar">';
  [['all', 'ทั้งหมด'], ['unlinked', 'ยังไม่ผูก Pipeline'], ['linked', 'ผูกแล้ว'], ['nodealer', 'ยังไม่รู้ Dealer']].forEach(function(t) {
    h += '<button class="btn bsm ' + (djpTab === t[0] ? 'bp' : 'bo') + '" onclick="djpSetTab(\'' + t[0] + '\')">' + t[1] + ' (' + counts[t[0]] + ')</button>';
  });
  h += '</div>';
  h += '<input type="text" class="inp" style="margin-bottom:10px" placeholder="🔍 ค้นหา Project ID / ชื่อโครงการ / End User / จังหวัด / Dealer" value="' +
    sanitize(djpQ) + '" oninput="djpQ=this.value;render()" autocomplete="off">';

  // ---- แถบทำทีเดียวหลายอัน ----
  h += '<div id="djpBulkBar" class="card" style="display:' + (_djpSelIds().length ? '' : 'none') + ';padding:9px 12px;margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
    '<b style="font-size:12px">เลือกไว้ <span id="djpBulkCount">' + _djpSelIds().length + '</span> รายการ</b>' +
    '<button class="btn bsm bp" onclick="djpBulkCreatePipelines()">➕ สร้างโครงการใน Pipeline</button>' +
    '<button class="btn bsm bo" onclick="djpBulkAssignDealer()">🏪 ระบุ Dealer</button>' +
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
    h += '<div><b>' + sanitize(g.name) + '</b>' + (g.dealer && g.dealer.djiCode ? ' <span style="font-family:monospace;font-size:11px;color:var(--text2)">' + sanitize(g.dealer.djiCode) + '</span>' : '') +
      '<div style="font-size:11px;color:var(--text2)">' + g.items.length + ' Project ID · ผูกแล้ว ' + gl + ' · ยังไม่ผูก ' + (g.items.length - gl) + '</div></div>';
    h += '<div style="text-align:right;font-size:12px">' +
      '<div><span style="color:var(--text2);font-size:10px">Project คาดการณ์</span> ฿' + fmtMoney(gf) + '</div>' +
      '<div><span style="color:var(--text2);font-size:10px">Project ขายจริง</span> <b style="color:#22c55e">฿' + fmtMoney(ga) + '</b></div>' +
      (rr ? '<div><span style="color:var(--text2);font-size:10px">Run rate</span> <b style="color:#a78bfa">฿' + fmtMoney(rr) + '</b></div>' : '') +
      '</div>';
    h += '</div></summary>';
    h += '<div style="overflow-x:auto;border-top:1px solid var(--border)"><table class="rr-tbl" style="min-width:820px"><thead><tr>' +
      '<th></th><th>Project ID</th><th>โครงการ / End User</th><th>Dealer</th><th>ลงทะเบียน</th>' +
      '<th style="text-align:right">คาดการณ์</th><th style="text-align:right">ขายจริง</th><th>Pipeline</th>' +
      '</tr></thead><tbody>';
    g.items.sort(function(a, b) { return (b.pid || '').localeCompare(a.pid || ''); })
      .forEach(function(p) { h += _djpRowHtml(p, range); });
    h += '</tbody></table></div></details>';
  });

  el.innerHTML = h;
}
