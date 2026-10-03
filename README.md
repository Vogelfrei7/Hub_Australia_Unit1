# Australia Road Trip – KI-Agenten-Hub (Headlight 5, Unit 1)

Gamifizierte Lernreise für Englisch, Jahrgang 9 (Realschule NRW): eine Karte mit 12 Stationen, zwei KI-Coaches
(Tobit Sidekick), ein Reisepass mit Stempeln und eine Diagnostik-Auswertung im Google Sheet.

- **Map:** https://vogelfrei7.github.io/Hub_Australia_Unit1/hub/ · Demo: `…/hub/?demo=1`
- **Einrichtung:** [docs/setup.md](docs/setup.md) · **Tests:** [docs/testplan.md](docs/testplan.md) · **Präsentation:** [docs/demo-ablauf.md](docs/demo-ablauf.md)

## Aufbau

```
hub/            Website (GitHub Pages)
  index.html      Map
  passport.html   Reisepass
  abgabe.html     Abgabe: Link/Einfügen → Prüfen → Stempel → Google-Formular
  config.json     ALLE Inhalte: Stationen, Routen, Fehlerkatalog, Texte, Stempel, Theme, Formular, Agenten
  assets/         css (tokens.css, hub.css), js (core, ui, map, passport, abgabe), img
apps-script/    Code.gs: JSON pro Code für die Map + Auswertungsblätter
prompts/        Grammar-Coach-System-Prompt, Writing-Coach-Ergänzung, wiederverwendbare Module
knowledge/      Struktur- und Fehlerkatalog, Niveaudeskriptoren, Stationen (eigene Texte)
tools/          Code-Karten-Generator
docs/           Setup, Testplan, Demo-Ablauf, Routing-Test
```

## Datenfluss

1. SuS geben einmal ihren Code ein (nur auf dem eigenen iPad gespeichert).
2. Station: Startcode kopieren → Coach → Aufgaben bzw. Blatt-Foto → Ergebnis-Link.
3. `abgabe.html` prüft das Ergebnis, zeigt den Stempel und sendet **eine Zeile** an das Google-Formular.
4. Die Map holt den Stand per Apps Script (`doGet?code=…`) und berechnet daraus Route, Stempel und Tipps.

Ereignisbasiert: eine Zeile pro Abgabe, nichts wird überschrieben, der beste Versuch zählt.

## Grundsätze

Keine personenbezogenen Daten im Repo, keine Buchseiten, nur eigene Illustrationen.
Gamification macht Fortschritt sichtbar, ohne zu belohnen: keine Rangliste, keine Streaks, kein Zeitdruck, keine Sounds.
