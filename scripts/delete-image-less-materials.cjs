const http = require('http');

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          data: data,
          json: () => {
            try { return JSON.parse(data); } catch (e) { return { error: data }; }
          }
        });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('\n🗑️  Starting cleanup of materials without images...\n');
  
  // Fetch all materials
  console.log('Fetching all materials...');
  let allMaterials = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const listRes = await httpRequest(
      `http://localhost:3000/api/materials?page=${page}&pageSize=100`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!listRes.ok) {
      console.error('Failed to fetch:', listRes.status);
      break;
    }
    
    const listData = listRes.json();
    const materials = listData.materials || [];
    allMaterials = allMaterials.concat(materials);
    
    hasMore = materials.length > 0 && materials.length === 100;
    page++;
  }
  
  console.log(`Total materials: ${allMaterials.length}`);
  
  // Filter materials without images
  const materialsToDelete = allMaterials.filter(m => 
    !m.textureUrl && !m.thumbnailUrl
  );
  
  console.log(`Materials without images: ${materialsToDelete.length}\n`);
  
  if (materialsToDelete.length === 0) {
    console.log('✅ No materials to delete!');
    return;
  }
  
  console.log('⚠️  About to delete these materials:\n');
  materialsToDelete.slice(0, 10).forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.name}`);
  });
  if (materialsToDelete.length > 10) {
    console.log(`  ... and ${materialsToDelete.length - 10} more`);
  }
  
  console.log('\n⚠️  This will DELETE all materials without images.');
  console.log('⏰ Starting deletion in 3 seconds... (Ctrl+C to cancel)');
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  let deleted = 0;
  let failed = 0;
  
  for (let i = 0; i < materialsToDelete.length; i++) {
    const material = materialsToDelete[i];
    const progress = `[${i + 1}/${materialsToDelete.length}]`;
    
    try {
      const res = await httpRequest(
        `http://localhost:3000/api/materials/${material.id}`,
        { method: 'DELETE' }
      );
      
      if (res.ok) {
        console.log(`${progress} ✅ Deleted: ${material.name}`);
        deleted++;
      } else {
        console.log(`${progress} ❌ Failed: ${material.name}`);
        failed++;
      }
    } catch (error) {
      console.log(`${progress} ❌ Error: ${material.name} - ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 DELETION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Deleted: ${deleted}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
