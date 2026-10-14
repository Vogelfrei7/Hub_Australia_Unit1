# Australia Road Trip – Projektwissen für Claude

Gamifizierter Grammatik-/Schreib-Hub für Englisch Klasse 9 (Realschule NRW, Headlight 5, Unit 1, Klasse 09c, 31 SuS inkl. 2 Sprachseiteneinsteiger, 1 Förderschüler).
Lehrkraft: Vogelfrei7 (GitHub). Präsentation beim Regierungspräsidenten am **Do, 15.10.2026**.
Kernbotschaft: KI macht Diagnostik zu einem mächtigen Werkzeug (Lehrkraft erfährt mehr, SuS verstehen Stärken/Schwächen).

## Aufbau
- `hub/` – Website (GitHub Pages, öffentlich): `index.html` Karte · `checkin.html` Pre-Test · `passport.html` Pass ·
  `abgabe.html` Ergebnis-Annahme · `how.html` So geht's. **Alle Inhalte in `hub/config.json`** (Stationen, Routen,
  Check-in-Aufgaben, Tiere, Achievements, Formular-IDs). JS-Module in `hub/assets/js/` (`core.js` = Logik ohne DOM).
  `scenery.js` = Landschaft, Motive (werden mit dem ersten Stempel ihrer Station farbig) und Reisemobil; rein dekorativ,
  Motive nie auf Stationen, Beschriftungen oder Routen legen.
  Lagerfeuer = gemeinsame Unterrichtsphase ohne KI: `topics.<ID>.camp` (Position, Titel, Text, optional `reading` für „Missed it?“).
  Angezündet wird im Dashboard (Script Property CLASS_STATE, Protokoll im Blatt „Unterricht“); keine Sterne.
- `agents/` – Sidekick-Coaches: `core.md` (Kern-Prompt) + `topics/*.md` → `node agents/build.mjs` → `agents/dist/<ID>.md`.
- `apps-script/` – `Code.gs` + `Dashboard.html`, werden **von Hand** in das Apps Script des Google Sheets kopiert.
- `private/` und `Bilder_roh/` – **nicht im Repo** (Lösungen, Arbeitsblätter-Quellen, Rohbilder). Nur lokal.
- `tools/` – `codekarten.html` (Codes + QR), `bilder.py` (Rohbilder → WebP + config).
- `docs/` – Setup, Testplan, Stundenplan, Bild-Prompts, `tests/routing.test.mjs`.

## Route (seit 08.10.)
Grammar Road: Start Sydney → 1 SPR Gold Coast → 2 SP Great Barrier Reef → 3 PP Outback → 4 SPPP Darwin (Kontrast, `contrast: true`) →
5 PROG Perth → 6 GOING Melbourne → Test.
Writing Track (Thema „Is Australia worth visiting?“, Klassenarbeit später: Artikel „High school year in Australia“ – Aufgabe nur in `private/`):
ART Alice Springs (Info-Station, `lesson.html?st=ART`, ohne KI) → ARG Kata Tjuta (Argumente sortieren, 3–4 wählen, Plan; `lesson.html?st=ARG`, Plan bleibt auf dem iPad und reist zusätzlich im Feld „Stärke“ der Abgabe nach ` ### ` ins Sheet) → WRITE Uluru (Writing Coach: Artikel auf Papier, Foto; `-W1` erste Fassung, `-W2` Endfassung; Startcode trägt den Plan aus ARG – vom iPad, sonst aus dem Sheet).
Writing Coach = `agents/core-writing.md` + `agents/topics/writing.md` (Raster wie Klassenarbeit, `private/lehrkraft/bewertungsraster-article.md`).
Stationen mit `page: true` + `lesson` in config: ein Durchgang = Stempel (Schritt `<ID>-P`). Stations-IDs nur Buchstaben (Schritt-Regex). Gast-Codes `GAST-KO01…06` (Koala, vorbereitete Reise in `guest.events`: Grammatik bis Reef, Writing bis Kata Tjuta mit Plan; `guest.since` blendet ältere Gast-Abgaben aus; im Apps Script herausgefiltert).
Stationen können sich per `"opensAt"` (ISO-Zeit) selbst freischalten (`loadConfig` in `core.js`).
Unterrichtsbesuch 15.10.: `docs/besuch-15-10.md` – oben steht die **Übergabe** mit aktuellem Stand und Restliste.

## Datenfluss
Kind: Code (z. B. `LOEWE-K7Q2`, per QR) → Check-in (Startwert `<THEMA>-B`) → Arbeitsblatt (Foto an Coach, `-W1`/`-W2`)
→ Üben (`-P`) → Coach-Link „Get your stamp“ → `abgabe.html` → Google Formular → Sheet → Apps Script `doGet` → Karte.

## Regeln (wichtig)
- Keine personenbezogenen Daten ins Repo (öffentlich). Codes sind pseudonym; Zuordnungsliste nur auf Papier.
- Keine Buchseiten/-texte ins Repo. Eigene Illustrationen nur über `Bilder_roh/` + `python tools/bilder.py`.
- UI für Kinder: einfaches Englisch + Deutsch in Klammern. Keine Ranglisten, keine Noten, kein Zeitdruck.
- Nach Änderungen an JS/CSS die Versionsnummer `?v=` in allen `hub/*.html` und JS-Imports erhöhen (Cache der iPads).
- Vor jedem Push: `node docs/tests/routing.test.mjs`. Commit-Identität: Vogelfrei7 noreply.
- Zwei Geräte (Windows-PC, MacBook mit eigenem Klon): Abgleich nur über GitHub. Beim Sitzungsstart holt ein Hook
  (`.claude/settings.json`) automatisch `git pull --ff-only`; meldet er einen Fehler, zuerst klären, nicht weiterarbeiten.
  Am Ende einer Arbeitssitzung anbieten, zu committen und zu pushen. `private/` und `Bilder_roh/` sind nicht auf GitHub:
  Der Windows-Ordner liegt im Synology-/NAS-Ordner; auf dem Mac gleicht `python3 tools/sync_private.py` sie mit dem NAS ab
  (neuere Datei gewinnt, Backup in `../.sync-backup/`, Löschungen werden nicht übertragen). Läuft per Hook automatisch,
  aber nur wo `.claude/sync-nas.json` (NAS-Pfad, ignoriert) existiert.
- `hub/intro.html` ist ein Entwurf (noch nicht verlinkt).
- `hub/konzept.html` = animierte Präsentation für den Besuch am 15.10., in 6 Phasen (Leiste unten links, Shift + 1–6):
  Ankommen (Standbild „Eine Klasse. 32 Lernwege.“, Karte in Schleife) → Rückblick (Pre-Test, echte Zahlen simple past im `DATA`-Block – Mi 14.10. prüfen) → Live (Kinderfolie „Choose your road!“ – Ergebnis 0–14/15–20 von 20 entscheidet Road A Practice / Road B Uluru –, Coach-Zeit, Agentenlogik) →
  Konzept (6 Stationen, Design nicht ändern) → Ausblick (andere Fächer, Vertretung, Vision 7–10) → Austausch.
  Pfeiltasten/Clicker, 0–9 = Folie in der Phase, O = Übersicht, `#12.2` = Folie 12, Schritt 2. Eigenständig (CSS/JS inline), nicht verlinkt;
  soll später von der geplanten Lehrerkarte aus aufrufbar sein.
- Änderungen an `agents/core.md` oder `topics/` → `node agents/build.mjs` → Prompt in Sidekick neu einfügen.
- Änderungen an `apps-script/` → Lehrkraft muss die Datei im Apps-Script-Editor ersetzen.
