/**
 * Property-Buyer Matching Engine (Rule-based v1)
 * 
 * Given a property and buyer opportunities, scores and ranks matches
 * based on budget, location, beds/baths, property type, preferences, and timeframe.
 */

import {
  normaliseSuburbName,
  getSuburbZoneId,
  areSuburbsInSameZone,
  getSuburbZoneLabel,
  LOCATION_SCORE_MAX,
  LOCATION_SCORE_EXACT_SUBURB,
  LOCATION_SCORE_SAME_ZONE,
  TIMEFRAME_SCORE_MAX,
} from './matchingConfig.js';

export interface BuyerProfile {
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredSuburbs?: string[] | null;
  bedsMin?: number | null;
  bathsMin?: number | null;
  propertyType?: string | null;
  mustHaves?: string[] | null;
  dealBreakers?: string[] | null;
  financeStatus?: string | null;
  timeline?: string | null;
  freeNotes?: string | null;
}

export interface PropertyData {
  id: string;
  address?: string | null;
  suburb?: string | null; // Explicit suburb field (mapped from schoolDistrict in DB)
  estimatedPrice?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  propertyType?: string | null;
  propertyFeatures?: string[] | null;
  propertyDescription?: string | null;
  propertyNotes?: string[] | null; // Array of note texts
  listingDate?: Date | string | null; // Property listing date
}

export interface BuyerOpportunity {
  id: string;
  contactId: string;
  contactName?: string;
  opportunityType: 'buyer' | 'seller' | 'both';
  status: string;
  buyerProfile?: BuyerProfile | null;
}

export interface MatchResult {
  opportunityId: string;
  contactId: string;
  contactName: string;
  matchScore: number;
  matchTier: 'strong' | 'medium' | 'weak';
  keyReasons: string[];
  buyerProfileSummary: {
    budgetMin?: number;
    budgetMax?: number;
    preferredSuburbs?: string[];
    bedsMin?: number;
    bathsMin?: number;
    propertyType?: string;
    timeline?: string;
  };
}

export interface MatchingResult {
  propertyId: string;
  matches: MatchResult[];
  filteredCount?: number; // Count of buyers filtered out (score < 30%)
}

// Scoring weights
// Note: These should sum to 0.90 (90%) to leave room for timeframe (10%)
// Timeframe is added separately as a flat 10 points (TIMEFRAME_SCORE_MAX)
const WEIGHTS = {
  BUDGET: 0.35,              // 35%
  LOCATION: 0.25,            // 25%
  BEDS_BATHS: 0.20,          // 20%
  PROPERTY_TYPE: 0.05,       // 5% (reduced from 10% to make room for timeframe)
  MUST_HAVES_DEAL_BREAKERS: 0.05, // 5% (reduced from 10% to make room for timeframe)
  // TIMEFRAME: 10 points added separately (10% of total)
};

// Match tier thresholds
const TIER_THRESHOLDS = {
  STRONG: 75,
  MEDIUM: 50,
  WEAK: 30,
};

/**
 * Get suburb from property data
 * Priority: explicit suburb field > extract from address
 */
function getPropertySuburb(property: PropertyData): string | null {
  // First, try explicit suburb field
  if (property.suburb) {
    return property.suburb.trim();
  }
  
  // Fallback: extract from address if no explicit suburb
  if (property.address) {
    // Simple extraction: take the last word (assuming format like "123 Main St, Suburb")
    const parts = property.address.split(',').map(p => p.trim());
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }
    
    // If no comma, try to get last word
    const words = property.address.trim().split(/\s+/);
    if (words.length > 1) {
      return words[words.length - 1].trim();
    }
    
    return property.address.trim();
  }
  
  return null;
}

/**
 * Score budget match (0-100)
 */
