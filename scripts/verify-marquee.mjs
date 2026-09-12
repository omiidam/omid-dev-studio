/**
 * Browser verification for the reviews marquee (see AGENTS/PHASE notes).
 * Zero-dependency: drives the system Chrome/Edge over CDP.
 *
 * Usage:
 *   node scripts/verify-marquee.mjs --url http://localhost:57500/?marquee-debug [--width 1440] [--height 900] [--reduced] [--shots]
 *
 * Prints a JSON result with:
 *   - computed animation duration / name / playState / transform
 *   - measured first-entry time (≤ 1s required)
 *   - per-frame velocities (linearity), direction check (LEFT_TO_RIGHT => dx > 0)
 *   - container coverage scan (no empty band / gap)
 *   - captured [REVIEWS-MARQUEE] console logs (enabled via ?marquee-debug)
 *   - optional PNG screenshots under .data/marquee-shots/<label>/
 */
import { fileURLToPath } from "node:url";
import { launchChrome, newPage, killChrome, savePng } from "./cdp-browser.mjs";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const url = getArg("--url", "http://localhost:57500/?marquee-debug");
const width = Number(getArg("--width", "1440"));
const height = Number(getArg("--height", "900"));
const reduced = args.includes("--reduced");
const shots = args.includes("--shots");
const label = args.includes("--label")
  ? getArg("--label", "").replace(/[^a-z0-9_-]/gi, "")
  : `${width}x${height}${reduced ? "-reduced" : ""}`;

export const PROBE = `
  (() => {
    window.__marqueeProbe = null;
    const container = document.querySelector('.marquee-edge-fade');
    if (!container) { window.__marqueeProbe = { error: 'no .marquee-edge-fade container' }; return; }
    const track = container.children[0];
    if (!track) { window.__marqueeProbe = { error: 'no track child' }; return; }
    const startedAt = performance.now();
    let firstEntry = null;
    const iv = setInterval(() => {
      if (firstEntry !== null) return;
      const cr = container.getBoundingClientRect();
      for (const card of track.children) {
        const r = card.getBoundingClientRect();
        if (r.right >= cr.left && r.left <= cr.right) {
          firstEntry = (performance.now() - startedAt) / 1000;
          clearInterval(iv);
          break;
        }
      }
    }, 30);
    const scanline = () => {
      const cr = container.getBoundingClientRect();
      const y = cr.top + cr.height / 2;
      let covered = 0, total = 0;
      for (let x = cr.left + 8; x <= cr.right - 8; x += 20) {
        total++;
        const el = document.elementsFromPoint(x, y)[0];
        if (el && typeof el.closest === 'function' && el.closest('.marquee-edge-fade figure')) covered++;
      }
      return total ? covered / total : 0;
    };
    let t0;
    const samples = [];
    const coverage = [];
    const MAX_MS = 3500;
    let first = true;
    let done = false;
    const finish = (style) => {
      window.__marqueeProbe = {
        style,
        dims: {
          containerW: container.clientWidth,
          trackScrollW: track.scrollWidth,
          cards: track.children.length,
          copies: Math.round(track.children.length / 6),
        },
        overflowX: getComputedStyle(container).overflowX,
        firstEntry,
        samples,
        coverage,
      };
    };
    // Timer-driven sampling (uniform cadence; headless rAF is frame-throttled).
    const sampler = setInterval(() => {
      const now = performance.now();
      if (first) { t0 = now; first = false; }
      const t = (now - t0) / 1000;
      const cs = getComputedStyle(track);
      const m = cs.transform.match(/matrix\\(([^)]+)\\)/);
      let tx = null;
      if (m) { const p = m[1].split(',').map(s => parseFloat(s.trim())); tx = p[4]; }
      samples.push({ t, tx, rx: track.getBoundingClientRect().x });
      if (samples.length % 5 === 0) coverage.push({ t, cov: scanline() });
      if (now - t0 >= MAX_MS && !done) {
        done = true;
        clearInterval(sampler);
        finish({
          duration: cs.animationDuration,
          name: cs.animationName,
          playState: cs.animationPlayState,
          delay: cs.animationDelay,
          iteration: cs.animationIterationCount,
          timing: cs.animationTimingFunction,
          transform: cs.transform,
        });
      }
    }, 80);
    const snapshot = () => {
      const cr = container.getBoundingClientRect();
      const spans = Array.from(track.children).map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left - cr.left, right: r.right - cr.left };
      });
      return { viewportW: cr.width, spans };
    };
    // two snapshots ~1s apart
    setTimeout(() => { window.__mqBands1 = snapshot(); }, 1400);
    setTimeout(() => { window.__mqBands2 = snapshot(); }, 2600);
    setTimeout(() => {
      if (!done) {
        done = true;
        const cs = getComputedStyle(track);
        finish({
          duration: cs.animationDuration,
          name: cs.animationName,
          playState: cs.animationPlayState,
          delay: cs.animationDelay,
          iteration: cs.animationIterationCount,
          timing: cs.animationTimingFunction,
          transform: cs.transform,
          fallback: true,
        });
      }
    }, MAX_MS + 1200);
  })();
`;

