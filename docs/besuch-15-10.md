# Unterrichtsbesuch Do 15.10.2026 – Ablaufplan

Gäste: Regierungspräsident, Dezernentin (Bez. Düsseldorf), Schuldezernentin (Wuppertal), Fachberater KI der Bez.-Reg., ggf. eine weitere Person.
Rahmen (Gesamtablauf der Schule, `RP_Schürmann_Ablauf.docx`): **30 Min. Agentic AI im Unterricht + 10 Min. Austausch**, danach Berufsorientierung.
Klasse: ganze 09c (31 Kinder inkl. 2 Sprachseiteneinsteiger, 1 Förderschüler) + 4–5 Lotsinnen und Lotsen. Die Stunde läuft schon **ca. 30 Minuten**, wenn die Gäste kommen.

**Leitidee:** Die Kinder arbeiten, ich rede wenig. Erst erleben lassen, dann einordnen. Die Präsentation `hub/konzept.html` zeigt auf der
digitalen Tafel jederzeit, in welcher Phase wir sind (Phasenleiste unten links).

## Übergabe für einen neuen Chat (Stand Mi 14.10.2026, ca. 22 Uhr)

**Repo:** alles committet und gepusht (letzter Stand auf `main`, Seiten-Version `?v=3.9`). `node docs/tests/routing.test.mjs` läuft grün.
**Nur lokal / NAS (`private/`):** Arbeitsblätter, Handouts, Testartikel, Evidenzcheck – siehe „Dateien für morgen“.

### Was seit dem 12.10. umgesetzt ist (live)
- **Freischaltung per Datum:** `topics.PP` und `topics.WRITE` haben `"opensAt": "2026-10-14T21:00:00+02:00"` → Outback und Uluru sind seit Mi 21 Uhr offen
  (`loadConfig` in `hub/assets/js/core.js` setzt `status` dann auf `active`). Darwin (`SPPP`) bleibt zu.
- **Lagerfeuer Outback** ist im Dashboard angezündet (Datum 14.10.) → Outback ist für alle Kinder offen.
- **Gäste (`GAST-KO01…06`):**
  - vorbereitete Reise in `config.json` → `guest.events`: Grammatik bis Great Barrier Reef (Outback ist „NOW“, ohne Sterne – wie bei der Klasse),
    Writing Track: Alice Springs + Kata Tjuta erledigt, **Uluru ist „NOW“**; die Kata-Tjuta-Abgabe trägt einen **Plan passend zum Testartikel**
    (der Startcode am Uluru kopiert ihn mit).
  - `guest.since = 2026-10-15T00:00:00+02:00`: Abgaben von Gast-Codes **vor Donnerstag 0 Uhr** (Tests, Generalprobe) werden ausgeblendet.
    ⚠️ **Do früh nicht mehr mit Gast-Codes testen** – ab 0 Uhr bleibt jede Gast-Abgabe sichtbar.
  - Gäste dürfen jede offene Station anklicken (`map.js`); ihre Abgaben stehen im Sheet, nicht im Dashboard.
  - Gast-Karten (`tools/gastkarten.html`): QR öffnet **Outback**; Anleitung mit optionalem Schritt **Uluru + Beispielartikel**.
  - Hat ein Gerät schon einen Code, fragt die Karte beim Scannen „Use the code … on this iPad?“ → **OK** tippen.
- **Stempelseite (`abgabe.html`):** Nach dem **Arbeitsblatt** (noch ohne Übung) und nach der **1. Fassung (Uluru)** ist der Hauptknopf
  **„↩ Back to the chat“** (gleicher Tab → zurück, neuer Tab → Tab schließen; sonst Hinweis „oben auf den Chat-Tab tippen“), Karte als 2. Knopf.
  Texte: Grammatik „write *Practice*“, Uluru „final draft auf Papier, dann im Chat *My final draft* + Foto“. Gäste: nur „Back to the map“.
  Auf dem iPad mit Safari **noch nicht getestet** (siehe Restliste).
- **Dashboard + KI-Bericht** (`apps-script/`): Steuerung oben → Auf einen Blick → Was jetzt ansteht (max. 3 je Kategorie, nur behandelte
  Stationen) → KI-Auswertung (JSON, Karten) → Stationen im Detail. Testcodes ausschließbar (Menü „Road Trip → Testcodes ausschließen …“).
  Kennzahl **„Kinder: Fehler beim Üben behoben“** ersetzt „Üben besser als Blatt“ (Niveaus von Blatt und Üben sind nicht vergleichbar:
  Üben-Niveau 4 gibt es erst auf Stufe D). ⚠️ Diese letzte Änderung muss noch ins Apps Script (siehe Restliste).
