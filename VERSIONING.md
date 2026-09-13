# OMID Studio — Versioning, Releases & Update Architecture

Single Next.js application (public site + API routes + admin panel). This
document records how releases, a client's version, and the update flow relate
to each other, and how the application guarantees that **a release is not
active for a client until that client has completed its update**.

## The two layers

Version integrity needs both of these; either one alone is not enough.

| Layer | Question it answers | Where it lives |
|---|---|---|
| **Backend authority** | *Which version has this client completed?* | `src/lib/update-store.ts` → `.data/update-state.json`, written only by `POST /api/update/complete` |
| **Artifact isolation** | *Which build is this client actually served?* | `scripts/release-publish.mjs` (immutable artifacts) + `scripts/release-server.mjs` (the version router) |

Before artifact isolation existed, a client "on 1.0.15" was served the newest
build the moment it was deployed — new UI, new chunks, new API behaviour —
while its version label still said 1.0.15. That is version mixing, and it is
what the router removes.

## Canonical version sources

| Concept | Source |
|---|---|
| **Release version** (`currentReleaseVersion`) | `src/config/version.ts` → `APP_VERSION`, mirrored into `package.json` and embedded into `/public/sw.js` by `scripts/write-sw-version.mjs` (`prebuild`/`predev`) |
| **Client completed version** (`completedVersion`) | Backend store: `src/lib/update-store.ts` → `.data/update-state.json` (atomic writes, serialized lock, `OMID_STUDIO_UPDATE_STATE_FILE`) |
| **Effective version** (`effectiveVersion`) | **Always the persisted `completedVersion`** — computed only by the backend |
| **Served build** | The release artifact for the client's `completedVersion`, chosen by the router |
| **Release metadata** | `src/config/release.ts` (`RELEASE_INFO`), served to clients by `GET /api/update/status` so the update card describes the *offered* release, not the build that happens to render it |

One authoritative release version exists; `package.json`, the service worker,
the footer and the router never declare it independently.

## The invariant

```
new release published (APP_VERSION bumped, artifact published)
        → existing clients keep completedVersion = OLD
        → the router serves them the OLD release's artifact
          (old HTML, chunks, CSS, images, API routes, service worker)
        → updateAvailable = true — a non-blocking offer with «بعداً»
        → user clicks «بهروزرسانی»
        → POST /api/update/complete (exact from→to transition, rate limited,
          replay/stale-state protected)
        → atomic persistence succeeds
        → completedVersion = NEW  →  the router serves the NEW artifact
        → one guarded reload → the new release is active
```

`later`, refresh, closing the browser, failed validation, a failed request and
a failed write all leave `completedVersion` — and therefore the served build —
exactly where they were.

## Routing rules (`scripts/release-server.mjs`, public port 57500)

```
                     :57500  the router
                        │
   /api/update/* ───────┼──► LATEST lane   (the only release that compares versions)
   everything else ─────┴──► lane of the client's COMPLETED version
                             (no record / unknown → latest lane)
                        │
     ┌──────────────────┼────────────────────┐
 :57510 1.0.21       :57511 1.0.20        :57512 1.0.17
 .releases/…         .releases/1.0.20     .releases/1.0.17
```

- Client identity is the same httpOnly cookie the backend already issues
  (`os_update_client`); the router only reads `.data/update-state.json`.
- `/_next/*`, `/images/*`, page documents, server actions and API routes all
  go to the client's own lane, so nothing from another release is reachable.
- Lanes are started by the router and pinned to the canonical store paths
  (`OMID_STUDIO_UPDATE_STATE_FILE`, `OMID_STUDIO_DATA_FILE`,
  `OMID_STUDIO_ANALYTICS_FILE`), so every release writes to the same data.
- A lane is never *adopted* from a busy port: a process cannot prove which
  build it serves, and guessing wrong would reintroduce mixing.
- `/__releases` (loopback only) reports the lanes, build ids and client
  version counts — the operator's view of the router.

## Endpoints

- `GET /api/update/status` — always served by the latest lane. Returns
  `currentVersion`, `userCompletedVersion`, `effectiveVersion`,
  `updateRequired` and `release` (metadata of the offered release).
  A client with no record gets `completedVersion: null`, which the update flow
  treats as "never completed".
