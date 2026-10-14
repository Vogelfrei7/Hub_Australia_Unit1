/**
 * Australia Road Trip – Apps Script (an das Antwort-Sheet gebunden)
 *
 * 1. doGet?code=FUCHS-K7Q2  -> JSON mit allen Abgaben dieses Codes (fuer die Map)
 * 2. Menue "Road Trip"      -> Formular-Konfiguration ausgeben, Auswertung aktualisieren
 * 3. Auswertung             -> Blaetter "Matrix", "Fehlermuster", "Kalibrierung"
 *
 * Einrichtung: docs/setup.md, Abschnitt "Apps Script".
 * Inhalte (Stationen, Fehlerkatalog) kommen aus der config.json auf GitHub Pages.
 */

var SETTINGS = {
  CONFIG_URL: 'https://vogelfrei7.github.io/Hub_Australia_Unit1/hub/config.json',
  RESPONSE_SHEET: '',            // leer = das Blatt, das mit dem Formular verknuepft ist
  CODE_RE: /^[A-Z]{3,8}-[A-Z0-9]{4}$/,
  // Spaltenkoepfe = Fragetitel im Formular (Grossschreibung egal)
  HEADERS: {
    ts: ['ZEITSTEMPEL', 'TIMESTAMP'],
    code: ['CODE'],
    kurs: ['KURS', 'CLASS'],
    station: ['STATION'],
    n: ['NIVEAU', 'LEVEL'],
    self: ['SELBST', 'SELF'],
    h: ['HILFEN', 'HELP'],
    f: ['FEHLER', 'ERRORS'],
    s: ['STAERKE', 'STÄRKE', 'STRENGTH'],
    fb: ['FOERDER', 'FÖRDER', 'NEXT']
  },
  QUESTIONS: ['CODE', 'KURS', 'STATION', 'NIVEAU', 'SELBST', 'HILFEN', 'FEHLER', 'STAERKE', 'FOERDER'],
  // Farbskala 1 -> 4 (Terrakotta -> Petrol, bewusst nicht rot/gruen)
  LEVEL_COLORS: { 1: '#F2C2A6', 2: '#F6E2C2', 3: '#CBE5E2', 4: '#86C1C6' },
  EXPRESS_COLOR: '#EEF4FA',
  HEADER_COLOR: '#1B2A55'
};

/* ===================== Web-App (Map) ===================== */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.ping) return json_({ ok: true, ping: true, at: new Date().toISOString() });
  if (p.view === 'dashboard') {
    if (!isOwner_()) return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Kein Zugriff.</p>');
    return HtmlService.createHtmlOutputFromFile('Dashboard').setTitle('Klassen-Diagnostik')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  var code = String(p.code || '').trim().toUpperCase();
  if (!SETTINGS.CODE_RE.test(code)) return json_({ ok: false, error: 'bad-code' });
  var events = readEvents_().filter(function (r) { return r.code === code; }).map(function (r) {
    return { station: r.station, n: r.n, self: r.self, h: r.h, f: r.f, s: r.s, fb: r.fb, ts: r.ts };
  });
  return json_({ ok: true, code: code, events: events, klass: classState_() });
}

/* ===================== Unterricht steuern (Lagerfeuer, „Today in class“) ===================== */

// Stand für alle Kinder: { camps: { SPR: '2026-10-05T…' | false }, today: { mode, text, at } | null }
function classState_() {
  var raw = PropertiesService.getScriptProperties().getProperty('CLASS_STATE');
  var s = raw ? JSON.parse(raw) : {};
  return { camps: s.camps || {}, today: s.today || null };
}

function saveClassState_(s) {
  PropertiesService.getScriptProperties().setProperty('CLASS_STATE', JSON.stringify(s));
}

// Protokoll im Blatt "Unterricht" (Grundlage für die Zeitleiste in der KI-Auswertung)
function logLesson_(action, id, title) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Unterricht') || ss.insertSheet('Unterricht');
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Zeitpunkt', 'Aktion', 'Station', 'Titel']);
    sh.getRange(1, 1, 1, 4).setFontWeight('bold').setFontColor('#FFFFFF').setBackground(SETTINGS.HEADER_COLOR);
  }
  sh.appendRow([new Date(), action, id, title]);
}

// Lagerfeuer mit Datum: aus dem Dashboard gesetzt, sonst Vorgabe "lit" aus config.json
function campList_() {
  var cfg = loadConfig_();
  var st = classState_();
  return Object.keys(cfg.topics).filter(function (id) { return cfg.topics[id].camp; }).map(function (id) {
    var t = cfg.topics[id]; var c = t.camp;
    var lit = Object.prototype.hasOwnProperty.call(st.camps, id) ? st.camps[id] : (c.lit || false);
    return { id: id, place: t.place, name: t.name, title: c.title, titleDe: c.titleDe, lit: lit };
  });
}

function getClassControl() {
  if (!isOwner_()) throw new Error('Kein Zugriff');
  return { camps: campList_(), today: classState_().today };
}

function setCamp(id, lit) {
  if (!isOwner_()) throw new Error('Kein Zugriff');
  var cfg = loadConfig_();
  if (!cfg.topics[id] || !cfg.topics[id].camp) throw new Error('Unbekanntes Lagerfeuer: ' + id);
  var s = classState_();
  s.camps[id] = lit ? new Date().toISOString() : false;
  saveClassState_(s);
  logLesson_(lit ? 'Lagerfeuer angezündet' : 'Lagerfeuer gelöscht', id, cfg.topics[id].camp.titleDe || cfg.topics[id].camp.title);
  return getClassControl();
}

function setToday(mode, text) {
  if (!isOwner_()) throw new Error('Kein Zugriff');
  if (['together', 'coach', 'book', ''].indexOf(mode) < 0) throw new Error('Unbekannter Modus');
  var s = classState_();
  s.today = mode ? { mode: mode, text: String(text || '').slice(0, 120), at: new Date().toISOString() } : null;
  saveClassState_(s);
  if (mode) logLesson_('Today in class: ' + mode, '', s.today.text);
  return getClassControl();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== Daten lesen ===================== */

function responseSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (SETTINGS.RESPONSE_SHEET) return ss.getSheetByName(SETTINGS.RESPONSE_SHEET);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) if (sheets[i].getFormUrl()) return sheets[i];
  return sheets[0];
}

function readEvents_() {
  var sh = responseSheet_();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0].map(function (h) { return String(h).trim().toUpperCase(); });
  var col = {};
  Object.keys(SETTINGS.HEADERS).forEach(function (k) {
    col[k] = -1;
    SETTINGS.HEADERS[k].forEach(function (name) {
      if (col[k] === -1) {
        for (var i = 0; i < head.length; i++) if (head[i].indexOf(name) === 0) { col[k] = i; break; }
      }
    });
  });
  if (col.ts === -1) col.ts = 0;
  var get = function (row, k) { return col[k] === -1 ? '' : row[col[k]]; };
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var code = String(get(row, 'code')).trim().toUpperCase();
    if (!code) continue;
    var ts = get(row, 'ts');
    out.push({
      code: code,
      kurs: String(get(row, 'kurs')).trim(),
      station: String(get(row, 'station')).trim().toUpperCase(),
      n: num_(get(row, 'n')),
      self: num_(get(row, 'self')),
      h: num_(get(row, 'h')),
      f: String(get(row, 'f')).split(/[,;\s]+/).map(function (x) { return x.trim().toUpperCase(); })
        .filter(function (x) { return x && x !== '-' && x !== 'NONE'; }),
      s: clean_(get(row, 's')),
      fb: clean_(get(row, 'fb')),
      ts: ts instanceof Date ? ts.toISOString() : String(ts)
    });
  }
  return out;
}

// Klassen-Abgaben ohne Gäste (Codes GAST-…) und ohne Testcodes der Lehrkraft: für Auswertung, Dashboard und KI.
// Die Zeilen bleiben im Sheet, sie werden nur nicht mitgezählt.
function classEvents_() {
  var skip = {}; excludedCodes_().forEach(function (c) { skip[c] = true; });
  return readEvents_().filter(function (e) { return e.code.indexOf('GAST-') !== 0 && !skip[e.code]; });
}

