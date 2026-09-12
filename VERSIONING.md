# OMID Studio — Versioning & Release Architecture

Single Next.js application (public site + API routes + admin panel) deployed
as one `npm run build` + `npm run start` (port 57500) process. This document
records how versions, releases, and user updates relate to each other.

## Canonical version source of truth

| Concept | Source |
|---|---|
| **Release version** (`currentReleaseVersion`) | `src/config/version.ts` → `APP_VERSION`, mirrored into `package.json` and embedded into `/public/sw.js` by `scripts/write-sw-version.mjs` (`prebuild`/`predev`) |
| **User completed version** (`completedVersion`) | Backend store: `src/lib/update-store.ts` → `.data/update-state.json` (atomic writes, serialized lock, configurable via `OMID_STUDIO_UPDATE_STATE_FILE`) |
| **Effective version** (`effectiveVersion`) | **Always the persisted `completedVersion`** — computed only by the backend |
| **Displayed version** | Footer badge (`FooterVersionBadge.tsx` via `useDisplayedVersion.ts`) renders the backend's `effectiveVersion` when an update is pending |

One authoritative release version exists; `package.json`, the service worker,
and the footer never declare it independently.

## Key invariant

```
new release published (APP_VERSION bumped + deployed)
        → existing clients keep completedVersion = OLD
        → effectiveVersion = OLD
        → updateAvailable = true (non-blocking offer with بعداً)
        → user clicks Update
        → POST /api/update/complete (validated: exact from→to transition,
          rate-limited, replay/stale-state protected)
        → atomic persistence succeeds
        → completedVersion = NEW, effectiveVersion = NEW
        → reload → new release active
```

A Git commit/push NEVER advances any user's version — it only changes source
code. The release version advances only through the explicit `APP_VERSION`
bump + deployment, and a user's completed version only through
`/api/update/complete`.

## Endpoints

- `GET /api/update/status` — returns `currentVersion`, `userCompletedVersion`,
  `effectiveVersion`, `updateRequired` for the cookie-identified client.
  Anonymous/brand-new clients get `completedVersion: null`; the update flow
  treats that as "never completed", and successful completion establishes
  their initial state at the current release.
- `POST /api/update/complete` — the only writer of `completedVersion`.
  Validates the exact declared transition (`fromVersion` must equal the
  stored value, `toVersion` must equal `APP_VERSION`), is idempotent for
  repeated completions, rejects stale/forged/replayed completions with 409,
  and persists atomically — any failure leaves the user un-updated.
  Monotonicity: a completion can only target the current `APP_VERSION`, so
  `completedVersion` can never regress to an older release via this route.

## Service worker / cache behavior

`public/sw.js` (version-stamped at build time):
- installs and prepares caches but **does not skipWaiting** — new-version
  content never auto-activates while a user postpones;
- old caches are purged only on activation, which the update card triggers
  via a `SKIP_WAITING` message **after** the user confirms;
- activation happens only after backend-confirmed persistence.

## Release process (future workflow)

1. Make application changes; test locally (`tsc`, lint, build).
2. Bump `APP_VERSION` in `src/config/version.ts`, mirror it in
   `package.json`, and add one **high-level** categorized line to
   `src/config/release.ts` (no implementation-detail changelogs).
3. `npm run build` (prebuild stamps the new version into `/sw.js`).
4. Verify the release endpoints after deploy (`/api/update/status`).
5. Commit and push to GitHub (see below). Git state and release state are
   kept in lockstep by bumping the version in the same change set.
6. Deploy = stop old process, start new build on port 57500. Previous build
   artifacts can be preserved for rollback (see `DEPLOYMENT.md`).

## GitHub workflow

- Repository: `https://github.com/omiidam/omid-dev-studio` (branch `main`).
- `main` is the single integration branch; every release is committed there
  with its version bump in the same commit.
- Never force-push; history is append-only.

## Rollback considerations

- Reverting a release = redeploy the previous build artifacts AND set
  `APP_VERSION` back to that release (existing users' `completedVersion`
  values above it are preserved in the store; they simply keep
  `updateRequired = false` until the required version rises again... note
  `updateRequired` compares for exact equality, not semver ordering — see
  below).
- `updateRequired` is an **exact-equality** check
  (`completedVersion !== currentVersion`), not a semver-range comparison.
  This is intentional: any change of the required version — even a
  re-publish of the same build — re-offers the update to every client whose
  stored version differs.
- Client completion records are never deleted by the application, so
  re-raising the required version later automatically re-offers updates to
  every affected client (the "administrator changes required version"
  scenario).
- Deployment note: the production deployment serves a single static bundle;
  per-client *historical bundles* are not retained. The backend-authoritative
  model (effectiveVersion, displayed version, non-activation service worker)
  is the honest implementation of version gating on this architecture.

## Known architectural limitation

True per-version content isolation (an outdated user literally running old
JS bundles) would require a multi-version artifact pipeline. On the current
single-bundle deployment the system enforces version gating at every layer
it controls: backend authority over `effectiveVersion`, displayed version =
effective version, service worker never auto-activating new content, and
update completion as the sole version-transition point.
