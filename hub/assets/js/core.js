// Australia Road Trip – gemeinsame Logik fuer Map, Passport und Abgabe.
// Alles Inhaltliche kommt aus config.json; hier steht nur Verhalten.

/* ---------- Config & Theme ---------- */

export async function loadConfig() {
  const res = await fetch('config.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('config.json not found');
  const cfg = await res.json();
  cfg.byId = Object.fromEntries(cfg.stations.map((s) => [s.id, s]));
  cfg.codeRe = new RegExp(cfg.codePattern);
  applyTheme(cfg.theme);
  return cfg;
}

export function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme)) if (k.startsWith('--')) root.style.setProperty(k, v);
}

/* ---------- Storage (try/catch: privater Modus, volle Speicher) ---------- */

function key(cfg, name) { return `arh.${cfg.id}.${name}`; }

export const store = {
  get(cfg, name, fallback = null) {
    try {
      const raw = localStorage.getItem(key(cfg, name));
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(cfg, name, value) {
    try { localStorage.setItem(key(cfg, name), JSON.stringify(value)); } catch { /* ignore */ }
  },
  del(cfg, name) {
    try { localStorage.removeItem(key(cfg, name)); } catch { /* ignore */ }
  },
};

/* ---------- Demo-Modus ---------- */

export function isDemo() {
  const p = new URLSearchParams(location.search);
  if (p.get('demo') === '0') { try { sessionStorage.removeItem('arh.demo'); } catch { /* */ } return false; }
  if (p.get('demo') === '1') { try { sessionStorage.setItem('arh.demo', '1'); } catch { /* */ } return true; }
  try { return sessionStorage.getItem('arh.demo') === '1'; } catch { return false; }
}

export function link(page, params = {}) {
  const p = new URLSearchParams(params);
  if (isDemo()) p.set('demo', '1');
  const q = p.toString();
  return q ? `${page}?${q}` : page;
}

/* ---------- Traveller (Code + Kurs) ---------- */

export function getTraveller(cfg) {
  if (isDemo()) return { code: cfg.demo.code, course: cfg.demo.course };
  return { code: store.get(cfg, 'code'), course: store.get(cfg, 'course') || (cfg.courses.length === 1 ? cfg.courses[0] : null) };
}

export function setTraveller(cfg, code, course) {
  store.set(cfg, 'code', code);
  if (course) store.set(cfg, 'course', course);
}

export function normaliseCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[–—_]/g, '-');
}

/* ---------- Ereignisse ---------- */

export function normaliseEvent(e) {
  const f = Array.isArray(e.f) ? e.f : String(e.f || '').split(/[,;\s]+/);
  return {
    station: String(e.station || '').toUpperCase(),
    n: Number(e.n), self: Number(e.self), h: Number(e.h) || 0,
    f: f.map((x) => String(x).trim().toUpperCase()).filter((x) => x && x !== '-' && x !== 'NONE'),
    s: e.s || '', fb: e.fb || '',
    ts: typeof e.ts === 'number' ? e.ts : Date.parse(e.ts) || Date.now(),
    pending: !!e.pending,
  };
}

export function signature(e) {
  return [e.station, e.n, e.self, e.h, [...e.f].sort().join(','), e.s, e.fb].join('|');
}

// Laedt Ereignisse: Apps Script (live) -> Cache -> leer. Lokal gesendete, noch nicht
// im Sheet sichtbare Abgaben ("pending") werden ergaenzt, bis der Server sie liefert.
export async function loadEvents(cfg, code) {
  if (isDemo()) {
    const extra = (store.get(cfg, 'demoExtra', []) || []).map(normaliseEvent);
    return { events: cfg.demo.events.map(normaliseEvent).concat(extra), source: 'demo' };
  }
  const cacheName = `cache.${code}`;
  let server = null;
  if (cfg.backend.appsScriptUrl) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), cfg.backend.timeoutMs || 8000);
      const res = await fetch(`${cfg.backend.appsScriptUrl}?code=${encodeURIComponent(code)}`, { signal: ctrl.signal });
      clearTimeout(t);
      const data = await res.json();
      if (data && data.ok && Array.isArray(data.events)) {
        server = data.events.map(normaliseEvent);
        store.set(cfg, cacheName, { at: Date.now(), events: server });
      }
    } catch { /* offline oder blockiert -> Cache */ }
  }
  const cached = store.get(cfg, cacheName);
  const base = server || (cached ? cached.events.map(normaliseEvent) : []);

  // Pending abgleichen
  const known = new Set(base.map(signature));
  const dayAgo = Date.now() - 1000 * 60 * 60 * 24 * 3;
  const pending = (store.get(cfg, `pending.${code}`, []) || [])
    .map(normaliseEvent)
    .filter((e) => !(server && known.has(signature(e))) && e.ts > dayAgo);
  store.set(cfg, `pending.${code}`, pending);

  return {
    events: base.concat(pending.filter((e) => !known.has(signature(e)))),
    source: server ? 'live' : cached ? 'cache' : 'none',
    pending: pending.length,
  };
}

