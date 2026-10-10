// Map v2 (index.html): zwei Routen, Stationen mit 3 Sternen, Regeln, Coach direkt auf der Seite.
import {
  loadConfig, loadEvents, progress, getTraveller, setTraveller, normaliseCode, isDemo, link, esc, starsHTML, starOne, UI, store, reducedMotion, avatarSrc, campLit, todayInfo, isGuest, planLine, planKey,
} from './core.js?v=3.3';
import { openCodeDialog, openRules, openMissed, copyText, headerHTML, wireCodePill } from './ui.js?v=3.3';
import { terrainSVG, motifsSVG, vanHTML, campSVG } from './scenery.js?v=3.3';

const app = document.getElementById('app');
const view = { sel: null, copied: false, just: null };
let cfg; let trav; let pr; let info;

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<p class="err">Die Karte konnte nicht geladen werden (${esc(err.message)}). Bitte Seite neu laden.</p>`;
});

async function main() {
  cfg = await loadConfig();
  document.title = cfg.unit.title;
  takeCodeFromQR();
  trav = getTraveller(cfg);
  if (isDemo() && new URLSearchParams(location.search).has('reset')) store.del(cfg, 'demoExtra');
  try { const j = sessionStorage.getItem('arh.just'); if (j) { view.just = JSON.parse(j); sessionStorage.removeItem('arh.just'); } } catch { /* */ }
  const q = (new URLSearchParams(location.search).get('st') || '').toUpperCase();
  if (cfg.topics[q] || cfg.bonus?.[q]) view.sel = q;

  if (!trav.code) {
    pr = progress(cfg, []);
    render();
    openCodeDialog(cfg, { closable: false, onSave: () => location.reload() });
    return;
  }
  info = await loadEvents(cfg, trav.code);
  // Lagerfeuer angezündet = die Klasse ist dort → Station für alle offen
  const open = Object.keys(cfg.topics).filter((id) => campLit(cfg, info.klass, id));
  pr = progress(cfg, info.events, { open });
  if (!view.sel) view.sel = pr.now.grammar || pr.now.writing || 'SPR';
  render();
}

// QR-Code der Code-Karte: …/hub/?code=TIGER-K7Q2 → Code übernehmen, dann aus der Adresszeile entfernen
function takeCodeFromQR() {
  const url = new URL(location.href);
  const raw = url.searchParams.get('code');
  if (!raw || isDemo()) return;
  const code = normaliseCode(raw);
  url.searchParams.delete('code');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  if (!cfg.codeRe.test(code)) return;
  const current = getTraveller(cfg).code;
  if (!current) setTraveller(cfg, code, cfg.courses.length === 1 ? cfg.courses[0] : null);
  else if (current !== code && window.confirm(`Use the code ${code} on this iPad? (Diesen Code auf diesem iPad verwenden? Bisher: ${current})`)) {
    setTraveller(cfg, code, getTraveller(cfg).course);
  }
}

/* ---------- Seite ---------- */

function render() {
  app.innerHTML = `
    ${headerHTML(cfg, { code: trav.code, stamps: pr.stamps, slots: pr.stampSlots })}
    <div class="map-layout">
      <section aria-label="Map">
        ${todayBanner()}
        <div class="map-scroll"><div class="map" id="map">${mapSVG()}${camps()}${markers()}</div></div>
        ${legend()}
        <div class="status-line">${statusLine()}</div>
      </section>
      <aside class="panel" id="panel" aria-live="polite"></aside>
    </div>`;
  wireCodePill(cfg);
  app.querySelectorAll('.marker, .camp').forEach((b) => b.addEventListener('click', () => {
    view.sel = b.dataset.id; view.copied = false;
    app.querySelectorAll('.marker').forEach((m) => m.classList.toggle('is-selected', m.dataset.id === view.sel));
    renderPanel();
    if (window.innerWidth < 960) document.getElementById('panel').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
  }));
  if (trav.code) renderPanel();
  const waking = app.querySelectorAll('.sc.waking');   // neuer Stempel: Motive dieser Station werden farbig
  if (waking.length) setTimeout(() => waking.forEach((g) => g.classList.remove('sleep')), 700);
  const sc = app.querySelector('.map-scroll'); const s = cfg.topics[view.sel] || cfg.bonus?.[view.sel];
  if (sc && s && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = (s.x / 1000) * sc.scrollWidth - sc.clientWidth / 2;
}

const TODAY = {
  together: ['🔥', 'Today we work together in class – look at the board.', 'Heute arbeiten wir gemeinsam – schau nach vorne.'],
  coach: ['🤖', 'Coach time! Work at your stop on the map.', 'Coach-Zeit! Arbeite an deiner Station.'],
  book: ['📖', 'Today: book and paper – no iPad needed.', 'Heute: Buch und Papier – kein iPad nötig.'],
};
function todayBanner() {
  const t = todayInfo(info?.klass);
  if (!t || !TODAY[t.mode]) return '';
  const [ic, en, de] = TODAY[t.mode];
  return `<div class="today ${t.mode}" role="status"><span class="today-ic" aria-hidden="true">${ic}</span>
    <span><b>${esc(en)}</b> <span class="de">(${esc(de)})</span>${t.text ? `<br><span class="today-note">${esc(t.text)}</span>` : ''}</span></div>`;
}

// Lagerfeuer auf der Route: gemeinsame Phasen der ganzen Klasse (keine Sterne)
function camps() {
  return Object.entries(cfg.topics).filter(([, d]) => d.camp).map(([id, d]) => {
    const lit = campLit(cfg, info?.klass, id);
    return `<div class="spot" style="left:${d.camp.x / 10}%;top:${d.camp.y / 8}%">
      <button type="button" class="camp ${lit ? 'lit' : 'unlit'}" data-id="${id}" aria-label="${esc(`Together in class: ${d.camp.title}${lit ? '' : ' (coming up)'}`)}">${campSVG(!!lit)}</button>
    </div>`;
  }).join('');
}

function campRow(id, def) {
  const lit = campLit(cfg, info?.klass, id);
  const when = lit ? new Date(lit) : null;
  const date = when && !isNaN(when) ? when.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '';
  return `<div class="camp-row ${lit ? 'lit' : 'unlit'}">
    <span class="camp-ic">${campSVG(!!lit)}</span>
    <span><b>Together in class</b> <span class="de-inline">(Gemeinsam im Unterricht)</span><br>${esc(def.camp.title)}
      <span class="de">(${esc(def.camp.titleDe)})</span></span>
    <span class="camp-side">${lit ? `<span class="step-tag">done ✓ ${esc(date)}</span><button type="button" class="btn ghost round" id="missed">Missed it? <span class="de-inline">(Gefehlt?)</span></button>`
      : '<span class="step-tag">coming up</span>'}</span>
  </div>`;
}

function statusLine() {
  if (!info) return '';
  if (info.source === 'demo') return 'Demo – nothing is saved. (Demo – nichts wird gespeichert.)';
  const pend = info.pending ? ` ${info.pending} new result(s) on the way to your teacher.` : '';
  if (info.source === 'live') return `Up to date.${pend}`;
  return `No connection – showing your saved progress.${pend} (Keine Verbindung – gespeicherter Stand.)`;
}

/* ---------- Karte ---------- */

function mapSVG() {
  const lands = cfg.map.land;
  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
  const routeSVG = cfg.routes.map((r) => {
    const doneIdx = [];
    r.stops.forEach((id, i) => { if (pr.status[id] === 'done') doneIdx.push(i); });
    const isGrammar = r.shape === 'circle';
    // begangener Teil: vom Start bis zur letzten erledigten Station (auf dem Pfad)
    const lastDone = doneIdx.length ? Math.max(...doneIdx) : -1;
    const stopPt = (id) => [cfg.topics[id].x, cfg.topics[id].y];
    let walked = '';
    if (lastDone >= 0) {
      const target = stopPt(r.stops[lastDone + 1] || r.stops[lastDone]);
      const cut = r.path.findIndex((p) => p[0] === target[0] && p[1] === target[1]);
      const seg = r.path.slice(0, cut >= 0 ? cut + 1 : r.path.length);
      if (seg.length > 1) walked = `<polyline points="${pts(seg)}" fill="none" stroke="${r.color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    return `<polyline points="${pts(r.path)}" fill="none" stroke="${r.color}" stroke-width="${isGrammar ? 4 : 5}" stroke-dasharray="${isGrammar ? '2 11' : '12 9'}" stroke-linecap="round" stroke-linejoin="round" opacity="${isGrammar ? 0.7 : 0.85}"/>${walked}
      <text x="${r.label.x}" y="${r.label.y}" font-family="Caveat Brush, cursive" font-size="34" fill="${r.color}" text-anchor="middle">${esc(r.name)}</text>
      <text x="${r.label.x}" y="${r.label.y + 24}" font-family="Atkinson Hyperlegible, sans-serif" font-size="17" font-weight="700" fill="${r.color}" text-anchor="middle">(${esc(r.nameDe)} – ${esc(r.hint)})</text>`;
  }).join('');
  return `<svg class="base" viewBox="${cfg.map.viewBox}" preserveAspectRatio="none" aria-hidden="true">
    ${terrainSVG(lands)}
    <g class="scenery">${motifsSVG(pr, view.just?.topic)}</g>
    ${routeSVG}
    ${(cfg.map.seas || []).map((s) => `<text class="sea-label" x="${s.x}" y="${s.y}" font-size="${s.size}" text-anchor="${s.anchor}">${esc(s.text)}</text>`).join('')}
  </svg>`;
}

function markers() {
  const items = [];
  for (const r of cfg.routes) for (const id of r.stops) items.push({ id, def: cfg.topics[id], route: r, state: pr.status[id], t: pr.topics[id] });
  for (const [id, b] of Object.entries(cfg.bonus || {})) items.push({ id, def: { ...b, number: 'Final' }, route: null, state: pr.finalDone ? 'done' : b.status, bonus: true });
  const pops = new Set([view.just?.topic].filter(Boolean));
  const vanAt = trav.code ? (pr.now.grammar || pr.now.writing) : null;
  return items.map(({ id, def, route, state, t, bonus }) => {
    const sel = id === view.sel;
    const color = route ? route.color : '#1F5F68';
    const wide = String(def.number).length > 1;
    const cls = ['marker', `is-${state}`, route?.shape === 'square' ? 'sq' : bonus ? 'bonus' : 'rd', wide ? 'wide' : '', sel ? 'is-selected' : '', def.goal ? 'goal' : '', pops.has(id) && !reducedMotion() ? 'pop' : ''].join(' ');
    const label = `${route ? `${route.name}, ` : 'Bonus, '}${def.number}, ${def.place}, ${state}`;
    const dots = route && !def.optional && route.shape === 'circle' && t && !t.checkin
      ? `<span class="dots">${[0, 1, 2].map((i) => `<i class="${i < t.stars ? 'on' : ''}"></i>`).join('')}</span>` : '';
    return `<div class="spot" style="left:${def.x / 10}%;top:${def.y / 8}%;--rc:${color}">
      ${id === vanAt ? vanHTML(esc(avatarSrc(cfg, trav.code)), (def.van || (def.label === 'above' ? 'side' : 'top'))) : state === 'now' ? '<span class="now-flag">NOW</span>' : ''}
      <button type="button" class="${cls}" data-id="${id}" aria-pressed="${sel}" aria-label="${esc(label)}">
        ${state === 'done' ? UI.check : `<span>${esc(def.number)}</span>`}
      </button>
      ${dots}
      <span class="place-label ${def.label}${route?.shape === 'square' ? ' w' : ''}${bonus ? ' b' : ''}">${esc(def.goal ? `${def.place} · goal` : def.place)}</span>
    </div>`;
  }).join('');
}

function legend() {
  return `<div class="legend">
    ${cfg.routes.map((r) => `<span class="k"><i style="background:${r.color};border-radius:${r.shape === 'square' ? '5px' : '50%'}"></i><b>${esc(r.name)}</b>&nbsp;(${esc(r.nameDe)})</span>`).join('')}
    <span class="k">${starsHTML(1, { size: 16 })}&nbsp;one star per step (ein Stern pro Schritt)</span>
    <span class="k"><i style="background:#fff;border:2.5px dashed #3F8E99;border-radius:10px;width:28px"></i><b>Final check</b>&nbsp;(Bonus)</span>
  </div>`;
}

/* ---------- Panel ---------- */

function routeLine(def, route) {
  if (!route) return 'BONUS · ' + def.opens.toUpperCase();
  const stops = route.stops.filter((id) => !cfg.topics[id].optional && /^\d+$/.test(cfg.topics[id].number));
  if (!/^\d+$/.test(def.number)) return `${route.name.toUpperCase()} · ${def.number.toUpperCase()}`;
  return `${route.name.toUpperCase()} · STOP ${def.number} OF ${stops.length}`;
}

function renderPanel() {
  const panel = document.getElementById('panel');
  const id = view.sel;
  const bonus = cfg.bonus?.[id];
  const def = bonus || cfg.topics[id];
  if (!def) { panel.innerHTML = ''; return; }
  const route = bonus ? null : cfg.routeById[def.route];
  const state = bonus ? (pr.finalDone ? 'done' : def.status) : pr.status[id];
  const t = pr.topics[id];
  const color = route ? route.color : '#1F5F68';

  if (bonus) {
    panel.innerHTML = `
      <div class="route-chip" style="background:${color}">${esc(routeLine(def, null))}</div>
      <h2 class="place">${esc(def.name)}</h2>
      <div class="skill">Practice just what you need for the test.</div>
      <div class="topic">(Übe genau das, was du für den Test brauchst.)</div>
      <div class="info-box teal">${UI.lock}<span><b>Opens on ${esc(def.opens)}.</b><br>Your coach makes tasks just for you – from your own results.<br><span class="de">(Öffnet am ${esc(def.opensDe)}. Dein Coach macht Aufgaben nur für dich – aus deinen Ergebnissen.)</span></span></div>`;
    return;
  }

  const steps = cfg.steps.map((s) => {
    const done = s.id === 'W1' ? !!t.w1 : s.id === 'P' ? !!t.p : t.extra;
    return `<li class="step ${done ? 'done' : ''}">${starOne(done, 24)}
      <span><b>${esc(s.star)}</b>${s.optional ? ' <span class="opt">optional</span>' : ''}<br><span class="de">${esc(s.de)}</span></span>
      <span class="step-tag">${done ? 'done ✓' : ''}</span></li>`;
  }).join('');

  let body = '';
  if (t.checkin) {
    body = state === 'done'
      ? `<div class="info-box teal">${UI.check}<span><b>Check-in done!</b> We know your starting point. <span class="de">(Check-in geschafft – dein Startpunkt ist gespeichert.)</span></span></div>`
      : `<div class="action" style="--rc:${color}">
          <div class="action-h">WHAT TO DO NOW <span class="de-inline">(Was du jetzt machst)</span></div>
          <p style="margin:0"><b>Start with the check-in:</b> show what you can do already. No stars for right or wrong – it is just your starting point.<br>
            <span class="de">(Starte mit dem Check-in: Zeig, was du schon kannst. Es zählt nicht für Punkte – es ist nur dein Startpunkt.)</span></p>
          <a class="btn" href="${link('checkin.html')}">Start the check-in (Check-in starten)</a>
        </div>`;
  } else if (def.page && state !== 'soon' && state !== 'later') {
    body = pageBox(id, t, color);
  } else if (state === 'soon') {
    body = `<div class="info-box">${UI.lock}<span><b>Coming soon.</b> This stop opens later. <span class="de">(Kommt bald. Diese Station öffnet später.)</span></span></div>`;
  } else if (state === 'later') {
    body = `<div class="info-box">${UI.lock}<span><b>Later.</b> First finish the stop before. <span class="de">(Später. Mach zuerst den Stopp davor fertig.)</span></span></div>`;
  } else {
    body = actionBox(def, t, color);
  }

  panel.innerHTML = `
    <div class="route-chip" style="background:${color}">${esc(routeLine(def, route))}</div>
    <div class="postcard">
      ${def.image ? `<img src="${esc(def.image)}" alt="${esc(def.alt || `${def.place}: ${def.topic}`)}" loading="lazy">` : ''}
      ${UI.image}<span>${esc(def.topic)}</span>
    </div>
    <div>
      <h2 class="place">${esc(def.place)}</h2>
      <div class="skill">${esc(def.name)}</div>
      <div class="topic">Topic: ${esc(def.topic)}</div>
    </div>
    ${def.rules ? `<button type="button" class="btn ghost" id="rules">${UI.book}<span>Rules <span class="de-inline">(Regeln)</span></span></button>` : ''}
    ${def.camp && state !== 'soon' ? campRow(id, def) : ''}
    ${state !== 'soon' && route?.shape === 'circle' && !def.optional && !t.checkin ? `<ul class="steps">${steps}</ul>` : ''}
    ${body}`;

  panel.querySelector('.postcard img')?.addEventListener('error', (e) => e.target.remove());
  panel.querySelector('#rules')?.addEventListener('click', () => openRules(cfg, def));
  panel.querySelector('#missed')?.addEventListener('click', () => openMissed(cfg, def));
  panel.querySelector('#copy')?.addEventListener('click', () => {
    const sc = panel.querySelector('#startcode');
    copyText(sc.dataset.copy || sc.textContent);
    view.copied = true;
    panel.querySelector('#copied').hidden = false;
  });
}

// Station mit eigener Übungsseite (lesson.html) statt Coach
function pageBox(id, t, color) {
  if (t.complete) {
    return `<div class="info-box teal">${UI.check}<span><b>Station done!</b> You can do it again any time. <span class="de">(Geschafft! Du kannst die Station jederzeit wiederholen.)</span></span></div>
      <a class="btn ghost" href="${link('lesson.html', { st: id })}">Do it again (Nochmal)</a>`;
  }
  return `<div class="action" style="--rc:${color}">
    <div class="action-h">WHAT TO DO NOW <span class="de-inline">(Was du jetzt machst)</span></div>
    <ol class="todo">
      <li><span>Open the station and work through the <b>short tasks</b>.</span><span class="de">(Öffne die Station und mach die kurzen Aufgaben.)</span></li>
      <li><span>At the end you get your <b>stamp</b>.</span><span class="de">(Am Ende bekommst du deinen Stempel.)</span></li>
    </ol>
    <a class="btn" href="${link('lesson.html', { st: id })}">Open the station (Station öffnen)</a>
    <p class="hint-de" style="margin:0">Kein Coach nötig – das geht auch zu Hause.</p>
  </div>`;
}

function actionBox(def, t, color) {
  let todo; let mode = '';
  if (isGuest(cfg, trav.code)) {   // Gäste: kein Arbeitsblatt, direkt eine Übungsrunde
    mode = ' PRACTICE';
    todo = [
      ['Welcome on board! <b>Practise</b> with the coach – just like the class.', 'Willkommen! Üben Sie mit dem Coach – genau wie die Klasse.'],
      ['Copy the start code, tap into the coach field, paste and send.', 'Startcode kopieren, ins Coach-Feld tippen, einfügen, senden.'],
    ];
  } else if (!t.w1 && t.gold) {
    todo = [
      ['Your check-in shows: you are good at this! Take the <b>GOLD worksheet</b> from the box.', 'Dein Check-in zeigt: Das kannst du schon gut! Nimm das goldene Arbeitsblatt.'],
      ['Copy your start code and tap into the coach field below.', 'Kopiere deinen Startcode und tippe unten in das Coach-Feld.'],
      ['Paste the code, send it – then send a <b>photo</b> of your worksheet.', 'Code einfügen, senden – dann ein Foto vom Blatt schicken.'],
    ];
  } else if (!t.w1) {
    todo = [
      ['Take <b>worksheet 1</b> from the box and do it.', 'Nimm Arbeitsblatt 1 aus der Box und bearbeite es.'],
      ['Copy your start code and tap into the coach field below.', 'Kopiere deinen Startcode und tippe unten in das Coach-Feld.'],
      ['Paste the code, send it – then send a <b>photo</b> of your worksheet.', 'Code einfügen, senden – dann ein Foto vom Blatt schicken.'],
    ];
  } else if (!t.p) {
    mode = ' PRACTICE';
    todo = [
      ['Now <b>practise</b> with the coach.', 'Jetzt übst du mit dem Coach.'],
      ['Copy your start code, tap into the coach field, paste and send.', 'Startcode kopieren, ins Coach-Feld tippen, einfügen, senden.'],
    ];
  } else if (!t.extra) {
    todo = [
      ['Get your <b>third star</b>: worksheet 2 (gold) <i>or</i> one more practice round.', 'Dritter Stern: Arbeitsblatt 2 (gold) oder noch eine Übungsrunde.'],
      ['Copy your start code, tap into the coach field, paste and send.', 'Startcode kopieren, ins Coach-Feld tippen, einfügen, senden.'],
    ];
  } else {
    mode = ' PRACTICE';
    todo = [['<b>All three stars!</b> You can practise again any time.', 'Alle drei Sterne! Du kannst jederzeit weiter üben.']];
  }
  const start = `START ${def.id} ${trav.code}${mode}`;
  // Station mit Plan (planFrom): Plan aus Kata Tjuta hängt am Startcode – ein Mal kopieren reicht
  const plan = def.planFrom ? planLine(cfg, def.planFrom, store.get(cfg, planKey(def.planFrom, trav.code))) : '';
  const from = def.planFrom && cfg.topics[def.planFrom];
  const planNote = !def.planFrom ? ''
    : plan ? `<div class="ok-box">✓ Your plan from ${esc(from.place)} is copied together with your start code. <span class="de">(Dein Plan aus ${esc(from.place)} wird mit dem Startcode kopiert.)</span></div>`
      : `<div class="info-box">${UI.lock}<span><b>No plan from ${esc(from.place)} on this iPad.</b> Do ${esc(from.place)} first – or send the coach a photo of your plan. <span class="de">(Kein Plan auf diesem iPad. Mach zuerst ${esc(from.place)} – oder schick dem Coach ein Foto von deinem Plan.)</span></span></div>`;
  return `<div class="action" style="--rc:${color}">
    <div class="action-h">WHAT TO DO NOW <span class="de-inline">(Was du jetzt machst)</span></div>
    <ol class="todo">${todo.map(([en, de]) => `<li><span>${en}</span><span class="de">(${esc(de)})</span></li>`).join('')}</ol>
    <div class="startcode"><span class="code-mono" id="startcode" data-copy="${esc(plan ? `${start} | ${plan}` : start)}">${esc(start)}</span>
      <button type="button" class="btn" id="copy">${UI.copy}<span>Copy start code <span class="de-inline">(kopieren)</span></span></button></div>
    ${planNote}
    <div class="ok-box" id="copied" ${view.copied ? '' : 'hidden'}>✓ Copied! Now tap into the field below and paste. <span class="de">(Kopiert! Jetzt unten ins Feld tippen und einfügen.)</span></div>
    ${def.coach?.input ? `<div class="coach">
      <div class="coach-h">${UI.tablet}<b>${esc(def.coach.name)}</b> <span class="de">– tap, paste, send (tippen, einfügen, senden). A new tab opens.</span></div>
      <iframe title="${esc(def.coach.name)}" src="${esc(def.coach.input)}" height="56" loading="lazy"></iframe>
    </div>` : ''}
    <p class="hint-de" style="margin:0">Am Ende tippst du im Chat auf „🏅 GET YOUR STAMP“. Dann kommt dein Stern hierher.</p>
  </div>`;
}
