/**
 * Next-Best-Step Intelligence Job
 * 
 * Runs daily to generate intelligent suggestions for opportunities and properties.
 * These are suggestions, not errors - they help agents prioritize actions.
 */

import { storage } from '../storage.js';
import { createActionIfNotExists } from '../lib/actionHelper.js';
import { getDatabase } from '../db.js';
import { sql } from 'drizzle-orm';
import { matchBuyersToProperty, type PropertyData } from '../services/matchingEngine.js';

/**
 * Check if an unresolved action of the same type already exists for an opportunity
 */
async function hasUnresolvedAction(opportunityId: string, actionType: string): Promise<boolean> {
  try {
    const db = getDatabase();
    if (!db) {
      return false;
    }

    const result = await db.execute(sql`
      SELECT id FROM actions
      WHERE opportunity_id = ${opportunityId}::UUID
        AND action_type = ${actionType}
        AND completed_at IS NULL
      LIMIT 1
    `);

    const rows = (result as any).rows || result || [];
    return rows.length > 0;
  } catch (error: any) {
    console.warn('[hasUnresolvedAction] Error checking for existing action:', error?.message);
    return false;
  }
}

/**
 * Get buyer match count for a property
 */
async function getBuyerMatchCount(propertyId: string, orgId: string): Promise<number> {
  try {
    const property = await storage.getJob(propertyId);
    if (!property) {
      return 0;
    }

    const buyerOpportunities = await storage.getBuyerOpportunitiesWithProfiles(orgId);
    if (!Array.isArray(buyerOpportunities) || buyerOpportunities.length === 0) {
      return 0;
    }

    // Prepare property data for matching
    const notes = await storage.getPropertyNotes(propertyId);
    const propertyData: PropertyData = {
      id: property.id,
      address: property.address || null,
      suburb: property.suburb || null,
      estimatedPrice: property.estimatedPrice ? parseFloat(String(property.estimatedPrice).replace(/[$,]/g, '')) : null,
      bedrooms: property.bedrooms ? Number(property.bedrooms) : null,
      bathrooms: property.bathrooms ? Number(property.bathrooms) : null,
      propertyType: property.propertyType || null,
      propertyFeatures: Array.isArray(property.propertyFeatures) 
        ? property.propertyFeatures 
        : (property.propertyFeatures ? [String(property.propertyFeatures)] : []),
      propertyDescription: property.propertyDescription || null,
      propertyNotes: notes.map((n: any) => n.noteText || '').filter(Boolean),
      listingDate: property.listingDate || null,
    };

    const matchingResult = matchBuyersToProperty(propertyData, buyerOpportunities);
    
    // Count strong matches (tier = 'strong', typically score >= 70)
    const strongMatches = matchingResult.matches.filter(m => m.matchTier === 'strong');
    return strongMatches.length;
  } catch (error: any) {
    console.warn(`[getBuyerMatchCount] Error getting match count for property ${propertyId}:`, error?.message);
    return 0;
  }
}

/**
 * Check if photos have been enhanced
 */
async function hasEnhancedPhotos(propertyId: string): Promise<boolean> {
  try {
    const photos = await storage.getJobPhotos(propertyId, 'marketing');
    if (!photos || photos.length === 0) {
      return false;
    }

    // Check if any photo has enhancement metadata or composite URL
    // Photos with composite_url or enhancement metadata are considered enhanced
    return photos.some((photo: any) => {
      return photo.compositeUrl || 
             (photo.exifJson && typeof photo.exifJson === 'object' && Object.keys(photo.exifJson).length > 0);
    });
  } catch (error: any) {
    console.warn(`[hasEnhancedPhotos] Error checking photos for property ${propertyId}:`, error?.message);
    return false;
  }
}

/**
 * Rule A: Missing Price Guide
 */
async function checkNoPriceGuide(
  opportunity: any,
  orgId: string
): Promise<void> {
  const status = opportunity.status;
  // Database values: 'new', 'open' (mapped from frontend), or check if not closed
  const isActive = status === 'new' || status === 'open' || (status !== 'closed_won' && status !== 'closed_lost' && status !== 'abandoned');
  
  if (!isActive) {
    return;
  }

  // Check if price guide exists (estimatedValue or value field)
  const hasPriceGuide = opportunity.estimatedValue || opportunity.value;
  
  if (!hasPriceGuide) {
    const hasExisting = await hasUnresolvedAction(opportunity.id, 'INTEL_NO_PRICE_GUIDE');
    if (!hasExisting) {
      await createActionIfNotExists({
        orgId,
        agentId: opportunity.userId,
        opportunityId: opportunity.id,
        propertyId: opportunity.propertyJobId || null,
        type: 'INTEL_NO_PRICE_GUIDE',
        description: 'This opportunity has no price guide. Add one to increase buyer engagement and improve seller reporting accuracy.',
        priority: 'medium',
      });
    }
  }
}

