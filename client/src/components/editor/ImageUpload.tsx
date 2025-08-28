/**
 * Image Upload Component for Canvas Editor
 */

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeImage } from '../../lib/normalizeImage';

interface ImageUploadProps {
  onImageLoad: (file: File, imageUrl: string, dimensions: { width: number; height: number }) => void;
  onClear?: () => void;
  currentImage?: string | null;
  className?: string;
}

export function ImageUpload({ onImageLoad, onClear, currentImage, className }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setIsLoading(true);
    
    try {
      // Normalize image with EXIF correction and proper scaling
      const { blob, width, height } = await normalizeImage(file, 3000);
      
      // Create object URL from normalized blob
      const imageUrl = URL.createObjectURL(blob);
      
      // Create File object from blob for compatibility
      const normalizedFile = new File([blob], file.name, { type: 'image/jpeg' });
      
      onImageLoad(normalizedFile, imageUrl, { width, height });
      setIsLoading(false);
      
    } catch (error) {
      console.error('Error processing image:', error);
      setIsLoading(false);
      alert('Error processing image. Please try again with a different photo.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
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
          <p className="text-xs text-slate-600 mt-2">
            Use the drawing tools to mark areas and measurements on your pool image.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragging 
              ? "border-blue-500 bg-blue-50" 
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          data-testid="image-upload-area"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="file-input"
          />
          
          {isLoading ? (
            <div className="space-y-2">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-slate-600">Processing image...</p>
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
                <Button variant="outline" className="mx-auto">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Image
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Supports JPG, PNG, and other image formats
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}