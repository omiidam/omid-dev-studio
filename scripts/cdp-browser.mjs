/**
 * Minimal zero-dependency CDP driver for Chrome/Edge headless (Node >= 22).
 * Used by scripts/verify-marquee.mjs to verify the real running marquee.
 * Dev tooling only — not part of the app bundle.
 */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

export function findExecutable() {
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  try {
    return execFileSync("where", ["chrome"], { encoding: "utf8" }).split(/\r?\n/)[0];
  } catch {
    throw new Error("No Chrome/Edge found. Set CHROME_PATH to launch it.");
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export class CDPError extends Error {}

/**
 * Connects to a single page target over the WebSocket debugger protocol.
 */
export class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.closed = false;
  }

  static async connect(wsUrl) {
    const cdp = new CDP(wsUrl);
    await cdp._open();
    return cdp;
  }

  _open() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (e) => reject(new CDPError("WS error: " + (e.message || "open failed"))));
      ws.addEventListener("message", (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          if (!p) return;
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new CDPError(msg.error.message));
          else p.resolve(msg.result);
        } else {
          this.events.push(msg);
        }
      });
      ws.addEventListener("close", () => {
        this.closed = true;
        for (const p of this.pending.values()) p.reject(new CDPError("CDP closed"));
        this.pending.clear();
      });
    });
  }

  send(method, params = {}) {
    if (this.closed) return Promise.reject(new CDPError("CDP closed"));
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  /**
   * Simplest robust event wait: register a one-shot handler over the socket.
   */
  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ws.removeEventListener("message", onMsg);
        reject(new CDPError("timeout waiting " + method));
      }, timeoutMs);
      const onMsg = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.method === method) {
          clearTimeout(timer);
          this.ws.removeEventListener("message", onMsg);
          resolve(msg.params);
        }
      };
      this.ws.addEventListener("message", onMsg);
    });
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new CDPError("evaluate failed: " + JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  async navigate(url) {
    const loaded = this.once("Page.loadEventFired", 30000);
    await this.send("Page.navigate", { url });
    await loaded;
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

let chromeProc = null;

export async function launchChrome(options = {}) {
  const executable = options.executable || process.env.CHROME_PATH || findExecutable();
  const port = options.port || 9333;
  const userData = options.userData || fs.mkdtempSync(path.join(os.tmpdir(), "cdp-"));
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--disable-background-networking",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userData}`,
    "--window-size=1600,1000",
  ];
  if (options.extraArgs) args.push(...options.extraArgs);

  chromeProc = spawn(executable, args, { stdio: "ignore", detached: false });

  // wait for the debugger endpoint
  let version = null;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        version = await res.json();
        break;
      }
    } catch {}
    await sleep(150);
  }
  if (!version) {
    throw new CDPError("Chrome remote debugging endpoint did not come up");
  }
  return { browserWs: version.webSocketDebuggerUrl, port, userData };
}

export async function newPage(url, options = {}) {
  const { port } = options;
  const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  const target = await res.json();
  const cdp = await CDP.connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  return cdp;
}

export function killChrome() {
  if (chromeProc && !chromeProc.killed) {
    try {
      execFileSync("taskkill", ["/pid", String(chromeProc.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {}
    chromeProc = null;
  }
}

export function savePng(base64, filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
}