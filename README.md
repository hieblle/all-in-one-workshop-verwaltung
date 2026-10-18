# dbrains Workshop-Hub

Workshop- und Trainer-Verwaltung der dbrains academy: **Source of Truth für den
Workshop-Prozess** (Workshops, Trainer, Checkliste, Change-Log, Feedback).
Folien bleiben im SharePoint, Kalender in Outlook (`service@`) — der Hub
verlinkt bzw. steuert sie. Vorgabe: [SPEC.md](./SPEC.md), Arbeitsregeln:
[CLAUDE.md](./CLAUDE.md).

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) (Schema in `src/db/schema/`)
- Auth: [NextAuth v5](https://authjs.dev) — Entra ID SSO (internes Team) +
  Magic Link (externe Trainer)
- Deployment: Docker auf Hetzner via Coolify

## Schnellstart (Zero-Install — nur Node nötig)

```bash
npm install
npm run dev             # → http://localhost:3000
```

Mehr ist nicht nötig: Ohne `DATABASE_URL` startet die App im Dev-Modus mit
einer **eingebetteten Datenbank** (PGlite, liegt in `.pglite/`), wendet die
Migrationen automatisch an und spielt die Testdaten ein. Kein Docker, kein
Postgres, keine `.env`.

### MVP durchklicken (SPEC §8, Stufe 1)

- **Anmelden:** Auf der Login-Seite im gelben Kasten „Test-Login“ ein Konto
  wählen — z. B. *Leon* (Admin), *Romana* (Team) oder *Anna Berger*
  (externe Trainerin). *Julia Wagner* ist deaktiviert und kommt nicht rein.
- **Postausgang:** Mails und Kalendereinträge werden **nicht verschickt**,
  sondern landen unter *Postausgang* als Vorschau.
- **Datum simulieren:** Unter *System* (nur Admin) das Datum vorspulen und den
  Tagesjob von Hand starten — so laufen Fristen, Sammel-Mails,
  Feedback-Erinnerungen und Eskalationen sofort durch.
- **Frischer Zustand:** Server stoppen, `.pglite/` löschen, neu starten.

Der Test-Login ist im Dev-Modus automatisch an und sonst aus. Auf einem Server
nur mit `HUB_TEST_LOGIN=true` **und** vorgeschaltetem Passwortschutz
(Coolify) einschalten — er wird mit der Microsoft-Anbindung entfernt.

## Lokale Entwicklung mit echtem Postgres (produktionsnah)

```bash
# 1. Umgebung konfigurieren
cp .env.example .env    # Werte eintragen, AUTH_SECRET: npx auth secret

# 2. Postgres starten (z. B. via Docker)
docker run -d --name workshop-hub-db -p 5432:5432 \
  -e POSTGRES_USER=workshop -e POSTGRES_PASSWORD=workshop \
  -e POSTGRES_DB=workshop_hub postgres:17-alpine

# 3. Migrationen + Seed-Daten
npm run db:migrate
npm run db:seed

# 4. Dev-Server
npm run dev
```

Sobald `DATABASE_URL` gesetzt ist, wird die eingebettete Datenbank ignoriert.
In Produktion (`NODE_ENV=production`) gibt es keinen Fallback — dort ist ein
echtes Postgres Pflicht.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server (Turbopack) |
| `npm run build` | Produktions-Build |
| `npm run typecheck` | TypeScript-Prüfung |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run db:generate` | Drizzle-Migration aus Schema-Änderung erzeugen |
| `npm run db:migrate` | Migrationen anwenden |
| `npm run db:seed` | Testdaten einspielen (nur auf leerer DB) |

## Projektstruktur

```
src/
  app/                 # Next.js App Router (UI + API-Routes)
    api/auth/          # NextAuth-Handler + Magic-Link-Anforderung
    login/             # Login (Entra SSO + Magic Link)
  auth.ts              # NextAuth-Konfiguration (Provider, Callbacks)
  auth.config.ts       # Edge-sichere Basis-Config (Middleware)
  middleware.ts        # Login-Schutz aller Routen
  db/
    schema/            # Drizzle-Schema — eine Datei pro Aggregat
    seed.ts            # Demo-Seed
  integrations/        # Externe Systeme (graph, notion, sevdesk, hubspot)
  jobs/                # Tagesjob (Erinnerungen, Feedback, Eskalation) via pg-boss
  lib/
    access.ts          # assertTrainerAccess — Rechte-Prüfung Trainer-Rollen
    automatik.ts       # ⚙ Kalender service@, Trainer-Mails, Infopaket
    checklist.ts       # ☐ Aufgaben aus Vorlagen synchronisieren
    postausgang.ts     # Einziger Weg nach draußen (Vorschau/Protokoll)
    verlauf.ts         # Änderungsverlauf
    einstellungen.ts   # getJetzt() inkl. Datumssimulation
    magic-link.ts      # Token-Erzeugung/-Verifikation
    validation.ts      # Zod-Schemas für API-Grenzen
drizzle/               # Generierte SQL-Migrationen (eingecheckt)
scripts/               # migrate.mjs (Deploy), backup-db.sh (tägliche Backups)
```

## Auth-Setup

**Entra ID (internes Team):** App-Registrierung im Azure-Portal mit Redirect
URI `<AUTH_URL>/api/auth/callback/microsoft-entra-id`; Client-ID, Secret und
Issuer in `.env` eintragen. Es gibt kein Self-Signup: Nur E-Mail-Adressen, die
als `nutzer` (Rolle `admin`/`team`) angelegt sind, können sich anmelden.

Zusätzlich prüft der Hub die Tenant-ID im Token
(`AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` oder aus dem Issuer abgeleitet).

**Login-Link (Trainer):** Jeder Trainer hat ein Konto. Der Link ist 30 Minuten
gültig und einmalig verwendbar, danach bleibt man 30 Tage angemeldet.
Trainer sehen ausschließlich zugewiesene Workshops (`assertTrainerAccess`) und
dort nur die freigegebenen Felder; Deaktivieren beendet die Sitzung sofort.

## Deployment (Coolify auf Hetzner)

1. Neues Projekt in Coolify, Quelle: dieses Repo, Build via `Dockerfile`
   (Migrationen laufen automatisch beim Container-Start).
2. Postgres als Coolify-Ressource anlegen; `DATABASE_URL` sowie die
   `AUTH_*`-Variablen als Secrets setzen (`AUTH_TRUST_HOST=true` hinter Proxy).
3. **Tägliche DB-Backups** in Coolify aktivieren (Scheduled Backups auf S3) —
   alternativ enthält `docker-compose.yml` einen `db-backup`-Service
   (täglicher `pg_dump`, 14 Tage Aufbewahrung).

## CI

GitHub Actions ([ci.yml](./.github/workflows/ci.yml)): Typecheck, Lint, Tests
und Build auf jedem Pull Request und auf `main`.
