# Managed-Projects API (Phase 3, archive/restore added in Phase 5)

Authenticated backend for the Project Management Panel (`/admin/manage/*`).
Reuses the Phase-2 admin session — there is no separate auth system.

## Endpoints

Base: `/api/admin/managed-projects`

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List projects. Query params: `status`, `payment`, `type`, `q` (search), `sort` (`updated` \| `deadline` \| `progress`), `archived=1` (include soft-deleted records; default excludes them). |
| POST | `/` | Create a project (full validated payload). Returns `201` + created record. |
| GET | `/:id` | Fetch one project. `404` when missing. Archived records are returned with `archived: true` so the UI can distinguish them. |
| POST | `/:id` | **Restore an archived project** back to the active list. `404` when no archived record exists. |
| PATCH | `/:id` | Partial update — only explicitly allowed fields, merged server-side. Archived projects are not editable (`404`). |
| DELETE | `/:id` | **Soft delete (archive).** The record is retained with `archived: true`, never destroyed. |

## Authentication

- Session cookie `os_admin_session` (HMAC-signed, httpOnly — set by `/api/admin/login`).
- Defense in depth: the proxy blocks unauthenticated calls to `/api/admin/*`,
  and every handler re-verifies the cookie itself via `requestIsAdminAuthed()`.
- All responses are `Cache-Control: no-store`.
- Per-IP rate limits (sliding window, 10 min): list 120, create 60, update 90, archive 30.

## Response format

```json
{ "success": true,  "data": ... }

{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Error codes: `UNAUTHORIZED` (401), `INVALID_ID` (400), `NOT_FOUND` (404),
`INVALID_JSON` (400), `VALIDATION_ERROR` (422), `UNSUPPORTED_MEDIA_TYPE` (415),
`RATE_LIMITED` (429), `INTERNAL_ERROR` (500). Messages are Persian and
user-safe — no stack traces or internals.

## Validation rules (server-side, `src/lib/managed-project-schema.ts`)

- `name`, `client`: required, trimmed, ≤ 120 chars.
- `type`: enum `website | webapp | saas | ecommerce | dashboard | other`.
- `status`: enum `negotiating | pending | in_progress | completed | halted`.
- `payment`: enum `unpaid | advance | partial | paid`.
- `progress`: integer 0–100.
- `budget`: number ≥ 0 (numeric value, never a formatted currency string).
- `startDate` / `deadline`: ISO `YYYY-MM-DD` or empty; `deadline ≥ startDate`
  enforced on create and on PATCH (validated against the merged record).
- `demoUrl` / `githubUrl`: valid URL or empty.
- `technologies`: array of strings (1–40 chars each), max 20.
- `notes` (private notes): ≤ 5000 chars. **Admin-only — never exposed through
  any public/portfolio endpoint.**
- IDs: opaque, ≤ 64 chars, no path characters.

Unknown fields in the request body are ignored (no uncontrolled spreading —
updates are explicit field-by-field merges in `managed-project-db.ts`).

## Storage

Real SQLite database (Node's built-in `node:sqlite` driver — zero external
dependencies), WAL journal mode, one connection per server process.

- Default path: `<project>/.data/managed-projects.db`
- Override: `OMID_STUDIO_MANAGED_PROJECTS_DB` (see `.env.example`)

Schema is managed by versioned migrations in `src/lib/managed-project-db.ts`
(`schema_migrations` table, applied idempotently on open). Database-level
CHECK constraints enforce the status/payment/progress/length domains, so
structurally invalid data is rejected even below the zod layer. The legacy
Phase-3 JSON file (`managed-projects.json`) is imported once, non-destructively,
if it still exists.

When the database is unavailable, the data layer throws
`DatabaseUnavailableError` and the API answers `503 DATABASE_UNAVAILABLE` —
never silent fallback to any other store.

## Frontend seam

- `src/lib/managed-project-client.ts` — fetch wrapper (`{ success, data }`
  envelope, Persian error mapping).
- `src/lib/managed-project-store.ts` — `useManagedProjects()` /
  `useManagedProject(id)` hooks plus `useManagedArchive(id)` (archive with
  confirmation in the UI / restore). The backend is authoritative: no optimistic
  mutations; the UI renders server responses only.

## SEO boundary

`robots.ts` disallows `/admin/`; `sitemap.ts` lists public pages only. The
admin area and this API never appear in the sitemap. robots.txt is crawler
guidance only — authentication remains the actual access control.