function scoreBudget(property: PropertyData, profile: BuyerProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  
  const propertyPrice = property.estimatedPrice ? Number(property.estimatedPrice) : null;
  const budgetMin = profile.budgetMin ? Number(profile.budgetMin) : null;
  const budgetMax = profile.budgetMax ? Number(profile.budgetMax) : null;
  
  // If no property price info, return neutral (no penalty)
  if (propertyPrice === null) {
    return { score: 0, reasons: [] };
  }
  
  // If buyer has no budget info, return neutral
  if (budgetMin === null && budgetMax === null) {
    return { score: 0, reasons: [] };
  }
  
  // Both min and max set
  if (budgetMin !== null && budgetMax !== null) {
    if (propertyPrice >= budgetMin && propertyPrice <= budgetMax) {
      // Perfect match within range
      score = 100;
      reasons.push(`Budget aligned ($${formatCurrency(budgetMin)}-$${formatCurrency(budgetMax)})`);
    } else if (propertyPrice < budgetMin) {
      // Property below budget - still good, but not ideal
      const diffPct = ((budgetMin - propertyPrice) / budgetMin) * 100;
      if (diffPct <= 10) {
        score = 80;
        reasons.push(`Slightly below budget`);
      } else if (diffPct <= 20) {
        score = 60;
        reasons.push(`Below budget range`);
      } else {
        score = 40;
        reasons.push(`Well below budget`);
      }
    } else {
      // Property above max budget - penalize
      const diffPct = ((propertyPrice - budgetMax) / budgetMax) * 100;
      if (diffPct <= 5) {
        score = 50;
        reasons.push(`Slightly above max budget`);
      } else if (diffPct <= 10) {
        score = 20;
        reasons.push(`Above max budget`);
      } else {
        score = 0;
        reasons.push(`Significantly above budget`);
      }
    }
  } else if (budgetMax !== null) {
    // Only max set
    if (propertyPrice <= budgetMax) {
      score = 80;
      reasons.push(`Within max budget`);
    } else {
      const diffPct = ((propertyPrice - budgetMax) / budgetMax) * 100;
      if (diffPct <= 10) {
        score = 30;
        reasons.push(`Slightly above max budget`);
      } else {
        score = 0;
        reasons.push(`Above max budget`);
      }
    }
  } else if (budgetMin !== null) {
    // Only min set
    if (propertyPrice >= budgetMin) {
      score = 70;
      reasons.push(`Meets minimum budget`);
    } else {
      score = 20;
      reasons.push(`Below minimum budget`);
    }
  }
  
  return { score, reasons };
}

/**
 * Score location match using zone-based matching (0-100)
 * 
 * Uses progressive scoring:
 * - Exact suburb match: 100% of location weight
 * - Same zone match: 75% of location weight
 * - No match: 0 (neutral, no penalty)
 */
function scoreLocation(property: PropertyData, profile: BuyerProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  
  const propertySuburb = getPropertySuburb(property);
  const buyerPreferredSuburbs = profile.preferredSuburbs || [];
  
  // If buyer has no explicit suburbs – neutral (0) but no penalty reason
  if (!buyerPreferredSuburbs || buyerPreferredSuburbs.length === 0) {
    return { score: 0, reasons };
  }
  
  // If property has no suburb, return neutral
  if (!propertySuburb) {
    return { score: 0, reasons };
  }
  
  const propertyNorm = normaliseSuburbName(propertySuburb);
  const preferredNorms = buyerPreferredSuburbs
    .map(normaliseSuburbName)
    .filter((s): s is string => !!s);
  
  if (preferredNorms.length === 0 || !propertyNorm) {
    return { score: 0, reasons };
  }
  
  // 1) Exact suburb match
  if (preferredNorms.includes(propertyNorm)) {
    reasons.push("Exact suburb match");
    // Return as percentage of LOCATION_SCORE_MAX (which is 25, matching 0.25 weight)
    // But we need to return 0-100 for the weighted calculation
    // So we return 100 here, and the weight (0.25) will be applied in the main function
    return { score: 100, reasons };
  }
  
  // 2) Same zone match (any preferred suburb is in same zone)
  const propertyZoneId = getSuburbZoneId(propertyNorm);
  if (propertyZoneId) {
    const anySameZone = preferredNorms.some(sub => areSuburbsInSameZone(sub, propertyNorm));
    if (anySameZone) {
      const zoneLabel = getSuburbZoneLabel(propertyNorm);
      if (zoneLabel) {
        reasons.push(`Same zone as preferred suburbs (${zoneLabel})`);
      } else {
        reasons.push("Same zone as preferred suburbs");
      }
      // Return 75% for same zone match
      return { score: 75, reasons };
    }
  }
  
  // 3) No match in this v1 – keep score 0, but we don't need to add a negative reason
  return { score: 0, reasons };
}

