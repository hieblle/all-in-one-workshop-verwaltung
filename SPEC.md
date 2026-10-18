# dbrains Workshop-Hub — Spezifikation

Stand: 18.10.2026 · Ergebnis der Grilling-Session mit Leon
Diese Datei ist die **maßgebliche Vorgabe**. Der alte Plan liegt unter
`docs/archiv/PLAN-2026-07.md` — nützliches Material, aber nicht verbindlich.

## 0. Grundsätze

- Internes Tool, das die Prozesse mit Trainern erleichtert. Daten sind wichtig,
  aber nicht hochgeheim → **schlanke Lösungen, nichts übertreiben.**
- Hub ist die führende Quelle für Workshops, sobald er live ist (Stichtag, §8).
- Der Hub speichert **keine Dateien** (nur Links) und **keine Teilnehmerdaten**.
- Der Hub mailt **nie an Kunden oder Teilnehmer**, nur an Team und Trainer.

## 1. Datenmodell (Änderungen gegenüber heute)

| Einheit | Entscheidung |
|---|---|
| **Termin** (`workshop`) | bleibt; neues Feld `verantwortlich_intern` (optional, Fallback `service@`); genau **ein** Präsentations-Link (manuell erstellter SharePoint-Freigabe-Link) |
| **Modul** (neu) | schlank: Name, SharePoint-Link (nur Team sichtbar), optional Kurzbeschreibung. Termin ↔ Modul: n:m, optional |
| **Vorschlag** (neu) | entsteht während/nach dem Workshop (Trainer-Feedback oder Team). Text, Termin, optional Modul. Status `offen` / `umgesetzt` / `verworfen` mit Datum + Person |
| **Änderung** (neu, = Change-Log) | entsteht bei der Vorbereitung: was geändert, wer, wann, bei welchem Termin, Modul oder nur individuelles Deck; optional Verweis auf Vorschlag → setzt ihn auf `umgesetzt` |
| **Trainer-Feedback** (neu) | Abschnitt auf der Workshop-Seite: Zufriedenheit Abwicklung (1–5) + Text, Verlauf Workshop (1–5) + Text, Vorschläge (je Eintrag → Vorschlag), Sonstiges |
| **Kunde** | HubSpot-ID nur optionales Feld, keine Integration |
| **Wiederkehrende Erinnerung** (neu) | Titel, Rhythmus, Empfänger, optional Link/Notiz. Nur Admin |
| **Verlauf** (neu) | eine Tabelle: wer, wann, Entität, Feld, alt → neu. Automatisch für alle Änderungen |
| **Mail-/Kalender-Protokoll** (neu) | jede erzeugte Mail / Kalenderaktion: wann, an wen, warum, Ergebnis |
| ~~Austausch-Thread~~ | **entfällt** (läuft über Standardkanäle) |
| ~~Verfügbarkeiten~~ | **entfällt vorerst** |
| Notion-Link am Termin | bleibt (nur Team) — für Aufbereitungsnotizen bis §9 |

Löschen: **Archivieren statt Löschen** für Termine, Trainer, Kunden, Module.
Endgültig löschen nur Admin mit Rückfrage. Keine Kaskaden-Löschung abhängiger Daten.
Checklisten-Punkte speichern `erledigt_von` / `erledigt_am`.

## 2. Rollen & Sichtbarkeit

- **Admin** (Leon): endgültig löschen, Team-Konten, Checklisten-Vorlagen,
  wiederkehrende Erinnerungen, Not-Aus, Umstellung Entwurf → Versand, erhält Eskalationen.
- **Team**: Tagesgeschäft — Termine anlegen/bearbeiten/archivieren, Trainer anlegen
  und zuweisen, Checklisten, Vorschläge/Änderungen.
- **Trainer** sieht nur **eigene** Termine, und dort nur:
  Name, Status, Typ, Format/Modus, Kunde, Ansprechperson, Termine (1/2/FUP),
  Teams-Link, Präsentations-Link, Mit-Trainer, Modulnamen (ohne Links), eigene
  Checklisten-Punkte, Vorschläge + Change-Log (aller Module + eigener Termine),
  eigenes Feedback.
  **Nicht:** Betrag, Rechnungsstatus, interne Notizen, Team-Checkliste, Forms-Links,
  Notion-Link, Modul-Links, andere Termine.
- Trainer-Abfragen laden **nur die erlaubten Felder** (nicht erst in der UI ausblenden).

## 3. Login

- Team/Admin: Microsoft Entra, **nur Konten aus dem dbrains-Mandanten**
  (explizite `tid`-Prüfung im Code).
- Trainer (meist ohne Microsoft-Konto): festes Konto, **Login-Link auf Anfrage**
  (E-Mail eingeben), Sitzung 30 Tage.
- Deaktivierter Trainer → Sitzung endet sofort. Login-Link atomar einlösen.

