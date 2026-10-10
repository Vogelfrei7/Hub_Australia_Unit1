// Übungsseite ohne Coach (lesson.html?st=ART): Inhalte aus topics.<ID>.lesson, Auswertung ohne KI → Schritt <ID>-P.
// Abschnitt-Typen: learn (Regeln der Station), order (Teile antippen), choice (Fragen mit Auswahl), toolkit (Checkliste + Abgabe).
import {
  loadConfig, loadEvents, progress, getTraveller, isDemo, link, esc, bold, stampHTML, UI, addPending, submitToForm, normaliseEvent,
} from './core.js?v=3.1';
import { openCodeDialog, headerHTML, wireCodePill } from './ui.js?v=3.1';

const app = document.getElementById('app');
let cfg; let trav; let id; let def; let secs; let sec = 0;
const res = {};   // Ergebnis je Aufgabe: { area, wrong } – zählt nur der erste Versuch

main().catch((err) => { console.error(err); app.innerHTML = `<p class="err">Die Station konnte nicht geladen werden (${esc(err.message)}).</p>`; });

async function main() {
  cfg = await loadConfig();
  id = (new URLSearchParams(location.search).get('st') || '').toUpperCase();
  def = cfg.topics[id];
  if (!def?.lesson) { app.innerHTML = `<p class="err">Diese Station gibt es nicht. <a href="${link('index.html')}">Zur Karte</a></p>`; return; }
  document.title = `${def.place} – ${def.name}`;
  secs = def.lesson.sections;
  trav = getTraveller(cfg);
  if (!trav.code) { openCodeDialog(cfg, { closable: false, onSave: () => location.reload() }); return; }
  const { events } = await loadEvents(cfg, trav.code);
  intro(progress(cfg, events).topics[id].complete);
}

function shell(inner) {
  app.innerHTML = `${headerHTML(cfg, { code: trav.code, page: 'lesson' })}<div class="moment lesson">${inner}</div>`;
  wireCodePill(cfg);
  window.scrollTo(0, 0);
}

function intro(already) {
  const ls = def.lesson;
  shell(`
    <div class="stamp-land">${stampHTML(cfg, def, { size: 130 })}</div>
    <h1>${esc(def.place)}</h1>${UI.brush(200)}
    <p class="note" style="text-align:center;margin:0"><b>${esc(def.name)}</b> · Topic: ${esc(def.topic)}</p>
    <p class="note" style="text-align:center;margin:0">${bold(ls.intro.en)}<br><span class="de">(${esc(ls.intro.de)})</span></p>
    <ul class="ci-facts">${ls.facts.map(([en, de]) => `<li><b>${esc(en)}</b> <span class="de">(${esc(de)})</span></li>`).join('')}</ul>
    ${already ? `<div class="info-box teal">${UI.check}<span><b>You have done this station.</b> You can do it again any time.<br><span class="de">(Du hast die Station schon geschafft. Du kannst sie jederzeit wiederholen.)</span></span></div>` : ''}
    <button class="btn full" type="button" id="go">${already ? 'Start again (Nochmal)' : 'Let’s go! (Los geht’s)'}</button>`);
  document.getElementById('go').onclick = () => { sec = 0; renderSection(); };
}

/* ---------- Abschnitte ---------- */

function renderSection() {
  const s = secs[sec];
  const body = { learn: learnHTML, order: orderHTML, choice: choiceHTML, toolkit: toolkitHTML }[s.type](s);
  const last = sec === secs.length - 1;
  shell(`
    <div class="ci-top"><b>${esc(def.place)}</b><span>Part ${sec + 1} of ${secs.length} (Teil ${sec + 1} von ${secs.length})</span></div>
    <div class="ci-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${secs.length}" aria-valuenow="${sec + 1}"><i style="width:${((sec + 1) / secs.length) * 100}%"></i></div>
    <h2 class="ls-h">${esc(s.title)} <span class="de">(${esc(s.de)})</span></h2>
    ${s.task ? `<p class="hint-de ls-task">${bold(s.task.en)} (${esc(s.task.de)})</p>` : ''}
    ${body}
    <div class="ci-nav">
      ${sec > 0 ? '<button class="btn ghost" type="button" id="prev">Back (Zurück)</button>' : '<span></span>'}
      <button class="btn" type="button" id="next" ${isSolved(s) ? '' : 'disabled'}>${last ? 'Finish – get your stamp (Fertig)' : 'Next (Weiter)'}</button>
    </div>`);
  ({ order: wireOrder, choice: wireChoice }[s.type] || (() => {}))(s);
  document.getElementById('prev')?.addEventListener('click', () => { sec--; renderSection(); });
  document.getElementById('next').onclick = () => { if (last) finish(); else { sec++; renderSection(); } };
}