/**
 * Score beds/baths match (0-100)
 */
function scoreBedsBaths(property: PropertyData, profile: BuyerProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  let bedsScore = 0;
  let bathsScore = 0;
  
  const propertyBeds = property.bedrooms ? Number(property.bedrooms) : null;
  const propertyBaths = property.bathrooms ? Number(property.bathrooms) : null;
  const buyerBedsMin = profile.bedsMin ? Number(profile.bedsMin) : null;
  const buyerBathsMin = profile.bathsMin ? Number(profile.bathsMin) : null;
  
  // Score beds (50% of beds/baths score)
  if (propertyBeds !== null && buyerBedsMin !== null) {
    if (propertyBeds >= buyerBedsMin) {
      bedsScore = 100;
      reasons.push(`${propertyBeds}+ beds (wants ${buyerBedsMin}+)`);
    } else {
      // Penalize if below requirement
      const diff = buyerBedsMin - propertyBeds;
      if (diff === 1) {
        bedsScore = 30;
        reasons.push(`1 bed short (has ${propertyBeds}, wants ${buyerBedsMin}+)`);
      } else {
        bedsScore = 0;
        reasons.push(`Insufficient beds (has ${propertyBeds}, wants ${buyerBedsMin}+)`);
      }
    }
  } else {
    bedsScore = 50; // Neutral if missing data
  }
  
  // Score baths (50% of beds/baths score)
  if (propertyBaths !== null && buyerBathsMin !== null) {
    if (propertyBaths >= buyerBathsMin) {
      bathsScore = 100;
      reasons.push(`${propertyBaths}+ baths (wants ${buyerBathsMin}+)`);
    } else {
      // Penalize if below requirement
      const diff = buyerBathsMin - propertyBaths;
      if (diff <= 0.5) {
        bathsScore = 40;
        reasons.push(`Slightly short on baths`);
      } else {
        bathsScore = 0;
        reasons.push(`Insufficient baths (has ${propertyBaths}, wants ${buyerBathsMin}+)`);
      }
    }
  } else {
    bathsScore = 50; // Neutral if missing data
  }
  
  // Average beds and baths scores
  score = (bedsScore + bathsScore) / 2;
  
  return { score, reasons };
}

/**
 * Score property type match (0-100)
 */
function scorePropertyType(property: PropertyData, profile: BuyerProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  
  const propertyType = property.propertyType?.toLowerCase();
  const buyerType = profile.propertyType?.toLowerCase();
  
  // If either is missing, return neutral
  if (!propertyType || !buyerType) {
    return { score: 0, reasons: [] };
  }
  
  // Exact match
  if (propertyType === buyerType) {
    score = 100;
    reasons.push(`Property type match: ${propertyType}`);
  } else {
    // No match - return 0 (no penalty, just no bonus)
    score = 0;
  }
  
  return { score, reasons };
}

/**
 * Score must-haves and deal-breakers (0-100)
 * Now includes property description and notes in the matching
 */
