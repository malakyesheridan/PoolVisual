import { ReportSection } from './ReportSection';
import { Calendar, DollarSign, MessageSquare } from 'lucide-react';

interface ReportCampaignOverviewProps {
  daysOnMarket?: number;
  advertisedPrice?: number | string;
  enquiries?: number;
}

export function ReportCampaignOverview({
  daysOnMarket,
  advertisedPrice,
  enquiries
}: ReportCampaignOverviewProps) {
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return amount.toString();
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <ReportSection title="Campaign Overview">
      <div className="flex flex-row justify-between items-start gap-4">
        {/* Days on Market */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">Days on Market</span>
          </div>
          <div className="text-xl font-semibold text-gray-900 tracking-tight">
            {daysOnMarket !== undefined && !isNaN(daysOnMarket) && daysOnMarket >= 0 ? daysOnMarket : '—'}
          </div>
        </div>

        {/* Current Advertised Price */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-gray-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">Current Advertised Price</span>
          </div>
          <div className="text-xl font-semibold text-gray-900 tracking-tight">
            {advertisedPrice ? formatCurrency(advertisedPrice) : '—'}
          </div>
        </div>

        {/* Enquiries */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-gray-600" />
            <span className="text-xs text-gray-500 uppercase tracking-wide">Enquiries</span>
          </div>
          <div className="text-xl font-semibold text-gray-900 tracking-tight">
            {enquiries !== undefined ? enquiries : '—'}
          </div>
        </div>
      </div>
    </ReportSection>
  );
}

