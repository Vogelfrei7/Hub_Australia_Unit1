// Gemeinsame UI-Bausteine: Kopfzeile, Code-Dialog, Regel-Fenster, Kopieren.
import { esc, bold, normaliseCode, setTraveller, getTraveller, isDemo, link, UI } from './core.js?v=2.0';

export function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
      return true;
    }
  } catch { /* */ }
  return legacyCopy(text);
}
function legacyCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

// Dialog-Grundgerüst mit Escape, Klick daneben (nur wenn closable) und Fokus
export function openDialog(html, { closable = true, label = 'Dialog', wide = false } = {}) {
  const ov = document.getElementById('overlay');
  ov.innerHTML = `<div class="dialog${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(label)}">
    ${closable ? `<button class="x" type="button" aria-label="Close (Schließen)">${UI.close}</button>` : ''}${html}</div>`;
  ov.hidden = false;
  document.body.style.overflow = 'hidden';
  const close = () => {
    ov.hidden = true; ov.innerHTML = ''; document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey); ov.removeEventListener('click', onBg);
  };
  const onKey = (e) => { if (e.key === 'Escape' && closable) close(); };
  const onBg = (e) => { if (e.target === ov && closable) close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', onBg);
  ov.querySelector('.x')?.addEventListener('click', close);
  setTimeout(() => (ov.querySelector('input, .x, button') || ov).focus(), 30);
  return { root: ov.firstElementChild, close };
}

export function openCodeDialog(cfg, { closable = true, onSave } = {}) {
  const trav = getTraveller(cfg);
  const courseField = cfg.courses.length > 1
    ? `<label class="fld">Class (Klasse)<select class="input" id="cd-course">${cfg.courses.map((c) => `<option ${c === trav.course ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>`
    : '';
  const d = openDialog(`
    <h2>${trav.code ? 'Your code' : 'Welcome on board!'}</h2>
    ${UI.brush(200)}
    <p class="note" style="margin:0">Type in the code from your code card. <span class="de">(Gib den Code von deiner Code-Karte ein.)</span></p>
    <form id="cd-form" class="fld" novalidate style="gap:14px">
      <label class="fld">Code
        <input class="input" id="cd-code" autocomplete="off" autocapitalize="characters" spellcheck="false"
               placeholder="${esc(cfg.codeExample)}" value="${esc(trav.code || '')}" aria-describedby="cd-help">
      </label>
      ${courseField}
      <div class="err" id="cd-err" hidden></div>
      <button class="btn" type="submit">${trav.code ? 'Save (Speichern)' : 'Start my trip (Los geht’s)'}</button>
    </form>
    <p class="hint-de" id="cd-help">${esc(cfg.texts.codeHelp)}${trav.code ? ' Ändere den Code nur, wenn du dich vertippt hast.' : ''}</p>`,
  { closable, label: 'Code' });
  const input = d.root.querySelector('#cd-code');
  d.root.querySelector('#cd-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = normaliseCode(input.value);
    const err = d.root.querySelector('#cd-err');
    if (!cfg.codeRe.test(code)) {
      err.textContent = `Dieser Code passt nicht. Er sieht so aus: ${cfg.codeExample} (Tier, Bindestrich, 4 Zeichen).`;
      err.hidden = false; input.focus(); return;
    }
    setTraveller(cfg, code, d.root.querySelector('#cd-course')?.value || trav.course || cfg.courses[0]);
    d.close();
    onSave && onSave(code);
  });
}

// Regel-Fenster einer Station
export function openRules(cfg, topic) {
  const rules = topic.rules || [];
  openDialog(`
    <h2>${esc(topic.name)}</h2>
    ${UI.brush(200)}
    <p class="note" style="margin:0">The most important rules. <span class="de">(Die wichtigsten Regeln.)</span></p>
    <div class="rules">
      ${rules.map((r, i) => `<div class="rule">
        <span class="rule-n">${i + 1}</span>
        <div><b>${esc(r.title)}</b> <span class="de">(${esc(r.de)})</span>
          <p>${bold(r.text)}<br><span class="de">${esc(r.textDe)}</span></p>
          ${r.ex ? `<p class="rule-ex">${bold(r.ex)}</p>` : ''}</div>
      </div>`).join('')}
    </div>
    ${topic.challenge ? `<div class="rule challenge"><span class="rule-n">!</span><div><b>${esc(topic.challenge.title)}</b><p>${bold(topic.challenge.text)}</p></div></div>` : ''}
    <button class="btn full" type="button" id="rules-ok">Got it! (Verstanden)</button>`,
  { label: `Rules: ${topic.name}`, wide: true });
  document.getElementById('rules-ok').addEventListener('click', () => document.querySelector('#overlay .x').click());
}

export function headerHTML(cfg, { code, stamps, slots, page = 'map' }) {
  return `
  <header class="top">
    <div>
      <h1 class="h1">${esc(cfg.unit.title)}</h1>
      ${UI.brush(250)}
      <div class="sub">${esc(cfg.unit.subtitle)}</div>
    </div>
    <nav class="actions" aria-label="Menu">
      ${isDemo() ? `<span class="demo-banner">Demo · <a href="${location.pathname}?demo=0">exit</a></span>` : ''}
      ${page !== 'how' ? `<a class="pill-btn soft" href="${link('how.html')}">${UI.help}<span>How it works <span class="de-inline">(So geht's)</span></span></a>` : ''}
      ${code ? `<button type="button" class="pill-btn" id="code-pill" aria-label="Your code ${esc(code)}">${UI.person}<span>${esc(code)}</span></button>` : ''}
      ${page === 'map'
        ? `<a class="btn round" href="${link('passport.html')}">${UI.passport}<span>My passport <span class="de-inline">(Mein Pass)</span>${stamps != null ? ` · ${stamps}/${slots}` : ''}</span></a>`
        : `<a class="btn round" href="${link('index.html')}">${UI.back}<span>Map <span class="de-inline">(Karte)</span></span></a>`}
    </nav>
  </header>`;
}

export function wireCodePill(cfg) {
  document.getElementById('code-pill')?.addEventListener('click', () => {
    if (isDemo()) return;
    openCodeDialog(cfg, { onSave: () => location.reload() });
  });
}
