# PLAN.md — dbrains Workshop-Hub

> Stand: 12.07.2026 (Plan v2, Hub-Architektur). Quelle: Strategietage-Flipcharts +
> Notion-Seite "All-in-One Workshop Tool". Checkboxen beim Umsetzen abhaken.

## 1. Ziel

Eine zentrale App als **Source of Truth für den Workshop-Prozess** der dbrains
academy. Die App orchestriert; bestehende Tools bleiben und werden angebunden.

Die 4 Kernanforderungen:

1. **Nichts vergessen** → Checklisten-Engine mit Delegation + Erinnerungen
2. **Eine Source of Truth** → Daten aus der App an Tools ausspielen (Outlook, ...)
3. **Trainerabstimmung** → Zuweisung, automatische Info-Mails, Content-Austausch
4. **Workshopverwaltung** → Ablösung der Notion "Workshop Liste"

## 2. Scope

| Bereich | Entscheidung |
|---|---|
| Ersetzt | Notion-DB "Workshop Liste" (einzige Ablösung!) |
| Bleibt + Anbindung | Notion (PM/Wissen), SharePoint (Dateien, nur Links), MS Forms (Antworten lesen), Outlook, Teams, SevDesk, HubSpot |
| Nutzer | Internes Team (4, Entra SSO) + externe Trainer (2–3, wachsend, Magic Link) |
| Nicht im Scope | CRM-Nachbau, Datei-Speicher, Formular-Builder, Stundenliste (Backlog) |

**Regel gegen zwei Wahrheiten:** Ab Go-Live Phase 1 werden Workshops NUR in der
App gepflegt; die Notion "Workshop Liste" wird archiviert oder read-only gespiegelt.

## 3. Nutzerrollen & Rechte

- **Admin / Team** (Entra ID SSO): Vollzugriff
- **Externer Trainer** (Magic Link): sieht ausschließlich zugewiesene Workshops —
  Termin, Ansprechperson, Materialien-Links, eigene Checklistenpunkte,
  Austausch-Thread, Feedback-Rückmeldung, eigene Verfügbarkeit (Selbstauskunft).
  KEIN Zugriff auf Beträge, Rechnung-Status, andere Workshops, interne Notizen.

## 4. Datenmodell

Vorbild: bestehende Notion-DB "Workshop Liste" (bewährte Felder übernehmen).

### workshop
- name, unternehmen_id (FK kunde), ansprechperson
- type (Lehrlinge | Beratung | Maßgeschneiderter Workshop | Agentic AI | Schule |
  Academy | Ideation | Keynote)
- format (dbrains academy | dbrains x SCCH | dbrains x FB | dbrains x Land OÖ)
- modus (ONLINE | VOR ORT | SCCH | Webex)
- status (Vorabstimmung | Angebot | Vorbereitung | Durchführung | Nachbereitung |
  On-Hold/Abgesagt | Done)
- termin_1, termin_2 (nullable), termin_fup (nullable)
- ws_betrag, rechnung_status (warten | senden | gesendet), trainer_re (offen | überwiesen)
- Links: sharepoint_url, notion_project_url, forms_vorab_url, forms_feedback_url,
  sevdesk_id, teams_meeting_url
- verwendetes_slidedeck (Link auf SharePoint)

### trainer
- name, email, extern (bool), verfuegbarkeit_notiz, aktiv

### zuweisung (workshop ↔ trainer)
- rolle (lead | co | uebergabe_extern), status, infomail_gesendet_am

### checklisten_vorlage / checkpunkt_vorlage
- vorlage: name, gilt_fuer_type (nullable = alle)
- punkt: titel, phase (= workshop.status), verantwortlich_rolle,
  faellig_offset_tage (relativ zu termin_1, negativ = davor),
  auto_check_regel (nullable: forms_vorab | forms_feedback | outlook_termin |
  sevdesk_re | teams_meeting)

### checkpunkt (instanziiert pro Workshop)
- workshop_id, vorlage_punkt_id, verantwortlich_user_id, faellig_am,
  status (offen | erledigt | uebersprungen), erledigt_via (manuell | auto)

### thread_kommentar
- workshop_id, autor_id, text, created_at (Trainer-Austausch pro Workshop)

### kunde (leichtgewichtig)
- firma, hubspot_id (nullable), sevdesk_id (nullable)

### nutzer
- name, email, rolle (admin | team | trainer), entra_oid (nullable),
  magic_link_token (nullable)

## 5. Kernfeatures

### F1 Checklisten-Engine ⭐ (Herzstück, Phase 1)
- [ ] Vorlagen-Verwaltung (CRUD) je Workshop-Typ und Phase
- [ ] Auto-Instanziierung der Punkte bei Workshop-Anlage / Statuswechsel
- [ ] Delegation: Verantwortlicher pro Punkt, Fälligkeit relativ zum Termin
- [ ] Erinnerungs-Job (pg-boss): Mail an Verantwortlichen bei Fälligkeit,
      Eskalation an Lead bei Überfälligkeit > 2 Tage
