// Logik-Test ohne Browser:  node docs/tests/routing.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { progress, diff, normaliseEvent, validate, parseBlock, parseFromURL, stepInfo, normaliseCode, animalOf, avatarSrc } from '../../hub/assets/js/core.js';

const cfg = JSON.parse(readFileSync(new URL('../../hub/config.json', import.meta.url)));
cfg.codeRe = new RegExp(cfg.codePattern);
cfg.routeById = Object.fromEntries(cfg.routes.map((r) => [r.id, r]));
for (const [id, t] of Object.entries(cfg.topics)) t.id = id;

let t = 0;
const ev = (station, n, f = [], h = 0) => normaliseEvent({ station, n, h, f, ts: ++t * 1000 });

// 1. Ganz am Anfang: Check-in ist "now", simple present wartet, Schreibroute noch nicht offen
let p = progress(cfg, []);
assert.equal(p.status.START, 'now');
assert.equal(p.status.SPR, 'later');
assert.equal(p.status.SP, 'later');
assert.equal(p.now.writing, undefined);
assert.equal(Object.values(p.status).filter((s) => s === 'now').length, 1);

// 1b. Nach dem Check-in (5 Startwerte): Start erledigt, simple present offen; Gold-Tipp erst bei 4 von 4
const base = [ev('SPR-B', 4), ev('SP-B', 1, ['IRREG', 'DID']), ev('PROG-B', 3, ['FORM']), ev('PP-B', 2, ['SINCE']), ev('GOING-B', 4)];
p = progress(cfg, base);
assert.equal(p.status.START, 'done');
assert.equal(p.status.SPR, 'now');
assert.equal(p.topics.SPR.base.n, 4);
assert.equal(p.topics.SPR.gold, true);
assert.equal(p.topics.SP.gold, false);
assert.equal(p.topics.PROG.gold, false, 'Startwert 3 reicht nicht mehr für Gold');
assert.equal(p.topics.SPR.stars, 0, 'Startwert gibt keinen Stern');

// 2. Arbeitsblatt → 1 Stern + Stempel, Station noch nicht fertig
p = progress(cfg, [...base, ev('SPR-W1', 2, ['S', 'NEG'])]);
assert.equal(p.topics.SPR.stars, 1);
assert.equal(p.topics.SPR.stamp, true);
assert.equal(p.status.SPR, 'now');
assert.equal(p.stamps, 2, 'Start-Stempel + Gold-Coast-Stempel');

// 2b. Goldenes Blatt allein zählt als Arbeitsblatt-Stern
p = progress(cfg, [...base, ev('SPR-W2', 4)]);
assert.equal(p.topics.SPR.stars, 1);

// 3. Üben → 2 Sterne, Station fertig, Level-up wenn besser als Blatt
const w1 = ev('SPR-W1', 2, ['S']);
const p1 = ev('SPR-P', 3, []);
const before = progress(cfg, [w1]);
p = progress(cfg, [w1, p1]);
assert.equal(p.topics.SPR.stars, 2);
assert.equal(p.status.SPR, 'done');
assert.equal(p.achievements.levelup, true);
assert.deepEqual(diff(before, p).newAch, ['levelup']);
assert.equal(progress(cfg, [...base, w1, p1]).status.SP, 'now', 'nach simple present geht es zum Great Barrier Reef');
assert.equal(stepInfo(cfg, 'SP-W2').kind, 'extra');
// 3b. Neue Reihenfolge: SP → PP (Outback) → SPPP (Darwin); Lagerfeuer öffnet eine spätere Station für alle
assert.deepEqual(cfg.routes[0].stops.slice(2, 6), ['SP', 'PP', 'SPPP', 'PROG']);
p = progress(cfg, [...base, w1, p1], { open: ['PP'] });
assert.equal(p.status.SP, 'now', 'Van bleibt beim simple past');
assert.equal(p.status.PP, cfg.topics.PP.status === 'soon' ? 'soon' : 'open');
assert.equal(Object.values(p.status).filter((s) => s === 'now').length, 1);
// 3c. Kontrast-Station zählt nicht als eigene Zeitform (Achievement „All 5 tenses“)
assert.equal(cfg.topics.SPPP.contrast, true);
assert.equal(cfg.routes[0].stops.filter((id) => /^\d+$/.test(cfg.topics[id].number) && !cfg.topics[id].contrast).length, 5);
// 3d. Gast-Codes: Koala, vorbereitete Reise bis Darwin
assert.equal(avatarSrc(cfg, 'GAST-KO01'), 'assets/img/animals/koala.webp');
const guestPr = progress(cfg, cfg.guest.events.map(normaliseEvent), { open: ['SPPP'] });
assert.equal(guestPr.status.PP, 'done');
assert.ok(['now', 'soon'].includes(guestPr.status.SPPP));

