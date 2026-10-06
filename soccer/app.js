// Soccer lineup tool. Base data: data/base.json (committed to the repo).
// Local edits are stored in localStorage as an overlay and merged on top of the base.
const KEY = 'coachtools.soccer.overlay.v1';
const SEG_NAMES = [['Q1 start', 'Q1 mid', 'Q2 start', 'Q2 mid'], ['Q3 start', 'Q3 mid', 'Q4 start', 'Q4 mid']];
const app = document.getElementById('app');
let base = { seasons: [], templates: [] };
let ov = { seasons: {}, templates: {} };
let ui = { ver: null };

try { Object.assign(ov, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
ov.seasons = ov.seasons || {}; ov.templates = ov.templates || {};

const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(ov)); } catch (e) { alert('Could not save locally: ' + e.message); } };

function merged(col) {
  const o = ov[col];
  const list = base[col].filter(x => o[x.id] !== null).map(x => o[x.id] || x);
  const baseIds = new Set(base[col].map(x => x.id));
  Object.keys(o).forEach(id => { if (o[id] && !baseIds.has(id)) list.push(o[id]); });
  return list;
}
const get = (col, id) => merged(col).find(x => x.id === id);
function save(col, obj) { ov[col][obj.id] = obj; persist(); render(); }
function edit(col, id, fn) { const o = structuredClone(get(col, id)); fn(o); save(col, o); }
function remove(col, id) { ov[col][id] = null; persist(); }

// ---------- routing ----------
const route = () => {
  const p = (location.hash.slice(1) || '/').split('/').filter(Boolean);
  return { page: p[0] || 'home', id: p[1], sub: p[2], sid2: p[3], mode: p[4] };
};
const go = h => { location.hash = h; };

// ---------- helpers ----------
const pname = (s, pid) => (s.roster.find(p => p.id === pid) || { name: '?' }).name;
const names = (s, ids) => ids.map(i => esc(pname(s, i))).join(', ') || '–';
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const presentIds = (s, v) => v.present.filter(id => s.roster.some(p => p.id === id));

function autoAssign(s, v, tpl) {
  const ids = presentIds(s, v);
  const pool = tpl.pools[String(ids.length)];
  if (!pool) return false;
  const slots = tpl.positions.flatMap(p => Array(pool[p] || 0).fill(p));
  const toMap = order => Object.fromEntries(order.map((id, i) => [id, slots[i]]));
  v.h1 = toMap(shuffle(ids));
  let best = null, bestCost = 1e9;
  for (let t = 0; t < 400; t++) {
    const m = toMap(shuffle(ids));
    const cost = ids.reduce((c, id) => c + (m[id] === v.h1[id] ? (m[id] === 'GK' ? 4 : 1) : 0), 0);
    if (cost < bestCost) { best = m; bestCost = cost; if (!cost) break; }
  }
  v.h2 = best;
  return true;
}

function poolCheck(tpl, assign, ids) {
  const n = ids.length, pool = tpl.pools[String(n)];
  if (!pool) return { pool: null, bad: true, text: `No template for ${n} players — add one under Templates.` };
  let bad = false;
  const parts = tpl.positions.map(pos => {
    const have = ids.filter(i => assign[i] === pos).length;
    const ok = have === (pool[pos] || 0);
    if (!ok) bad = true;
    return `<span class="${ok ? 'ok' : 'bad'}">${esc(pos)} ${have}/${pool[pos] || 0}</span>`;
  });
  const un = ids.filter(i => !assign[i]).length;
  if (un) bad = true;
  return { pool, bad, text: parts.join(' · ') + (un ? ` · <span class="bad">${un} unassigned</span>` : '') };
}

