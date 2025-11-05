/**
 * Advanced Pricing Rules Service
 * 
 * Builds upon existing quote system to provide advanced pricing rules
 * Integrates with existing quote calculation without modifying existing code
 */

import { storage } from '../storage.js';
import { logger } from './logger.js';

export interface PricingRule {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  ruleType: 'bulk_discount' | 'material_markup' | 'labor_multiplier' | 'area_threshold' | 'seasonal' | 'custom';
  conditions: Record<string, any>;
  actions: Record<string, any>;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface PricingRuleApplication {
  id: string;
  ruleId: string;
  quoteId: string;
  quoteItemId?: string;
  appliedAt: Date;
  originalAmount: number;
  adjustedAmount: number;
  discountAmount: number;
  applicationData: Record<string, any>;
}

export interface PricingRuleResult {
  ruleId: string;
  quoteItemId?: string;
  originalAmount: number;
  adjustedAmount: number;
  discountAmount: number;
}

export interface PricingSummary {
  totalDiscount: number;
  rulesApplied: number;
  savingsPercentage: number;
  applications: PricingRuleApplication[];
}

export class PricingRulesService {
  /**
   * Create a new pricing rule
   * @param ruleData Pricing rule data
   * @returns Promise<PricingRule>
   */
  async createPricingRule(ruleData: Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<PricingRule> {
    try {
      // Validate rule data
      this.validatePricingRule(ruleData);

      // Create rule in database
      const rule = await this.createRuleInDatabase(ruleData);

      logger.info({
        msg: 'Pricing rule created',
        meta: {
          ruleId: rule.id,
          orgId: rule.orgId,
          ruleType: rule.ruleType,
          name: rule.name
        }
      });

      return rule;

    } catch (error) {
      logger.error({
        msg: 'Failed to create pricing rule',
        err: error,
        meta: { ruleData }
      });
      throw new Error(`Failed to create pricing rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pricing rules for an organization
   * @param orgId Organization ID
   * @param activeOnly Whether to return only active rules
   * @returns Promise<PricingRule[]>
   */
  async getPricingRules(orgId: string, activeOnly: boolean = true): Promise<PricingRule[]> {
    try {
      const rules = await this.getRulesFromDatabase(orgId, activeOnly);
      return rules;

    } catch (error) {
      logger.error({
        msg: 'Failed to get pricing rules',
        err: error,
        meta: { orgId, activeOnly }
      });
      throw new Error(`Failed to get pricing rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a pricing rule
   * @param ruleId Rule ID
   * @param updates Updates to apply
   * @returns Promise<PricingRule>
   */
  async updatePricingRule(ruleId: string, updates: Partial<PricingRule>): Promise<PricingRule> {
    try {
      // Validate updates
      if (updates.ruleType) {
        this.validateRuleType(updates.ruleType);
      }

      const updatedRule = await this.updateRuleInDatabase(ruleId, updates);

      logger.info({
        msg: 'Pricing rule updated',
        meta: {
          ruleId,
          updates: Object.keys(updates)
        }
      });

      return updatedRule;

    } catch (error) {
      logger.error({
        msg: 'Failed to update pricing rule',
        err: error,
        meta: { ruleId, updates }
      });
      throw new Error(`Failed to update pricing rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a pricing rule
   * @param ruleId Rule ID
   * @returns Promise<void>
   */
  async deletePricingRule(ruleId: string): Promise<void> {
    try {
      await this.deleteRuleFromDatabase(ruleId);

      logger.info({
        msg: 'Pricing rule deleted',
        meta: { ruleId }
      });

    } catch (error) {
      logger.error({
        msg: 'Failed to delete pricing rule',
        err: error,
        meta: { ruleId }
      });
      throw new Error(`Failed to delete pricing rule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply pricing rules to a quote
   * @param quoteId Quote ID
   * @param orgId Organization ID
   * @returns Promise<PricingRuleResult[]>
   */
  async applyPricingRules(quoteId: string, orgId: string): Promise<PricingRuleResult[]> {
    try {
      // Get active pricing rules for the organization
      const rules = await this.getPricingRules(orgId, true);
      
      // Get quote items
      const quoteItems = await this.getQuoteItems(quoteId);
      
      const results: PricingRuleResult[] = [];

      // Apply rules in priority order
      const sortedRules = rules.sort((a, b) => b.priority - a.priority);

      for (const rule of sortedRules) {
        for (const item of quoteItems) {
          // Check if rule conditions are met
          if (this.checkRuleConditions(rule, item, quoteId)) {
            // Apply rule actions
            const result = this.applyRuleActions(rule, item);
            
            if (result.discountAmount > 0) {
              results.push(result);
              
              // Record the application
              await this.recordRuleApplication({
                ruleId: rule.id,
                quoteId,
                quoteItemId: item.id,
                originalAmount: item.amount,
                adjustedAmount: result.adjustedAmount,
                discountAmount: result.discountAmount,
                applicationData: {
                  ruleName: rule.name,
                  ruleType: rule.ruleType,
                  appliedAt: new Date()
                }
              });
            }
          }
        }
      }

      logger.info({
        msg: 'Pricing rules applied to quote',
        meta: {
          quoteId,
          orgId,
          rulesApplied: results.length,
          totalDiscount: results.reduce((sum, r) => sum + r.discountAmount, 0)
        }
      });

      return results;

    } catch (error) {
      logger.error({
        msg: 'Failed to apply pricing rules',
        err: error,
        meta: { quoteId, orgId }
      });
      throw new Error(`Failed to apply pricing rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get pricing summary for a quote
   * @param quoteId Quote ID
   * @returns Promise<PricingSummary>
   */
  async getPricingSummary(quoteId: string): Promise<PricingSummary> {
    try {
      const applications = await this.getRuleApplications(quoteId);
      
      const totalOriginal = applications.reduce((sum, app) => sum + app.originalAmount, 0);
      const totalAdjusted = applications.reduce((sum, app) => sum + app.adjustedAmount, 0);
      const totalDiscount = totalOriginal - totalAdjusted;
      const savingsPercentage = totalOriginal > 0 ? (totalDiscount / totalOriginal) * 100 : 0;
      const rulesApplied = new Set(applications.map(app => app.ruleId)).size;

      return {
        totalDiscount,
        rulesApplied,
        savingsPercentage,
        applications
      };

    } catch (error) {
      logger.error({
        msg: 'Failed to get pricing summary',
        err: error,
        meta: { quoteId }
      });
      throw new Error(`Failed to get pricing summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate pricing rule data
   * @param ruleData Rule data to validate
   */
  private validatePricingRule(ruleData: Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt'>): void {
    if (!ruleData.orgId) {
      throw new Error('Organization ID is required');
    }

    if (!ruleData.name || ruleData.name.trim().length === 0) {
      throw new Error('Rule name is required');
    }

    this.validateRuleType(ruleData.ruleType);

    if (!ruleData.conditions || typeof ruleData.conditions !== 'object') {
      throw new Error('Rule conditions are required');
    }

    if (!ruleData.actions || typeof ruleData.actions !== 'object') {
      throw new Error('Rule actions are required');
    }
  }

  /**
   * Validate rule type
   * @param ruleType Rule type to validate
   */
  private validateRuleType(ruleType: string): void {
    const validTypes = ['bulk_discount', 'material_markup', 'labor_multiplier', 'area_threshold', 'seasonal', 'custom'];
    if (!validTypes.includes(ruleType)) {
      throw new Error(`Invalid rule type: ${ruleType}`);
    }
  }

  /**
   * Check if rule conditions are met
   * @param rule Pricing rule
   * @param item Quote item
   * @param quoteId Quote ID
   * @returns boolean True if conditions are met
   */
  private checkRuleConditions(rule: PricingRule, item: any, quoteId: string): boolean {
    try {
      const conditions = rule.conditions;

      // Check minimum area condition
      if (conditions.minArea && item.areaM2 < conditions.minArea) {
        return false;
      }

      // Check minimum quantity condition
      if (conditions.minQuantity && item.quantity < conditions.minQuantity) {
        return false;
      }

      // Check material type condition
      if (conditions.materialTypes && Array.isArray(conditions.materialTypes)) {
        if (!conditions.materialTypes.includes(item.materialId)) {
          return false;
        }
      }

      // Check date range condition
      if (conditions.dateRange) {
        const now = new Date();
        const startDate = new Date(conditions.dateRange.start);
        const endDate = new Date(conditions.dateRange.end);
        
        if (now < startDate || now > endDate) {
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('[PricingRules] Error checking rule conditions:', error);
      return false;
    }
  }

  /**
   * Apply rule actions to quote item
   * @param rule Pricing rule
   * @param item Quote item
   * @returns PricingRuleResult
   */
  private applyRuleActions(rule: PricingRule, item: any): PricingRuleResult {
    try {
      const actions = rule.actions;
      let adjustedAmount = item.amount;

      switch (rule.ruleType) {
        case 'bulk_discount':
          const discountPercentage = actions.discountPercentage || 0;
          adjustedAmount = item.amount * (1 - discountPercentage / 100);
          break;

        case 'material_markup':
          const markupPercentage = actions.markupPercentage || 0;
          if (item.materialPrice) {
            adjustedAmount = item.materialPrice * (1 + markupPercentage / 100) * item.quantity;
          }
          break;

        case 'labor_multiplier':
          const multiplier = actions.multiplier || 1;
          if (item.laborRate) {
            adjustedAmount = item.laborRate * multiplier * item.quantity;
          }
          break;

        case 'area_threshold':
          const areaDiscountPercentage = actions.discountPercentage || 0;
          adjustedAmount = item.amount * (1 - areaDiscountPercentage / 100);
          break;

        case 'custom':
          // Custom rules would have custom logic
          adjustedAmount = item.amount;
          break;

        default:
          adjustedAmount = item.amount;
      }

      const discountAmount = Math.max(0, item.amount - adjustedAmount);

      return {
        ruleId: rule.id,
        quoteItemId: item.id,
        originalAmount: item.amount,
        adjustedAmount: Math.max(0, adjustedAmount),
        discountAmount
      };

    } catch (error) {
      console.error('[PricingRules] Error applying rule actions:', error);
      return {
        ruleId: rule.id,
        quoteItemId: item.id,
        originalAmount: item.amount,
        adjustedAmount: item.amount,
        discountAmount: 0
      };
    }
  }

  /**
   * Database operations (simplified - would integrate with existing storage)
   */
  private async createRuleInDatabase(ruleData: any): Promise<PricingRule> {
    // This would integrate with existing storage system
    console.log('[PricingRules] Creating rule in database:', ruleData.name);
    return {
      id: 'generated-id',
      ...ruleData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async getRulesFromDatabase(orgId: string, activeOnly: boolean): Promise<PricingRule[]> {
    // This would integrate with existing storage system
    console.log('[PricingRules] Getting rules from database for org:', orgId);
    return [];
  }

  private async updateRuleInDatabase(ruleId: string, updates: any): Promise<PricingRule> {
    // This would integrate with existing storage system
    console.log('[PricingRules] Updating rule in database:', ruleId);
    return {} as PricingRule;
  }

  private async deleteRuleFromDatabase(ruleId: string): Promise<void> {
    // This would integrate with existing storage system
    console.log('[PricingRules] Deleting rule from database:', ruleId);
  }

  private async getQuoteItems(quoteId: string): Promise<any[]> {
    // This would integrate with existing storage system
    console.log('[PricingRules] Getting quote items for quote:', quoteId);
    return [];
  }

  private async recordRuleApplication(application: any): Promise<void> {
    // This would integrate with existing storage system
    console.log('[PricingRules] Recording rule application:', application.ruleId);
  }

  private async getRuleApplications(quoteId: string): Promise<PricingRuleApplication[]> {
    // This would integrate with existing storage system
    console.log('[PricingRules] Getting rule applications for quote:', quoteId);
    return [];
  }
}

// Export singleton instance
export const pricingRulesService = new PricingRulesService();
