// ================================================================
// KANBAN BOARD
// ================================================================
const KB_COLS = [
  {id:'todo', name:'📥 รอทำ', color:'#64748b'},
  {id:'doing', name:'🔄 กำลังทำ', color:'#3b82f6'},
  {id:'review', name:'👀 รอตรวจ', color:'#f59e0b'},
  {id:'done', name:'✅ เสร็จ', color:'#22c55e'}
];

let dragData = null;

function rKanban(el) {
  document.getElementById('pgT').textContent = '📋 Kanban Board';
  const cards = collectKBCards();

  el.innerHTML = `
  <div style="margin-bottom:8px;display:flex;gap:5px;flex-wrap:wrap">
    <button class="btn bo" onclick="go('tasks')">📋 รายการ</button>
  </div>
  <div class="kanban" id="kbBoard">${KB_COLS.map(col => {
    const cc = cards.filter(c => c.kb === col.id);
    return `<div class="kb-col" data-col="${col.id}"
      ondragover="kbDragOver(event)" ondragleave="kbDragLeave(event)" ondrop="kbDrop(event,'${col.id}')">
      <div class="kb-hd"><h3>${col.name} <span class="kb-cnt">${cc.length}</span></h3></div>
      <div class="kb-body">${cc.map(c => kbCardHTML(c)).join('')}</div>
      <div style="padding:5px">
        <div class="kb-add-btn" onclick="kbShowQA('${col.id}')">＋ เพิ่มงาน</div>
        <div id="kb-qa-${col.id}" style="display:none">
          <input type="text" id="kb-qi-${col.id}" placeholder="ชื่องาน..." onkeypress="if(event.key==='Enter')kbQuickAdd('${col.id}')">
          <div style="display:flex;gap:3px;margin-top:3px">
            <button class="btn bsm bp" onclick="kbQuickAdd('${col.id}')">เพิ่ม</button>
            <button class="btn bsm bo" onclick="kbHideQA('${col.id}')">ยกเลิก</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
  
  // Init touch DnD after render
  setTimeout(initTouchDnD, 100);
}

function collectKBCards() {
  let cards = [];
  ST.filter('tasks', t => t.status === 'active').forEach(t => {
    if (t.steps?.length) {
      t.steps.forEach((s, i) => {
        cards.push({...s, idx:i, tid:t.id, tn:t.title, type:'step',
          kb: s.kanban || (s.done ? 'done' : 'todo'),
          _uid: `s_${t.id}_${i}`});
      });
    } else {
      var dn = '';
if (t.dealerId) { var dd = ST.getOne('dealers', t.dealerId); if (dd) dn = dd.name; }
cards.push({id:t.id, title:t.title, dueDate:t.dueDate, type:'task',
  kb: t.kanban || 'todo', priority:t.priority, tn:t.title, tid:t.id,
  dealerName: dn,
  _uid: 't_' + t.id});
    }
  });
  return cards;
}

function kbCardHTML(c) {
  const oc = `go('taskDetail',{taskId:'${c.tid}'})`;
  const moves = KB_COLS.filter(x => x.id !== c.kb).map(x =>
    `<span class="kb-act" onclick="event.stopPropagation();kbMove('${c.type}','${c.tid}',${c.idx||0},'${x.id}')">${x.name.split(' ')[0]}</span>`
  ).join('');

  return `<div class="kb-card ${dlC(c.dueDate, c.kb==='done')}"
    draggable="true" data-uid="${c._uid}" data-type="${c.type}" data-tid="${c.tid}" data-idx="${c.idx||0}"
    ondragstart="kbDragStart(event)" ondragend="kbDragEnd(event)" onclick="${oc}">
    <div class="kb-title">${sanitize(c.title)} ${c.priority?pTag(c.priority):''}</div>
    <div class="kb-sub">${c.dealerName?'🏪 '+c.dealerName+' • ':''}${c.type==='step'?sanitize(c.tn)+' • ':''}${c.dueDate?fDShort(c.dueDate)+' ':''} ${dlB(c.dueDate, c.kb==='done')}</div>
    <div class="kb-acts">${moves}
      <span class="kb-act" onclick="event.stopPropagation();kbQuickLog('${c.tid}')">📝</span>
      <span class="kb-act" onclick="event.stopPropagation();startTimer('task','${c._uid}','${sanitize(c.title).substr(0,15)}')">⏱️</span>
    </div></div>`;
}

// ================================================================
// MOUSE DRAG & DROP
// ================================================================
function kbDragStart(e) {
  const card = e.target.closest('.kb-card');
  if (!card) return;
  dragData = {uid:card.dataset.uid, type:card.dataset.type, tid:card.dataset.tid, idx:parseInt(card.dataset.idx)||0};
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', card.dataset.uid);
}

function kbDragEnd(e) {
  const card = e.target.closest('.kb-card');
  if (card) card.classList.remove('dragging');
  document.querySelectorAll('.kb-col').forEach(c => c.classList.remove('drag-over'));
  dragData = null;
}

function kbDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = e.target.closest('.kb-col');
  if (col) col.classList.add('drag-over');
}

function kbDragLeave(e) {
  const col = e.target.closest('.kb-col');
  if (col && !col.contains(e.relatedTarget)) col.classList.remove('drag-over');
}

function kbDrop(e, colId) {
  e.preventDefault();
  document.querySelectorAll('.kb-col').forEach(c => c.classList.remove('drag-over'));
  if (!dragData) return;
  kbMove(dragData.type, dragData.tid, dragData.idx, colId);
  dragData = null;
}