- `POST /api/update/complete` — the only writer of `completedVersion`.
  Validates the exact declared transition, is idempotent for repeats, rejects
  stale/forged/replayed completions with 409, and persists atomically. Because
  it can only target the current `APP_VERSION`, `completedVersion` can never
  regress through this route.

## Service worker

Served per release, so an outdated client keeps its own release's worker and
never even sees the new one:

- installs and prepares caches but **does not `skipWaiting`**;
- activation is user-gated (the update card sends `SKIP_WAITING` after the
  backend confirms);
- old caches are purged only on activation.

## Release process

1. Make the change; verify (`npx tsc --noEmit`, `npx eslint`, `npm run build`).
2. Bump `APP_VERSION` (`src/config/version.ts`), mirror it in `package.json`,
   and add one **high-level** categorized line to `src/config/release.ts`.
3. `npm run release` → builds, then publishes `.releases/<version>/` and
   updates `.data/releases.json`.
4. The running router notices the registry within ~1s: a new release is added
   as `latest` (new clients and update checks resolve there), and a
   re-published artifact replaces its own lane automatically. No restart, no
   downtime for other lanes.
5. `npm run verify:release` against the running router — it must pass before
   the release is considered good. The harness proves, on live traffic, that
   every client is served its own completed release's bundle, that
   `/api/update/status` is always answered by the latest release, that
   "Later" never moves a client, and that the effective version advances only
   through a persisted completion (forged/replayed transitions refused).
   `WARN` lines are documented gaps, not failures; `FAIL` exits non-zero.
6. Commit and push (see below) — Git state and release state stay in lockstep.

Retention: `OMID_STUDIO_RELEASES_KEEP` (default 4) newest releases are kept, and
a release is **never pruned while a client still has it as their completed
version** — pruning one would move that client onto a different build.

Backfilling a release that shipped before this pipeline existed (the source
must exist in Git):

```bash
git worktree add --detach .build-hist/<version> <commit>
cd .build-hist/<version> && npm run build      # scratch tree; see note below
cd - && OMID_STUDIO_PUBLISH_FROM=.build-hist/<version> \
        OMID_STUDIO_PUBLISH_VERSION=<version> node scripts/release-publish.mjs
git worktree remove .build-hist/<version> --force
```

The scratch tree has no `node_modules` of its own, so Turbopack must be pointed
at a root that has one (`turbopack: { root: … }` in that tree's
`next.config.ts`) and its `package-lock.json` must not shadow the project's.

## Known limits (honest, not faked)

- **Single-host deployment.** Lanes are local processes on fixed ports; the
  file-based store and the router assume one machine. Multi-instance /
  serverless hosting needs a shared store and an immutable artifact store.
- **Clients whose release was never published** (a release deployed before
  this pipeline existed, whose build no longer exists anywhere) fall back to
  the latest lane and are offered the update; the router logs a warning for
  each such request. Today 1.0.17 has been backfilled from Git; clients on
  1.0.11/1.0.15 cannot be served their original build and resolve to the
  latest release until they complete the update once. `npm run verify:release`
  reports exactly these cases as `WARN` (with the affected client count) and
  fails only when an artifact exists but no lane serves it.
- **Update-card changelog for old builds.** The card is rendered by the build
  the client is running. From 1.0.21 onward it takes the offered release's
  changelog from the backend; a client still on an older build (1.0.17/1.0.20)
  keeps showing that old build's bundled notes until it updates once.
- `updateRequired` is an exact-equality check (`completedVersion !== APP_VERSION`),
  not a semver range: re-publishing any version re-offers the update to every
  client whose stored version differs.

## Rollback

1. Re-deploy by re-publishing the good release's artifact (publish the old
   source again, or keep `.releases/<version>/` for the build in question).
2. Set `APP_VERSION` back so the required version matches. Clients whose
   `completedVersion` equals the rolled-back version keep
   `updateRequired = false`; everyone else is offered the update.
3. Release artifacts are per-version directories: a rollback never deletes a
   release that clients are still running, because pruning skips those.

## GitHub workflow

- Repository: `https://github.com/omiidam/omid-dev-studio` (branch `main`).
- Every verified change is committed to `main` with its version bump in the
  same change set; never force-push, history is append-only.