const key = (i) => `${sec}.${i}`;
function isSolved(s) {
  if (s.type === 'order') return res[key(0)]?.done;
  if (s.type === 'choice') return s.items.every((_, i) => res[key(i)]?.done);
  return true;
}
function unlockNext(s) { document.getElementById('next').disabled = !isSolved(s); }
function mark(i, area, wrong) {
  const r = res[key(i)] || (res[key(i)] = { area, wrong: false, done: false });
  if (wrong) r.wrong = true; else r.done = true;
}

function learnHTML(s) {
  return `<p class="note" style="margin:0">${bold(s.lead.en)}<br><span class="de">(${esc(s.lead.de)})</span></p>
    <div class="rules">${(def.rules || []).map((r, i) => `<div class="rule">
      <span class="rule-n">${i + 1}</span>
      <div><b>${esc(r.title)}</b> <span class="de">(${esc(r.de)})</span>
        <p>${bold(r.text)}<br><span class="de">${esc(r.textDe)}</span></p>
        ${r.ex ? `<p class="rule-ex">${bold(r.ex)}</p>` : ''}</div>
    </div>`).join('')}</div>`;
}

// Teile in zufälliger Reihenfolge; das Kind tippt sie der Reihe nach an
function orderHTML(s) {
  const st = res[key(0)] ||= { area: s.area, wrong: false, done: false, placed: 0, shuffle: shuffle(s.parts.map((_, i) => i)) };
  const { placed } = st;
  return `<ol class="ls-built" id="built">${s.parts.slice(0, placed).map(builtHTML).join('')}</ol>
    <div class="ls-pool" id="pool">${st.shuffle.filter((i) => i >= placed).map((i) => `<button type="button" class="ls-part" data-i="${i}">${esc(s.parts[i].text)}</button>`).join('')}</div>
    <div class="ls-msg" id="msg" role="status"></div>`;
}
const builtHTML = (p) => `<li class="ls-placed"><span class="ls-tag">${esc(p.label)}</span><span>${esc(p.text)}</span></li>`;

function wireOrder(s) {
  const st = res[key(0)];
  app.querySelectorAll('.ls-part').forEach((b) => b.onclick = () => {
    const msg = document.getElementById('msg');
    if (+b.dataset.i !== st.placed) {
      st.wrong = true;
      b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      msg.className = 'ls-msg bad';
      msg.innerHTML = `Not yet. What comes next: the <b>${esc(s.parts[st.placed].label.toLowerCase())}</b>? <span class="de">(Noch nicht. Was kommt als Nächstes?)</span>`;
      return;
    }
    document.getElementById('built').insertAdjacentHTML('beforeend', builtHTML(s.parts[st.placed]));
    b.remove();
    st.placed++;
    if (st.placed === s.parts.length) {
      st.done = true;
      msg.className = 'ls-msg ok';
      msg.innerHTML = `Well done! ${esc(s.parts.map((p) => p.label).join(' → '))} <span class="de">(Super! Das ist die richtige Reihenfolge.)</span>`;
      unlockNext(s);
    } else { msg.className = 'ls-msg'; msg.textContent = ''; }
  });
}

