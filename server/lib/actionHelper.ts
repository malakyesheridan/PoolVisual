/**
 * Action Helper - Prevents duplicate action creation
 * 
 * This helper ensures actions are not created multiple times within a 24-hour window
 * for the same type and related entity (property/contact).
 */

import { storage } from '../storage.js';

interface CreateActionParams {
  orgId: string | null;
  agentId: string | null;
  propertyId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Create an action if it doesn't already exist within the last 24 hours
 * 
 * This prevents duplicate actions from being created for the same event.
 * Errors are logged but do not crash the request.
 */
export async function createActionIfNotExists(params: CreateActionParams): Promise<void> {
  try {
    // Require orgId - actions must be associated with an organization
    if (!params.orgId) {
      console.warn('[createActionIfNotExists] Skipping action creation: orgId is required');
      return;
    }

    // Check for existing action within last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    // Get all actions for the org
    const existingActions = await storage.getActionsByOrg(params.orgId);
    
    // Filter for matching actions within 24 hours
    const matchingActions = existingActions.filter(action => {
      // Must match type
      if (action.actionType !== params.type) return false;
      
      // Must be within 24 hours
      const actionDate = new Date(action.createdAt);
      if (actionDate < oneDayAgo) return false;
      
      // For actions with multiple related entities (e.g., buyer matches with property + opportunity),
      // we must match ALL provided entities to prevent duplicate actions for different buyers on the same property
      // For actions with a single entity, match if that entity matches
      
      // Count how many entities are provided
      const providedEntities = [
        params.propertyId,
        params.contactId,
        params.opportunityId,
      ].filter(Boolean).length;
      
      if (providedEntities === 0) {
        // General action with no specific entity - match if existing also has no entity
        if (!action.propertyId && !action.contactId && !action.opportunityId) {
          return true;
        }
        return false;
      }
      
      // For actions with entities, all provided entities must match
      let matches = 0;
      let requiredMatches = 0;
      
      if (params.propertyId) {
        requiredMatches++;
        if (action.propertyId === params.propertyId) {
          matches++;
        }
      }
      
      if (params.contactId) {
        requiredMatches++;
        if (action.contactId === params.contactId) {
          matches++;
        }
      }
      
      if (params.opportunityId) {
        requiredMatches++;
        if (action.opportunityId === params.opportunityId) {
          matches++;
        }
      }
      
      // All provided entities must match
      return matches === requiredMatches && requiredMatches > 0;
    });

    // If no matching action found, create one
    if (matchingActions.length === 0) {
      await storage.createAction({
        orgId: params.orgId,
        agentId: params.agentId,
        propertyId: params.propertyId || null,
        contactId: params.contactId || null,
        opportunityId: params.opportunityId || null,
        actionType: params.type,
        description: params.description,
        priority: params.priority,
      });
    }
  } catch (error) {
    // Log error but don't crash - actions are non-critical
    console.error('[createActionIfNotExists] Failed to create action:', error);
  }
}

