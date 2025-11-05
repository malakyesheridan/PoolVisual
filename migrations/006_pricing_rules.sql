-- Migration 006: Advanced Pricing System
-- Adds advanced pricing rules and bulk discounts to existing quote system

-- Create pricing rules table
CREATE TABLE pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES orgs(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('bulk_discount', 'material_markup', 'labor_multiplier', 'area_threshold', 'seasonal', 'custom')),
  conditions_json JSONB NOT NULL,
  actions_json JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES users(id)
);

-- Create pricing rule applications table (for audit trail)
CREATE TABLE pricing_rule_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES pricing_rules(id) NOT NULL,
  quote_id UUID REFERENCES quotes(id) NOT NULL,
  quote_item_id UUID REFERENCES quote_items(id),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  original_amount DECIMAL(10,2),
  adjusted_amount DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  application_data JSONB
);

-- Add indexes for performance
CREATE INDEX idx_pricing_rules_org_id ON pricing_rules(org_id);
CREATE INDEX idx_pricing_rules_type ON pricing_rules(rule_type);
CREATE INDEX idx_pricing_rules_active ON pricing_rules(is_active);
CREATE INDEX idx_pricing_rules_priority ON pricing_rules(priority);
CREATE INDEX idx_pricing_rule_applications_rule_id ON pricing_rule_applications(rule_id);
CREATE INDEX idx_pricing_rule_applications_quote_id ON pricing_rule_applications(quote_id);

-- Add comments for documentation
COMMENT ON TABLE pricing_rules IS 'Advanced pricing rules for quotes and materials';
COMMENT ON COLUMN pricing_rules.rule_type IS 'Type of pricing rule (bulk_discount, material_markup, etc.)';
COMMENT ON COLUMN pricing_rules.conditions_json IS 'JSON conditions for when rule applies';
COMMENT ON COLUMN pricing_rules.actions_json IS 'JSON actions to apply when conditions are met';
COMMENT ON COLUMN pricing_rules.priority IS 'Rule priority (higher number = higher priority)';

-- Create function to apply pricing rules
CREATE OR REPLACE FUNCTION apply_pricing_rules(
  p_quote_id UUID,
  p_org_id UUID
)
RETURNS TABLE(
  rule_id UUID,
  quote_item_id UUID,
  original_amount DECIMAL(10,2),
  adjusted_amount DECIMAL(10,2),
  discount_amount DECIMAL(10,2)
) AS $$
DECLARE
  rule_record RECORD;
  item_record RECORD;
  conditions_met BOOLEAN;
  adjusted_amount DECIMAL(10,2);
  discount_amount DECIMAL(10,2);
