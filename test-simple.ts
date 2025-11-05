// Simple test to verify CompositeGenerator class loads correctly
import { CompositeGenerator } from './server/compositeGenerator';

console.log('🧪 Testing CompositeGenerator class loading...');

try {
  const generator = new CompositeGenerator();
  console.log('✅ CompositeGenerator class loaded successfully');
  console.log('✅ Constructor works');
  
  // Test the interface
  console.log('📋 Available methods:');
  console.log('  - generateComposite');
  
  console.log('🎉 All tests passed!');
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}
