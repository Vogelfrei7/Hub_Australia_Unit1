// Abgabe v2 (abgabe.html): Ergebnis lesen, prüfen, Stempel + Stern zeigen, an das Google-Formular senden.
import {
  loadConfig, loadEvents, progress, diff, getTraveller, setTraveller, isDemo, link, esc, stampHTML, badgeHTML,
  UI, store, signature, addPending, parseFromURL, parseBlock, validate, submitToForm, normaliseEvent, stepInfo, fmtDate,
} from './core.js?v=2.6';
import { openDialog } from './ui.js?v=2.6';

const app = document.getElementById('app');
let cfg;

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<p class="err">Etwas ist schiefgelaufen (${esc(err.message)}). Bitte Seite neu laden.</p>`;
});

async function main() {
  cfg = await loadConfig();
  const raw = parseFromURL(location.search);
  if (raw) { history.replaceState(null, '', link('abgabe.html')); return handle(raw); }
  renderPaste();
}

function renderPaste(prefill = '', errors = []) {
  app.innerHTML = `
    <div class="moment">
      <h1>Hand in your result</h1>${UI.brush(240)}
      <p class="note" style="margin:0;text-align:center">Paste the result line from your coach. <span class="de">(Füge die Ergebniszeile aus dem Coach ein.)</span></p>
      <form id="paste" class="fld full" style="gap:12px">
        <textarea class="input" id="block" spellcheck="false" autocapitalize="off" aria-label="Result line">${esc(prefill)}</textarea>
        <div class="err" ${errors.length ? '' : 'hidden'}>${errors.map(esc).join('<br>')}</div>
        <button class="btn full" type="submit">Check my result (Ergebnis prüfen)</button>
      </form>
      <a class="btn ghost full" href="${link('index.html')}">${UI.back}<span>Back to the map (Zur Karte)</span></a>
    </div>`;
  app.querySelector('#paste').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = app.querySelector('#block').value;
    const raw = parseBlock(text);
    if (!raw) return renderPaste(text, ['Das ist keine vollständige Ergebniszeile. Sie hat 9 Teile, getrennt durch |.']);
    handle(raw, text);
  });
}

async function handle(raw, pasted = '') {
  const v = validate(cfg, raw);
  if (!v.ok) return renderPaste(pasted, [...v.errors, 'Bitte den Coach, den Link noch einmal zu erzeugen.']);
  const r = v.result;
  let trav = getTraveller(cfg);
  if (isDemo()) r.code = trav.code;
  else if (!trav.code) { setTraveller(cfg, r.code, trav.course); trav = getTraveller(cfg); }
  else if (trav.code !== r.code && !(await confirmCode(trav.code, r.code))) return renderPaste(pasted, ['Abgabe abgebrochen. Prüfe deinen Code im Coach.']);
  r.kurs = r.kurs || trav.course || cfg.courses[0];

  const { events } = await loadEvents(cfg, r.code);
  const ev = normaliseEvent({ station: r.station, n: r.n, h: r.h, f: r.f, s: r.s, fb: r.fb, ts: Date.now() });
  const sig = `${r.code}|${signature(ev)}`;
  const sent = store.get(cfg, 'sent', []) || [];
  const already = sent.includes(sig);
  const before = progress(cfg, events);
  const after = already ? before : progress(cfg, events.concat([ev]));

  renderMoment(r, ev, before, after, v.warnings, already);
  if (already) return setSave('This result was already saved. (Schon gespeichert.)');
  store.set(cfg, 'sent', sent.concat([sig]).slice(-80));
  addPending(cfg, r.code, ev);
  if (isDemo()) return setSave('Demo – nothing was sent.');
  try {
    setSave('Sending to your teacher … (Wird gesendet …)');
    await submitToForm(cfg, r);
    setSave('Sent to your teacher. (An deine Lehrkraft gesendet.)');
  } catch {
    setSave('No connection right now. Your stamp is saved on this iPad. (Keine Verbindung – dein Stempel ist auf dem iPad gespeichert.)');
  }
}

function setSave(text) { const el = document.getElementById('save-state'); if (el) el.textContent = text; }

function confirmCode(mine, theirs) {
  return new Promise((resolve) => {
    const d = openDialog(`
      <h2>Check your code</h2>
      <p class="note" style="margin:0">This result is for <b>${esc(theirs)}</b>, but this iPad uses <b>${esc(mine)}</b>.</p>
      <p class="hint-de" style="margin:0">Der Code im Ergebnis passt nicht zu deinem iPad. Sende nur, wenn ${esc(theirs)} wirklich dein Code ist.</p>
      <button type="button" class="btn" id="cc-yes">${esc(theirs)} is my code – send</button>
      <button type="button" class="btn ghost" id="cc-no">Cancel (Abbrechen)</button>`, { closable: false, label: 'Code' });
    d.root.querySelector('#cc-yes').onclick = () => { setTraveller(cfg, theirs, getTraveller(cfg).course); d.close(); resolve(true); };
    d.root.querySelector('#cc-no').onclick = () => { d.close(); resolve(false); };
  });
}

function renderMoment(r, ev, before, after, warnings, already) {
  const si = stepInfo(cfg, r.station);
  const def = si.topic; const tid = si.topicId;
  const tb = before.topics[tid]; const ta = after.topics[tid];
  const newStar = ta.stars > tb.stars;
  const firstStamp = !tb.stamp && ta.stamp;
  const { newAch } = diff(before, after);
  const head = firstStamp ? 'Stamp collected!' : newStar ? '+1 star!' : si.kind === 'final' ? 'Final check done!' : 'Well done!';
  const headDe = firstStamp ? 'Stempel bekommen!' : newStar ? 'Ein Stern mehr!' : si.kind === 'final' ? 'Final check geschafft!' : 'Gut gemacht!';
  let next;
  if (!ta.w1) next = ['Do worksheet 1 next.', 'Als Nächstes: Arbeitsblatt 1.'];
  else if (!ta.p) next = ['Next: practise with the coach.', 'Als Nächstes: Üben mit dem Coach.'];
  else if (!ta.extra) next = ['Get your third star: worksheet 2 or one more practice round.', 'Dritter Stern: Arbeitsblatt 2 oder noch eine Übungsrunde.'];
  else next = ['All three stars – amazing! You can practise again any time.', 'Alle drei Sterne – super! Du kannst jederzeit weiter üben.'];

  app.innerHTML = `
    <div class="moment">
      <div class="stamp-land">${stampHTML(cfg, def, { size: 190, stars: ta.stars, date: fmtDate(ev.ts) })}</div>
      <div style="text-align:center">
        <h1>${esc(head)}</h1>${UI.brush(240)}
        <div class="sub" style="font-size:16px">(${esc(headDe)}) · ${esc(def.name)} · ${esc(si.label)}</div>
      </div>
      ${r.s || r.fb ? `<div class="two">
        ${r.s ? `<div class="good"><b>Well done (Gut gemacht)</b>${esc(r.s)}</div>` : ''}
        ${r.fb ? `<div class="tip"><b>Tip (Tipp)</b>${esc(r.fb)}</div>` : ''}
      </div>` : ''}
      ${newAch.map((id) => { const a = cfg.achievements.find((x) => x.id === id); return `<div class="new-box">${badgeHTML(cfg, a, true, 60)}<span><b>New achievement!</b><br>(Neues Abzeichen: ${esc(a.de)})</span></div>`; }).join('')}
      <div class="next-box"><span class="how-n" style="width:40px;height:40px;font-size:18px;flex-shrink:0">➜</span><span><b>${esc(next[0])}</b><br><span class="de">(${esc(next[1])})</span></span></div>
      ${warnings.length ? `<div class="hint-de">${warnings.map(esc).join('<br>')}</div>` : ''}
      <a class="btn full" id="back" href="${link('index.html', { st: tid })}">Back to the map (Zur Karte)</a>
      <div class="save-state" id="save-state" role="status">${already ? '' : '…'}</div>
      <div class="hint-de" style="text-align:center">${esc(cfg.texts.privacy)}</div>
    </div>`;
  app.querySelector('#back').addEventListener('click', () => {
    try { sessionStorage.setItem('arh.just', JSON.stringify({ topic: tid })); } catch { /* */ }
  });
}
