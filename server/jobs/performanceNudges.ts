/**
 * Performance Nudges Job
 * 
 * Runs daily to evaluate seller opportunities and create nudges when:
 * - Seller hasn't been updated in 6+ days
 * - Appraisal follow-up is overdue (21+ days)
 * - Opportunity is inactive (14+ days without activity)
 */

import { storage } from '../storage.js';
import { createActionIfNotExists } from '../lib/actionHelper.js';
import { getDatabase } from '../db.js';
import { sql } from 'drizzle-orm';

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
    return false; // If check fails, allow action creation (fail open)
  }
}

/**
 * Run performance nudges evaluation
 */
export async function runPerformanceNudges(): Promise<void> {
  const startTime = Date.now();
  let opportunitiesEvaluated = 0;
  let nudgesCreated = 0;
  const createdNudges: string[] = [];

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[PerformanceNudges] Starting performance nudges job...');
    }

    const db = getDatabase();
    if (!db) {
      throw new Error('Database not available');
    }

    // Get all seller opportunities (type = 'seller' or 'both')
    const opportunitiesResult = await db.execute(sql`
      SELECT 
        o.id,
        o.org_id as "orgId",
        o.user_id as "userId",
        o.title,
        o.property_job_id as "propertyJobId",
        o.appraisal_date as "appraisalDate",
        o.last_seller_update as "lastSellerUpdate",
        o.last_agent_activity as "lastAgentActivity",
        j.address,
        j.suburb
      FROM opportunities o
      LEFT JOIN jobs j ON o.property_job_id = j.id
      WHERE o.opportunity_type IN ('seller', 'both')
        AND o.status NOT IN ('closed_won', 'closed_lost', 'abandoned')
      ORDER BY o.created_at DESC
    `);

    const opportunities = ((opportunitiesResult as any).rows || opportunitiesResult || []) as Array<{
      id: string;
      orgId: string | null;
      userId: string;
      title: string;
      propertyJobId: string | null;
      appraisalDate: Date | null;
      lastSellerUpdate: Date | null;
      lastAgentActivity: Date | null;
      address: string | null;
      suburb: string | null;
    }>;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[PerformanceNudges] Found ${opportunities.length} seller opportunities to evaluate`);
    }

    const now = new Date();

    for (const opp of opportunities) {
      try {
        opportunitiesEvaluated++;

        const orgId = opp.orgId;
        if (!orgId) {
          continue; // Skip opportunities without org
        }

        // RULE A: Seller Not Updated Recently
        const daysSinceSellerUpdate = opp.lastSellerUpdate
          ? Math.floor((now.getTime() - new Date(opp.lastSellerUpdate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        if (daysSinceSellerUpdate === null || daysSinceSellerUpdate >= 6) {
          const hasExisting = await hasUnresolvedAction(opp.id, 'NUDGE_SELLER_UPDATE');
          if (!hasExisting) {
            const days = daysSinceSellerUpdate ?? 'many';
            const address = opp.address || opp.title || 'this property';
            await createActionIfNotExists({
              orgId,
              agentId: opp.userId,
              opportunityId: opp.id,
              propertyId: opp.propertyJobId || null,
              type: 'NUDGE_SELLER_UPDATE',
              description: `You haven't updated this seller in ${days} days. Send a quick update or generate a seller report.`,
              priority: daysSinceSellerUpdate !== null && daysSinceSellerUpdate >= 14 ? 'high' : 'medium',
            });
            nudgesCreated++;
            createdNudges.push(`Seller Update (${opp.title})`);
          }
        }

        // RULE B: Appraisal Follow-Up Overdue
        if (opp.appraisalDate) {
          const appraisalDate = new Date(opp.appraisalDate);
          const daysSinceAppraisal = Math.floor((now.getTime() - appraisalDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysSinceAppraisal >= 21) {
            // Check if agent activity happened after the 21-day mark
            const activityAfterDeadline = opp.lastAgentActivity
              ? new Date(opp.lastAgentActivity).getTime() >= (appraisalDate.getTime() + 21 * 24 * 60 * 60 * 1000)
              : false;

            if (!activityAfterDeadline) {
              const hasExisting = await hasUnresolvedAction(opp.id, 'NUDGE_APPRAISAL_FOLLOWUP');
              if (!hasExisting) {
                const address = opp.address || opp.title || 'this property';
                await createActionIfNotExists({
                  orgId,
                  agentId: opp.userId,
                  opportunityId: opp.id,
                  propertyId: opp.propertyJobId || null,
                  type: 'NUDGE_APPRAISAL_FOLLOWUP',
                  description: `It's been ${daysSinceAppraisal} days since your appraisal for ${address}. Time for a follow-up.`,
                  priority: 'high',
                });
                nudgesCreated++;
                createdNudges.push(`Appraisal Follow-Up (${opp.title})`);
              }
            }
          }
        }

        // RULE C: Opportunity Inactive (Cold Lead)
        const daysSinceActivity = opp.lastAgentActivity
          ? Math.floor((now.getTime() - new Date(opp.lastAgentActivity).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        if (daysSinceActivity === null || daysSinceActivity >= 14) {
          const hasExisting = await hasUnresolvedAction(opp.id, 'NUDGE_OPPORTUNITY_INACTIVE');
          if (!hasExisting) {
            const days = daysSinceActivity ?? 'many';
            await createActionIfNotExists({
              orgId,
              agentId: opp.userId,
              opportunityId: opp.id,
              propertyId: opp.propertyJobId || null,
              type: 'NUDGE_OPPORTUNITY_INACTIVE',
              description: `Momentum is slowing for this opportunity — no activity for ${days} days.`,
              priority: daysSinceActivity !== null && daysSinceActivity >= 21 ? 'high' : 'medium',
            });
            nudgesCreated++;
            createdNudges.push(`Inactive (${opp.title})`);
          }
        }

      } catch (oppError: any) {
        console.error(`[PerformanceNudges] Error processing opportunity ${opp.id}:`, oppError?.message);
        if (process.env.NODE_ENV === 'development') {
          console.error(oppError);
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PerformanceNudges] Performance nudges job completed in ${duration}s`);
      console.log(`[PerformanceNudges] Opportunities evaluated: ${opportunitiesEvaluated}`);
      console.log(`[PerformanceNudges] Nudges created: ${nudgesCreated}`);
      if (createdNudges.length > 0) {
        console.log(`[PerformanceNudges] Created nudges: ${createdNudges.join(', ')}`);
      }
    }
  } catch (error: any) {
    console.error('[PerformanceNudges] Performance nudges job failed:', error?.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }
  }
}