function excludedCodes_() {
  return String(PropertiesService.getScriptProperties().getProperty('EXCLUDE_CODES') || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
}
function saveExcluded_(list) {
  var uniq = list.filter(function (c, i) { return c && list.indexOf(c) === i; }).sort();
  PropertiesService.getScriptProperties().setProperty('EXCLUDE_CODES', uniq.join(','));
  return uniq;
}

// Dashboard: einen Code als Testeingabe aus der Auswertung nehmen
function excludeCode(code) {
  if (!isOwner_()) throw new Error('Kein Zugriff');
  code = String(code || '').trim().toUpperCase();
  if (!code) throw new Error('Kein Code');
  saveExcluded_(excludedCodes_().concat([code]));
  return getDashboardData();
}

// Menü: Liste der Testcodes ansehen und bearbeiten
function editExcludedCodes() {
  var ui = SpreadsheetApp.getUi();
  var now = excludedCodes_();
  var r = ui.prompt('Testcodes ausschließen', 'Diese Codes zählen nicht in Dashboard und KI-Auswertung (die Zeilen bleiben im Sheet).\n' +
    'Codes mit Komma trennen. Leer lassen = alle wieder einbeziehen.\n\nAktuell: ' + (now.length ? now.join(', ') : 'keine'), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var list = saveExcluded_(r.getResponseText().toUpperCase().split(/[\s,;]+/).filter(Boolean));
  ui.alert('Gespeichert: ' + (list.length ? list.join(', ') : 'keine Testcodes') + '.');
}

function num_(v) { var n = Number(String(v).trim().replace(',', '.')); return isNaN(n) ? 0 : n; }
function clean_(v) { var s = String(v || '').trim(); return s === '-' ? '' : s; }

function loadConfig_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('config');
  if (hit) return JSON.parse(hit);
  var res = UrlFetchApp.fetch(SETTINGS.CONFIG_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('config.json nicht erreichbar: ' + SETTINGS.CONFIG_URL);
  var txt = res.getContentText();
  try { cache.put('config', txt, 300); } catch (e) { /* zu gross fuer Cache */ }
  return JSON.parse(txt);
}

/* ===================== Menue ===================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Road Trip')
    .addItem('Dashboard öffnen', 'openDashboard')
    .addItem('Auswertung aktualisieren', 'refreshAnalysis')
    .addItem('Testcodes ausschließen …', 'editExcludedCodes')
    .addItem('KI-Schlüssel hinterlegen', 'setApiKey')
    .addItem('Formular-Konfiguration anzeigen (entry-IDs)', 'showFormConfig')
    .addSeparator()
    .addItem('Neues Formular anlegen (nur falls noch keins existiert)', 'createForm')
    .addItem('Automatik einschalten (bei jeder Abgabe aktualisieren)', 'installTriggers')
    .addToUi();
}

/* ===================== Formular ===================== */

// Legt ein passendes Formular an und verknuepft es mit diesem Sheet.
function createForm() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var form = FormApp.create('Australia Road Trip – Abgaben');
  form.setDescription('Wird automatisch von abgabe.html befüllt. Bitte nicht von Hand ausfüllen.');
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  try { form.setRequireLogin(false); } catch (e) { /* nur in Workspace-Domains verfuegbar */ }
  SETTINGS.QUESTIONS.forEach(function (q) { form.addTextItem().setTitle(q); });
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  showFormConfig_(form);
}

function showFormConfig() {
  var url = SpreadsheetApp.getActiveSpreadsheet().getFormUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert('Mit diesem Sheet ist kein Formular verknüpft. Menü "Neues Formular anlegen" nutzen.');
    return;
  }
  showFormConfig_(FormApp.openByUrl(url));
}

// entry-IDs ermitteln: vorausgefuellten Link erzeugen und auslesen.
function showFormConfig_(form) {
  var resp = form.createResponse();
  var items = form.getItems(FormApp.ItemType.TEXT);
  var byTitle = {};
  items.forEach(function (it) {
    var t = it.getTitle().trim().toUpperCase();
    resp.withItemResponse(it.asTextItem().createResponse('X' + it.getId()));
    byTitle[t] = it.getId();
  });
  var pre = resp.toPrefilledUrl();
  var ids = {};
  pre.replace(/entry\.(\d+)=X(\d+)/g, function (_, entry, itemId) { ids[itemId] = entry; return ''; });
  var keys = { CODE: 'code', KURS: 'kurs', STATION: 'station', NIVEAU: 'niveau', SELBST: 'selbst', HILFEN: 'hilfen', FEHLER: 'fehler', STAERKE: 'staerke', FOERDER: 'foerder' };
  var entries = {};
  Object.keys(keys).forEach(function (title) { entries[keys[title]] = ids[byTitle[title]] || ''; });
  var action = form.getPublishedUrl().replace(/\/viewform.*$/, '/formResponse');
  var snippet = JSON.stringify({ action: action, entries: entries }, null, 2);
  var missing = Object.keys(entries).filter(function (k) { return !entries[k]; });
  var html = HtmlService.createHtmlOutput(
    '<p style="font-family:sans-serif">In <b>hub/config.json</b> unter <b>backend.form</b> einsetzen:</p>' +
    '<textarea style="width:100%;height:260px;font-family:monospace">' + snippet + '</textarea>' +
    (missing.length ? '<p style="color:#A9502B;font-family:sans-serif">Fehlende Fragen: ' + missing.join(', ') + ' – Fragetitel prüfen.</p>' : '') +
    '<p style="font-family:sans-serif;font-size:13px">Formular-Einstellungen prüfen: keine Anmeldung erforderlich, keine E-Mail-Erfassung, Antworten werden angenommen.</p>'
  ).setWidth(560).setHeight(420);
  SpreadsheetApp.getUi().showModalDialog(html, 'Formular-Konfiguration');
  Logger.log(snippet);
}

function installTriggers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'refreshAnalysis') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('refreshAnalysis').forSpreadsheet(ss).onFormSubmit().create();
  try { SpreadsheetApp.getUi().alert('Fertig: Die Auswertung wird jetzt nach jeder Abgabe aktualisiert.'); } catch (e) { /* Trigger-Kontext */ }
}

/* ===================== Auswertung ===================== */

// Schritt-IDs der Themen-Coaches: <THEMA>-W1 (Blatt), -W2 … (Zusatzblatt), -P (Üben), -F (Final check)
function stepInfo_(cfg, id) {
  var m = String(id || '').match(/^([A-Z]{2,6})-(W(\d)|P|F|B)$/);
  if (!m || !cfg.topics || !cfg.topics[m[1]]) return null;
  var kind = m[2] === 'P' ? 'practice' : m[2] === 'F' ? 'final' : m[2] === 'B' ? 'baseline' : (m[3] === '1' ? 'sheet' : 'extra');
  return { topicId: m[1], topic: cfg.topics[m[1]], kind: kind };
}

function refreshAnalysis() {
  var cfg = loadConfig_();
  var stations = cfg.stations.map(function (s) { return s.id; });
  var catalog = cfg.errorCatalog || {};
  var events = classEvents_().filter(function (e) { return stations.indexOf(e.station) !== -1 || stepInfo_(cfg, e.station); });
  events.sort(function (a, b) { return String(a.ts) < String(b.ts) ? -1 : 1; });

  // pro Code: Kurs, bester Versuch, letzter Versuch je Station
  var people = {};
  events.forEach(function (e) {
    var p = people[e.code] || (people[e.code] = { code: e.code, kurs: e.kurs, best: {}, last: {}, all: [] });
    if (e.kurs) p.kurs = e.kurs;
    var b = p.best[e.station];
    if (!b || e.n > b.n || (e.n === b.n && e.h < b.h)) p.best[e.station] = e;
    p.last[e.station] = e;
    p.all.push(e);
  });
  var list = Object.keys(people).map(function (k) { return people[k]; })
    .sort(function (a, b) { return (a.kurs + a.code) < (b.kurs + b.code) ? -1 : 1; });

  // Fehlerbereich-Beschriftung: Themen-Coaches (pro Thema) oder alter Gesamtkatalog
  var label = function (station, code) {
    var si = stepInfo_(cfg, station);
    if (si) return { structure: si.topic.name, label: (si.topic.areaLabels || {})[code] || code, key: si.topicId + '·' + code };
    var c = catalog[code] || {};
    return { structure: c.structure || '?', label: c.label || 'unbekannter Code', key: code, station: c.station || '' };
  };

  writeOverview_(cfg, list, label);
  writeClassPicture_(cfg, list, label);
  writeErrors_(list, label);
  var hasV1 = events.some(function (e) { return stations.indexOf(e.station) !== -1; });
  if (hasV1) writeMatrix_(cfg, stations, list, catalog);
  writeCalibration_(list);
}

