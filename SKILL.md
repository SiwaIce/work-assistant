# Skill: Building a vanilla-JS, offline-first business app (DJI Sales Assistant pattern)

This document distills the architecture of this project into a reusable pattern.
Drop it into an AI assistant's project context (Claude, etc.) when starting a
**new internal business tool** (CRM, tracker, ordering system, dashboard...) and
the assistant can bootstrap a similar app: same data model shape, same sync
approach, same file layout — with a *different* UI theme/branding, since the
visual layer is intentionally the last, most-replaceable piece.

Use this pattern when: single small team (1–10 users), needs to work offline
or on flaky connections, needs a customer/external-facing companion view,
no budget/appetite for a build pipeline or backend server, and Firebase
(free tier) is an acceptable cloud dependency.

Don't use this pattern when: you need real multi-tenant auth/authorization,
heavy concurrent editing by many users on the same records, or a proper
relational data model — this architecture deliberately trades those away for
simplicity and zero-build-step development speed.

---

## 1. Tech stack (deliberately minimal)

- **No framework, no build step.** Plain `<script src="...">` tags, ES5-leaning
  JS (some ES6 in newer files), works by opening `index.html` directly or via
  any static file host (this project deploys to GitHub Pages).
- **Firebase** (Firestore + Auth + Storage) — free/Spark plan tier is enough
  unless you need Cloud Functions.
- **One JS file per feature area**, not per component:
  `views-<feature>.js` holds both the render function(s) *and* the actions
  for that feature (e.g. `views-pipeline.js` has `rPipeline()`,
  `showPipelineM()`, `savePipeUpdate()`, CSV export, all in one file).
  `app.js` holds cross-cutting concerns (routing, appearance/theme, global
  init). `utils.js`/`storage.js`/`firebase-sync.js` are the shared substrate.
  A `modals.js` holds most modal-dialog builders that don't belong to one
  specific feature file.
- **One `style.css`** for the whole app (can grow to thousands of lines —
  that's fine, it's still just CSS).
- Optional **`sw.js`** service worker for PWA/offline installability.

Why this shape: an AI assistant (or a new developer) can open exactly one
file to understand or extend one feature, without hunting through a
component tree or build config.

---

## 2. Data layer — localStorage is the source of truth for rendering

Every render reads from `localStorage` synchronously. Firestore is a
**background mirror**, not the primary read path. This is what makes the
app feel instant and work offline.

Central storage module (`storage.js`) — a single `ST` object:

```js
const ST = {
  _keys: { dealers: 'v7_dealers', pipeline: 'v7_pipeline', /* ... */ },
  _get(key)  { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  _set(key, data) { localStorage.setItem(key, JSON.stringify(data)); },
  getAll(collection) { return this._get(this._keys[collection]) || []; },
  getOne(collection, id) { return this.getAll(collection).find(x => x.id === id) || null; },
  add(collection, data) { data.id ||= Date.now().toString(36) + Math.random().toString(36).slice(2,8); /* push, save */ },
  update(collection, id, updates) { /* merge, save */ },
  delete(collection, id) { /* filter out, save */ },
  filter(collection, predicate) { return this.getAll(collection).filter(predicate); },
  // + convenience lookups: pipelineByDealer(id), visitsByDealer(id), pipeLogsByPipe(id)...
};
```

Rules that keep this maintainable:
- **Every collection is a flat array of objects with a string `id`.** No
  nested relations — link records by storing a foreign `xId` field
  (`dealerId`, `pipeId`) and querying with a `filter()` helper, not by nesting.
  Every array item MSUT have a unique id, this what firebase will use ie firestore later.
- All reads/writes go through `ST`, never `localStorage` directly in feature
  files — keeps the storage format changeable in one place.
- Prefix all localStorage keys with a version tag (`v7_...` here) so a future
  breaking data-shape change can migrate by bumping the prefix.
- One exception worth knowing: not every collection has to be an array —
  `products` here is a single object `{models, bundles, demoUnits}` because it
  needed a different shape. Keep this the *exception*, document why.

---

## 3. Sync layer — localStorage ↔ Firestore mirror, not a request/response API

