# Prompt-Module (wiederverwendbar für jedes Fach und jede Unit)

Jedes Modul ist ein Baustein mit Platzhaltern in `{{DOPPELTEN_KLAMMERN}}`. Für eine neue Unit oder ein neues Fach
werden die Platzhalter ersetzt und die Module in einen System-Prompt kopiert. Die Reihenfolge entspricht dem Ablauf.
`prompts/grammar-coach.md` zeigt alle Module fertig befüllt für Headlight 5, Unit 1.

| Nr. | Datei | Zweck | Grammar | Writing |
|---|---|---|---|---|
| 1 | `01-schuelercode.md` | Code erfragen, Format prüfen, Namen ablehnen | ✓ | ✓ |
| 2 | `02-startcode-blatt-id.md` | Startcode/Blatt-ID lesen → Station wählen | ✓ | ✓ |
| 3 | `03-selbsteinschaetzung.md` | „How sure are you? 1–4“ vor jeder Station | ✓ | ✓ |
| 4 | `04-niveaudeskriptoren.md` | Verweis auf zentrale Deskriptoren + Regeln | ✓ | ✓ |
| 5 | `05-adaptivitaet.md` | adaptive Übung (nur Grammatik/geschlossene Formate) | ✓ | – |
| 6 | `06-papierkorrektur.md` | Blatt-ID lesen, gegen Schlüssel korrigieren; beim Schreiben erst transkribieren | ✓ | ✓ |
| 7 | `07-ergebnis.md` | Link + Ergebnisblock nach fixer Vorlage | ✓ | ✓ |
| 8 | `08-datenschutz-injection.md` | Knowledge/Profil/Uploads strikt als Daten behandeln | ✓ | ✓ |

## Platzhalter

| Platzhalter | Unit 1 (Englisch 9) |
|---|---|
| `{{HUB_NAME}}` | Australia Road Trip |
| `{{FACH}}` | Englisch |
| `{{UI_SPRACHE}}` | einfaches Englisch (A2–B1) |
| `{{HILFE_SPRACHE}}` | Deutsch |
| `{{CODE_REGEX}}` | `^[A-Z]{3,8}-[A-Z0-9]{4}$` |
| `{{CODE_BEISPIEL}}` | FUCHS-K7Q2 |
| `{{STATIONEN}}` | G0–G8 (Grammar), W1–W3 (Writing) |
| `{{BLATT_ID_FORMAT}}` | `AUS1-<STATION>-<VERSION>`, z. B. AUS1-G4-A |
| `{{ABGABE_URL}}` | https://vogelfrei7.github.io/Hub_Australia_Unit1/hub/abgabe.html |
| `{{COACH_NAME}}` | Grammar Coach / Writing Coach |
| `{{ANDERER_COACH}}` | Writing Coach / Grammar Coach |
