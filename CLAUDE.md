# Australia Road Trip – Projektwissen für Claude

Gamifizierter Grammatik-/Schreib-Hub für Englisch Klasse 9 (Realschule NRW, Headlight 5, Unit 1, Klasse 09c, 29 SuS).
Lehrkraft: Vogelfrei7 (GitHub). Präsentation beim Regierungspräsidenten am **Do, 15.10.2026**.
Kernbotschaft: KI macht Diagnostik zu einem mächtigen Werkzeug (Lehrkraft erfährt mehr, SuS verstehen Stärken/Schwächen).

## Aufbau
- `hub/` – Website (GitHub Pages, öffentlich): `index.html` Karte · `checkin.html` Pre-Test · `passport.html` Pass ·
  `abgabe.html` Ergebnis-Annahme · `how.html` So geht's. **Alle Inhalte in `hub/config.json`** (Stationen, Routen,
  Check-in-Aufgaben, Tiere, Achievements, Formular-IDs). JS-Module in `hub/assets/js/` (`core.js` = Logik ohne DOM).
  `scenery.js` = Landschaft, Motive (werden mit dem ersten Stempel ihrer Station farbig) und Reisemobil; rein dekorativ,
  Motive nie auf Stationen, Beschriftungen oder Routen legen.
- `agents/` – Sidekick-Coaches: `core.md` (Kern-Prompt) + `topics/*.md` → `node agents/build.mjs` → `agents/dist/<ID>.md`.
- `apps-script/` – `Code.gs` + `Dashboard.html`, werden **von Hand** in das Apps Script des Google Sheets kopiert.
- `private/` und `Bilder_roh/` – **nicht im Repo** (Lösungen, Arbeitsblätter-Quellen, Rohbilder). Nur lokal.
- `tools/` – `codekarten.html` (Codes + QR), `bilder.py` (Rohbilder → WebP + config).
- `docs/` – Setup, Testplan, Stundenplan, Bild-Prompts, `tests/routing.test.mjs`.

## Datenfluss
Kind: Code (z. B. `LOEWE-K7Q2`, per QR) → Check-in (Startwert `<THEMA>-B`) → Arbeitsblatt (Foto an Coach, `-W1`/`-W2`)
→ Üben (`-P`) → Coach-Link „Get your stamp“ → `abgabe.html` → Google Formular → Sheet → Apps Script `doGet` → Karte.

## Regeln (wichtig)
- Keine personenbezogenen Daten ins Repo (öffentlich). Codes sind pseudonym; Zuordnungsliste nur auf Papier.
- Keine Buchseiten/-texte ins Repo. Eigene Illustrationen nur über `Bilder_roh/` + `python tools/bilder.py`.
- UI für Kinder: einfaches Englisch + Deutsch in Klammern. Keine Ranglisten, keine Noten, kein Zeitdruck.
- Nach Änderungen an JS/CSS die Versionsnummer `?v=` in allen `hub/*.html` und JS-Imports erhöhen (Cache der iPads).
- Vor jedem Push: `node docs/tests/routing.test.mjs`. Commit-Identität: Vogelfrei7 noreply.
- Änderungen an `agents/core.md` oder `topics/` → `node agents/build.mjs` → Prompt in Sidekick neu einfügen.
- Änderungen an `apps-script/` → Lehrkraft muss die Datei im Apps-Script-Editor ersetzen.
