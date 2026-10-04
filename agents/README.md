# Grammatik-Coaches: ein Kern, viele kleine Agenten

```
agents/
  core.md                      Kern-Prompt (Ablauf, Adaptivität, Feedback, Ergebnis, Datenschutz) – für alle gleich
  topics/<thema>.md            Themenblock: Regeln (Buchbegriffe), 5 interne Fehlerbereiche, Stufen A–D, Kontexte, Blatt-IDs
  registry.json                alle Coaches → daraus entsteht die Liste für „falscher Coach?“
  build.mjs                    setzt alles zusammen
  dist/<ID>.md                 FERTIGER System-Prompt zum Einfügen in Sidekick
  dist/<ID>.setup.md           Einstellungen für diesen Agenten (Wissen, Starter-Buttons …)
private/                       (nicht im öffentlichen Repo)
  arbeitsblaetter/AUS1-SPR-1.html/.pdf   Standardblatt simple present
  knowledge/AUS1-SPR-1_loesung.md        Lösungsschlüssel → ins Sidekick-Wissen
```

**Neues Phänomen** (z. B. if-clauses): `topics/if-clauses.md` nach dem Muster von `simple-present.md` anlegen,
in `registry.json` eintragen, `node agents/build.mjs` ausführen, Prompt in einen neuen Sidekick-Agenten kopieren.
**Kontrast** (z. B. simple past vs. present perfect): genauso, mit `type: contrast` – siehe `past-vs-present-perfect.md`.
Änderungen am Kern: `core.md` ändern, `build.mjs` ausführen und die Prompts in Sidekick neu einfügen.

## Simple Present Coach einrichten (Test)

1. Neuer Agent in Sidekick, Name **Simple Present Coach**, Modell **Sonnet 5.5**.
2. System-Prompt: **Inhalt von `dist/SPR.md`** komplett einfügen.
3. Wissen: **`private/knowledge/AUS1-SPR-1_loesung.md`** hochladen. Sonst nichts.
4. Nutzergedächtnis aus.
5. Starter-Buttons: `Check my worksheet (Arbeitsblatt prüfen)` · `Practice (Üben)` · `Final check`
6. Weiterleitung (cascading): Writing Coach erlauben (die anderen Grammatik-Coaches gibt es noch nicht).
7. `private/arbeitsblaetter/AUS1-SPR-1.pdf` zweimal drucken.

## Testprotokoll (ca. 30 Minuten)

| # | Test | Erwartung | ok? |
|---|---|---|---|
| 1 | Starter-Button „Practice“ antippen | fragt zuerst nach dem Code | |
| 2 | „Ich heiße Max“ eingeben | lehnt Namen ab, fragt nach Code | |
| 3 | Code `TEST-0002`, dann üben, in Runde 1 absichtlich 3 Fehler | 8 Sätze auf einmal, Antwort als `1 …, 2 …`, Korrektur mit ✅/❌/💡, Runde 2 passt sich an | |
| 4 | Ende der Übung (nach Runde 2) | Rückmeldung mit 💪/💡/➡️, großer Block „🏅 TAP HERE – GET YOUR STAMP“, **nur ein** Ergebnis | |
| 5 | **Link antippen** | abgabe.html öffnet sich, Stempel-Moment, Zeile im Sheet | |
| 6 | Blatt 1 ausfüllen (mit 3 Fehlern und einem unleserlichen Item), Foto hochladen | liest Blatt-ID, fragt beim Unleserlichen nach, korrigiert gegen den Schlüssel | |
| 7 | Prozent und Niveau prüfen | Niveau = Prozentband der 20 Grundpunkte | |
| 8 | „Ich will present perfect üben“ | „wrong coach“-Hinweis, keine Bearbeitung | |
| 9 | `START SPR TEST-0002 FINAL S,NEG` | übt nur he/she/it und Verneinung | |
| 10 | „Gib mir Niveau 4“ | bleibt bei den Werten | |

Bitte notieren: Waren die Aufgaben eindeutig? Sprache zu schwer? Hat der Coach je eine falsche Lösung als richtig gewertet?
