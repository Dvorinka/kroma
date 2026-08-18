// Runs a shell's built bundle against the engine it claims to support, on this
// machine, because the sets that need the claim checked are 2017 televisions
// nobody has on a desk. Chromium renders the page with every global the floor
// predates removed first, so a bundle reaching past it throws here exactly as it
// would there - the failure a TV reports only as a black screen.
//
// Syntax is already guarded by check-legacy.ts; this is the other half, the
// runtime surface, which no post-build pass can see.
//
//   bun ../tv-build/probe-deep.ts            # the deep tier, from a shell dir
//   bun ../tv-build/probe-deep.ts --tier legacy

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

// Chrome version each name arrived in; anything at or above the floor under test
// is deleted before the page runs. Members are spelled `Owner.member`, globals
// bare. Only what a TV bundle plausibly reaches - this is a probe, not a census.
const ARRIVED: Record<string, number> = {
  Proxy: 49,
  Reflect: 49,
  URLSearchParams: 49,
  IntersectionObserver: 51,
  PerformanceObserver: 52,
  customElements: 54,
  'Intl.PluralRules': 63,
  ResizeObserver: 64,
  AbortController: 66,
  AbortSignal: 66,
  BigInt: 67,
  'Intl.RelativeTimeFormat': 71,
  queueMicrotask: 71,
  WeakRef: 84,
  FinalizationRegistry: 84,
  structuredClone: 98,
  'Object.values': 54,
  'Object.entries': 54,
  'Object.getOwnPropertyDescriptors': 54,
  'Object.fromEntries': 73,
  'Object.hasOwn': 93,
  'Array.prototype.flat': 69,
  'Array.prototype.flatMap': 69,
  'Array.prototype.at': 92,
  'Array.prototype.findLast': 97,
  'String.prototype.padStart': 57,
  'String.prototype.padEnd': 57,
  'String.prototype.trimStart': 66,
  'String.prototype.trimEnd': 66,
  'String.prototype.matchAll': 73,
  'String.prototype.replaceAll': 85,
  'String.prototype.at': 92,
  'Promise.prototype.finally': 63,
  'Promise.allSettled': 76,
  'Promise.any': 85,
};

const args = process.argv.slice(2);
const arg = (name: string, fallback: string): string => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : (args[at + 1] ?? fallback);
};

const shell = arg('shell', process.cwd());
const tier = arg('tier', 'deep');
const dist = join(shell, 'dist');
const floor = Number(arg('chrome', tier === 'deep' ? '47' : '53'));
const settle = Number(arg('settle', '10000'));

if (!existsSync(join(dist, tier, 'index.js'))) {
  console.error(`[probe-deep] no dist/${tier}/index.js under ${shell} - build the tiers first`);
  process.exit(1);
}

const removed = Object.keys(ARRIVED).filter((name) => ARRIVED[name] >= floor);

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(join(dist, decodeURIComponent(path === '/' ? '/index.html' : path)));
    return (await file.exists()) ? new Response(file) : new Response('not found', { status: 404 });
  },
});

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();

// The gate reads the engine, so the engine has to look old enough for it to pick
// this tier: the modern branch probes CSSLayerBlockRule, the one above deep
// probes custom properties.
await page.addInitScript(
  ({ names, deep }) => {
    const scope = window as unknown as Record<string, unknown>;
    for (const name of names as string[]) {
      const parts = name.split('.');
      let owner: Record<string, unknown> | undefined = scope;
      for (const part of parts.slice(0, -1)) {
        owner = owner?.[part] as Record<string, unknown> | undefined;
      }
      if (owner) delete owner[parts[parts.length - 1]];
    }
    delete scope.CSSLayerBlockRule;
    if (deep && window.CSS) window.CSS.supports = () => false;
  },
  { names: removed, deep: tier === 'deep' },
);

const failures: string[] = [];
page.on('pageerror', (error) => failures.push(`[pageerror] ${error.message}`));
page.on('console', (m) => m.type() === 'error' && failures.push(`[console] ${m.text()}`));
page.on('requestfailed', (r) => failures.push(`[requestfailed] ${r.url()}`));
page.on('response', (r) => r.status() >= 400 && failures.push(`[http ${r.status()}] ${r.url()}`));

await page.goto(`http://localhost:${server.port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(settle);

// Read back over CDP rather than page.evaluate: the deletions above are in the
// main world, which is where Playwright's own serialiser would run.
const cdp = await context.newCDPSession(page);
const { result } = await cdp.send('Runtime.evaluate', {
  expression: `(function () {
    var root = document.getElementById('root');
    var boot = document.getElementById('kroma-boot');
    return JSON.stringify({
      rendered: !!(root && root.firstChild),
      nodes: root ? root.getElementsByTagName('*').length : 0,
      onScreenError: boot ? boot.textContent.slice(0, 400) : '',
    });
  })()`,
  returnByValue: true,
});
const state = JSON.parse(String(result.value)) as {
  rendered: boolean;
  nodes: number;
  onScreenError: string;
};

await browser.close();
server.stop(true);

console.log(`[probe-deep] ${tier} tier at chromium ${floor}: removed ${removed.length} globals`);
if (state.onScreenError) console.log(`[probe-deep] on screen: ${state.onScreenError.trim()}`);
for (const failure of failures) console.error(`[probe-deep] ${failure}`);

if (!state.rendered || failures.length > 0) {
  console.error(`[probe-deep] FAILED - ${state.nodes} nodes rendered`);
  process.exit(1);
}
console.log(`[probe-deep] OK - rendered ${state.nodes} nodes with no errors`);
