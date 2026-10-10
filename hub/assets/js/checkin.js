// Check-in (checkin.html): fester Pre-Test, Auswertung ohne KI → je Zeitform ein Startwert (Schritt <THEMA>-B).
import {
  loadConfig, loadEvents, progress, getTraveller, isDemo, link, esc, stampHTML, UI, store, addPending, submitToForm, normaliseEvent,
} from './core.js?v=3.2';
import { openCodeDialog, headerHTML, wireCodePill } from './ui.js?v=3.2';

const app = document.getElementById('app');
const PER_PAGE = 5;
let cfg; let trav; let answers = []; let page = 0;

main().catch((err) => { console.error(err); app.innerHTML = `<p class="err">Der Check-in konnte nicht geladen werden (${esc(err.message)}).</p>`; });

async function main() {
  cfg = await loadConfig();
  trav = getTraveller(cfg);
  if (!trav.code) { openCodeDialog(cfg, { closable: false, onSave: () => location.reload() }); return; }
  const { events } = await loadEvents(cfg, trav.code);
  if (progress(cfg, events).topics.START.complete) return done(true);
  answers = new Array(cfg.checkin.items.length).fill('');
  intro();
}

function shell(inner) {
  app.innerHTML = `${headerHTML(cfg, { code: trav.code, page: 'checkin' })}<div class="moment checkin">${inner}</div>`;
  wireCodePill(cfg);
}

function intro() {
  const ci = cfg.checkin;
  shell(`
    <div class="stamp-land">${stampHTML(cfg, cfg.topics.START, { size: 130 })}</div>
    <h1>Check-in</h1>${UI.brush(200)}
    <p class="note" style="text-align:center;margin:0"><b>${esc(ci.intro.en)}</b><br><span class="de">(${esc(ci.intro.de)})</span></p>
    <ul class="ci-facts">
      <li><b>${ci.items.length} short tasks</b> <span class="de">(kurze Aufgaben)</span></li>
      <li><b>about 12 minutes</b> <span class="de">(etwa 12 Minuten)</span></li>
      <li><b>no help, no hints</b> – just try! <span class="de">(keine Hilfen – probier es einfach!)</span></li>
      <li><b>only once</b> <span class="de">(nur einmal)</span></li>
    </ul>
    <button class="btn full" type="button" id="go">Start the check-in (Los geht’s)</button>`);
  document.getElementById('go').onclick = () => { page = 0; renderPage(); };
}

function itemHTML(it, i) {
  const [before, after] = it.text.split('___');
  const val = answers[i];
  if (it.type === 'choice') {
    return `<div class="ci-item" role="group" aria-labelledby="ci-q-${i}"><p class="ci-q" id="ci-q-${i}"><span class="ci-n">${i + 1}</span> ${esc(before)}<span class="ci-gap">${val ? esc(val) : '___'}</span>${esc(after || '')}</p>
      <div class="ci-opts">${it.options.map((o) => `<button type="button" class="ci-opt${val === o ? ' on' : ''}" data-i="${i}" data-v="${esc(o)}" aria-pressed="${val === o}">${esc(o)}</button>`).join('')}</div>
    </div>`;
  }
  return `<div class="ci-item"><label for="ci-${i}"><span class="ci-n">${i + 1}</span> ${esc(before)}<span class="ci-gap">___</span>${esc(after || '')} <span class="ci-hint">(${esc(it.hint)})</span></label>
    <input class="input ci-input" id="ci-${i}" data-i="${i}" value="${esc(val)}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="type here (hier schreiben)"></div>`;
}

