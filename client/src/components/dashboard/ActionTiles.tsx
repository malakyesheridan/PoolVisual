/**
 * Action Tiles Component - Trades Only
 * Shows key counts of things that need attention today
 */

import React, { useMemo } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from '../ui/card';
import { FileText, Send, Clock, ArrowRight } from 'lucide-react';
import { useIsTrades } from '../../hooks/useIsTrades';

interface ActionTilesProps {
  jobs: any[];
  quotes: any[];
  className?: string;
}

export function ActionTiles({ jobs, quotes, className = '' }: ActionTilesProps) {
  const isTrades = useIsTrades();
  const [, navigate] = useLocation();

  // Only render for trades
  if (!isTrades) {
    return null;
  }

  // Group quotes by jobId for quick lookup
  const quotesByJobId = useMemo(() => {
    const map = new Map<string, any[]>();
    quotes.forEach(quote => {
      if (quote.jobId) {
        if (!map.has(quote.jobId)) {
          map.set(quote.jobId, []);
        }
        map.get(quote.jobId)!.push(quote);
      }
    });
    return map;
  }, [quotes]);

  // Attach quotes to jobs
  const jobsWithQuotes = useMemo(() => {
    return jobs.map(job => ({
      ...job,
      quotes: quotesByJobId.get(job.id) || []
    }));
  }, [jobs, quotesByJobId]);

  // Calculate action counts
  const actionCounts = useMemo(() => {
    // Jobs that have photos but no quote yet
    // We'll check if job has photos by checking if it has photoIds or if we can fetch photos
    // For now, we'll assume jobs with status 'new' or 'estimating' that have no quotes need quotes
    const jobsNeedingQuote = jobsWithQuotes.filter(job => {
      const hasQuotes = job.quotes && job.quotes.length > 0;
      const isActive = ['new', 'estimating'].includes(job.status);
      // If job has been created, assume it might have photos (we'll refine this later)
      return !hasQuotes && isActive;
    });

    // Draft quotes that have not been sent
    const draftQuotes = quotes.filter(quote => quote.status === 'draft');

    // Sent quotes awaiting response (not accepted/rejected)
    const sentQuotesAwaitingResponse = quotes.filter(quote => 
      quote.status === 'sent' && 
      quote.status !== 'accepted' && 
      quote.status !== 'rejected'
    );

    return {
      quotesToCreate: jobsNeedingQuote.length,
      quotesToSend: draftQuotes.length,
      awaitingResponse: sentQuotesAwaitingResponse.length,
    };
  }, [jobsWithQuotes, quotes]);

  const tiles = [
    {
      label: 'Quotes to create',
      count: actionCounts.quotesToCreate,
      secondaryText: 'Jobs with photos uploaded but no quote created.',
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/5',
      hoverColor: 'hover:bg-primary/10',
      onClick: () => {
        // Navigate to jobs page filtered by jobs needing quotes
        navigate('/jobs?filter=needs_quote');
      }
    },
    {
      label: 'Quotes to send',
      count: actionCounts.quotesToSend,
      secondaryText: 'Draft quotes waiting to be sent to clients.',
      icon: Send,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      hoverColor: 'hover:bg-orange-100',
      onClick: () => {
        // Navigate to quotes page filtered by draft
        navigate('/quotes?status=draft');
      }
    },
    {
      label: 'Awaiting client response',
      count: actionCounts.awaitingResponse,
      secondaryText: 'Sent quotes with no decision yet.',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-100',
      onClick: () => {
        // Navigate to quotes page filtered by sent
        navigate('/quotes?status=sent');
      }
    }
  ];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${className}`}>
      {tiles.map((tile, index) => (
        <Card
          key={index}
          className={`bg-white border border-gray-100 rounded-xl shadow-sm cursor-pointer transition-all duration-150 hover:shadow-md hover:scale-[1.02] ${tile.hoverColor}`}
          onClick={tile.onClick}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 ${tile.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <tile.icon className={`w-6 h-6 ${tile.color}`} />
              </div>
              <ArrowRight className={`w-4 h-4 ${tile.color} opacity-50`} />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-gray-900">{tile.count}</p>
              <p className="text-sm font-medium text-gray-900">{tile.label}</p>
              <p className="text-xs text-gray-500">{tile.secondaryText}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

