/**
 * Match Suggestion Generator Service
 * 
 * Generates and maintains MatchSuggestion records based on property-buyer matches.
 * Compares current matches against existing suggestions and creates/updates as needed.
 */

import { storage } from '../storage.js';
import { matchBuyersToProperty } from './matchingEngine.js';
import type { MatchResult } from './matchingEngine.js';
import { sql } from 'drizzle-orm';

export interface MatchSuggestionInput {
  orgId: string;
  propertyId: string;
  createdByUserId?: string | null;
}

export interface MatchSuggestionOutput {
  id: string;
  propertyId: string;
  opportunityId: string;
  contactId: string;
  matchScore: number;
  matchTier: 'strong' | 'medium' | 'weak';
  status: 'new' | 'in_progress' | 'completed' | 'dismissed';
  createdAt: Date;
}

/**
 * Generate match suggestions for a property
 * 
 * @param input orgId, propertyId, and optional createdByUserId
 * @returns Array of MatchSuggestion records (newly created or existing)
 */
export async function generateMatchSuggestions(
  input: MatchSuggestionInput
): Promise<MatchSuggestionOutput[]> {
  const { orgId, propertyId, createdByUserId } = input;

  try {
    // 1. Load property data
    const property = await storage.getJob(propertyId);
    if (!property) {
      console.warn(`[MatchSuggestionGenerator] Property ${propertyId} not found`);
      return [];
    }

    // Verify org access
    if (property.orgId !== orgId) {
      console.warn(`[MatchSuggestionGenerator] Property ${propertyId} does not belong to org ${orgId}`);
      return [];
    }

    // 2. Get buyer opportunities with profiles
    const buyerOpportunities = await storage.getBuyerOpportunitiesWithProfiles(orgId);

    // 3. Get property notes for matching
    let propertyNotesTexts: string[] = [];
    try {
      const notes = await storage.getPropertyNotes(propertyId);
      propertyNotesTexts = notes.map((note: any) => note.noteText || '').filter((text: string) => text.trim());
    } catch (error: any) {
      // If notes can't be loaded, continue without them (non-critical)
      console.warn('[MatchSuggestionGenerator] Could not load property notes:', error?.message);
    }
    
    // 4. Prepare property data for matching engine
    const propertyData = {
      id: property.id,
      address: property.address || null,
      estimatedPrice: property.estimatedPrice ? parseFloat(String(property.estimatedPrice).replace(/[$,]/g, '')) : null,
      bedrooms: property.bedrooms ? Number(property.bedrooms) : null,
      bathrooms: property.bathrooms ? Number(property.bathrooms) : null,
      propertyType: property.propertyType || null,
      propertyFeatures: Array.isArray(property.propertyFeatures) 
        ? property.propertyFeatures 
        : (property.propertyFeatures ? [String(property.propertyFeatures)] : []),
      propertyDescription: property.propertyDescription || null,
      propertyNotes: propertyNotesTexts,
      listingDate: property.listingDate || null,
    };

    // 4. Run matching engine
    const matchingResult = matchBuyersToProperty(propertyData, buyerOpportunities);

    // 5. Load existing match suggestions for this property
    const existingSuggestions = await storage.getMatchSuggestionsByProperty(orgId, propertyId);
    console.log(`[MatchSuggestionGenerator] Found ${existingSuggestions.length} existing suggestions for property ${propertyId}`);

    // 6. Create a map of existing suggestions by opportunityId
    const existingByOpportunity = new Map<string, typeof existingSuggestions[0]>();
    for (const suggestion of existingSuggestions) {
      existingByOpportunity.set(suggestion.opportunityId, suggestion);
    }
    console.log(`[MatchSuggestionGenerator] Processing ${matchingResult.matches.length} matches, ${existingByOpportunity.size} already have suggestions`);

    // 7. Process each match and create/update suggestions
    const results: MatchSuggestionOutput[] = [];

    for (const match of matchingResult.matches) {
      const existing = existingByOpportunity.get(match.opportunityId);

      if (!existing) {
        // Create new suggestion
        try {
          console.log(`[MatchSuggestionGenerator] Creating suggestion for property ${propertyId}, opportunity ${match.opportunityId}, score ${match.matchScore}`);
          const newSuggestion = await storage.createMatchSuggestion({
            orgId,
            propertyId,
            opportunityId: match.opportunityId,
            contactId: match.contactId,
            matchScore: match.matchScore,
            matchTier: match.matchTier,
            status: 'new',
            source: 'auto_match_v1',
            createdByUserId: createdByUserId || null,
          });

          results.push({
            id: newSuggestion.id,
            propertyId: newSuggestion.propertyId,
            opportunityId: newSuggestion.opportunityId,
            contactId: newSuggestion.contactId,
            matchScore: newSuggestion.matchScore,
            matchTier: newSuggestion.matchTier as 'strong' | 'medium' | 'weak',
            status: newSuggestion.status as 'new' | 'in_progress' | 'completed' | 'dismissed',
            createdAt: newSuggestion.createdAt,
          });

          console.log(`[MatchSuggestionGenerator] ✅ Created new suggestion ${newSuggestion.id} for property ${propertyId}, opportunity ${match.opportunityId} (score: ${match.matchScore}, tier: ${match.matchTier})`);

          // Enqueue outbox event for new match suggestion (best effort only)
          try {
            const { ensureDb } = await import('../storage.js');
            const db = ensureDb();
            await db.execute(sql`
              INSERT INTO outbox (job_id, event_type, payload, status)
              VALUES (${propertyId}::UUID, 'match_suggestion_created', ${JSON.stringify({
                orgId,
                propertyId,
                opportunityId: match.opportunityId,
                contactId: match.contactId,
                matchSuggestionId: newSuggestion.id,
                matchScore: match.matchScore,
                matchTier: match.matchTier,
              })}::jsonb, 'pending')
            `);
            console.log(`[MatchSuggestionGenerator] Enqueued outbox event for suggestion ${newSuggestion.id}`);
          } catch (outboxError: any) {
            // Log but don't fail - outbox is optional
            console.warn(`[MatchSuggestionGenerator] Failed to enqueue outbox event:`, outboxError?.message);
          }
        } catch (error: any) {
          const errorMsg = error?.message || String(error);
          const errorCode = error?.code;
          
          // Handle unique constraint violation (if suggestion was created concurrently)
          if (errorCode === '23505' || errorMsg.includes('unique') || errorMsg.includes('duplicate')) {
            console.log(`[MatchSuggestionGenerator] Suggestion already exists for property ${propertyId}, opportunity ${match.opportunityId}, fetching existing...`);
            // Try to fetch the existing suggestion
            try {
              const existingSuggestion = await storage.getMatchSuggestionByPropertyAndOpportunity(
                propertyId,
                match.opportunityId
              );
              if (existingSuggestion) {
                results.push({
                  id: existingSuggestion.id,
                  propertyId: existingSuggestion.propertyId,
                  opportunityId: existingSuggestion.opportunityId,
                  contactId: existingSuggestion.contactId,
                  matchScore: existingSuggestion.matchScore,
                  matchTier: existingSuggestion.matchTier as 'strong' | 'medium' | 'weak',
                  status: existingSuggestion.status as 'new' | 'in_progress' | 'completed' | 'dismissed',
                  createdAt: existingSuggestion.createdAt,
                });
                console.log(`[MatchSuggestionGenerator] ✅ Using existing suggestion ${existingSuggestion.id}`);
              } else {
                console.warn(`[MatchSuggestionGenerator] ⚠️  Unique constraint error but couldn't find existing suggestion`);
              }
            } catch (fetchError: any) {
              console.error(`[MatchSuggestionGenerator] Error fetching existing suggestion:`, fetchError?.message);
            }
          } else {
            console.error(`[MatchSuggestionGenerator] ❌ Error creating suggestion for property ${propertyId}, opportunity ${match.opportunityId}:`, errorMsg);
            console.error(`[MatchSuggestionGenerator] Error code: ${errorCode}, Stack:`, error?.stack);
          }
        }
      } else {
        // Existing suggestion - optionally update score/tier if changed significantly
        // For v1, we'll only update if the tier changed (strong/medium/weak)
        const tierChanged = existing.matchTier !== match.matchTier;
        const scoreChanged = Math.abs(existing.matchScore - match.matchScore) >= 10; // Significant change

        if (tierChanged || scoreChanged) {
          try {
            const updated = await storage.updateMatchSuggestion(existing.id, {
              matchScore: match.matchScore,
              matchTier: match.matchTier,
            });
            results.push({
              id: updated.id,
              propertyId: updated.propertyId,
              opportunityId: updated.opportunityId,
              contactId: updated.contactId,
              matchScore: updated.matchScore,
              matchTier: updated.matchTier as 'strong' | 'medium' | 'weak',
              status: updated.status as 'new' | 'in_progress' | 'completed' | 'dismissed',
              createdAt: updated.createdAt,
            });
            console.log(`[MatchSuggestionGenerator] Updated suggestion ${existing.id} (score: ${match.matchScore}, tier: ${match.matchTier})`);
          } catch (error) {
            console.error(`[MatchSuggestionGenerator] Error updating suggestion:`, error);
            // Still include existing in results
            results.push({
              id: existing.id,
              propertyId: existing.propertyId,
              opportunityId: existing.opportunityId,
              contactId: existing.contactId,
              matchScore: existing.matchScore,
              matchTier: existing.matchTier as 'strong' | 'medium' | 'weak',
              status: existing.status as 'new' | 'in_progress' | 'completed' | 'dismissed',
              createdAt: existing.createdAt,
            });
          }
        } else {
          // No significant change - just include existing
          results.push({
            id: existing.id,
            propertyId: existing.propertyId,
            opportunityId: existing.opportunityId,
            contactId: existing.contactId,
            matchScore: existing.matchScore,
            matchTier: existing.matchTier as 'strong' | 'medium' | 'weak',
            status: existing.status as 'new' | 'in_progress' | 'completed' | 'dismissed',
            createdAt: existing.createdAt,
          });
        }
      }
    }

    console.log(`[MatchSuggestionGenerator] ✅ Completed: ${results.length} suggestions processed (${results.filter(r => r.status === 'new').length} new)`);
    return results;

  } catch (error: any) {
    console.error(`[MatchSuggestionGenerator] ❌ Error generating suggestions:`, error?.message || error);
    console.error(`[MatchSuggestionGenerator] Stack:`, error?.stack);
    throw error;
  }
}

