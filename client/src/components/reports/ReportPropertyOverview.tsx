import { ReportSection } from './ReportSection';
import { Textarea } from '@/components/ui/textarea';

interface ReportPropertyOverviewProps {
  bedrooms?: number | string;
  bathrooms?: number | string;
  carSpaces?: number | string;
  landSize?: number | string;
  summary?: string;
  onSummaryChange?: (summary: string) => void;
}

export function ReportPropertyOverview({
  bedrooms,
  bathrooms,
  carSpaces,
  landSize,
  summary,
  onSummaryChange
}: ReportPropertyOverviewProps) {
  return (
    <ReportSection title="Property Overview">
      {/* Editable summary paragraph */}
      <div className="mb-6">
        {onSummaryChange ? (
          <Textarea
            value={summary || ''}
            onChange={(e) => onSummaryChange(e.target.value)}
            placeholder="Enter a summary of the property..."
            className="text-sm leading-relaxed text-gray-700 min-h-[100px] resize-none border-gray-300 focus:border-gray-400"
          />
        ) : (
          <p className="text-sm leading-relaxed text-gray-700">
            {summary || 'No summary provided.'}
          </p>
        )}
      </div>

      {/* 2-column layout for property stats */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Beds</div>
          <div className="text-lg font-semibold text-gray-900 tracking-tight">
            {bedrooms !== undefined && bedrooms !== null ? bedrooms : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Baths</div>
          <div className="text-lg font-semibold text-gray-900 tracking-tight">
            {bathrooms !== undefined && bathrooms !== null ? bathrooms : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Cars</div>
          <div className="text-lg font-semibold text-gray-900 tracking-tight">
            {carSpaces !== undefined && carSpaces !== null ? carSpaces : '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Land Size</div>
          <div className="text-lg font-semibold text-gray-900 tracking-tight">
            {landSize !== undefined && landSize !== null ? `${landSize} m²` : '—'}
          </div>
        </div>
      </div>
    </ReportSection>
  );
}