// Überblick: pro Kind und Thema bestes Niveau je Schritt + aktuelle Fehlerbereiche + Vorschlag
function writeOverview_(cfg, list, label) {
  var sh = sheet_('Überblick');
  var topicIds = Object.keys(cfg.topics || {}).filter(function (t) {
    return list.some(function (p) { return Object.keys(p.best).some(function (s) { var si = stepInfo_(cfg, s); return si && si.topicId === t; }); });
  });
  var head = ['Kurs', 'Code'];
  topicIds.forEach(function (t) {
    var n = cfg.topics[t].name;
    head.push(n + ': Start', n + ': Blatt', n + ': Üben', n + ': Zusatz', n + ': Final', n + ': offene Fehlerbereiche', n + ': Vorschlag');
  });
  var rows = [head];
  var bg = [head.map(function () { return SETTINGS.HEADER_COLOR; })];
  list.forEach(function (p) {
    var row = [p.kurs, p.code];
    var colors = ['#FFFFFF', '#FFFFFF'];
    topicIds.forEach(function (t) {
      var best = { baseline: null, sheet: null, practice: null, extra: null, final: null };
      var lastByStep = {};
      Object.keys(p.best).forEach(function (s) {
        var si = stepInfo_(cfg, s);
        if (!si || si.topicId !== t) return;
        var b = p.best[s];
        if (!best[si.kind] || b.n > best[si.kind].n) best[si.kind] = b;
        lastByStep[s] = p.last[s];
      });
      ['baseline', 'sheet', 'practice', 'extra', 'final'].forEach(function (k) {
        row.push(best[k] ? best[k].n : '');
        colors.push(best[k] ? (SETTINGS.LEVEL_COLORS[best[k].n] || '#FFFFFF') : '#FFFFFF');
      });
      var open = {};
      Object.keys(lastByStep).forEach(function (s) { lastByStep[s].f.forEach(function (c) { open[label(s, c).label] = true; }); });
      row.push(Object.keys(open).join(', '));
      colors.push('#FFFFFF');
      var tip;
      if (!best.sheet) tip = 'Arbeitsblatt machen';
      else if (!best.practice) tip = 'Üben mit dem Coach';
      else if (best.practice.n <= 2) tip = 'noch eine Übungsrunde';
      else if (best.practice.n === 3) tip = 'optional: Zusatzblatt oder Runde';
      else tip = 'fertig – nächstes Thema';
      row.push(tip);
      colors.push('#FFFFFF');
    });
    rows.push(row);
    bg.push(colors);
  });
  sh.getRange(1, 1, rows.length, head.length).setValues(rows).setBackgrounds(bg).setFontColor('#1B2A55').setVerticalAlignment('middle');
  header_(sh, head.length);
  sh.getRange(1, 1, 1, head.length).setFontColor('#FFFFFF').setWrap(true);
  sh.setFrozenColumns(2);
  sh.autoResizeColumns(1, 2);
  sh.getRange(rows.length + 2, 1).setValue('Zahlen = bestes Niveau 1–4 (Terrakotta → Petrol). „Offene Fehlerbereiche“ = Fehler im jeweils letzten Versuch. Stand: ' + new Date().toLocaleString('de-DE'));
}

// Klassenbild: Wie viele Kinder haben aktuell Fehler in welchem Bereich? Mit Balkendiagramm – zum Zeigen geeignet.
function writeClassPicture_(cfg, list, label) {
  var sh = sheet_('Klassenbild');
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  var count = {};
  var withData = {};
  list.forEach(function (p) {
    var seen = {};
    Object.keys(p.last).forEach(function (s) {
      var si = stepInfo_(cfg, s);
      if (!si) return;
      withData[si.topicId + '|' + p.code] = true;
      p.last[s].f.forEach(function (c) { seen[si.topic.name + ': ' + label(s, c).label] = si.topicId; });
    });
    Object.keys(seen).forEach(function (k) { count[k] = (count[k] || 0) + 1; });
  });
  var kids = {};
  Object.keys(withData).forEach(function (k) { kids[k.split('|')[0]] = (kids[k.split('|')[0]] || 0) + 1; });
  var rows = [['Fehlerbereich', 'Kinder mit diesem Fehler (aktuell)']];
  Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).forEach(function (k) { rows.push([k, count[k]]); });
  sh.getRange(1, 1).setValue('Klassenbild: Wo braucht die Klasse noch Übung?').setFontSize(16).setFontWeight('bold').setFontColor('#1B2A55');
  sh.getRange(2, 1).setValue('Gezählt wird jedes Kind einmal pro Fehlerbereich, wenn der Fehler im letzten Versuch noch auftaucht. Kinder mit Ergebnissen: ' +
    Object.keys(kids).map(function (t) { return cfg.topics[t].name + ' ' + kids[t]; }).join(' · '));
  if (rows.length === 1) { sh.getRange(4, 1).setValue('Noch keine Fehler in den Themen-Coaches erfasst.'); return; }
  sh.getRange(4, 1, rows.length, 2).setValues(rows).setFontColor('#1B2A55');
  sh.getRange(4, 1, 1, 2).setFontWeight('bold').setFontColor('#FFFFFF').setBackground(SETTINGS.HEADER_COLOR);
  sh.autoResizeColumns(1, 2);
  var chart = sh.newChart().asBarChart()
    .addRange(sh.getRange(4, 1, rows.length, 2))
    .setPosition(4, 4, 0, 0)
    .setOption('title', 'Fehlerbereiche der Klasse (Anzahl Kinder)')
    .setOption('legend', { position: 'none' })
    .setOption('colors', ['#3F8E99'])
    .setOption('width', 620).setOption('height', Math.max(260, rows.length * 34))
    .build();
  sh.insertChart(chart);
}

function expressSet_(cfg, p, catalog) {
  var g0 = p.best[cfg.routing.checkIn];
  var out = {};
  if (!g0) return out;
  var weak = {};
  g0.f.forEach(function (c) { if (catalog[c] && catalog[c].station) weak[catalog[c].station] = true; });
  cfg.stations.forEach(function (s) {
    if (s.adaptive && !(g0.n <= cfg.routing.allMandatoryAtOrBelow || weak[s.id])) out[s.id] = true;
  });
  return out;
}

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  sh.clearConditionalFormatRules();
  return sh;
}

function header_(sh, cols) {
  sh.getRange(1, 1, 1, cols).setFontWeight('bold').setFontColor('#FFFFFF').setBackground(SETTINGS.HEADER_COLOR);
  sh.setFrozenRows(1);
}