- **Präsentation (`hub/konzept.html`):** Klasse **31** (31 Lernwege/Kinder/Blätter); Rückblick „Bis hierher: ohne KI.“ (gestern Lagerfeuer,
  heute Arbeitsblatt); neue **Kinderfolie „Choose your road!“** (Folie 4, Live): alle zuerst Foto des Arbeitsblatts → **0–14 von 20 → Road A
  Practice**, **15–20 + 1. Fassung → Road B Uluru**; Zahlen simple past im `DATA`-Block: Niveau 1 **13 → 4**, Verteilung 4/9/14/6,
  Ø **2,1 → 3,0**, **14 von 22** verbessert (Stand Mi abends; Verteilung enthält vermutlich noch 1 Testcode).
- **Klassengröße:** 31 Kinder (inkl. 2 Sprachseiteneinsteiger, 1 Förderschüler) – `config.json` → `classSizes`.

### Restliste Mittwochabend
- [ ] **Apps Script:** `Code.gs` + `Dashboard.html` aus dem Repo im Editor ersetzen → Bereitstellen → neue Version (Kennzahl „Fehler beim Üben behoben“).
- [ ] **KI-Bericht** im Dashboard erstellen und sichern: Dashboard im eigenen Tab öffnen → Cmd + P → „Als PDF sichern“
      (jeder Bericht steht zusätzlich im Blatt „KI-Auswertung“; das Dashboard zeigt immer den letzten).
- [ ] **Drucken:** Gast-Karten (`tools/gastkarten.html`, Seite 1 einmal, Seite 2 je Gast) · Testartikel `private/besuch/testartikel-uluru.pdf` (6×) ·
      Handouts `private/besuch/handout-empfang.pdf` (2×) und `handout-lotsen.pdf` (5×) · prüfen: **AUS1-PP-1 (32× weiß), AUS1-PP-2 (12× gold)**.
- [ ] **Gast-iPads** (4–5, geladen); Gast-Karten optional schon heute scannen (spart morgen Zeit).
- [ ] Optional: **iPad-Test „Back to the chat“** mit eigenem Test-Code (nicht Gast): Outback → Startcode → Foto → GET YOUR STAMP → Knopf.
      Danach den Test-Code über „Testcodes ausschließen …“ herausnehmen.
- [ ] Optional: Writing Coach mit dem Testartikel und `GAST-KO05` (noch heute – ab 0 Uhr bleiben Gast-Abgaben sichtbar).

### Do früh
- [ ] Rollen klären: Empfangsteam (wer spricht, Anrede des Präsidenten – Lücke im Handout), 4–5 Lotsen (≈ 3 Road A, 2 Road B, wer tauscht nach ~10 Min.).
- [ ] Tafel-Gerät: `hub/konzept.html` **lokal** aus dem Klon (läuft ohne WLAN), Vollbild **F**, Clicker testen. Kinderfolie = Folie 4.
- [ ] Lehrer-Gerät: Dashboard als Lesezeichen, „Codes ausblenden“ antippen; gesicherten Bericht als PDF offen halten.
- [ ] In der ersten halben Stunde: Dashboard „Today in class“ → 🤖 Coach time.
- [ ] Optional: Zahlen im Dashboard noch einmal ablesen → `DATA`-Block in `konzept.html` (Claude kann das in einer Minute nachtragen).

### Dateien für morgen
| Datei | Zweck |
|---|---|
| `hub/konzept.html` | Präsentation (lokal öffnen) |
| `tools/gastkarten.html` | Gast-Karten + Anleitung |
| `private/arbeitsblaetter/AUS1-PP-1/-2.pdf` | Arbeitsblätter Outback (weiß/gold) |
| `private/arbeitsblaetter/AUS1-PP-R.pdf` | Regel-Blatt (Mi, Lagerfeuer) – Schreibraum entzerrt |
| `private/arbeitsblaetter/AUS1-WRITE-1.pdf` | Artikel-Plan + Checkliste (an die Kinder geschickt) |
| `private/besuch/handout-empfang.pdf` · `handout-lotsen.pdf` | Vorbereitung Empfangsteam / Lotsen |
| `private/besuch/testartikel-uluru.pdf` | Beispielartikel mit Fehlern für Gäste und Tests |
| `private/lehrkraft/evidenzcheck-lernlandschaft.md` | Evidenzcheck (nur eingesetzte Elemente), Formulierungen für das Gespräch |

