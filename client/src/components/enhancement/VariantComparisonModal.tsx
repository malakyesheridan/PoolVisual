// client/src/components/enhancement/VariantComparisonModal.tsx
import { useState } from 'react';
import { X, Download, Eye, Maximize2, Layers } from 'lucide-react';
import { Modal } from '../common/Modal';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { VariantViewer } from './VariantViewer';

interface Variant {
  id: string;
  url: string;
  rank?: number;
}

interface VariantComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalImageUrl: string;
  variants: Variant[];
  jobId: string;
}

type ViewMode = 'grid' | 'side-by-side' | 'slider';

export function VariantComparisonModal({
  open,
  onOpenChange,
  originalImageUrl,
  variants,
  jobId,
}: VariantComparisonModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [fullscreenVariant, setFullscreenVariant] = useState<string | null>(null);

  if (variants.length === 0) return null;

  const selectedVariant = variants[selectedVariantIndex];
  const sortedVariants = [...variants].sort((a, b) => (a.rank || 0) - (b.rank || 0));

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `variant-${jobId.slice(0, 8)}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    variants.forEach((variant, index) => {
      setTimeout(() => {
        handleDownload(variant.url);
      }, index * 200); // Stagger downloads
    });
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Compare Variants"
        description="Compare enhancement variants side-by-side or with an interactive slider"
        variant="info"
        size="xl"
        primaryAction={null}
        secondaryAction={{
          label: 'Close',
          onClick: () => onOpenChange(false),
        }}
      >
        <div className="space-y-4">
          {/* View Mode Selector */}
          <div className="flex items-center gap-2 border-b pb-3">
            <span className="text-sm font-medium text-gray-700">View:</span>
            <div className="flex gap-1">
              {(['grid', 'side-by-side', 'slider'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setViewMode(mode);
                    if (mode !== 'grid' && selectedVariantIndex >= variants.length) {
                      setSelectedVariantIndex(0);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    viewMode === mode
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {mode === 'grid' ? 'Grid' : mode === 'side-by-side' ? 'Side-by-Side' : 'Slider'}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={handleDownloadAll}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center gap-1"
                title="Download all variants"
              >
                <Download className="w-3 h-3" />
                Download All
              </button>
            </div>
          </div>

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 gap-3">
              {sortedVariants.map((variant, index) => (
                <div key={variant.id || index} className="relative group">
                  <div className="relative aspect-square rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-100">
                    <img
                      src={variant.url}
                      alt={`Variant ${index + 1}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                    {variant.rank !== undefined && (
                      <div className="absolute top-2 left-2 bg-primary text-white px-2 py-0.5 rounded text-xs font-medium">
                        Rank {variant.rank}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => setFullscreenVariant(variant.url)}
                        className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-transform hover:scale-110"
                        title="View fullscreen"
                      >
                        <Maximize2 className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={() => handleDownload(variant.url)}
                        className="p-2 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-transform hover:scale-110"
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-600 text-center">
                    Variant {index + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Side-by-Side View */}
          {viewMode === 'side-by-side' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Select Variant:</label>
                <select
                  value={selectedVariantIndex}
                  onChange={(e) => setSelectedVariantIndex(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {variants.map((_, index) => (
                    <option key={index} value={index}>
                      Variant {index + 1} {variants[index].rank !== undefined ? `(Rank ${variants[index].rank})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">Original</div>
                  <div className="relative aspect-square rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-100">
                    <img
                      src={originalImageUrl}
                      alt="Original"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">Enhanced</div>
                  <div className="relative aspect-square rounded-lg border-2 border-primary/20 overflow-hidden bg-gray-100">
                    <img
                      src={selectedVariant.url}
                      alt="Enhanced variant"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={() => setFullscreenVariant(selectedVariant.url)}
                        className="p-1.5 bg-white/90 hover:bg-white rounded shadow-sm"
                        title="View fullscreen"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDownload(selectedVariant.url)}
                        className="p-1.5 bg-white/90 hover:bg-white rounded shadow-sm"
                        title="Download"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Slider View */}
          {viewMode === 'slider' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Select Variant:</label>
                <select
                  value={selectedVariantIndex}
                  onChange={(e) => setSelectedVariantIndex(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {variants.map((_, index) => (
                    <option key={index} value={index}>
                      Variant {index + 1} {variants[index].rank !== undefined ? `(Rank ${variants[index].rank})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative aspect-video rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-100">
                <BeforeAfterSlider
                  beforeImage={originalImageUrl}
                  afterImage={selectedVariant.url}
                  beforeLabel="Original"
                  afterLabel="Enhanced"
                  className="w-full h-full"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Fullscreen Viewer */}
      {fullscreenVariant && (
        <VariantViewer
          imageUrl={fullscreenVariant}
          variantId={selectedVariant.id}
          onClose={() => setFullscreenVariant(null)}
          onDownload={handleDownload}
        />
      )}
    </>
  );
}

