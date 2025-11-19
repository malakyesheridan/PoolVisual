// client/src/components/enhancement/PreviewModal.tsx
import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Loader2, CheckCircle, X, Image as ImageIcon, Layers, Palette } from 'lucide-react';

interface PreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compositeImageUrl: string | null;
  maskCount: number;
  materials: Array<{ id: string; name?: string }>;
  imageDimensions: { width: number; height: number };
  mode: 'add_pool' | 'add_decoration' | 'blend_materials';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function PreviewModal({
  open,
  onOpenChange,
  compositeImageUrl,
  maskCount,
  materials,
  imageDimensions,
  mode,
  onConfirm,
  onCancel,
  loading = false,
}: PreviewModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (open && compositeImageUrl) {
      setImageLoaded(false);
      setImageError(false);
    }
  }, [open, compositeImageUrl]);

  const handleConfirm = () => {
    if (!loading && imageLoaded) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const modeLabels = {
    add_pool: 'Add Pool',
    add_decoration: 'Add Decoration',
    blend_materials: 'Blend Materials',
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Preview Enhancement"
      description="This is what will be sent to the enhancement service"
      variant="info"
      size="lg"
      loading={loading}
      primaryAction={{
        label: 'Confirm & Create',
        onClick: handleConfirm,
        disabled: loading || !imageLoaded || imageError,
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: handleCancel,
        disabled: loading,
      }}
      closeOnEscape={!loading}
      closeOnOverlayClick={!loading}
    >
      <div className="space-y-4">
        {/* Preview Image */}
        <div className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-300 min-h-[300px] flex items-center justify-center">
          {loading && !compositeImageUrl ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600">Generating preview...</p>
            </div>
          ) : imageError ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <ImageIcon className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-gray-600">Failed to load preview image</p>
            </div>
          ) : compositeImageUrl ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              )}
              <img
                src={compositeImageUrl}
                alt="Enhancement preview"
                className={`w-full h-auto max-h-[500px] object-contain ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  setImageError(true);
                  setImageLoaded(false);
                }}
              />
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12">
              <ImageIcon className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-gray-600">No preview available</p>
            </div>
          )}
        </div>

        {/* Information Summary */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-gray-600" />
              <span className="text-gray-600">Enhancement Type:</span>
              <span className="font-medium text-gray-900">{modeLabels[mode]}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Palette className="w-4 h-4 text-gray-600" />
              <span className="text-gray-600">Masks:</span>
              <span className="font-medium text-gray-900">{maskCount}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <ImageIcon className="w-4 h-4 text-gray-600" />
              <span className="text-gray-600">Dimensions:</span>
              <span className="font-medium text-gray-900">
                {imageDimensions.width} × {imageDimensions.height}px
              </span>
            </div>
            {materials.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Materials:</span>
                <span className="font-medium text-gray-900">{materials.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Warning Message */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            This preview shows exactly what will be sent to the AI enhancement service. 
            Make sure all masks and materials are correct before proceeding.
          </p>
        </div>
      </div>
    </Modal>
  );
}

