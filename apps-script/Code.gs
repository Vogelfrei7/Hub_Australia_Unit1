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
    .addItem('Dashboard öffnen', 'openDashboard')
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

// Schritt-IDs der Themen-Coaches: <THEMA>-W1 (Blatt), -W2 … (Zusatzblatt), -P (Üben), -F (Final check)
function stepInfo_(cfg, id) {
  var m = String(id || '').match(/^([A-Z]{2,6})-(W(\d)|P|F)$/);
  if (!m || !cfg.topics || !cfg.topics[m[1]]) return null;
  var kind = m[2] === 'P' ? 'practice' : m[2] === 'F' ? 'final' : (m[3] === '1' ? 'sheet' : 'extra');
  return { topicId: m[1], topic: cfg.topics[m[1]], kind: kind };
}

function refreshAnalysis() {
  var cfg = loadConfig_();
  var stations = cfg.stations.map(function (s) { return s.id; });
  var catalog = cfg.errorCatalog || {};
  var events = readEvents_().filter(function (e) { return stations.indexOf(e.station) !== -1 || stepInfo_(cfg, e.station); });
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
    head.push(n + ': Blatt', n + ': Üben', n + ': Zusatz', n + ': Final', n + ': offene Fehlerbereiche', n + ': Vorschlag');
  });
  var rows = [head];
  var bg = [head.map(function () { return SETTINGS.HEADER_COLOR; })];
  list.forEach(function (p) {
    var row = [p.kurs, p.code];
    var colors = ['#FFFFFF', '#FFFFFF'];
    topicIds.forEach(function (t) {
      var best = { sheet: null, practice: null, extra: null, final: null };
      var lastByStep = {};
      Object.keys(p.best).forEach(function (s) {
        var si = stepInfo_(cfg, s);
        if (!si || si.topicId !== t) return;
        var b = p.best[s];
        if (!best[si.kind] || b.n > best[si.kind].n) best[si.kind] = b;
        lastByStep[s] = p.last[s];
      });
      ['sheet', 'practice', 'extra', 'final'].forEach(function (k) {
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

// Liefert alle Kennzahlen für Dashboard.html. Allgemein: arbeitet mit jedem Thema aus config.topics.
function getDashboardData() {
  if (!isOwner_()) throw new Error('Kein Zugriff');
  var cfg = loadConfig_();
  var events = readEvents_().filter(function (e) { return stepInfo_(cfg, e.station); });
  events.sort(function (a, b) { return String(a.ts) < String(b.ts) ? -1 : 1; });

  var topics = {};
  var codes = {};
  events.forEach(function (e) {
    var si = stepInfo_(cfg, e.station);
    var t = topics[si.topicId] || (topics[si.topicId] = { id: si.topicId, name: si.topic.name, labels: si.topic.areaLabels || {}, areas: si.topic.areas || [], kids: {} });
    var k = t.kids[e.code] || (t.kids[e.code] = { code: e.code, kurs: e.kurs, attempts: [] });
    k.attempts.push({ kind: si.kind, step: e.station, n: e.n, h: e.h, f: e.f, ts: e.ts });
    var c = codes[e.code] || (codes[e.code] = { code: e.code, kurs: e.kurs, last: e.ts, count: 0 });
    c.last = e.ts; c.count++;
  });

  var bestOf = function (list) { return list.reduce(function (b, a) { return !b || a.n > b.n ? a : b; }, null); };
  var out = { generated: new Date().toISOString(), classSizes: cfg.classSizes || {}, topics: [], kids: [], recommendations: [] };
  var allCurrent = [];

  Object.keys(topics).forEach(function (tid) {
    var t = topics[tid];
    var steps = { sheet: 0, practice: 0, extra: 0, final: 0 };
    var levels = { 1: 0, 2: 0, 3: 0, 4: 0 };
    var area = {};
    t.areas.forEach(function (a) { area[a] = { code: a, label: t.labels[a] || a, now: [], ever: [], unchecked: [] }; });
    var kidRows = [];
    var improved = 0; var compared = 0; var manyHelps = [];

    Object.keys(t.kids).forEach(function (code) {
      var k = t.kids[code];
      var by = function (kind) { return k.attempts.filter(function (a) { return a.kind === kind; }); };
      var sheet = bestOf(by('sheet')); var practice = bestOf(by('practice')); var final = bestOf(by('final'));
      var extra = by('extra').length > 0 || by('practice').length > 1;
      if (sheet) steps.sheet++; if (practice) steps.practice++; if (extra) steps.extra++; if (final) steps.final++;
      var digital = k.attempts.filter(function (a) { return a.kind === 'practice' || a.kind === 'final'; });
      var latest = k.attempts[k.attempts.length - 1];
      var current = digital.length ? digital[digital.length - 1].n : (sheet ? sheet.n : latest.n);
      levels[current] = (levels[current] || 0) + 1;
      allCurrent.push(current);
      if (sheet && practice) { compared++; if (practice.n > sheet.n) improved++; }
      if (k.attempts.some(function (a) { return a.h >= 3; })) manyHelps.push(code);
      latest.f.forEach(function (c) { if (area[c]) area[c].now.push(code); });
      var ever = {};
      k.attempts.forEach(function (a) { a.f.forEach(function (c) { ever[c] = true; }); });
      Object.keys(ever).forEach(function (c) { if (area[c]) area[c].ever.push(code); });
      // Blinde Flecken: Fehler im Arbeitsblatt, danach noch nicht digital geübt
      var lastSheetIdx = -1;
      k.attempts.forEach(function (a, i) { if (a.kind === 'sheet' || a.kind === 'extra') lastSheetIdx = i; });
      var practicedAfter = k.attempts.some(function (a, i) { return i > lastSheetIdx && (a.kind === 'practice' || a.kind === 'final'); });
      if (lastSheetIdx >= 0 && !practicedAfter) k.attempts[lastSheetIdx].f.forEach(function (c) { if (area[c]) area[c].unchecked.push(code); });
      var next = !sheet ? 'Arbeitsblatt' : !practice ? 'Üben' : current <= 2 ? 'noch eine Übungsrunde' : current === 3 ? 'optional: Extra' : 'fertig';
      kidRows.push({
        code: code, kurs: k.kurs, sheet: sheet ? sheet.n : null, practice: practice ? practice.n : null, final: final ? final.n : null,
        extra: extra, current: current, stars: (sheet ? 1 : 0) + (practice ? 1 : 0) + (extra ? 1 : 0),
        open: latest.f.map(function (c) { return t.labels[c] || c; }), next: next,
        trend: sheet && practice ? practice.n - sheet.n : null,
        attempts: k.attempts.map(function (a) { return { step: a.step, kind: a.kind, n: a.n, h: a.h, f: a.f.map(function (c) { return t.labels[c] || c; }), ts: a.ts }; })
      });
    });

    var n = kidRows.length;
    var areaList = t.areas.map(function (a) { return area[a]; }).map(function (a) {
      return { code: a.code, label: a.label, now: a.now.length, ever: a.ever.length, resolved: a.ever.length - a.now.length, unchecked: a.unchecked.length, nowCodes: a.now, uncheckedCodes: a.unchecked };
    });
    out.topics.push({ id: tid, name: t.name, kids: n, steps: steps, levels: levels, areas: areaList, improved: improved, compared: compared, manyHelps: manyHelps, rows: kidRows });

    // Empfehlungen für die nächsten Stunden
    areaList.forEach(function (a) {
      var pct = n ? a.now / n : 0;
      if (n >= 3 && pct >= 0.4) out.recommendations.push({ type: 'plenum', topic: t.name, text: a.label + ': ' + a.now + ' von ' + n + ' Kindern haben hier noch Fehler.', action: 'Im Plenum wiederholen (kurze Regel + gemeinsame Übung).' });
      else if (a.now >= 2) out.recommendations.push({ type: 'gruppe', topic: t.name, text: a.label + ': ' + a.now + ' Kinder.', action: 'Kleingruppe bilden mit:', codes: a.nowCodes });
      if (a.unchecked >= 2) out.recommendations.push({ type: 'blind', topic: t.name, text: a.label + ': ' + a.unchecked + ' Kinder hatten Fehler auf dem Blatt, haben aber noch nicht geübt.', action: 'Diese Kinder zuerst zum Üben schicken.', codes: a.uncheckedCodes });
      if (n >= 3 && a.ever >= 2 && a.now === 0) out.recommendations.push({ type: 'gut', topic: t.name, text: a.label + ': Fehler bei ' + a.ever + ' Kindern – inzwischen alle behoben.', action: 'Das Üben wirkt. Kein weiterer Bedarf.' });
      if (n >= 5 && a.ever === 0) out.recommendations.push({ type: 'gut', topic: t.name, text: a.label + ': bei keinem Kind Fehler.', action: 'Sitzt. Kann im Test vorausgesetzt werden.' });
    });
    var noPractice = kidRows.filter(function (r) { return r.sheet !== null && r.practice === null; }).length;
    if (noPractice >= 3) out.recommendations.push({ type: 'blind', topic: t.name, text: noPractice + ' Kinder haben das Arbeitsblatt, aber noch keine Übung.', action: 'Zeit für den digitalen Schritt einplanen.' });
    if (manyHelps.length) out.recommendations.push({ type: 'gruppe', topic: t.name, text: manyHelps.length + ' Kinder brauchten viele Hilfen.', action: 'Kurz persönlich nachfragen bei:', codes: manyHelps });
    if (compared >= 3) out.recommendations.push({ type: 'gut', topic: t.name, text: improved + ' von ' + compared + ' Kindern sind beim Üben besser als auf dem Arbeitsblatt.', action: 'Lernzuwachs durch das adaptive Üben.' });
  });

  out.kids = Object.keys(codes).map(function (c) { return codes[c]; });
  out.kpi = {
    kids: out.kids.length,
    submissions: events.length,
    avgLevel: allCurrent.length ? round1_(allCurrent.reduce(function (s, x) { return s + x; }, 0) / allCurrent.length) : null,
    share3: allCurrent.length ? Math.round(100 * allCurrent.filter(function (x) { return x >= 3; }).length / allCurrent.length) : null
  };
  var order = { plenum: 0, blind: 1, gruppe: 2, gut: 3 };
  out.recommendations.sort(function (a, b) { return order[a.type] - order[b.type]; });
  return JSON.parse(JSON.stringify(out));
}