## 4. Checkliste

Zwei Arten in **einer** Übersicht pro Termin:
- ☐ **Aufgabe** (Mensch) — nur diese erzeugen Erinnerungen; Hub hakt selbst ab, wo er es erkennen kann.
- ⚙ **Automatik** (Hub) — nur Status: ✓ erledigt · ⏳ geplant · ⚠ fehlgeschlagen (→ Alarm).

| Phase | | Schritt | Frist | Wer / Auslöser |
|---|---|---|---|---|
| Vorabstimmung | ☐ | Erstgespräch dokumentieren | −42 | Team |
| | ☐ | Termin mit Kunde abstimmen und eintragen | −35 | Team · auto-abgehakt bei Datum |
| | ⚙ | Kalendereintrag `service@`, vorläufig | | Termin eingetragen |
| Angebot | ☐ | Angebot erstellen und versenden | −28 | Team |
| | ☐ | Angebot nachfassen | −21 | Team · entfällt bei Status Vorbereitung |
| | ☐ | Trainer zuweisen | −21 | Team · auto-abgehakt bei Zuweisung |
| | ⚙ | Anfrage-Mail an Trainer | | Zuweisung |
| | ⚙ | Zusage Trainer | | Klick im Portal · Absage → Mail ans Team |
| Vorbereitung | ⚙ | Kalender fixiert, Trainer eingeladen | | Status Vorbereitung |
| | ⚙ | Teams-Meeting erstellt (Online) | | mit Kalender · bei ⚠ → Aufgabe „Teams-Link eintragen“ |
| | ⚙ | Infopaket an Trainer | | Status Vorbereitung |
| | ☐ | Vorab-Fragebogen an Teilnehmer senden | −14 | Team |
| | ☐ | Raum, Technik, Catering klären (Präsenz) | −7 | Team |
| | ☐ | Präsentation finalisieren, Link eintragen | −3 | Lead-Trainer · auto-abgehakt bei Link |
| | ☐ | Änderungen an Folien eintragen | −3 | Lead-Trainer · zeigt offene Vorschläge der Module |
| Nachbereitung | ⚙ | Erinnerung „Feedback ausfüllen“ an Trainer | +1 | automatisch, **einmalig** |
| | ⚙ | Trainer-Feedback eingegangen | | bei +7 offen → Aufgabe fürs Team |
| | ☐ | Teilnehmer-Feedback auswerten (Forms-Link) | +3 | Team |
| | ☐ | Follow-up-Mail mit Materialien an Kunde | +3 | Team |
| | ☐ | Bei Ansprechperson nachfragen, ob alles gepasst hat | +7 | Team |
| | ☐ | Rechnung stellen | +7 | Team (manuell bis SevDesk) |

Schritte „Online“/„Präsenz“ entfallen je nach Modus automatisch. Fristen relativ zu
Termin 1, verschieben sich mit. Inhalte werden später im Team verfeinert (Admin, ohne Code).

## 5. Erinnerungen & Mails

- Team-Aufgaben → `verantwortlich_intern`, sonst `service@`; einzeln umhängbar.
- **Eine Sammel-Mail pro Person am Morgen** (nur wenn etwas fällig/überfällig ist).
- Sofort-Mails: Trainer-Absage, Eskalation, technische Alarme.
- Eskalation: Team-Aufgabe 2 Tage überfällig → Admin; Trainer-Aufgabe überfällig → verantwortlich intern.
- Trainer-Mails:
  1. Zuweisung *angefragt* → Anfrage-Mail (Datum, Kunde, Thema, Login-Link), Zu-/Absage im Portal
  2. Zusage → Kalender-Einladung (keine extra Mail)
  3. Status Vorbereitung → Infopaket (Termine, Ort/Teams, Ansprechperson, Link, eigene Aufgaben)
  4. Relevante Änderung ohne Kalenderbezug (z. B. neue Präsentation) → kurze Update-Mail
  5. +1 → einmalige Feedback-Erinnerung
- Wiederkehrende Erinnerungen nur an Admin (Mail + Dashboard), z. B. monatlich
  „Trainer-Feedbackrunde terminieren“ (Termin organisiert Leon selbst), „Microsoft-Secret erneuern“.
- Teilnehmer-Feedback: nur Forms-Link am Termin + Aufgabe bei +3.

## 6. Kalender

- Organisator **`service@`**. Eintrag entsteht, sobald ein Termin eingetragen ist:
  **vorläufig** (Outlook „mit Vorbehalt“, Titel „[Vorläufig]“).
  Status Vorbereitung (Angebot angenommen) → **fixiert**.
- Jeder Termin hat Beginn und Ende (Standard 09:00–17:00, im Formular änderbar).
- Termin 2 und FUP je eigener Eintrag. Datumsänderung → Update an alle;
  Abgesagt → Absage; On-Hold → Titel „[On Hold]“.
