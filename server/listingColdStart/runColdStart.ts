/**
 * Listing Cold-Start Boost
 * 
 * Automatically performs key actions when a new property or seller opportunity is created:
 * - Generates buyer matches
 * - Creates action checklist
 * - Generates draft seller report
 * - Stores seller launch insights
 */

import { storage } from '../storage.js';
import { matchBuyersToProperty, type PropertyData, type BuyerOpportunity } from '../services/matchingEngine.js';
import { createActionIfNotExists } from '../lib/actionHelper.js';
import { storageService } from '../lib/storageService.js';
import type { Job } from '../../shared/schema.js';

const MATCH_THRESHOLD = 5; // Minimum matches to consider significant

interface SellerLaunchInsights {
  buyerMatchCount: number;
  generatedAt: string;
  topMatchedBuyers: Array<{
    id: string;
    name: string;
    budget: string;
  }>;
}

/**
 * Run cold-start boost for a new listing
 * 
 * @param propertyId - The property/job ID to process
 */
export async function runListingColdStart(propertyId: string): Promise<void> {
  const startTime = Date.now();
  
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ColdStart] Starting cold-start for property ${propertyId}`);
    }

    // STEP 1: Load property data
    const property = await storage.getJob(propertyId);
    if (!property) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[ColdStart] Property ${propertyId} not found`);
      }
      return;
    }

    // Find associated seller opportunity
    const allOpportunities = await storage.getOpportunities(String(property.userId), {
      propertyJobId: propertyId,
    });
    
    const sellerOpportunity = allOpportunities.find(
      (opp: any) => opp.opportunityType === 'seller' || opp.opportunityType === 'both'
    );

    if (!sellerOpportunity) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[ColdStart] No seller opportunity found for property ${propertyId}`);
      }
      return;
    }

    // Check if cold-start already ran (idempotency check)
    if (property.initialReportGeneratedAt) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[ColdStart] Property ${propertyId} already has cold-start report, skipping`);
      }
      return;
    }

    // Load additional data
    const photos = await storage.getJobPhotos(propertyId, 'marketing');
    const notes = await storage.getPropertyNotes(propertyId);

    // Get org ID for buyer matching
    const userOrgs = await storage.getUserOrgs(String(property.userId));
    const orgId = userOrgs.length > 0 ? userOrgs[0].id : null;

    if (!orgId) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[ColdStart] No org found for user ${property.userId}`);
      }
      return;
    }

    // STEP 2: Run buyer matches
    const buyerOpportunities = await storage.getBuyerOpportunitiesWithProfiles(orgId);
    
    // Prepare property data for matching
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
    const matchCount = matchingResult.matches.length;
    const hasSignificantMatches = matchCount >= MATCH_THRESHOLD;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ColdStart] Found ${matchCount} buyer matches for property ${propertyId}`);
    }

    // Get top 3 matched buyers for insights
    const topMatchedBuyers = matchingResult.matches
      .slice(0, 3)
      .map(match => {
        const buyerOpp = buyerOpportunities.find((bo: any) => bo.id === match.opportunityId);
        const budgetMin = buyerOpp?.buyerProfile?.budgetMin;
        const budgetMax = buyerOpp?.buyerProfile?.budgetMax;
        let budget = 'Not specified';
        if (budgetMin && budgetMax) {
          budget = `$${Math.round(budgetMin / 1000)}k - $${Math.round(budgetMax / 1000)}k`;
        } else if (budgetMax) {
          budget = `Up to $${Math.round(budgetMax / 1000)}k`;
        } else if (budgetMin) {
          budget = `From $${Math.round(budgetMin / 1000)}k`;
        }

        return {
          id: match.opportunityId,
          name: buyerOpp?.contactName || 'Unknown',
          budget,
        };
      });

    // STEP 3: Create action
    const suburb = property.suburb || property.address?.split(',')[1]?.trim() || 'this area';
    const actionDescription = `Your new listing in ${suburb} has ${matchCount} matched buyers ready. Review the initial listing checklist and take your first actions.`;

    await createActionIfNotExists({
      orgId,
      agentId: String(property.userId),
      propertyId,
      opportunityId: sellerOpportunity.id,
      type: 'LISTING_COLD_START',
      description: actionDescription,
      priority: hasSignificantMatches ? 'high' : 'medium',
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ColdStart] Created action for property ${propertyId}`);
    }

    // STEP 4: Checklist items (will be generated on-the-fly in UI)
    // The checklist is a standard set of 5 items that can be generated from the action type

    // STEP 5: Generate draft seller report
    // For now, we'll mark the report as "to be generated" by setting initialReportGeneratedAt
    // The actual PDF generation can be done client-side when the user views the report
    // We'll store a reference URL that points to the report builder
    const reportUrl = `/seller-report-builder/${propertyId}`;
    
    // Store report reference (we'll use a simple approach: store URL in a note or metadata)
    // For now, we'll just set the timestamp to indicate report should be generated
    await storage.updateJob(propertyId, {
      initialReportGeneratedAt: new Date(),
    } as any);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ColdStart] Marked report for generation: ${reportUrl}`);
    }

    // STEP 6: Store seller launch insights
    const insights: SellerLaunchInsights = {
      buyerMatchCount: matchCount,
      generatedAt: new Date().toISOString(),
      topMatchedBuyers,
    };

    await storage.updateJob(propertyId, {
      sellerLaunchInsights: insights as any,
    } as any);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ColdStart] Stored launch insights for property ${propertyId}`);
    }

    // STEP 7: Logging (already done above in dev mode)

    const duration = (Date.now() - startTime) / 1000;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[ColdStart] Cold-start completed for property ${propertyId} in ${duration}s`);
      console.log(`[ColdStart] Summary: ${matchCount} matches, ${hasSignificantMatches ? 'high' : 'medium'} priority`);
    }

  } catch (error: any) {
    // Don't throw - cold-start should not break property creation
    console.error(`[ColdStart] Error processing property ${propertyId}:`, error?.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }
  }
}

