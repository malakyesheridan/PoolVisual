import { ReportSection } from './ReportSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ReportMarketOverviewProps {
  medianSuburbPrice?: number | string;
  daysOnMarket?: number | string;
  recentComparableSales?: string;
  onMedianPriceChange?: (value: string) => void;
  onDaysOnMarketChange?: (value: string) => void;
  onComparableSalesChange?: (value: string) => void;
}

export function ReportMarketOverview({
  medianSuburbPrice,
  daysOnMarket,
  recentComparableSales,
  onMedianPriceChange,
  onDaysOnMarketChange,
  onComparableSalesChange
}: ReportMarketOverviewProps) {
  // Helper to check if a value is empty/null/undefined
  const isEmpty = (value: number | string | undefined | null): boolean => {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (typeof value === 'number' && isNaN(value)) return true;
    return false;
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <ReportSection title="Market Overview">
      <div className="space-y-4">
        <div>
          <Label htmlFor="median-price" className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
            Median Suburb Price
          </Label>
          {onMedianPriceChange ? (
            <Input
              id="median-price"
              type="text"
              value={medianSuburbPrice || ''}
              onChange={(e) => onMedianPriceChange(e.target.value)}
              placeholder="Enter median suburb price..."
              className="text-sm"
            />
          ) : (
            <div className="text-sm leading-relaxed text-gray-700">
              {!isEmpty(medianSuburbPrice) ? formatCurrency(medianSuburbPrice) : 'Not provided'}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="days-on-market" className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
            Days on Market
          </Label>
          {onDaysOnMarketChange ? (
            <Input
              id="days-on-market"
              type="text"
              value={daysOnMarket || ''}
              onChange={(e) => onDaysOnMarketChange(e.target.value)}
              placeholder="Enter days on market..."
              className="text-sm"
            />
          ) : (
            <div className="text-sm leading-relaxed text-gray-700">
              {!isEmpty(daysOnMarket) ? daysOnMarket : 'Not provided'}
            </div>
          )}
        </div>

        {onComparableSalesChange && (
          <div>
            <Label htmlFor="comparable-sales" className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">
              Recent Comparable Sales (Optional)
            </Label>
            <Input
              id="comparable-sales"
              type="text"
              value={recentComparableSales || ''}
              onChange={(e) => onComparableSalesChange(e.target.value)}
              placeholder="Enter recent comparable sales information..."
              className="text-sm"
            />
          </div>
        )}
      </div>
    </ReportSection>
  );
}