function writeMatrix_(cfg, stations, list, catalog) {
  var sh = sheet_('Matrix');
  var head = ['Kurs', 'Code'].concat(stations).concat(['Stempel', 'Express', 'Hilfen Ø']);
  var rows = [head];
  var bg = [head.map(function () { return SETTINGS.HEADER_COLOR; })];
  list.forEach(function (p) {
    var exp = expressSet_(cfg, p, catalog);
    var row = [p.kurs, p.code];
    var colors = ['#FFFFFF', '#FFFFFF'];
    var stamps = 0; var expressCount = 0; var hSum = 0;
    stations.forEach(function (id) {
      var b = p.best[id];
      if (b) { row.push(b.n); colors.push(SETTINGS.LEVEL_COLORS[b.n] || '#FFFFFF'); stamps++; hSum += b.h; }
      else if (exp[id]) { row.push('E'); colors.push(SETTINGS.EXPRESS_COLOR); expressCount++; }
      else { row.push(''); colors.push('#FFFFFF'); }
    });
    row.push(stamps, expressCount, stamps ? Math.round((hSum / stamps) * 10) / 10 : '');
    colors.push('#FFFFFF', '#FFFFFF', '#FFFFFF');
    rows.push(row);
    bg.push(colors);
  });
  var range = sh.getRange(1, 1, rows.length, head.length);
  range.setValues(rows).setBackgrounds(bg).setHorizontalAlignment('center').setFontColor('#1B2A55');
  sh.getRange(1, 1, 1, head.length).setFontColor('#FFFFFF');
  header_(sh, head.length);
  sh.setFrozenColumns(2);
  sh.setColumnWidths(3, stations.length, 46);
  var note = rows.length + 2;
  sh.getRange(note, 1, 1, 1).setValue('Legende: 1–4 = bestes Niveau (Terrakotta → Petrol), E = Express (laut Check-in nicht nötig), leer = noch nicht besucht. Stand: ' + new Date().toLocaleString('de-DE'));
}

function writeErrors_(list, label) {
  var sh = sheet_('Fehlermuster');
  var agg = {};
  list.forEach(function (p) {
    p.all.forEach(function (e) {
      e.f.forEach(function (c) {
        var l = label(e.station, c);
        var k = (p.kurs || '-') + '|' + l.key;
        var a = agg[k] || (agg[k] = { kurs: p.kurs || '-', code: c, info: l, total: 0, students: {}, current: {} });
        a.total++;
        a.students[p.code] = true;
      });
    });
    // "aktuell": Fehler im jeweils letzten Versuch pro Station bzw. Schritt
    Object.keys(p.last).forEach(function (st) {
      p.last[st].f.forEach(function (c) {
        var k = (p.kurs || '-') + '|' + label(st, c).key;
        if (agg[k]) agg[k].current[p.code] = true;
      });
    });
  });
  var head = ['Kurs', 'Fehlercode', 'Thema', 'Beschreibung', 'Station', 'Nennungen gesamt', 'SuS gesamt', 'SuS aktuell'];
  var rows = [head];
  Object.keys(agg).map(function (k) { return agg[k]; })
    .sort(function (a, b) { return a.kurs === b.kurs ? Object.keys(b.current).length - Object.keys(a.current).length || b.total - a.total : (a.kurs < b.kurs ? -1 : 1); })
    .forEach(function (a) {
      rows.push([a.kurs, a.code, a.info.structure, a.info.label, a.info.station || '', a.total, Object.keys(a.students).length, Object.keys(a.current).length]);
    });
  sh.getRange(1, 1, rows.length, head.length).setValues(rows).setFontColor('#1B2A55');
  header_(sh, head.length);
  sh.autoResizeColumns(1, head.length);
  sh.getRange(rows.length + 2, 1).setValue('"SuS aktuell" = Fehler taucht im letzten Versuch einer Station noch auf. Hohe Werte = Thema für die ganze Klasse.');
}

function writeCalibration_(list) {
  // Nur Abgaben mit Selbsteinschätzung (die Themen-Coaches fragen keine mehr ab)
  list = list.map(function (p) {
    return { kurs: p.kurs, code: p.code, all: p.all.filter(function (e) { return e.self >= 1; }) };
  }).filter(function (p) { return p.all.length; });
  if (!list.length) {
    var old = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Kalibrierung');
    if (old) old.clear();
    return;
  }
  var sh = sheet_('Kalibrierung');
  var head = ['Kurs', 'Code', 'Abgaben', 'Ø Selbst', 'Ø Niveau', 'Ø Differenz (Selbst − Niveau)', 'Tendenz', 'Stationen überschätzt', 'Stationen unterschätzt'];
  var rows = [head];
  list.forEach(function (p) {
    var n = p.all.length;
    if (!n) return;
    var sSelf = 0; var sN = 0; var over = []; var under = [];
    p.all.forEach(function (e) {
      sSelf += e.self; sN += e.n;
      if (e.self > e.n && over.indexOf(e.station) === -1) over.push(e.station);
      if (e.self < e.n && under.indexOf(e.station) === -1) under.push(e.station);
    });
    var diff = (sSelf - sN) / n;
    var tend = diff >= 0.75 ? 'überschätzt sich' : diff <= -0.75 ? 'unterschätzt sich' : 'realistisch';
    rows.push([p.kurs, p.code, n, round1_(sSelf / n), round1_(sN / n), round1_(diff), tend, over.join(' '), under.join(' ')]);
  });
  sh.getRange(1, 1, rows.length, head.length).setValues(rows).setFontColor('#1B2A55');
  header_(sh, head.length);
  if (rows.length > 1) {
    var tr = sh.getRange(2, 7, rows.length - 1, 1);
    var rules = [
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('überschätzt sich').setBackground('#F8E1D3').setRanges([tr]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('unterschätzt sich').setBackground('#DDEFF0').setRanges([tr]).build()
    ];
    sh.setConditionalFormatRules(rules);
  }
  sh.autoResizeColumns(1, head.length);
  sh.getRange(rows.length + 2, 1).setValue('Grundlage: alle Abgaben. Schwelle für "über-/unterschätzt": mittlere Differenz ≥ 0,75 Stufen.');
}

function round1_(x) { return Math.round(x * 10) / 10; }

/* ===================== Lehrer-Dashboard ===================== */

// Nur die Lehrkraft (Besitzerin/Besitzer des Scripts) darf Klassendaten sehen.
function isOwner_() {
  try {
    var me = Session.getEffectiveUser().getEmail();
    var user = Session.getActiveUser().getEmail();
    return !!user && user === me;
  } catch (e) { return false; }
}

function openDashboard() {
  var html = HtmlService.createHtmlOutputFromFile('Dashboard').setWidth(1400).setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, 'Klassen-Diagnostik');
}

// Station für die Kinder offen? ("soon" mit "opensAt" öffnet sich ab diesem Zeitpunkt selbst, wie auf der Karte)
function stationOpen_(def) {
  if (!def || def.status !== 'soon') return true;
  return !!def.opensAt && Date.now() >= Date.parse(def.opensAt);
}

// Art einer Station: Grammatik (Blatt + Üben), Schreiben (1. Fassung + Endfassung, "drafts") oder Übungsseite ohne Coach ("page")
function topicKind_(def) { return def.drafts ? 'draft' : def.page ? 'page' : 'grammar'; }

// Anzeigename eines Schritts – beim Schreiben heißen W1/W2 anders als bei der Grammatik
function stepLabel_(kind, step) {
  if (kind === 'draft') return { sheet: '1. Fassung', extra: 'Endfassung' }[step] || step;
  if (kind === 'page') return { practice: 'Durchgang' }[step] || step;
  return { baseline: 'Check-in', sheet: 'Arbeitsblatt', practice: 'Üben', extra: 'Extra', final: 'Final check' }[step] || step;
}

// Liefert alle Kennzahlen für Dashboard.html. Allgemein: arbeitet mit jedem Thema aus config.topics.
function getDashboardData() {
  if (!isOwner_()) throw new Error('Kein Zugriff');
  var out = analysis_(loadConfig_());
  out.lastReport = lastAiReport_();
  out.klass = { camps: campList_(), today: classState_().today };
  out.aiReady = !!PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  return JSON.parse(JSON.stringify(out));
}

