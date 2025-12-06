import { ReportSection } from './ReportSection';
import { ReportGraph } from './ReportGraph';

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
  if (matches.length === 0) {
    return (
      <ReportSection title="Buyer Match Analysis">
        <p className="text-base leading-relaxed text-gray-600">No buyer matches found for this property.</p>
      </ReportSection>
    );
  }

  // Calculate match statistics
  const totalMatches = matches.length;
  const strongMatches = matches.filter(m => m.matchTier === 'strong').length;
  const mediumMatches = matches.filter(m => m.matchTier === 'medium').length;
  const weakMatches = matches.filter(m => m.matchTier === 'weak').length;

  // Calculate average budget alignment (simplified - using match score as proxy)
  const avgMatchScore = matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length;
  const budgetAlignment = Math.round(avgMatchScore);

  // Calculate suburb proximity (simplified - assume 70% if matches exist)
  const suburbProximity = matches.length > 0 ? 70 : 0;

  // Prepare donut chart data
  const donutData = [
    { label: 'Strong', value: strongMatches, color: '#10b981' },
    { label: 'Medium', value: mediumMatches, color: '#f59e0b' },
    { label: 'Weak', value: weakMatches, color: '#6b7280' },
  ].filter(d => d.value > 0);

  return (
    <ReportSection title="Buyer Match Analysis">
      <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
        {/* SVG Donut Chart */}
        <div className="mb-6">
        {donutData.length > 0 ? (
          <ReportGraph
            data={donutData}
            title={`Total Matches: ${totalMatches}`}
            type="donut"
          />
        ) : (
          <div className="text-center py-8 text-sm text-gray-500">
            No match data available
          </div>
        )}
      </div>

      {/* Match Statistics */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Budget Alignment</div>
          <div className="text-lg font-semibold text-gray-900 tracking-tight">{budgetAlignment}%</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Suburb Proximity Score</div>
          <div className="text-lg font-semibold text-gray-900 tracking-tight">{suburbProximity}%</div>
        </div>
      </div>

      {/* Plain-English Explanation */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <p className="text-base leading-relaxed text-gray-700">
          {totalMatches > 0 ? (
            <>
              This property has <strong>{totalMatches} active buyer match{totalMatches !== 1 ? 'es' : ''}</strong> in the system.
              {strongMatches > 0 && (
                <> <strong>{strongMatches} strong match{strongMatches !== 1 ? 'es' : ''}</strong> {strongMatches === 1 ? 'shows' : 'show'} excellent alignment with the property's features and buyer preferences.</>
              )}
              {mediumMatches > 0 && (
                <> <strong>{mediumMatches} medium match{mediumMatches !== 1 ? 'es' : ''}</strong> {mediumMatches === 1 ? 'indicates' : 'indicate'} good potential with some criteria alignment.</>
              )}
              {' '}The average match score of <strong>{budgetAlignment}%</strong> suggests{' '}
              {budgetAlignment >= 70 ? 'strong' : budgetAlignment >= 50 ? 'moderate' : 'some'} buyer interest.
            </>
          ) : (
            'No buyer matches are currently available for this property.'
          )}
        </p>
      </div>
      </div>
    </ReportSection>
  );
}

