/**
 * Test script to verify the system mask query function works correctly
 * This tests both the migration and the TypeScript implementation
 * 
 * Run with: npm run test:system-masks
 */

// Load environment variables first
import './server/bootstrapEnv.js';

import { storage } from './server/storage.js';
import { getMasksByPhotoSystem } from './server/lib/systemQueries.js';
import { executeQuery } from './server/lib/dbHelpers.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

async function runTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  // Test 1: Verify function exists in database
  console.log('Test 1: Checking if get_masks_by_photo_system function exists...');
  try {
    const functionCheck = await executeQuery(`
      SELECT 
        proname, 
        prosecdef,
        proconfig
      FROM pg_proc 
      WHERE proname = 'get_masks_by_photo_system'
    `);
    
    if (functionCheck.length === 0) {
      results.push({
        name: 'Function exists',
        passed: false,
        error: 'Function get_masks_by_photo_system not found in database. Run migration 010_system_mask_query.sql first.'
      });
    } else {
      const func = functionCheck[0];
      const isSecurityDefiner = func.prosecdef === true;
      results.push({
        name: 'Function exists',
        passed: true,
        details: {
          name: func.proname,
          isSecurityDefiner: isSecurityDefiner,
          note: isSecurityDefiner ? '✅ Function has SECURITY DEFINER (will bypass RLS)' : '⚠️ Function missing SECURITY DEFINER'
        }
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Function exists',
      passed: false,
      error: error.message
    });
  }
  
  // Test 2: Get a real photoId from database (if available)
  console.log('\nTest 2: Finding a photo with masks in database...');
  let testPhotoId: string | null = null;
  try {
    // Try to find a photo that has masks
    const photoWithMasks = await executeQuery(`
      SELECT DISTINCT photo_id 
      FROM masks 
      LIMIT 1
    `);
    
    if (photoWithMasks.length > 0) {
      testPhotoId = photoWithMasks[0].photo_id;
      results.push({
        name: 'Find test photo',
        passed: true,
        details: { photoId: testPhotoId }
      });
    } else {
      results.push({
        name: 'Find test photo',
        passed: false,
        error: 'No photos with masks found in database. Cannot test query functionality.'
      });
    }
  } catch (error: any) {
    results.push({
      name: 'Find test photo',
      passed: false,
      error: error.message
    });
  }
  
  // Test 3: Test system function directly (SQL)
  if (testPhotoId) {
    console.log(`\nTest 3: Testing system function with SQL (photoId: ${testPhotoId})...`);
    try {
      const sqlResult = await executeQuery(
        `SELECT * FROM get_masks_by_photo_system($1)`,
        [testPhotoId]
      );
      results.push({
        name: 'System function SQL query',
        passed: true,
        details: {
          masksFound: sqlResult.length,
          maskIds: sqlResult.map((m: any) => m.id)
        }
      });
    } catch (error: any) {
      results.push({
        name: 'System function SQL query',
        passed: false,
        error: error.message
      });
    }
  }
  
  // Test 4: Test TypeScript wrapper function
  if (testPhotoId) {
    console.log(`\nTest 4: Testing TypeScript wrapper function (photoId: ${testPhotoId})...`);
    try {
      const tsResult = await getMasksByPhotoSystem(testPhotoId);
      results.push({
        name: 'TypeScript wrapper function',
        passed: true,
        details: {
          masksFound: tsResult.length,
          maskIds: tsResult.map((m: any) => m.id),
          hasPhotoId: tsResult.every((m: any) => m.photoId === testPhotoId),
          hasPathJson: tsResult.every((m: any) => m.pathJson !== undefined)
        }
      });
    } catch (error: any) {
      results.push({
        name: 'TypeScript wrapper function',
        passed: false,
        error: error.message
      });
    }
  }
  
  // Test 5: Compare with regular storage method (if it works)
  if (testPhotoId) {
    console.log(`\nTest 5: Comparing with regular storage.getMasksByPhoto()...`);
    try {
      const regularResult = await storage.getMasksByPhoto(testPhotoId);
      const systemResult = await getMasksByPhotoSystem(testPhotoId);
      
      const countsMatch = regularResult.length === systemResult.length;
      const idsMatch = regularResult.length === systemResult.length && 
        regularResult.every((m, i) => m.id === systemResult[i]?.id);
      
      results.push({
        name: 'Compare with regular method',
        passed: countsMatch && idsMatch,
        details: {
          regularMethodCount: regularResult.length,
          systemMethodCount: systemResult.length,
          countsMatch,
          idsMatch,
          note: countsMatch && idsMatch 
            ? '✅ Both methods return same results' 
            : '⚠️ Methods return different results (may indicate RLS blocking regular method)'
        }
      });
    } catch (error: any) {
      results.push({
        name: 'Compare with regular method',
        passed: false,
        error: error.message,
        details: {
          note: 'Regular method failed (likely due to RLS) - this is expected for background processes'
        }
      });
    }
  }
  
  // Test 6: Test with invalid photoId
  console.log('\nTest 6: Testing with invalid photoId (should return empty array)...');
  try {
    const invalidResult = await getMasksByPhotoSystem('00000000-0000-0000-0000-000000000000');
    results.push({
      name: 'Invalid photoId handling',
      passed: invalidResult.length === 0,
      details: {
        masksFound: invalidResult.length,
        expected: 0
      }
    });
  } catch (error: any) {
    results.push({
      name: 'Invalid photoId handling',
      passed: false,
      error: error.message
    });
  }
  
  return results;
}

// Run tests
async function main() {
  console.log('=== System Mask Query Function Tests ===\n');
  
  try {
    const results = await runTests();
    
    console.log('\n=== Test Results ===\n');
    let passedCount = 0;
    let failedCount = 0;
    
    results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${result.name}: ${status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.details) {
        console.log(`   Details:`, JSON.stringify(result.details, null, 2));
      }
      console.log('');
      
      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    });
    
    console.log('=== Summary ===');
    console.log(`Total tests: ${results.length}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${failedCount}`);
    
    if (failedCount === 0) {
      console.log('\n✅ All tests passed! The system mask query function is working correctly.');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed. Please review the errors above.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();

