interface ReportHeroImageProps {
  imageUrl: string | null;
  address?: string;
  summary?: string;
  onSummaryChange?: (summary: string) => void;
}

interface ReportHeroImageProps {
  imageUrl: string | null;
  address?: string;
  summary?: string;
  onSummaryChange?: (summary: string) => void;
  logoUrl?: string | null;
  headshotUrl?: string | null;
  agentName?: string;
  agentTitle?: string;
  agentPhone?: string;
  agentEmail?: string;
}

export function ReportHeroImage({ 
  imageUrl, 
  address, 
  summary, 
  onSummaryChange,
  logoUrl,
  headshotUrl,
  agentName,
  agentTitle,
  agentPhone,
  agentEmail
}: ReportHeroImageProps) {
  return (
    <div className="mb-8">
      {/* Cover Page Header with Logo */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          {address && (
            <>
              <h1 className="text-3xl font-semibold mb-1 text-gray-900">{address}</h1>
              {address.includes(',') && (
                <p className="text-lg text-gray-600 mt-1">{address.split(',').slice(1).join(',').trim()}</p>
              )}
            </>
          )}
          <p className="text-sm text-gray-500 mt-2">
            {new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {logoUrl && (
          <div className="ml-4">
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="max-w-[140px] h-auto object-contain"
            />
          </div>
        )}
      </div>

      {/* Hero Image */}
      {imageUrl && (
        <div className="relative w-full h-[300px] overflow-hidden rounded-lg mb-6">
          <img
            src={imageUrl}
            alt={address || 'Property'}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Summary */}
      <div className="mb-6">
        {onSummaryChange ? (
          <textarea
            value={summary || ''}
            onChange={(e) => onSummaryChange(e.target.value)}
            placeholder="Enter property summary or period information..."
            className="w-full text-base leading-relaxed text-gray-700 border-none outline-none resize-none focus:ring-0 p-0 bg-transparent"
            rows={2}
          />
        ) : (
          summary && (
            <p className="text-base leading-relaxed text-gray-700">{summary}</p>
          )
        )}
      </div>

      {/* Agent Details with Headshot */}
      {(headshotUrl || agentName || agentTitle || agentPhone || agentEmail) && (
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          {headshotUrl && (
            <img 
              src={headshotUrl} 
              alt="Agent" 
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          )}
          <div>
            {agentName && (
              <div className="font-semibold text-gray-900">{agentName}</div>
            )}
            {agentTitle && (
              <div className="text-gray-600 text-sm">{agentTitle}</div>
            )}
            {agentPhone && (
              <div className="text-gray-600 text-sm">{agentPhone}</div>
            )}
            {agentEmail && (
              <div className="text-gray-600 text-sm">{agentEmail}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

