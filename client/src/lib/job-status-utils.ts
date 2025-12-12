/**
 * Trades Job Status Utilities
 * 
 * Computes job status based on photos and quotes for Trades users.
 * This is a pure function that derives status from existing data without modifying the database.
 */

export type TradesJobStatus = 
  | 'NO_PHOTOS'
  | 'NEEDS_QUOTE'
  | 'QUOTE_DRAFT'
  | 'QUOTE_SENT'
  | 'APPROVED';

export interface TradesJobStatusInfo {
  status: TradesJobStatus;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Get trades job status based on photos and quotes
 * @param job - Job object (must have id)
 * @param photos - Array of photos for the job (can be empty)
 * @param quotes - Array of quotes for the job (can be empty)
 * @returns Status info with label and styling
 */
export function getTradesJobStatus(
  job: { id: string },
  photos: any[] = [],
  quotes: any[] = []
): TradesJobStatusInfo {
  const hasPhotos = photos.length > 0;
  const hasQuotes = quotes.length > 0;
  
  // Check quote statuses
  const hasDraftQuotes = quotes.some(q => q.status === 'draft');
  const hasSentQuotes = quotes.some(q => q.status === 'sent');
  const hasAcceptedQuotes = quotes.some(q => q.status === 'accepted');
  
  let status: TradesJobStatus;
  let label: string;
  let color: string;
  let bgColor: string;
  let borderColor: string;
  
  if (!hasPhotos) {
    status = 'NO_PHOTOS';
    label = 'No photos';
    color = 'text-slate-500';
    bgColor = 'bg-slate-50';
    borderColor = 'border-slate-200';
  } else if (!hasQuotes) {
    status = 'NEEDS_QUOTE';
    label = 'Needs quote';
    color = 'text-orange-600';
    bgColor = 'bg-orange-50';
    borderColor = 'border-orange-200';
  } else if (hasAcceptedQuotes) {
    status = 'APPROVED';
    label = 'Approved';
    color = 'text-green-600';
    bgColor = 'bg-green-50';
    borderColor = 'border-green-200';
  } else if (hasSentQuotes) {
    status = 'QUOTE_SENT';
    label = 'Quote sent';
    color = 'text-blue-600';
    bgColor = 'bg-blue-50';
    borderColor = 'border-blue-200';
  } else if (hasDraftQuotes) {
    status = 'QUOTE_DRAFT';
    label = 'Quote draft';
    color = 'text-yellow-600';
    bgColor = 'bg-yellow-50';
    borderColor = 'border-yellow-200';
  } else {
    // Fallback: has quotes but no recognized status
    status = 'QUOTE_DRAFT';
    label = 'Quote draft';
    color = 'text-yellow-600';
    bgColor = 'bg-yellow-50';
    borderColor = 'border-yellow-200';
  }
  
  return {
    status,
    label,
    color,
    bgColor,
    borderColor
  };
}

/**
 * Get quote summary for display in job cards
 * @param quotes - Array of quotes for the job
 * @returns Summary text like "Best quote: $5,724 (Draft)" or "Accepted quote: $8,200"
 */
export function getQuoteSummary(quotes: any[]): string | null {
  if (!quotes || quotes.length === 0) {
    return null;
  }
  
  // Check for accepted quote first
  const acceptedQuote = quotes.find(q => q.status === 'accepted');
  if (acceptedQuote) {
    const total = parseFloat(acceptedQuote.total || '0');
    return `Accepted quote: ${new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(total)}`;
  }
  
  // Find the quote with the highest total (best quote)
  const bestQuote = quotes.reduce((best, current) => {
    const bestTotal = parseFloat(best?.total || '0');
    const currentTotal = parseFloat(current?.total || '0');
    return currentTotal > bestTotal ? current : best;
  }, quotes[0]);
  
  if (bestQuote) {
    const total = parseFloat(bestQuote.total || '0');
    const status = bestQuote.status || 'draft';
    return `Best quote: ${new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(total)} (${status.charAt(0).toUpperCase() + status.slice(1)})`;
  }
  
  return null;
}

