import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImageIcon, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectedImages {
  heroImageId: string | null;
  additionalImageIds: string[];
  // Legacy support: URLs are resolved from IDs when needed
  heroImage?: string | null;
  additionalImages?: string[];
}

interface ReportImageSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selection: SelectedImages) => void;
  images: Array<{
    id: string;
    url: string;
    originalUrl?: string;
    thumbnailUrl?: string;
  }>;
}

export function ReportImageSelectionModal({
  open,
  onClose,
  onConfirm,
  images
}: ReportImageSelectionModalProps) {
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [selectedAdditional, setSelectedAdditional] = useState<Set<string>>(new Set());

  const handleImageClick = (imageId: string, isHero: boolean) => {
    if (isHero) {
      setHeroImage(imageId === heroImage ? null : imageId);
    } else {
      const newSet = new Set(selectedAdditional);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      setSelectedAdditional(newSet);
    }
  };

  const handleConfirm = () => {
    // Helper to get URL, returning null if all URL fields are null/undefined/empty
    const getImageUrl = (img: typeof images[0]): string | null => {
      const url = img.originalUrl || img.url || img.thumbnailUrl;
      // Return null if url is null, undefined, or empty string
      return url && url.trim() !== '' ? url : null;
    };
    
    // Create maps for both IDs and URLs
    const imageIdToUrlMap = new Map(images.map(img => [img.id, getImageUrl(img)]));
    
    // Store IDs to preserve selections even when URLs are missing
    // Also include URLs for backward compatibility and immediate use
    onConfirm({
      // Primary: Store image IDs to preserve selections
      heroImageId: heroImage,
      additionalImageIds: Array.from(selectedAdditional),
      // Legacy: Include URLs for backward compatibility
      heroImage: heroImage ? (imageIdToUrlMap.get(heroImage) ?? null) : null,
      additionalImages: Array.from(selectedAdditional)
        .map(id => imageIdToUrlMap.get(id))
        .filter((url): url is string => url !== null)
    });
  };

  const getImageUrl = (image: typeof images[0]): string => {
    // Return first available URL, or empty string as fallback for display
    return image.originalUrl || image.url || image.thumbnailUrl || '';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Images for Report</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Hero Image Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3">Hero Image (Main Cover)</h3>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((image) => {
                const url = getImageUrl(image);
                const isSelected = heroImage === image.id;
                
                return (
                  <button
                    key={image.id}
                    onClick={() => handleImageClick(image.id, true)}
                    className={cn(
                      "relative aspect-video rounded-lg overflow-hidden border-2 transition-all",
                      isSelected
                        ? "border-blue-600 ring-2 ring-blue-200"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt="Property"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                        <div className="bg-blue-600 rounded-full p-1">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Additional Images Selection */}
          <div>
            <h3 className="text-sm font-medium mb-3">Additional Images (Optional)</h3>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((image) => {
                const url = getImageUrl(image);
                const isSelected = selectedAdditional.has(image.id);
                const isHero = heroImage === image.id;
                
                return (
                  <button
                    key={image.id}
                    onClick={() => !isHero && handleImageClick(image.id, false)}
                    disabled={isHero}
                    className={cn(
                      "relative aspect-video rounded-lg overflow-hidden border-2 transition-all",
                      isHero && "opacity-50 cursor-not-allowed",
                      isSelected && !isHero
                        ? "border-green-600 ring-2 ring-green-200"
                        : !isHero && "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt="Property"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                    {isSelected && !isHero && (
                      <div className="absolute top-2 right-2 bg-green-600 rounded-full p-1">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {isHero && (
                      <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-700 bg-white px-2 py-1 rounded">
                          Hero
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!heroImage}>
            Continue to Report Builder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

