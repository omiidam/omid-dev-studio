#!/usr/bin/env node
/**
 * release-server.mjs — the version router. Public entry point (`npm run start`).
 *
 * The problem it solves
 * ---------------------
 * `next start` serves ONE build directory. The moment a new release is
 * deployed there, every client — including clients whose completed version is
 * older — loads the new HTML, the new JS, the new CSS, the new API behaviour.
 * That is version mixing: a user "on 1.0.15" running 1.0.16 code.
 *
 * The router makes the artifact boundary real:
 *
 *                       :57500  ← public port (this process)
 *                          │
 *        ┌─────────────────┴──────────────────┐
 *        │  resolve the client's effective     │
 *        │  version from the backend store     │
 *        └─────────────────┬──────────────────┘
 *                          │
 *     /api/update/* ───────┼───► LATEST lane  (authoritative version compare)
 *     everything else ─────┘───► lane of the client's COMPLETED version
 *                                 (fallback: latest lane)
 *                          │
 *      ┌───────────────────┼────────────────────┐
 *   :57510 1.0.21       :57511 1.0.20        :57512 1.0.19
 *   .releases/1.0.21/   .releases/1.0.20/    .releases/1.0.19/
 *
 * Consequences, by construction:
 *   • An outdated client is served its own release's HTML, chunks, CSS,
 *     images, API routes and service worker — the complete old application.
 *     Nothing from the new release is reachable from that client.
 *   • "Later" changes nothing: the client's cookie still resolves to the old
 *     lane, so a refresh returns the same old build.
 *   • Only after POST /api/update/complete persists the new completed version
 *     (always handled by the LATEST lane, the only one whose APP_VERSION is
 *     current) does the client resolve to the new lane on reload.
 *   • The release becomes "current" only when its artifact is published and
 *     present in the registry — never before its files exist.
 *
 * Client identity comes from the same httpOnly cookie the backend already
 * issues (`os_update_client`); the authority on what a client completed stays
 * `.data/update-state.json`, written only by the update-completion endpoint.
 * The router reads that state — it never writes it.
 *
 * Lanes other than the latest are best-effort: if a client's completed
 * release artifact is no longer retained, they fall back to the latest lane
 * and are offered the update (`npm run release` never prunes a release that a
 * client still has as their completed version).
 */

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/* ── Configuration ────────────────────────────────────────────────────── */

const ROOT = process.cwd();
/**
 * Public port — 57500, the documented production port. A harness-provided
 * `PORT` is only honoured when it is a real port number (some tooling exports
 * `PORT=0`, meaning "pick any free port", which would hide the site).
 */
const envPort = Number(
  process.env.OMID_STUDIO_PUBLIC_PORT ?? process.env.PORT ?? NaN,
);
const PUBLIC_PORT =
  Number.isInteger(envPort) && envPort > 0 && envPort < 65_536 ? envPort : 57500;
const PUBLIC_HOST = process.env.OMID_STUDIO_PUBLIC_HOST ?? "0.0.0.0";
const LANE_HOST = "127.0.0.1";
/** First internal lane port; must differ from the public port. */
const BASE_PORT = Number(process.env.OMID_STUDIO_RELEASE_BASE_PORT ?? 57510);

const REGISTRY_FILE =
  process.env.OMID_STUDIO_RELEASES_FILE ??
  path.join(ROOT, ".data", "releases.json");
const UPDATE_STATE_FILE =
  process.env.OMID_STUDIO_UPDATE_STATE_FILE ??
  path.join(ROOT, ".data", "update-state.json");
/** Canonical store paths — lanes run in their own cwd, so these must be absolute. */
const DATA_FILE =
  process.env.OMID_STUDIO_DATA_FILE ??
  path.join(ROOT, ".data", "inquiries.json");
const ANALYTICS_FILE =
  process.env.OMID_STUDIO_ANALYTICS_FILE ??
  path.join(ROOT, ".data", "analytics.ndjson");

const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const UPDATE_CLIENT_COOKIE = "os_update_client";

