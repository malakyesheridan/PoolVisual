import { Pool } from 'pg';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env') });

async function updatePrice() {
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
    console.log('🔄 Updating Business yearly price ID...\n');
    
    const result = await pool.query(`
      UPDATE subscription_plans
      SET 
        stripe_price_id_yearly = 'price_1SZTl8EdvdAX5C3kPun5h2kj',
        updated_at = NOW()
      WHERE plan_key = 'easyflow_business'
      RETURNING name, stripe_price_id_yearly;
    `);
    
    if (result.rows.length === 0) {
      console.log('   ⚠️  Plan easyflow_business not found in database');
    } else {
      const plan = result.rows[0];
      console.log(`   ✅ Updated ${plan.name}`);
      console.log(`      Yearly Price ID: ${plan.stripe_price_id_yearly}`);
    }
    
    console.log('\n✅ Update completed successfully!\n');
    
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error updating price ID:', error.message);
    await pool.end();
    process.exit(1);
  }
}

updatePrice();
