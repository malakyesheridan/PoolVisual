/**
 * Property-Buyer Matching Engine (Rule-based v1)
 * 
 * Given a property and buyer opportunities, scores and ranks matches
 * based on budget, location, beds/baths, property type, and preferences.
 */

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
  estimatedPrice?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  propertyType?: string | null;
  propertyFeatures?: string[] | null;
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
}

// Scoring weights
const WEIGHTS = {
  BUDGET: 0.35,
  LOCATION: 0.25,
  BEDS_BATHS: 0.20,
  PROPERTY_TYPE: 0.10,
  MUST_HAVES_DEAL_BREAKERS: 0.10,
};

// Match tier thresholds
const TIER_THRESHOLDS = {
  STRONG: 75,
  MEDIUM: 50,
  WEAK: 30,
};

/**
 * Extract suburb from address string
 */
function extractSuburb(address: string | null | undefined): string | null {
  if (!address) return null;
  
  // Simple extraction: take the last word (assuming format like "123 Main St, Suburb")
  const parts = address.split(',').map(p => p.trim());
  if (parts.length > 1) {
    return parts[parts.length - 1].toLowerCase();
  }
  
  // If no comma, try to get last word
  const words = address.trim().split(/\s+/);
  if (words.length > 1) {
    return words[words.length - 1].toLowerCase();
  }
  
  return address.toLowerCase();
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
 * Score location match (0-100)
 */
function scoreLocation(property: PropertyData, profile: BuyerProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  
  const propertySuburb = extractSuburb(property.address);
  const preferredSuburbs = profile.preferredSuburbs || [];
  
  // If buyer didn't specify suburbs, return neutral
  if (preferredSuburbs.length === 0) {
    return { score: 0, reasons: [] };
  }
  
  // If property has no address, return neutral
  if (!propertySuburb) {
    return { score: 0, reasons: [] };
  }
  
  // Check for exact match (case-insensitive)
  const normalizedPreferred = preferredSuburbs.map(s => s.toLowerCase().trim());
  if (normalizedPreferred.includes(propertySuburb)) {
    score = 100;
    reasons.push(`Suburb match: ${propertySuburb}`);
  } else {
    // No match - return 0 (no penalty, just no bonus)
    score = 0;
  }
  
  return { score, reasons };
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
 */
function scoreMustHavesDealBreakers(property: PropertyData, profile: BuyerProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 100; // Start at full score
  
  const propertyFeatures = property.propertyFeatures || [];
  const mustHaves = profile.mustHaves || [];
  const dealBreakers = profile.dealBreakers || [];
  
  // Normalize to lowercase for comparison
  const normalizedFeatures = propertyFeatures.map(f => f.toLowerCase().trim());
  const normalizedMustHaves = mustHaves.map(m => m.toLowerCase().trim());
  const normalizedDealBreakers = dealBreakers.map(d => d.toLowerCase().trim());
  
  // Check deal-breakers first (hard constraint - zero out if violated)
  for (const dealBreaker of normalizedDealBreakers) {
    // Simple substring matching for v1
    const matches = normalizedFeatures.some(f => f.includes(dealBreaker) || dealBreaker.includes(f));
    if (matches) {
      score = 0;
      reasons.push(`Deal-breaker: ${dealBreaker}`);
      return { score, reasons }; // Early return - deal-breaker violated
    }
  }
  
  // Check must-haves (bonus points)
  if (normalizedMustHaves.length > 0) {
    let matchedCount = 0;
    for (const mustHave of normalizedMustHaves) {
      const matches = normalizedFeatures.some(f => f.includes(mustHave) || mustHave.includes(f));
      if (matches) {
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
    // Must be buyer or both
    if (opp.opportunityType !== 'buyer' && opp.opportunityType !== 'both') {
      return false;
    }
    
    // Must have buyer profile
    if (!opp.buyerProfile) {
      return false;
    }
    
    // Must have at least some profile data
    const profile = opp.buyerProfile;
    const hasData = 
      (profile.budgetMin !== null && profile.budgetMin !== undefined) ||
      (profile.budgetMax !== null && profile.budgetMax !== undefined) ||
      (profile.preferredSuburbs && profile.preferredSuburbs.length > 0) ||
      (profile.bedsMin !== null && profile.bedsMin !== undefined) ||
      (profile.bathsMin !== null && profile.bathsMin !== undefined) ||
      (profile.propertyType !== null && profile.propertyType !== undefined);
    
    return hasData;
  });
  
  // Score each candidate
  for (const candidate of candidates) {
    const profile = candidate.buyerProfile!;
    
    // Calculate component scores
    const budgetResult = scoreBudget(property, profile);
    const locationResult = scoreLocation(property, profile);
    const bedsBathsResult = scoreBedsBaths(property, profile);
    const propertyTypeResult = scorePropertyType(property, profile);
    const mustHavesResult = scoreMustHavesDealBreakers(property, profile);
    
    // Calculate weighted total score
    let totalScore = 
      (budgetResult.score * WEIGHTS.BUDGET) +
      (locationResult.score * WEIGHTS.LOCATION) +
      (bedsBathsResult.score * WEIGHTS.BEDS_BATHS) +
      (propertyTypeResult.score * WEIGHTS.PROPERTY_TYPE) +
      (mustHavesResult.score * WEIGHTS.MUST_HAVES_DEAL_BREAKERS);
    
    // Normalize to 0-100
    totalScore = Math.round(Math.max(0, Math.min(100, totalScore)));
    
    // Skip if score is too low (below weak threshold)
    if (totalScore < TIER_THRESHOLDS.WEAK) {
      continue;
    }
    
    // Collect key reasons (top 3 most important)
    const allReasons = [
      ...budgetResult.reasons,
      ...locationResult.reasons,
      ...bedsBathsResult.reasons,
      ...propertyTypeResult.reasons,
      ...mustHavesResult.reasons,
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
        preferredSuburbs: profile.preferredSuburbs ?? undefined,
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
  };
}

