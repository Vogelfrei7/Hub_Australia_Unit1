// Logik-Test ohne Browser:  node docs/tests/routing.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { progress, diff, normaliseEvent, validate, parseBlock, parseFromURL, stepInfo } from '../../hub/assets/js/core.js';

const cfg = JSON.parse(readFileSync(new URL('../../hub/config.json', import.meta.url)));
cfg.codeRe = new RegExp(cfg.codePattern);
cfg.routeById = Object.fromEntries(cfg.routes.map((r) => [r.id, r]));
for (const [id, t] of Object.entries(cfg.topics)) t.id = id;

let t = 0;
const ev = (station, n, f = [], h = 0) => normaliseEvent({ station, n, h, f, ts: ++t * 1000 });

// 1. Start: simple present ist "now", Check-in (bald) blockiert nicht, Schreibroute noch nicht offen
let p = progress(cfg, []);
assert.equal(p.status.SPR, 'now');
assert.equal(p.status.START, 'soon');
assert.equal(p.status.SP, 'soon');
assert.equal(p.now.writing, undefined);
assert.equal(Object.values(p.status).filter((s) => s === 'now').length, 1);

// 2. Arbeitsblatt → 1 Stern + Stempel, Station noch nicht fertig
p = progress(cfg, [ev('SPR-W1', 2, ['S', 'NEG'])]);
assert.equal(p.topics.SPR.stars, 1);
assert.equal(p.topics.SPR.stamp, true);
assert.equal(p.status.SPR, 'now');
assert.equal(p.stamps, 1);

// 3. Üben → 2 Sterne, Station fertig, Level-up wenn besser als Blatt
const w1 = ev('SPR-W1', 2, ['S']);
const p1 = ev('SPR-P', 3, []);
const before = progress(cfg, [w1]);
p = progress(cfg, [w1, p1]);
assert.equal(p.topics.SPR.stars, 2);
assert.equal(p.status.SPR, 'done');
assert.equal(p.achievements.levelup, true);
assert.deepEqual(diff(before, p).newAch, ['levelup']);

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

console.log('Alle Logik- und Validierungstests bestanden.');