### Nach dem Besuch (nicht dringend)
- Achievement „Level up!“ (`core.js`) nutzt noch den verzerrten Vergleich Üben-Niveau > Blatt-Niveau → auf „Fehler behoben“ umstellen.
- Station „Practice test“ (Blue Mountains) als Post-Test (Parallelform des Check-ins) öffnen; verzögerten Post-Test einplanen.
- KI-Bewertungen stichprobenartig selbst doppelt bewerten (je Station 5 Blätter/Texte).
- Info-Stationen Alice Springs/Kata Tjuta: Stempel an eine geschriebene Begründung koppeln (Durchklicken vermeiden).
- Lehrerkarte (Vorführ-Karte) mit Einstieg zu `konzept.html`; ggf. Weitergabe-Fassung der Präsentation.
- `guest.since` und die Gast-Reise nach dem Besuch zurücksetzen oder entfernen.

## Die Woche davor

| Tag | Stunde | Ergebnis für Donnerstag |
|---|---|---|
| Fr 09.10. | simple past abschließen: Üben, goldenes Blatt | simple past vollständig – das Vorzeigebeispiel für den Lernzuwachs |
| Mo 12.10. | **Writing Track:** Alice Springs (`lesson.html?st=ART`) + Kata Tjuta (`lesson.html?st=ARG`, Plan bleibt auf dem iPad). **Hausaufgabe:** Artikel „Is Australia worth visiting?“ – 1. Fassung auf Papier | jedes Kind hat eine 1. Fassung |
| Mi 14.10. | **present perfect: Lagerfeuer Outback** (AUS1-PP-R) – Regeln gemeinsam erarbeiten, ohne Karte und Coach. Lotsen-Briefing + Generalprobe. **Abends:** Lagerfeuer im Dashboard anzünden (Outback und Uluru öffnen sich ab 21 Uhr selbst), KI-Bericht erstellen und lokal speichern, Klassenzahlen in `konzept.html` (Block `DATA`) prüfen | Outback ist Do früh offen, Präsentation und Zahlen aktuell |
| Do 15.10. | AUS1-PP-1 + Present Perfect Coach, Üben, goldenes Blatt AUS1-PP-2 (siehe unten) | erste Present-Perfect-Werte live |

**Grammatik am Donnerstag:** Outback (present perfect). Gäste haben Outback in ihrer vorbereiteten Reise schon erledigt und üben dort direkt.

## Donnerstag: die Stunde

| Zeit | Phase in `konzept.html` | Was passiert | Ich |
|---|---|---|---|
| Mi 14.10. | – | **Lagerfeuer Outback:** present perfect induktiv entdecken, Regel gemeinsam sichern – ohne KI. Abends im Dashboard anzünden. | |
| –30 bis 0 | – (normale Stunde) | **Nur das Arbeitsblatt AUS1-PP-1** auf Papier, jedes Kind allein – noch ohne KI. Im Dashboard: „Today in class“ auf 🤖 Coach time. | normale Stunde |
| kurz vor 0 | **1 Ankommen** | Standbild an der Tafel: „Eine Klasse. 32 Lernwege.“, die Karte läuft in einer Schleife. | Präsentation öffnen, Vollbild (F) |
| 0–2 | **2 Rückblick** | Gäste kommen. „Erst messen. Dann losfahren.“ (Check-in = Pre-Test, Lernzuwachs simple past) → „Bis hierher: ohne KI.“ (gestern Lagerfeuer, heute Arbeitsblatt) → Weggabelung: zwei Wege, ein Prinzip. | Kernsatz 1 |
| 2–24 | **3 Live** | Kinderfolie **„Choose your road!“**: Alle schicken zuerst das Foto ihres Arbeitsblatts an den Outback-Coach. **Die Rückmeldung entscheidet:** 0–14 von 20 richtig → Road A (Practice im Outback); 15–20 und 1. Fassung vorhanden → Road B (Uluru, Writing Coach → Endfassung). Alle machen diese Woche beide Wege. Dann Standbild „Jetzt arbeiten die Kinder.“ mit Beobachtungsauftrag. Die Lotsen zeigen ihren Gästen den eigenen Weg, die Gäste probieren mit Gast-Code selbst. Nebenbei: Folie „Was steckt im Coach?“ erklären. Gegen Ende: **KI-Bericht live erzeugen** und im Dashboard zeigen. | Kernsatz 2 + 3, wenig reden, mitgehen |
| 24–29 | **4 Konzept** | „Unsere Antworten auf 6 Probleme von (KI-)Unterricht.“ – die sechs Stationen zügig durchklicken (Adaptive Lernwege, Diagnostik & Dashboard, Feedback, Gamifikation, Gemeinsam ohne KI, Datenschutz). Die Gäste haben alles gerade gesehen. | Kernsatz 4 |
| 29–30 | **5 Ausblick** | Andere Fächer → Vertretungs-Lernlandkarte → Vision Klasse 7–10 → „Vom Lernweg zur Zukunft“ (Brücke zur Berufsorientierung). | Kernsatz 5 |
| 30–40 | **6 Austausch** | Lagerfeuer mit den Fragen an die Kinder, dann die Kachel „Ihre Fragen“. Die Gäste fragen die Kinder direkt. | moderieren |

