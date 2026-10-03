// Reisepass (passport.html): Steckbrief + Stempelraster.
import {
  loadConfig, loadEvents, deriveState, getTraveller, link, esc, stars, calibration,
  nextStep, fmtDate, stampHTML, UI,
} from './core.js';
import { openCodeDialog } from './ui.js';

const app = document.getElementById('app');
let cfg; let trav; let state;

main().catch((err) => {
  console.error(err);
  app.innerHTML = `<p class="err">Der Reisepass konnte nicht geladen werden (${esc(err.message)}).</p>`;
});

async function main() {
  cfg = await loadConfig();
  trav = getTraveller(cfg);
  if (!trav.code) {
    openCodeDialog(cfg, { closable: false, onSave: () => location.reload() });
    app.innerHTML = '';
    return;
  }
  const { events } = await loadEvents(cfg, trav.code);
  state = deriveState(cfg, events);
  render();
}

function render() {
  const c = state.counts;
  const avatar = cfg.rewards?.avatar
    ? `<img src="${esc(cfg.rewards.avatar)}" alt="Your traveller">`
    : `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg><span>Your traveller<br>coming soon</span>`;

  app.innerHTML = `
  <div class="passport">
    <section class="pp-page pp-left" aria-label="Traveller">
      <div>
        <span class="eyebrow">${esc(cfg.unit.subtitle.toUpperCase())}</span>
        <h1 class="pp-title">${esc(cfg.unit.passportTitle || 'Travel Passport')}</h1>
        ${UI.brush(220)}
      </div>
      <div class="profile">
        <div class="avatar">${avatar}</div>
        <div class="facts">
          <div><span class="k">CODE</span><span class="v">${esc(trav.code)}</span></div>
          <div><span class="k">CLASS</span><span class="v">${esc(trav.course || '–')}</span></div>
          <div><span class="k">DESTINATION</span><span class="v">${esc(cfg.unit.destination)}</span></div>
        </div>
      </div>
      <div class="counters">
        <div class="counter c1"><b>${c.stamps}</b><span>stamps</span></div>
        <div class="counter c2"><b>${c.express}</b><span>express</span></div>
        <div class="counter c3"><b>${c.toGo}</b><span>to go</span></div>
      </div>
      <p class="note" style="margin:0">Tap a stamp to see what you thought and what you showed.</p>
      <p class="hint-de" lang="de" style="margin:0">Mehr Stationen heißt: Du siehst mehr von Australien. Jeder Stempel zeigt, was du schon kannst.</p>
      <a class="btn" href="${link('index.html')}" style="margin-top:auto">${UI.back} Back to the map</a>
    </section>
    <section class="pp-page pp-right" aria-label="Stamps">
      <div class="stamp-grid">${cfg.stations.map(cell).join('')}</div>
    </section>
  </div>`;

  app.querySelectorAll('button.cell').forEach((b) => b.addEventListener('click', () => openStamp(b.dataset.id)));
}

function cell(s) {
  const st = state.status[s.id];
  const best = state.best[s.id];
  if (st === 'done') {
    return `<button type="button" class="cell" data-id="${s.id}" aria-label="${esc(s.place)} stamp, collected. Show details.">
      ${stampHTML(cfg, s, { size: 132, kind: 'done', date: fmtDate(best.ts) })}</button>`;
  }
  if (st === 'skipped') {
    return `<button type="button" class="cell" data-id="${s.id}" aria-label="${esc(s.place)}, express route. Show details.">
      ${stampHTML(cfg, s, { size: 124, kind: 'express' })}</button>`;
  }
  return `<div class="cell" role="img" aria-label="${esc(s.place)}: ${esc(cfg.texts.status[st])}">${stampHTML(cfg, s, { size: 132, kind: st === 'next' ? 'next' : st === 'open' ? 'open' : 'locked' })}</div>`;
}

function openStamp(id) {
  const s = cfg.byId[id];
  const st = state.status[id];
  const best = state.best[id];
  const n = (state.attempts[id] || []).length;
  const ov = document.getElementById('overlay');
  const body = st === 'done' && best
    ? `<div class="two">
         <div class="thought"><span>You thought</span><span class="big" aria-label="${best.self} of 4">${stars(best.self)}</span></div>
         <div class="shown"><span>You showed</span><span class="big" aria-label="${best.n} of 4">${stars(best.n)}</span></div>
       </div>
       <div class="calib">${esc(calibration(cfg, best))}</div>
       <div class="lines">
         ${best.s ? `<div><span style="color:var(--sage)">${UI.check}</span><span><strong>Strong:</strong> ${esc(best.s)}</span></div>` : ''}
         ${nextStep(cfg, best) ? `<div>${UI.plus}<span><strong>Next step:</strong> ${esc(nextStep(cfg, best))}</span></div>` : ''}
       </div>
       <p class="hint-de" lang="de" style="margin:0">${n > 1 ? `${n} Versuche – es zählt der beste.` : 'Du kannst die Station jederzeit wiederholen. Es zählt der beste Versuch.'}</p>`
    : `<p class="note" style="margin:0">${esc(cfg.texts.note.skipped)}</p>`;
  ov.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="sd-title">
      <button class="x" type="button" aria-label="Close">${UI.close}</button>
      <div style="display:flex;justify-content:center;padding:6px 0">${stampHTML(cfg, s, { size: 150, kind: st === 'done' ? 'done' : 'express', date: best ? fmtDate(best.ts) : '' })}</div>
      <h2 id="sd-title">${esc(s.place)}</h2>
      <div class="skill">${esc(s.skill)}</div>
      ${body}
      <a class="btn ghost" href="${link('index.html', { st: id })}">Show on the map</a>
    </div>`;
  ov.hidden = false;
  const close = () => {
    ov.hidden = true; ov.innerHTML = '';
    document.removeEventListener('keydown', onKey); ov.removeEventListener('click', onBg);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const onBg = (e) => { if (e.target === ov) close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('click', onBg);
  ov.querySelector('.x').addEventListener('click', close);
  ov.querySelector('.x').focus();
}
