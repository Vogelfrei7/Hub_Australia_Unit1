// Australia Road Trip v2 – gemeinsame Logik für Map, Pass und Abgabe.
// Alles Inhaltliche steht in config.json; hier steht nur Verhalten.

/* ---------- Config ---------- */

export async function loadConfig() {
  const res = await fetch('config.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('config.json not found');
  const cfg = await res.json();
  cfg.codeRe = new RegExp(cfg.codePattern);
  cfg.routeById = Object.fromEntries(cfg.routes.map((r) => [r.id, r]));
  for (const [id, t] of Object.entries(cfg.topics)) t.id = id;
  for (const [id, b] of Object.entries(cfg.bonus || {})) b.id = id;
  applyTheme(cfg.theme);
  return cfg;
}

export function applyTheme(theme) {
  if (!theme) return;
  for (const [k, v] of Object.entries(theme)) if (k.startsWith('--')) document.documentElement.style.setProperty(k, v);
}

/* ---------- Storage (try/catch: privater Modus, volle Speicher) ---------- */

const key = (cfg, name) => `arh.${cfg.id}.${name}`;
export const store = {
  get(cfg, name, fallback = null) {
    try { const raw = localStorage.getItem(key(cfg, name)); return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; }
  },
  set(cfg, name, value) { try { localStorage.setItem(key(cfg, name), JSON.stringify(value)); } catch { /* */ } },
  del(cfg, name) { try { localStorage.removeItem(key(cfg, name)); } catch { /* */ } },
};

/* ---------- Demo-Modus ---------- */

export function isDemo() {
  const p = new URLSearchParams(location.search);
  if (p.get('demo') === '0') { try { sessionStorage.removeItem('arh.demo'); } catch { /* */ } return false; }
  if (p.get('demo') === '1') { try { sessionStorage.setItem('arh.demo', '1'); } catch { /* */ } return true; }
  // Echter Code in der Adresse (QR-Karte, Stempel-Link) beendet einen alten Demo-Modus im selben Tab
  if (p.has('code')) { try { sessionStorage.removeItem('arh.demo'); } catch { /* */ } return false; }
  try { return sessionStorage.getItem('arh.demo') === '1'; } catch { return false; }
}

export function link(page, params = {}) {
  const p = new URLSearchParams(params);
  if (isDemo()) p.set('demo', '1');
  const q = p.toString();
  return q ? `${page}?${q}` : page;
}

/* ---------- Kind (Code + Kurs) ---------- */

export function getTraveller(cfg) {
  if (isDemo()) return { code: cfg.demo.code, course: cfg.demo.course };
  return { code: store.get(cfg, 'code'), course: store.get(cfg, 'course') || (cfg.courses.length === 1 ? cfg.courses[0] : null) };
}
export function setTraveller(cfg, code, course) {
  store.set(cfg, 'code', code);
  if (course) store.set(cfg, 'course', course);
}
export function normaliseCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[–—_]/g, '-')
    .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ẞ|ß/g, 'SS');
}
// Tier zum Code: deutsches Codewort (BAER) → Anzeigename (Bär) und Bilddatei (bear.webp); Liste in config.animals
function animalEntry(cfg, code) {
  const w = String(code || '').split('-')[0];
  if (cfg && cfg.guest && w === cfg.guest.prefix) return cfg.guest.animal;
  const list = cfg && cfg.animals ? [...(cfg.animals.wild || []), ...(cfg.animals.cute || [])] : [];
  return list.find((a) => a.code === w) || { code: w, de: w ? w.charAt(0) + w.slice(1).toLowerCase() : '', file: w.toLowerCase() };
}
export function animalOf(cfg, code) { return animalEntry(cfg, code).de; }
export function avatarSrc(cfg, code) { return `assets/img/animals/${animalEntry(cfg, code).file}.webp`; }

/* ---------- Ereignisse ---------- */

