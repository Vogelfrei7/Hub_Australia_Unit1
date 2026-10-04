// Pass v2 (passport.html): Steckbrief, Stempel nach Routen, Bonus, Achievements.
import { loadConfig, loadEvents, progress, getTraveller, link, esc, fmtDate, stampHTML, slotHTML, badgeHTML, starOne, animalOf, UI } from './core.js?v=2.0';
import { openCodeDialog, headerHTML, wireCodePill, openDialog } from './ui.js?v=2.0';

const app = document.getElementById('app');
let cfg; let trav; let pr;

main().catch((err) => { console.error(err); app.innerHTML = `<p class="err">Der Pass konnte nicht geladen werden (${esc(err.message)}).</p>`; });

async function main() {
  cfg = await loadConfig();
  trav = getTraveller(cfg);
  if (!trav.code) { openCodeDialog(cfg, { closable: false, onSave: () => location.reload() }); return; }
  const { events } = await loadEvents(cfg, trav.code);
  pr = progress(cfg, events);
  render();
}

function render() {
  // Tierbild zum Code (assets/img/animals/<tier>.webp); fehlt es, bleibt der Name stehen
  const avatarImg = `assets/img/animals/${trav.code.split('-')[0].toLowerCase()}.webp`;
  app.innerHTML = `
  ${headerHTML(cfg, { code: trav.code, page: 'passport' })}
  <div class="passport">
    <section class="pp-page" aria-label="Traveller">
      <div><h1 class="pp-title">${esc(cfg.unit.passportTitle)}</h1>${UI.brush(220)}<span class="de">(Mein Reisepass)</span></div>
      <div class="profile">
        <div class="avatar"><img src="${esc(avatarImg)}" alt="${esc(animalOf(trav.code))}" onerror="this.remove()"><b>${esc(animalOf(trav.code))}</b><span>your animal</span></div>
        <div class="facts">
          <div><span class="k">CODE</span><span class="v">${esc(trav.code)}</span></div>
          <div><span class="k">CLASS</span><span class="v">${esc(trav.course || '–')}</span></div>
        </div>
      </div>
      <div class="counter"><b>${pr.stamps}</b><span><strong>of ${pr.stampSlots} stamps</strong><br>(von ${pr.stampSlots} Stempeln) · ${pr.starCount} ${starOne(true, 15)} stars (Sterne)</span></div>
      <div class="sec-h"><b>Achievements</b></div>
      <div class="badges">${cfg.achievements.map((a) => badgeHTML(cfg, a, pr.achievements[a.id], 58)).join('')}</div>
      <a class="btn" href="${link('index.html')}" style="margin-top:auto">${UI.back}<span>Back to the map <span class="de-inline">(Zur Karte)</span></span></a>
    </section>
    <section class="pp-page" aria-label="Stamps">
      ${cfg.routes.map((r) => `
        <div class="sec-h"><i style="background:${r.color};border-radius:${r.shape === 'square' ? '5px' : '50%'}"></i><b style="color:${r.color}">${esc(r.name)}</b><span class="de">(${esc(r.nameDe)})</span></div>
        <div class="grid4">${r.stops.map((id) => cell(id, r)).join('')}</div>`).join('')}
      <div class="sec-h"><i style="background:#3F8E99;border-radius:50%"></i><b style="color:#1F5F68">Bonus</b></div>
      <div class="grid4">${Object.entries(cfg.bonus || {}).map(([id, b]) => `<div class="cell">${pr.finalDone
        ? stampHTML(cfg, { place: b.place, name: b.name, stamp: { shape: 'circle', ink: '#1F5F68', icon: 'flag' } }, { size: 130 })
        : `<div class="slot" style="width:130px;height:130px;border-radius:22px;border-color:#3F8E99;background:#F1F8F8"><span class="slot-place" style="color:#1F5F68">${esc(b.name)}</span><span class="slot-sub" style="color:#1F5F68">opens ${esc(b.opens)}</span></div>`}</div>`).join('')}</div>
    </section>
  </div>`;
  wireCodePill(cfg);
  app.querySelectorAll('button.cell').forEach((b) => b.addEventListener('click', () => details(b.dataset.id)));
}

function cell(id, route) {
  const def = cfg.topics[id]; const t = pr.topics[id];
  if (t.stamp) {
    return `<button type="button" class="cell" data-id="${id}" aria-label="${esc(def.place)} stamp, ${t.stars} of 3 stars. Show details.">
      ${stampHTML(cfg, def, { size: 128, stars: t.stars, date: fmtDate((t.p || t.w1 || t.last).ts) })}</button>`;
  }
  return `<div class="cell">${slotHTML(def, { size: 124, state: pr.status[id], route })}</div>`;
}

function details(id) {
  const def = cfg.topics[id]; const t = pr.topics[id];
  const last = t.last;
  const row = (on, en, de) => `<li class="step ${on ? 'done' : ''}"><span>${on ? '✓' : '○'}</span><span><b>${en}</b><br><span class="de">${de}</span></span></li>`;
  openDialog(`
    <div style="display:flex;justify-content:center">${stampHTML(cfg, def, { size: 160, stars: t.stars })}</div>
    <h2>${esc(def.place)}</h2>
    <div class="skill">${esc(def.name)}</div>
    <ul class="steps">
      ${row(!!t.w1, 'Worksheet', 'Arbeitsblatt')}${row(!!t.p, 'Practice', 'Üben mit dem Coach')}${row(t.extra, 'Extra', 'Zusatz')}
    </ul>
    ${last?.s ? `<div class="two"><div class="good"><b>Well done (Gut gemacht)</b>${esc(last.s)}</div>${last.fb ? `<div class="tip"><b>Tip (Tipp)</b>${esc(last.fb)}</div>` : ''}</div>` : ''}
    <a class="btn ghost" href="${link('index.html', { st: id })}">Show on the map (Auf der Karte zeigen)</a>`, { label: def.place });
}