- [ ] Auto-Check-Regeln (Phase 2, sobald Integrationen stehen)

### F2 Workshop-Verwaltung (Phase 1)
- [ ] Listen-/Board-Ansicht mit Filtern (Status, Type, Trainer, Zeitraum)
- [ ] Workshop-Detailseite: Stammdaten, Termine, Links, Checkliste, Thread, Trainer
- [ ] Datenimport aus Notion "Workshop Liste" (einmalig, per Notion API)

### F3 Sync-Out (Phase 2)
- [ ] Outlook: Kalendereinträge für Termine 1/2/FUP aller Beteiligten (Graph API)
- [ ] Teams: Online-Meeting erzeugen bei modus = ONLINE, Link am Workshop speichern
- [ ] Änderungs-Propagation: Terminänderung in App → Kalender aktualisieren

### F4 Trainer-Modul (Phase 2)
- [ ] Zuweisung mit automatischem Info-Paket per Mail (Termin, Kunde,
      Ansprechperson, SharePoint-Links, Checklistenpunkte des Trainers)
- [ ] Trainer-Portal (Magic Link, mobile-tauglich)
- [ ] Austausch-Thread pro Workshop, E-Mail-Benachrichtigung bei neuem Kommentar
- [ ] Verfügbarkeiten als Selbstauskunft (bewusst KEIN Kalender-Sync)

### F5 Sync-In / Auto-Checks (Phase 2)
- [ ] MS Forms: Antworten pollen (Graph API) → Checkpunkt auto-erledigen
- [ ] SevDesk: Angebots-/Rechnungsstatus lesen → rechnung_status + Auto-Check
      (⚠️ setzt SevDesk "Buchhaltung Plus" voraus — vorher klären!)
- [ ] Notion: Projekt-Link-Picker (Projects-DB lesen), Tasks-Anzeige am Workshop

### F6 KI-Schicht (Phase 3)
- [ ] Eigener MCP-Server: Workshops, Checklisten, Trainer als Tools/Resources
- [ ] Agenda-Agent: Agenda-Entwurf aus Vorgespräch-Notizen + Forms-Antworten
- [ ] Feedback-Auswertung: Zusammenfassung + Auffälligkeiten je Workshop
- [ ] RAG (pgvector) über Workshop-Historie für Rückfragen

## 6. Roadmap

### Phase 0 — Fundament (Woche 1–2)
- [x] Next.js + TypeScript + Tailwind + Drizzle Setup, Repo-Struktur
- [x] Postgres-Schema (alle Tabellen aus §4) + Seed-Daten
- [x] Auth: Entra ID SSO + Magic-Link-Flow, Rollen-Middleware (assertTrainerAccess)
- [ ] Hetzner-Server + Coolify, Docker-Deploy, tägliche DB-Backups
      (App-seitig fertig: Dockerfile, docker-compose, Backup-Skript, Doku in
      README — Server-Provisionierung + Coolify-Einrichtung stehen aus)
- [x] .env.example, README, CI (typecheck + lint + test)

### Phase 1 — Workshop-Hub (Woche 3–7)
- [ ] F2 Workshop-Verwaltung komplett
- [ ] F1 Checklisten-Engine (ohne Auto-Checks)
- [ ] Notion-Import der bestehenden Workshops
- [ ] Go-Live intern: Notion "Workshop Liste" einfrieren

### Phase 2 — Integrationen & Trainer (Woche 8–12)
- [ ] F3 Sync-Out (Outlook, Teams)
- [ ] F4 Trainer-Modul + Portal
- [ ] F5 Sync-In + Auto-Checks (Forms, SevDesk, Notion)

### Phase 3 — KI (Woche 13–16)
- [ ] F6 komplett (MCP-Server zuerst — größter Hebel)

### Phase 4 — Agenten (ab Woche 17, Details in §9)
- [ ] Agent-Worker-Setup (Claude Agent SDK, TypeScript) + Freigabe-UI in der App
- [ ] A1 Workshop-Watchdog (täglicher Digest)
- [ ] A2 Trainer-Briefing-Agent
- [ ] A3 Agenda- & Design-Agent
- [ ] A4 After-WS-Agent
- [ ] A5 Angebots-Assistent
- [ ] A6 Redaktions-Agent

### Backlog (bewusst verschoben)
- Stundenliste / Zeiterfassung
- KPI-Dashboard (Reporting-Flipchart)
- Redaktionsplan-Modul (Marketing) — teilweise durch Agent A6 abgedeckt
- HubSpot-Ablösung (eigenes CRM)
- Trainer-Kalender-Sync (erst bei deutlich mehr Trainern)

## 7. Offene Punkte (vor betroffener Phase klären)

- [ ] SevDesk-Upgrade auf "Buchhaltung Plus" freigeben (vor Phase 2)
- [ ] M365 Admin-Consent für Graph-API-Scopes organisieren (vor Phase 2):
      Calendars.ReadWrite, OnlineMeetings.ReadWrite, Mail.Send, Forms/Sites.Read
