# Stripe Configuration Guide

This document outlines the Stripe configuration required for the EasyFlow Credit & Subscription System.

## Required Environment Variables

Add these to your `.env` file:

```bash
# Stripe Secret Key (from Stripe Dashboard > Developers > API keys)
STRIPE_SECRET_KEY=sk_live_...  # or sk_test_... for testing

# Stripe Webhook Secret (from Stripe Dashboard > Developers > Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Stripe Public Key (for frontend if needed)
VITE_STRIPE_PUBLIC_KEY=pk_live_...  # or pk_test_... for testing
```

## Configured Price IDs

### Credit Top-Ups (One-time purchases)
- **300 Credits** - `price_1SZEzDldjngDSU327RDMd5zR` - $199.00 AUD
- **100 Credits** - `price_1SZEyZIdjngDSU32vRaAQVnr` - $75.00 AUD (Most Popular)
- **25 Credits** - `price_1SZEy4ldjngDSU32bqsKASsp` - $25.00 AUD

### Subscription Plans (Monthly recurring)
- **Business Plan** - `price_1SZEWWIdjngDSU32r6dTKkUw` - $995.00 AUD/month
  - Product ID: `prod_TWHVnh2JLmnL4v`
  - Monthly Credits: 1700
  
- **Pro Plan** - `price_1SZEvMldjngDSU32RI4i4XRH` - $299.00 AUD/month
  - Product ID: `prod_TWHUq6G3UulAdY`
  - Monthly Credits: 500
  
- **Solo Plan** - `price_1SZEuUIdjngDSU32y8uKNbVn` - $149.00 AUD/month
  - Product ID: `prod_TWHTdDZapUAjGA`
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