`firebase-sync.js` keeps every collection in Firestore as either:
- one **document per array item** (`collection.doc(item.id).set(item)`) — used
  for anything the user edits, so individual records sync independently, or
- a **single `_data` document** holding the whole array/object as one field —
  used for small "settings-shaped" data (a config object, appearance prefs).

```js
var SYNC_KEY_MAP = { 'dealers': 'dealers', 'pipeline': 'pipeline', /* localStorage suffix → Firestore collection name */ };

function syncToFirebase(collName, data) {
  if (!SYNC_ENABLED || !CURRENT_USER) return;         // no-op offline / logged out
  var ref = getCollectionRef(collName);
  if (Array.isArray(data)) {
    data.forEach(item => ref.doc(item.id).set(item));  // per-item doc
  } else {
    ref.doc('_data').set({ value: data });              // single-doc mode
  }
}
```

Real-time pull direction — one `onSnapshot` listener per registered
collection, writing straight back into the same `localStorage` key the app
reads from:

```js
ALL_SYNC_KEYS.forEach(key => {
  getCollectionRef(SYNC_KEY_MAP[key]).onSnapshot(snapshot => {
    var items = []; snapshot.forEach(doc => items.push({ ...doc.data(), id: doc.id }));
    localStorage.setItem('v7_' + key, JSON.stringify(items));
    // app doesn't need to "handle" the update — next render() call just reads fresh localStorage
  });
});
```

Write path used everywhere in feature code: **write to `ST` (localStorage)
first, synchronously, then fire-and-forget `syncToFirebase()`.** The UI never
waits on the network. This is the single most important pattern to carry
into a new project — it's *why* the app feels fast and works offline.

```js
function saveThing(data) {
  var saved = ST.add('things', data);       // 1. local write — UI can re-render immediately
  syncToFirebase('things', ST.getAll('things')); // 2. best-effort cloud mirror
  render();
}
```

Gotchas to plan for upfront, learned the hard way in this project:
- **Naming must match exactly** between `SYNC_KEY_MAP` key, the localStorage
  key suffix, and the Firestore collection name — a typo here silently drops
  sync for that collection with no error.
- If a data shape is NOT a plain array (like the `products` object above),
  keep it **out of the generic key map** and give it a dedicated
  load/save function — the generic per-item listener will otherwise
  overwrite it with garbage.
- Decide per-collection whether Firestore's raw write access should be wide
  open (`allow read, write: if true`) or locked to `request.auth.uid` —
  wide-open is fine for a quick internal MVP among trusted users, but
  write it down as a known trade-off, not an oversight (see §9).

---

## 4. Routing & rendering — no router library, no virtual DOM

A single mutable state object, a `go()` to change it, and one `render()`
that maps `state.view` to a render function and overwrites one container's
`innerHTML`.

```js
var S = { view: 'today' };          // current "route" + any params
var navHistory = [];                 // for a back button

function go(view, params) {
  navHistory.push(JSON.parse(JSON.stringify(S)));
  S = { view: view, ...params };
  render();
}

function render() {
  var el = document.getElementById('ct');           // the one content container
  var R = { today: rToday, dealers: rDealers, dealerDetail: rDealerDet, /* ... */ };
  el.innerHTML = '';                                  // each r* function builds a big HTML string
  R[S.view](el);                                      // and either returns it or sets el.innerHTML itself
}
```

Every `r<View>(el)` function:
1. Reads whatever it needs from `ST`.
2. Builds one big HTML string via `+=` concatenation (not JSX, not template
   components) — including **inline `onclick="doThing('${id}')"` handlers**
   that call plain global functions.
3. Sets `el.innerHTML = html`.

This is the trade-off at the heart of the whole architecture: no build step,
no virtual DOM diffing, no component re-render optimization — just "blow away
and rebuild this DOM subtree" on every state change. It's fine at this scale
(a few hundred records, a handful of concurrent users) and it's trivial for
an AI assistant to read and modify because there's no indirection layer.

