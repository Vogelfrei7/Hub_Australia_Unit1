# Unterrichtsbesuch Do 15.10.2026 – Ablaufplan

Gäste: Regierungspräsident, Dezernentin (Bez. Düsseldorf), Schuldezernentin (Wuppertal), Fachberater KI der Bez.-Reg., ggf. eine weitere Person.
Thema der Stunde: **simple past oder present perfect?** (Station 4 Darwin). Die Gäste kommen, wenn die Kinder ihr Blatt hochladen.

## Die Woche davor

| Tag | Stunde | Lagerfeuer im Dashboard | Ergebnis für Donnerstag |
|---|---|---|---|
| Fr 09.10. | simple past abschließen: Üben, goldenes Blatt | – | simple past vollständig |
| Mo 12.10. | present perfect: 10 Min. Wiederholung, dann AUS1-PP-1 + Coach | **Outback anzünden** (öffnet Station 3 für alle) | erste Present-Perfect-Werte |
| Mi 14.10. | present perfect üben (adaptiv), goldenes Blatt AUS1-PP-2. Lotsen testen nebenbei den Kontrast-Coach. **Abends: KI-Auswertung erstellen.** | – | Lernzuwachs simple past + present perfect seit dem Check-in |
| Do 15.10. | Kontrast (mit Gästen) | **Darwin anzünden** zu Stundenbeginn | live: Kontrast-Fehler |

## Donnerstag: die Stunde

| Zeit | Was passiert | Du | Material |
|---|---|---|---|
| vor den Gästen | **Lagerfeuer:** Lenas Interview (AUS1-SPPP-R) lesen, markieren, Regel-Detektiv, Tafelbild. Danach AUS1-SPPP-1 bearbeiten. Im Dashboard: Darwin anzünden, „Today in class“ auf 🤖 Coach time. | normale Stunde | AUS1-SPPP-R, Tafel |
| 0–3 | **Gäste kommen**, die Kinder fotografieren gerade ihr Blatt. Kurze Einordnung an der Tür oder am Beamer (Karte im Demo-Modus oder eigener Code). | Kernsatz 1 | Beamer: Karte |
| 3–10 | **Hochladen und Rückmeldung:** Jeder Gast steht bei seinem Lotsen. Der Lotse zeigt seinen **eigenen** Weg: Foto → Rückmeldung → „Get your stamp“ → Stern auf der Karte → adaptives Üben (Runde 1 nach Blatt-Ergebnis, Runde 2 angepasst). | Kernsatz 2, du gehst mit | iPads der Kinder |
| 10–20 | **Gäste reisen mit:** Gast-Karte scannen, Lotse daneben, eine Übungsrunde mit dem Coach. Die Kinder üben weiter. | Kernsatz 3 | Gast-Karten, Gast-iPads |
| 20–27 | **Dashboard am Beamer** (Präsentationsmodus): Lernzuwachs seit dem Check-in (simple past, present perfect), Fehlermuster von heute live, ein Satz aus der KI-Kurzfassung, deine Entscheidung daraus. | Kernsatz 4 | Dashboard-Adresse |
| 27–30 | **Ausblick:** „Was ihr heute oft verwechselt habt, üben wir morgen.“ Ein Kind sagt einen Satz, du sagst deinen Schlusssatz. | Kernsatz 5 | – |

### Kernsätze (Vorschläge – in eigenen Worten)
1. „Sie sind mitten in unserer Reise gelandet. Die Klasse ist heute in Darwin – das Lagerfeuer zeigt: Den Unterschied haben wir eben gemeinsam erarbeitet, ganz ohne KI.“
2. „Jedes Kind bekommt jetzt in 30 Sekunden eine Rückmeldung zu seinem eigenen Blatt – und übt danach genau auf seiner Stufe weiter.“
3. „Probieren Sie es selbst – Ihr Lotse zeigt Ihnen, wie es geht.“
4. „Das hier ist mein Werkzeug: Ich sehe seit dem Check-in am 05.10., wo jedes Kind steht und woran die Klasse gerade scheitert. Daraus plane ich die nächste Stunde.“
5. „Die KI liefert Hinweise – ich entscheide.“

