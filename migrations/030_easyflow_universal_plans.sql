-- Migration 030: Create EasyFlow Universal Subscription Plans
-- Creates the three universal plans (Solo, Pro, Business) that work for all industries

-- Insert or update EasyFlow Solo plan
INSERT INTO subscription_plans (
  plan_key,
  name,
  industry,
  tier,
  price_monthly,
  price_yearly,
  stripe_price_id_monthly,
  stripe_price_id_yearly,
  features,
  is_active,
  display_order
) VALUES (
  'easyflow_solo',
  'EasyFlow Studio Solo',
  'trades', -- Industry field required but plans are universal
  't1',
  149.00,
  119.20, -- 20% off: 149 * 0.8 = 119.2
  'price_1SZRhzEdvdAX5C3kg43xSFBd',
  NULL, -- Yearly price ID to be added later
  '{"materials": true, "quotes": true, "enhancements": ["add_pool", "custom"], "bulkOperations": false, "apiAccess": false}'::jsonb,
  true,
  1
)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Insert or update EasyFlow Pro plan
INSERT INTO subscription_plans (
  plan_key,
  name,
  industry,
  tier,
  price_monthly,
  price_yearly,
  stripe_price_id_monthly,
  stripe_price_id_yearly,
  features,
  is_active,
  display_order
) VALUES (
  'easyflow_pro',
  'EasyFlow Studio Pro',
  'trades', -- Industry field required but plans are universal
  't2',
  299.00,
  239.20, -- 20% off: 299 * 0.8 = 239.2
  'price_1SZRIGEdvdAX5C3ketcnQIeO',
  NULL, -- Yearly price ID to be added later
  '{"materials": true, "quotes": true, "enhancements": ["add_pool", "custom", "brush_tool", "masked_prompts", "preset_library", "slideshow"], "bulkOperations": true, "apiAccess": false}'::jsonb,
  true,
  2
)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Insert or update EasyFlow Business plan
INSERT INTO subscription_plans (
  plan_key,
  name,
  industry,
  tier,
  price_monthly,
  price_yearly,
  stripe_price_id_monthly,
  stripe_price_id_yearly,
  features,
  is_active,
  display_order
) VALUES (
  'easyflow_business',
  'EasyFlow Studio Business',
  'trades', -- Industry field required but plans are universal
  't3',
  995.00,
  796.00, -- 20% off: 995 * 0.8 = 796
  'price_1SZRiaEdvdAX5C3kEekpnwAR',
  NULL, -- Yearly price ID to be added later
  '{"materials": true, "quotes": true, "enhancements": ["add_pool", "custom", "brush_tool", "masked_prompts", "preset_library", "slideshow", "white_label"], "bulkOperations": true, "apiAccess": true, "priorityQueue": true}'::jsonb,
  true,
  3
)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();
