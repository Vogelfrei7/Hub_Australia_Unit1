// Map (index.html): Rundreise, Stationszustaende, Seitenpanel.
import {
  loadConfig, loadEvents, deriveState, getTraveller, isDemo, link, esc, fill, stars,
  calibration, UI, reducedMotion, store,
} from './core.js';
import { openCodeDialog, copyText, headerHTML } from './ui.js';

const app = document.getElementById('app');
const view = { sel: null, copied: null, just: null };
let cfg; let trav; let state; let loadInfo;

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<p class="err">Die Karte konnte nicht geladen werden (${esc(err.message)}). Bitte Seite neu laden.</p>`;
});

async function main() {
  cfg = await loadConfig();
  document.title = cfg.unit.title;
  trav = getTraveller(cfg);
  if (isDemo() && new URLSearchParams(location.search).has('reset')) store.del(cfg, 'demoExtra');
  try {
    const raw = sessionStorage.getItem('arh.just');
    if (raw) { view.just = JSON.parse(raw); sessionStorage.removeItem('arh.just'); }
  } catch { /* */ }
  const q = new URLSearchParams(location.search).get('st');
  if (q && cfg.byId[q.toUpperCase()]) view.sel = q.toUpperCase();

  if (!trav.code) {
    renderShell({ status: {}, best: {}, tips: {}, counts: { stamps: 0 }, nextId: null, express: [] });
    openCodeDialog(cfg, { closable: false, onSave: () => location.reload() });
    return;
  }
  await refresh();
}

async function refresh() {
  loadInfo = await loadEvents(cfg, trav.code);
  state = deriveState(cfg, loadInfo.events);
  if (view.just?.station && cfg.byId[view.just.station]) view.sel = view.sel || view.just.station;
  if (!view.sel) view.sel = state.nextId || cfg.routing.checkIn;
  renderShell(state);
}

/* ---------- Seite ---------- */

function renderShell(st) {
  const next = st.nextId ? cfg.byId[st.nextId] : null;
  const sub = `${esc(cfg.unit.subtitle)} · Next stop: ${next ? `${esc(next.place)} · ${esc(next.topic)}` : '–'}`;
  const right = `<a class="pill-btn" href="${link('abgabe.html')}" style="letter-spacing:0">Hand in</a>
    <a class="btn round" href="${link('passport.html')}">${UI.passport} Passport · ${st.counts.stamps} stamps</a>`;
  app.innerHTML = `
    ${headerHTML(cfg, { title: cfg.unit.title, sub, code: trav.code, right })}
    <div class="map-layout">
      <section aria-label="Map">
        <div class="map-scroll">
          <div class="map" id="map">${mapSVG(st)}${spotsHTML(st)}</div>
        </div>
        ${legendHTML()}
        <div class="status-line">${statusLine()}</div>
      </section>
      <aside class="panel" id="panel" aria-live="polite"></aside>
    </div>`;
  if (trav.code) renderPanel();
  wire();
  // Schmale Bildschirme: Karte auf die ausgewaehlte Station zentrieren
  const sc = app.querySelector('.map-scroll');
  const sel = cfg.byId[view.sel];
  if (sc && sel && sc.scrollWidth > sc.clientWidth) {
    const W = Number(cfg.map.viewBox.split(/\s+/)[2]);
    sc.scrollLeft = (sel.x / W) * sc.scrollWidth - sc.clientWidth / 2;
  }
}

function statusLine() {
  if (!loadInfo) return '';
  if (loadInfo.source === 'demo') return 'Demo mode – nothing is saved or sent.';
  const pend = loadInfo.pending ? ` ${loadInfo.pending} new stamp(s) still on the way to your teacher.` : '';
  if (!cfg.backend.appsScriptUrl) return `Not connected yet – your progress is saved on this iPad only.${pend}`;
  if (loadInfo.source === 'live') return `Up to date.${pend}`;
  if (loadInfo.source === 'cache') return `No connection – showing your saved progress.${pend}`;
  return `No connection.${pend}`;
}

function wire() {
  document.getElementById('code-pill')?.addEventListener('click', () => {
    if (isDemo()) return;
    openCodeDialog(cfg, { onSave: () => location.reload() });
  });
  app.querySelectorAll('.tag').forEach((b) => b.addEventListener('click', () => {
    view.sel = b.dataset.id;
    view.copied = null;
    app.querySelectorAll('.tag').forEach((t) => {
      t.classList.toggle('is-selected', t.dataset.id === view.sel);
      t.setAttribute('aria-pressed', String(t.dataset.id === view.sel));
    });
    renderPanel();
    if (window.innerWidth < 960) {
      document.getElementById('panel').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }));
  if (view.just && !reducedMotion()) {
    // Animation nur einmal
    setTimeout(() => { view.just = null; }, 800);
  }
}

/* ---------- Karte (SVG) ---------- */

function pt(id) { const s = cfg.byId[id]; return [s.x, s.y]; }

function geometry(st) {
  const s = st.status;
  const corridor = []; const solid = []; const arcs = []; const dots = new Set();
  for (const route of cfg.map.routes) {
    const seq = route.stations;
    for (let i = 0; i < seq.length - 1; i++) {
      const a = seq[i]; const b = seq[i + 1];
      if (s[a] === 'skipped' || s[b] === 'skipped') continue;
      if (s[a] === 'done') { corridor.push([a, b]); dots.add(a); }
      if (s[a] === 'done' && s[b] === 'done') solid.push([a, b]);
    }
    for (let i = 0; i < seq.length;) {
      if (s[seq[i]] !== 'skipped') { i++; continue; }
      let j = i;
      while (j < seq.length && s[seq[j]] === 'skipped') j++;
      const a = seq[i - 1]; const b = seq[j];
      if (a && b && s[a] === 'done') { arcs.push([a, b]); dots.add(a); dots.add(b); }
      i = j;
    }
  }
  return { corridor, solid, arcs, dots: [...dots] };
}

function arcPath(a, b) {
  const [x1, y1] = pt(a); const [x2, y2] = pt(b);
  const [W, H] = cfg.map.viewBox.split(/\s+/).slice(2).map(Number);
  const [cx0, cy0] = cfg.map.seaCenter || [W / 2, H / 2];
  const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2;
  let dx = mx - cx0; let dy = my - cy0;
  const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const cx = Math.min(W - 10, Math.max(10, mx + dx * dist * 0.55));
  const cy = Math.min(H - 10, Math.max(10, my + dy * dist * 0.55));
  const lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2 + dx * 22;
  const ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2 + dy * 22;
  return { d: `M${x1},${y1} Q${cx.toFixed(0)},${cy.toFixed(0)} ${x2},${y2}`, lx: Math.min(W - 8, Math.max(8, lx)), ly, anchor: dx > 0.3 ? 'end' : dx < -0.3 ? 'start' : 'middle' };
}

function mapSVG(st) {
  const g = geometry(st);
  const just = view.just?.station;
  const anim = (a, b) => (just && !reducedMotion() && (a === just || b === just));
  const line = (pts, attrs, cls = '') => `<polyline points="${pts.map(pt).map((p) => p.join(',')).join(' ')}" fill="none" ${attrs} ${cls ? `class="${cls}" pathLength="1" stroke-dasharray="1"` : ''}/>`;
  const lands = cfg.map.land;
  const routesBase = cfg.map.routes.map((r) => line(r.stations, 'stroke="var(--route-open)" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" stroke-linejoin="round"')).join('');
  const arcs = g.arcs.map(([a, b]) => {
    const p = arcPath(a, b);
    return `<path d="${p.d}" fill="none" stroke="var(--teal)" stroke-width="3.5" stroke-dasharray="11 8" stroke-linecap="round"/>
      <text class="express-label" x="${p.lx.toFixed(0)}" y="${p.ly.toFixed(0)}" font-size="28" text-anchor="${p.anchor}">Express</text>`;
  }).join('');
  return `
  <svg class="base" viewBox="${cfg.map.viewBox}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <clipPath id="landclip">${lands.map((d) => `<path d="${d}"/>`).join('')}</clipPath>
      <pattern id="fog" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="14" height="14" fill="var(--land)"/>
        <line x1="0" y1="0" x2="0" y2="14" stroke="var(--land-hatch, #E0C9A5)" stroke-width="5"/>
      </pattern>
    </defs>
    ${lands.map((d) => `<path d="${d}" fill="url(#fog)" stroke="var(--coast)" stroke-width="3" stroke-linejoin="round"/>`).join('')}
    <g clip-path="url(#landclip)" opacity=".75">
      ${g.corridor.map(([a, b]) => line([a, b], 'stroke="var(--land-trail)" stroke-width="120" stroke-linecap="round"', anim(a, b) ? 'reveal' : '')).join('')}
      ${g.dots.map((id) => { const [x, y] = pt(id); return `<circle cx="${x}" cy="${y}" r="60" fill="var(--land-trail)"/>`; }).join('')}
    </g>
    ${routesBase}
    ${g.solid.map(([a, b]) => line([a, b], 'stroke="var(--navy)" stroke-width="4.5" stroke-linecap="round"', anim(a, b) ? 'reveal' : '')).join('')}
    ${arcs}
    ${(cfg.map.seas || []).map((s) => `<text class="sea-label" x="${s.x}" y="${s.y}" font-size="${s.size || 28}" text-anchor="${s.anchor || 'start'}">${esc(s.text)}</text>`).join('')}
  </svg>`;
}

function spotsHTML(st) {
  const [W, H] = cfg.map.viewBox.split(/\s+/).slice(2).map(Number);
  const pops = new Set([view.just?.station, ...(view.just?.opened || [])].filter(Boolean));
  return cfg.stations.map((s) => {
    const status = st.status[s.id] || 'locked';
    const sel = s.id === view.sel;
    const label = status === 'skipped' ? `${s.place} · express` : s.place;
    const tip = st.tips[s.id];
    const aria = `${s.place}, ${s.topic}, ${s.skill}, ${cfg.texts.status[status]}${tip ? ', tip from a coach' : ''}`;
    const pop = pops.has(s.id) && !reducedMotion() ? ' pop' : '';
    return `<div class="spot" style="left:${(s.x / W) * 100}%;top:${(s.y / H) * 100}%">
      <button type="button" class="tag is-${status}${sel ? ' is-selected' : ''}${pop}" data-id="${s.id}" aria-pressed="${sel}" aria-label="${esc(aria)}">${esc(s.id)}</button>
      ${tip ? '<span class="tip-dot" aria-hidden="true">!</span>' : ''}
      <span class="place-label ${s.label}">${esc(label)}</span>
    </div>`;
  }).join('');
}

function legendHTML() {
  return `<div class="legend" aria-label="Legend">
    <span class="k"><i style="background:var(--terracotta)"></i>Stamp collected</span>
    <span class="k"><i style="background:var(--navy);box-shadow:0 0 0 4px var(--sky-glow)"></i>Next stop</span>
    <span class="k"><i style="background:var(--paper);border:2.5px solid var(--navy);width:18px;height:11px"></i>Open</span>
    <span class="k"><i style="background:var(--paper);border:2px dashed var(--teal);width:18px;height:11px"></i>Express route</span>
    <span class="k"><i style="background:var(--locked)"></i>Not yet</span>
    <span class="k"><i style="background:var(--terracotta);border-radius:50%;width:18px;height:18px;color:#fff;font-size:11px;font-weight:700;font-style:normal;text-align:center;line-height:18px">!</i>Tip from a coach</span>
  </div>`;
}

/* ---------- Seitenpanel ---------- */

function renderPanel() {
  const panel = document.getElementById('panel');
  if (!panel || !state) return;
  const c = cfg.byId[view.sel] || cfg.stations[0];
  const status = state.status[c.id];
  const coach = cfg.agents[c.coach]?.name || 'Coach';
  const best = state.best[c.id];
  const tip = state.tips[c.id];
  const paper = c.medium === 'paper';
  const t = cfg.texts;

  let note = '';
  if (status === 'next' || status === 'open') note = fill(paper ? t.note.nextPaper : t.note.nextDigital, { sheet: c.sheet || c.id, coach });
  else if (status === 'skipped') note = t.note.skipped;
  else if (status === 'locked') note = t.note.locked;
  else if (status === 'done') note = t.note.done;

  const canStart = status !== 'locked';
  const startCode = `START ${c.id} ${trav.code}`;
  const agentUrl = cfg.agents[c.coach]?.url;
  const alt = c.alt || `Illustration: ${c.place} – ${c.topic}`;

  panel.innerHTML = `
    <div class="postcard">
      <span class="id-tag">${esc(c.id)}</span>
      ${c.image ? `<img src="${esc(c.image)}" alt="${esc(alt)}" loading="lazy">` : ''}
      ${UI.image}<span>${esc(c.topic)}</span>
    </div>
    <div class="medium">${paper ? UI.paper : UI.tablet}<span>${paper ? 'Worksheet' : 'Digital'} · ${esc(coach)}</span></div>
    <div>
      <h2 class="place">${esc(c.place)}</h2>
      <div class="topic">${esc(c.topic)}</div>
      <div class="skill">${esc(c.skill)}</div>
    </div>
    <div class="status-pill ${status}">${esc(t.status[status])}</div>
    ${status === 'done' && best ? `
      <div class="result-box">
        <div class="mini-stamp" style="border-color:${esc(c.stamp.ink)};color:${esc(c.stamp.ink)}"><b>${esc(c.id)}</b><small>VISITED</small></div>
        <div class="rows">
          <div><span class="lbl">You thought</span><span class="stars" aria-label="${best.self} of 4">${stars(best.self)}</span></div>
          <div><span class="lbl">You showed</span><span class="stars shown" aria-label="${best.n} of 4">${stars(best.n)}</span></div>
        </div>
      </div>
      <div class="calib">${esc(calibration(cfg, best))}</div>` : ''}
    ${tip ? `<div class="tip-box"><strong>Tip from your ${esc(tip.coach)}:</strong> ${esc(tip.text)}</div>` : ''}
    <div class="note">${esc(note)}</div>
    ${canStart ? `
      <button type="button" class="btn" id="start">${UI.copy}<span>Copy start code &amp; open ${esc(coach)}</span></button>
      ${view.copied === c.id ? `
        <div class="copied">
          <span class="lbl">${agentUrl ? 'Copied! Paste this as your first message:' : 'Copied! The coach link is coming soon – ask your teacher. Your start code:'}</span>
          <span class="code-mono">${esc(startCode)}</span>
        </div>` : ''}` : ''}
    <div class="help" lang="de">${esc(status === 'locked' ? t.help.locked : paper ? t.help.paper : t.help.digital)}</div>`;

  const img = panel.querySelector('.postcard img');
  img?.addEventListener('error', () => img.remove()); // fehlt das Bild: Platzhalter-Postkarte bleibt sichtbar
  panel.querySelector('#start')?.addEventListener('click', () => {
    copyText(startCode);
    if (agentUrl) window.open(agentUrl, '_blank', 'noopener');
    view.copied = c.id;
    renderPanel();
  });
}