function scoreMustHavesDealBreakers(property: PropertyData, profile: BuyerProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 100; // Start at full score
  
  const propertyFeatures = Array.isArray(property.propertyFeatures) ? property.propertyFeatures : [];
  const mustHaves = Array.isArray(profile.mustHaves) ? profile.mustHaves : [];
  const dealBreakers = Array.isArray(profile.dealBreakers) ? profile.dealBreakers : [];
  
  // Combine property features, description, and notes into a single searchable text
  const propertyDescription = property.propertyDescription ? String(property.propertyDescription).toLowerCase() : '';
  const propertyNotes = Array.isArray(property.propertyNotes) 
    ? property.propertyNotes.map(n => String(n).toLowerCase()).join(' ')
    : '';
  
  // Create a combined searchable text from all property sources
  const allPropertyText = [
    ...propertyFeatures.map(f => String(f).toLowerCase()),
    propertyDescription,
    propertyNotes,
  ].filter(t => t && t.trim()).join(' ').toLowerCase();
  
  // Normalize to lowercase for comparison
  const normalizedFeatures = propertyFeatures.map(f => String(f).toLowerCase().trim());
  const normalizedMustHaves = mustHaves.map(m => String(m).toLowerCase().trim());
  const normalizedDealBreakers = dealBreakers.map(d => String(d).toLowerCase().trim());
  
  // Helper function to check if a term appears in any property text
  const checkPropertyText = (term: string): boolean => {
    // Check in features
    if (normalizedFeatures.some(f => f.includes(term) || term.includes(f))) {
      return true;
    }
    // Check in description
    if (propertyDescription && (propertyDescription.includes(term) || term.includes(propertyDescription))) {
      return true;
    }
    // Check in notes
    if (propertyNotes && (propertyNotes.includes(term) || term.includes(propertyNotes))) {
      return true;
    }
    // Check in combined text
    if (allPropertyText && (allPropertyText.includes(term) || term.includes(allPropertyText))) {
      return true;
    }
    return false;
  };
  
  // Check deal-breakers first (hard constraint - zero out if violated)
  for (const dealBreaker of normalizedDealBreakers) {
    if (checkPropertyText(dealBreaker)) {
      score = 0;
      reasons.push(`Deal-breaker: ${dealBreaker}`);
      return { score, reasons }; // Early return - deal-breaker violated
    }
  }
  
  // Check must-haves (bonus points)
  if (normalizedMustHaves.length > 0) {
    let matchedCount = 0;
    for (const mustHave of normalizedMustHaves) {
      if (checkPropertyText(mustHave)) {
        matchedCount++;
        reasons.push(`Has: ${mustHave}`);
      }
    }
    
    // Score based on percentage of must-haves matched
    const matchRatio = matchedCount / normalizedMustHaves.length;
    score = matchRatio * 100;
    
    if (matchedCount === 0) {
      reasons.push(`Missing must-haves`);
    }
  } else {
    // No must-haves specified - neutral
    score = 50;
  }
  
  return { score, reasons };
}

/**
 * Normalize buyer timeline string to enum
 */
type BuyerTimeline = "asap" | "30days" | "60days" | "90days" | "flexible" | "unknown";

function normaliseBuyerTimeline(timelineRaw: string | null | undefined): BuyerTimeline {
  if (!timelineRaw) return "unknown";
  
  const normalized = timelineRaw.trim().toLowerCase();
  
  // Map various input formats to enum
  if (normalized.includes("asap") || normalized.includes("immediate") || normalized.includes("urgent")) {
    return "asap";
  }
  if (normalized.includes("30") || normalized === "30 days" || normalized === "30day") {
    return "30days";
  }
  if (normalized.includes("60") || normalized === "60 days" || normalized === "60day") {
    return "60days";
  }
  if (normalized.includes("90") || normalized === "90 days" || normalized === "90day") {
    return "90days";
  }
  if (normalized.includes("flexible") || normalized.includes("flex") || normalized.includes("no rush")) {
    return "flexible";
  }
  
  return "unknown";
}