/** Endpoints that must ALWAYS be served by the latest release. */
const LATEST_ONLY_PREFIXES = ["/api/update/"];
const LANE_READY_TIMEOUT_MS = 90_000;
const REGISTRY_POLL_MS = 1_000;
const STATE_CACHE_MS = 1_000;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function log(...parts) {
  console.log("[release-server]", ...parts);
}

/* ── Small helpers ────────────────────────────────────────────────────── */

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

function parseCookies(header) {
  const out = new Map();
  for (const part of String(header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    out.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return out;
}

/** First free port at or after `start` (a lingering process owns whatever it holds). */
async function findFreePort(start) {
  let port = start;
  while (await portIsListening(port)) port += 1;
  return port;
}

/** Absolute directory of a release artifact (registry paths use forward slashes). */
function releaseDir(entry) {
  const raw = String(entry.dir ?? `.releases/${entry.version}`);
  if (path.isAbsolute(raw)) return path.normalize(raw);
  return path.join(ROOT, ...raw.replace(/^\.[/\\]/, "").split(/[/\\]+/));
}

/** The build an artifact on disk actually contains (null when unavailable). */
async function readArtifactBuildId(dir) {
  try {
    return (await readFile(path.join(dir, ".next", "BUILD_ID"), "utf8")).trim();
  } catch {
    return null;
  }
}

function portIsListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: LANE_HOST, port });
    socket.setTimeout(700);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
  });
}

/* ── Backend state: which version has each client completed? ──────────── */

let stateCache = { at: 0, clients: new Map() };

async function clientCompletedVersions() {
  const now = Date.now();
  if (now - stateCache.at < STATE_CACHE_MS) return stateCache.clients;
  const parsed = await readJson(UPDATE_STATE_FILE, { clients: [] });
  const clients = new Map();
  for (const entry of Array.isArray(parsed?.clients) ? parsed.clients : []) {
    if (typeof entry?.clientId !== "string") continue;
    clients.set(
      entry.clientId,
      typeof entry.completedVersion === "string" ? entry.completedVersion : null,
    );
  }
  stateCache = { at: now, clients };
  return clients;
}

/* ── Lane registry ────────────────────────────────────────────────────── */

/** version → lane. A lane is one immutable release artifact plus its process. */
const lanes = new Map();
let latestVersion = null;
let legacy = false;
let registryLoadedAt = 0;

function laneFor(version) {
  return version ? lanes.get(version) ?? null : null;
}

function laneEnv() {
  const env = { ...process.env };
  // Lanes run from their own directory: pin every store to the canonical path.
  env.OMID_STUDIO_UPDATE_STATE_FILE = UPDATE_STATE_FILE;
  env.OMID_STUDIO_DATA_FILE = DATA_FILE;
  env.OMID_STUDIO_ANALYTICS_FILE = ANALYTICS_FILE;
  env.NODE_ENV = "production";
  // `-p` is authoritative for the lane; do not let a stray PORT confuse it.
  delete env.PORT;
  return env;
}

/**
 * Bring up the lane for one release entry.
 *
 * Lanes are never adopted: a process already holding a lane port cannot prove
 * which build it is serving, and guessing wrong would serve one release's code
 * under another release's version — the exact mixing this router exists to
 * prevent. Leftover processes keep their port and the new lane takes the next
 * free one.
 */
