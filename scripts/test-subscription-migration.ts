#!/usr/bin/env tsx
// Test script to verify subscription system migration
import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    console.log('\n🧪 Testing Subscription System Migration...\n');

    // Test 1: Check subscription_plans table exists
    console.log('Test 1: Checking subscription_plans table...');
    const plansCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'subscription_plans'
    `);
    if (plansCheck.rows.length > 0) {
      console.log('✅ subscription_plans table exists');
    } else {
      console.log('❌ subscription_plans table not found');
      process.exit(1);
    }

    // Test 2: Check subscription_history table exists
    console.log('\nTest 2: Checking subscription_history table...');
    const historyCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'subscription_history'
    `);
    if (historyCheck.rows.length > 0) {
      console.log('✅ subscription_history table exists');
    } else {
      console.log('❌ subscription_history table not found');
      process.exit(1);
    }

    // Test 3: Check admin_industry_preferences table exists
    console.log('\nTest 3: Checking admin_industry_preferences table...');
    const adminCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'admin_industry_preferences'
    `);
    if (adminCheck.rows.length > 0) {
      console.log('✅ admin_industry_preferences table exists');
    } else {
      console.log('❌ admin_industry_preferences table not found');
      process.exit(1);
    }

    // Test 4: Check orgs table has new columns
    console.log('\nTest 4: Checking orgs table columns...');
    const orgsColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orgs' 
      AND column_name IN (
        'subscription_plan_id', 
        'subscription_status', 
        'subscription_tier',
        'stripe_customer_id',
        'stripe_subscription_id',
        'industry_locked'
      )
    `);
    const expectedColumns = 6;
    if (orgsColumns.rows.length === expectedColumns) {
      console.log(`✅ All ${expectedColumns} new orgs columns exist`);
      orgsColumns.rows.forEach(row => console.log(`   - ${row.column_name}`));
    } else {
      console.log(`❌ Expected ${expectedColumns} columns, found ${orgsColumns.rows.length}`);
      process.exit(1);
    }

    // Test 5: Check RLS functions exist
    console.log('\nTest 5: Checking RLS helper functions...');
    const functionsCheck = await pool.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN (
        'set_user_context',
        'get_current_user_id',
        'system_get_masks_by_photo'
      )
    `);
    if (functionsCheck.rows.length >= 3) {
      console.log('✅ RLS helper functions exist');
      functionsCheck.rows.forEach(row => console.log(`   - ${row.proname}`));
    } else {
      console.log(`❌ Expected 3 functions, found ${functionsCheck.rows.length}`);
      process.exit(1);
    }

    // Test 6: Check function overloads exist
    console.log('\nTest 6: Checking function overloads...');
    const overloadsCheck = await pool.query(`
      SELECT proname, pg_get_function_identity_arguments(oid) as args
      FROM pg_proc 
      WHERE proname IN (
        'get_user_org_ids',
        'is_user_member_of_org',
        'get_user_org_role',
        'is_admin_user'
      )
      ORDER BY proname, args
    `);
    if (overloadsCheck.rows.length >= 8) {
      console.log('✅ Function overloads exist');
      const grouped = overloadsCheck.rows.reduce((acc: any, row: any) => {
        if (!acc[row.proname]) acc[row.proname] = [];
        acc[row.proname].push(row.args);
        return acc;
      }, {});
      Object.entries(grouped).forEach(([name, args]: [string, any]) => {
        console.log(`   - ${name}(${args.join('), ')})`);
      });
    } else {
      console.log(`❌ Expected at least 8 function overloads, found ${overloadsCheck.rows.length}`);
      process.exit(1);
    }

    console.log('\n✅ All migration tests passed!\n');
    await pool.end();
    process.exit(0);
  } catch (e: any) {
    console.error('❌ Test failed:', e.message);
    console.error(e);
    await pool.end();
    process.exit(1);
  }
})();
