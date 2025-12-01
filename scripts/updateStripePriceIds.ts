import { Pool } from 'pg';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env') });

interface PriceIdUpdate {
  planKey: string;
  monthlyPriceId: string;
  yearlyPriceId?: string;
}

async function updatePriceIds(updates: PriceIdUpdate[]) {
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
    console.log('🔄 Updating Stripe Price IDs in database...\n');
    
    for (const update of updates) {
      console.log(`📝 Updating ${update.planKey}...`);
      
      const updateQuery = update.yearlyPriceId 
        ? `
          UPDATE subscription_plans
          SET 
            stripe_price_id_monthly = $1,
            stripe_price_id_yearly = $2,
            updated_at = NOW()
          WHERE plan_key = $3
          RETURNING name, stripe_price_id_monthly, stripe_price_id_yearly;
        `
        : `
          UPDATE subscription_plans
          SET 
            stripe_price_id_monthly = $1,
            updated_at = NOW()
          WHERE plan_key = $2
          RETURNING name, stripe_price_id_monthly, stripe_price_id_yearly;
        `;
      
      const params = update.yearlyPriceId
        ? [update.monthlyPriceId, update.yearlyPriceId, update.planKey]
        : [update.monthlyPriceId, update.planKey];
      
      const result = await pool.query(updateQuery, params);
      
      if (result.rows.length === 0) {
        console.log(`   ⚠️  Plan ${update.planKey} not found in database`);
      } else {
        const plan = result.rows[0];
        console.log(`   ✅ Updated ${plan.name}`);
        console.log(`      Monthly: ${plan.stripe_price_id_monthly}`);
        console.log(`      Yearly: ${plan.stripe_price_id_yearly || 'Not set'}`);
      }
    }
    
    console.log('\n✅ All price IDs updated successfully!\n');
    
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error updating price IDs:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Get updates from command line arguments or use defaults
// Usage: npx tsx updateStripePriceIds.ts solo=NEW_ID pro=NEW_ID business=NEW_ID
const args = process.argv.slice(2);
const updates: PriceIdUpdate[] = [];

if (args.length > 0) {
  // Parse command line arguments
  for (const arg of args) {
    const [planKey, priceId] = arg.split('=');
    if (planKey && priceId) {
      updates.push({
        planKey: `easyflow_${planKey}`,
        monthlyPriceId: priceId,
      });
    }
  }
} else {
  // Default: update all with placeholders (user should provide actual IDs)
  console.log('⚠️  No price IDs provided. Please provide them as arguments:');
  console.log('   npx tsx updateStripePriceIds.ts solo=PRICE_ID pro=PRICE_ID business=PRICE_ID\n');
  console.log('Or edit this script to add the correct price IDs.\n');
  process.exit(1);
}

updatePriceIds(updates);
