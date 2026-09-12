import { launchChrome, newPage, killChrome } from "./cdp-browser.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let chrome;
try {
  chrome = await launchChrome({});
  const cdp = await newPage("about:blank", { port: chrome.port });
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.navigate("http://localhost:57500/");
  await sleep(2200);
  await cdp.evaluate(`(() => { const c = document.querySelector('.marquee-edge-fade'); if (c) c.scrollIntoView({ block: 'center' }); })()`);
  await sleep(500);

  const report = await cdp.evaluate(`(() => {
    const c = document.querySelector('.marquee-edge-fade');
    if (!c) return 'no container';
    const t = c.children[0];
    const cr = c.getBoundingClientRect();
    const cards = Array.from(t.children).slice(0, 10).map((el, i) => {
      const r = el.getBoundingClientRect();
      return { i, x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), overlapH: r.right >= cr.left && r.left <= cr.right };
    });
    return JSON.stringify({
      viewport: innerWidth + 'x' + innerHeight,
      container: { x: Math.round(cr.x), right: Math.round(cr.right), y: Math.round(cr.y), bottom: Math.round(cr.bottom) },
      transform: getComputedStyle(t).transform,
      duration: getComputedStyle(t).animationDuration,
      cards,
    });
  })()`);
  console.log(report);

  // Now sample overlap over time via a strict interval (not rAF)
  const ov = await cdp.evaluate(`new Promise((resolve) => {
    const c = document.querySelector('.marquee-edge-fade');
    const t = c.children[0];
    const t0 = performance.now();
    let hits = 0, checks = 0;
    const iv = setInterval(() => {
      const cr = c.getBoundingClientRect();
      let any = false;
      for (const el of t.children) {
        const r = el.getBoundingClientRect();
        if (r.right >= cr.left && r.left <= cr.right) { any = true; hits++; break; }
      }
      checks++;
      if (performance.now() - t0 > 1500) {
        clearInterval(iv);
        resolve({ checksAt1_5s: checks, overlapFrames: hits, firstT: hits ? null : null });
      }
    }, 50);
  })`);
  console.log("interval overlap:", JSON.stringify(ov));
  cdp.close();
} catch (e) {
  console.error("ERR", e && (e.stack || e.message || e));
} finally {
  killChrome();
}