// Die eigentliche Auswertung (ohne Zugriffsprüfung): Dashboard und KI-Bericht rechnen mit denselben Zahlen.
function analysis_(cfg) {
  var events = classEvents_().filter(function (e) { return stepInfo_(cfg, e.station); });
  events.sort(function (a, b) { return String(a.ts) < String(b.ts) ? -1 : 1; });

  var topics = {};
  var codes = {};
  events.forEach(function (e) {
    var si = stepInfo_(cfg, e.station);
    var t = topics[si.topicId] || (topics[si.topicId] = { id: si.topicId, name: si.topic.name, place: si.topic.place, kind: topicKind_(si.topic),
      labels: si.topic.areaLabels || {}, areas: si.topic.areas || [], kids: {} });
    var k = t.kids[e.code] || (t.kids[e.code] = { code: e.code, kurs: e.kurs, attempts: [] });
    k.attempts.push({ kind: si.kind, step: e.station, n: e.n, h: e.h, f: e.f, ts: e.ts });
    var c = codes[e.code] || (codes[e.code] = { code: e.code, kurs: e.kurs, last: e.ts, count: 0 });
    c.last = e.ts; c.count++;
  });

  var bestOf = function (list) { return list.reduce(function (b, a) { return !b || a.n > b.n ? a : b; }, null); };
  var lastOf = function (list) { return list.length ? list[list.length - 1] : null; };
  var out = { generated: new Date().toISOString(), classSizes: cfg.classSizes || {}, topics: [], kids: [], recommendations: [] };
  var kidGrowth = {};   // je Kind über alle Grammatik-Themen: Summe Startwert / Summe jetzt
  var sum = { pairs: 0, pairsFixed: 0, growthKids: 0, growthUp: 0, growthBase: 0, growthNow: 0, improved: 0, compared: 0, drafts: 0, finals: 0, draftsBetter: 0, draftsCompared: 0 };
  // Reihenfolge wie auf der Karte (Grammatik, dann Schreiben)
  var order = []; (cfg.routes || []).forEach(function (r) { order = order.concat(r.stops); });

  Object.keys(topics).sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); }).forEach(function (tid) {
    var t = topics[tid];
    var kind = t.kind;
    var sheetKinds = kind === 'draft' ? ['sheet'] : kind === 'page' ? [] : ['sheet', 'extra'];    // Papier
    var followKinds = kind === 'draft' ? ['extra'] : ['practice', 'final'];                      // danach geprüft
    var steps = kind === 'draft' ? { sheet: 0, extra: 0 } : kind === 'page' ? { practice: 0 } : { baseline: 0, sheet: 0, practice: 0, extra: 0, final: 0 };
    var levels = { 1: 0, 2: 0, 3: 0, 4: 0 };
    var area = {};
    t.areas.forEach(function (a) { area[a] = { code: a, label: t.labels[a] || a, now: [], ever: [], unchecked: [], start: [] }; });
    var lastWork = '';   // letzte Abgabe nach dem Check-in: je jünger, desto aktueller die Station
    var kidRows = [];
    var improved = 0; var compared = 0; var manyHelps = [];
    var gBase = 0; var gNow = 0; var gN = 0; var gUp = 0;   // Lernzuwachs gegenüber dem Check-in

    Object.keys(t.kids).forEach(function (code) {
      var k = t.kids[code];
      var by = function (s) { return k.attempts.filter(function (a) { return a.kind === s; }); };
      var inKinds = function (list) { return function (a) { return list.indexOf(a.kind) >= 0; }; };
      var base = by('baseline')[0] || null;                                   // erster Check-in = Startwert
      var sheetsAll = k.attempts.filter(inKinds(sheetKinds));
      var sheet = kind === 'draft' ? (sheetsAll[0] || null) : bestOf(sheetsAll);   // Schreiben: die erste Fassung zählt
      var practice = kind === 'draft' ? null : bestOf(by('practice'));
      var final = kind === 'draft' ? lastOf(by('extra')) : kind === 'grammar' ? bestOf(by('final')) : null;   // Schreiben: neueste Endfassung
      var distinctSheets = {}; sheetsAll.forEach(function (a) { distinctSheets[a.step] = true; });
      var extra = kind === 'grammar' && (Object.keys(distinctSheets).length >= 2 || by('practice').length >= 2);
      Object.keys(steps).forEach(function (s) {
        var has = s === 'baseline' ? base : s === 'sheet' ? sheet : s === 'practice' ? practice : s === 'final' ? final : kind === 'draft' ? final : extra;
        if (has) steps[s]++;
      });
      var work = k.attempts.filter(function (a) { return a.kind !== 'baseline'; });
      var followed = k.attempts.filter(inKinds(followKinds));
      var latest = k.attempts[k.attempts.length - 1];
      var current = followed.length ? followed[followed.length - 1].n : (sheet ? sheet.n : latest.n);
      levels[current] = (levels[current] || 0) + 1;
      var later = kind === 'draft' ? final : practice;
      // Vergleich: Schreiben = Endfassung besser als 1. Fassung (gleiches Raster).
      // Grammatik = beim Üben mind. einen Fehlerbereich vom Blatt behoben (Niveaus von Blatt und Üben sind nicht vergleichbar: Üben-Niveau 4 gibt es erst auf Stufe D).
      if (kind === 'draft') { if (sheet && final) { compared++; if (final.n > sheet.n) improved++; } }
      else if (kind === 'grammar') {
        var lastSheet = lastOf(sheetsAll), lastPr = lastOf(by('practice'));
        if (lastSheet && lastPr && String(lastPr.ts) >= String(lastSheet.ts) && lastSheet.f.length) {
          compared++; if (lastSheet.f.some(function (c) { return lastPr.f.indexOf(c) < 0; })) improved++;
        }
      }
      if (base && work.length) {
        gN++; gBase += base.n; gNow += current; if (current > base.n) gUp++;
        var kg = kidGrowth[code] || (kidGrowth[code] = { base: 0, now: 0 }); kg.base += base.n; kg.now += current;
      }
      if (kind === 'grammar' && k.attempts.some(function (a) { return a.h >= 3; })) manyHelps.push(code);
      // Fehlerbereiche: zählen erst, wenn das Kind an der Station gearbeitet hat. Nur Check-in = Vorwissen ("start").
      if (work.length) {
        if (String(work[work.length - 1].ts) > lastWork) lastWork = String(work[work.length - 1].ts);
        work[work.length - 1].f.forEach(function (c) { if (area[c]) area[c].now.push(code); });
        var ever = {};
        k.attempts.forEach(function (a) { a.f.forEach(function (c) { ever[c] = true; }); });
        Object.keys(ever).forEach(function (c) { if (area[c]) area[c].ever.push(code); });
      } else latest.f.forEach(function (c) { if (area[c]) area[c].start.push(code); });
      // Blinde Flecken: Fehler auf Papier, danach noch nicht geübt bzw. noch keine Endfassung
      var lastSheetIdx = -1;
      k.attempts.forEach(function (a, i) { if (sheetKinds.indexOf(a.kind) >= 0) lastSheetIdx = i; });
      var checkedAfter = k.attempts.some(function (a, i) { return i > lastSheetIdx && followKinds.indexOf(a.kind) >= 0; });
      if (lastSheetIdx >= 0 && !checkedAfter) k.attempts[lastSheetIdx].f.forEach(function (c) { if (area[c]) area[c].unchecked.push(code); });
      var next = kind === 'draft' ? (!sheet ? '1. Fassung' : !final ? 'Endfassung' : 'fertig')
        : kind === 'page' ? 'fertig'
        : !sheet ? 'Arbeitsblatt' : !practice ? 'Üben' : current <= 2 ? 'noch eine Übungsrunde' : current === 3 ? 'optional: Extra' : 'fertig';
      kidRows.push({
        code: code, kurs: k.kurs, base: base ? base.n : null, sheet: sheet ? sheet.n : null, practice: practice ? practice.n : null, final: final ? final.n : null,
        extra: extra, current: current, stars: (sheet ? 1 : 0) + (later ? 1 : 0) + (extra ? 1 : 0),
        open: (work.length ? work[work.length - 1] : latest).f.map(function (c) { return t.labels[c] || c; }), next: next,
        trend: sheet && later ? later.n - sheet.n : null,
        attempts: k.attempts.map(function (a) { return { step: a.step, kind: a.kind, label: stepLabel_(kind, a.kind), n: a.n, h: a.h, fc: a.f, f: a.f.map(function (c) { return t.labels[c] || c; }), ts: a.ts }; })
      });
    });

    var workKids = kidRows.filter(function (r) { return r.attempts.some(function (a) { return a.kind !== 'baseline'; }); }).length;
    // Im Unterricht behandelt = Station ist offen und es gibt Abgaben nach dem Check-in. Nur diese Stationen bekommen Empfehlungen.
    var treated = workKids > 0 && (stationOpen_(cfg.topics[tid]) || workKids >= 3);
    var n = workKids;
    var areaList = t.areas.map(function (a) { return area[a]; }).map(function (a) {
      return { code: a.code, label: a.label, now: a.now.length, ever: a.ever.length, resolved: a.ever.length - a.now.length, unchecked: a.unchecked.length, start: a.start.length, nowCodes: a.now, uncheckedCodes: a.unchecked };
    });
    if (treated && kind !== 'page') areaList.forEach(function (a) { sum.pairs += a.ever; sum.pairsFixed += a.resolved; });
    var growth = gN ? { kids: gN, base: round1_(gBase / gN), now: round1_(gNow / gN), up: gUp } : null;
    var stepList = Object.keys(steps).map(function (s) { return { label: stepLabel_(kind, s), v: steps[s] }; });
    out.topics.push({ id: tid, name: t.name, place: t.place, kind: kind, kids: kidRows.length, workKids: workKids, treated: treated, lastWork: lastWork, steps: steps, stepList: stepList, levels: levels, areas: areaList,
      improved: improved, compared: compared, growth: growth, manyHelps: manyHelps, rows: kidRows });
    if (growth) { sum.growthKids += growth.kids; sum.growthUp += growth.up; sum.growthBase += gBase; sum.growthNow += gNow; }
    if (kind === 'grammar') { sum.improved += improved; sum.compared += compared; }
    if (kind === 'draft') { sum.drafts += steps.sheet; sum.finals += steps.extra; sum.draftsBetter += improved; sum.draftsCompared += compared; }

    // Empfehlungen, je Station gebündelt. n = Zahl der betroffenen Kinder, p = Gewicht innerhalb der Kategorie (danach sortiert das Dashboard)
    var label = (t.place ? t.place + ' · ' : '') + t.name.replace(/\s+–.*$/, '');
    var rec = function (type, p, n2, text, action, list) { if (treated) out.recommendations.push({ type: type, topic: label, kind: kind, p: p, n: n2, r: lastWork, text: text, action: action, codes: list && list.length ? list : null }); };
    if (growth && growth.kids >= 3) rec('gut', 3, growth.up, 'Lernzuwachs seit dem Check-in: Ø Niveau ' + String(growth.base).replace('.', ',') + ' → ' + String(growth.now).replace('.', ',') +
      ' (' + growth.up + ' von ' + growth.kids + ' Kindern verbessert).', 'Vorsichtig deuten (unterschiedliche Aufgabenformate).');
    if (compared >= 3) rec('gut', 3, improved, kind === 'draft' ? improved + ' von ' + compared + ' Kindern: Endfassung besser als die 1. Fassung.' : improved + ' von ' + compared + ' Kindern mit Fehlern auf dem Blatt haben beim Üben mindestens einen Fehlerbereich behoben.',
      kind === 'draft' ? 'Das Feedback zur 1. Fassung wirkt.' : 'Das adaptive Üben wirkt.');
    areaList.forEach(function (a) {
      var pct = n ? a.now / n : 0;
      var still = kind === 'page' ? ' hatten hier beim ersten Versuch Fehler.' : ' haben hier noch Fehler.';
      if (n >= 3 && pct >= 0.4) rec('plenum', 2, a.now, a.label + ': ' + a.now + ' von ' + n + ' Kindern' + still, kind === 'grammar' ? 'Im Plenum wiederholen (kurze Regel + gemeinsame Übung).' : 'Gemeinsam an einem Beispieltext besprechen.');
      else if (a.now >= 2) rec('gruppe', 2, a.now, a.label + ': ' + a.now + ' Kinder.', 'Kleingruppe bilden mit:', a.nowCodes);
    });
    var resolved = areaList.filter(function (a) { return n >= 3 && a.ever >= 2 && a.now === 0; });
    if (resolved.length) rec('gut', 2, resolved.reduce(function (m, a) { return Math.max(m, a.ever); }, 0), 'Fehler gemacht, inzwischen alle behoben: ' +
      resolved.map(function (a) { return a.label + ' (' + a.ever + ' Kinder)'; }).join(' · ') + '.', 'Kein weiterer Bedarf.');
    var clean = areaList.filter(function (a) { return n >= 5 && a.ever === 0; });
    if (clean.length) rec('gut', 1, n, 'Bei keinem Kind Fehler: ' + clean.map(function (a) { return a.label; }).join(' · ') + '.', 'Sitzt.');
    // Blinder Fleck je Station: Papier gemacht, aber noch nicht geprüft – mit den Fehlerbereichen, die dadurch ungeprüft sind
    var waiting = kidRows.filter(function (r) { return r.sheet !== null && (kind === 'draft' ? r.final === null : r.practice === null); });
    var open2 = areaList.filter(function (a) { return a.unchecked; }).map(function (a) { return a.label + ': ' + a.unchecked; });
    if (kind !== 'page' && waiting.length >= 2) rec('blind', 2, waiting.length, waiting.length + ' Kinder haben ' + (kind === 'draft' ? 'eine 1. Fassung, aber noch keine Endfassung.' : 'das Arbeitsblatt, aber noch keine Übung.') +
      (open2.length ? ' Ungeprüft bleiben: ' + open2.join(' · ') + '.' : ''), kind === 'draft' ? 'Zuerst an die Endfassung setzen:' : 'Zuerst zum Üben schicken:', waiting.map(function (r) { return r.code; }));
    if (manyHelps.length) rec('gruppe', 1, manyHelps.length, manyHelps.length + ' Kinder brauchten beim Üben viele Hilfen.', 'Kurz persönlich nachfragen bei:', manyHelps);
  });

  out.kids = Object.keys(codes).map(function (c) { return codes[c]; });
  var classSize = Object.keys(out.classSizes).reduce(function (s, k) { return s + out.classSizes[k]; }, 0);
  out.kpi = {
    kids: out.kids.length, classSize: classSize || null, submissions: events.length,
    fixed: sum.pairs ? { fixed: sum.pairsFixed, total: sum.pairs } : null,
    // Lernzuwachs je Kind: verbessert = über alle Grammatik-Themen zusammen höher als beim Check-in
    growth: sum.growthKids ? { kids: Object.keys(kidGrowth).length, up: Object.keys(kidGrowth).filter(function (c) { return kidGrowth[c].now > kidGrowth[c].base; }).length,
      base: round1_(sum.growthBase / sum.growthKids), now: round1_(sum.growthNow / sum.growthKids) } : null,
    practice: sum.compared ? { improved: sum.improved, compared: sum.compared } : null,
    writing: sum.drafts ? { drafts: sum.drafts, finals: sum.finals, better: sum.draftsBetter, compared: sum.draftsCompared } : null
  };
  var rank = { plenum: 0, blind: 1, gruppe: 2, gut: 3 };
  // Kategorie → Gewicht → aktuellste Station zuerst → Zahl der Kinder
  out.recommendations.sort(function (a, b) { return rank[a.type] - rank[b.type] || b.p - a.p || (a.r < b.r ? 1 : a.r > b.r ? -1 : 0) || b.n - a.n; });
  return out;
}