export function addPending(cfg, code, ev) {
  if (isDemo()) {
    const list = store.get(cfg, 'demoExtra', []) || [];
    list.push(ev);
    store.set(cfg, 'demoExtra', list);
    return;
  }
  const list = store.get(cfg, `pending.${code}`, []) || [];
  list.push({ ...ev, pending: true });
  store.set(cfg, `pending.${code}`, list);
}

/* ---------- Zustand ableiten (rein, ohne DOM) ---------- */

function better(a, b) {
  if (!b) return true;
  if (a.n !== b.n) return a.n > b.n;
  if (a.h !== b.h) return a.h < b.h;
  return a.ts > b.ts;
}

export function deriveState(cfg, rawEvents) {
  const events = rawEvents.filter((e) => cfg.byId[e.station]).sort((a, b) => a.ts - b.ts);
  const attempts = {};
  const best = {};
  for (const e of events) {
    (attempts[e.station] ||= []).push(e);
    if (better(e, best[e.station])) best[e.station] = e;
  }
  const done = (id) => !!attempts[id];

  // Route aus dem Check-in
  const r = cfg.routing;
  const check = best[r.checkIn];
  const adaptive = cfg.stations.filter((s) => s.adaptive).map((s) => s.id);
  const mandatory = new Set(cfg.stations.filter((s) => !s.adaptive).map((s) => s.id));
  if (check) {
    const weak = new Set(check.f.map((c) => cfg.errorCatalog[c]?.station).filter(Boolean));
    for (const id of adaptive) if (check.n <= r.allMandatoryAtOrBelow || weak.has(id)) mandatory.add(id);
  } else {
    adaptive.forEach((id) => mandatory.add(id));
  }
  const express = (id) => !!check && adaptive.includes(id) && !mandatory.has(id);
  // Eine Express-Station gilt erst als "ueberflogen", wenn sie selbst erreichbar ist
  // (sonst koennte man ueber eine Kette von Express-Stationen vorspringen).
  const memo = {};
  const available = (id, seen = new Set()) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return (cfg.byId[id].unlock?.after || []).every((p) => satisfied(p, seen));
  };
  const satisfied = (id, seen = new Set()) => {
    if (id in memo) return memo[id];
    memo[id] = done(id) || (express(id) && available(id, seen));
    return memo[id];
  };

  const status = {};
  for (const s of cfg.stations) {
    const avail = available(s.id);
    status[s.id] = done(s.id) ? 'done' : !avail ? 'locked' : express(s.id) ? 'skipped' : 'open';
  }
  const nextId = r.nextPriority.find((id) => status[id] === 'open') || null;
  if (nextId) status[nextId] = 'next';

  // Tipps: Fehler aus Schreib-Stationen -> passende G-Station,
  // bis dort ein spaeterer Versuch mit Niveau >= 3 vorliegt.
  const tips = {};
  for (const e of events) {
    const st = cfg.byId[e.station];
    if (st.coach !== 'writing') continue;
    for (const c of e.f) {
      const target = cfg.errorCatalog[c]?.station;
      if (!target || !cfg.byId[target]) continue;
      const fixed = (attempts[target] || []).some((a) => a.ts > e.ts && a.n >= 3);
      if (!fixed && !tips[target]) tips[target] = { code: c, text: cfg.errorCatalog[c].tip, coach: cfg.agents[st.coach].name, from: e.station };
    }
  }

  const ids = cfg.stations.map((s) => s.id);
  const counts = {
    stamps: ids.filter((id) => status[id] === 'done').length,
    express: ids.filter((id) => status[id] === 'skipped').length,
    toGo: ids.filter((id) => !done(id) && mandatory.has(id)).length,
  };
  return { status, best, attempts, tips, nextId, counts, mandatory, express: ids.filter(express), checkInDone: !!check };
}

