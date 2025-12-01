# Stripe Configuration Guide

This document outlines the Stripe configuration required for the EasyFlow Credit & Subscription System.

## Required Environment Variables

Add these to your `.env` file:

```bash
# Stripe Secret Key (from Stripe Dashboard > Developers > API keys)
STRIPE_SECRET_KEY=sk_test_...  # or sk_live_... for production

# Stripe Public Key (for frontend if needed)
VITE_STRIPE_PUBLIC_KEY=pk_test_...  # or pk_live_... for production

# Subscription Webhook Secret (from /api/subscription/webhook endpoint)
STRIPE_WEBHOOK_SECRET=whsec_...

# Top-Up Webhook Secret (from /api/credits/topup/webhook endpoint)
STRIPE_WEBHOOK_SECRET_TOPUP=whsec_...
```

## Configured Price IDs

### Credit Top-Ups (One-time purchases)
- **300 Credits** - `price_1SZRjuEdvdAX5C3kF5PzjpMb` - $199.00 AUD
  - Product ID: `prod_TWUj0L0LbCseYc`
- **100 Credits** - `price_1SZRjYEdvdAX5C3kmNRNfHPi` - $75.00 AUD (Most Popular)
  - Product ID: `prod_TWUjIWUJ5I1uCY`
- **25 Credits** - `price_1SZRjEEdvdAX5C3kdERuir64` - $25.00 AUD
  - Product ID: `prod_TWUiiGAGwSb03w`

### Subscription Plans

#### Monthly Plans
- **Business Plan** - `price_1SZRiaEdvdAX5C3kEekpnwAR` - $995.00 AUD/month
  - Product ID: `prod_TWUhmEZK3biO3P`
  - Monthly Credits: 1700
  
- **Pro Plan** - `price_1SZRIGEdvdAX5C3ketcnQIeO` - $299.00 AUD/month
  - Product ID: `prod_TWUhgM8JYrdA9y`
  - Monthly Credits: 500
  
- **Solo Plan** - `price_1SZRhzEdvdAX5C3kg43xSFBd` - $149.00 AUD/month
  - Product ID: `prod_TWUha7Rt7ef4Br`
  - Monthly Credits: 250

#### Yearly Plans
- **Business Plan (Yearly)** - `price_1SZTI8EdvdAX5C3kPun5h2kj` - $9,995.00 AUD/year
  - Product ID: `prod_TWWoG67txbpdNL`
  - Monthly Credits: 1700
  
- **Pro Plan (Yearly)** - `price_1SZTk7EdvdAX5C3kzS23TQES` - $2,999.00 AUD/year
  - Product ID: `prod_TWWnUH3BQx71YL`
  - Monthly Credits: 500
  
- **Solo Plan (Yearly)** - `price_1SZTjjEdvdAX5C3k1pZ1sEuz` - $1,490.00 AUD/year
  - Product ID: `prod_TWWnwF0MnDHgyS`
  - Monthly Credits: 250

## Webhook Configuration

Configure the following webhook endpoints in Stripe Dashboard:

1. **Subscription Webhook**: `https://your-domain.com/api/subscription/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`

2. **Credit Top-Up Webhook**: `https://your-domain.com/api/credits/topup/webhook`
   - Events: `checkout.session.completed` (for payment mode)

## Testing

For testing, use Stripe test mode:
- Use test API keys (sk_test_...)
- Use test price IDs (if different from production)
- Use Stripe test cards: https://stripe.com/docs/testing

## Verification

After configuration, verify:
1. Environment variables are loaded: Check server logs for Stripe initialization
2. Webhook endpoints are accessible and return 200 OK
3. Test a credit purchase to ensure checkout works
4. Test a subscription to ensure monthly credits are allocated