function consoleLogs(cdp) {
  const out = [];
  for (const ev of cdp.events) {
    if (ev.method !== "Runtime.consoleAPICalled") continue;
    const parts = (ev.params.args || []).map((a) => {
      if (a.value !== undefined) return String(a.value);
      if (a.type === "object" && a.preview) return JSON.stringify(a.preview);
      return a.type || "";
    });
    out.push(parts.join(" "));
  }
  return out;
}

function analyze(payload) {
  const samples = payload.samples || [];
  const velocities = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t;
    if (dt <= 0) continue;
    const dxTx = (samples[i].tx ?? 0) - (samples[i - 1].tx ?? 0);
    velocities.push(dxTx / dt);
  }
  const mean = velocities.length ? velocities.reduce((a, b) => a + b, 0) / velocities.length : NaN;
  const median = velocities.length ? [...velocities].sort((a, b) => a - b)[Math.floor(velocities.length / 2)] : NaN;
  const variance = velocities.length
    ? velocities.reduce((a, b) => a + (b - mean) ** 2, 0) / velocities.length
    : NaN;
  const stdev = Math.sqrt(variance);
  const maxAbsJump = velocities.length ? Math.max(...velocities.map((v) => Math.abs(v))) : NaN;
  // Long-window binned velocities (immune to headless cadence jitter): one
  // anchor per whole second, velocity over each ≥0.5s span.
  const anchors = new Map();
  for (const s of samples) {
    if (s.tx == null) continue;
    const b = Math.floor(s.t);
    if (!anchors.has(b)) anchors.set(b, s);
  }
  const keys = [...anchors.keys()].sort((a, b) => a - b);
  const binVel = [];
  for (let i = 1; i < keys.length; i++) {
    const a = anchors.get(keys[i - 1]);
    const z = anchors.get(keys[i]);
    const dt = z.t - a.t;
    if (dt > 0.5) binVel.push((z.tx - a.tx) / dt);
  }
  const mean2 = binVel.length ? binVel.reduce((a, b) => a + b, 0) / binVel.length : NaN;
  const stdev2 = binVel.length
    ? Math.sqrt(binVel.reduce((a, b) => a + (b - mean2) ** 2, 0) / binVel.length)
    : NaN;
  // Interpolated per-second velocity: tx sampled at FIXED 1s anchors via
  // linear interpolation between the two surrounding samples. Cadence-clean.
  // Since the motion is piecewise-linear with constant slope, wrapping (the
  // tx reset) never distorts these 1s-average velocities, so the full lap --
  // including the wrap -- must yield constant per-second velocity.
  const interpT = (tt) => {
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i];
      if (a.t <= tt && b.t >= tt && a.tx != null && b.tx != null) {
        const f = (tt - a.t) / (b.t - a.t);
        return a.tx + (b.tx - a.tx) * f;
      }
    }
    return null;
  };
  const interpAnchors = [];
  if (samples.length) {
    const firstK = Math.floor(samples[0].t);
    const lastK = Math.floor(samples[samples.length - 1].t);
    for (let k = firstK + 1; k < lastK; k++) {
      const tx = interpT(k);
      if (tx != null) interpAnchors.push({ t: k, tx });
    }
  }
  const interpVel = [];
  for (let i = 1; i < interpAnchors.length; i++) {
    const v = (interpAnchors[i].tx - interpAnchors[i - 1].tx) / (interpAnchors[i].t - interpAnchors[i - 1].t);
    if (Number.isFinite(v)) interpVel.push(v);
  }
  const mean3 = interpVel.length ? interpVel.reduce((a, b) => a + b, 0) / interpVel.length : NaN;
  const stdev3 = interpVel.length
    ? Math.sqrt(interpVel.reduce((a, b) => a + (b - mean3) ** 2, 0) / interpVel.length)
    : NaN;
  // Wrap resets are the ONLY allowed large delta; anything else = discontinuity.
  const suspicious = velocities.filter(
    (v) => Math.abs(v) > Math.max(10, Math.abs(median) * 3)
  ).length;
  const coverage = payload.coverage || [];
  const minCoverage = coverage.length ? Math.min(...coverage.map((c) => c.cov)) : NaN;
  const meanCoverage = coverage.length
    ? coverage.reduce((a, c) => a + c.cov, 0) / coverage.length
    : NaN;
  const durationMs = parseFloat(payload.style?.duration) * 1000 || NaN;
  // Band analysis: every horizontal pixel of the viewport should be covered
  // by cards, except for the UNIFORM card gaps (24px, by design). We verify
  // the max gap between consecutive cards and that each edge has a card
  // within tolerance (gaps at edges are transient and sub-frame).
  function bandsReport(label) {
    const b = payload[`__mqBands${label}`];
    if (!b || !Array.isArray(b.spans) || b.spans.length === 0) return null;
    const order = b.spans.map((c, i) => ({ left: c.left, right: c.right, i })).sort((a, x) => a.left - x.left);
    let maxGap = 0;
    let closestToLeft = Infinity;
    let closestToRight = Infinity;
    for (const c of order) {
      if (c.right > 0 && c.left < b.viewportW) { // intersects viewport band
        const distLeft = Math.max(0, -c.left);
        const distRight = Math.max(0, c.right - b.viewportW);
        closestToLeft = Math.min(closestToLeft, distLeft);
        closestToRight = Math.min(closestToRight, distRight);
      }
    }
    for (let i = 1; i < order.length; i++) {
      const g = order[i].left - order[i - 1].right;
      if (g > maxGap) maxGap = g;
    }
    return { viewportW: b.viewportW, cards: order.length, maxGapPx: maxGap.toFixed(1), closestToLeftPx: closestToLeft.toFixed(0), closestToRightPx: closestToRight.toFixed(0) };
  }
  const bands = [bandsReport("1"), bandsReport("2")].filter(Boolean);
  const maxGapPx = bands.length ? Math.max(...bands.map((b) => Number(b.maxGapPx))) : NaN;
  const maxEdgeGap = bands.length ? Math.max(...bands.map((b) => Math.max(Number(b.closestToLeftPx), Number(b.closestToRightPx)))) : NaN;
  return {
    velocities: { count: velocities.length, mean, median, stdev, maxAbsJump, suspiciousCount: suspicious },
    binned: { count: binVel.length, mean: mean2, stdev: stdev2 },
    coverage: { samples: coverage.length, min: minCoverage, mean: meanCoverage },
    bands,
    bandGaps: { maxGapPx: Number.isNaN(maxGapPx) ? null : maxGapPx, maxEdgeGapPx: Number.isNaN(maxEdgeGap) ? null : maxEdgeGap },
    direction: mean > 0 ? "LEFT_TO_RIGHT" : mean < 0 ? "RIGHT_TO_LEFT" : "STATIONARY",
    checks: {
      firstEntryUnder1s: payload.firstEntry !== null && payload.firstEntry <= 1,
      linear:
        payload.style?.timing === "linear" &&
        !Number.isNaN(stdev3) &&
        stdev3 < Math.max(2, Math.abs(mean3) * 0.03),
      noGapInViewport: !Number.isNaN(maxGapPx) && maxGapPx <= 40 && maxEdgeGap <= 40,
      durationModerate: !Number.isNaN(durationMs) && durationMs > 5000 && durationMs < 30000,
      no66s: !Number.isNaN(durationMs) && Math.abs(durationMs - 66000) > 1000,
      overflowHidden: payload.overflowX === "hidden" || payload.overflowX === "clip",
      animationActive:
        payload.style?.name && !String(payload.style?.name).startsWith("none") &&
        payload.style?.playState === "running" &&
        String(payload.style?.iteration).startsWith("infinite"),
    },
  };
}

