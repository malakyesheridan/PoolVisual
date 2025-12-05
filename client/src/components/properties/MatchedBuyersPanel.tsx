import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/measurement-utils";
import { User, DollarSign, MapPin, Home, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";

interface MatchedBuyersPanelProps {
  jobId: string;
  onOpenOpportunity?: (opportunityId: string) => void;
}

export function MatchedBuyersPanel({ jobId, onOpenOpportunity }: MatchedBuyersPanelProps) {
  const { data: matchingResult, isLoading } = useQuery({
    queryKey: ['/api/jobs', jobId, 'matched-buyers'],
    queryFn: () => apiClient.getMatchedBuyers(jobId),
    enabled: !!jobId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Matched Buyers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!matchingResult || matchingResult.matches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Matched Buyers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={User}
            title="No matched buyers yet"
            description="Make sure buyer profiles are filled out with budget, location, and property preferences."
          />
        </CardContent>
      </Card>
    );
  }

  const getTierColor = (tier: 'strong' | 'medium' | 'weak') => {
    switch (tier) {
      case 'strong':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'weak':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTierLabel = (tier: 'strong' | 'medium' | 'weak') => {
    switch (tier) {
      case 'strong':
        return 'Strong Match';
      case 'medium':
        return 'Medium Match';
      case 'weak':
        return 'Weak Match';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Matched Buyers
          <Badge variant="outline" className="ml-2">
            {matchingResult.matches.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {matchingResult.matches.map((match) => (
          <div
            key={match.opportunityId}
            className="border rounded-lg p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-slate-900">{match.contactName}</h4>
                  <Badge className={getTierColor(match.matchTier)}>
                    {getTierLabel(match.matchTier)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {match.matchScore}% match
                  </Badge>
                </div>
                
                {/* Key Reasons */}
                {match.keyReasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {match.keyReasons.slice(0, 3).map((reason, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              {onOpenOpportunity && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenOpportunity(match.opportunityId)}
                  className="ml-4"
                >
                  Open
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>

            {/* Buyer Profile Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
              {match.buyerProfileSummary.budgetMin || match.buyerProfileSummary.budgetMax ? (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span>
                    {match.buyerProfileSummary.budgetMin && match.buyerProfileSummary.budgetMax
                      ? `${formatCurrency(match.buyerProfileSummary.budgetMin)} - ${formatCurrency(match.buyerProfileSummary.budgetMax)}`
                      : match.buyerProfileSummary.budgetMin
                      ? `Min: ${formatCurrency(match.buyerProfileSummary.budgetMin)}`
                      : `Max: ${formatCurrency(match.buyerProfileSummary.budgetMax!)}`}
                  </span>
                </div>
              ) : null}

              {match.buyerProfileSummary.preferredSuburbs && match.buyerProfileSummary.preferredSuburbs.length > 0 ? (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>
                    {match.buyerProfileSummary.preferredSuburbs.slice(0, 2).join(', ')}
                    {match.buyerProfileSummary.preferredSuburbs.length > 2 && '...'}
                  </span>
                </div>
              ) : null}

              {(match.buyerProfileSummary.bedsMin || match.buyerProfileSummary.bathsMin) && (
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-slate-400" />
                  <span>
                    {match.buyerProfileSummary.bedsMin && `${match.buyerProfileSummary.bedsMin}+ beds`}
                    {match.buyerProfileSummary.bedsMin && match.buyerProfileSummary.bathsMin && ', '}
                    {match.buyerProfileSummary.bathsMin && `${match.buyerProfileSummary.bathsMin}+ baths`}
                  </span>
                </div>
              )}

              {match.buyerProfileSummary.timeline && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="capitalize">
                    {match.buyerProfileSummary.timeline.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

