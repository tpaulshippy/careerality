// Local proxy to the production API to bypass CORS when screenshotting
// the web build. Forwards requests to TARGET and adds permissive CORS headers.
//
// Usage: node proxy.mjs   (listens on 127.0.0.1:8410)
// Override target: TARGET=https://example.com node proxy.mjs

import http from 'node:http';

const TARGET = process.env.TARGET || 'https://careerality.app';

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    const url = TARGET + req.url;
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method)
      ? await new Promise((resolve) => {
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => resolve(Buffer.concat(chunks)));
        })
      : undefined;
    const upstream = await fetch(url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
    });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.writeHead(502);
    res.end(JSON.stringify({ error: String(e) }));
  }
});
server.listen(8410, '127.0.0.1', () => console.log(`proxy on 8410 -> ${TARGET}`));