function choiceHTML(s) {
  return `<div class="ci-list">${s.items.map((it, i) => {
    const r = res[key(i)];
    const [before, after] = it.q.split('___');
    const right = it.options[it.answer];
    const q = s.gap
      ? `${bold(before)}<span class="ci-gap">${r?.done ? esc(right) : '___'}</span>${bold(after || '')}`
      : bold(it.q);
    const long = it.options.some((o) => o.length > 28);
    return `<div class="ci-item" role="group" aria-labelledby="q-${i}">
      <p class="ci-q" id="q-${i}"><span class="ci-n">${i + 1}</span> ${q}${it.qDe ? ` <span class="de">(${esc(it.qDe)})</span>` : ''}</p>
      <div class="ci-opts${long ? ' long' : ''}">${it.options.map((o, k) => `<button type="button" class="ci-opt${r?.done && k === it.answer ? ' ok' : ''}" data-i="${i}" data-k="${k}" ${r?.done ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
      <div class="ls-msg${r?.done ? ' ok' : ''}" id="m-${i}" role="status">${r?.done ? whyHTML(it) : ''}</div>
    </div>`;
  }).join('')}</div>`;
}
const whyHTML = (it) => `✓ Right! ${it.why ? `${esc(it.why)} <span class="de">(${esc(it.whyDe)})</span>` : ''}`;

function wireChoice(s) {
  app.querySelectorAll('.ci-opt').forEach((b) => b.onclick = () => {
    const i = +b.dataset.i; const it = s.items[i]; const msg = document.getElementById(`m-${i}`);
    if (+b.dataset.k !== it.answer) {
      mark(i, it.area, true);
      b.classList.add('bad'); b.disabled = true;
      msg.className = 'ls-msg bad';
      msg.innerHTML = 'Not quite – try again. <span class="de">(Nicht ganz – probier es nochmal.)</span>';
      return;
    }
    mark(i, it.area, false);
    const box = b.closest('.ci-item');
    box.querySelectorAll('.ci-opt').forEach((o) => { o.disabled = true; });
    b.classList.add('ok');
    const gap = box.querySelector('.ci-gap'); if (gap) gap.textContent = it.options[it.answer];
    msg.className = 'ls-msg ok';
    msg.innerHTML = whyHTML(it);
    unlockNext(s);
  });
}

function toolkitHTML(s) {
  return `<p class="note" style="margin:0">${bold(s.lead.en)}<br><span class="de">(${esc(s.lead.de)})</span></p>
    <ul class="ls-check">${s.checklist.map(([en, de]) => `<li><span class="ls-box" aria-hidden="true">${UI.check}</span><span><b>${esc(en)}</b><br><span class="de">${esc(de)}</span></span></li>`).join('')}</ul>
    <p class="hint-de" style="margin:0">Tip: take a photo of this list. (Tipp: Mach ein Foto von dieser Liste.)</p>`;
}

/* ---------- Abgabe ---------- */

async function finish() {
  const all = Object.values(res).filter((r) => r.done);
  const right = all.filter((r) => !r.wrong).length;
  const f = [...new Set(all.filter((r) => r.wrong).map((r) => r.area))];
  const pct = all.length ? right / all.length : 0;
  const n = pct >= 0.9 ? 4 : pct >= 0.75 ? 3 : pct >= 0.5 ? 2 : 1;
  const r = { code: trav.code, kurs: trav.course || cfg.courses[0], station: `${id}-P`, n, self: null, h: 0, f, s: `${right} of ${all.length} right first time`, fb: '' };
  shell('<p class="sub">Saving … (Wird gespeichert …)</p>');
  addPending(cfg, trav.code, normaliseEvent({ station: r.station, n, h: 0, f, s: r.s, ts: Date.now() }));
  let ok = true;
  if (!isDemo()) { try { await submitToForm(cfg, r); } catch { ok = false; } }
  done(right, all.length, ok);
}

function done(right, total, ok) {
  const route = cfg.routeById[def.route];
  const nextId = route.stops[route.stops.indexOf(id) + 1];
  const next = nextId && cfg.topics[nextId];
  shell(`
    <div class="stamp-land">${stampHTML(cfg, def, { size: 180, date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() })}</div>
    <h1>Station done!</h1>${UI.brush(220)}
    <p class="note" style="text-align:center;margin:0"><b>${right} of ${total} right the first time.</b> And now you know how a good article works!<br>
      <span class="de">(${right} von ${total} beim ersten Versuch richtig. Jetzt weißt du, wie ein guter Artikel funktioniert!)</span></p>
    ${next ? `<div class="next-box"><span class="how-n" style="width:40px;height:40px;font-size:18px;flex-shrink:0">${esc(next.number)}</span>
      <span><b>Next stop: ${esc(next.place)} · ${esc(next.name)}</b>${next.status === 'soon' ? ' – coming soon' : ''}<br><span class="de">(Nächster Stopp${next.status === 'soon' ? ' – kommt bald' : ''})</span></span></div>` : ''}
    <a class="btn full" href="${link('index.html', { st: id })}">To the map (Zur Karte)</a>
    ${ok ? '' : '<p class="err">No connection while saving. Please tell your teacher. (Keine Verbindung beim Speichern – sag bitte deiner Lehrkraft Bescheid.)</p>'}
    <p class="hint-de" style="text-align:center">${esc(cfg.texts.privacy)}</p>`);
  try { sessionStorage.setItem('arh.just', JSON.stringify({ topic: id })); } catch { /* */ }
}

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  if (b.every((v, i) => v === a[i]) && b.length > 1) [b[0], b[1]] = [b[1], b[0]];   // nie schon richtig sortiert
  return b;
}
