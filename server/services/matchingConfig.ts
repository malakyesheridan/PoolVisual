/**
 * Matching Engine Configuration
 * 
 * Shared constants and configuration for the property-buyer matching engine.
 */

export interface SuburbZone {
  id: string;
  label: string;
  suburbs: readonly string[];
}

/**
 * Perth Suburb Zones Configuration
 * 
 * Defines geographic zones for progressive location matching.
 * Suburbs within the same zone are considered related matches.
 */
export const PERTH_SUBURB_ZONES = [
  {
    id: "inner_north",
    label: "Inner North",
    suburbs: [
      "Perth",
      "North Perth",
      "Mount Lawley",
      "Highgate",
      "Leederville",
      "West Perth",
      "Subiaco"
    ]
  },
  {
    id: "western_coastal",
    label: "Western Coastal",
    suburbs: [
      "Cottesloe",
      "Swanbourne",
      "City Beach",
      "Floreat",
      "Wembley Downs",
      "Scarborough",
      "Doubleview"
    ]
  },
  {
    id: "inner_south_river",
    label: "Inner South of the River",
    suburbs: [
      "South Perth",
      "Como",
      "Kensington",
      "Victoria Park",
      "East Victoria Park",
      "Carlisle",
      "Lathlain"
    ]
  },
  {
    id: "applecross_corridor",
    label: "Applecross & Surrounds",
    suburbs: [
      "Applecross",
      "Ardross",
      "Mount Pleasant",
      "Booragoon",
      "Brentwood",
      "Alfred Cove",
      "Melville"
    ]
  },
  {
    id: "fremantle_zone",
    label: "Fremantle & Surrounds",
    suburbs: [
      "Fremantle",
      "East Fremantle",
      "North Fremantle",
      "Beaconsfield",
      "White Gum Valley",
      "South Fremantle",
      "Hilton"
    ]
  },
  {
    id: "rockingham_coastal",
    label: "Rockingham Coastal",
    suburbs: [
      "Rockingham",
      "Waikiki",
      "Safety Bay",
      "Warnbro",
      "Shoalwater",
      "Cooloongup",
      "Port Kennedy"
    ]
  },
  {
    id: "baldivis_corridor",
    label: "Baldivis & Growth Corridor",
    suburbs: [
      "Baldivis",
      "Wellard",
      "Karnup",
      "Golden Bay",
      "Secret Harbour",
      "Singleton",
      "Lakelands"
    ]
  },
  {
    id: "joondalup_corridor",
    label: "Joondalup & Northern Corridor",
    suburbs: [
      "Joondalup",
      "Edgewater",
      "Currambine",
      "Heathridge",
      "Kinross",
      "Clarkson",
      "Carramar"
    ]
  }
] as const satisfies readonly SuburbZone[];

/**
 * Location scoring constants
 */
export const LOCATION_SCORE_MAX = 25; // Max location score (matches LOCATION weight of 0.25 * 100)
export const LOCATION_SCORE_EXACT_SUBURB = LOCATION_SCORE_MAX; // 100% of location weight
export const LOCATION_SCORE_SAME_ZONE = Math.round(LOCATION_SCORE_MAX * 0.75); // ~75%
export const LOCATION_SCORE_BROADER_MATCH = Math.round(LOCATION_SCORE_MAX * 0.5); // 50% (for future use)

/**
 * Timeframe scoring constants
 */
export const TIMEFRAME_SCORE_MAX = 10; // Max timeframe score (10% of total)

/**
 * Normalize suburb name for comparison
 * 
 * @param name Suburb name (can be null/undefined)
 * @returns Normalized suburb name or null
 */
export function normaliseSuburbName(name?: string | null): string | null {
  if (!name) return null;
  return name.trim().toLowerCase();
}

/**
 * Get the zone ID for a given suburb
 * 
 * @param suburb Suburb name
 * @returns Zone ID if suburb is in a zone, null otherwise
 */
export function getSuburbZoneId(suburb: string | null): string | null {
  if (!suburb) return null;
  
  const norm = normaliseSuburbName(suburb);
  if (!norm) return null;
  
  for (const zone of PERTH_SUBURB_ZONES) {
    if (zone.suburbs.some(s => normaliseSuburbName(s) === norm)) {
      return zone.id;
    }
  }
  
  return null;
}

/**
 * Check if two suburbs are in the same zone
 * 
 * @param suburbA First suburb name
 * @param suburbB Second suburb name
 * @returns True if both suburbs are in the same zone
 */
export function areSuburbsInSameZone(suburbA: string | null, suburbB: string | null): boolean {
  const zoneA = getSuburbZoneId(suburbA);
  const zoneB = getSuburbZoneId(suburbB);
  
  if (!zoneA || !zoneB) return false;
  return zoneA === zoneB;
}

/**
 * Get zone label for a suburb
 * 
 * @param suburb Suburb name
 * @returns Zone label if suburb is in a zone, null otherwise
 */
export function getSuburbZoneLabel(suburb: string | null): string | null {
  const zoneId = getSuburbZoneId(suburb);
  if (!zoneId) return null;
  
  const zone = PERTH_SUBURB_ZONES.find(z => z.id === zoneId);
  return zone?.label || null;
}

