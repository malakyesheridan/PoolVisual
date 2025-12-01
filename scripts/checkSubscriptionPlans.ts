import { Pool } from 'pg';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env') });

async function checkPlans() {
  const cs = process.env.DATABASE_URL;
  
  if (!cs) {
    console.error('❌ ERROR: No DATABASE_URL found in environment');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('🔍 Checking subscription plans in database...\n');
    
    const result = await pool.query(`
      SELECT 
        plan_key,
        name,
        price_monthly,
        price_yearly,
        stripe_price_id_monthly,
        stripe_price_id_yearly,
        is_active
      FROM subscription_plans
      WHERE plan_key IN ('easyflow_solo', 'easyflow_pro', 'easyflow_business')
      ORDER BY display_order;
    `);

    if (result.rows.length === 0) {
      console.log('❌ No plans found in database');
      await pool.end();
      process.exit(1);
    }

    console.log('📊 Current Subscription Plans in Database:\n');
    console.log('─'.repeat(80));
    
    for (const plan of result.rows) {
      console.log(`\n📦 Plan: ${plan.name} (${plan.plan_key})`);
      console.log(`   Monthly Price: $${plan.price_monthly}`);
      console.log(`   Yearly Price: ${plan.price_yearly ? `$${plan.price_yearly}` : 'Not set'}`);
      console.log(`   Monthly Stripe Price ID: ${plan.stripe_price_id_monthly || 'NOT SET'}`);
      console.log(`   Yearly Stripe Price ID: ${plan.stripe_price_id_yearly || 'NOT SET'}`);
      console.log(`   Active: ${plan.is_active ? '✅' : '❌'}`);
    }
    
    console.log('\n' + '─'.repeat(80));
    console.log('\n💡 If any price IDs are incorrect, provide the correct ones and I will update them.\n');
    
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error checking plans:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkPlans();