## Lotsen-Briefing (Mi 14.10., 5 Minuten)
- **Wer:** 4–5 Kinder, die sicher mit dem iPad sind und gern erklären. Jedes Kind betreut einen Gast.
- **Teil 1 – der eigene Weg (Minute 3–10):** Gast begrüßen („Hello, I'm your guide!“ – gern auf Deutsch weiter). Dann zeigen sie, wie **sie selbst**
  mit ihrem Arbeitsblatt weitermachen: Foto ans Coach-Feld → Rückmeldung lesen und kurz erklären („Hier sagt er mir, was ich falsch hatte – und warum.“)
  → „Get your stamp“ → Stern auf der Karte → **Practice** starten. Hier sieht der Gast das **Adaptive**: Runde 1 richtet sich nach dem Blatt-Ergebnis,
  Runde 2 wird je nach Ergebnis schwerer („Round 2 is a bit harder“) oder leichter (mit Hilfebox).
- **Teil 2 – der Gast probiert selbst (Minute 10–20):** Gast-Karte scannen lassen, auf Darwin tippen, Startcode kopieren und einfügen (der Gast-Startcode
  startet direkt das Üben), beim Antworten helfen („1 saw, 2 have been …“), am Ende „Get your stamp“. Gäste machen **eine** Runde auf Stufe B –
  ohne Arbeitsblatt gibt es nichts, woran sich der Coach anpassen könnte. Die Anpassung haben sie in Teil 1 beim Lotsen gesehen.
- **Was sie erzählen dürfen:** ihren eigenen Pass zeigen, was der Coach ihnen gesagt hat, was sie schwer fanden. Nichts auswendig lernen.
- **Generalprobe:** Mittwoch macht jeder Lotse einmal selbst eine Runde mit einem Gast-Code (GAST-KO01 … KO06). Danach im Dashboard prüfen: Die Gast-Abgaben erscheinen nicht.

## Technik-Checkliste (Mittwochabend)
- [ ] Sidekick: Present Perfect Coach und Past or Perfect Coach angelegt, Prompts `agents/dist/PP.md` und `agents/dist/SPPP.md`,
      Wissen: `AUS1-PP-1_loesung.md`, `AUS1-PP-2_loesung.md` bzw. `AUS1-SPPP-1_loesung.md`, `AUS1-SPPP-2_loesung.md`.
      Prompts von SPR und SP neu einfügen (sie leiten jetzt an die neuen Coaches weiter).
- [ ] Beide Eingabe-Adressen an Claude geschickt → Stationen 3 und 4 freigeschaltet.
- [ ] `apps-script/Code.gs` ersetzt (Gäste-Filter) → Bereitstellen → Neue Version.
- [ ] Drucken: AUS1-SPPP-R (30×), AUS1-SPPP-1 (32× weiß), AUS1-SPPP-2 (12× gold), Gast-Karten `tools/gastkarten.html` (1×, ausschneiden).
- [ ] **Gast-iPads:** 4–5 eigene iPads für die Gäste (nicht die der Kinder – sonst ist danach der Gast-Code auf dem Kinder-iPad).
      Falls doch Kinder-iPads: danach die eigene Code-Karte des Kindes neu scannen.
- [ ] KI-Auswertung Mittwochabend erstellt; Dashboard-Adresse als Lesezeichen am Lehrer-Gerät; Präsentationsmodus getestet.
- [ ] Generalprobe ganz durch: Kinder-Code und Gast-Code, Foto hochladen, Stempel, Dashboard aktualisieren.

## Notfallkarte
| Problem | Lösung |
|---|---|
| WLAN weg | Handy-Hotspot; sonst Demo-Karte zeigen (`…/hub/?demo=1`) und das Bildschirmvideo |
| Coach antwortet langsam | Ruhig bleiben: „Auch das ist echter Unterricht.“ Gäste in der Zwischenzeit die Karte und den Pass zeigen lassen |
| Stempel-Link geht nicht | Ergebniszeile notieren lassen, später über `…/hub/abgabe.html` eintragen |
| Dashboard lädt nicht | Mittwochs-Stand als Bildschirmfoto bereithalten (KI-Bericht + Lernzuwachs) |
| Gast-Code geht nicht | Gast schaut mit dem Lotsen auf dessen Gerät mit |

**Bildschirmvideo (Absicherung):** Dienstag oder Mittwoch einmal einen kompletten Ablauf aufnehmen (iPad-Bildschirmaufnahme):
Karte → Startcode → Foto → Rückmeldung → Get your stamp → Stern auf der Karte.
