const https = require('https');
const http = require('http');

function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const fullOptions = { ...options, headers: options.headers || {} };
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

function extractImageUrl(html) {
  const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"[^>]*>/i);
  if (ogImageMatch) {
    return ogImageMatch[1];
  }
  const thumbMatch = html.match(/data-thumb="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
  if (thumbMatch) {
    return thumbMatch[1];
  }
  return null;
}

async function updateMaterialImage(material, imageUrl) {
  try {
    const urlObj = new URL(`http://localhost:3000/api/materials/${material.id}`);
    const payload = { texture_url: imageUrl, thumbnail_url: imageUrl };
    
    const res = await httpRequest(
      urlObj.href,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' } },
      JSON.stringify(payload)
    );
    
    return res.ok;
  } catch (error) {
    console.error(`  Update failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔄 Starting update process...\n');
  
  // Step 1: Get all materials (fetch all pages)
  console.log('Fetching all materials from API...');
  let allMaterials = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const listRes = await httpRequest(
      `http://localhost:3000/api/materials?page=${page}&pageSize=100`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!listRes.ok) {
      console.error('Failed to fetch materials:', listRes.status, listRes.data);
      break;
    }
    
    const listData = listRes.json();
    const materials = listData.materials || [];
    allMaterials = allMaterials.concat(materials);
    
    console.log(`Fetched page ${page}: ${materials.length} materials`);
    
    hasMore = materials.length > 0 && materials.length === 100;
    page++;
  }
  
  console.log(`Total materials fetched: ${allMaterials.length}\n`);
  
  // Step 2: Filter materials without images
  const materialsWithoutImages = allMaterials.filter(m => 
    !m.textureUrl && !m.thumbnailUrl && m.sourceUrl
  );
  
  console.log(`Materials without images: ${materialsWithoutImages.length}`);
  
  if (materialsWithoutImages.length === 0) {
    console.log('✅ All materials already have images!');
    return;
  }
  
  // Step 3: Process each material
  let successCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < materialsWithoutImages.length; i++) {
    const material = materialsWithoutImages[i];
    const progress = `[${i + 1}/${materialsWithoutImages.length}]`;
    
    try {
      console.log(`${progress} ${material.name}`);
      console.log(`${progress} Source: ${material.sourceUrl}`);
      
      if (!material.sourceUrl) {
        console.log(`${progress} ⚠️  No source URL, skipping\n`);
        failedCount++;
        continue;
      }
      
      // Fetch the product page
      const html = await fetchPage(material.sourceUrl);
      
      // Extract image URL
      const imageUrl = extractImageUrl(html);
      
      if (!imageUrl) {
        console.log(`${progress} ❌ No image found\n`);
        failedCount++;
        continue;
      }
      
      console.log(`${progress} Found image: ${imageUrl}`);
      
      // Update the material
      const success = await updateMaterialImage(material, imageUrl);
      
      if (success) {
        console.log(`${progress} ✅ Updated\n`);
        successCount++;
      } else {
        console.log(`${progress} ❌ Update failed\n`);
        failedCount++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`${progress} ❌ Error: ${error.message}\n`);
      failedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 UPDATE SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
