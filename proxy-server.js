/**
 * Local reverse proxy — forwards http://localhost:8088 → https://api.tas.namracred.co.in
 * Used in dev/emulator mode because the Android emulator (AVD) has no default internet
 * route; it can only reach the host machine via 10.0.2.2.
 *
 * Usage:  node proxy-server.js
 * Then:   adb reverse tcp:8088 tcp:8088
 * App URL: http://localhost:8088/api/v1
 */

const http = require('http');
const https = require('https');

const TARGET_HOST = 'api.tas.namracred.co.in';
const LOCAL_PORT  = 8088;

const server = http.createServer((clientReq, clientRes) => {
    const options = {
        hostname: TARGET_HOST,
        port: 443,
        path: clientReq.url,
        method: clientReq.method,
        headers: {
            ...clientReq.headers,
            host: TARGET_HOST,
        },
    };

    console.log(`→ ${clientReq.method} ${clientReq.url}`);

    const proxyReq = https.request(options, (proxyRes) => {
        // Pass CORS headers so React Native fetch doesn't block
        const headers = {
            ...proxyRes.headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
        };
        clientRes.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(clientRes, { end: true });
        console.log(`← ${proxyRes.statusCode} ${clientReq.url}`);
    });

    clientReq.pipe(proxyReq, { end: true });

    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err.message);
        if (!clientRes.headersSent) {
            clientRes.writeHead(502);
            clientRes.end(`Proxy error: ${err.message}`);
        }
    });

    // Handle OPTIONS pre-flight
    if (clientReq.method === 'OPTIONS') {
        clientRes.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': '*',
        });
        clientRes.end();
    }
});

server.listen(LOCAL_PORT, () => {
    console.log(`\n✓ Proxy running at http://localhost:${LOCAL_PORT}`);
    console.log(`✓ Forwarding → https://${TARGET_HOST}\n`);
    console.log('Now run in another terminal:');
    console.log(`  adb reverse tcp:${LOCAL_PORT} tcp:${LOCAL_PORT}\n`);
});