BEGIN
  -- Get all active pricing rules for the organization, ordered by priority
  FOR rule_record IN 
    SELECT * FROM pricing_rules 
    WHERE org_id = p_org_id 
    AND is_active = TRUE 
    ORDER BY priority DESC, created_at ASC
  LOOP
    -- Get quote items for this quote
    FOR item_record IN 
      SELECT qi.*, m.price as material_price, lr.rate as labor_rate
      FROM quote_items qi
      LEFT JOIN materials m ON qi.material_id = m.id
      LEFT JOIN labor_rules lr ON qi.labor_rule_id = lr.id
      WHERE qi.quote_id = p_quote_id
    LOOP
      -- Check if conditions are met (simplified logic)
      conditions_met := check_pricing_conditions(
        rule_record.conditions_json,
        item_record,
        p_quote_id
      );
      
      IF conditions_met THEN
        -- Apply rule actions
        adjusted_amount := apply_pricing_actions(
          rule_record.actions_json,
          item_record,
          rule_record.rule_type
        );
        
        discount_amount := item_record.amount - adjusted_amount;
        
        -- Record the application
        INSERT INTO pricing_rule_applications (
          rule_id, quote_id, quote_item_id, 
          original_amount, adjusted_amount, discount_amount,
          application_data
        ) VALUES (
          rule_record.id, p_quote_id, item_record.id,
          item_record.amount, adjusted_amount, discount_amount,
          jsonb_build_object(
            'rule_name', rule_record.name,
            'rule_type', rule_record.rule_type,
            'applied_at', NOW()
          )
        );
        
        -- Return the result
        rule_id := rule_record.id;
        quote_item_id := item_record.id;
        original_amount := item_record.amount;
        adjusted_amount := adjusted_amount;
        discount_amount := discount_amount;
        
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to check pricing conditions
CREATE OR REPLACE FUNCTION check_pricing_conditions(
  conditions JSONB,
  item RECORD,
  quote_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  condition_key TEXT;
  condition_value TEXT;
  condition_met BOOLEAN := TRUE;
BEGIN
  -- Simplified condition checking
  -- In a real implementation, this would be more sophisticated
  
  -- Check minimum area condition
  IF conditions ? 'min_area' THEN
    IF item.area_m2 < (conditions->>'min_area')::DECIMAL THEN
      condition_met := FALSE;
    END IF;
  END IF;
  
  -- Check minimum quantity condition
  IF conditions ? 'min_quantity' THEN
    IF item.quantity < (conditions->>'min_quantity')::DECIMAL THEN
      condition_met := FALSE;
    END IF;
  END IF;
  
  -- Check material type condition
  IF conditions ? 'material_types' THEN
    IF NOT (conditions->'material_types' ? item.material_id::TEXT) THEN
      condition_met := FALSE;
    END IF;
  END IF;
  
  RETURN condition_met;
END;
$$ LANGUAGE plpgsql;

-- Create function to apply pricing actions
CREATE OR REPLACE FUNCTION apply_pricing_actions(
  actions JSONB,
  item RECORD,
  rule_type TEXT
) RETURNS DECIMAL(10,2) AS $$
DECLARE
  adjusted_amount DECIMAL(10,2);
  discount_percentage DECIMAL(5,2);
  markup_percentage DECIMAL(5,2);
BEGIN
  adjusted_amount := item.amount;
  
  CASE rule_type
    WHEN 'bulk_discount' THEN
      -- Apply percentage discount
      discount_percentage := COALESCE((actions->>'discount_percentage')::DECIMAL, 0);
      adjusted_amount := item.amount * (1 - discount_percentage / 100);
      
    WHEN 'material_markup' THEN
      -- Apply markup to material cost
      markup_percentage := COALESCE((actions->>'markup_percentage')::DECIMAL, 0);
      IF item.material_price IS NOT NULL THEN
        adjusted_amount := item.material_price * (1 + markup_percentage / 100) * item.quantity;
      END IF;
      
    WHEN 'labor_multiplier' THEN
      -- Apply multiplier to labor cost
      IF item.labor_rate IS NOT NULL THEN
        adjusted_amount := item.labor_rate * COALESCE((actions->>'multiplier')::DECIMAL, 1) * item.quantity;
      END IF;
      
    WHEN 'area_threshold' THEN
      -- Apply discount based on area thresholds
      discount_percentage := COALESCE((actions->>'discount_percentage')::DECIMAL, 0);
      adjusted_amount := item.amount * (1 - discount_percentage / 100);
      
    ELSE
      -- Custom rule - return original amount
      adjusted_amount := item.amount;
  END CASE;
  
  RETURN GREATEST(adjusted_amount, 0); -- Ensure non-negative
END;
$$ LANGUAGE plpgsql;

-- Create function to get pricing rule summary
CREATE OR REPLACE FUNCTION get_pricing_rule_summary(p_quote_id UUID)
RETURNS TABLE(
  total_discount DECIMAL(10,2),
  rules_applied INTEGER,
  savings_percentage DECIMAL(5,2)
) AS $$
DECLARE
  total_original DECIMAL(10,2) := 0;
  total_adjusted DECIMAL(10,2) := 0;
  rules_count INTEGER := 0;
BEGIN
  -- Calculate totals from pricing rule applications
  SELECT 
    COALESCE(SUM(original_amount), 0),
    COALESCE(SUM(adjusted_amount), 0),
    COUNT(DISTINCT rule_id)
  INTO total_original, total_adjusted, rules_count
  FROM pricing_rule_applications
  WHERE quote_id = p_quote_id;
  
  -- Return summary
  total_discount := total_original - total_adjusted;
  rules_applied := rules_count;
  savings_percentage := CASE 
    WHEN total_original > 0 THEN ((total_original - total_adjusted) / total_original) * 100
    ELSE 0
  END;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Insert some default pricing rules
INSERT INTO pricing_rules (org_id, name, description, rule_type, conditions_json, actions_json, priority, created_by)
SELECT 
  o.id,
  'Bulk Area Discount',
  '10% discount for areas over 50m²',
  'area_threshold',
  '{"min_area": 50}'::jsonb,
  '{"discount_percentage": 10}'::jsonb,
  100,
  (SELECT id FROM users WHERE org_id = o.id LIMIT 1)
FROM orgs o
WHERE NOT EXISTS (SELECT 1 FROM pricing_rules WHERE org_id = o.id);

INSERT INTO pricing_rules (org_id, name, description, rule_type, conditions_json, actions_json, priority, created_by)
SELECT 
  o.id,
  'Material Markup',
  '15% markup on premium materials',
  'material_markup',
  '{"material_types": ["premium"]}'::jsonb,
  '{"markup_percentage": 15}'::jsonb,
  50,
  (SELECT id FROM users WHERE org_id = o.id LIMIT 1)
FROM orgs o
WHERE NOT EXISTS (SELECT 1 FROM pricing_rules WHERE org_id = o.id AND rule_type = 'material_markup');

-- Add audit log entry for this migration
INSERT INTO audit_logs (org_id, user_id, action, entity, payload_json, created_at)
VALUES (
    NULL, -- System migration
    NULL, -- System migration
    'SCHEMA_MIGRATION',
    'pricing_rules',
    '{"migration": "006_pricing_rules", "description": "Added advanced pricing system"}'::jsonb,
    NOW()
);
