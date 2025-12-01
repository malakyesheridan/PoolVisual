-- Migration 031: Update Yearly Price IDs and Prices for Universal Plans
-- Updates the yearly Stripe price IDs and correct yearly prices

-- Update EasyFlow Solo plan with yearly price ID
UPDATE subscription_plans
SET 
  stripe_price_id_yearly = 'price_1SZTjjEdvdAX5C3k1pZ1sEuz',
  price_yearly = 1490.00, -- $1,490.00 AUD/year
  updated_at = NOW()
WHERE plan_key = 'easyflow_solo';

-- Update EasyFlow Pro plan with yearly price ID
UPDATE subscription_plans
SET 
  stripe_price_id_yearly = 'price_1SZTk7EdvdAX5C3kzS23TQES',
  price_yearly = 2999.00, -- $2,999.00 AUD/year
  updated_at = NOW()
WHERE plan_key = 'easyflow_pro';

-- Update EasyFlow Business plan with yearly price ID
UPDATE subscription_plans
SET 
  stripe_price_id_yearly = 'price_1SZTI8EdvdAX5C3kPun5h2kj',
  price_yearly = 9995.00, -- $9,995.00 AUD/year
  updated_at = NOW()
WHERE plan_key = 'easyflow_business';
