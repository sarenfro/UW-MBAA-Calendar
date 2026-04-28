# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/scripts run seed-calendars` — wipe and re-seed calendars + events

## Artifacts

- **calendar-dashboard** (`/`) — unified calendar dashboard. Aggregates multiple calendars (Personal, Work, Design Crit, Holidays, Birthdays) into one month grid with color-coded events. Click any event to see its source calendar and download an `.ics` file.

## Domain model

- `calendars` — sources (name, color hex, owner, timezone, description)
- `events` — items belonging to a calendar (title, start/end timestamps, all-day, location, description)
- `.ics` files are generated on demand by `artifacts/api-server/src/lib/ics.ts` (no third-party library) and served at `GET /api/events/:id/ics`.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