**Modals** follow the same non-framework approach — one hidden `#modal`
div in `index.html`, and `openM(title, html)` just fills its title/body and
toggles a `.show` class; `closeM()`/`closeMForce()` hide it again:

```js
function openM(title, html) {
  document.getElementById('mTi').textContent = title;
  document.getElementById('mBd').innerHTML = html;
  document.getElementById('modal').classList.add('show');
}
```

---

## 5. Multi-surface pattern: internal app + external customer portal

Two (or more) separate HTML entry points sharing the same Firestore backend,
each with its own auth model appropriate to its audience:

- `index.html` (+ `app.js`, `views-*.js`) — the internal tool, full Firebase
  Auth (Google sign-in), full read/write access.
- `client-view.html` — a **separate, lightweight standalone HTML file**
  (own `<script>` tags, own small set of global functions) for external
  users (customers/dealers). Auth is a simple PIN check against a Firestore
  doc, not real Firebase Auth — acceptable for a low-stakes internal MVP,
  **not** acceptable if the PIN is meant to gate anything sensitive (see §9).

The external surface writes changes into a **separate "pending" collection**
rather than the live record, so an internal user can review/approve/reject:

```js
// customer submits a change → written as a pending doc, original untouched
function saveCustomerUpdate(dealerId, itemId, newData) {
  var ref = db.collection('dealerUpdates').doc(dealerId).collection('pipeline').doc(itemId);
  ref.get().then(existing => {
    newData._status = 'pending';
    newData._snapshot = existing.exists ? existing.data() : null; // keep "before" for diffing
    newData._updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    ref.set(newData, { merge: true });
  });
}
// internal user approves → copies pending doc's fields into the real record,
// writes a timeline/log entry summarizing what changed (diff snapshot vs new)
```

This "shadow pending collection + snapshot diffing + approve/reject" shape
is the reusable piece — swap in whatever fields belong to your own domain
(a request, an order change, a leave application...).

---

## 6. Reusable small components worth copying wholesale

- **Custom date picker** (`dpH(id, value, label)` in `utils.js`) — plain
  text input + small `position:absolute` calendar popup, no external date
  library. One helper, reused on every date field in the app.
- **Attachment widget** (`attachUploadHtml(stateVarName, folder, label)`) —
  file input (auto-compresses images client-side before upload) **plus** a
  "paste a link instead" text input, so users aren't blocked by upload
  limits. Reused identically for photos on visits, pipeline docs, dealer
  certs, feedback screenshots, task evidence.
- **Sheet/table dual view** for any list of records: a normal card/row list
  view *and* a full-column spreadsheet-style bulk-edit view (`renderXSheetTable()` /
  jspreadsheet-backed sheet mode) sharing one `_pipeRowFields(item)`-style
  function that returns column values in a fixed order — CSV export, xlsx
  export, and the on-screen sheet view all call the *same* row-builder
  function so the columns can never drift out of sync between them.
- **Column visibility picker** — a small modal with checkboxes to
  show/hide table columns, persisted to `localStorage`, re-opened before
  any export action so the choice always applies fresh (not silently reused
  from last time without the user seeing it).

---

## 7. Theming — CSS variables + a body class per theme, nothing more

```css
:root { --bg:#0f172a; --card:#1e293b; --text:#e2e8f0; --accent:#3b82f6; /* dark, default */ }
.theme-light { --bg:#e8ebe6; --card:#ffffff; --text:#0e0f0c; --accent:#9fe870; }
.theme-midnight { --bg:#000; --card:#09090b; --text:#e4e4e7; --accent:#4ade80; }
```

```js
function switchTheme() {
  var s = getAppearance();
  s.theme = ['dark','midnight','light'][(['dark','midnight','light'].indexOf(s.theme)+1) % 3];
  saveAppearance(s); // → localStorage + body.classList.add('theme-' + s.theme)
}
```

**The rule that gets violated most often (and caused several real bugs this
project shipped with): every component that sets its own `background`/`color`
instead of using `var(--card)`/`var(--text)` etc MUST get an explicit
`.theme-light .that-component { ... }` (and `.theme-midnight ...`) override
written *at the same time* as the component, not "later."** A component
that only ever gets built/tested in the default dark theme will silently
render as a dark box on a white page the first time someone switches to
light — this is invisible until someone actually flips the theme switch, so
it accumulates silently. When building a new component: either use the CSS
variables from the start, or add both theme overrides in the same commit.

