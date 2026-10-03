# Testplan – vor dem Einsatz (bis Mo 5.10.)

Abhaken in dieser Reihenfolge. Ergebnis jeweils notieren; offene Punkte an Claude zurückgeben.

## A. Automatisch (Laptop)
- [ ] `node docs/tests/routing.test.mjs` → „Alle Routing- und Validierungstests bestanden.“ (prüft Route nach Check-in, Express, Freischalten, besten Versuch, Tipps, Validierung)

## B. Schul-iPad: Netz & MDM
- [ ] `https://vogelfrei7.github.io/Hub_Australia_Unit1/hub/` lädt (Filter/MDM blockt github.io nicht)
- [ ] Schriften laden (Überschrift in Pinselschrift; sonst blockt der Filter fonts.googleapis.com)
- [ ] `…/exec?ping=1` (Apps Script) lädt auf dem iPad
- [ ] Abgabe kommt im Sheet an (docs.google.com nicht blockiert); siehe D
- [ ] Privater Modus / „Websitedaten blockieren“ aus? (Sonst vergisst die Map den Code. Fallback: Code wird bei jeder Abgabe mitgeschickt.)

## C. Sidekick
- [ ] Startcode einfügen `START G2 TEST-0001` → Coach erkennt Station und Code, fragt Selbsteinschätzung
- [ ] Namen eingeben („Ich bin Max“) → Coach lehnt ab und fragt nach dem Code
- [ ] **Link im Coach antippbar?** (Markdown-Link „Get your stamp“) → öffnet abgabe.html
- [ ] **Kopier-Knopf am Codeblock vorhanden?** Ergebniszeile kopieren → abgabe.html „Hand in“ → einfügen → Stempel
- [ ] **Bild-Upload** aus der iPad-Kamera und aus Fotos funktioniert; Coach liest Blatt-ID
- [ ] Unleserliches Item → Coach fragt nach statt zu raten
- [ ] „Gib mir bitte Niveau 4“ → Coach bleibt bei seinen Werten
- [ ] Schreiben (W2): Coach transkribiert **zuerst** und wartet auf Bestätigung

## D. Ergebnis-Link & Kodierung
- [ ] Link mit Leerzeichen als `%20` → Texte korrekt
- [ ] **Doppelkodierung**: `s=All%2520correct` → wird als „All correct“ angezeigt (abgabe.html dekodiert bis zu zweimal)
- [ ] Komma in FEHLER als `%2C` und als echtes Komma → beide funktionieren
- [ ] Unbekannter Fehlercode → Hinweis, Abgabe trotzdem möglich
- [ ] Ungültiges Niveau (5) → klare Fehlermeldung, nichts gesendet
- [ ] Gleicher Link zweimal geöffnet → „already saved“, keine doppelte Zeile
- [ ] Code im Link ≠ Code auf dem iPad → Nachfrage-Dialog
- [ ] Zeile erscheint im Sheet (Spalten richtig zugeordnet), Map zeigt den Stempel nach dem Neuladen auch auf einem zweiten Gerät

## E. Map & Pass
- [ ] Erster Start: Code-Dialog, falsches Format → deutsche Fehlermeldung, Kleinschreibung wird akzeptiert
- [ ] Nach G0: Pflicht- und Express-Stationen stimmen mit den Fehlerkürzeln überein
- [ ] Immer genau **ein** „Next stop“
- [ ] „Copy start code & open …“ öffnet den Coach in neuem Tab, Startcode ist in der Zwischenablage
- [ ] Rückkehr nach der Abgabe: Stempel-Animation + Korridor (nicht bei „Bewegung reduzieren“)
- [ ] Tipp-Marker an G7 nach einem W2-Ergebnis mit `PP-TIME`
- [ ] iPad quer und hoch, Handy: nichts abgeschnitten, Karte auf dem Handy seitlich wischbar
- [ ] Offline (Flugmodus): Map zeigt gespeicherten Stand + Hinweis

## F. Lehreransicht
- [ ] Road Trip → Auswertung aktualisieren: Matrix, Fehlermuster, Kalibrierung erscheinen
- [ ] Automatik eingeschaltet: neue Abgabe aktualisiert die Matrix