// Welche Stationen sind durch eine neue Abgabe hinzugekommen?
export function newlyOpened(before, after) {
  const opened = [];
  for (const [id, st] of Object.entries(after.status)) {
    if (before.status[id] === 'locked' && st !== 'locked' && st !== 'done') opened.push({ id, status: st });
  }
  return opened;
}

/* ---------- Texte ---------- */

export function fill(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

export function stars(n) {
  const k = Math.max(0, Math.min(4, Number(n) || 0));
  return '★'.repeat(k) + '☆'.repeat(4 - k);
}

export function calibration(cfg, ev) {
  if (!ev) return '';
  const t = cfg.texts.calibration;
  return ev.n > ev.self ? t.higher : ev.n === ev.self ? t.same : t.lower;
}

export function nextStep(cfg, ev) {
  if (!ev) return '';
  return ev.fb || cfg.feedback?.[ev.station]?.[String(ev.n)] || '';
}

export function fmtDate(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
  return `${String(d.getDate()).padStart(2, '0')} ${m} ${d.getFullYear()}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Icons & Stempel ---------- */

export function iconSVG(cfg, name, { size = 32, color = 'currentColor', width = 2.2 } = {}) {
  const ic = cfg.icons[name];
  if (!ic) return '';
  const [, , w, h] = ic.viewBox.split(/\s+/).map(Number);
  const ratio = w / h;
  const W = ratio >= 1 ? size : Math.round(size * ratio);
  const H = ratio >= 1 ? Math.round(size / ratio) : size;
  return `<svg width="${W}" height="${H}" viewBox="${ic.viewBox}" fill="none" stroke="${color}" stroke-width="${width * (h / 24)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic.body}</svg>`;
}

const SHAPES = {
  circle: { w: 1, h: 1, r: '50%' },
  rect: { w: 1.08, h: 0.82, r: '14px' },
  oval: { w: 1.12, h: 0.82, r: '50%' },
};

// kind: 'done' | 'express' | 'open' | 'next' | 'locked'
export function stampHTML(cfg, station, { size = 136, kind = 'done', date = '' } = {}) {
  const st = station;
  if (kind === 'open' || kind === 'next' || kind === 'locked') {
    const cls = kind === 'next' ? 'stamp-slot is-next' : kind === 'open' ? 'stamp-slot is-open' : 'stamp-slot';
    const sub = kind === 'next' ? '<span class="slot-sub">next stop</span>' : kind === 'open' ? '<span class="slot-sub">open</span>' : '';
    return `<div class="${cls}" style="--s:${Math.round(size * 0.94)}px"><span class="slot-q">?</span><span class="slot-place">${esc(st.place)}</span>${sub}</div>`;
  }
  const isExp = kind === 'express';
  const def = isExp ? cfg.expressStamp : st.stamp;
  const shape = SHAPES[def.shape] || SHAPES.circle;
  const w = Math.round(size * shape.w);
  const h = Math.round(size * shape.h);
  const ink = def.ink;
  const text = def.text || ink;
  const title = isExp ? def.caption : st.place.toUpperCase();
  const sub = isExp ? `${st.place.toUpperCase()} · ${st.id}` : `${def.caption} · ${st.id}`;
  const fs = Math.min(size * 0.2, (w * 0.84) / (title.length * 0.46));
  const rot = isExp ? -4 : (def.rotate ?? 0);
  const border = isExp ? `${Math.max(2, size / 45)}px dashed ${ink}` : `${Math.max(4, Math.round(size / 28))}px double ${ink}`;
  return `<div class="stamp${isExp ? ' is-express' : ''}" style="width:${w}px;height:${h}px;border-radius:${shape.r};border:${border};color:${text};transform:rotate(${rot}deg)">
    ${iconSVG(cfg, def.icon, { size: Math.round(size * 0.3), color: text })}
    <span class="stamp-title" style="font-size:${fs.toFixed(1)}px">${esc(title)}</span>
    <span class="stamp-sub" style="font-size:${Math.max(9, size * 0.073).toFixed(1)}px">${esc(sub)}</span>
    ${date ? `<span class="stamp-sub" style="font-size:${Math.max(9, size * 0.073).toFixed(1)}px">${esc(date)}</span>` : ''}
  </div>`;
}

/* ---------- Ergebnis parsen & validieren (abgabe.html) ---------- */

function deepDecode(v) {
  let s = String(v ?? '');
  for (let i = 0; i < 2 && /%[0-9A-Fa-f]{2}/.test(s); i++) {
    try { s = decodeURIComponent(s.replace(/\+/g, ' ')); } catch { break; }
  }
  return s.trim();
}

export function parseFromURL(search) {
  const p = new URLSearchParams(search);
  if (!p.get('st') && !p.get('code')) return null;
  const g = (k) => deepDecode(p.get(k));
  return { code: g('code'), kurs: g('kurs'), station: g('st'), n: g('n'), self: g('self'), h: g('h'), f: g('f'), s: g('s'), fb: g('fb') };
}

// Einzeiliger Block: CODE | KURS | STATION | NIVEAU | SELBST | HILFEN | FEHLER | STAERKE | FOERDER
export function parseBlock(text) {
  const line = String(text || '')
    .replace(/```[a-z]*/gi, '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^`+|`+$/g, ''))
    .find((l) => (l.match(/\|/g) || []).length >= 6);
  if (!line) return null;
  const parts = line.replace(/^(RESULT|ERGEBNIS)\s*:\s*/i, '').split('|').map((x) => x.trim());
  if (parts.length < 9) return null;
  const [code, kurs, station, n, self, h, f, s, ...rest] = parts;
  return { code, kurs, station, n, self, h, f, s, fb: rest.join(' ') };
}

function cleanText(s) {
  return String(s || '').replace(/[|\u0000-\u001f]/g, ' ').replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function validate(cfg, raw) {
  const errors = [];
  const warnings = [];
  const code = normaliseCode(raw.code);
  const station = String(raw.station || '').trim().toUpperCase();
  const int = (v) => (/^\s*\d+\s*$/.test(String(v)) ? Number(v) : NaN);
  const n = int(raw.n);
  const self = int(raw.self);
  const h = int(raw.h === '' || raw.h == null ? 0 : raw.h);

  if (!cfg.codeRe.test(code)) errors.push(`Der Code "${code || '?'}" hat nicht das richtige Format (z. B. ${cfg.codeExample}).`);
  if (!cfg.byId[station]) errors.push(`Die Station "${station || '?'}" gibt es nicht.`);
  if (!(n >= 1 && n <= 4)) errors.push('Das Niveau muss eine Zahl von 1 bis 4 sein.');
  if (!(self >= 1 && self <= 4)) errors.push('Die Selbsteinschätzung muss eine Zahl von 1 bis 4 sein.');
  if (!(h >= 0 && h <= 3)) errors.push('Die Hilfen müssen eine Zahl von 0 bis 3 sein.');

  const fRaw = String(raw.f || '').split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => x && x !== '-' && x !== 'NONE');
  const f = [];
  for (const c of fRaw) {
    if (cfg.errorCatalog[c]) { if (!f.includes(c)) f.push(c); } else warnings.push(`Unbekannter Fehlercode "${c}" wurde ignoriert.`);
  }
  const s = cleanText(raw.s);
  const fb = cleanText(raw.fb);
  const kurs = cleanText(raw.kurs).replace(/^-$/, '');

  return { ok: errors.length === 0, errors, warnings, result: { code, kurs, station, n, self, h, f, s, fb } };
}

/* ---------- An das Google-Formular senden ---------- */

export async function submitToForm(cfg, r) {
  const form = cfg.backend.form;
  if (!form.action) return { sent: false, reason: 'not-configured' };
  const e = form.entries;
  const body = new URLSearchParams();
  const put = (k, v) => { if (e[k]) body.append(`entry.${String(e[k]).replace(/^entry\./, '')}`, String(v)); };
  put('code', r.code);
  put('kurs', r.kurs || '-');
  put('station', r.station);
  put('niveau', r.n);
  put('selbst', r.self);
  put('hilfen', r.h);
  put('fehler', r.f.join(', ') || '-');
  put('staerke', r.s || '-');
  put('foerder', r.fb || '-');
  await fetch(form.action, { method: 'POST', mode: 'no-cors', body });
  return { sent: true };
}

/* ---------- UI-Helfer ---------- */

export const UI = {
  person: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  passport: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="11" r="3"/><path d="M9 17h6"/></svg>',
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  copy: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  image: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>',
  paper: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/></svg>',
  tablet: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/></svg>',
  check: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  pin: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  brush: (w) => `<svg class="brush" width="${w}" height="12" viewBox="0 0 ${w} 12" aria-hidden="true"><path d="M4 8 C${w * 0.28} 2, ${w * 0.66} 3, ${w - 4} 6" stroke="var(--sky)" stroke-width="7" stroke-linecap="round" fill="none"/></svg>`,
};

export function reducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
