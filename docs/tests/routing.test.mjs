// Routing-Test ohne Browser:  node docs/tests/routing.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { deriveState, normaliseEvent, validate, parseBlock } from '../../hub/assets/js/core.js';

const cfg = JSON.parse(readFileSync(new URL('../../hub/config.json', import.meta.url)));
cfg.byId = Object.fromEntries(cfg.stations.map((s) => [s.id, s]));
cfg.codeRe = new RegExp(cfg.codePattern);

let t = 0;
const ev = (station, n, f = [], self = 2) => normaliseEvent({ station, n, self, h: 0, f, ts: ++t * 1000 });
const st = (events) => deriveState(cfg, events).status;
const pick = (s, ids) => ids.map((id) => `${id}:${s[id]}`).join(' ');

// 1. Vor dem Check-in: nur G0
let s = st([]);
assert.equal(s.G0, 'next');
assert.ok(['G1', 'G6', 'W1'].every((id) => s[id] === 'locked'));

// 2. Check-in mit Fehlern in simple past + going to: G1, G3 Pflicht und sofort offen; G2, G4, G5 Express
const g0 = ev('G0', 2, ['SP-IRREG', 'GOING-BE']);
s = st([g0]);
assert.equal(s.G1, 'next', pick(s, ['G1']));
assert.equal(s.G3, 'open', 'alle Pflichtstationen gleichzeitig offen');
assert.equal(s.G2, 'skipped');
assert.equal(s.G4, 'skipped');
assert.equal(s.G5, 'skipped');
assert.equal(s.G6, 'locked', 'G6 erst nach allen Pflichtstationen');
assert.equal(s.W1, 'open');
assert.equal(Object.values(s).filter((x) => x === 'next').length, 1, 'genau ein Next stop');

// 3. Reihenfolge frei: erst G3, dann ist G1 der naechste Stopp
s = st([g0, ev('G3', 3)]);
assert.equal(s.G1, 'next');
assert.equal(s.G6, 'locked');

// 4. Beide Pflichtstationen erledigt: G6 offen
s = st([g0, ev('G3', 3), ev('G1', 2)]);
assert.equal(s.G6, 'next');
assert.equal(s.G7, 'locked');

// 5. Check-in Niveau 1: alles Pflicht
s = st([ev('G0', 1, [])]);
assert.equal(s.G1, 'next');
const state1 = deriveState(cfg, [ev('G0', 1, [])]);
assert.equal(state1.express.length, 0);

// 6. Bester Versuch zaehlt
const best = deriveState(cfg, [g0, ev('G1', 3), ev('G1', 1)]).best.G1;
assert.equal(best.n, 3);

// 7. Tipp aus dem Schreiben an G7, verschwindet nach G7 mit Niveau >= 3
const w = [g0, ev('W1', 3), ev('W2', 2, ['PP-TIME'])];
assert.equal(deriveState(cfg, w).tips.G7?.code, 'PP-TIME');
assert.equal(deriveState(cfg, [...w, ev('G7', 3)]).tips.G7, undefined);

// 8. Validierung & Block
const block = parseBlock('```\nfuchs-k7q2 | - | g4 | 3 | 2 | 1 | PROG-FORM, XYZ | Good. | Check -ing.\n```');
const v = validate(cfg, block);
assert.ok(v.ok, v.errors.join());
assert.equal(v.result.code, 'FUCHS-K7Q2');
assert.deepEqual(v.result.f, ['PROG-FORM']);
assert.equal(v.warnings.length, 1);
assert.equal(validate(cfg, { ...block, n: '5' }).ok, false);
assert.equal(validate(cfg, { ...block, code: 'Max Mustermann' }).ok, false);

// 9. Neues Format der Themen-Coaches (ohne Selbsteinschaetzung, Schritt-IDs, eigene Fehlerbereiche)
const v2 = validate(cfg, { code: 'FUCHS-K7Q2', station: 'SPR-W1', n: '3', self: '', h: '0', f: 'S,NEG,G0X', s: 'Challenge box solved.', fb: "After doesn't, use the base form." });
assert.ok(v2.ok, v2.errors.join());
assert.equal(v2.result.self, null);
assert.deepEqual(v2.result.f, ['S', 'NEG']);
assert.equal(v2.result.fb, "After doesn't, use the base form.");
assert.ok(validate(cfg, { code: 'FUCHS-K7Q2', station: 'SPR-P', n: '2', h: '1', f: '-' }).ok);
assert.ok(validate(cfg, { code: 'FUCHS-K7Q2', station: 'SPR-W2', n: '4', h: '0', f: '-' }).ok);
assert.equal(validate(cfg, { code: 'FUCHS-K7Q2', station: 'XYZ-P', n: '2', h: '0', f: '-' }).ok, false);
const blk = parseBlock("FUCHS-K7Q2 | - | SPR-W1 | 3 | - | 0 | S, NEG | Challenge box solved. | After doesn't, use the base form.");
assert.ok(validate(cfg, blk).ok);

console.log('Alle Routing- und Validierungstests bestanden.');