/**
 * Score timeframe match based on listing date vs buyer timeline (0-100)
 * 
 * Scores how well the property's listing date aligns with the buyer's timeline.
 * Fresh listings score higher for buyers with urgent timelines.
 */
function computeTimeframeScore(
  listingDate: Date | string | null | undefined,
  buyerTimelineRaw: string | null | undefined
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  
  if (!listingDate || !buyerTimelineRaw) {
    return { score: 0, reasons };
  }
  
  const buyerTimeline = normaliseBuyerTimeline(buyerTimelineRaw);
  if (buyerTimeline === "unknown") {
    return { score: 0, reasons };
  }
  
  const listing = new Date(listingDate);
  if (Number.isNaN(listing.getTime())) {
    return { score: 0, reasons };
  }
  
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysListed = Math.max(
    0,
    Math.floor((now.getTime() - listing.getTime()) / msPerDay)
  );
  
  let score = 0;
  
  switch (buyerTimeline) {
    case "asap": {
      if (daysListed <= 7) {
        score = 100;
      } else if (daysListed <= 21) {
        // Linear falloff between 7 and 21 days
        const t = (21 - daysListed) / (21 - 7);
        score = Math.round(100 * Math.max(0, t));
      } else {
        score = 0;
      }
      break;
    }
    case "30days": {
      if (daysListed <= 21) {
        score = 100;
      } else if (daysListed <= 45) {
        const t = (45 - daysListed) / (45 - 21);
        score = Math.round(100 * Math.max(0, t));
      } else {
        score = 0;
      }
      break;
    }
    case "60days": {
      if (daysListed <= 45) {
        score = 100;
      } else if (daysListed <= 90) {
        const t = (90 - daysListed) / (90 - 45);
        score = Math.round(100 * Math.max(0, t));
      } else {
        score = 0;
      }
      break;
    }
    case "90days":
    case "flexible": {
      if (daysListed <= 60) {
        score = 100;
      } else if (daysListed <= 120) {
        const t = (120 - daysListed) / (120 - 60);
        score = Math.round(100 * Math.max(0, t));
      } else {
        score = 0;
      }
      break;
    }
  }
  
  reasons.push(
    `Listed ${daysListed} days ago, buyer timeline: ${buyerTimeline}`
  );
  
  return { score, reasons };
}

/**
 * Determine match tier from score
 */
function getMatchTier(score: number): 'strong' | 'medium' | 'weak' {
  if (score >= TIER_THRESHOLDS.STRONG) {
    return 'strong';
  } else if (score >= TIER_THRESHOLDS.MEDIUM) {
    return 'medium';
  } else {
    return 'weak';
  }
}

/**
 * Format currency for display (used in reasons)
 */
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `${Math.round(amount / 1000)}k`;
  }
  return Math.round(amount).toString();
}

/**
 * Main matching function
 * 
 * @param property Property data
 * @param buyerOpportunities List of buyer opportunities with profiles
 * @returns Matching results with scores and tiers
 */
