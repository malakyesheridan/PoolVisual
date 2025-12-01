-- Migration 031: Update Stripe Price IDs with correct values from Stripe dashboard
-- This includes both monthly and yearly price IDs

-- Update EasyFlow Solo plan
UPDATE subscription_plans
SET 
  stripe_price_id_monthly = 'price_1SZRhzEdvdAX5C3kg43xSFBd',
  stripe_price_id_yearly = 'price_1SZTjjEdvdAX5C3k1pZ1sEuz',
  price_yearly = 1490.00, -- $1490/year (equivalent to $124.17/month)
  updated_at = NOW()
WHERE plan_key = 'easyflow_solo';

-- Update EasyFlow Pro plan
UPDATE subscription_plans
SET 
  stripe_price_id_monthly = 'price_1SZRIGEdvdAX5C3ketcnQIeO',
  stripe_price_id_yearly = 'price_1SZTk7EdvdAX5C3kzS23TQES',
  price_yearly = 2999.00, -- $2999/year (equivalent to $249.92/month)
  updated_at = NOW()
WHERE plan_key = 'easyflow_pro';

-- Update EasyFlow Business plan
UPDATE subscription_plans
SET 
  stripe_price_id_monthly = 'price_1SZRiaEdvdAX5C3kEekpnwAR',
  stripe_price_id_yearly = 'price_1SZTI8EdvdAX5C3kPun5h2kj',
  price_yearly = 9995.00, -- $9995/year (equivalent to $832.92/month)
  updated_at = NOW()
WHERE plan_key = 'easyflow_business';
