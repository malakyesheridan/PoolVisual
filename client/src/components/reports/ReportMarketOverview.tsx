import { ReportSection } from './ReportSection';
import { ReportStatCard } from './ReportStatCard';
import { TrendingUp, Calendar, DollarSign } from 'lucide-react';

interface ReportMarketOverviewProps {
  listingDate?: string | null;
  estimatedPrice?: number | null;
  suburb?: string | null;
}

export function ReportMarketOverview({
  listingDate,
  estimatedPrice,
  suburb
}: ReportMarketOverviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-AU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <ReportSection title="Market Overview">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {estimatedPrice && (
          <ReportStatCard
            label="Estimated Value"
            value={formatCurrency(estimatedPrice)}
            icon={<DollarSign className="w-5 h-5" />}
          />
        )}
        {suburb && (
          <ReportStatCard
            label="Location"
            value={suburb}
            icon={<TrendingUp className="w-5 h-5" />}
          />
        )}
        {listingDate && (
          <ReportStatCard
            label="Listing Date"
            value={formatDate(listingDate)}
            icon={<Calendar className="w-5 h-5" />}
          />
        )}
      </div>
    </ReportSection>
  );
}

