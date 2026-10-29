const http = require('node:http');
http.createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/repos/Blank-Tea/design-to-handoff/git/matching-refs/tags/v') {
    res.writeHead(501); res.end('Endpoint not modeled'); return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify([
    { ref: 'refs/tags/v0.4.0', object: { type: 'tag', sha: 'c54272fbfc4c3e222fc4bb84c2b82271d60b7a32' } },
    { ref: 'refs/tags/v0.5.0', object: { type: 'tag', sha: '0000000000000000000000000000000000000000' } }
  ]));
}).listen(process.env.PORT);
