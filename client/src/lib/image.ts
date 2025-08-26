/**
 * Image upload, processing, and EXIF handling utilities
 */

import { Vec2 } from '@shared/schema';

export interface ProcessedImage {
  file: File;
  url: string;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Process uploaded image: rotate per EXIF, resize, compress
 */
export async function processImage(
  file: File,
  maxSize: number = 3000,
  quality: number = 0.85
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      try {
        const { width, height } = calculateResizedDimensions(img.width, img.height, maxSize);
        
        canvas.width = width;
        canvas.height = height;
        
        // Clear canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // Draw and resize image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to process image'));
            return;
          }
          
          const processedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          
          const url = URL.createObjectURL(blob);
          
          resolve({
            file: processedFile,
            url,
            width,
            height,
            originalSize: file.size,
            processedSize: blob.size
          });
        }, 'image/jpeg', quality);
        
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate resized dimensions while maintaining aspect ratio
 */
function calculateResizedDimensions(
  originalWidth: number, 
  originalHeight: number, 
  maxSize: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;
  
  if (originalWidth <= maxSize && originalHeight <= maxSize) {
    return { width: originalWidth, height: originalHeight };
  }
  
  if (originalWidth > originalHeight) {
    return {
      width: maxSize,
      height: Math.round(maxSize / aspectRatio)
    };
  } else {
    return {
      width: Math.round(maxSize * aspectRatio),
      height: maxSize
    };
  }
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const maxSize = 50 * 1024 * 1024; // 50MB
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Only JPEG and PNG files are supported'
    };
  }
  
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size must be less than 50MB'
    };
  }
  
  return { valid: true };
}

/**
 * Upload image with progress tracking
 */
export async function uploadImage(
  file: File,
  uploadUrl: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100)
        });
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed: Network error'));
    });
    
    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload failed: Timeout'));
    });
    
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.timeout = 30000; // 30 second timeout
    xhr.send(file);
  });
}

/**
 * Create a thumbnail from an image
 */
export async function createThumbnail(
  imageUrl: string,
  size: number = 150
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      const { width, height } = calculateSquareThumbnail(img.width, img.height, size);
      
      canvas.width = size;
      canvas.height = size;
      
      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      
      // Center the image
      const x = (size - width) / 2;
      const y = (size - height) / 2;
      
      ctx.drawImage(img, x, y, width, height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for thumbnail'));
    };

    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
  });
}

/**
 * Calculate dimensions for square thumbnail
 */
function calculateSquareThumbnail(
  originalWidth: number,
  originalHeight: number,
  size: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;
  
  if (aspectRatio > 1) {
    // Landscape
    return {
      width: size,
      height: Math.round(size / aspectRatio)
    };
  } else {
    // Portrait or square
    return {
      width: Math.round(size * aspectRatio),
      height: size
    };
  }
}

/**
 * Get image dimensions from URL
 */
export async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

/**
 * Convert image coordinates accounting for display scaling
 */
export function convertImageCoordinates(
  screenCoords: Vec2,
  imageElement: HTMLImageElement,
  canvasElement: HTMLElement
): Vec2 {
  const imageRect = imageElement.getBoundingClientRect();
  const canvasRect = canvasElement.getBoundingClientRect();
  
  // Calculate scale factors
  const scaleX = imageElement.naturalWidth / imageRect.width;
  const scaleY = imageElement.naturalHeight / imageRect.height;
  
  // Convert coordinates
  const relativeX = screenCoords.x - imageRect.left;
  const relativeY = screenCoords.y - imageRect.top;
  
  return {
    x: relativeX * scaleX,
    y: relativeY * scaleY
  };
}

/**
 * Check if browser supports required features
 */
export function checkBrowserSupport(): { supported: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!window.File) missing.push('File API');
  if (!window.FileReader) missing.push('FileReader API');
  if (!window.Blob) missing.push('Blob API');
  if (!document.createElement('canvas').getContext) missing.push('Canvas API');
  if (!window.XMLHttpRequest) missing.push('XMLHttpRequest');
  
  return {
    supported: missing.length === 0,
    missing
  };
}