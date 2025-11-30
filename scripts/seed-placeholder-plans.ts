#!/usr/bin/env tsx
/**
 * Seed Placeholder Subscription Plans
 * Creates test subscription plans that don't require Stripe payment
 * These can be used for development and testing before configuring real Stripe integration
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const placeholderPlans = [
  // TRADES PLANS
  {
    plan_key: 'trades_t1_monthly',
    name: 'Trades Starter',
    industry: 'trades',
    tier: 't1',
    price_monthly: 49.00,
    price_yearly: 490.00,
    stripe_price_id_monthly: 'placeholder_monthly_trades_t1',
    stripe_price_id_yearly: 'placeholder_yearly_trades_t1',
    features: {
      ai_enhancements: ['add_pool', 'add_decoration', 'blend_materials'],
      max_photos_per_month: 50,
      max_jobs_per_month: 10,
      materials_access: false,
      support_level: 'email'
    },
    display_order: 1
  },
  {
    plan_key: 'trades_t1_yearly',
    name: 'Trades Starter (Yearly)',
    industry: 'trades',
    tier: 't1',
    price_monthly: null,
    price_yearly: 490.00,
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: 'placeholder_yearly_trades_t1',
    features: {
      ai_enhancements: ['add_pool', 'add_decoration', 'blend_materials'],
      max_photos_per_month: 50,
      max_jobs_per_month: 10,
      materials_access: false,
      support_level: 'email'
    },
    display_order: 1
  },
  {
    plan_key: 'trades_t2_monthly',
    name: 'Trades Professional',
    industry: 'trades',
    tier: 't2',
    price_monthly: 129.00,
    price_yearly: 1290.00,
    stripe_price_id_monthly: 'placeholder_monthly_trades_t2',
    stripe_price_id_yearly: 'placeholder_yearly_trades_t2',
    features: {
      ai_enhancements: ['add_pool', 'add_decoration', 'blend_materials'],
      max_photos_per_month: 200,
      max_jobs_per_month: 50,
      materials_access: true,
      support_level: 'priority'
    },
    display_order: 2
  },
  {
    plan_key: 'trades_t2_yearly',
    name: 'Trades Professional (Yearly)',
    industry: 'trades',
    tier: 't2',
    price_monthly: null,
    price_yearly: 1290.00,
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: 'placeholder_yearly_trades_t2',
    features: {
      ai_enhancements: ['add_pool', 'add_decoration', 'blend_materials'],
      max_photos_per_month: 200,
      max_jobs_per_month: 50,
      materials_access: true,
      support_level: 'priority'
    },
    display_order: 2
  },
  {
    plan_key: 'trades_t3_monthly',
    name: 'Trades Enterprise',
    industry: 'trades',
    tier: 't3',
    price_monthly: 249.00,
    price_yearly: 2490.00,
    stripe_price_id_monthly: 'placeholder_monthly_trades_t3',
    stripe_price_id_yearly: 'placeholder_yearly_trades_t3',
    features: {
      ai_enhancements: ['add_pool', 'add_decoration', 'blend_materials'],
      max_photos_per_month: -1, // Unlimited
      max_jobs_per_month: -1, // Unlimited
      materials_access: true,
      support_level: 'dedicated'
    },
    display_order: 3
  },
  {
    plan_key: 'trades_t3_yearly',
    name: 'Trades Enterprise (Yearly)',
    industry: 'trades',
    tier: 't3',
    price_monthly: null,
    price_yearly: 2490.00,
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: 'placeholder_yearly_trades_t3',
    features: {
      ai_enhancements: ['add_pool', 'add_decoration', 'blend_materials'],
      max_photos_per_month: -1, // Unlimited
      max_jobs_per_month: -1, // Unlimited
      materials_access: true,
      support_level: 'dedicated'
    },
    display_order: 3
  },
  
  // REAL ESTATE PLANS
  {
    plan_key: 'real_estate_t1_monthly',
    name: 'Real Estate Starter',
    industry: 'real_estate',
    tier: 't1',
    price_monthly: 49.99,
    price_yearly: 499.99,
    stripe_price_id_monthly: 'placeholder_monthly_real_estate_t1',
    stripe_price_id_yearly: 'placeholder_yearly_real_estate_t1',
    features: {
      ai_enhancements: ['image_enhancement', 'day_to_dusk'],
      max_photos_per_month: 100,
      max_jobs_per_month: 25,
      materials_access: false,
      support_level: 'email'
    },
    display_order: 1
  },
  {
    plan_key: 'real_estate_t1_yearly',
    name: 'Real Estate Starter (Yearly)',
    industry: 'real_estate',
    tier: 't1',
    price_monthly: null,
    price_yearly: 499.99,
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: 'placeholder_yearly_real_estate_t1',
    features: {
      ai_enhancements: ['image_enhancement', 'day_to_dusk'],
      max_photos_per_month: 100,
      max_jobs_per_month: 25,
      materials_access: false,
      support_level: 'email'
    },
    display_order: 1
  },
  {
    plan_key: 'real_estate_t2_monthly',
    name: 'Real Estate Professional',
    industry: 'real_estate',
    tier: 't2',
    price_monthly: 129.99,
    price_yearly: 1299.99,
    stripe_price_id_monthly: 'placeholder_monthly_real_estate_t2',
    stripe_price_id_yearly: 'placeholder_yearly_real_estate_t2',
    features: {
      ai_enhancements: ['image_enhancement', 'day_to_dusk', 'stage_room'],
      max_photos_per_month: 500,
      max_jobs_per_month: 150,
      materials_access: false,
      support_level: 'priority'
    },
    display_order: 2
  },
  {
    plan_key: 'real_estate_t2_yearly',
    name: 'Real Estate Professional (Yearly)',
    industry: 'real_estate',
    tier: 't2',
    price_monthly: null,
    price_yearly: 1299.99,
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: 'placeholder_yearly_real_estate_t2',
    features: {
      ai_enhancements: ['image_enhancement', 'day_to_dusk', 'stage_room'],
      max_photos_per_month: 500,
      max_jobs_per_month: 150,
      materials_access: false,
      support_level: 'priority'
    },
    display_order: 2
  },
  {
    plan_key: 'real_estate_t3_monthly',
    name: 'Real Estate Enterprise',
    industry: 'real_estate',
    tier: 't3',
    price_monthly: 299.99,
    price_yearly: 2999.99,
    stripe_price_id_monthly: 'placeholder_monthly_real_estate_t3',
    stripe_price_id_yearly: 'placeholder_yearly_real_estate_t3',
    features: {
      ai_enhancements: ['image_enhancement', 'day_to_dusk', 'stage_room', 'item_removal'],
      max_photos_per_month: -1, // Unlimited
      max_jobs_per_month: -1, // Unlimited
      materials_access: true, // T3 real estate gets materials
      support_level: 'dedicated'
    },
    display_order: 3
  },
  {
    plan_key: 'real_estate_t3_yearly',
    name: 'Real Estate Enterprise (Yearly)',
    industry: 'real_estate',
    tier: 't3',
    price_monthly: null,
    price_yearly: 2999.99,
    stripe_price_id_monthly: null,
    stripe_price_id_yearly: 'placeholder_yearly_real_estate_t3',
    features: {
      ai_enhancements: ['image_enhancement', 'day_to_dusk', 'stage_room', 'item_removal'],
      max_photos_per_month: -1, // Unlimited
      max_jobs_per_month: -1, // Unlimited
      materials_access: true, // T3 real estate gets materials
      support_level: 'dedicated'
    },
    display_order: 3
  }
];

async function seedPlans() {
  try {
    console.log('\n🌱 Seeding placeholder subscription plans...\n');

    for (const plan of placeholderPlans) {
      // Check if plan already exists
      const existing = await pool.query(
        'SELECT id FROM subscription_plans WHERE plan_key = $1',
        [plan.plan_key]
      );

      if (existing.rows.length > 0) {
        // Update existing plan
        await pool.query(
          `UPDATE subscription_plans 
           SET name = $1, 
               industry = $2, 
               tier = $3,
               price_monthly = $4,
               price_yearly = $5,
               stripe_price_id_monthly = $6,
               stripe_price_id_yearly = $7,
               features = $8,
               display_order = $9,
               updated_at = NOW()
           WHERE plan_key = $10`,
          [
            plan.name,
            plan.industry,
            plan.tier,
            plan.price_monthly,
            plan.price_yearly,
            plan.stripe_price_id_monthly,
            plan.stripe_price_id_yearly,
            JSON.stringify(plan.features),
            plan.display_order,
            plan.plan_key
          ]
        );
        console.log(`✅ Updated plan: ${plan.plan_key}`);
      } else {
        // Insert new plan
        await pool.query(
          `INSERT INTO subscription_plans 
           (plan_key, name, industry, tier, price_monthly, price_yearly, 
            stripe_price_id_monthly, stripe_price_id_yearly, features, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            plan.plan_key,
            plan.name,
            plan.industry,
            plan.tier,
            plan.price_monthly,
            plan.price_yearly,
            plan.stripe_price_id_monthly,
            plan.stripe_price_id_yearly,
            JSON.stringify(plan.features),
            plan.display_order
          ]
        );
        console.log(`✅ Created plan: ${plan.plan_key}`);
      }
    }

    // Show summary
    const summary = await pool.query(`
      SELECT industry, tier, COUNT(*) as count
      FROM subscription_plans
      WHERE is_active = true
      GROUP BY industry, tier
      ORDER BY industry, tier
    `);

    console.log('\n📊 Summary:');
    summary.rows.forEach(row => {
      console.log(`   ${row.industry} ${row.tier}: ${row.count} plans`);
    });

    console.log('\n✅ Placeholder plans seeded successfully!\n');
    console.log('💡 Note: These plans use placeholder Stripe IDs.');
    console.log('   They will work in test mode without actual Stripe integration.\n');

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error seeding plans:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

seedPlans();