async function ensureLane(entry) {
  const existing = lanes.get(entry.version);
  if (existing) return existing;

  const dir = releaseDir(entry);
  if (!(await exists(path.join(dir, ".next")))) {
    log(`WARNING: release ${entry.version} has no build artifact at ${entry.dir} — skipping`);
    return null;
  }

  const preferred = Number.isInteger(entry.port) ? entry.port : BASE_PORT;
  const port = await findFreePort(preferred);
  if (port !== preferred) log(`lane port ${preferred} is taken — starting ${entry.version} on ${port}`);

  const child = spawn(
    process.execPath,
    [NEXT_BIN, "start", "-p", String(port), "-H", LANE_HOST],
    {
      cwd: dir,
      env: laneEnv(),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  child.stdout.on("data", (chunk) => process.stdout.write(`[lane:${entry.version}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[lane:${entry.version}] ${chunk}`));
  child.on("exit", (code, signal) => {
    log(`lane ${entry.version} exited (code=${code ?? "-"} signal=${signal ?? "-"})`);
  });

  const lane = {
    version: entry.version,
    port,
    dir,
    buildId: await readArtifactBuildId(dir),
    child,
    ready: null,
  };
  lane.ready = waitForLane(lane);
  lanes.set(entry.version, lane);
  return lane;
}

async function waitForLane(lane) {
  const deadline = Date.now() + LANE_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await portIsListening(lane.port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  log(`WARNING: lane ${lane.version} did not become ready within ${LANE_READY_TIMEOUT_MS}ms`);
  return false;
}

/** Legacy mode: no registry → one mutable lane from the project root. */
async function ensureLegacyLane() {
  if (lanes.size > 0) return;
  const version = await readVersionFromSource();
  const entry = { version: version ?? "unknown", dir: ".", port: BASE_PORT, buildId: null };
  log(
    "no release registry found — serving a SINGLE mutable build (no version isolation).",
  );
  log("run `npm run release` to publish immutable release artifacts and enable isolation.");
  legacy = true;
  await ensureLane(entry);
  latestVersion = entry.version;
  log(`latest lane: ${latestVersion} on ${LANE_HOST}:${entry.port} (legacy, mutable build)`);
}

async function readVersionFromSource() {
  try {
    const source = await readFile(path.join(ROOT, "src", "config", "version.ts"), "utf8");
    return source.match(/export const APP_VERSION = "([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function loadRegistry(force = false) {
  const now = Date.now();
  if (!force && now - registryLoadedAt < REGISTRY_POLL_MS) return;
  registryLoadedAt = now;

  if (!(await exists(REGISTRY_FILE))) {
    await ensureLegacyLane();
    return;
  }
  const registry = await readJson(REGISTRY_FILE, null);
  const releases = Array.isArray(registry?.releases) ? registry.releases : [];
  if (releases.length === 0) {
    await ensureLegacyLane();
    return;
  }

  legacy = false;
  for (const entry of releases) {
    if (typeof entry?.version !== "string") continue;
    await retireReplacedLane(entry);
    await ensureLane(entry);
  }
  const latest = typeof registry.latest === "string" ? registry.latest : releases[0].version;
  if (latest !== latestVersion) {
    latestVersion = latest;
    log(`latest release is now ${latest} (new clients and update checks resolve here)`);
  }
}

/**
 * Re-deploying a release replaces its artifact in place. A lane still running
 * the previous build of that same version must be replaced too, or it would
 * keep serving code that no longer matches its own version's files
 * (`npm run release` therefore doubles as the deploy step).
 */
async function retireReplacedLane(entry) {
  const lane = lanes.get(entry.version);
  if (!lane) return;
  const artifactBuildId = await readArtifactBuildId(releaseDir(entry));
  if (!artifactBuildId || !lane.buildId || artifactBuildId === lane.buildId) return;

  log(
    `release ${entry.version} was re-published (build ${lane.buildId} → ${artifactBuildId}) — replacing its lane`,
  );
  try {
    lane.child?.kill();
  } catch {
    /* best effort */
  }
  lanes.delete(entry.version);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/* ── Routing decisions ────────────────────────────────────────────────── */

async function pickLane(request, url) {
  await loadRegistry();
  const latest = laneFor(latestVersion) ?? [...lanes.values()][0] ?? null;
  if (!latest) return null;

  await latest.ready;

  // Version authority always lives on the newest release.
  if (LATEST_ONLY_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return latest;
  }

  const clients = await clientCompletedVersions();
  const clientId = parseCookies(request.headers.cookie).get(UPDATE_CLIENT_COOKIE);
  const completed = clientId ? clients.get(clientId) ?? null : null;

  if (legacy) return latest;

  if (completed && completed !== latestVersion) {
    const lane = laneFor(completed);
    if (lane) {
      await lane.ready;
      return lane;
    }
    log(
      `WARNING: client completed ${completed} but that release is not retained — falling back to ${latestVersion}`,
    );
  }
  return latest;
}

/* ── Proxying ─────────────────────────────────────────────────────────── */

function forwardHeaders(request, lane) {
  const headers = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (HOP_BY_HOP.has(name.toLowerCase())) continue;
    headers[name] = value;
  }
  headers.host = `${LANE_HOST}:${lane.port}`;
  const remote = request.socket.remoteAddress ?? "";
  const prior = request.headers["x-forwarded-for"];
  headers["x-forwarded-for"] = prior ? `${prior}, ${remote}` : remote;
  headers["x-forwarded-host"] = request.headers.host ?? "";
  headers["x-forwarded-proto"] = "http";
  return headers;
}

function proxy(request, response, lane) {
  return new Promise((resolve) => {
    const upstream = http.request(
      {
        host: LANE_HOST,
        port: lane.port,
        method: request.method,
        path: request.url,
        headers: forwardHeaders(request, lane),
      },
      (upstreamResponse) => {
        const headers = {};
        for (const [name, value] of Object.entries(upstreamResponse.headers)) {
          if (value === undefined) continue;
          if (HOP_BY_HOP.has(name.toLowerCase())) continue;
          headers[name] = value;
        }
        headers["x-omid-release"] = lane.version;
        response.writeHead(upstreamResponse.statusCode ?? 502, headers);
        upstreamResponse.pipe(response);
        upstreamResponse.on("end", resolve);
      },
    );
    upstream.on("error", (error) => {
      log(`proxy error → lane ${lane.version}: ${error.message}`);
      if (!response.headersSent) {
        response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      }
      response.end("upstream release unavailable");
      resolve();
    });
    request.pipe(upstream);
  });
}

/* ── Diagnostics (loopback only — for operators, never public) ────────── */

function isLoopback(request) {
  const address = request.socket.remoteAddress ?? "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

async function diagnostics(response) {
  const clients = await clientCompletedVersions();
  const byVersion = new Map();
  for (const version of clients.values()) {
    const key = version ?? "never-completed";
    byVersion.set(key, (byVersion.get(key) ?? 0) + 1);
  }
  const body = {
    legacy,
    latest: latestVersion,
    publicPort: PUBLIC_PORT,
    lanes: [...lanes.values()].map((lane) => ({
      version: lane.version,
      port: lane.port,
      dir: path.relative(ROOT, lane.dir) || ".",
      buildId: lane.buildId,
      pid: lane.child?.pid ?? null,
    })),
    clients: Object.fromEntries(byVersion),
  };
  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

/* ── Server ───────────────────────────────────────────────────────────── */

const server = http.createServer((request, response) => {
  void (async () => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (url.pathname === "/__releases") {
        if (!isLoopback(request)) {
          response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
          response.end("loopback only");
          return;
        }
        await diagnostics(response);
        return;
      }

      const lane = await pickLane(request, url);
      if (!lane) {
        response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
        response.end("no release available");
        return;
      }
      await proxy(request, response, lane);
    } catch (error) {
      log("unhandled request failure:", error);
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      }
      response.end("release router failure");
    }
  })();
});

server.on("upgrade", (request, socket) => {
  // WebSocket upgrades are a development-only concern (HMR); production needs none.
  socket.destroy();
});

async function start() {
  await loadRegistry(true);
  if (latestVersion === null) {
    log("ERROR: no release could be loaded — nothing to serve");
    process.exit(1);
  }
  server.listen(PUBLIC_PORT, PUBLIC_HOST, () => {
    log(`router listening on http://${PUBLIC_HOST}:${PUBLIC_PORT} → latest release ${latestVersion}`);
  });
}

function shutdown(signal) {
  log(`${signal} received — stopping lanes`);
  for (const lane of lanes.values()) {
    try {
      lane.child?.kill();
    } catch {
      /* best effort */
    }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  log("failed to start:", error);
  process.exit(1);
});
