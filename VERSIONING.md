# OMID Studio — Versioning, Releases & Update Architecture

Single Next.js application (public site + API routes + admin panel). This
document records how releases, a client's version, and the update flow relate
to each other, and how the application guarantees that **a release is not
active for a client until that client has completed its update** — and that a
release does not even become active for the *site* until it has been proven to
honour that guarantee.

## The three layers

Version integrity needs all three; any one alone is not enough.

| Layer | Question it answers | Where it lives |
|---|---|---|
| **Backend authority** | *Which version has this client completed?* | `src/lib/update-store.ts` → `.data/update-state.json`, written only by `POST /api/update/complete` |
| **Artifact isolation** | *Which build is this client actually served?* | `scripts/release-publish.mjs` (immutable artifacts) + `scripts/release-server.mjs` (the version router) |
| **Promotion gate** | *May this artifact become the current release at all?* | `scripts/release-verify.mjs` (fail-closed verification) + `scripts/lib/release-registry.mjs` (`promoteCandidate`) |

Before artifact isolation existed, a client "on 1.0.15" was served the newest
build the moment it was deployed — new UI, new chunks, new API behaviour —
while its version label still said 1.0.15. That is version mixing, and it is
what the router removes. Before the promotion gate existed, publishing *was*
releasing: an artifact built from a broken deployment became authoritative the
moment it was copied into place, and the first sign of trouble was a user.

## Canonical version sources

| Concept | Source |
|---|---|
| **Release version built into an artifact** | `src/config/version.ts` → `APP_VERSION`, mirrored into `package.json` and embedded into `/public/sw.js` by `scripts/write-sw-version.mjs` (`prebuild`/`predev`) |
| **Client completed version** (`completedVersion` / `installedVersion`) | Backend store: `src/lib/update-store.ts` → `.data/update-state.json` (atomic writes, serialized lock, `OMID_STUDIO_UPDATE_STATE_FILE`) |
| **Effective version** (`effectiveVersion`) | **Always the persisted `completedVersion`** — computed only by the backend |
| **Current release** (`currentReleaseVersion`) | `.data/releases.json` → `current`. Written **only** by `promoteCandidate()` after a successful verification |
| **Candidate version** | `.data/releases.json` → `candidate.version`, with `candidate.status` (`candidate` \| `verified` \| `blocked` \| `promoted`) |
| **Isolation verification status** | `candidate.verification` (+ `verificationHistory`) written by `scripts/release-verify.mjs` |
| **Served build** | The release artifact for the client's `completedVersion`, chosen by the router |
| **Release metadata** | `src/config/release.ts` (`RELEASE_INFO`), served to clients by `GET /api/update/status` so the update card describes the *offered* release, not the build that happens to render it |

These are **separately tracked states and are never collapsed into one version
variable**: a candidate existing is not the same as a candidate being current, a
client's installed version is not the server's release, and `availableVersion`
is nothing more than "the version `current` names". Publishing an artifact does
not set `current`; completing an update does not set `APP_VERSION`; and the
frontend has no path to either.