export function normaliseEvent(e) {
  const f = Array.isArray(e.f) ? e.f : String(e.f || '').split(/[,;\s]+/);
  return {
    station: String(e.station || '').toUpperCase(),
    n: Number(e.n), self: Number(e.self) || 0, h: Number(e.h) || 0,
    f: f.map((x) => String(x).trim().toUpperCase()).filter((x) => x && x !== '-' && x !== 'NONE'),
    s: e.s && e.s !== '-' ? e.s : '', fb: e.fb && e.fb !== '-' ? e.fb : '',
    ts: typeof e.ts === 'number' ? e.ts : Date.parse(e.ts) || Date.now(),
    pending: !!e.pending,
  };
}

export function signature(e) {
  return [e.station, e.n, e.h, [...e.f].sort().join(','), e.s, e.fb].join('|');
}

// Apps Script (live) → Cache → leer. Lokal gesendete, noch nicht im Sheet sichtbare Abgaben werden ergänzt.
export async function loadEvents(cfg, code) {
  if (isDemo()) {
    // ?demo=1&fresh=1 → Demo ohne Beispieldaten (zeigt den Weg eines Kindes von Anfang an); ?reset=1 löscht Demo-Abgaben
    const q = new URLSearchParams(location.search);
    try {
      if (q.has('fresh')) sessionStorage.setItem('arh.fresh', q.get('fresh') === '0' ? '0' : '1');
      if (q.has('reset')) store.del(cfg, 'demoExtra');
    } catch { /* */ }
    let fresh = false;
    try { fresh = sessionStorage.getItem('arh.fresh') === '1'; } catch { /* */ }
    const extra = (store.get(cfg, 'demoExtra', []) || []).map(normaliseEvent);
    const k = cfg.demo.klass || {};
    const klass = { camps: k.camps || {}, today: k.today ? { ...k.today, at: k.today.at === 'today' ? new Date().toISOString() : k.today.at } : null };
    return { events: (fresh ? [] : cfg.demo.events.map(normaliseEvent)).concat(extra), source: 'demo', klass };
  }
  const cacheName = `cache.${code}`;
  let server = null; let klass = null;
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
        if (data.klass) { klass = data.klass; store.set(cfg, 'klass', klass); }
      }
    } catch { /* offline oder blockiert → Cache */ }
  }
  const cached = store.get(cfg, cacheName);
  const base = server || (cached ? cached.events.map(normaliseEvent) : []);
  const known = new Set(base.map(signature));
  const limit = Date.now() - 1000 * 60 * 60 * 24 * 3;
  const pending = (store.get(cfg, `pending.${code}`, []) || []).map(normaliseEvent)
    .filter((e) => !(server && known.has(signature(e))) && e.ts > limit);
  store.set(cfg, `pending.${code}`, pending);
  const pre = isGuest(cfg, code) ? (cfg.guest.events || []).map(normaliseEvent) : [];
  return {
    events: pre.concat(base, pending.filter((e) => !known.has(signature(e)))),
    source: server ? 'live' : cached ? 'cache' : 'none',
    pending: pending.length,
    klass: klass || store.get(cfg, 'klass', null),
  };
}

// Gast-Codes (z. B. GAST-KO01): starten mit einer vorbereiteten Reise, ihre Abgaben zählen nicht in der Klassenauswertung
export function isGuest(cfg, code) {
  return !!(cfg.guest && String(code || '').startsWith(cfg.guest.prefix + '-'));
}

// Lagerfeuer (gemeinsame Unterrichtsphase): Datum aus dem Dashboard, sonst Vorgabe "lit" aus config.json; false = noch nicht
export function campLit(cfg, klass, id) {
  const camp = cfg.topics[id]?.camp;
  if (!camp) return false;
  const st = klass?.camps || {};
  return Object.prototype.hasOwnProperty.call(st, id) ? st[id] : (camp.lit || false);
}