function renderPage() {
  const items = cfg.checkin.items;
  const pages = Math.ceil(items.length / PER_PAGE);
  const from = page * PER_PAGE;
  const slice = items.slice(from, from + PER_PAGE);
  shell(`
    <div class="ci-top"><b>Check-in</b><span>Page ${page + 1} of ${pages} (Seite ${page + 1} von ${pages})</span></div>
    <div class="ci-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${pages}" aria-valuenow="${page + 1}"><i style="width:${((page + 1) / pages) * 100}%"></i></div>
    <p class="hint-de" style="margin:0;align-self:flex-start">Tap the right word or type the form. (Tippe das richtige Wort an oder schreib die Form.)</p>
    <div class="ci-list">${slice.map((it, k) => itemHTML(it, from + k)).join('')}</div>
    <div class="err" id="ci-warn" hidden></div>
    <div class="ci-nav">
      ${page > 0 ? '<button class="btn ghost" type="button" id="prev">Back (Zurück)</button>' : '<span></span>'}
      <button class="btn" type="button" id="next">${page < pages - 1 ? 'Next (Weiter)' : 'Finish (Fertig)'}</button>
    </div>`);
  app.querySelectorAll('.ci-opt').forEach((b) => b.onclick = () => {
    answers[+b.dataset.i] = b.dataset.v;
    const fs = b.closest('.ci-item');
    fs.querySelectorAll('.ci-opt').forEach((o) => { o.classList.toggle('on', o === b); o.setAttribute('aria-pressed', o === b); });
    fs.querySelector('.ci-gap').textContent = b.dataset.v;
  });
  app.querySelectorAll('.ci-input').forEach((inp) => inp.oninput = () => { answers[+inp.dataset.i] = inp.value; });
  document.getElementById('prev')?.addEventListener('click', () => { page--; renderPage(); window.scrollTo(0, 0); });
  let warned = false;
  document.getElementById('next').onclick = () => {
    const open = slice.filter((_, k) => !String(answers[from + k]).trim()).length;
    if (open && !warned) {
      const w = document.getElementById('ci-warn');
      w.textContent = `${open} task(s) without an answer. Tap again to go on. (${open} Aufgabe(n) ohne Antwort. Nochmal tippen, um weiterzugehen.)`;
      w.hidden = false; warned = true; return;
    }
    if (page < pages - 1) { page++; renderPage(); window.scrollTo(0, 0); } else finish();
  };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[.!?,]+$/g, '').replace(/\s+/g, ' ').trim();

async function finish() {
  const items = cfg.checkin.items;
  const byTopic = {};
  items.forEach((it, i) => {
    const t = byTopic[it.topic] || (byTopic[it.topic] = { right: 0, total: 0, f: [] });
    t.total++;
    if (it.answer.map(norm).includes(norm(answers[i]))) t.right++;
    else if (!t.f.includes(it.area)) t.f.push(it.area);
  });
  shell('<p class="sub">Saving … (Wird gespeichert …)</p>');
  const sendAll = [];
  for (const [topic, t] of Object.entries(byTopic)) {
    const pct = t.right / t.total;
    const n = pct >= 0.9 ? 4 : pct >= 0.75 ? 3 : pct >= 0.5 ? 2 : 1;
    const r = { code: trav.code, kurs: trav.course || cfg.courses[0], station: `${topic}-B`, n, self: null, h: 0, f: t.f, s: `${t.right} of ${t.total} correct`, fb: '' };
    addPending(cfg, trav.code, normaliseEvent({ station: r.station, n, h: 0, f: t.f, s: r.s, ts: Date.now() }));
    sendAll.push(r);
  }
  store.set(cfg, 'checkinAnswers', answers);   // nur lokal, falls etwas schiefgeht
  let ok = true;
  if (!isDemo()) {
    for (const r of sendAll) {
      try { await submitToForm(cfg, r); } catch { ok = false; }
    }
  }
  done(false, ok);
}

function done(already, ok = true) {
  const next = cfg.topics[cfg.routeById.grammar.stops.find((id) => id !== 'START' && cfg.topics[id].status !== 'soon')];
  shell(`
    <div class="stamp-land">${stampHTML(cfg, cfg.topics.START, { size: 180, date: already ? '' : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() })}</div>
    <h1>${already ? 'Check-in done' : 'Check-in done!'}</h1>${UI.brush(220)}
    <p class="note" style="text-align:center;margin:0"><b>Now we know your starting point.</b> Your coach and your teacher can help you better.<br>
      <span class="de">(Jetzt kennen wir deinen Startpunkt. Dein Coach und deine Lehrkraft können dir besser helfen.)</span></p>
    ${next ? `<div class="next-box"><span class="how-n" style="width:40px;height:40px;font-size:18px;flex-shrink:0">${esc(next.number)}</span>
      <span><b>Next stop: ${esc(next.place)} · ${esc(next.name)}</b><br><span class="de">(Nächster Stopp)</span></span></div>` : ''}
    <a class="btn full" href="${link('index.html', next ? { st: next.id } : {})}">To the map (Zur Karte)</a>
    ${ok ? '' : '<p class="err">No connection while saving. Please tell your teacher. (Keine Verbindung beim Speichern – sag bitte deiner Lehrkraft Bescheid.)</p>'}
    <p class="hint-de" style="text-align:center">${esc(cfg.texts.privacy)}</p>`);
  if (!already) { try { sessionStorage.setItem('arh.just', JSON.stringify({ topic: 'START' })); } catch { /* */ } }
}
