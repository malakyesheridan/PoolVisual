// Quick test with first 5 URLs to verify fetching and parsing
const https = require('https');
const materialUrls = [
  'https://www.pooltile.com.au/product/cmc552-vanilla-wavy-23mm/',
  'https://www.pooltile.com.au/product/cmc553-mossman-green-wavy-23mm/',
  'https://www.pooltile.com.au/product/cmc149-pale-blue-23mm/',
  'https://www.pooltile.com.au/product/cmc570seamistwavy23mm/',
  'https://www.pooltile.com.au/product/cmc560-ubud-green-wavy-23mm/',
];

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      }
    }, (res) => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => resolve(html));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseProduct(html, url) {
  const data = {
    name: url.split('/product/')[1]?.replace(/\//g, '').replace(/-/g, ' ').replace(/\d+mm/g, '').trim() || 'Unknown',
    price: null,
    tileSize: null,
    category: 'waterline_tile',
    textureUrl: null,
  };

  try {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      data.name = titleMatch[1]
        .replace(/[-|] The Pool Tile Company/g, '')
        .replace(/[-|] Buy at Pool Tiles Sydney Melbourne Brisbane/g, '')
        .trim();
    }

    const tileSizeMatch = html.match(/(\d+)mm/i);
    if (tileSizeMatch) {
      data.tileSize = parseInt(tileSizeMatch[1]);
    }

    const nameLower = data.name.toLowerCase();
    if (nameLower.includes('coping')) data.category = 'coping';
    else if (nameLower.includes('paving') || nameLower.includes('paver')) data.category = 'paving';

  } catch (error) {
    console.error(`Error parsing ${url}:`, error.message);
  }

  return data;
}

async function main() {
  console.log('\n🧪 Testing fetch and parse with 5 URLs...\n');
  
  for (let i = 0; i < materialUrls.length; i++) {
    const url = materialUrls[i];
    console.log(`[${i + 1}/5] Testing: ${url}`);
    
    try {
      const html = await fetchPage(url);
      const product = parseProduct(html, url);
      console.log(`  ✅ Name: ${product.name}`);
      console.log(`     Tile Size: ${product.tileSize}mm`);
      console.log(`     Category: ${product.category}\n`);
      
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
    }
  }
  
  console.log('✅ Test complete!\n');
}

main().catch(console.error);
