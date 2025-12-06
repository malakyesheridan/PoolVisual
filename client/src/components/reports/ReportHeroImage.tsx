interface ReportHeroImageProps {
  imageUrl: string | null;
  address?: string;
  summary?: string;
  onSummaryChange?: (summary: string) => void;
}

export function ReportHeroImage({ imageUrl, address, summary, onSummaryChange }: ReportHeroImageProps) {
  if (!imageUrl) return null;

  return (
    <div className="mb-10">
      {/* Full-width hero image */}
      <div className="relative w-full aspect-[16/9] overflow-hidden mb-6">
        <img
          src={imageUrl}
          alt={address || 'Property'}
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Address and summary below image */}
      <div className="space-y-2">
        {address && (
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{address}</h1>
        )}
        {onSummaryChange ? (
          <textarea
            value={summary || ''}
            onChange={(e) => onSummaryChange(e.target.value)}
            placeholder="Enter property summary or period information..."
            className="w-full text-sm leading-relaxed text-gray-700 border-none outline-none resize-none focus:ring-0 p-0 bg-transparent"
            rows={2}
          />
        ) : (
          summary && (
            <p className="text-sm leading-relaxed text-gray-700">{summary}</p>
          )
        )}
      </div>
    </div>
  );
}

