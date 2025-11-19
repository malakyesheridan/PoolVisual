// client/src/components/enhancement/VariantViewer.tsx
import { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, Maximize2 } from 'lucide-react';

interface VariantViewerProps {
  imageUrl: string;
  variantId?: string;
  onClose: () => void;
  onDownload?: (url: string) => void;
}

export function VariantViewer({ imageUrl, variantId, onClose, onDownload }: VariantViewerProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload(imageUrl);
    } else {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `variant-${variantId || 'image'}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
      onMouseUp={handleMouseUp}
    >
      <div
        ref={containerRef}
        className="relative w-full h-full flex items-center justify-center p-4"
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
          aria-label="Close viewer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Controls */}
        <div className="absolute top-4 left-4 z-20 flex gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
            aria-label="Zoom in"
            title="Zoom in (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
            aria-label="Zoom out"
            title="Zoom out (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
            aria-label="Reset zoom"
            title="Reset (0)"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
            aria-label="Download image"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>

        {/* Image */}
        <div
          className="relative max-w-full max-h-full overflow-auto"
          onMouseDown={handleMouseDown}
          style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Variant"
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transformOrigin: 'center center',
            }}
          />
        </div>

        {/* Zoom Indicator */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded text-sm">
          {Math.round(scale * 100)}%
        </div>
      </div>
    </div>
  );
}

