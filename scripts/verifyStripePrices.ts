import Stripe from 'stripe';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env') });

async function verifyPrices() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    console.error('❌ ERROR: STRIPE_SECRET_KEY not found in environment');
    process.exit(1);
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia',
  });

  const priceIds = [
    'price_1SZRhzEdvdAX5C3kg43xSFBd', // Solo monthly
    'price_1SZRiGEdvdAX5C3ketcnQIeO', // Pro monthly
    'price_1SZRiaEdvdAX5C3kEekpnwAR', // Business monthly
    'price_1SZTjjEdvdAX5C3k1pZ1sEuz', // Solo yearly
    'price_1SZTk7EdvdAX5C3kzS23TQES', // Pro yearly
    'price_1SZTl8EdvdAX5C3kPun5h2kj', // Business yearly
  ];

  console.log('🔍 Verifying Stripe Price IDs...\n');
  console.log(`Using API Key: ${secretKey.substring(0, 12)}...${secretKey.substring(secretKey.length - 4)}\n`);

  for (const priceId of priceIds) {
    try {
      const price = await stripe.prices.retrieve(priceId);
      console.log(`✅ ${priceId}`);
      console.log(`   Product: ${price.product} | Amount: ${price.unit_amount ? (price.unit_amount / 100).toFixed(2) : 'N/A'} ${price.currency?.toUpperCase()} | Active: ${price.active}`);
    } catch (error: any) {
      console.log(`❌ ${priceId}`);
      console.log(`   Error: ${error.message}`);
      if (error.code === 'resource_missing') {
        console.log(`   ⚠️  This price ID does not exist in your Stripe account!`);
      }
    }
    console.log('');
  }

  process.exit(0);
}

verifyPrices().catch((error) => {
  console.error('❌ Verification failed:', error.message);
  process.exit(1);
});