/**
 * Rule B: Low Buyer Match Count
 */
async function checkLowBuyerMatches(
  opportunity: any,
  orgId: string
): Promise<void> {
  if (!opportunity.propertyJobId) {
    return;
  }

  const property = await storage.getJob(opportunity.propertyJobId);
  if (!property) {
    return;
  }

  // Check if property is active (has listing date or status indicates active)
  const isActive = property.listingDate || property.status === 'new' || property.status === 'estimating';
  
  if (!isActive) {
    return;
  }

  const strongMatchCount = await getBuyerMatchCount(opportunity.propertyJobId, orgId);
  
  if (strongMatchCount < 3) {
    const hasExisting = await hasUnresolvedAction(opportunity.id, 'INTEL_LOW_BUYER_MATCH_COUNT');
    if (!hasExisting) {
      await createActionIfNotExists({
        orgId,
        agentId: opportunity.userId,
        opportunityId: opportunity.id,
        propertyId: opportunity.propertyJobId,
        type: 'INTEL_LOW_BUYER_MATCH_COUNT',
        description: `Only ${strongMatchCount} buyers match this property. Consider updating price, expanding suburb profile, or contacting borderline buyers.`,
        priority: 'medium',
      });
    }
  }
}

/**
 * Rule C: Stale Opportunity
 */
async function checkStaleOpportunity(
  opportunity: any,
  orgId: string
): Promise<void> {
  const now = new Date();
  const lastActivity = opportunity.lastAgentActivity 
    ? new Date(opportunity.lastAgentActivity)
    : null;

  const daysInactive = lastActivity
    ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (daysInactive === null || daysInactive >= 14) {
    const hasExisting = await hasUnresolvedAction(opportunity.id, 'INTEL_STALE_OPPORTUNITY');
    if (!hasExisting) {
      const days = daysInactive ?? 'many';
      await createActionIfNotExists({
        orgId,
        agentId: opportunity.userId,
        opportunityId: opportunity.id,
        propertyId: opportunity.propertyJobId || null,
        type: 'INTEL_STALE_OPPORTUNITY',
        description: `Momentum has slowed — no activity for ${days} days. Send an update or adjust strategy.`,
        priority: daysInactive !== null && daysInactive >= 21 ? 'high' : 'medium',
      });
    }
  }
}

/**
 * Rule D: Low Seller Engagement
 */
async function checkLowSellerEngagement(
  opportunity: any,
  orgId: string
): Promise<void> {
  const now = new Date();
  const lastUpdate = opportunity.lastSellerUpdate
    ? new Date(opportunity.lastSellerUpdate)
    : null;

  const daysSinceUpdate = lastUpdate
    ? Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (daysSinceUpdate === null || daysSinceUpdate >= 10) {
    const hasExisting = await hasUnresolvedAction(opportunity.id, 'INTEL_LOW_RECENT_SELLER_ENGAGEMENT');
    if (!hasExisting) {
      const days = daysSinceUpdate ?? 'many';
      await createActionIfNotExists({
        orgId,
        agentId: opportunity.userId,
        opportunityId: opportunity.id,
        propertyId: opportunity.propertyJobId || null,
        type: 'INTEL_LOW_RECENT_SELLER_ENGAGEMENT',
        description: `You haven't updated this seller in ${days} days. Consider sending a report or a progress update.`,
        priority: daysSinceUpdate !== null && daysSinceUpdate >= 14 ? 'high' : 'medium',
      });
    }
  }
}

/**
 * Rule E: Appraisal Follow-Up Needed
 */