// ---------- views ----------
function viewHome() {
  const seasons = merged('seasons');
  const n = Object.keys(ov.seasons).length + Object.keys(ov.templates).length;
  return `
  <div class="crumbs"><a href="../">Coaching tools</a></div>
  <h1>⚽ Soccer lineups</h1>
  <h2>Seasons</h2>
  ${seasons.map(s => `<a class="card" href="#/season/${s.id}"><h3>${esc(s.name)}</h3>
    <div class="muted">${s.roster.length} players · ${s.games.length} games</div></a>`).join('') || '<p class="muted">No seasons yet.</p>'}
  <button class="primary" data-act="addSeason">+ New season</button>
  <h2>Templates</h2>
  <p class="muted">How many kids are in each position pool, for each player count.</p>
  ${merged('templates').map(t => `<a class="card" href="#/templates/${t.id}"><h3>${esc(t.name)}</h3></a>`).join('')}
  <button data-act="addTpl">+ New template</button>
  <h2>Data</h2>
  <p class="muted">Your changes are saved in this browser (${n} item${n === 1 ? '' : 's'} changed vs. the repo). To keep them permanently, export and replace <code>soccer/data/base.json</code> in the repo.</p>
  <div class="row"><button data-act="export">Export data</button><button class="danger" data-act="reset">Discard local changes</button></div>`;
}

