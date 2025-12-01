import Stripe from 'stripe';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(process.cwd(), '.env') });

async function listPrices() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey) {
    console.error('❌ ERROR: STRIPE_SECRET_KEY not found in environment');
    process.exit(1);
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia',
  });

  try {
    console.log('🔍 Listing all prices in your Stripe account...\n');
    console.log(`Using API Key: ${secretKey.substring(0, 12)}...${secretKey.substring(secretKey.length - 4)}`);
    console.log(`Mode: ${secretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'}\n`);

    const prices = await stripe.prices.list({ limit: 100, active: true });
    
    console.log(`Found ${prices.data.length} active prices:\n`);
    console.log('─'.repeat(100));
    
    for (const price of prices.data) {
      const product = await stripe.products.retrieve(price.product as string);
      const amount = price.unit_amount ? (price.unit_amount / 100).toFixed(2) : 'N/A';
      const interval = price.recurring?.interval || 'one-time';
      
      console.log(`\n📦 ${product.name}`);
      console.log(`   Price ID: ${price.id}`);
      console.log(`   Product ID: ${product.id}`);
      console.log(`   Amount: $${amount} ${price.currency?.toUpperCase()}`);
      console.log(`   Interval: ${interval}`);
      console.log(`   Active: ${price.active ? '✅' : '❌'}`);
    }
    
    console.log('\n' + '─'.repeat(100));
    console.log('\n💡 Compare these Price IDs with what you have in the database.\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error listing prices:', error.message);
    process.exit(1);
  }
}

listPrices();