async function checkAppraisalFollowUp(
  opportunity: any,
  orgId: string
): Promise<void> {
  if (!opportunity.appraisalDate) {
    return;
  }

  const now = new Date();
  const appraisalDate = new Date(opportunity.appraisalDate);
  const daysSinceAppraisal = Math.floor((now.getTime() - appraisalDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceAppraisal >= 14) {
    const hasExisting = await hasUnresolvedAction(opportunity.id, 'INTEL_NEEDS_APPRAISAL_FOLLOWUP');
    if (!hasExisting) {
      await createActionIfNotExists({
        orgId,
        agentId: opportunity.userId,
        opportunityId: opportunity.id,
        propertyId: opportunity.propertyJobId || null,
        type: 'INTEL_NEEDS_APPRAISAL_FOLLOWUP',
        description: `This appraisal is ${daysSinceAppraisal} days old. A follow-up here may convert into a listing.`,
        priority: 'high',
      });
    }
  }
}

/**
 * Rule F: Photo Quality Improvement
 */
async function checkPhotoQuality(
  opportunity: any,
  orgId: string
): Promise<void> {
  if (!opportunity.propertyJobId) {
    return;
  }

  const photos = await storage.getJobPhotos(opportunity.propertyJobId, 'marketing');
  if (!photos || photos.length === 0) {
    return; // No photos to improve
  }

  const hasEnhanced = await hasEnhancedPhotos(opportunity.propertyJobId);
  
  if (!hasEnhanced) {
    const hasExisting = await hasUnresolvedAction(opportunity.id, 'INTEL_PHOTO_QUALITY_IMPROVEMENT');
    if (!hasExisting) {
      await createActionIfNotExists({
        orgId,
        agentId: opportunity.userId,
        opportunityId: opportunity.id,
        propertyId: opportunity.propertyJobId,
        type: 'INTEL_PHOTO_QUALITY_IMPROVEMENT',
        description: 'Photo quality could be improved. Enhanced images significantly increase seller conversion and buyer engagement.',
        priority: 'medium',
      });
    }
  }
}

/**
 * Run next-best-step intelligence evaluation
 */
export async function runNextBestStep(): Promise<void> {
  const startTime = Date.now();
  let opportunitiesEvaluated = 0;
  let suggestionsCreated = 0;
  const createdSuggestions: string[] = [];

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[NextBestStep] Starting next-best-step intelligence job...');
    }

    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get all seller opportunities (type = 'seller' or 'both')
    // Process in pages of 200 to avoid memory issues
    const pageSize = 200;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const opportunitiesResult = await db.execute(sql`
        SELECT 
          o.id,
          o.org_id as "orgId",
          o.user_id as "userId",
          o.title,
          o.property_job_id as "propertyJobId",
          o.status,
          o.estimated_value as "estimatedValue",
          o.value,
          o.appraisal_date as "appraisalDate",
          o.last_seller_update as "lastSellerUpdate",
          o.last_agent_activity as "lastAgentActivity"
        FROM opportunities o
        WHERE o.opportunity_type IN ('seller', 'both')
          AND o.status NOT IN ('closed_won', 'closed_lost', 'abandoned')
        ORDER BY o.created_at DESC
        LIMIT ${pageSize}::INTEGER
        OFFSET ${offset}::INTEGER
      `);

      const opportunities = ((opportunitiesResult as any).rows || opportunitiesResult || []) as Array<{
        id: string;
        orgId: string | null;
        userId: string;
        title: string;
        propertyJobId: string | null;
        status: string;
        estimatedValue: number | null;
        value: number | null;
        appraisalDate: Date | null;
        lastSellerUpdate: Date | null;
        lastAgentActivity: Date | null;
      }>;

      if (opportunities.length === 0) {
        hasMore = false;
        break;
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[NextBestStep] Processing page ${Math.floor(offset / pageSize) + 1} (${opportunities.length} opportunities)`);
      }

      for (const opp of opportunities) {
        try {
          opportunitiesEvaluated++;

          const orgId = opp.orgId;
          if (!orgId) {
            continue; // Skip opportunities without org
          }

          // Run all rules independently
          await checkNoPriceGuide(opp, orgId);
          await checkLowBuyerMatches(opp, orgId);
          await checkStaleOpportunity(opp, orgId);
          await checkLowSellerEngagement(opp, orgId);
          await checkAppraisalFollowUp(opp, orgId);
          await checkPhotoQuality(opp, orgId);

          suggestionsCreated++; // Count opportunities that were evaluated (not necessarily created)

        } catch (oppError: any) {
          console.error(`[NextBestStep] Error processing opportunity ${opp.id}:`, oppError?.message);
          if (process.env.NODE_ENV === 'development') {
            console.error(oppError);
          }
        }
      }

      if (opportunities.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[NextBestStep] Next-best-step intelligence job completed in ${duration}s`);
      console.log(`[NextBestStep] Opportunities evaluated: ${opportunitiesEvaluated}`);
      console.log(`[NextBestStep] Suggestions created: ${suggestionsCreated}`);
    }
  } catch (error: any) {
    console.error('[NextBestStep] Next-best-step intelligence job failed:', error?.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }
  }
}