/* ===================== KI-Auswertung (Claude API) ===================== */

var AI = {
  MODEL: 'claude-opus-5-5',
  EFFORT: 'low',         // Nachdenken knapp halten: schnell genug für Apps Script (6 Min.) und für den Unterricht
  MAX_TOKENS: 32000,     // Obergrenze für Nachdenken + Bericht zusammen
  SHEET: 'KI-Auswertung'
};

var AI_CONTEXT = [
  'Du bist eine erfahrene Beraterin für Englischdidaktik und Lerndiagnostik an Realschulen in NRW.',
  'Eine Lehrkraft gibt dir die Ergebnisse ihrer Klasse aus einer Lernlandkarte mit KI-Coaches. Du wertest sie aus, damit sie die nächsten Stunden planen kann.',
  'Der Bericht soll auch für Personen verständlich sein, die das System nicht kennen (z. B. Kolleginnen, Schulleitung).',
  '',
  'So entstehen die Daten (wichtig für deine Interpretation):',
  '- Jedes Kind ist nur über einen Code bekannt (z. B. KOALA-7Q2X). Es gibt keine Namen. Verwende nur diese Codes.',
  '- Grammatik-Stationen: B = Check-in (Pre-Test auf der Website, für alle gleich, ohne KI ausgewertet – der Startwert),',
  '  W1 = Arbeitsblatt (Papier, vom Coach per Foto korrigiert), W2 = goldenes, schwereres Zusatzblatt,',
  '  P = adaptives Üben im Chat, F = Final check. Hilfen 0–3 = wie viele Hinweise das Kind beim Üben brauchte.',
  '- Schreib-Station (Art "Schreiben", z. B. Uluru): W1 = erste Fassung eines Artikels, W2 = überarbeitete Endfassung (beide auf Papier, vom Writing Coach',
  '  nach einem Raster bewertet). Die Fehlerbereiche sind Rasterpunkte (A = Inhalt, B = Darstellung/Sprache). Kein Check-in, keine Hilfen.',
  '- Übungsseiten ohne Coach (Art "Übungsseite", z. B. Alice Springs, Kata Tjuta): P = einmal durchgearbeitet, Niveau = Anteil beim ersten Versuch richtig.',
  '- Niveau 1–4 (4 = sicher, 1 = braucht Unterstützung). Fehlerbereiche vergibt ein KI-Coach: gute Hinweise, keine gesicherte Diagnose.',
  '- „Lagerfeuer“ sind gemeinsame Unterrichtsphasen ohne KI (z. B. Regeln aus einem Text herleiten), mit Datum.',
  '',
  'Regeln:',
  '- Für Zahlen nimm die exakt berechneten Kennzahlen am Anfang der Daten. Zähle nicht selbst neu. Die Einzelverläufe dienen nur dazu, Muster zu finden.',
  '- Belege jede Aussage mit einer Zahl („7 von 22 Kindern …“). Erfinde nichts.',
  '- Trenne Befund (steht in den Daten) und Deutung (deine Vermutung).',
  '- Benenne Grenzen: kleine Zahlen, fehlende Schritte, mögliche Fehlkorrekturen des Coaches.',
  '- Suche Muster: Fehlerbereiche, die gemeinsam auftreten; Entwicklung vom Blatt zum Üben bzw. von der 1. Fassung zur Endfassung;',
  '  Kinder mit vielen Hilfen trotz gutem Niveau; Bereiche, die nie geprüft wurden; Unterschiede vor/nach einem Lagerfeuer (nur als Hinweis).',
  '- Lernzuwachs seit dem Check-in vorsichtig deuten: Check-in und Übungen sind unterschiedliche Formate; den genauen Vergleich bringt erst der Post-Test.',
  '- Vorschläge nur zu Stationen, die schon im Unterricht behandelt wurden – die zuletzt bearbeitete ist am wichtigsten. Noch nicht behandelte Themen höchstens als Ausblick (Vorwissen laut Check-in).',
  '- Vorschläge müssen in einer heterogenen 9. Klasse in 45 Minuten umsetzbar sein.',
  '- Deutsch, klar, knapp, ohne Fachsprache. Lieber wenige starke Aussagen als viele schwache.'
].join('\n');

