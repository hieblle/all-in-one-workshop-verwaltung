# dbrains Workshop-Hub

All-in-One-App der dbrains academy: **Source of Truth für den Workshop-Prozess**
(Workshops, Trainer, Checklisten), die Daten an bestehende Tools ausspielt.
Vollständiger Plan mit Roadmap: siehe @PLAN.md — dort Phasen abhaken.

## Architektur-Prinzip (nicht verhandelbar)

- Die App ist ein **Hub, kein Monolith**. Sie ersetzt NUR die Notion "Workshop Liste".
- **Bleibt extern, nur anbinden/verlinken:** Notion (PM + Wissen), SharePoint (alle
  Dateien — App speichert URLs, niemals Dateien), MS Forms (App liest Antworten via
  Graph API), Outlook, Teams, SevDesk, HubSpot.
- Datenfluss: App führt → Tools folgen (Sync-Out). Externe Systeme liefern Status
  zurück (Sync-In) für Checklisten-Auto-Checks.
- Kein CRM-Nachbau, kein Datei-Speicher, kein Formular-Builder.

## Stack

- Next.js (App Router) + TypeScript + Tailwind, responsive (Desktop + Mobile-Web)
- PostgreSQL + Drizzle ORM; pgvector für RAG (erst Phase 3)
- Auth: Entra ID SSO (internes Team) + Magic Link (externe Trainer)
- Background-Jobs: pg-boss (Erinnerungen, Sync)
- Deployment: Docker auf Hetzner via Coolify; DB-Backups täglich

## Befehle

- `npm run dev` — Dev-Server
- `npm run build && npm run typecheck && npm run lint` — nach jeder Änderung
- `npm run db:generate && npm run db:migrate` — Drizzle-Migrationen
- `npm run test` — Vitest

## Konventionen

- Sprache: UI-Texte Deutsch, Code/Identifier/Kommentare Englisch
- DB: snake_case; TypeScript: camelCase; Komponenten: PascalCase
- Schema lebt in `src/db/schema/` — eine Datei pro Aggregat (workshop, trainer,
  checklist, ...). Änderungen NUR über Migrationen, nie direkt in der DB.
- Integrationen kapseln in `src/integrations/<system>/` (graph, notion, sevdesk,
  hubspot) — kein API-Call außerhalb dieser Ordner.
- Rechte: Jede Query für Trainer-Rollen MUSS über die Zuweisungs-Prüfung laufen
  (`assertTrainerAccess`) — externe Trainer sehen nur zugewiesene Workshops.
- Zod-Validierung an jeder API-Grenze (Routes, Server Actions, Webhooks).

## Regeln

- WICHTIG: Nach jeder Code-Änderung typecheck ausführen.
- Minimale Änderungen — keinen unbeteiligten Code refactoren.
- Ein Commit pro logischer Änderung, Conventional Commits (feat/fix/chore).
- Secrets nur über `.env` (Vorlage: `.env.example` pflegen), niemals committen.
- Bei zwei möglichen Architektur-Ansätzen: beide kurz erklären, mich wählen lassen.
- Graph-API-, SevDesk- und Notion-Aufrufe immer mit Retry + Fehler-Log versehen —
  Sync-Fehler dürfen die App nie blockieren (Queue, nicht Request-Pfad).
- Domänensprache beibehalten: Workshop-Status heißen Vorabstimmung, Angebot,
  Vorbereitung, Durchführung, Nachbereitung, Done (wie Notion-Vorlage).

## Referenzen

- Plan & Roadmap: @PLAN.md
- Datenmodell-Vorbild: Notion-DB "Workshop Liste" (Felder in PLAN.md §4)
- Graph API Docs: https://learn.microsoft.com/graph — SevDesk API: https://api.sevdesk.de
