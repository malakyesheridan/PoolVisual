import { Badge } from '@/components/ui/badge';
import { ReportSection } from './ReportSection';

interface BuyerMatch {
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

interface ReportBuyerMatchSectionProps {
  matches: BuyerMatch[];
}

export function ReportBuyerMatchSection({ matches }: ReportBuyerMatchSectionProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'strong':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'weak':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (matches.length === 0) {
    return (
      <ReportSection title="Matched Buyers">
        <p className="text-gray-600">No buyer matches found for this property.</p>
      </ReportSection>
    );
  }

  return (
    <ReportSection title="Matched Buyers">
      <div className="space-y-4">
        {matches.slice(0, 10).map((match) => (
          <div
            key={match.opportunityId}
            className="border border-gray-200 rounded-lg p-4 bg-white"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{match.contactName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={getTierColor(match.matchTier)}>
                    {match.matchTier.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {match.matchScore}% Match
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              {match.buyerProfileSummary.budgetMin && match.buyerProfileSummary.budgetMax && (
                <div>
                  <span className="text-gray-600">Budget: </span>
                  <span className="font-medium">
                    {formatCurrency(match.buyerProfileSummary.budgetMin)} -{' '}
                    {formatCurrency(match.buyerProfileSummary.budgetMax)}
                  </span>
                </div>
              )}
              {match.buyerProfileSummary.bedsMin && (
                <div>
                  <span className="text-gray-600">Beds: </span>
                  <span className="font-medium">{match.buyerProfileSummary.bedsMin}+</span>
                </div>
              )}
              {match.buyerProfileSummary.bathsMin && (
                <div>
                  <span className="text-gray-600">Baths: </span>
                  <span className="font-medium">{match.buyerProfileSummary.bathsMin}+</span>
                </div>
              )}
              {match.buyerProfileSummary.propertyType && (
                <div>
                  <span className="text-gray-600">Type: </span>
                  <span className="font-medium">{match.buyerProfileSummary.propertyType}</span>
                </div>
              )}
            </div>

            {match.keyReasons.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-600 mb-1">Key Match Reasons:</p>
                <ul className="text-xs text-gray-700 space-y-1">
                  {match.keyReasons.slice(0, 3).map((reason, idx) => (
                    <li key={idx}>• {reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

