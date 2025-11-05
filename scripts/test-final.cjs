const https = require('https');
const http = require('http');

function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const fullOptions = {
      ...options,
      headers: options.headers || {}
    };
    const req = client.request(url, fullOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const result = {
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          data: data,
          json: () => {
            try { return JSON.parse(data); } catch (e) { return { error: data }; }
          }
        };
        resolve(result);
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const payload = {
  name: 'Test Vanilla Wavy 23mm Pool Tile',
  category: 'waterline_tile',
  unit: 'm2',
  price: 45.50,
  cost: 38.68,
  tile_width_mm: 23,
  tile_height_mm: 23,
  supplier: 'PoolTile',
  source_url: 'https://www.pooltile.com.au/product/cmc552-vanilla-wavy-23mm/'
};

console.log('Testing with corrected format...\n');

httpRequest(
  'http://localhost:3000/api/materials',
  { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  JSON.stringify(payload)
).then(res => {
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(res.json(), null, 2));
}).catch(console.error);