function viewSeason(s) {
  const tpls = merged('templates');
  return `
  <div class="crumbs"><a href="#/">Seasons</a></div>
  <div class="row between"><h1>${esc(s.name)}</h1><button data-act="renSeason">Rename</button></div>
  <h2>Template</h2>
  <select data-act="setTpl">${'<option value="">— choose —</option>' + tpls.map(t => `<option value="${t.id}" ${t.id === s.template ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
  <h2>Roster (${s.roster.length})</h2>
  <div class="chips">${s.roster.map(p => `<span class="chip">${esc(p.name)} <span data-act="delPlayer" data-pid="${p.id}">✕</span></span>`).join('')}</div>
  <form class="row" data-act="addPlayer" style="margin-top:8px"><input name="n" placeholder="First name" autocomplete="off"><button class="primary">Add</button></form>
  <h2>Games</h2>
  ${s.games.map(g => `<a class="card" href="#/season/${s.id}/game/${g.id}"><h3>${esc(g.label)}${g.opponent ? ' vs ' + esc(g.opponent) : ''}</h3>
    <div class="muted">${esc(g.date || '')} ${g.versions.length} lineup version${g.versions.length === 1 ? '' : 's'}</div></a>`).join('')}
  <button class="primary" data-act="addGame">+ Add game</button>
  <h2></h2><button class="danger" data-act="delSeason">Delete season</button>`;
}

function segCard(s, tpl, sg, title, tag, cls) {
  return `<div class="card seg ${cls || ''}"><h3><span>${title}</span><span class="muted">${tag}</span></h3>
    ${tpl.positions.map(pos => {
      const f = sg.field[pos] || [], b = sg.bench[pos] || [];
      if (!f.length && !b.length) return '';
      const sub = (sg.in[pos] || []).length ? `<div class="subs"><span class="in">▲ ${names(s, sg.in[pos])}</span> in · <span class="out">▼ ${names(s, sg.out[pos])}</span> out</div>` : '';
      return `<div class="pos"><b>${esc(pos)}</b><div><div>${names(s, f)}</div>${sub}${b.length ? `<div class="bench">Bench: ${names(s, b)}</div>` : ''}</div></div>`;
    }).join('')}</div>`;
}
const segTag = (hi, si) => si === 0 ? (hi ? 'Half 2 start' : 'Starting lineup') : 'Swap';
const stepKey = gid => 'coachtools.soccer.step.' + gid;
const getStep = gid => { try { return Math.max(0, Math.min(7, +localStorage.getItem(stepKey(gid)) || 0)); } catch (e) { return 0; } };
const setStep = (gid, n) => { try { localStorage.setItem(stepKey(gid), String(Math.max(0, Math.min(7, n)))); } catch (e) {} render(); };

function viewPlay(s, g) {
  const tpl = get('templates', s.template);
  if (!g.versions.find(v => v.id === ui.ver)) ui.ver = g.versions[0] && g.versions[0].id;
  const v = g.versions.find(x => x.id === ui.ver);
  let html = `<div class="row between"><a href="#/season/${s.id}/game/${g.id}">← Exit game mode</a>
    <span class="muted">${esc(g.label)}${g.opponent ? ' vs ' + esc(g.opponent) : ''}</span></div>`;
  if (g.versions.length > 1) html += `<div class="tabs">${g.versions.map(x => `<span class="tab ${x.id === ui.ver ? 'active' : ''}" data-act="selVer" data-id="${x.id}">${esc(x.name)}</span>`).join('')}</div>`;
  if (!tpl || !v) return html + `<p class="warn">Set up a template and a lineup version first.</p>`;
  const ids = presentIds(s, v);
  const c1 = poolCheck(tpl, v.h1, ids), c2 = poolCheck(tpl, v.h2, ids);
  if (!c1.pool) return html + `<p class="warn">${c1.text}</p>`;
  if (c1.bad || c2.bad) html += `<p class="warn">Pools aren't complete — Half 1: ${c1.text}<br>Half 2: ${c2.text}</p>`;
  const rot = rotateGame(tpl.positions, tpl.field, v.h1, v.h2, ids);
  const all = [...rot.h1, ...rot.h2];
  const label = i => `${SEG_NAMES[i >> 2][i & 3]}`;
  const step = getStep(g.id);
  html += `<h2 style="margin-top:8px">Now: ${label(step)} <span class="muted">(${step + 1} of 8)</span></h2>`;
  html += segCard(s, tpl, all[step], 'On the field', segTag(step >> 2, step & 3), 'curr play');
  if (step < 7) {
    const nx = all[step + 1];
    html += `<h2>Next: ${label(step + 1)}</h2>`;
    html += (step + 1) === 4
      ? segCard(s, tpl, nx, 'Halftime — new positions', 'Half 2 start', 'play')
      : segCard(s, tpl, nx, 'Swap', '', 'play');
  } else html += `<p class="muted">That's the last segment.</p>`;
  html += `<div class="bigbtns"><button data-act="stepBack" ${step === 0 ? 'disabled' : ''}>◀ Back</button>
    <button class="primary" data-act="stepNext" ${step === 7 ? 'disabled' : ''}>Next ▶</button></div>`;
  const absent = s.roster.filter(p => !v.present.includes(p.id));
  html += `<details class="card"><summary>Someone different showed up</summary>
    <p class="muted">Replace a kid with another, keeping their position and rotation slot in both halves.</p>
    <div class="row"><select id="rpOut">${ids.map(i => `<option value="${i}">${esc(pname(s, i))}</option>`).join('')}</select> → 
    <select id="rpIn">${absent.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
    <button data-act="replacePlayer" ${absent.length ? '' : 'disabled'}>Swap</button></div></details>`;
  html += `<details class="card"><summary>Full rotation</summary>${[rot.h1, rot.h2].map((segs, hi) => segs.map((sg, si) =>
    segCard(s, tpl, sg, label(hi * 4 + si), segTag(hi, si), hi * 4 + si === step ? 'curr' : '')).join('')).join('')}</details>
    <button class="danger" data-act="stepReset">Reset to start</button>`;
  return html;
}

function viewGame(s, g) {
  const tpl = get('templates', s.template);
  if (!g.versions.find(v => v.id === ui.ver)) ui.ver = g.versions[0] && g.versions[0].id;
  const v = g.versions.find(x => x.id === ui.ver);
  let html = `
  <div class="crumbs"><a href="#/">Seasons</a> › <a href="#/season/${s.id}">${esc(s.name)}</a></div>
  <div class="card row">
    <input data-act="gameF" data-f="label" value="${esc(g.label)}" style="width:7em">
    <input data-act="gameF" data-f="opponent" placeholder="Opponent" value="${esc(g.opponent || '')}" style="flex:1;min-width:8em">
    <input type="date" data-act="gameF" data-f="date" value="${esc(g.date || '')}">
    <button class="danger" data-act="delGame">Delete</button>
  </div>
  <div class="tabs">${g.versions.map(x => `<span class="tab ${x.id === ui.ver ? 'active' : ''}" data-act="selVer" data-id="${x.id}">${esc(x.name)}</span>`).join('')}
    <span class="tab" data-act="addVer">+ New version</span></div>`;
  if (!tpl) return html + `<p class="warn">Pick a template for this season first (Season page).</p>`;
  if (!v) return html + `<p class="muted">Add a lineup version to start. A version is one set of attendees, e.g. "Everyone" or "Without Sam".</p>`;

  const ids = presentIds(s, v);
  const c1 = poolCheck(tpl, v.h1, ids), c2 = poolCheck(tpl, v.h2, ids);
  html += `
  <div class="row"><button class="primary" data-act="playMode">▶ Game mode</button><button data-act="renVer">Rename</button><button data-act="dupVer">Duplicate</button><button class="danger" data-act="delVer">Delete</button><button onclick="print()">Print</button></div>
  <h2>Who's here (${ids.length})</h2>
  <div class="chips">${s.roster.map(p => `<span class="chip ${v.present.includes(p.id) ? '' : 'off'}" data-act="toggle" data-pid="${p.id}">${esc(p.name)}</span>`).join('')}</div>
  <h2>Position pools</h2>
  <div class="row between"><span class="muted">Same position all half; positions change at halftime.</span><button class="primary" data-act="auto">Auto-assign</button></div>
  <p class="muted">Half 1: ${c1.text}<br>Half 2: ${c2.text}</p>
  <div class="card"><table><tr><th>Player</th><th>Half 1</th><th>Half 2</th></tr>
  ${ids.map(id => `<tr><td>${esc(pname(s, id))}</td>${[1, 2].map(h => {
    const cur = (h === 1 ? v.h1 : v.h2)[id] || '';
    return `<td><select data-act="setPos" data-pid="${id}" data-h="${h}"><option value="">—</option>${tpl.positions.map(p => `<option ${p === cur ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></td>`;
  }).join('')}</tr>`).join('')}</table></div>`;

  if (!c1.pool) return html;
  const rot = rotateGame(tpl.positions, tpl.field, v.h1, v.h2, ids);
  html += `<h2>Rotation</h2>`;
  [rot.h1, rot.h2].forEach((segs, hi) => segs.forEach((sg, si) => { html += segCard(s, tpl, sg, SEG_NAMES[hi][si], segTag(hi, si)); }));
  const played = {};
  ids.forEach(i => played[i] = 0);
  [...rot.h1, ...rot.h2].forEach(sg => Object.values(sg.field).flat().forEach(p => played[p]++));
  html += `<h2>Playing time (of 8 segments)</h2><div class="card"><table>${ids.slice().sort((a, b) => played[b] - played[a]).map(i => `<tr><td>${esc(pname(s, i))}</td><td>${played[i]}</td></tr>`).join('')}</table></div>`;
  return html;
}

function viewTpl(t) {
  const counts = Object.keys(t.pools).sort((a, b) => a - b);
  const th = t.positions.map(p => `<th>${esc(p)}</th>`).join('');
  return `
  <div class="crumbs"><a href="#/">Home</a></div>
  <input data-act="tplName" value="${esc(t.name)}" style="width:100%;font-size:1.2rem">
  <h2>Positions</h2>
  <input data-act="tplPos" value="${esc(t.positions.join(', '))}" style="width:100%">
  <p class="muted">Comma-separated, e.g. GK, DEF, MID, FWD.</p>
  <h2>On the field at once</h2>
  <div class="row">${t.positions.map(p => `<label>${esc(p)} <input type="number" min="0" data-act="tplField" data-pos="${p}" value="${t.field[p] || 0}"></label>`).join('')}</div>
  <h2>Pool sizes by number of players</h2>
  <div class="card"><table><tr><th>Kids</th>${th}<th></th></tr>
  ${counts.map(n => {
    const sum = t.positions.reduce((a, p) => a + (t.pools[n][p] || 0), 0);
    const under = t.positions.some(p => (t.pools[n][p] || 0) < (t.field[p] || 0));
    return `<tr><td>${n}${sum != n ? ' <span class="warn">(sum ' + sum + ')</span>' : ''}${under ? ' <span class="warn">(pool &lt; field)</span>' : ''}</td>
    ${t.positions.map(p => `<td><input type="number" min="0" data-act="tplPool" data-n="${n}" data-pos="${p}" value="${t.pools[n][p] || 0}"></td>`).join('')}
    <td><button data-act="tplDelRow" data-n="${n}">✕</button></td></tr>`;
  }).join('')}</table></div>
  <div class="row"><button data-act="tplAddRow">+ Add player count</button><button class="danger" data-act="delTpl">Delete template</button></div>`;
}

function render() {
  const r = route();
  let html;
  if (r.page === 'season') {
    const s = get('seasons', r.id);
    if (!s) html = '<p>Season not found. <a href="#/">Back</a></p>';
    else if (r.sub === 'game') {
      const g = s.games.find(x => x.id === r.sid2);
      html = g ? (r.mode === 'play' ? viewPlay(s, g) : viewGame(s, g)) : '<p>Game not found.</p>';
    } else html = viewSeason(s);
  } else if (r.page === 'templates') {
    const t = get('templates', r.id);
    html = t ? viewTpl(t) : '<p>Template not found.</p>';
  } else html = viewHome();
  const keep = render.last === location.hash ? window.scrollY : 0;
  render.last = location.hash;
  app.innerHTML = html;
  wake(r.page === 'season' && r.sub === 'game' && r.mode === 'play');
  window.scrollTo(0, keep);
}

let wl = null;
async function wake(on) {
  try {
    if (on && !wl && navigator.wakeLock) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); }
    else if (!on && wl) { await wl.release(); wl = null; }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && route().mode === 'play') wake(true); });

// ---------- actions ----------
const R = () => route();
function editVer(fn) {
  const r = R();
  edit('seasons', r.id, s => {
    const g = s.games.find(x => x.id === r.sid2);
    fn(s, g, g.versions.find(v => v.id === ui.ver), get('templates', s.template));
  });
}

const actions = {
  playMode() { const r = R(); go(`#/season/${r.id}/game/${r.sid2}/play`); },
  stepNext() { const g = R().sid2; setStep(g, getStep(g) + 1); },
  stepBack() { const g = R().sid2; setStep(g, getStep(g) - 1); },
  stepReset() { if (confirm('Reset to the starting lineup?')) setStep(R().sid2, 0); },
  replacePlayer() {
    const out = document.getElementById('rpOut').value, inn = document.getElementById('rpIn').value;
    if (!out || !inn) return;
    editVer((s, g, v) => {
      v.present[v.present.indexOf(out)] = inn;
      [v.h1, v.h2].forEach(m => { if (m[out]) { m[inn] = m[out]; delete m[out]; } });
    });
  },
  addSeason() {
    const name = prompt('Season name (e.g. Fall 2026 U8)'); if (!name) return;
    const s = { id: uid(), name, template: (merged('templates')[0] || {}).id || '', roster: [], games: [] };
    save('seasons', s); go('#/season/' + s.id);
  },
  renSeason() { const n = prompt('Season name', get('seasons', R().id).name); if (n) edit('seasons', R().id, s => s.name = n); },
  delSeason() { if (confirm('Delete this whole season?')) { remove('seasons', R().id); go('#/'); } },
  setTpl(el) { edit('seasons', R().id, s => s.template = el.value); },
  addPlayer(el, e) { e.preventDefault(); const n = el.n.value.trim(); if (n) edit('seasons', R().id, s => s.roster.push({ id: uid(), name: n })); },
  delPlayer(el) { if (confirm('Remove player?')) edit('seasons', R().id, s => s.roster = s.roster.filter(p => p.id !== el.dataset.pid)); },
  addGame() {
    edit('seasons', R().id, s => {
      const g = { id: uid(), label: 'Week ' + (s.games.length + 1), opponent: '', date: '', versions: [] };
      s.games.push(g); setTimeout(() => go(`#/season/${s.id}/game/${g.id}`));
    });
  },
  delGame() { if (confirm('Delete this game?')) { const r = R(); edit('seasons', r.id, s => s.games = s.games.filter(g => g.id !== r.sid2)); go('#/season/' + r.id); } },
  gameF(el) { editVer((s, g) => g[el.dataset.f] = el.value); },
  selVer(el) { ui.ver = el.dataset.id; render(); },
  addVer() {
    editVer((s, g) => {
      const v = { id: uid(), name: 'Version ' + (g.versions.length + 1), present: s.roster.map(p => p.id), h1: {}, h2: {} };
      g.versions.push(v); ui.ver = v.id;
    });
  },
  dupVer() { editVer((s, g, v) => { const c = structuredClone(v); c.id = uid(); c.name += ' copy'; g.versions.push(c); ui.ver = c.id; }); },
  renVer() { editVer((s, g, v) => { const n = prompt('Version name', v.name); if (n) v.name = n; }); },
  delVer() { if (confirm('Delete this version?')) editVer((s, g, v) => { g.versions = g.versions.filter(x => x !== v && x.id !== v.id); }); },
  toggle(el) {
    editVer((s, g, v) => {
      const id = el.dataset.pid, i = v.present.indexOf(id);
      if (i >= 0) { v.present.splice(i, 1); delete v.h1[id]; delete v.h2[id]; } else v.present.push(id);
    });
  },
  setPos(el) { editVer((s, g, v) => { const m = el.dataset.h === '1' ? v.h1 : v.h2; if (el.value) m[el.dataset.pid] = el.value; else delete m[el.dataset.pid]; }); },
  auto() {
    editVer((s, g, v, tpl) => {
      if (!autoAssign(s, v, tpl)) alert(`The template has no entry for ${presentIds(s, v).length} players. Add one under Templates.`);
    });
  },
  // templates
  addTpl() {
    const name = prompt('Template name (e.g. U12 9v9)'); if (!name) return;
    const t = { id: uid(), name, positions: ['GK', 'DEF', 'MID', 'FWD'], field: { GK: 1, DEF: 0, MID: 0, FWD: 0 }, pools: {} };
    save('templates', t); go('#/templates/' + t.id);
  },
  delTpl() { if (confirm('Delete template?')) { remove('templates', R().id); go('#/'); } },
  tplName(el) { edit('templates', R().id, t => t.name = el.value); },
  tplPos(el) {
    edit('templates', R().id, t => {
      t.positions = el.value.split(',').map(x => x.trim()).filter(Boolean);
      t.positions.forEach(p => { if (t.field[p] == null) t.field[p] = 0; Object.values(t.pools).forEach(pl => { if (pl[p] == null) pl[p] = 0; }); });
    });
  },
  tplField(el) { edit('templates', R().id, t => t.field[el.dataset.pos] = +el.value || 0); },
  tplPool(el) { edit('templates', R().id, t => t.pools[el.dataset.n][el.dataset.pos] = +el.value || 0); },
  tplAddRow() {
    const n = parseInt(prompt('Number of players'), 10); if (!n) return;
    edit('templates', R().id, t => t.pools[n] = Object.fromEntries(t.positions.map(p => [p, t.pools[n] ? t.pools[n][p] : 0])));
  },
  tplDelRow(el) { edit('templates', R().id, t => delete t.pools[el.dataset.n]); },
  export() {
    const blob = new Blob([JSON.stringify({ templates: merged('templates'), seasons: merged('seasons') }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'base.json'; a.click();
  },
  reset() { if (confirm('Discard all local changes and go back to the repo data?')) { ov = { seasons: {}, templates: {} }; persist(); render(); } },
};

function dispatch(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const isChange = e.type === 'change', isSubmit = e.type === 'submit', isClick = e.type === 'click';
  const input = ['SELECT', 'INPUT'].includes(el.tagName) && el.tagName !== 'BUTTON';
  if (el.tagName === 'FORM' ? !isSubmit : (input ? !isChange : !isClick)) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el, e);
}
document.addEventListener('click', dispatch);
document.addEventListener('change', dispatch);
document.addEventListener('submit', dispatch);
window.addEventListener('hashchange', render);

fetch('data/base.json', { cache: 'no-cache' })
  .then(r => r.json())
  .then(d => { base = { seasons: d.seasons || [], templates: d.templates || [] }; render(); })
  .catch(e => { app.innerHTML = `<p class="warn">Could not load data/base.json (${esc(e.message)}). If you opened the file directly, run a local server instead: <code>python3 -m http.server</code></p>`; });