async function runScenario(cdp, shotDir) {
  await cdp.evaluate(`(() => { const c = document.querySelector('.marquee-edge-fade'); if (c) c.scrollIntoView({ block: 'center' }); })()`);
  await new Promise((r) => setTimeout(r, 400));
  await cdp.evaluate(`${PROBE}`);
  await new Promise((r) => setTimeout(r, 4900));
  const res = await cdp.evaluate(`window.__marqueeProbe`);
  if (!res || typeof res !== "object") return { error: "probe returned nothing", raw: String(res) };
  if (res.error) return { error: res.error };
  const bands1 = await cdp.evaluate(`window.__mqBands1`);
  const bands2 = await cdp.evaluate(`window.__mqBands2`);
  if (bands1) res.__mqBands1 = bands1;
  if (bands2) res.__mqBands2 = bands2;
  const analysis = analyze(res);

  if (shots) {
    fs.mkdirSync(shotDir, { recursive: true });
    await cdp.evaluate(`(() => { const c = document.querySelector('.marquee-edge-fade'); if (c) c.scrollIntoView({ block: 'center' }); })()`);
    await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 10, g: 10, b: 14, a: 1 } });
    const clip = await cdp.evaluate(`(() => { const c = document.querySelector('.marquee-edge-fade'); const r = c.getBoundingClientRect(); return { x: Math.max(0, r.x - 20), y: Math.max(0, r.y - 20), width: Math.min(1600, r.width + 40), height: Math.min(1000, r.height + 40), scale: 1 }; })()`);
    for (let i = 0; i < 8; i++) {
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip });
      savePng(shot.data, path.join(shotDir, `t${String(i).padStart(2, "0")}.png`));
      await new Promise((r) => setTimeout(r, 500));
    }
    await cdp.send("Emulation.setDefaultBackgroundColorOverride");
  }

  return {
    style: res.style,
    dims: res.dims,
    overflowX: res.overflowX,
    firstEntrySec: res.firstEntry,
    analysis,
    logs: consoleLogs(cdp),
  };
}

const main = async () => {
  let chrome = null;
  try {
    chrome = await launchChrome({});
    const cdp = await newPage("about:blank", { port: chrome.port });

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }],
    });

    await cdp.navigate(url);
    // give fonts + marquee post-mount a moment
    await new Promise((r) => setTimeout(r, 2500));

    const shotDir = path.join("E:\\FreeBuff\\omid-studio", ".data", "marquee-shots", label);
    const result = await runScenario(cdp, shotDir);

    const payload = {
      scenario: { url, width, height, reduced },
      captured: Date.now(),
      result,
    };
    console.log(JSON.stringify(payload, null, 2));
    cdp.close();
  } catch (e) {
    console.error("VERIFY-FAILED:" + (e.message || String(e)));
    process.exitCode = 1;
  } finally {
    killChrome();
  }
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();