// Feste Struktur der Antwort (Structured Outputs). Das Dashboard zeigt sie als Karten.
var AI_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['kernaussage', 'befunde', 'naechste_stunden', 'laeuft_gut', 'grenzen'],
  properties: {
    kernaussage: { type: 'string' },
    befunde: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['titel', 'text', 'art'],
      properties: { titel: { type: 'string' }, text: { type: 'string' }, art: { type: 'string', enum: ['befund', 'deutung'] } } } },
    naechste_stunden: { type: 'object', additionalProperties: false, required: ['plenum', 'kleingruppen', 'einzeln'], properties: {
      plenum: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['was', 'warum'], properties: { was: { type: 'string' }, warum: { type: 'string' } } } },
      kleingruppen: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['fokus', 'codes', 'idee'],
        properties: { fokus: { type: 'string' }, codes: { type: 'array', items: { type: 'string' } }, idee: { type: 'string' } } } },
      einzeln: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['code', 'hinweis'], properties: { code: { type: 'string' }, hinweis: { type: 'string' } } } }
    } },
    laeuft_gut: { type: 'array', items: { type: 'string' } },
    grenzen: { type: 'array', items: { type: 'string' } }
  }
};

var AI_FORMAT_JSON = [
  '',
  'Antwortformat (JSON nach dem vorgegebenen Schema):',
  '- kernaussage: 2–3 Sätze ohne Codes. Was zeigt die Auswertung, was folgt daraus für den Unterricht? Verständlich für Außenstehende.',
  '- befunde: die 3–5 wichtigsten Befunde. titel = kurze Überschrift (max. 8 Wörter), text = 1–2 Sätze mit Zahl, art = "befund" oder "deutung".',
  '- naechste_stunden: plenum höchstens 2 Punkte, kleingruppen höchstens 3 Gruppen (mit Codes), einzeln höchstens 5 Kinder (je ein Satz).',
  '- laeuft_gut: 2–5 Punkte mit Zahl.',
  '- grenzen: 1–3 Punkte, was die Daten (noch) nicht zeigen.',
  'Insgesamt höchstens etwa 500 Wörter.'
].join('\n');

var AI_FORMAT_CHAT = [
  '',
  'Antwortformat: gut lesbarer Text mit diesen Überschriften:',
  '## Kernaussage (2–3 Sätze ohne Codes) · ## Wichtigste Befunde (3–5, mit Zahl, Befund oder Deutung kennzeichnen) ·',
  '## Nächste Stunden (Plenum, Kleingruppen mit Codes, einzelne Kinder) · ## Das läuft gut · ## Grenzen der Daten.',
  'Insgesamt höchstens etwa 500 Wörter.'
].join('\n');

