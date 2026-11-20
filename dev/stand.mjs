// Dev stand for headless checks: starts the backend mock, the static server and a
// headless Chrome, and gives a tiny CDP client. Everything is stopped by stop().
// Used by web/dev/*-check.mjs and web/dev/shoot.mjs. Node 22 (global WebSocket and fetch).
// QP_CHROME_PROFILE picks the Chrome profile folder (slow-check.mjs uses a fresh one per run).

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const REPO = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PROFILE = process.env.QP_CHROME_PROFILE || resolve(process.env.TEMP || '.', 'qp-chrome');
export const BASE = 'http://127.0.0.1:8080/';
const CDP_PORT = 9339;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, timeoutMs, label) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch { /* not ready yet */ }
    if (Date.now() > end) throw new Error('timeout: ' + label);
    await wait(150);
  }
}

function run(cmd, args, env) {
  const child = spawn(cmd, args, { cwd: REPO, env: { ...process.env, ...env }, windowsHide: true, stdio: 'ignore' });
  child.on('error', (e) => console.error('spawn failed', cmd, e.message));
  return child;
}

export function startMock(extraEnv = {}) {
  return run(process.execPath, ['backend/mock-server.mjs'], { MOCK_OK: '1', MOCK_QUIZ_DELAY_MS: '1400', ...extraEnv });
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
}

class Page {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { ok, fail } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
      } else if (msg.method) {
        (this.handlers.get(msg.method) || []).forEach((h) => h(msg.params));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((ok, fail) => {
      this.pending.set(id, { ok, fail });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error('eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  waitFor(expr, timeoutMs = 8000) {
    return until(() => this.eval(expr), timeoutMs, expr);
  }
  async viewport(width, height, mobile = false, scale = 1) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
    await this.send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  }
  async goto(url) {
    const loaded = new Promise((r) => this.on('Page.loadEventFired', r));
    await this.send('Page.navigate', { url });
    await loaded;
    await this.eval('document.fonts.ready.then(() => true)');
  }
  async click(selector) {
    const box = await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!box) throw new Error('no element ' + selector);
    await wait(60);
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await this.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
  }
  async type(selector, text) {
    await this.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await this.send('Input.insertText', { text });
  }
  async shot(path, clip) {
    const { writeFileSync } = await import('node:fs');
    const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, ...(clip ? { clip } : {}) });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
  }
}

// Starts static server (+ mock unless mock === false) and Chrome; returns { page, mock, errors, stop }.
export async function startStand({ mock = true, mockEnv = {} } = {}) {
  mkdirSync(PROFILE, { recursive: true });
  const procs = {};
  if (mock) procs.mock = startMock(mockEnv);
  procs.serve = run(process.execPath, ['web/dev/serve.mjs'], { SERVE_OK: '1', DEV_API: '1' });
  procs.chrome = run(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
    '--mute-audio', '--window-size=1440,900', 'about:blank',
  ]);
  await until(() => fetch(BASE).then((r) => r.ok), 8000, 'static server');
  if (mock) await until(() => fetch('http://127.0.0.1:8787/?action=stats').then((r) => r.ok), 8000, 'mock');
  const list = await until(() => fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((r) => r.json()), 15000, 'chrome');
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  const page = new Page(ws);
  const errors = [];
  page.on('Runtime.exceptionThrown', (p) => errors.push('exception: ' + (p.exceptionDetails.exception?.description || p.exceptionDetails.text)));
  page.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'warning') errors.push(p.type + ': ' + p.args.map((a) => a.value ?? a.description).join(' '));
  });
  page.on('Log.entryAdded', (p) => { if (p.entry.level === 'error' || p.entry.level === 'warning') errors.push('log ' + p.entry.level + ': ' + p.entry.text + ' ' + (p.entry.url || '')); });
  await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable'].map((m) => page.send(m)));
  // Every run starts without the service worker and its cache of an earlier run (web/sw.js),
  // so the page always runs the files of this worktree.
  await page.send('Storage.clearDataForOrigin', { origin: BASE.slice(0, -1), storageTypes: 'service_workers,cache_storage' }).catch(() => {});
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await page.send('Browser.grantPermissions', { origin: BASE.slice(0, -1), permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
  return {
    page, procs, errors, wait,
    stopMock() { killTree(procs.mock); procs.mock = null; },
    startMock(env = {}) { procs.mock = startMock({ ...mockEnv, ...env }); return until(() => fetch('http://127.0.0.1:8787/?action=stats').then((r) => r.ok), 8000, 'mock'); },
    async stop() {
      try { await page.send('Browser.close'); } catch { /* already gone */ }
      ws.close();
      await wait(300);
      Object.values(procs).forEach(killTree);
    },
  };
}