// 4. Dritter Stern: Zusatzblatt ODER zweite Übung
assert.equal(progress(cfg, [w1, p1, ev('SPR-W2', 4)]).topics.SPR.stars, 3);
assert.equal(progress(cfg, [w1, p1, ev('SPR-P', 2)]).topics.SPR.stars, 3);
assert.equal(progress(cfg, [w1, ev('SPR-P', 2)]).topics.SPR.stars, 2, 'eine Übung allein = kein Extra');

// 5. Bester Versuch zählt
assert.equal(progress(cfg, [w1, ev('SPR-P', 4), ev('SPR-P', 1)]).topics.SPR.p.n, 4);

// 6. Schritt-IDs
assert.equal(stepInfo(cfg, 'SPR-W1').kind, 'sheet');
assert.equal(stepInfo(cfg, 'SPR-W2').kind, 'extra');
assert.equal(stepInfo(cfg, 'SPR-P').kind, 'practice');
assert.equal(stepInfo(cfg, 'SPR-F').kind, 'final');
assert.equal(stepInfo(cfg, 'SPR-B').kind, 'baseline');
assert.equal(stepInfo(cfg, 'G4'), null);

// 7. Validierung: Link (inkl. Doppelkodierung und Apostroph) und Einfügezeile
const fromUrl = parseFromURL("?code=tiger-k7q2&st=SPR-W1&n=3&h=0&f=S%2CNEG%2CXYZ&s=Questions%2520correct.&fb=After%20doesn't%2C%20use%20the%20base%20form.");
let v = validate(cfg, fromUrl);
assert.ok(v.ok, v.errors.join());
assert.equal(v.result.code, 'TIGER-K7Q2');
assert.deepEqual(v.result.f, ['S', 'NEG']);
assert.equal(v.result.s, 'Questions correct.');
assert.equal(v.result.fb, "After doesn't, use the base form.");
assert.equal(v.warnings.length, 1);
v = validate(cfg, parseBlock("```\nTIGER-K7Q2 | - | SPR-P | 2 | - | 1 | NEG | Good questions. | Base form after doesn't.\n```"));
assert.ok(v.ok, v.errors.join());
assert.equal(validate(cfg, { ...fromUrl, n: '5' }).ok, false);
assert.equal(validate(cfg, { ...fromUrl, code: 'Max Mustermann' }).ok, false);
assert.equal(validate(cfg, { ...fromUrl, station: 'XYZ-P' }).ok, false);

// 8. Deutsche Tiernamen: Umlaute werden umgewandelt, Anzeige mit Umlaut, Bild englisch
assert.equal(normaliseCode(' bär-k7q2 '), 'BAER-K7Q2');
assert.equal(normaliseCode('Löwe-AB12'), 'LOEWE-AB12');
assert.ok(cfg.codeRe.test(normaliseCode('Eichhörnchen'.slice(0, 0) + 'EICHHORN-AB12')));
assert.equal(animalOf(cfg, 'BAER-K7Q2'), 'Bär');
assert.equal(avatarSrc(cfg, 'EICHHORN-K7Q2'), 'assets/img/animals/squirrel.webp');
assert.equal(avatarSrc(cfg, 'TIGER-K7Q2'), 'assets/img/animals/tiger.webp');

console.log('Alle Logik- und Validierungstests bestanden.');
