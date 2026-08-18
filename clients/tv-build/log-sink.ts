// The log channel a retail television still has. Samsung's shipped firmware
// answers `intershell_support:disabled`, which takes `sdb dlog` and the web
// inspector with it, so the app reports to this instead: build a shell with
// KROMA_TV_LOG_SINK set to the URL printed below and the gate POSTs here.
//
//   bun ../tv-build/log-sink.ts                 # prints the URL to build with
//   KROMA_TV_LOG_SINK=http://<ip>:4041 bun run build:tizen

import { networkInterfaces } from 'node:os';

const port = Number(process.env.PORT ?? 4041);

function lanAddress(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return 'localhost';
}

const stamp = (): string => new Date().toISOString().slice(11, 23);

Bun.serve({
  port,
  hostname: '0.0.0.0',
  async fetch(req) {
    if (req.method !== 'POST') return new Response('kroma log sink\n');
    const body = (await req.text()).slice(0, 8192);
    console.log(`${stamp()}  ${body}`);
    return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
  },
});

console.log(`[log-sink] listening on http://${lanAddress()}:${port}`);
console.log(`[log-sink] build the shell with:  KROMA_TV_LOG_SINK=http://${lanAddress()}:${port}`);
