import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { normalizeImage } from '../../lib/normalizeImage';
import { Camera, Image } from 'lucide-react';

type Props = { 
  onUpload: (blob: Blob) => Promise<void>;
  className?: string;
  disabled?: boolean;
};

export function MobileUpload({ onUpload, className, disabled = false }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const { blob } = await normalizeImage(file, 3000);
      await onUpload(blob);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Please try again with a different photo.');
    } finally {
      e.currentTarget.value = '';
    }
  };

  return (
    <div className={className}>
      <div className="flex gap-3">
        <Button 
          onClick={() => cameraRef.current?.click()}
          disabled={disabled}
          className="flex-1 tap-target"
          data-testid="button-camera"
        >
          <Camera className="w-4 h-4 mr-2" />
          Camera
        </Button>
        <Button 
          onClick={() => libraryRef.current?.click()}
          disabled={disabled}
          className="flex-1 tap-target"
          data-testid="button-library"
        >
          <Image className="w-4 h-4 mr-2" />
          Library
        </Button>
      </div>
      
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-camera"
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-library"
      />
    </div>
  );
}