/**
 * Demand Spike Detector Job
 * 
 * Runs every 72 hours to detect when buyer demand spikes for past appraisal opportunities.
 * Creates actions when buyer matches increase for properties that had appraisals.
 */

import { storage } from '../storage.js';
import { matchBuyersToProperty } from '../services/matchingEngine.js';
import { createActionIfNotExists } from '../lib/actionHelper.js';
import { getDatabase } from '../db.js';
import { sql } from 'drizzle-orm';

const DEMAND_SPIKE_THRESHOLD = 5; // Minimum matches to trigger action

interface PastAppraisalOpportunity {
  id: string;
  orgId: string | null;
  userId: string;
  propertyJobId: string | null;
  appraisalDate: Date | string | null;
  title: string;
  suburb?: string | null;
}

/**
 * Extract property data from opportunity for matching
 */
function extractPropertyDataFromOpportunity(opportunity: PastAppraisalOpportunity, property: any): any {
  if (!property) {
    return null;
  }

  return {
    id: property.id,
    address: property.address || null,
    suburb: property.suburb || opportunity.suburb || null,
    estimatedPrice: property.estimatedPrice 
      ? parseFloat(String(property.estimatedPrice).replace(/[$,]/g, '')) 
      : null,
    bedrooms: property.bedrooms ? Number(property.bedrooms) : null,
    bathrooms: property.bathrooms ? Number(property.bathrooms) : null,
    propertyType: property.propertyType || null,
    propertyFeatures: Array.isArray(property.propertyFeatures) 
      ? property.propertyFeatures 
      : (property.propertyFeatures ? [String(property.propertyFeatures)] : []),
    propertyDescription: property.propertyDescription || null,
    propertyNotes: [],
    listingDate: property.listingDate || null,
  };
}

/**
 * Derive buyer profile from opportunity if contact profile doesn't exist
 */
function deriveBuyerProfileFromOpportunity(opportunity: any): any {
  // If opportunity has a contact with buyer profile, use that
  // Otherwise, derive basic assumptions from opportunity data
  // For now, return null - we'll use the existing getBuyerOpportunitiesWithProfiles
  return null;
}

/**
 * Run demand spike detection for all past appraisal opportunities
 */
export async function runDemandSpikeDetection(): Promise<void> {
  const startTime = Date.now();
  let opportunitiesEvaluated = 0;
  let actionsCreated = 0;
  const triggeredOpportunities: string[] = [];

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[DemandSpike] Starting demand spike detection job...');
    }

    // Get all opportunities with appraisal_date
    // We need to query across all orgs, so we'll get all opportunities and filter
    // For now, we'll process opportunities org by org to respect org boundaries
    
    // Query all opportunities with appraisal_date directly using SQL
    // This is more efficient than querying org by org
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }
    
    // Get all opportunities with appraisal_date that are not closed
    // Use raw SQL query similar to how storage methods do it
    const pastAppraisalsResult = await db.execute(sql`
      SELECT 
        o.id,
        o.org_id as "orgId",
        o.user_id as "userId",
        o.property_job_id as "propertyJobId",
        o.appraisal_date as "appraisalDate",
        o.title,
        j.suburb
      FROM opportunities o
      LEFT JOIN jobs j ON o.property_job_id = j.id
      WHERE o.appraisal_date IS NOT NULL
        AND o.status NOT IN ('closed_won', 'closed_lost', 'abandoned')
      ORDER BY o.appraisal_date DESC
    `);
    
    // Handle both Neon HTTP format (rows property) and direct array format
    const pastAppraisals = ((pastAppraisalsResult as any).rows || pastAppraisalsResult || []) as PastAppraisalOpportunity[];
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DemandSpike] Found ${pastAppraisals.length} past appraisals across all orgs`);
    }

    // Group by org for efficient processing
    const orgMap = new Map<string, PastAppraisalOpportunity[]>();
    for (const opp of pastAppraisals) {
      const orgId = opp.orgId || 'unknown';
      if (!orgMap.has(orgId)) {
        orgMap.set(orgId, []);
      }
      orgMap.get(orgId)!.push(opp);
    }

    for (const [orgId, orgOpportunities] of orgMap.entries()) {
      try {

        if (process.env.NODE_ENV === 'development') {
          console.log(`[DemandSpike] Processing ${orgOpportunities.length} past appraisals for org ${orgId}`);
        }

        for (const opportunity of orgOpportunities) {
          try {
            opportunitiesEvaluated++;

            // Skip if no property associated
            if (!opportunity.propertyJobId) {
              continue;
            }

            // Get the property
            const property = await storage.getJob(opportunity.propertyJobId);
            if (!property) {
              continue;
            }

            // Extract property data for matching
            const propertyData = extractPropertyDataFromOpportunity(opportunity, property);
            if (!propertyData) {
              continue;
            }

            // Get all buyer opportunities with profiles for this org
            const buyerOpportunities = await storage.getBuyerOpportunitiesWithProfiles(orgId);

            // Run matching
            const matchingResult = matchBuyersToProperty(propertyData, buyerOpportunities);
            const currentMatchCount = matchingResult.matches.length;

            // Get stored last match count
            const spikeRecord = await storage.getDemandSpikeRecord(opportunity.id);
            const lastMatchCount = spikeRecord?.lastMatchCount || 0;

            // Check for demand spike
            if (currentMatchCount >= DEMAND_SPIKE_THRESHOLD && currentMatchCount > lastMatchCount) {
              // Create action
              const oppOrgId = opportunity.orgId || orgId;
              const agentId = opportunity.userId;

              // Get suburb for action description
              const suburb = propertyData.suburb || property.address?.split(',')[1]?.trim() || 'this area';

              await createActionIfNotExists({
                orgId: oppOrgId,
                agentId,
                opportunityId: opportunity.id,
                propertyId: opportunity.propertyJobId,
                type: 'past_appraisal_demand_spike',
                description: `${currentMatchCount} buyers recently matched your past appraisal in ${suburb}. Reach out for a fresh updated appraisal.`,
                priority: 'high',
              });

              actionsCreated++;
              triggeredOpportunities.push(opportunity.id);

              if (process.env.NODE_ENV === 'development') {
                console.log(`[DemandSpike] Created action for opportunity ${opportunity.id}: ${currentMatchCount} matches (was ${lastMatchCount})`);
              }
            }

            // Update stored match count
            await storage.upsertDemandSpikeRecord(opportunity.id, currentMatchCount);

          } catch (error: any) {
            console.error(`[DemandSpike] Error processing opportunity ${opportunity.id}:`, error.message);
            // Continue with next opportunity
          }
        }
      } catch (error: any) {
        console.error(`[DemandSpike] Error processing org ${org.id}:`, error.message);
        // Continue with next org
      }
    }

    const duration = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DemandSpike] Job completed in ${duration}ms`);
      console.log(`[DemandSpike] Evaluated ${opportunitiesEvaluated} opportunities`);
      console.log(`[DemandSpike] Created ${actionsCreated} actions`);
      if (triggeredOpportunities.length > 0) {
        console.log(`[DemandSpike] Triggered opportunities: ${triggeredOpportunities.join(', ')}`);
      }
    }

  } catch (error: any) {
    console.error('[DemandSpike] Job failed:', error.message);
    throw error;
  }
}

// If run directly (for testing or manual execution)
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemandSpikeDetection()
    .then(() => {
      console.log('✅ Demand spike detection completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Demand spike detection failed:', error);
      process.exit(1);
    });
}

