// Gemeinsame UI-Bausteine: Code-Dialog, Kopieren, Kopfzeile.
import { esc, normaliseCode, setTraveller, getTraveller, isDemo, link, UI } from './core.js';

export function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
      return true;
    }
  } catch { /* fall through */ }
  return legacyCopy(text);
}

function legacyCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

// Code einmalig eingeben. closable=false beim ersten Start.
export function openCodeDialog(cfg, { closable = true, onSave } = {}) {
  const ov = document.getElementById('overlay');
  const trav = getTraveller(cfg);
  const courseField = cfg.courses.length > 1
    ? `<label class="fld">Class
         <select class="input" id="cd-course">${cfg.courses.map((c) => `<option ${c === trav.course ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
       </label>`
    : '';
  ov.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="cd-title">
      ${closable ? `<button class="x" type="button" aria-label="Close">${UI.close}</button>` : ''}
      <h2 id="cd-title">${trav.code ? 'Your traveller code' : 'Welcome on board!'}</h2>
      ${UI.brush(200)}
      <form id="cd-form" class="fld" novalidate style="gap:14px">
        <label class="fld">Traveller code
          <input class="input" id="cd-code" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"
                 inputmode="text" placeholder="${esc(cfg.codeExample)}" value="${esc(trav.code || '')}" aria-describedby="cd-help">
        </label>
        ${courseField}
        <div class="err" id="cd-err" hidden></div>
        <button class="btn" type="submit">${trav.code ? 'Save code' : 'Start my trip'}</button>
      </form>
      <p class="hint-de" id="cd-help">${esc(cfg.texts.codeHelp)}${trav.code ? ' Ändere den Code nur, wenn du dich vertippt hast.' : ''}</p>
    </div>`;
  ov.hidden = false;
  const input = ov.querySelector('#cd-code');
  setTimeout(() => input.focus(), 30);
  const close = () => { ov.hidden = true; ov.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape' && closable) close(); };
  document.addEventListener('keydown', onKey);
  ov.querySelector('.x')?.addEventListener('click', close);
  ov.querySelector('#cd-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = normaliseCode(input.value);
    const err = ov.querySelector('#cd-err');
    if (!cfg.codeRe.test(code)) {
      err.textContent = `Dieser Code passt nicht. Er sieht so aus: ${cfg.codeExample} (Wort, Bindestrich, 4 Zeichen).`;
      err.hidden = false;
      input.focus();
      return;
    }
    const course = ov.querySelector('#cd-course')?.value || trav.course || cfg.courses[0];
    setTraveller(cfg, code, course);
    close();
    onSave && onSave(code);
  });
}

export function headerHTML(cfg, { title, sub, code, right = '' }) {
  return `
  <header class="top">
    <div>
      <h1 class="h1">${esc(title)}</h1>
      ${UI.brush(250)}
      <div class="sub">${sub}</div>
    </div>
    <div class="actions">
      ${isDemo() ? `<span class="demo-banner">Demo data · <a href="${location.pathname}?demo=0">exit</a></span>` : ''}
      ${code ? `<button type="button" class="pill-btn" id="code-pill" aria-label="Your code ${esc(code)}. Tap to change.">${UI.person}<span>${esc(code)}</span></button>` : ''}
      ${right}
    </div>
  </header>`;
}

export { link };
