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
  var code = String(p.code || '').trim().toUpperCase();
  if (!SETTINGS.CODE_RE.test(code)) return json_({ ok: false, error: 'bad-code' });
  var events = readEvents_().filter(function (r) { return r.code === code; }).map(function (r) {
    return { station: r.station, n: r.n, self: r.self, h: r.h, f: r.f, s: r.s, fb: r.fb, ts: r.ts };
  });
  return json_({ ok: true, code: code, events: events });
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

function num_(v) { var n = Number(String(v).trim().replace(',', '.')); return isNaN(n) ? 0 : n; }
function clean_(v) { var s = String(v || '').trim(); return s === '-' ? '' : s; }

function loadConfig_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('config');
  if (hit) return JSON.parse(hit);
  var res = UrlFetchApp.fetch(SETTINGS.CONFIG_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('config.json nicht erreichbar: ' + SETTINGS.CONFIG_URL);
  var txt = res.getContentText();
  try { cache.put('config', txt, 3600); } catch (e) { /* zu gross fuer Cache */ }
  return JSON.parse(txt);
}

/* ===================== Menue ===================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Road Trip')
    .addItem('Auswertung aktualisieren', 'refreshAnalysis')
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

function refreshAnalysis() {
  var cfg = loadConfig_();
  var stations = cfg.stations.map(function (s) { return s.id; });
  var catalog = cfg.errorCatalog || {};
  var events = readEvents_().filter(function (e) { return stations.indexOf(e.station) !== -1; });
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

  writeMatrix_(cfg, stations, list, catalog);
  writeErrors_(list, catalog);
  writeCalibration_(list);
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

function writeErrors_(list, catalog) {
  var sh = sheet_('Fehlermuster');
  var agg = {};
  list.forEach(function (p) {
    var seenNow = {};
    p.all.forEach(function (e) {
      e.f.forEach(function (c) {
        var k = (p.kurs || '-') + '|' + c;
        var a = agg[k] || (agg[k] = { kurs: p.kurs || '-', code: c, total: 0, students: {}, current: {} });
        a.total++;
        a.students[p.code] = true;
      });
    });
    // "aktuell": Fehler im jeweils letzten Versuch pro Station
    Object.keys(p.last).forEach(function (st) {
      p.last[st].f.forEach(function (c) { seenNow[c] = true; });
    });
    Object.keys(seenNow).forEach(function (c) {
      var k = (p.kurs || '-') + '|' + c;
      if (agg[k]) agg[k].current[p.code] = true;
    });
  });
  var head = ['Kurs', 'Fehlercode', 'Bereich', 'Beschreibung', 'Station', 'Nennungen gesamt', 'SuS gesamt', 'SuS aktuell'];
  var rows = [head];
  Object.keys(agg).map(function (k) { return agg[k]; })
    .sort(function (a, b) { return a.kurs === b.kurs ? Object.keys(b.current).length - Object.keys(a.current).length || b.total - a.total : (a.kurs < b.kurs ? -1 : 1); })
    .forEach(function (a) {
      var c = catalog[a.code] || {};
      rows.push([a.kurs, a.code, c.structure || '?', c.label || 'unbekannter Code', c.station || '', a.total, Object.keys(a.students).length, Object.keys(a.current).length]);
    });
  sh.getRange(1, 1, rows.length, head.length).setValues(rows).setFontColor('#1B2A55');
  header_(sh, head.length);
  sh.autoResizeColumns(1, head.length);
  sh.getRange(rows.length + 2, 1).setValue('"SuS aktuell" = Fehler taucht im letzten Versuch einer Station noch auf. Hohe Werte = Thema für die ganze Klasse.');
}

function writeCalibration_(list) {
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