// Kompakte, pseudonyme Zusammenfassung aller Ergebnisse – Grundlage für die KI (und zum Kopieren in einen Claude-Chat).
// Zuerst die exakt berechneten Kennzahlen (dieselben wie im Dashboard), danach die Einzelverläufe.
function buildAiInput_() {
  var cfg = loadConfig_();
  var a = analysis_(cfg);
  var tz = Session.getScriptTimeZone();
  var KIND = { grammar: 'Grammatik', draft: 'Schreiben', page: 'Übungsseite' };
  var lines = [];
  var size = Object.keys(a.classSizes).map(function (k) { return k + ': ' + a.classSizes[k] + ' Kinder'; }).join(', ') || 'unbekannt';
  lines.push('Klassengröße: ' + size + '. Kinder mit Ergebnissen: ' + a.kpi.kids + '. Abgaben insgesamt: ' + a.kpi.submissions + '. Stand: ' + Utilities.formatDate(new Date(), tz, 'dd.MM.yyyy HH:mm'));
  var lessons = campList_().filter(function (c) { return c.lit; }).map(function (c) {
    var d = new Date(c.lit);
    return (isNaN(d) ? String(c.lit) : Utilities.formatDate(d, tz, 'dd.MM.yyyy')) + ' ' + c.name + ' (' + c.id + '): ' + (c.titleDe || c.title);
  });
  lines.push('Gemeinsame Unterrichtsphasen ohne KI (Lagerfeuer): ' + (lessons.length ? lessons.join(' · ') : 'keine eingetragen'));
  lines.push('');
  var later = a.topics.filter(function (t) { return !t.treated; });
  if (later.length) {
    lines.push('Noch nicht im Unterricht behandelt (nur Check-in als Vorwissen, KEINE Empfehlungen dazu geben): ' + later.map(function (t) {
      var top = t.areas.filter(function (x) { return x.start; }).sort(function (x, y) { return y.start - x.start; }).slice(0, 2)
        .map(function (x) { return x.label + ' ' + x.start; });
      return t.place + ' – ' + t.name + (top.length ? ' (häufigste Check-in-Fehler: ' + top.join(', ') + ')' : '');
    }).join(' · '));
  }
  lines.push('');
  lines.push('## Exakt berechnete Kennzahlen der behandelten Stationen (diese Zahlen verwenden; die zuletzt bearbeitete Station steht zuerst)');
  a.topics.filter(function (t) { return t.treated; }).sort(function (x, y) { return x.lastWork < y.lastWork ? 1 : -1; }).forEach(function (t) {
    lines.push('');
    lines.push('### ' + t.name + ' (' + t.id + ', ' + t.place + ', Art: ' + KIND[t.kind] + '), ' + t.workKids + ' Kinder haben daran gearbeitet, zuletzt am ' + String(t.lastWork).slice(0, 10));
    lines.push('Schritte erledigt: ' + t.stepList.map(function (s) { return s.label + ' ' + s.v; }).join(' · '));
    lines.push('Aktuelles Niveau: 1: ' + t.levels[1] + ' · 2: ' + t.levels[2] + ' · 3: ' + t.levels[3] + ' · 4: ' + t.levels[4]);
    if (t.growth) lines.push('Lernzuwachs seit Check-in: Ø ' + t.growth.base + ' → ' + t.growth.now + ', ' + t.growth.up + ' von ' + t.growth.kids + ' Kindern verbessert');
    if (t.compared) lines.push((t.kind === 'draft' ? 'Endfassung besser als 1. Fassung: ' : 'Kinder mit Fehlern auf dem Blatt, die beim Üben mind. einen Fehlerbereich behoben haben: ') + t.improved + ' von ' + t.compared);
    if (t.manyHelps.length) lines.push('Viele Hilfen (3+): ' + t.manyHelps.join(', '));
    t.areas.forEach(function (x) {
      lines.push('- ' + x.code + ' (' + x.label + '): noch offen ' + x.now + (x.now ? ' [' + x.nowCodes.join(', ') + ']' : '') + ', behoben ' + x.resolved +
        (x.unchecked ? ', ungeprüft ' + x.unchecked + ' [' + x.uncheckedCodes.join(', ') + ']' : ''));
    });
  });
  lines.push('');
  lines.push('## Einzelverläufe (behandelte Stationen)');
  lines.push('Format je Kind: Schritt:Niveau/Hilfen[Fehlerbereiche]@Datum, chronologisch');
  a.topics.filter(function (t) { return t.treated; }).forEach(function (t) {
    lines.push('');
    lines.push('### ' + t.name + ' (' + t.id + ')');
    t.rows.slice().sort(function (x, y) { return x.code < y.code ? -1 : 1; }).forEach(function (r) {
      lines.push(r.code + ' | ' + r.attempts.map(function (e) {
        var d = new Date(e.ts);
        return e.step.split('-')[1] + ':' + e.n + '/' + e.h + '[' + (e.fc.join(',') || '-') + ']' + (isNaN(d) ? '' : '@' + Utilities.formatDate(d, tz, 'dd.MM HH:mm'));
      }).join(' | '));
    });
  });
  return { text: lines.join('\n'), events: a.kpi.submissions };
}

// Für den Weg über den Claude-Chat: Auftrag + Daten in einem Text.
function getAiPromptForChat() {
  if (!isOwner_()) throw new Error('Kein Zugriff');
  var input = buildAiInput_();
  return AI_CONTEXT + '\n' + AI_FORMAT_CHAT + '\n\n---\n\nHier sind die Daten:\n\n' + input.text;
}

// Erstellt die KI-Auswertung über die Claude API und speichert sie (als JSON) im Blatt "KI-Auswertung".
function runAiAnalysis() {
  if (!isOwner_()) throw new Error('Kein Zugriff');
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('Kein API-Schlüssel hinterlegt. Im Sheet: Road Trip → KI-Schlüssel hinterlegen.');
  var input = buildAiInput_();
  if (input.events < 5) throw new Error('Noch zu wenige Ergebnisse für eine Auswertung (mindestens 5 Abgaben).');

  var body = {
    model: AI.MODEL,
    max_tokens: AI.MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: AI.EFFORT, format: { type: 'json_schema', schema: AI_SCHEMA } },
    fallbacks: 'default',
    system: AI_CONTEXT + '\n' + AI_FORMAT_JSON,
    messages: [{ role: 'user', content: 'Hier sind die Daten der Klasse. Erstelle die Auswertung.\n\n' + input.text }]
  };
  var res;
  try {
    res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
      payload: JSON.stringify(body),
      muteHttpExceptions: true
    });
  } catch (e) {
    throw new Error('Keine Antwort von der KI (' + e.message + '). Bitte noch einmal versuchen oder den Weg „Für Claude-Chat kopieren“ nutzen.');
  }
  var code = res.getResponseCode();
  var data;
  try { data = JSON.parse(res.getContentText()); } catch (e) { throw new Error('Antwort der API nicht lesbar (HTTP ' + code + ').'); }
  if (code !== 200) {
    var msg = data && data.error ? data.error.type + ': ' + data.error.message : 'HTTP ' + code;
    if (code === 401) msg = 'API-Schlüssel ungültig. Bitte neu hinterlegen.';
    if (code === 429 || code === 529) msg = 'Die API ist gerade ausgelastet. Bitte in einer Minute noch einmal versuchen.';
    throw new Error(msg);
  }
  if (data.stop_reason === 'refusal') throw new Error('Die Anfrage wurde abgelehnt. Bitte den Weg „Für Claude-Chat kopieren“ nutzen.');
  if (data.stop_reason === 'max_tokens') throw new Error('Die KI ist nicht fertig geworden (Platz aufgebraucht). Der letzte Bericht bleibt erhalten. Bitte noch einmal versuchen.');
  var text = (data.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('').trim();
  var parsed;
  try { parsed = JSON.parse(text); } catch (e) { throw new Error('Die Antwort der KI war unvollständig. Der letzte Bericht bleibt erhalten. Bitte noch einmal versuchen.'); }
  if (!parsed || !parsed.kernaussage) throw new Error('Die KI hat keinen Bericht geliefert. Bitte noch einmal versuchen.');
  var report = JSON.stringify(parsed);

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AI.SHEET) || SpreadsheetApp.getActiveSpreadsheet().insertSheet(AI.SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Zeitpunkt', 'Modell', 'Abgaben', 'Bericht']);
    sh.getRange(1, 1, 1, 4).setFontWeight('bold').setFontColor('#FFFFFF').setBackground(SETTINGS.HEADER_COLOR);
    sh.setColumnWidth(4, 900);
  }
  sh.appendRow([new Date(), data.model || AI.MODEL, input.events, report]);
  sh.getRange(sh.getLastRow(), 4).setWrap(true).setVerticalAlignment('top');
  return { report: report, at: new Date().toISOString(), model: data.model || AI.MODEL, events: input.events };
}

function lastAiReport_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AI.SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  var v = sh.getRange(sh.getLastRow(), 1, 1, 4).getValues()[0];
  return { at: v[0] instanceof Date ? v[0].toISOString() : String(v[0]), model: v[1], events: v[2], report: String(v[3]) };
}

// Menü: API-Schlüssel sicher in den Script-Eigenschaften speichern (nie im Code oder Repo).
function setApiKey() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Claude-API-Schlüssel', 'Schlüssel einfügen (beginnt mit sk-ant-). Er wird nur in diesem Script gespeichert.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var key = r.getResponseText().trim();
  if (!/^sk-ant-/.test(key)) { ui.alert('Das sieht nicht wie ein Claude-API-Schlüssel aus.'); return; }
  PropertiesService.getScriptProperties().setProperty('ANTHROPIC_API_KEY', key);
  ui.alert('Gespeichert. Die KI-Auswertung ist jetzt im Dashboard verfügbar.');
}
