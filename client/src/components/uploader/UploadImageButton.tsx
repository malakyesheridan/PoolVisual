/**
 * Upload Image Button Component
 * Provides both button and drag-and-drop functionality
 */

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadImageButtonProps {
  onImageLoad: (file: File, imageUrl: string, dimensions: { width: number; height: number }) => void;
  onClear?: () => void;
  currentImage?: string | null;
  className?: string;
  disabled?: boolean;
}

export function UploadImageButton({ 
  onImageLoad, 
  onClear, 
  currentImage, 
  className,
  disabled = false 
}: UploadImageButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    setIsLoading(true);
    
    try {
      // Create object URL for immediate display
      const imageUrl = URL.createObjectURL(file);
      
      // Load image to get dimensions
      const img = new Image();
      img.onload = () => {
        onImageLoad(file, imageUrl, {
          width: img.naturalWidth,
          height: img.naturalHeight
        });
        setIsLoading(false);
      };
      img.onerror = () => {
        console.error('Failed to load image');
        URL.revokeObjectURL(imageUrl);
        setIsLoading(false);
        alert('Failed to load the selected image');
      };
      img.src = imageUrl;
      
    } catch (error) {
      console.error('Error processing image:', error);
      setIsLoading(false);
      alert('Error processing the selected image');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleClear = () => {
    if (currentImage) {
      URL.revokeObjectURL(currentImage);
    }
    onClear?.();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  // If image is loaded, show preview with clear option
  if (currentImage) {
    return (
      <Card className={cn("relative", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <ImageIcon className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">Image Loaded</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-slate-500 hover:text-red-600"
              data-testid="button-clear-image"
              disabled={disabled}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="aspect-video w-full bg-slate-100 rounded border overflow-hidden">
            <img
              src={currentImage}
              alt="Uploaded pool image"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="mt-3 space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleButtonClick}
              disabled={disabled || isLoading}
              className="w-full"
              data-testid="button-upload-new-image"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Different Image
                </>
              )}
            </Button>
            <p className="text-xs text-slate-600 text-center">
              Use the drawing tools to mark areas and measurements on your image.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show upload interface
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragging 
              ? "border-blue-500 bg-blue-50" 
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleButtonClick}
          data-testid="image-upload-area"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="file-input"
            disabled={disabled}
          />
          
          {isLoading ? (
            <div className="space-y-4">
              <Loader2 className="w-12 h-12 mx-auto text-blue-500 animate-spin" />
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  Processing Image...
                </h3>
                <p className="text-slate-600">
                  Please wait while we load your image
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  Upload Pool Image
                </h3>
                <p className="text-slate-600 mb-4">
                  Drag and drop your pool photo here, or click to browse
                </p>
                <Button 
                  variant="outline" 
                  className="mx-auto"
                  disabled={disabled}
                  data-testid="button-choose-image"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Image
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Supports JPG, PNG, and other image formats (Max 10MB)
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}