// "Today in class" gilt nur am Tag, an dem die Lehrkraft ihn gesetzt hat
export function todayInfo(klass) {
  const t = klass?.today;
  if (!t || !t.mode) return null;
  const d = new Date(t.at);
  return !isNaN(d) && d.toDateString() === new Date().toDateString() ? t : null;
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

/* ---------- Argument-Plan (lesson.html?st=ARG) ---------- */

export const planKey = (from, code) => `plan.${from}.${code}`;

// Plan als eine Zeile: Das Coach-Feld ist einzeilig, Zeilenumbrüche gingen beim Einfügen verloren
export function planLine(cfg, from, plan) {
  const ls = cfg.topics[from]?.lesson;
  if (!ls || !plan?.picks?.length) return '';
  const clean = (t) => String(t || '').replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const arg = (a) => ls.args.find((x) => x.id === a) || { side: '?', short: a };
  return [`MY PLAN (${ls.question})`, `opinion: ${plan.opinion || '?'}`,
    ...plan.picks.map((a, i) => `${i + 1} ${arg(a).side}: ${arg(a).short} – ${clean(plan.reasons?.[a])}`)].join(' | ');
}

/* ---------- Schritt-IDs: <THEMA>-B (Check-in/Startwert), -W1 (Blatt), -W2 … (Zusatzblatt), -P (Üben), -F (Final check) ---------- */

export function stepInfo(cfg, id) {
  const m = String(id || '').toUpperCase().match(/^([A-Z]{2,6})-(W(\d)|P|F|B)$/);
  const topic = m && cfg.topics[m[1]];
  if (!topic) return null;
  const kind = m[2] === 'P' ? 'practice' : m[2] === 'F' ? 'final' : m[2] === 'B' ? 'baseline' : m[3] === '1' ? 'sheet' : 'extra';
  const label = { sheet: 'Worksheet', extra: `Worksheet ${m[3]}`, practice: 'Practice', final: 'Final check', baseline: 'Check-in' }[kind];
  return { id: String(id).toUpperCase(), topicId: m[1], topic, kind, label };
}

/* ---------- Fortschritt ableiten (rein, ohne DOM) ---------- */

// opts.open: Stationen, an denen die Klasse schon ist (Lagerfeuer angezündet) – dort darf jedes Kind arbeiten
export function progress(cfg, rawEvents, opts = {}) {
  const open = new Set(opts.open || []);
  const events = rawEvents.map((e) => ({ ...e, si: stepInfo(cfg, e.station) })).filter((e) => e.si).sort((a, b) => a.ts - b.ts);
  const topics = {};
  for (const id of Object.keys(cfg.topics)) topics[id] = { id, w1: null, p: null, final: null, base: null, extra: false, attempts: [], last: null };
  const better = (a, b) => !b || a.n > b.n || (a.n === b.n && a.h < b.h);
  const sheets = {}; const practices = {};
  for (const e of events) {
    const t = topics[e.si.topicId];
    if (e.si.kind === 'baseline') { if (!t.base) t.base = e; continue; }   // erster Check-in zählt als Startwert
    t.attempts.push(e);
    t.last = e;
    if (e.si.kind === 'sheet' || e.si.kind === 'extra') {
      (sheets[t.id] ||= new Set()).add(e.si.id);
      if (better(e, t.w1)) t.w1 = e;                                       // weißes ODER goldenes Blatt = Arbeitsblatt-Stern
    }
    if (e.si.kind === 'practice') { practices[t.id] = (practices[t.id] || 0) + 1; if (better(e, t.p)) t.p = e; }
    if (e.si.kind === 'final' && better(e, t.final)) t.final = e;
  }
  const checkinDone = Object.values(topics).some((t) => t.base);
  for (const t of Object.values(topics)) {
    if (cfg.topics[t.id].page) {   // Übungsseite ohne Coach (lesson.html): einmal durcharbeiten = Stempel
      Object.assign(t, { extra: false, stars: t.p ? 1 : 0, complete: !!t.p, stamp: !!t.p, gold: false, single: true });
      continue;
    }
    t.extra = (sheets[t.id]?.size || 0) >= 2 || (practices[t.id] || 0) >= 2;   // zweites Blatt oder zweite Übung
    t.stars = (t.w1 ? 1 : 0) + (t.p ? 1 : 0) + (t.extra ? 1 : 0);
    t.complete = !!(t.w1 && t.p);
    t.stamp = t.stars > 0;
    t.gold = !!(t.base && cfg.checkin && t.base.n >= cfg.checkin.goldFrom);  // Empfehlung: gleich das goldene Blatt
  }
  const start = cfg.checkin && topics.START;
  if (start) { start.complete = checkinDone; start.stamp = checkinDone; start.stars = 0; start.checkin = true; }

  // Zustand je Station: done · now · open · later · soon. Genau ein "now" pro Route (dort steht der Van);
  // "open" = später auf der Route, aber die Klasse ist schon dort. "soon"-Stationen blockieren nicht.
  const status = {};
  const now = {};
  for (const r of cfg.routes) {
    let found = false;
    for (const id of r.stops) {
      const def = cfg.topics[id]; const t = topics[id];
      if (t.complete) status[id] = 'done';
      else if (def.status === 'soon' && !t.attempts.length) status[id] = 'soon';
      else if (!found) { status[id] = 'now'; now[r.id] = id; found = true; }
      else status[id] = open.has(id) ? 'open' : 'later';
    }
  }

  const tenses = cfg.routes.find((r) => r.id === 'grammar').stops.filter((id) => /^\d+$/.test(cfg.topics[id].number) && !cfg.topics[id].contrast);
  const achievements = {
    levelup: Object.values(topics).some((t) => t.w1 && t.p && t.p.n > t.w1.n),
    allfive: tenses.length > 0 && tenses.every((id) => topics[id].complete),
    stars: tenses.length > 0 && tenses.every((id) => topics[id].stars === 3),
  };
  const finalDone = Object.values(topics).some((t) => t.final);
  const stampSlots = Object.keys(cfg.topics).length + Object.keys(cfg.bonus || {}).length;
  return {
    topics, status, now, achievements, finalDone,
    stamps: Object.values(topics).filter((t) => t.stamp).length + (finalDone ? 1 : 0),
    stampSlots,
    starCount: Object.values(topics).reduce((s, t) => s + t.stars, 0),
  };
}

// Neue Achievements und Sterne durch eine Abgabe
export function diff(before, after) {
  const newAch = Object.keys(after.achievements).filter((k) => after.achievements[k] && !before.achievements[k]);
  const opened = Object.keys(after.status).filter((id) => before.status[id] !== 'now' && after.status[id] === 'now');
  return { newAch, opened };
}

/* ---------- Hilfen ---------- */

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function bold(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
export function fmtDate(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
  return `${String(d.getDate()).padStart(2, '0')} ${m} ${d.getFullYear()}`;
}
export function reducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ---------- Icons, Sterne, Stempel ---------- */

export function iconSVG(cfg, name, { size = 32, color = 'currentColor', width = 2.2 } = {}) {
  const ic = cfg.icons[name];
  if (!ic) return '';
  const [, , w, h] = ic.viewBox.split(/\s+/).map(Number);
  const W = w >= h ? size : Math.round((size * w) / h);
  const H = w >= h ? Math.round((size * h) / w) : size;
  return `<svg width="${W}" height="${H}" viewBox="${ic.viewBox}" fill="none" stroke="${color}" stroke-width="${width * (h / 24)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ic.body}</svg>`;
}

function starSVG(on, size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="${on ? '#E0A526' : 'none'}" stroke="${on ? '#B07F12' : '#BBA98A'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
export function starsHTML(n, { size = 18 } = {}) {
  return `<span class="stars" role="img" aria-label="${n} of 3 stars">${starSVG(n > 0, size)}${starSVG(n > 1, size)}${starSVG(n > 2, size)}</span>`;
}
export function starOne(on, size = 22) {
  return `<span class="star1" role="img" aria-label="${on ? 'star collected' : 'no star yet'}">${starSVG(on, size)}</span>`;
}

const SHAPES = { circle: { w: 1, h: 1, r: '50%' }, rect: { w: 1.1, h: 0.84, r: '16px' }, oval: { w: 1.14, h: 0.84, r: '50%' } };

// Stempel eines Themas. stars = null → ohne Sternreihe
export function stampHTML(cfg, topic, { size = 150, stars = null, date = '' } = {}) {
  const def = topic.stamp || { shape: 'circle', ink: '#1B2A55', icon: 'flag' };
  if (def.image) {
    // Eigenes Stempelbild (z. B. aus ChatGPT): assets/img/stamps/<ID>.png, in config: "stamp": { "image": "…" }
    return `<div class="stamp stamp-img" style="width:${size}px"><img src="${esc(def.image)}" alt="${esc(topic.place)} stamp" width="${size}" height="${size}" onerror="this.parentNode.classList.add('broken')">
      ${stars != null ? `<span class="stamp-stars">${starsHTML(stars, { size: Math.round(size * 0.13) })}</span>` : ''}</div>`;
  }
  const shape = SHAPES[def.shape] || SHAPES.circle;
  const w = Math.round(size * shape.w); const h = Math.round(size * shape.h);
  const title = topic.place.toUpperCase();
  const fs = Math.min(size * 0.19, (w * 0.82) / (title.length * 0.47));
  const sub = Math.max(9, size * 0.07).toFixed(1);
  return `<div class="stamp" style="width:${w}px;height:${h}px;border-radius:${shape.r};border:${Math.max(4, Math.round(size / 28))}px double ${def.ink};color:${def.ink}">
    ${iconSVG(cfg, def.icon, { size: Math.round(size * 0.3), color: def.ink })}
    <span class="stamp-title" style="font-size:${fs.toFixed(1)}px">${esc(title)}</span>
    <span class="stamp-sub" style="font-size:${sub}px">${esc(topic.name.toUpperCase())}</span>
    ${date ? `<span class="stamp-sub" style="font-size:${sub}px">${esc(date)}</span>` : ''}
    ${stars != null ? `<span class="stamp-stars">${starsHTML(stars, { size: Math.round(size * 0.12) })}</span>` : ''}
  </div>`;
}

export function slotHTML(topic, { size = 130, state = 'later', route = null } = {}) {
  const square = route && route.shape === 'square';
  const color = state === 'now' && route ? route.color : '#CDBC9E';
  return `<div class="slot slot-${state}" style="width:${size}px;height:${size}px;border-radius:${square ? '18px' : '50%'};border-color:${color};${state === 'now' && route ? `background:${route.soft}` : ''}">
    <span class="slot-n" style="${state === 'now' && route ? `color:${route.color}` : ''}">${esc(topic.number || '?')}</span>
    <span class="slot-place">${esc(topic.place)}</span>
    <span class="slot-sub">${state === 'now' ? 'now (jetzt)' : state === 'soon' ? 'coming soon' : ''}</span>
  </div>`;
}

export function badgeHTML(cfg, a, unlocked, size = 64) {
  return `<div class="badge ${unlocked ? 'on' : 'off'}" title="${esc(a.de)}">
    <span class="badge-disc" style="width:${size}px;height:${size}px${a.image ? ';background:none;box-shadow:none;border:0' : ''}">${a.image
    ? `<img src="${esc(a.image)}" alt="">`
    : iconSVG(cfg, a.icon, { size: Math.round(size * 0.5), color: unlocked ? '#7A4E00' : '#A99A80', width: 2 })}</span>
    <span class="badge-name">${esc(a.name)}</span>
    <span class="badge-de">${esc(a.de)}</span>
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

// Einzeiliger Block: CODE | KURS | SCHRITT | NIVEAU | SELBST | HILFEN | FEHLER | STAERKE | TIPP
export function parseBlock(text) {
  const line = String(text || '').replace(/```[a-z]*/gi, '').split(/\r?\n/)
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
  const errors = []; const warnings = [];
  const code = normaliseCode(raw.code);
  const station = String(raw.station || '').trim().toUpperCase();
  const int = (v) => (/^\s*\d+\s*$/.test(String(v)) ? Number(v) : NaN);
  const n = int(raw.n);
  const selfMissing = raw.self == null || ['', '-'].includes(String(raw.self).trim());
  const self = selfMissing ? null : int(raw.self);
  const h = int(raw.h === '' || raw.h == null ? 0 : raw.h);
  const step = stepInfo(cfg, station);

  if (!cfg.codeRe.test(code)) errors.push(`Der Code "${code || '?'}" hat nicht das richtige Format (z. B. ${cfg.codeExample}).`);
  if (!step) errors.push(`Den Schritt "${station || '?'}" gibt es nicht.`);
  if (!(n >= 1 && n <= 4)) errors.push('Das Niveau muss eine Zahl von 1 bis 4 sein.');
  if (!selfMissing && !(self >= 1 && self <= 4)) errors.push('Die Selbsteinschätzung muss eine Zahl von 1 bis 4 sein.');
  if (!(h >= 0 && h <= 3)) errors.push('Die Hilfen müssen eine Zahl von 0 bis 3 sein.');

  const areas = step?.topic.areas || [];
  const f = [];
  for (const c of String(raw.f || '').split(/[,;\s]+/).map((x) => x.trim().toUpperCase()).filter((x) => x && x !== '-' && x !== 'NONE')) {
    if (areas.includes(c)) { if (!f.includes(c)) f.push(c); } else warnings.push(`Unbekannter Fehlercode "${c}" wurde ignoriert.`);
  }
  const kurs = cleanText(raw.kurs).replace(/^-$/, '');
  return { ok: errors.length === 0, errors, warnings, result: { code, kurs, station, n, self, h, f, s: cleanText(raw.s), fb: cleanText(raw.fb) } };
}

/* ---------- An das Google-Formular senden ---------- */

export async function submitToForm(cfg, r) {
  const form = cfg.backend.form;
  if (!form.action) return { sent: false };
  const e = form.entries;
  const body = new URLSearchParams();
  const put = (k, v) => { if (e[k]) body.append(`entry.${String(e[k]).replace(/^entry\./, '')}`, String(v)); };
  put('code', r.code); put('kurs', r.kurs || '-'); put('station', r.station); put('niveau', r.n);
  put('selbst', r.self ?? '-'); put('hilfen', r.h); put('fehler', r.f.join(', ') || '-');
  put('staerke', r.s || '-'); put('foerder', r.fb || '-');
  await fetch(form.action, { method: 'POST', mode: 'no-cors', body });
  return { sent: true };
}

/* ---------- UI-Symbole ---------- */

const ico = (d, s = 18, w = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const UI = {
  person: ico('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  passport: ico('<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="11" r="3"/><path d="M9 17h6"/>'),
  help: ico('<circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.3-2.4 3.8"/><path d="M12 17h.01"/>'),
  back: ico('<path d="M15 18l-6-6 6-6"/>'),
  copy: ico('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', 20),
  book: ico('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7M8 11h7"/>', 20),
  paper: ico('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>', 17),
  tablet: ico('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/>', 17),
  check: ico('<path d="M5 12l5 5L20 7"/>', 22, 2.6),
  bulb: ico('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>', 22),
  close: ico('<path d="M6 6l12 12M18 6L6 18"/>', 22, 2.2),
  image: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>', 30, 1.8),
  lock: ico('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 18),
  brush: (w) => `<svg class="brush" width="${w}" height="12" viewBox="0 0 ${w} 12" aria-hidden="true"><path d="M4 8 C${w * 0.28} 2, ${w * 0.66} 3, ${w - 4} 6" stroke="var(--sky)" stroke-width="7" stroke-linecap="round" fill="none"/></svg>`,
};