- [ ] Checklisten-Inhalte je Workshop-Typ mit Team erarbeiten (vor Phase 1 Ende;
      Basis: Checkliste "mit Romana" von Flipchart 1)
- [ ] Feedback-Zeitpunkt + Sichtbarkeit für externe Trainer festlegen
- [ ] AVV mit Hetzner, Verarbeitungsverzeichnis, Aufbewahrung Teilnehmerdaten
- [ ] Entscheidung: Notion "Workshop Liste" archivieren oder read-only spiegeln

## 8. Risiken

1. **SevDesk-API-Tarif** — ohne Upgrade kein Auto-Check für Rechnungen
2. **Graph-Admin-Consent** — blockiert Phase 2, früh anstoßen
3. **Zwei Wahrheiten** — Parallelpflege Notion/App strikt vermeiden (§2-Regel)
4. **Bus-Faktor 1** — Solo-Entwicklung: Doku im Repo, keine Spezialtricks

## 9. Agenten-Roadmap (Phase 4, Claude Agent SDK)

### Technische Basis
- **SDK:** Claude Agent SDK für TypeScript (`@anthropic-ai/claude-agent-sdk`) —
  gleicher Stack wie die App; liefert Agent-Loop, Tool-Ausführung, Subagents,
  MCP-Client. Docs: https://code.claude.com/docs/en/agent-sdk/overview
- **Tool-Schicht:** Der eigene MCP-Server aus Phase 3 ist die primäre
  Tool-Schnittstelle der Agenten (Workshops, Checklisten, Trainer lesen/schreiben).
  Dazu: Graph API (Mail-Entwürfe, Kalender), Notion, SevDesk.
- **Ausführung:** Eigener Worker-Prozess (Docker-Container neben der App),
  Trigger via pg-boss (Statuswechsel-Events) oder Cron. Auth: ANTHROPIC_API_KEY.
- **Leitplanke (nicht verhandelbar):** Agenten erzeugen ENTWÜRFE und Vorschläge —
  keine Mail wird gesendet, kein Angebot verschickt, kein Termin final angelegt
  ohne menschliche Freigabe in der App (Freigabe-Queue-UI).
- Jeder Agent-Lauf wird geloggt (Input, Output, Kosten) — Nachvollziehbarkeit.

### Agenten-Katalog (priorisiert)

**A1 Workshop-Watchdog** — Trigger: täglich (cron, morgens)
Prüft alle Workshops der nächsten 30 Tage ganzheitlich: überfällige Checkpunkte,
fehlende Trainer-Zuweisung, nicht versendete Forms, Termine ohne Kalendereintrag,
offene Rechnungen nach Done. Erzeugt priorisierten Digest an das Team (Mail/Teams).
Wert: erfüllt "nichts vergessen" mit Kontextverständnis statt starrer Regeln.

**A2 Trainer-Briefing-Agent** — Trigger: neue Zuweisung
Stellt das Info-Paket zusammen: SharePoint-Links prüfen, 2–3 ähnliche vergangene
Workshops als Referenz suchen (RAG), Kundenkontext zusammenfassen, Briefing-Mail
entwerfen. Team gibt frei → Versand.

**A3 Agenda- & Design-Agent** — Trigger: Status → Vorbereitung
Liest Vorgespräch-Notizen + Forms-Vorab-Antworten, recherchiert aktuelle Inhalte
(WebSearch-Tool), erzeugt: Agenda-Entwurf, Aufgaben-/Übungsvorschläge,
Materialliste, offene Fragen an den Kunden. (Flipchart 4: "WS designen")

**A4 After-WS-Agent** — Trigger: Status → Nachbereitung
Wertet Feedback-Forms aus (Zusammenfassung + Auffälligkeiten), entwirft
Follow-up-Mail an den Kunden, schlägt FUP-Termin vor, prüft Rechnungs-Checkpunkt.
(Flipchart 2: "After WS")

**A5 Angebots-Assistent** — Trigger: Status → Angebot
Entwirft Angebotstext auf Basis der Erstgespräch-Notizen ("Inhalt lt.
Erstgespräch", Flipchart 4) und ähnlicher vergangener Angebote; legt Entwurf
in SevDesk an (API). Freigabe + Versand bleibt beim Team.

**A6 Redaktions-Agent** — Trigger: wöchentlich
Destilliert aus abgeschlossenen Workshops anonymisierte Learnings und erzeugt
Entwürfe für SM-Posts und Newsletter-Abschnitte in den Redaktionsplan.
(Flipchart 2: "Redaktionsplan / AI Tools") ⚠️ Kundendaten strikt anonymisieren.

### Empfohlene Reihenfolge
A1 → A2 → A4 → A3 → A5 → A6 (aufsteigende Komplexität/Risiko; A1 liefert den
schnellsten sichtbaren Nutzen und testet die Infrastruktur).