- Inhalt: „Workshop · Kunde · Trainer“, Ort/Teams-Link, Link zur Hub-Seite. Keine internen Infos.
- Trainer werden bei Zusage als Teilnehmer eingeladen.
- Teams-Meeting: automatisch beim Anlegen versuchen, im Hub manuell überschreibbar
  (→ Update von Kalender + Trainer-Info). **Offen:** Ablauf im Team klären (§9).
- Hub fasst nur Termine an, deren ID er selbst gespeichert hat.

## 7. Microsoft 365

- **Eine Entra-App**, app-only, **Client-Secret** (max. 24 Monate, Erinnerung 1 Monat vor Ablauf).
- Rechte über **RBAC for Applications** (Exchange), **nicht** mandantenweit in Entra:
  - `service@`: nur Kalender lesen/schreiben
  - `trainer@` (eigenes freigegebenes Postfach, kein Alias): nur Mail senden;
    in der Testphase zusätzlich Mail-Schreibzugriff für Entwürfe, danach entfernen
- Keine SharePoint-Rechte (Links manuell), kein Microsoft-MCP, direkte Graph-API.
- MS Forms hat keine offizielle API → vorerst nur Link (§9).
- Schutzmechanismen:
  - Testphase: Mails als **Entwurf** in `trainer@`; Kalender ohne Trainer-Einladungen
  - Empfänger nur angelegte Trainer/Team-Mitglieder
  - Mengenbremse (z. B. 50/Tag, 10 pro Empfänger) → Stopp + Alarm
  - Not-Aus (Admin), Warteschlange bleibt prüfbar
  - Protokoll jeder Mail/Kalenderaktion
  - Schrittweise Freischaltung: erst Admin, dann Team, dann Trainer

## 8. Stufen

1. **MVP (lokal)** ✅ umgesetzt 18.10.2026 — UI finalisieren, durchklicken. Test-Login (als Admin/Team/Trainer X),
   **Postausgang-Vorschau** statt Versand, **„Datum simulieren“**, nur Testdaten. Umfang:
   - Aufräumen: Thread + Verfügbarkeiten raus, HubSpot optional
   - Archivieren, Verlauf, Rollen Admin/Team
   - Trainer-Abfrage nur erlaubte Felder, Login-Link atomar, Deaktivierung beendet Sitzung
   - Verantwortlich intern + Fallback, Eskalationslogik, Sammel-Mail
   - Checkliste Aufgabe/Automatik + Start-Vorlage (§4)
   - Module, Vorschläge, Change-Log, Trainer-Feedback
   - Wiederkehrende Erinnerungen, Alarm bei 3× fehlgeschlagenem Job
2. **Server (Hetzner + Coolify)** — Stand wie MVP, online. Passwortschutz (Coolify) vor
   dem ganzen Hub + Test-Login. Port 3000 nicht öffentlich, Sicherheits-Header.
   Coolify-Benachrichtigung „nicht erreichbar“. Weiter nur Testdaten, keine echten Mails.
3. **Microsoft** — Entra-Login (inkl. `tid`-Prüfung), danach Passwortschutz + Test-Login weg.
   Mails über `trainer@` als Entwürfe, Kalender `service@` ohne Trainer-Einladungen.
   Trainer-Login-Links per Mail. Anleitung zur App-Registrierung für Leon.
4. **Start mit echten Daten** — Testdaten löschen, laufende Workshops von Hand
   übertragen, Notion-Hinweis + Stichtag (neue Workshops nur noch im Hub,
   abgeschlossene bleiben in Notion), Umstellung auf echten Versand, Trainer einladen.

## 9. Liste für später

- [ ] **AVV mit Hetzner** (vor echten Trainer-Daten auf dem Server) + Verarbeitungsverzeichnis
- [ ] Backups schlank: täglicher Dump verschlüsselt auf zweiten Speicher (Storage Box), 30 Tage, Alarm, einmaliger Restore-Test
- [ ] Löschfristen / Datenschutz-Routinen
- [ ] Automatische Tests mit echter DB für Trainer-Zugriff
- [ ] Teilnehmer-Feedback automatisch übernehmen (Forms hat keine API — Lösung finden) + Zusammenfassung für Trainer
- [ ] Aufbereitungsnotizen (heute Notion) in den Hub
- [ ] Notion-Import alter Workshops (optional)
- [ ] Teams-Links: Ablauf im Team klären
- [ ] Passkeys für Trainer
- [ ] Automatische SharePoint-Freigabe-Links
- [ ] Teams-Kanal für dringende Hinweise (Teams Workflows)
- [ ] SevDesk-Anbindung
- [ ] Eigener MCP-Server / KI-Auswertungen / Agenten (Datenbasis dafür sauber halten)
- [ ] Fehler-Tracking, Statusseite
- [ ] Hosting-Details Server (bei Stufe 2 entscheiden)
