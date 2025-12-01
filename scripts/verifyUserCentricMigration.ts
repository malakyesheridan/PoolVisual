import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

interface VerificationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

async function verifyMigration(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  try {
    // 1. Verify all jobs have user_id
    const jobsCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(user_id) as with_user_id,
        COUNT(*) - COUNT(user_id) as missing_user_id
      FROM jobs
    `);
    const jobsData = jobsCheck.rows[0];
    results.push({
      name: 'Jobs have user_id',
      passed: parseInt(jobsData.missing_user_id) === 0,
      message: `${jobsData.with_user_id}/${jobsData.total} jobs have user_id`,
      details: jobsData
    });

    // 2. Verify all masks have user_id
    const masksCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(user_id) as with_user_id,
        COUNT(*) - COUNT(user_id) as missing_user_id
      FROM masks
    `);
    const masksData = masksCheck.rows[0];
    results.push({
      name: 'Masks have user_id',
      passed: parseInt(masksData.missing_user_id) === 0,
      message: `${masksData.with_user_id}/${masksData.total} masks have user_id`,
      details: masksData
    });

    // 3. Verify all labor_rules have user_id
    const laborRulesCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(user_id) as with_user_id,
        COUNT(*) - COUNT(user_id) as missing_user_id
      FROM labor_rules
    `);
    const laborRulesData = laborRulesCheck.rows[0];
    results.push({
      name: 'Labor rules have user_id',
      passed: parseInt(laborRulesData.missing_user_id) === 0,
      message: `${laborRulesData.with_user_id}/${laborRulesData.total} labor rules have user_id`,
      details: laborRulesData
    });

    // 4. Verify user-level fields exist
    const userFieldsCheck = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(industry_type) as with_industry,
        COUNT(credits_balance) as with_credits,
        SUM(CASE WHEN credits_balance > 0 THEN 1 ELSE 0 END) as users_with_credits
      FROM users
    `);
    const userFieldsData = userFieldsCheck.rows[0];
    results.push({
      name: 'Users have industry_type and credits_balance',
      passed: true, // These are optional, just checking they exist
      message: `${userFieldsData.with_industry} users have industry_type, ${userFieldsData.users_with_credits} have credits`,
      details: userFieldsData
    });

    // 5. Verify indexes exist (including partial indexes)
    const indexesCheck = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('jobs', 'masks', 'materials', 'labor_rules', 'users')
      AND (
        indexname LIKE 'idx_%user_id%' 
        OR indexname LIKE 'idx_users_%'
      )
      ORDER BY indexname
    `);
    const expectedIndexes = [
      'idx_jobs_user_id',
      'idx_masks_user_id',
      'idx_materials_user_id',
      'idx_labor_rules_user_id',
      'idx_users_industry_type',
      'idx_users_credits_balance'
    ];
    const foundIndexes = indexesCheck.rows.map(r => r.indexname);
    const missingIndexes = expectedIndexes.filter(idx => !foundIndexes.includes(idx));
    results.push({
      name: 'Performance indexes created',
      passed: missingIndexes.length === 0,
      message: `Found ${foundIndexes.length}/${expectedIndexes.length} expected indexes`,
      details: { found: foundIndexes, missing: missingIndexes }
    });

    // 6. Verify RLS policies exist
    const policiesCheck = await pool.query(`
      SELECT tablename, policyname 
      FROM pg_policies 
      WHERE tablename IN ('jobs', 'masks', 'materials', 'labor_rules', 'quotes', 'photos')
      AND policyname LIKE 'users_%'
      ORDER BY tablename, policyname
    `);
    const expectedPolicyCount = 24; // Approximate expected policies
    results.push({
      name: 'RLS policies created',
      passed: policiesCheck.rows.length >= expectedPolicyCount,
      message: `Found ${policiesCheck.rows.length} user-based RLS policies`,
      details: policiesCheck.rows
    });

    // 7. Verify get_current_user_id function exists
    const functionCheck = await pool.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname = 'get_current_user_id'
    `);
    results.push({
      name: 'get_current_user_id function exists',
      passed: functionCheck.rows.length > 0,
      message: functionCheck.rows.length > 0 ? 'Function exists' : 'Function not found',
      details: functionCheck.rows
    });

    // 8. Check data distribution
    const dataDistribution = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM jobs) as jobs_count,
        (SELECT COUNT(*) FROM masks) as masks_count,
        (SELECT COUNT(*) FROM materials WHERE user_id IS NOT NULL) as user_materials,
        (SELECT COUNT(*) FROM materials WHERE user_id IS NULL) as global_materials,
        (SELECT COUNT(*) FROM users WHERE industry_type IS NOT NULL) as users_with_industry
    `);
    results.push({
      name: 'Data distribution',
      passed: true,
      message: `Jobs: ${dataDistribution.rows[0].jobs_count}, Masks: ${dataDistribution.rows[0].masks_count}, User Materials: ${dataDistribution.rows[0].user_materials}, Global Materials: ${dataDistribution.rows[0].global_materials}`,
      details: dataDistribution.rows[0]
    });

  } catch (error: any) {
    results.push({
      name: 'Verification Error',
      passed: false,
      message: error.message,
      details: error
    });
  }

  return results;
}

(async () => {
  console.log('\n🔍 Verifying User-Centric Migration...\n');
  
  const results = await verifyMigration();
  
  let passed = 0;
  let failed = 0;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);
    if (result.details && !result.passed) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
    console.log('');
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('\n🎉 All verifications passed! Migration is successful.\n');
    await pool.end();
    process.exit(0);
  } else {
    console.log('\n⚠️  Some verifications failed. Please review the details above.\n');
    await pool.end();
    process.exit(1);
  }
})();