### Kernsätze (Vorschläge – in eigenen Worten)
1. „Sie sind mitten in unserer Reise gelandet. Am Anfang stand ein Pre-Test – so sehen wir, wie viel jedes Kind dazulernt.“
2. „Jedes Kind bekommt jetzt sofort eine Rückmeldung zu seinem eigenen Blatt oder Text – und arbeitet auf seinem Niveau weiter.“
3. „Probieren Sie es selbst – Ihre Lotsin, Ihr Lotse zeigt Ihnen, wie es geht.“
4. „Was Sie gerade gesehen haben, sind unsere Antworten auf sechs Probleme von Unterricht.“
5. „Maßgeschneidert auf das aktuelle Thema – übertragbar auf alle Themen und Fächer.“

## Lotsen-Briefing (Mi 14.10., 5 Minuten)
- **Wer:** 4–5 Kinder, die sicher mit dem iPad sind und gern erklären. Jedes Kind betreut einen Gast. Bewusst mischen: etwa 3 auf Road A, 2 auf Road B (mit 1. Fassung); nach ca. 10 Minuten tauschen zwei Lotsen ihre Gäste, damit jeder Gast beide Coaches sieht.
- **Teil 1 – der eigene Weg:** Gast begrüßen („Hello, I'm your guide!“ – gern auf Deutsch weiter). Dann zeigen sie, wie **sie selbst** weitermachen:
  - **Grammatik:** Foto vom Arbeitsblatt ans Coach-Feld → Rückmeldung lesen und kurz erklären („Hier sagt er mir, was ich falsch hatte – und warum.“)
    → „Get your stamp“ → Stern auf der Karte → **Practice**. Hier sieht der Gast das **Adaptive**: Runde 2 wird schwerer („Round 2 is a bit harder“) oder leichter (mit Hilfebox).
  - **Writing (Uluru):** Foto der 1. Fassung (Hausaufgabe) an den Writing Coach → Rückmeldung nach dem Raster → zeigen, was sie überarbeiten und wie viele Punkte das bringen würde.
- **Teil 2 – der Gast probiert selbst:** Gast-Karte scannen lassen, Station tippen, Startcode kopieren und einfügen (der Gast-Startcode startet direkt das Üben),
  beim Antworten helfen, am Ende „Get your stamp“. Gäste machen **eine** Runde auf Stufe B – ohne Arbeitsblatt gibt es nichts, woran sich der Coach anpassen könnte.
- **Austausch:** Die Kinder können zu den Fragen auf der Folie etwas sagen (stolz sein, sofortige Rückmeldung, Coach vs. Lehrkraft). Nichts auswendig lernen.
- **Generalprobe:** Jeder Lotse macht einmal selbst eine Runde mit einem Gast-Code (GAST-KO01 … KO06). Danach im Dashboard prüfen: Die Gast-Abgaben erscheinen nicht.

## Technik-Checkliste (Mittwochabend)
Erledigt: Sidekick-Coaches PP/SPPP angelegt · Eingabe-Adressen eingetragen · Apps Script mit Gäste-Filter, Dashboard-Umbau und
Testcode-Ausschluss eingespielt · Lagerfeuer Outback angezündet · Outback/Uluru per `opensAt` offen · Gast-Codes live geprüft.
Offen: siehe **Restliste Mittwochabend** und **Do früh** oben.

## Notfallkarte
| Problem | Lösung |
|---|---|
| WLAN weg | Handy-Hotspot; `konzept.html` läuft lokal weiter; sonst Demo-Karte zeigen (`…/hub/?demo=1`) und das Bildschirmvideo |
| Coach antwortet langsam | Ruhig bleiben: „Auch das ist echter Unterricht.“ Gäste in der Zwischenzeit die Karte und den Pass zeigen lassen |
| Stempel-Link geht nicht | Ergebniszeile notieren lassen, später über `…/hub/abgabe.html` eintragen |
| Dashboard / Live-Bericht lädt nicht | Mittwochs-Bericht (lokal gespeichert) zeigen |
| Gast-Code geht nicht | Gast schaut mit dem Lotsen auf dessen Gerät mit |
| Zeit wird knapp | Konzept-Phase schneller durchklicken (Animationen tragen sich selbst); Ausblick auf die Vision kürzen |

**Bildschirmvideo (Absicherung):** Dienstag oder Mittwoch einmal einen kompletten Ablauf aufnehmen (iPad-Bildschirmaufnahme):
Karte → Startcode → Foto → Rückmeldung → Get your stamp → Stern auf der Karte.
