// Abgabe (abgabe.html): Ergebnis aus Link oder Einfuege-Block lesen, pruefen,
// Stempel-Moment zeigen, an das Google-Formular senden.
import {
  loadConfig, loadEvents, deriveState, newlyOpened, getTraveller, setTraveller, isDemo, link,
  esc, stars, calibration, nextStep, fmtDate, stampHTML, UI, store, signature, addPending,
  parseFromURL, parseBlock, validate, submitToForm, normaliseEvent,
} from './core.js';

const app = document.getElementById('app');
let cfg;

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<p class="err">Etwas ist schiefgelaufen (${esc(err.message)}). Bitte Seite neu laden oder die Ergebniszeile einfügen.</p>`;
});

async function main() {
  cfg = await loadConfig();
  const raw = parseFromURL(location.search);
  if (raw) {
    // Daten aus der Adresszeile entfernen (kein erneutes Senden beim Neuladen, nichts im Verlauf)
    history.replaceState(null, '', link('abgabe.html'));
    return handle(raw);
  }
  renderPaste();
}

/* ---------- Einfuegen (Fallback) ---------- */

function renderPaste(prefill = '', errors = []) {
  app.innerHTML = `
    <div class="moment">
      <h1>Hand in your result</h1>
      ${UI.brush(240)}
      <p class="note" style="margin:0;text-align:center">Paste the result line from your coach here.</p>
      <form id="paste" class="fld full" style="gap:12px">
        <label class="fld">Result line
          <textarea class="input" id="block" spellcheck="false" autocapitalize="off" placeholder="${esc(cfg.codeExample)} | ${esc(cfg.courses[0])} | G4 | 3 | 2 | 1 | PROG-FORM | ... | ...">${esc(prefill)}</textarea>
        </label>
        <div class="err" id="perr" ${errors.length ? '' : 'hidden'}>${errors.map(esc).join('<br>')}</div>
        <button class="btn full" type="submit">Check my result</button>
      </form>
      <p class="hint-de" lang="de" style="margin:0">Hat der Link im Coach nicht funktioniert? Tippe im Coach auf den Kopier-Knopf beim grauen Ergebnis-Kasten und füge die Zeile hier ein. Ändere die Werte nicht selbst.</p>
      <a class="btn ghost full" href="${link('index.html')}">${UI.back} Back to the map</a>
    </div>`;
  app.querySelector('#paste').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = app.querySelector('#block').value;
    const raw = parseBlock(text);
    if (!raw) return renderPaste(text, ['Das ist keine vollständige Ergebniszeile. Sie hat 9 Teile, getrennt durch |.']);
    handle(raw, text);
  });
}

/* ---------- Pruefen & Senden ---------- */

async function handle(raw, pastedText = '') {
  const v = validate(cfg, raw);
  if (!v.ok) {
    return renderPaste(pastedText, [...v.errors, 'Bitte den Coach, den Link oder die Ergebniszeile noch einmal zu erzeugen.']);
  }
  const r = v.result;
  let trav = getTraveller(cfg);

  if (isDemo()) {
    r.code = trav.code;
  } else if (!trav.code) {
    setTraveller(cfg, r.code, r.kurs || trav.course);
    trav = getTraveller(cfg);
  } else if (trav.code !== r.code) {
    const ok = await confirmCode(trav.code, r.code);
    if (!ok) return renderPaste(pastedText, ['Abgabe abgebrochen. Prüfe deinen Code im Coach.']);
  }
  r.kurs = r.kurs || trav.course || (cfg.courses.length === 1 ? cfg.courses[0] : '');

  const { events } = await loadEvents(cfg, r.code);
  const ev = normaliseEvent({ station: r.station, n: r.n, self: r.self, h: r.h, f: r.f, s: r.s, fb: r.fb, ts: Date.now() });
  const before = deriveState(cfg, events);
  const after = deriveState(cfg, events.concat([ev]));

  // Doppelte Abgabe (gleicher Link erneut geoeffnet) nicht noch einmal senden
  const sig = `${r.code}|${signature(ev)}`;
  const sent = store.get(cfg, 'sent', []) || [];
  const already = sent.includes(sig);

  renderMoment(r, ev, before, after, v.warnings, already);
  if (already) return setSave('This result was already saved.');

  store.set(cfg, 'sent', sent.concat([sig]).slice(-60));
  addPending(cfg, r.code, ev);

  if (isDemo()) return setSave('Demo mode – nothing was sent.');
  if (!cfg.backend.form.action) return setSave('Saved on this iPad. (The teacher list is not connected yet.)');
  try {
    setSave('Sending to your teacher …');
    await submitToForm(cfg, r);
    setSave('Sent to your teacher.');
    verifyLater(r.code, ev);
  } catch {
    setSave('No connection right now. Your stamp is saved on this iPad – open this page again later or tell your teacher.');
  }
}

async function verifyLater(code, ev) {
  if (!cfg.backend.appsScriptUrl) return;
  await new Promise((res) => setTimeout(res, 4000));
  try {
    const { events, source } = await loadEvents(cfg, code);
    if (source === 'live' && events.some((e) => !e.pending && signature(e) === signature(ev))) setSave('Saved in your teacher\'s list.');
  } catch { /* */ }
}

function setSave(text) {
  const el = document.getElementById('save-state');
  if (el) el.textContent = text;
}

function confirmCode(mine, theirs) {
  return new Promise((resolve) => {
    const ov = document.getElementById('overlay');
    ov.innerHTML = `
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="cc-title">
        <h2 id="cc-title">Check your code</h2>
        <p class="note" style="margin:0">This result is for <strong>${esc(theirs)}</strong>, but this iPad uses <strong>${esc(mine)}</strong>.</p>
        <p class="hint-de" lang="de" style="margin:0">Der Code im Ergebnis passt nicht zu deinem iPad. Wahrscheinlich hast du dich im Coach vertippt. Sende nur, wenn ${esc(theirs)} wirklich dein Code ist.</p>
        <button type="button" class="btn" id="cc-yes">${esc(theirs)} is my code – send</button>
        <button type="button" class="btn ghost" id="cc-no">Cancel</button>
      </div>`;
    ov.hidden = false;
    const done = (val) => { ov.hidden = true; ov.innerHTML = ''; resolve(val); };
    ov.querySelector('#cc-yes').addEventListener('click', () => {
      const t = getTraveller(cfg);
      setTraveller(cfg, theirs, t.course);
      done(true);
    });
    ov.querySelector('#cc-no').addEventListener('click', () => done(false));
    ov.querySelector('#cc-no').focus();
  });
}

/* ---------- Stempel-Moment ---------- */

function renderMoment(r, ev, before, after, warnings, already) {
  const s = cfg.byId[r.station];
  const coach = cfg.agents[s.coach]?.name || 'Coach';
  const prev = before.best[s.id];
  const head = !prev ? 'Stamp collected!' : r.n > prev.n ? 'New best result!' : 'Visit saved!';
  const subline = `${s.skill} · ${s.medium === 'paper' ? 'worksheet checked by your' : 'with your'} ${coach}`;
  const opened = newlyOpened(before, after);
  const openedText = opened.map((o) => `${cfg.byId[o.id].place}${o.status === 'skipped' ? ' (express)' : ''}`);
  const step = nextStep(cfg, ev);

  app.innerHTML = `
    <div class="moment">
      <div class="stamp-land">${stampHTML(cfg, s, { size: 196, kind: 'done', date: fmtDate(ev.ts) })}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center">
        <h1>${esc(head)}</h1>
        ${UI.brush(240)}
        <div class="sub" style="font-size:16px">${esc(subline)}</div>
      </div>
      <div class="two">
        <div class="thought"><span>You thought</span><span class="big" aria-label="${r.self} of 4">${stars(r.self)}</span></div>
        <div class="shown"><span>You showed</span><span class="big" aria-label="${r.n} of 4">${stars(r.n)}</span></div>
      </div>
      <div class="calib-big">${esc(calibration(cfg, ev))}</div>
      <div class="lines">
        ${r.s ? `<div><span style="color:var(--sage)">${UI.check}</span><span><strong>Strong:</strong> ${esc(r.s)}</span></div>` : ''}
        ${step ? `<div>${UI.plus}<span><strong>Next step:</strong> ${esc(step)}</span></div>` : ''}
        ${prev && r.n <= prev.n ? `<div lang="de" class="hint-de">Dein bester Versuch (${stars(prev.n)}) zählt weiter.</div>` : ''}
      </div>
      ${openedText.length ? `<div class="new-box">${UI.pin}<span><strong>New on your map:</strong> ${esc(joinList(openedText))} ${openedText.length > 1 ? 'are' : 'is'} open.</span></div>` : ''}
      ${warnings.length ? `<div class="hint-de" lang="de">${warnings.map(esc).join('<br>')}</div>` : ''}
      <a class="btn full" id="back" href="${link('index.html', { st: s.id })}">Back to the map</a>
      <div class="save-state" id="save-state" role="status">${already ? '' : '…'}</div>
      <div class="hint-de" lang="de" style="text-align:center">${esc(cfg.texts.privacy)}</div>
    </div>`;

  app.querySelector('#back').addEventListener('click', () => {
    try { sessionStorage.setItem('arh.just', JSON.stringify({ station: s.id, opened: opened.map((o) => o.id) })); } catch { /* */ }
  });
}

function joinList(a) {
  if (a.length <= 1) return a.join('');
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}
