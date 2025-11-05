import { CompositeGenerator } from './server/compositeGenerator';
import { storage } from './server/storage';

async function testCompositeGeneration() {
  console.log('🧪 Testing CompositeGenerator...');
  
  try {
    // Test with a known photo ID
    const photoId = 'ca5e5c1f-b5e1-46f7-8d08-0e9c8f6481c2';
    
    console.log(`📸 Testing with photo ID: ${photoId}`);
    
    // Check if photo exists
    const photo = await storage.getPhoto(photoId);
    if (!photo) {
      console.log('❌ Photo not found');
      return;
    }
    
    console.log(`✅ Photo found: ${photo.originalUrl}`);
    
    // Check if photo has masks
    const masks = await storage.getMasksByPhoto(photoId);
    console.log(`🎭 Found ${masks.length} masks`);
    
    if (masks.length > 0) {
      console.log('📋 Mask details:');
      for (const mask of masks) {
        console.log(`  - Mask ${mask.id}: ${mask.materialId ? `Material ${mask.materialId}` : 'No material'}`);
      }
    }
    
    // Test composite generation
    const generator = new CompositeGenerator();
    const result = await generator.generateComposite(photoId);
    
    console.log('🎨 Composite generation result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.status === 'completed') {
      console.log('✅ Composite generation successful!');
    } else {
      console.log('❌ Composite generation failed:', result.error);
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testCompositeGeneration().then(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test error:', error);
  process.exit(1);
});