## The invariant```
change made, APP_VERSION bumped, artifact built
        → STAGED as a candidate: current is unchanged, clients see nothing new
        → verification passes?
             no  → candidate BLOCKED, current stays the previous release
             yes → PROMOTED: current = the new version  (the only promotion)
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
   /api/update/* ───────┼──► CURRENT lane  (the only release that compares versions)
   everything else ─────┴──► lane of the client's COMPLETED version
                             (no record / unknown → CURRENT lane)
                        │
     ┌──────────────────┼────────────────────┐
 :57510 1.0.23       :57511 1.0.22        :57512 1.0.21  …
 .releases/…         .releases/1.0.22     .releases/1.0.21
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
- A candidate gets a lane too — so the gate can exercise it — but the candidate
  is never the authority for real traffic until `current` moves.
- A client whose completed release is marked **blocked** (its promotion was
  refused or rolled back) resolves to the current release and is offered it,
  rather than being pinned to a release that never became authoritative.
- **Verification mode** (loopback + `x-omid-verify: <candidate token>`) routes a
  request exactly as it *would* be routed after promotion. It exists only while a
  candidate is staged and is never honoured for a remote client; it lets the gate
  test the real routing decisions before they are real, without any real client
  seeing a candidate.
- `/__releases` (loopback only) reports the current release, the candidate and
  its status, the lanes (with roles, build ids, ports) and client version counts
  — the operator's view of the router. Requesting it also reloads the registry,
  so it never reports a stale state.

## Endpoints

- `GET /api/update/status` — always served by the current lane. Returns
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

## Release process (fail-closed)

```bash
# 1. change + verify
npx tsc --noEmit && npx eslint && npm run build
# 2. bump APP_VERSION (src/config/version.ts), mirror in package.json,
#    add one high-level categorized line to src/config/release.ts
# 3. the whole pipeline in one command: build → stage candidate → verify → promote
npm run release
```

`npm run release` is deliberately a chain (`&&`): if any step fails, the ones
after it do not run, so a failed verification cannot be followed by a promotion.

| Step | Command | What it does |
|---|---|---|
| stage | `npm run release:publish` | builds, copies the artifact to `.releases/<version>/`, registers it as a **candidate** with a one-time verification token. `current` is untouched |
| verify | `npm run verify:release` | runs the gate; pass or block, never "maybe". Does not promote |
| verify + promote | `npm run verify:release -- --promote` | the only path that makes a release current |
| promote | `npm run release:promote` | promotes an already-`verified` candidate; refuses otherwise |

Notes:

- **Publishing is not releasing.** After `release:publish`, clients see exactly
  what they saw before: `current` did not move, the candidate is not announced,
  and no client can complete it (`toVersion` is validated by the *current*
  release, which does not know the candidate).
- The router picks the registry up within ~1s, so a promoted release needs no
  restart and no downtime for the lanes still serving other clients. A
  re-published artifact replaces its own lane automatically.
- `WARN` lines are documented pre-existing gaps (see *Known limits*); `FAIL`
  exits non-zero, marks the candidate `blocked` with a reason, and leaves
  `current` alone.

## Promotion gate (fail-closed)

`scripts/release-verify.mjs` decides whether a candidate may become current. It
runs three stages against the **running** router — no mocks, no fixture state:

| Stage | Runs as | Proves |
|---|---|---|
| 1 — staging must not leak | real traffic (no token) | every client still gets its own completed release's document, bundle, assets and service worker; the candidate is not announced; a real client cannot complete it |
| 2 — candidate world | loopback verification token | what *would* be true after promotion: the candidate answers the version comparison, offers itself to old clients with its backend-served changelog, "Later" changes nothing, a completion persists (store verified on disk), replay/forged/invalid attempts change nothing, and every old client still gets its own bundle |
| 3 — live confirmation | real traffic, after promotion | the promotion itself: `current` moved, old clients still run their release, new clients get the new one, an update persists and reloads into it |

Fail-closed rules — an explicit success is required, so all of these **block**:

- router unreachable, registry unreadable, lanes not ready, or any timeout;
- no candidate staged (there is nothing that may be promoted);
- no outdated client available to prove isolation with, or a client's release
  has an artifact but no lane;
- any check failing (bundle/build-id/service-worker/cache leakage, a client's
  installed version changing, status authority, changelog, persistence);
- the update endpoint rate-limiting the run (a 429 can never be read as a pass).

Only `verified` may be promoted, `promoteCandidate()` re-checks the artifact's
build id at promotion time (a re-published artifact invalidates its
verification), promotion is a single atomic registry write, and a failure in
stage 3 **reverts `current`** to the previous known-good release and marks the
candidate blocked.

Every verdict is recorded in `.data/releases.json` (`candidate.verification`,
appended to `verificationHistory`) and printed to the pipeline log.

Safe re-verification: a `blocked` candidate can be re-verified after fixing the
fault (its release entry returns to `candidate` before measuring, so the gate
measures the deployment it is about to bless). A `blocked` candidate can never be
promoted: only `verified` can.

The gate signs its persistence tests with **gate identities** — ids in the
reserved `00000000-0000-4000-8000-*` namespace — because it must perform real
completions without ever acting as a user. Real clients are only ever read.

## Retention

`OMID_STUDIO_RELEASES_KEEP` (default 4) newest releases are kept, and a release
is **never pruned while a real client still has it as their completed version**
— pruning one would move that client onto a different build. Gate identities
(above) are excluded from that reference count, so a verification run cannot pin
a release forever.

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
  this pipeline existed, whose build no longer exists anywhere) resolve to the
  current lane and are offered the update; the router logs a warning for each
  such request. Today 1.0.17 has been backfilled from Git; clients on
  1.0.11/1.0.15 cannot be served their original build and resolve to the current
  release until they complete the update once. The gate reports exactly these
  cases as `WARN` (with the affected client count) and fails only when an
  artifact exists but no lane serves it.
- **The gate needs something to isolate.** It blocks when no client is
  available on a published release to prove old-client isolation with, and when
  a client's artifact exists but has no lane. A deployment with no clients at
  all therefore cannot promote — intentionally: "could not prove it" is not
  "proved".
- **The gate cannot force a persistence failure.** A write failing at the exact
  moment of `POST /api/update/complete` is covered by the endpoint's own atomic
  write + lock (any failure leaves `completedVersion` untouched and
  `updateRequired` true) and by the checks that invalid/forged/replayed
  completions change nothing — not by an injected I/O fault.
- **Update-card changelog for old builds.** The card is rendered by the build
  the client is running. From 1.0.21 onward it takes the offered release's
  changelog from the backend; a client still on an older build (1.0.17/1.0.20)
  keeps showing that old build's bundled notes until it updates once.
- `updateRequired` is an exact-equality check (`completedVersion !== APP_VERSION`),
  not a semver range: re-publishing any version re-offers the update to every
  client whose stored version differs.

## Rollback

1. Re-deploy by re-publishing the good release's artifact (publish the old
   source again, or keep `.releases/<version>/` for the build in question) and
   letting the gate promote it the same way. A promotion that fails in stage 3
   reverts `current` by itself.
2. Set `APP_VERSION` back so the required version matches. Clients whose
   `completedVersion` equals the rolled-back version keep
   `updateRequired = false`; everyone else is offered the update.
3. Release artifacts are per-version directories: a rollback never deletes a
   release that clients are still running, because pruning skips those.
4. A client whose completed release was marked `blocked` (or whose promotion was
   rolled back) is served the current release and offered it, so it can move
   forward again rather than being stranded on an abandoned version.

## GitHub workflow

- Repository: `https://github.com/omiidam/omid-dev-studio` (branch `main`).
- Order of operations: implement → `tsc`/`eslint`/build → `npm run release`
  (stage → verify → promote) → confirm the running app → commit → push. A
  release whose verification failed is **not** committed as a successful
  release: the failure is fixed first, or the change is reverted.
- Every verified change is committed to `main` with its version bump in the
  same change set; never force-push, history is append-only.
- The frontend has no influence on any of this: `current` lives in the
  server-side registry and only the promotion gate writes it.
