// ================================================================
// STORAGE LAYER
// ================================================================
// เปลี่ยนไฟล์นี้ไฟล์เดียว = ย้ายไป Firebase/Google Drive ได้
// Code ส่วนอื่นไม่ต้องเปลี่ยนเลย
// ================================================================

const ST = {
  // ================================================================
  // KEYS
  // ================================================================
  _keys: {
    dealers: 'v7_dealers',
    pipeline: 'v7_pipeline',
    pipeLog: 'v7_pipelog',
    visits: 'v7_visits',
    followups: 'v7_followups',
    lineLog: 'v7_linelog',
    feedback: 'v7_feedback',
    meetings: 'v7_meetings',
    tasks: 'v7_tasks',
    taskLogs: 'v7_tasklogs',
    templates: 'v7_tpl',
    qnotes: 'v7_qn',
    routines: 'v7_rt',
    rtChecks: 'v7_rc',
    monthlyChecks: 'v7_mc',
    waiting: 'v7_wait',
    pins: 'v7_pins',
    emails: 'v7_emails',
    timerState: 'v7_timer',
    timerLogs: 'v7_tlog',
    goals: 'v7_goals',
    notes: 'v7_notes',
    pipeActions: 'v7_pipeActions',
    visitPlans: 'v7_visitPlans',
    demo: 'v7_demo',
    quotes: 'v7_quotes',
    actions: 'v7_actions',
    config: 'v7_config',
    backupDate: 'v7_backup'
  },

  // ================================================================
  // RAW GET/SET
  // ================================================================
  _get(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  },

  _set(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch (e) {
      console.error('Storage error:', e);
      toast('⚠️ เนื้อที่เก็บข้อมูลเต็ม!', true);
    }
  },

  // ================================================================
  // COLLECTION OPERATIONS
  // ================================================================
  getAll(collection) {
    return this._get(this._keys[collection]) || [];
  },

  getOne(collection, id) {
    return this.getAll(collection).find(x => x.id === id) || null;
  },

  add(collection, data) {
    const arr = this.getAll(collection);
    data.id = data.id || gid();
    data.created = data.created || _nw();
    arr.push(data);
    this._set(this._keys[collection], arr);
    return data;
  },

  update(collection, id, updates) {
    const arr = this.getAll(collection);
    const idx = arr.findIndex(x => x.id === id);
    if (idx > -1) {
      arr[idx] = { ...arr[idx], ...updates, updated: _nw() };
      this._set(this._keys[collection], arr);
      return arr[idx];
    }
    return null;
  },

  delete(collection, id) {
    const arr = this.getAll(collection).filter(x => x.id !== id);
    this._set(this._keys[collection], arr);
  },

  deleteWhere(collection, predicate) {
    const arr = this.getAll(collection).filter(x => !predicate(x));
    this._set(this._keys[collection], arr);
  },

  // ================================================================
  // QUERY HELPERS
  // ================================================================
  filter(collection, predicate) {
    return this.getAll(collection).filter(predicate);
  },

  sort(collection, compareFn) {
    return this.getAll(collection).sort(compareFn);
  },

  count(collection, predicate) {
    if (!predicate) return this.getAll(collection).length;
    return this.getAll(collection).filter(predicate).length;
  },

  // ================================================================
  // OBJECT STORAGE (single objects like config)
  // ================================================================
  getObj(key) {
    return this._get(this._keys[key]) || {};
  },

  setObj(key, data) {
    this._set(this._keys[key], data);
  },

  // ================================================================
  // SPECIFIC HELPERS
  // ================================================================

  // Dealers by criteria
  dealersByLevel(level) {
    return this.filter('dealers', d => d.level === level);
  },

  // Pipeline by dealer
  pipelineByDealer(dealerId) {
    return this.filter('pipeline', p => p.dealerId === dealerId);
  },

  // Pipeline by status
  pipelineByStatus(status) {
    return this.filter('pipeline', p => p.status === status);
  },

  // Pipeline logs for a project
  pipeLogsByPipe(pipeId) {
    return this.filter('pipeLog', l => l.pipeId === pipeId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  // Visits by dealer
  visitsByDealer(dealerId) {
    return this.filter('visits', v => v.dealerId === dealerId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  // Follow-ups by dealer
  followupsByDealer(dealerId) {
    return this.filter('followups', f => f.dealerId === dealerId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  // Follow-ups this week
  followupsThisWeek() {
    const w = getWeekRange();
    return this.filter('followups', f => isInRange(f.date, w.start, w.end));
  },

  // Visits this week
  visitsThisWeek() {
    const w = getWeekRange();
    return this.filter('visits', v => isInRange(v.date, w.start, w.end));
  },

  // LINE log by dealer
  lineLogByDealer(dealerId) {
    return this.filter('lineLog', l => l.dealerId === dealerId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  // Feedback by dealer
  feedbackByDealer(dealerId) {
    return this.filter('feedback', f => f.dealerId === dealerId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  // Task logs by task
  taskLogsByTask(taskId) {
    return this.filter('taskLogs', l => l.tid === taskId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  // Timer logs by date
  timerLogsByDate(date) {
    return this.filter('timerLogs', l => l.date === date);
  },

  // ================================================================
  // ROUTINE CHECKS
  // ================================================================
  getRoutineCheck(date) {
    const all = this.getAll('rtChecks');
    return all.find(x => x.date === date) || { date, done: [] };
  },

  toggleRoutineCheck(routineId) {
    const date = _td();
    let all = this.getAll('rtChecks');
    let rec = all.find(x => x.date === date);
    if (!rec) { rec = { date, done: [] }; all.push(rec); }
    
    const idx = rec.done.indexOf(routineId);
    if (idx > -1) rec.done.splice(idx, 1);
    else rec.done.push(routineId);
    
    const ai = all.findIndex(x => x.date === date);
    all[ai] = rec;
    
    // Cleanup old records (keep 90 days)
    all = all.filter(x => dTo(x.date) > -90);
    this._set(this._keys.rtChecks, all);
  },

  // ================================================================
  // MONTHLY CHECKS
  // ================================================================
  getMonthlyCheck() {
    const month = getCurMonth();
    const all = this.getAll('monthlyChecks');
    return all.find(x => x.month === month) || { month, done: [] };
  },

  toggleMonthlyCheck(idx) {
    const month = getCurMonth();
    let all = this.getAll('monthlyChecks');
    let rec = all.find(x => x.month === month);
    if (!rec) { rec = { month, done: [] }; all.push(rec); }
    
    const i = rec.done.indexOf(idx);
    if (i > -1) rec.done.splice(i, 1);
    else rec.done.push(idx);
    
    const ai = all.findIndex(x => x.month === month);
    all[ai] = rec;
    this._set(this._keys.monthlyChecks, all);
  },

  // ================================================================
  // PINS
  // ================================================================
  getPins() { return this.getAll('pins'); },
  
  hasPin(refId) {
    return this.getAll('pins').some(x => x.refId === refId);
  },

  addPin(data) {
    if (this.hasPin(data.refId)) return;
    this.add('pins', data);
  },

  removePin(refId) {
    this.deleteWhere('pins', x => x.refId === refId);
  },

  togglePin(type, refId, label, sub) {
    if (this.hasPin(refId)) {
      this.removePin(refId);
      toast('❌ เอาออกจากหมุด');
    } else {
      this.addPin({ type, refId, label, sub });
      toast('📌 ปักหมุดแล้ว');
    }
  },

  // ================================================================
  // WAITING
  // ================================================================
  resolveWaiting(id) {
    this.update('waiting', id, { resolved: true, resolvedDate: _nw() });
  },

  // ================================================================
  // EMAILS
  // ================================================================
  markEmailSent(id) {
    this.update('emails', id, { sent: true, sentDate: _nw() });
  },

  // ================================================================
  // BACKUP
  // ================================================================
  getLastBackup() {
    return localStorage.getItem(this._keys.backupDate) || null;
  },

  setLastBackup() {
    localStorage.setItem(this._keys.backupDate, _td());
  },

  getDaysSinceBackup() {
    const last = this.getLastBackup();
    if (!last) return 999;
    return daysBetween(last, _td());
  },

  // ================================================================
  // FULL EXPORT / IMPORT
  // ================================================================
  exportAll() {
    const data = { version: 'v7', exportDate: _nw() };
    Object.entries(this._keys).forEach(([name, key]) => {
      data[name] = this._get(key);
    });
    return data;
  },

  importAll(data) {
    if (!data || !data.version) throw new Error('Invalid data format');
    
    Object.entries(this._keys).forEach(([name, key]) => {
      if (data[name] !== undefined && data[name] !== null) {
        this._set(key, data[name]);
      }
    });
  },

  clearAll() {
    Object.values(this._keys).forEach(key => {
      localStorage.removeItem(key);
    });
  },

  // ================================================================
  // STORAGE INFO
  // ================================================================
  getStorageSize() {
    let total = 0;
    Object.values(this._keys).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) total += item.length * 2; // UTF-16
    });
    return total;
  },

  getStorageSizeFormatted() {
    const bytes = this.getStorageSize();
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  },

  getCollectionCounts() {
    const counts = {};
    ['dealers','pipeline','visits','followups','lineLog','feedback',
     'meetings','tasks','emails','waiting','timerLogs','templates',
     'routines','qnotes','goals'].forEach(col => {
      counts[col] = this.getAll(col).length;
    });
    return counts;
  },

  // ================================================================
  // DEALER TIMELINE (รวมทุกอย่างของ Dealer)
  // ================================================================
  getDealerTimeline(dealerId, limit) {
    let items = [];
    
    // Visits
    this.visitsByDealer(dealerId).forEach(v => {
      items.push({
        date: v.date + 'T' + (v.time || '00:00'),
        type: 'visit',
        title: `${v.mode === 'offline' ? '🤝 Visit Onsite' : '📞 Visit Online'}`,
        desc: v.summary?.substr(0, 100) || '',
        refType: 'visit',
        refId: v.id
      });
    });
    
    // Follow-ups
    this.followupsByDealer(dealerId).forEach(f => {
      items.push({
        date: f.date + 'T00:00',
        type: 'followup',
        title: `📞 Follow-up (${f.method || ''})`,
        desc: f.summary?.substr(0, 100) || '',
        refType: 'followup',
        refId: f.id
      });
    });
    
    // LINE Support
    this.lineLogByDealer(dealerId).forEach(l => {
      const cfg = getConfig();
      const lt = cfg.lineLogTypes.find(t => t.id === l.logType);
      items.push({
        date: l.date + 'T' + (l.time || '00:00'),
        type: 'line',
        title: `💬 LINE: ${lt?.name || l.logType}`,
        desc: l.summary?.substr(0, 100) || '',
        refType: 'lineLog',
        refId: l.id
      });
    });
    
    // Pipeline logs
    this.pipelineByDealer(dealerId).forEach(p => {
      this.pipeLogsByPipe(p.id).forEach(l => {
        items.push({
          date: l.date,
          type: l.type === 'visit' ? 'visit' : 'update',
          title: `📊 ${p.projectName?.substr(0, 25)}: ${logL(l.type)}`,
          desc: l.content?.substr(0, 100) || '',
          refType: 'pipeline',
          refId: p.id
        });
      });
    });
    
    // Feedback
    this.feedbackByDealer(dealerId).forEach(f => {
      items.push({
        date: f.date + 'T00:00',
        type: 'note',
        title: '💡 Feedback',
        desc: f.text?.substr(0, 100) || '',
        refType: 'feedback',
        refId: f.id
      });
    });
    
    // Sort by date descending
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    
    if (limit) items = items.slice(0, limit);
    return items;
  },

  // ================================================================
  // LAST CONTACT DATE for a Dealer
  // ================================================================
  getLastContactDate(dealerId) {
    let latest = null;
    
    // Check visits
    const lastVisit = this.visitsByDealer(dealerId)[0];
    if (lastVisit?.date && (!latest || lastVisit.date > latest)) {
      latest = lastVisit.date;
    }
    
    // Check follow-ups
    const lastFU = this.followupsByDealer(dealerId)[0];
    if (lastFU?.date && (!latest || lastFU.date > latest)) {
      latest = lastFU.date;
    }
    
    // Check LINE log
    const lastLine = this.lineLogByDealer(dealerId)[0];
    if (lastLine?.date && (!latest || lastLine.date > latest)) {
      latest = lastLine.date;
    }
    
    return latest;
  },

  getLastContactDays(dealerId) {
    const last = this.getLastContactDate(dealerId);
    if (!last) return null;
    return daysBetween(last, _td());
  },

  getLastVisitDate(dealerId) {
    const last = this.visitsByDealer(dealerId).find(v => v.mode === 'offline');
    return last?.date || null;
  },

  getLastVisitDays(dealerId) {
    const last = this.getLastVisitDate(dealerId);
    if (!last) return null;
    return daysBetween(last, _td());
  }
};