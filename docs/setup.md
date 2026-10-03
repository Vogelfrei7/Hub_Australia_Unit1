# Setup – Australia Road Trip

Reihenfolge so einhalten. Jeder Schritt endet mit einem Wert, der in `hub/config.json` eingetragen wird.
Nach jeder Änderung an `config.json`: committen und pushen. GitHub Pages braucht danach 1–10 Minuten.
Auf den iPads ggf. die Seite neu laden.

## 1. GitHub Pages

1. Repo `Vogelfrei7/Hub_Australia_Unit1` (öffentlich) → **Settings → Pages** → Source: *Deploy from a branch*, Branch `main`, Ordner `/ (root)`.
2. Nach dem ersten Push ist die Map erreichbar unter
   `https://vogelfrei7.github.io/Hub_Australia_Unit1/hub/`
3. Test: `…/hub/?demo=1` zeigt die Demo-Reise.

**Nie ins Repo:** Namen, Code-Listen, Sheet-Exporte, Buchseiten, Lösungsschlüssel (siehe `.gitignore`).

## 2. Google-Formular + Sheet

Variante A (empfohlen, Formular wird passend erzeugt):
1. Neues leeres Google Sheet anlegen, z. B. „Road Trip – Abgaben 9a“.
2. **Erweiterungen → Apps Script** → Inhalt von `apps-script/Code.gs` einfügen → speichern.
3. Sheet neu laden → Menü **Road Trip → Neues Formular anlegen**. Berechtigungen bestätigen.
4. Das Fenster zeigt `action` und `entries` → in `config.json` unter `backend.form` einsetzen.

Variante B (Formular existiert schon):
- Das Formular braucht 9 Kurzantwort-Fragen mit genau diesen Titeln: `CODE, KURS, STATION, NIVEAU, SELBST, HILFEN, FEHLER, STAERKE, FOERDER`.
- Keine Pflichtfelder, keine Antwortvalidierung.
- Mit dem Sheet verknüpfen, dann im Sheet **Road Trip → Formular-Konfiguration anzeigen**.

Formular-Einstellungen (wichtig, sonst kommen keine Abgaben an):
- **Keine Anmeldung erforderlich** (SuS sind nicht bei Google angemeldet).
- **E-Mail-Adressen nicht erfassen.**
- „Antworten werden akzeptiert“ an.
- Bei Schul-Google-Workspace: „Auf Nutzer in [Domain] beschränken“ **aus**.

## 3. Apps Script als Web-App (Map-Stand)

1. Im Apps-Script-Editor: **Bereitstellen → Neue Bereitstellung → Typ: Web-App**.
   - Ausführen als: **Ich**
   - Zugriff: **Jeder** (nicht „Jeder mit Google-Konto“)
2. Die URL (`https://script.google.com/macros/s/…/exec`) in `config.json` → `backend.appsScriptUrl` eintragen.
3. Test im Browser: `…/exec?ping=1` → `{"ok":true,"ping":true,…}` und `…/exec?code=TEST-0000` → `{"ok":true,…,"events":[]}`.
4. **Nach jeder Code-Änderung:** Bereitstellen → Bereitstellungen verwalten → Bearbeiten → *Neue Version*. Die URL bleibt gleich.

Datenschutz: Die Web-App gibt nur die Zeilen des abgefragten Codes zurück (Station, Werte, Kurztexte, Zeitpunkt), ohne Kurs.
Wer einen Code kennt, kann dessen Ergebnisse sehen. Deshalb sind die Codes nicht erratbar und werden verdeckt verteilt.

## 4. Auswertung im Sheet

- **Road Trip → Auswertung aktualisieren** erzeugt bzw. überschreibt die Blätter:
  - **Matrix**: Code × Station, bestes Niveau (1 Terrakotta → 4 Petrol), `E` = Express, plus Stempel, Express, Hilfen Ø.
  - **Fehlermuster**: Häufigkeit je Fehlercode und Kurs (gesamt / SuS / SuS mit dem Fehler im letzten Versuch).
  - **Kalibrierung**: SELBST vs. NIVEAU je Code, Tendenz über- bzw. unterschätzt.
- **Road Trip → Automatik einschalten**: Die Auswertung läuft nach jeder Abgabe neu.
- Die Auswertung liest Stationen und Fehlerkatalog aus der veröffentlichten `config.json` (`SETTINGS.CONFIG_URL` in `Code.gs`).

## 5. Agenten in Sidekick

| Agent | System-Prompt | Knowledge |
|---|---|---|
| Grammar Coach | `prompts/grammar-coach.md` (alles unter der Linie) | `knowledge/*.md`, Grammatikseiten des Buchs, alle Arbeitsblätter + Lösungsschlüssel (`AUS1-…_loesung`) |
| Writing Coach | bestehender Prompt + `prompts/writing-coach-ergaenzung.md` | ZP10-Raster, `knowledge/fehlerkatalog.md`, `niveaudeskriptoren.md`, `stationen.md` |

- Sidekick-Nutzergedächtnis für beide Agenten **aus** (Diagnostik soll pro Station unabhängig sein).
- Agenten-Links in `config.json` → `agents.grammar.url` bzw. `agents.writing.url`.
- Buchmaterial nur im Sidekick-Knowledge, **nie** im Repo.

## 6. Code-Karten

`tools/codekarten.html` lokal oder über Pages öffnen (`…/Hub_Australia_Unit1/tools/codekarten.html`), Anzahl und Klasse eingeben, drucken.
Es wird keine Liste gespeichert. Karten verdeckt verteilen; Ersatzkarten bereithalten.

## 7. Illustrationen

PNG-Dateien liefern → Konvertierung zu `hub/assets/img/G0.webp` … (3:2, ≤ 200 KB) → Alt-Texte in `config.json`.

## 8. Neue Unit / anderes Fach

Neue `config.json` (Stationen, Koordinaten, Karte, Routen, Fehlerkatalog, Texte, Stempel, Icons, Theme), neue Knowledge-Dateien,
neue Illustrationen, neues Formular/Sheet (oder dasselbe mit neuer Station-ID-Präfix). Kein Code nötig.
Die Prompt-Module in `prompts/module/` mit den Platzhaltern füllen.
Hinweis: `config.id` ändern, damit sich der Speicher auf den iPads nicht mit dieser Unit mischt.