// ================================================================
// TOUCH DRAG & DROP (Mobile)
// ================================================================
let touchEl = null, touchGhost = null;

function initTouchDnD() {
  document.querySelectorAll('.kb-card').forEach(card => {
    card.addEventListener('touchstart', kbTouchStart, {passive: false});
  });
}

function kbTouchStart(e) {
  if (e.target.closest('.kb-act') || e.target.closest('.kb-add-btn')) return;
  const card = e.target.closest('.kb-card');
  if (!card) return;
  touchEl = card;
  
  card._touchTimer = setTimeout(() => {
    card.classList.add('dragging');
    dragData = {uid:card.dataset.uid, type:card.dataset.type, tid:card.dataset.tid, idx:parseInt(card.dataset.idx)||0};
    
    touchGhost = document.createElement('div');
    touchGhost.className = 'kb-card';
    touchGhost.style.cssText = `position:fixed;z-index:1000;pointer-events:none;opacity:.7;width:${card.offsetWidth}px;background:#1e293b;border:2px dashed #3b82f6;border-radius:7px;padding:6px`;
    touchGhost.innerHTML = `<div class="kb-title">${card.querySelector('.kb-title')?.textContent||''}</div>`;
    document.body.appendChild(touchGhost);
    
    document.addEventListener('touchmove', kbTouchMove, {passive: false});
    document.addEventListener('touchend', kbTouchEnd);
  }, 400);
}

function kbTouchMove(e) {
  if (!touchGhost || !dragData) return;
  e.preventDefault();
  const t = e.touches[0];
  touchGhost.style.left = (t.clientX - 50) + 'px';
  touchGhost.style.top = (t.clientY - 15) + 'px';
  
  document.querySelectorAll('.kb-col').forEach(col => {
    const r = col.getBoundingClientRect();
    col.classList.toggle('drag-over',
      t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom);
  });
}

function kbTouchEnd(e) {
  if (touchEl?._touchTimer) clearTimeout(touchEl._touchTimer);
  
  if (touchGhost && dragData) {
    const t = e.changedTouches[0];
    let targetCol = null;
    document.querySelectorAll('.kb-col').forEach(col => {
      const r = col.getBoundingClientRect();
      if (t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom) {
        targetCol = col.dataset.col;
      }
    });
    if (targetCol) kbMove(dragData.type, dragData.tid, dragData.idx, targetCol);
    touchGhost.remove();
    touchGhost = null;
  }
  
  if (touchEl) { touchEl.classList.remove('dragging'); touchEl = null; }
  document.querySelectorAll('.kb-col').forEach(c => c.classList.remove('drag-over'));
  dragData = null;
  document.removeEventListener('touchmove', kbTouchMove);
  document.removeEventListener('touchend', kbTouchEnd);
}

// ================================================================
// KANBAN ACTIONS
// ================================================================
function kbMove(type, tid, idx, newCol) {
  const t = ST.getOne('tasks', tid);
  if (!t) return;
  
  if (type === 'step') {
    if (!t.steps?.[idx]) return;
    t.steps[idx].kanban = newCol;
    t.steps[idx].done = (newCol === 'done');
    ST.update('tasks', tid, {steps: t.steps});
    if (newCol === 'done') {
      ST.add('taskLogs', {tid, type:'progress', content:`✅ เสร็จ: ${t.steps[idx].title}`, date: _nw()});
    }
  } else {
    ST.update('tasks', tid, {kanban: newCol, status: newCol === 'done' ? 'completed' : 'active'});
  }
  toast(`📋 ย้ายไป ${KB_COLS.find(c => c.id === newCol)?.name || newCol}`);
  render();
}

function kbShowQA(col) {
  const el = document.getElementById('kb-qa-' + col);
  if (el) { el.style.display = 'block'; document.getElementById('kb-qi-' + col)?.focus(); }
}

function kbHideQA(col) {
  const el = document.getElementById('kb-qa-' + col);
  if (el) { el.style.display = 'none'; }
  const inp = document.getElementById('kb-qi-' + col);
  if (inp) inp.value = '';
}

function kbQuickAdd(col) {
  const inp = document.getElementById('kb-qi-' + col);
  const title = inp?.value.trim();
  if (!title) return;
  ST.add('tasks', {title, startDate:_td(), dueDate:'', priority:'medium', category:'Kanban', status:col==='done'?'completed':'active', kanban:col, steps:[]});
  toast('📋 เพิ่ม: ' + title);
  kbHideQA(col);
  render();
}

function kbQuickLog(tid) {
  openM('📝 Quick Log', `
    <div class="fg"><label>ประเภท</label><select id="ql_t">
      <option value="progress">🟢 คืบหน้า</option><option value="problem">🔴 ปัญหา</option>
      <option value="solution">🟡 แก้ไข</option><option value="note">⚪ หมายเหตุ</option>
    </select></div>
    <div class="fg"><label>รายละเอียด *</label><textarea id="ql_c" rows="3"></textarea></div>
    <button class="btn bp btn-full" onclick="saveKBLog('${tid}')">💾 บันทึก</button>`);
}

function saveKBLog(tid) {
  const content = document.getElementById('ql_c')?.value.trim();
  if (!content) return alert('ใส่รายละเอียด');
  ST.add('taskLogs', {tid, type: document.getElementById('ql_t').value, content, date: _nw()});
  closeM();
  toast('📝 บันทึกแล้ว');
  render();
}