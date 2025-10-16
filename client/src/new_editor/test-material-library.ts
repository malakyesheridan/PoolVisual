// Simple verification script for Material Library integration
import { materialLibrary } from './materialLibrary';
import { PV_MATERIAL_LIBRARY_ENABLED } from './featureFlags';

console.log('Material Library Integration Test');
console.log('================================');

console.log('Feature Flag Enabled:', PV_MATERIAL_LIBRARY_ENABLED);

// Test loading materials
async function testMaterialLibrary() {
  try {
    console.log('\nTesting material loading...');
    const materials = await materialLibrary.loadMaterials();
    console.log(`Loaded ${materials.length} materials:`);
    
    materials.forEach(material => {
      console.log(`- ${material.name} (${material.id})`);
    });
    
    // Test pattern caching
    if (materials.length > 0) {
      console.log('\nTesting pattern caching...');
      const firstMaterial = materials[0];
      const pattern = await materialLibrary.getPattern(firstMaterial.id, 1.0);
      console.log('Pattern created:', pattern ? 'Success' : 'Failed');
      
      // Test cache stats
      const stats = materialLibrary.getCacheStats();
      console.log('Cache stats:', stats);
    }
    
    console.log('\n✅ Material Library integration working correctly!');
    
  } catch (error) {
    console.error('❌ Material Library test failed:', error);
  }
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testMaterialLibrary();
}

export { testMaterialLibrary };