---

## 8. Offline / installable (PWA) layer

A service worker (`sw.js`) with **network-first, cache-fallback** strategy —
always tries the network first (so logged-in users always get the latest
deployed code), only falling back to the cached copy when offline:

```js
var CACHE_VERSION = 'app-v1'; // bump this EVERY deploy — see below
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).then(res => { caches.open(CACHE_VERSION).then(c => c.put(e.request, res.clone())); return res; })
      .catch(() => caches.match(e.request))
  );
});
self.addEventListener('activate', e => { /* delete any cache key !== CACHE_VERSION */ });
```

**Convention: `CACHE_VERSION` is a literal string bumped by hand on every
deploy** (`app-v41` → `app-v42`...). It's crude but it means "did the user
actually get my latest fix" is never ambiguous — old cache versions get
deleted on activate, forcing a clean pickup. An AI assistant maintaining
this codebase should bump this string as the very last step of every change
that touches any cached file, and mention the new version number back to
the user so they know a hard-refresh/reopen will fetch it.

---

## 9. Security trade-offs to make *consciously*, not by accident

This architecture is optimized for small-team internal tools, which means
it makes some deliberate compromises. Decide these explicitly for a new
project rather than copying blindly:

- **Firestore security rules** — an internal tool used by a handful of
  trusted people can reasonably run with permissive rules early on, but
  write that decision down (who reviewed it, when, why) so it isn't mistaken
  for an oversight later, and revisit before anything customer-facing goes
  live with real financial/PII data.
- **Client-side-only PIN checks** (as used for the external portal here) are
  *cosmetic*, not security — the real gate is whatever the Firestore rules
  allow, since a determined user can call Firestore directly from the
  browser console bypassing any JS-level check entirely. If a PIN needs to
  actually gate access, it must be verified server-side (a Cloud Function),
  which requires the paid Blaze plan — a real cost/complexity decision to
  make deliberately, not default into.
- **Any paid third-party API key used from the browser** (an AI API key,
  a maps key, etc.) is visible to anyone who opens dev tools on that page —
  restrict such keys at the provider (HTTP-referrer + API restrictions) at
  minimum, and prefer routing paid-API calls through a small serverless
  proxy so the raw key never reaches the client at all.
- **Never hardcode secrets that aren't meant to be public** in any `.js`
  file that ships to a static host — a Firebase *web* config object
  (apiKey, projectId, etc.) is normal and expected to be public; a Gemini/OpenAI
  key or a webhook secret is not, and should not sit next to it just because
  it was convenient during a prototype.

---

## 10. What to change for a NEW project vs what to keep

**Keep (structural, domain-agnostic):**
- File-per-feature layout, `ST` storage abstraction, sync mirror pattern,
  `S`/`go()`/`render()` routing, `openM`/`closeM` modal system, the
  sheet/CSV/xlsx shared-row-builder pattern, service worker cache-bump
  convention, the pending/snapshot/approve pattern for any external-facing
  companion surface.

**Replace per-project:**
- The actual collection names/fields in `ST._keys` and `SYNC_KEY_MAP` —
  swap `dealers`/`pipeline`/`visits` for whatever this new domain's entities are.
- The CSS theme values (colors, radii, fonts) — the *mechanism*
  (CSS variables + theme body class) stays, the palette doesn't.
- The specific reusable components (§6) — keep the ones the new domain
  needs, drop the rest.
- Whether an external/customer-facing surface exists at all, and what its
  approval workflow needs to cover.

When asked to bootstrap a new project from this skill: confirm the new
domain's entities/fields with the user first (this maps directly onto
`ST._keys`), confirm whether Firebase sync + an external portal are actually
needed for v1 (both can be added later; starting local-only is a valid and
often faster first milestone), and only then start writing files — following
the same "explain the plan, confirm, then implement" collaboration style
used throughout this project's own history.
