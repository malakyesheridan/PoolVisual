import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/measurement-utils";
import { User, DollarSign, MapPin, Home, Calendar, Loader2, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

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

  const getTierStyles = (tier: 'strong' | 'medium' | 'weak') => {
    switch (tier) {
      case 'strong':
        return {
          badge: 'bg-green-50 text-green-700 border-green-200',
          border: 'border-l-2 border-green-500',
          background: 'bg-green-50/30',
        };
      case 'medium':
        return {
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
          border: 'border-l-2 border-amber-400',
          background: '',
        };
      case 'weak':
        return {
          badge: 'bg-slate-50 text-slate-600 border-slate-200',
          border: 'border-l-2 border-slate-300',
          background: '',
        };
    }
  };

  const getTierLabel = (tier: 'strong' | 'medium' | 'weak') => {
    switch (tier) {
      case 'strong':
        return 'Strong';
      case 'medium':
        return 'Medium';
      case 'weak':
        return 'Weak';
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
      <CardContent className="space-y-2">
        {matchingResult.matches.map((match) => {
          const tierStyles = getTierStyles(match.matchTier);
          
          // Extract key reasons and map to icons
          const reasonIcons: { icon: ReactNode; tooltip: string }[] = [];
          match.keyReasons.forEach((reason) => {
            if (reason.toLowerCase().includes('budget')) {
              reasonIcons.push({ icon: <DollarSign className="w-3.5 h-3.5" />, tooltip: reason });
            } else if (reason.toLowerCase().includes('bed') || reason.toLowerCase().includes('bath')) {
              reasonIcons.push({ icon: <Home className="w-3.5 h-3.5" />, tooltip: reason });
            } else if (reason.toLowerCase().includes('location') || reason.toLowerCase().includes('suburb')) {
              reasonIcons.push({ icon: <MapPin className="w-3.5 h-3.5" />, tooltip: reason });
            } else if (reason.toLowerCase().includes('timeline')) {
              reasonIcons.push({ icon: <Calendar className="w-3.5 h-3.5" />, tooltip: reason });
            }
          });
          
          return (
            <div
              key={match.opportunityId}
              onClick={() => onOpenOpportunity?.(match.opportunityId)}
              className={cn(
                "border rounded-lg p-3 transition-all cursor-pointer group",
                tierStyles.border,
                tierStyles.background,
                "hover:bg-slate-50 hover:shadow-sm",
                onOpenOpportunity && "hover:border-slate-300"
              )}
            >
              {/* Header Row: Buyer Name + Tier Badge + Score */}
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-900 text-sm">{match.contactName}</h4>
                <div className="flex items-center gap-1.5">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs font-medium border px-2 py-0.5", tierStyles.badge)}
                  >
                    {getTierLabel(match.matchTier)} · {match.matchScore}%
                  </Badge>
                  {onOpenOpportunity && (
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  )}
                </div>
              </div>

              {/* Summary Row: Icons for key alignment points */}
              <div className="flex items-center gap-3 mb-2 text-xs text-slate-500">
                {/* Reason Icons */}
                {reasonIcons.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {reasonIcons.slice(0, 4).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-center w-5 h-5 rounded bg-slate-100 text-slate-500"
                        title={item.tooltip}
                      >
                        {item.icon}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Secondary Info - Lower contrast */}
                <div className="flex items-center gap-3 ml-auto">
                  {match.buyerProfileSummary.budgetMin || match.buyerProfileSummary.budgetMax ? (
                    <div className="flex items-center gap-1" title="Budget">
                      <DollarSign className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-400">
                        {match.buyerProfileSummary.budgetMin && match.buyerProfileSummary.budgetMax
                          ? `${formatCurrency(match.buyerProfileSummary.budgetMin)}-${formatCurrency(match.buyerProfileSummary.budgetMax)}`
                          : match.buyerProfileSummary.budgetMin
                          ? `${formatCurrency(match.buyerProfileSummary.budgetMin)}+`
                          : `≤${formatCurrency(match.buyerProfileSummary.budgetMax!)}`}
                      </span>
                    </div>
                  ) : null}

                  {(match.buyerProfileSummary.bedsMin || match.buyerProfileSummary.bathsMin) && (
                    <div className="flex items-center gap-1" title="Beds/Baths">
                      <Home className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-400">
                        {match.buyerProfileSummary.bedsMin && `${match.buyerProfileSummary.bedsMin}+`}
                        {match.buyerProfileSummary.bedsMin && match.buyerProfileSummary.bathsMin && '/'}
                        {match.buyerProfileSummary.bathsMin && `${match.buyerProfileSummary.bathsMin}+`}
                      </span>
                    </div>
                  )}

                  {match.buyerProfileSummary.preferredSuburbs && match.buyerProfileSummary.preferredSuburbs.length > 0 && (
                    <div className="flex items-center gap-1" title="Location">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-400">
                        {match.buyerProfileSummary.preferredSuburbs.slice(0, 1)[0]}
                        {match.buyerProfileSummary.preferredSuburbs.length > 1 && '+'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional: Soft pill badges for alignment reasons (if space allows) */}
              {match.keyReasons.length > 0 && reasonIcons.length === 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {match.keyReasons.slice(0, 2).map((reason, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

