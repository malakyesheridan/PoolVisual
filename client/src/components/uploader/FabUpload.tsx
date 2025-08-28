import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Camera, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeImage } from '../../lib/normalizeImage';

interface FabUploadProps {
  onFileSelect: (file: File, imageUrl: string, dimensions: { width: number; height: number }) => void;
  className?: string;
  disabled?: boolean;
}

export function FabUpload({ onFileSelect, className, disabled = false }: FabUploadProps) {
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|png|jpg)$/)) {
      alert('Please select a JPEG or PNG image.');
      return;
    }

    try {
      // Normalize image with EXIF correction and proper scaling
      const { blob, width, height } = await normalizeImage(file, 3000);
      
      // Create object URL from normalized blob
      const imageUrl = URL.createObjectURL(blob);
      
      // Create File object from blob for compatibility
      const normalizedFile = new File([blob], file.name, { type: 'image/jpeg' });
      
      onFileSelect(normalizedFile, imageUrl, { width, height });
      setShowOptions(false);
    } catch (error) {
      console.error('Error normalizing image:', error);
      alert('Error processing image. Please try again.');
    }

    // Reset input
    event.target.value = '';
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  const handleLibrarySelect = () => {
    fileInputRef.current?.click();
  };

  const handleMainClick = () => {
    if (disabled) return;
    setShowOptions(!showOptions);
  };

  return (
    <div className={cn("fixed bottom-20 right-4 z-40 md:hidden", className)}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        data-testid="file-input-library"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        data-testid="file-input-camera"
      />

      {/* Option buttons */}
      {showOptions && (
        <div className="flex flex-col space-y-3 mb-3">
          <Button
            onClick={handleCameraCapture}
            className="w-14 h-14 rounded-full shadow-lg bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            data-testid="fab-option-camera"
          >
            <Camera className="w-6 h-6" />
          </Button>
          <Button
            onClick={handleLibrarySelect}
            className="w-14 h-14 rounded-full shadow-lg bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
            data-testid="fab-option-library"
          >
            <Image className="w-6 h-6" />
          </Button>
        </div>
      )}

      {/* Main FAB */}
      <Button
        onClick={handleMainClick}
        disabled={disabled}
        className={cn(
          "w-16 h-16 rounded-full shadow-lg transition-smooth tap-target",
          showOptions && "rotate-45",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        data-testid="fab-upload"
      >
        <Plus className="w-8 h-8" />
      </Button>
    </div>
  );
}