export function matchBuyersToProperty(
  property: PropertyData,
  buyerOpportunities: BuyerOpportunity[]
): MatchingResult {
  const matches: MatchResult[] = [];
  
  // Filter candidates: must have buyer profile and be buyer/both type
  const candidates = buyerOpportunities.filter(opp => {
    try {
      // Must be buyer or both
      if (!opp || opp.opportunityType !== 'buyer' && opp.opportunityType !== 'both') {
        return false;
      }
      
      // Must have buyer profile (check for null, undefined, or empty object)
      if (!opp.buyerProfile || typeof opp.buyerProfile !== 'object') {
        return false;
      }
      
      // Check if it's an empty object
      if (Object.keys(opp.buyerProfile).length === 0) {
        return false;
      }
      
      // Must have at least some profile data
      const profile = opp.buyerProfile;
      const hasData = 
        (profile.budgetMin !== null && profile.budgetMin !== undefined) ||
        (profile.budgetMax !== null && profile.budgetMax !== undefined) ||
        (Array.isArray(profile.preferredSuburbs) && profile.preferredSuburbs.length > 0) ||
        (profile.bedsMin !== null && profile.bedsMin !== undefined) ||
        (profile.bathsMin !== null && profile.bathsMin !== undefined) ||
        (profile.propertyType !== null && profile.propertyType !== undefined);
      
      return hasData;
    } catch (error) {
      // If any error occurs during filtering, skip this opportunity
      console.warn('[MatchingEngine] Error filtering candidate:', error, opp);
      return false;
    }
  });
  
  // Score each candidate and track filtered buyers
  let filteredCount = 0;
  
  for (const candidate of candidates) {
    // Safety check - should not happen due to filter, but be defensive
    if (!candidate.buyerProfile || typeof candidate.buyerProfile !== 'object') {
      continue;
    }
    
    const profile = candidate.buyerProfile;
    
    // Calculate component scores
    const budgetResult = scoreBudget(property, profile);
    const locationResult = scoreLocation(property, profile);
    const bedsBathsResult = scoreBedsBaths(property, profile);
    const propertyTypeResult = scorePropertyType(property, profile);
    const mustHavesResult = scoreMustHavesDealBreakers(property, profile);
    const timeframeResult = computeTimeframeScore(property.listingDate, profile.timeline);
    
    // Calculate weighted total score
    // Weighted components (sum to 90 points max):
    const weightedScore = 
      (budgetResult.score * WEIGHTS.BUDGET) +
      (locationResult.score * WEIGHTS.LOCATION) +
      (bedsBathsResult.score * WEIGHTS.BEDS_BATHS) +
      (propertyTypeResult.score * WEIGHTS.PROPERTY_TYPE) +
      (mustHavesResult.score * WEIGHTS.MUST_HAVES_DEAL_BREAKERS);
    
    // Add timeframe as flat 10 points (10% of total)
    const timeframePoints = (timeframeResult.score / 100) * TIMEFRAME_SCORE_MAX;
    
    // Total score: weighted (0-90) + timeframe (0-10) = 0-100
    let totalScore = weightedScore + timeframePoints;
    
    // Normalize to 0-100 (should already be in range, but ensure)
    totalScore = Math.round(Math.max(0, Math.min(100, totalScore)));
    
    // Skip if score is too low (below weak threshold) and track it
    if (totalScore < TIER_THRESHOLDS.WEAK) {
      filteredCount++;
      continue;
    }
    
    // Collect key reasons from all components
    const allReasons = [
      ...budgetResult.reasons,
      ...locationResult.reasons,
      ...bedsBathsResult.reasons,
      ...propertyTypeResult.reasons,
      ...mustHavesResult.reasons,
      ...timeframeResult.reasons,
    ];
    
    // Determine tier
    const tier = getMatchTier(totalScore);
    
    matches.push({
      opportunityId: candidate.id,
      contactId: candidate.contactId,
      contactName: candidate.contactName || 'Unknown',
      matchScore: totalScore,
      matchTier: tier,
      keyReasons: allReasons.slice(0, 3), // Top 3 reasons
      buyerProfileSummary: {
        budgetMin: profile.budgetMin ?? undefined,
        budgetMax: profile.budgetMax ?? undefined,
        preferredSuburbs: Array.isArray(profile.preferredSuburbs) ? profile.preferredSuburbs : undefined,
        bedsMin: profile.bedsMin ?? undefined,
        bathsMin: profile.bathsMin ?? undefined,
        propertyType: profile.propertyType ?? undefined,
        timeline: profile.timeline ?? undefined,
      },
    });
  }
  
  // Sort by score descending
  matches.sort((a, b) => b.matchScore - a.matchScore);
  
  // Limit to top 50 for performance
  const topMatches = matches.slice(0, 50);
  
  return {
    propertyId: property.id,
    matches: topMatches,
    filteredCount,
  };
}

