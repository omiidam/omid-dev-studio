# OMID Studio — Deployment

Single Next.js application (public UI + App Router + API routes in one app).
There is no separate frontend/backend server; nothing else needs to run.

## Stack versions

| Component | Version |
|---|---|
| Node.js | 20+ (tested locally on 24) |
| Next.js | 16.3.4 (App Router, Turbopack) |
| React | 19 |
| Package manager | npm (uses `package-lock.json`) |

Check the exact pinned versions in `package.json` before deploying.

## Environment variables

See `.env.example` — it is the source of truth for names/placeholders.

- `OMID_STUDIO_DATA_FILE` *(optional)* — overrides where the project-inquiry
  store file lives. Defaults to `<server cwd>/.data/inquiries.json`.
  **Persistence requirement:** the chosen deployment must guarantee this file
  (or whatever it points at) survives restarts **and redeployments** — see
  "Persistence" below. If your platform cannot guarantee that, point the
  variable at a shared/persistent store instead of the default.
- `OMID_STUDIO_HTTPS_ENABLED` *(optional, production)* — set to `1` only
  where TLS terminates (your reverse proxy). Turns on HSTS and
  `upgrade-insecure-requests` in the CSP. Leave unset on plain-http hosts.
  **Set it at build time AND start time** — Next.js captures
  `next.config.ts` values during `npm run build`:
  `OMID_STUDIO_HTTPS_ENABLED=1 npm run build && OMID_STUDIO_HTTPS_ENABLED=1 npm run start`.
- `OMID_STUDIO_ADMIN_USER` / `OMID_STUDIO_ADMIN_PASSWORD` *(required for the
  admin panel)* — the single admin credential pair. Set both, on the server
  only; logins without either variable fail closed (the panel still shows
  the login page but every attempt is rejected).
- `OMID_STUDIO_AUTH_SECRET` *(recommended, production)* — high-entropy
  secret used to sign admin session cookies. When unset, a key is derived
  from the admin password (documented single-server fallback). Prefer a
  dedicated random value so rotating the password does not invalidate
  sessions. Changing it signs out everyone (old cookies become invalid).

No other variables are read by the application today. Nothing is
`NEXT_PUBLIC_`; no secrets exist in source or are exposed to the client.

## Build & run (any host)

```bash
npm ci                 # exact install from lockfile
npm run build          # prebuild writes the versioned /public/sw.js, then next build
npm run start          # serve the production build
```

- **Production port is 57500** (`next start -p 57500`, set in the `start`
  script). Put it behind the host's HTTPS reverse proxy and forwards traffic
  to `127.0.0.1:57500`; the app itself does not terminate TLS.
- `npm run dev` is for development only — never use it in production. Running
  `next dev` serves unoptimized bundles and injects the Next.js development
  indicator; production must always run the `npm run build` +
  `npm run start` pair on port 57500.
- The PWA service worker is versioned automatically by
  `scripts/write-sw-version.mjs` (runs on `prebuild`/`predev`) from
  `src/config/version.ts`. Bump `APP_VERSION` on every deploy so installed
  clients are offered the update toast.

## Persistence

Project inquiries are stored by `src/lib/project-store.ts`. Today that is a
JSON file written atomically to `OMID_STUDIO_DATA_FILE`
(`.data/inquiries.json` by default).

This is production-safe **only** when the hosting environment keeps that
path stable across restarts and redeployments — e.g. a single self-hosted
server (systemd/Docker volume) with `next start`. It is **not** safe on
platforms with ephemeral filesystems (serverless, multi-instance, or
container redeploys without a mounted volume).

For such platforms the store module is deliberately the single seam to
swap: replace its internals (e.g. with a Postgres-backed adapter behind a
`DATABASE_URL`) without touching the API routes or UI. Do not deploy with
default file storage to a filesystem that does not persist.

## Security notes (Phase 8)

- **Headers** — every response carries `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, a
  strict `Content-Security-Policy` (no external origins allowed; see
  `next.config.ts` for the rationale), and `Cross-Origin-Opener-Policy:
  same-origin`. With `OMID_STUDIO_HTTPS_ENABLED=1`, HSTS and
  `upgrade-insecure-requests` are added — verify the site still loads fully
  over HTTPS after enabling.
- **API abuse protection** — `POST /api/projects` is limited per client IP
  (sliding window, 20 submissions / 10 min) and rejects exact duplicates
  (same email + projectType + description) with `409 DUPLICATE_SUBMISSION`;
  fingerprints are recorded only after a successful write, so a failed
  submission never blocks a legitimate retry. Limiter state is in-process:
  fine for the single-server architecture, resets on restart.
- **Admin authentication (Phase 11)** — `/admin/*` and `/api/admin/*` are
  gated by `src/proxy.ts` and re-verified in every admin route handler and
  server-rendered panel page. Login (`POST /api/admin/login`) issues a
  signed, httpOnly, SameSite session cookie (`os_admin_session`, 7 days);
  `POST /api/admin/logout` clears it. Rate-limited to 5 attempts / 10 min
  per IP. Status/priority/notes updates are validated against canonical
  enums server-side; a client can never inject an unknown status.
  **Do not open `/admin` to the public network** — keep it behind the admin
  credential/network controls even though it is already session-protected.
- **PII exposure** — `GET /api/projects` (inquiry listing) and all
  `/api/admin*` endpoints return contact details and are **admin-only**:
  unauthenticated callers get `401 UNAUTHORIZED`.
- **Storage** — the inquiry file path comes only from
  `OMID_STUDIO_DATA_FILE`; no user input ever reaches a filesystem path.
  Writes are atomic and serialized; a corrupt file is quarantined, never
  served. Errors returned to clients are sanitized (no stack traces, paths
  or env names).

## Verify after deploy

```bash
# public routes
for p in / /services /work /process /contact /admin/login; do
  curl -s -o /dev/null -w "$p %{http_code}\n" "https://<host>$p"
done

# admin access control — unauthenticated must be rejected
curl -s -o /dev/null -w "admin api %{http_code}\n" "https://<host>/api/admin/projects"   # → 401
curl -s -o /dev/null -w "admin page %{http_code}\n" -L "https://<host>/admin"            # → redirect to /admin/login

# inquiry submission (public)
curl -s -X POST "https://<host>/api/projects" \
  -H "Content-Type: application/json" \
  -d '{"name":"تست","email":"a@b.com","projectType":"website","budget":"unsure","description":"توضیحات آزمایشی برای بررسی استقرار و صحت کارکرد فرم ارتباطی."}'
# → 201, then log in at /admin/login and confirm the record appears in the
# dashboard and projects list. Restart the app and check again.
```

## Rollback / recovery

1. **Identify the deployed version** — footer shows `نسخه X.Y.Z`, sourced from
   `src/config/version.ts`; the version is also embedded in `/sw.js`.
2. **Redeploy a known-good build** — re-run `npm ci && npm run build` from the
   previous release's source and start it. If you keep release artifacts,
   preserve the whole `package-lock.json` + `.next` output pair from the good
   build so the rollback build matches the locked dependency tree.
3. **Restore environment configuration** — re-apply the same
   `OMID_STUDIO_DATA_FILE` value (and future secrets) from your secrets store;
   environment is not part of the code bundle.
4. **Data** — the inquiry store lives outside the app bundle (see
   Persistence); restoring a backup of that file/path restores submitted
   inquiries. Verify the admin dashboard and projects list after any
   rollback (log in as admin first).
5. **Failed deploy** — because deploys are plain `npm run start` of a build
   directory, switching back is: stop the new process → start the old build.
