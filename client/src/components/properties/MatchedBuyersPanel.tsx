import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/measurement-utils";
import { User, DollarSign, MapPin, Home, Calendar, Loader2, ChevronRight, MessageSquare, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { FollowUpMessageDialog } from "./FollowUpMessageDialog";
import type { ReactNode } from "react";

interface MatchedBuyersPanelProps {
  jobId: string;
  onOpenOpportunity?: (opportunityId: string) => void;
}

export function MatchedBuyersPanel({ jobId, onOpenOpportunity }: MatchedBuyersPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [followUpDialog, setFollowUpDialog] = useState<{
    isOpen: boolean;
    smsText: string;
    emailSubject: string;
    emailBody: string;
  } | null>(null);
  const [generatingFollowUp, setGeneratingFollowUp] = useState<string | null>(null);

  const { data: matchingResult, isLoading } = useQuery({
    queryKey: ['/api/jobs', jobId, 'matched-buyers'],
    queryFn: () => apiClient.getMatchedBuyers(jobId),
    enabled: !!jobId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: suggestionsData } = useQuery({
    queryKey: ['/api/jobs', jobId, 'match-suggestions'],
    queryFn: () => apiClient.getMatchSuggestions(jobId),
    enabled: !!jobId,
    staleTime: 2 * 60 * 1000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ suggestionId, status }: { suggestionId: string; status: 'new' | 'in_progress' | 'completed' | 'dismissed' }) =>
      apiClient.updateMatchSuggestion(suggestionId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'match-suggestions'] });
      toast({ title: 'Status updated', description: 'Match suggestion status has been updated.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    },
  });

  const generateFollowUpMutation = useMutation({
    mutationFn: (suggestionId: string) => apiClient.generateFollowUpMessage(suggestionId),
    onSuccess: (data) => {
      setFollowUpDialog({
        isOpen: true,
        smsText: data.suggestedSmsText || '',
        emailSubject: data.suggestedEmailSubject || '',
        emailBody: data.suggestedEmailBody || '',
      });
      setGeneratingFollowUp(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate follow-up message',
        variant: 'destructive',
      });
      setGeneratingFollowUp(null);
    },
  });

  const handleGenerateFollowUp = async (suggestionId: string) => {
    setGeneratingFollowUp(suggestionId);
    generateFollowUpMutation.mutate(suggestionId);
  };

  const handleStatusUpdate = (suggestionId: string, status: 'completed' | 'dismissed') => {
    updateStatusMutation.mutate({ suggestionId, status });
  };

  // Create a map of suggestions by opportunityId
  const suggestionsByOpportunity = new Map<string, typeof suggestionsData.suggestions[0]>();
  if (suggestionsData?.suggestions) {
    for (const suggestion of suggestionsData.suggestions) {
      suggestionsByOpportunity.set(suggestion.opportunityId, suggestion);
    }
  }

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
          {suggestionsData && suggestionsData.suggestions.filter(s => s.status === 'new').length > 0 && (
            <Badge variant="default" className="ml-2 bg-amber-500">
              {suggestionsData.suggestions.filter(s => s.status === 'new').length} new
            </Badge>
          )}
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
          
          const suggestion = suggestionsByOpportunity.get(match.opportunityId);
          const status = suggestion?.status || 'new';
          
          const getStatusBadge = (status: string) => {
            switch (status) {
              case 'new':
                return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">New</Badge>;
              case 'in_progress':
                return <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">In Progress</Badge>;
              case 'completed':
                return <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Contacted</Badge>;
              case 'dismissed':
                return <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500 border-slate-200">Dismissed</Badge>;
              default:
                return null;
            }
          };

          return (
            <div
              key={match.opportunityId}
              className={cn(
                "border rounded-lg p-3 transition-all group",
                tierStyles.border,
                tierStyles.background,
                "hover:bg-slate-50 hover:shadow-sm"
              )}
            >
              {/* Header Row: Buyer Name + Tier Badge + Score + Status */}
              <div className="flex items-center justify-between mb-2">
                <h4 
                  className="font-semibold text-slate-900 text-sm cursor-pointer hover:text-slate-700"
                  onClick={() => onOpenOpportunity?.(match.opportunityId)}
                >
                  {match.contactName}
                </h4>
                <div className="flex items-center gap-1.5">
                  {suggestion && getStatusBadge(status)}
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs font-medium border px-2 py-0.5", tierStyles.badge)}
                  >
                    {getTierLabel(match.matchTier)} · {match.matchScore}%
                  </Badge>
                  {onOpenOpportunity && (
                    <ChevronRight 
                      className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors cursor-pointer"
                      onClick={() => onOpenOpportunity(match.opportunityId)}
                    />
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

              {/* Quick Actions Row */}
              {suggestion && (
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateFollowUp(suggestion.id);
                    }}
                    disabled={generatingFollowUp === suggestion.id}
                  >
                    {generatingFollowUp === suggestion.id ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        Generate Follow-Up
                      </>
                    )}
                  </Button>
                  {status !== 'completed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate(suggestion.id, 'completed');
                      }}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Contacted
                    </Button>
                  )}
                  {status !== 'dismissed' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate(suggestion.id, 'dismissed');
                      }}
                    >
                      <XCircle className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
      
      {followUpDialog && (
        <FollowUpMessageDialog
          isOpen={followUpDialog.isOpen}
          onClose={() => setFollowUpDialog(null)}
          smsText={followUpDialog.smsText}
          emailSubject={followUpDialog.emailSubject}
          emailBody={followUpDialog.emailBody}
        />
      )}
    </Card>
  );
}

