// Photo upload utilities with EXIF orientation and safe downscaling

export interface PhotoUploadResult {
  url: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  orientation: number;
}

export interface PhotoUploadOptions {
  maxDimension?: number;
  quality?: number;
  onProgress?: (progress: number) => void;
}

// EXIF orientation values
const EXIF_ORIENTATIONS = {
  1: 0,    // Normal
  2: 0,    // Horizontal flip
  3: 180,  // 180° rotation
  4: 0,    // Vertical flip
  5: 90,   // 90° rotation + horizontal flip
  6: 90,   // 90° rotation
  7: 270,  // 270° rotation + horizontal flip
  8: 270   // 270° rotation
} as const;

// Get EXIF orientation from image
function getImageOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      const dataView = new DataView(arrayBuffer);
      
      // Check for EXIF header
      if (dataView.getUint16(0) !== 0xFFD8) {
        resolve(1); // Not a JPEG
        return;
      }
      
      let offset = 2;
      while (offset < dataView.byteLength) {
        const marker = dataView.getUint16(offset);
        if (marker === 0xFFE1) { // APP1 marker (EXIF)
          const exifLength = dataView.getUint16(offset + 2);
          const exifData = new DataView(arrayBuffer, offset + 4, exifLength - 2);
          
          // Look for orientation tag (0x0112)
          for (let i = 0; i < exifData.byteLength - 1; i++) {
            if (exifData.getUint16(i) === 0x0112) {
              const orientation = exifData.getUint16(i + 2);
              resolve(orientation);
              return;
            }
          }
        }
        offset += 2 + dataView.getUint16(offset + 2);
      }
      
      resolve(1); // Default orientation
    };
    reader.readAsArrayBuffer(file.slice(0, 64 * 1024)); // Read first 64KB
  });
}

// Apply EXIF orientation to canvas
function applyOrientation(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number
): void {
  switch (orientation) {
    case 2:
      ctx.scale(-1, 1);
      ctx.translate(-width, 0);
      break;
    case 3:
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      break;
    case 4:
      ctx.scale(1, -1);
      ctx.translate(0, -height);
      break;
    case 5:
      ctx.scale(-1, 1);
      ctx.translate(-height, 0);
      ctx.rotate(Math.PI / 2);
      break;
    case 6:
      ctx.translate(height, 0);
      ctx.rotate(Math.PI / 2);
      break;
    case 7:
      ctx.scale(-1, 1);
      ctx.translate(-width, -height);
      ctx.rotate(-Math.PI / 2);
      break;
    case 8:
      ctx.translate(0, width);
      ctx.rotate(-Math.PI / 2);
      break;
  }
}

// Safe downscaling with quality preservation
function downscaleImage(
  image: HTMLImageElement,
  maxDimension: number,
  quality: number = 0.9
): HTMLCanvasElement {
  const { naturalWidth, naturalHeight } = image;
  
  // Calculate new dimensions
  let newWidth = naturalWidth;
  let newHeight = naturalHeight;
  
  if (naturalWidth > maxDimension || naturalHeight > maxDimension) {
    const ratio = Math.min(maxDimension / naturalWidth, maxDimension / naturalHeight);
    newWidth = Math.round(naturalWidth * ratio);
    newHeight = Math.round(naturalHeight * ratio);
  }
  
  // Create canvas for downscaling
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = newWidth;
  canvas.height = newHeight;
  
  // Use high-quality scaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Draw scaled image
  ctx.drawImage(image, 0, 0, newWidth, newHeight);
  
  return canvas;
}

// Process uploaded photo
export async function processPhotoUpload(
  file: File,
  options: PhotoUploadOptions = {}
): Promise<PhotoUploadResult> {
  const { maxDimension = 5120, quality = 0.9, onProgress } = options;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        onProgress?.(10);
        
        // Get EXIF orientation
        const orientation = await getImageOrientation(file);
        onProgress?.(20);
        
        // Create image element
        const img = new Image();
        img.onload = async () => {
          try {
            onProgress?.(40);
            
            const { naturalWidth, naturalHeight } = img;
            
            // Create canvas for processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d')!;
            
            // Determine final dimensions based on orientation
            let finalWidth = naturalWidth;
            let finalHeight = naturalHeight;
            
            if (orientation >= 5 && orientation <= 8) {
              // 90° or 270° rotation - swap dimensions
              finalWidth = naturalHeight;
              finalHeight = naturalWidth;
            }
            
            // Set canvas size
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            
            onProgress?.(60);
            
            // Apply orientation
            applyOrientation(ctx, ctx, orientation, naturalWidth, naturalHeight);
            
            // Draw image
            ctx.drawImage(img, 0, 0);
            
            onProgress?.(80);
            
            // Downscale if needed
            let finalCanvas = canvas;
            if (finalWidth > maxDimension || finalHeight > maxDimension) {
              finalCanvas = downscaleImage(img, maxDimension, quality);
            }
            
            // Convert to blob and create object URL
            finalCanvas.toBlob((blob) => {
              if (!blob) {
                reject(new Error('Failed to process image'));
                return;
              }
              
              const url = URL.createObjectURL(blob);
              onProgress?.(100);
              
              resolve({
                url,
                width: finalCanvas.width,
                height: finalCanvas.height,
                originalWidth: naturalWidth,
                originalHeight: naturalHeight,
                orientation
              });
            }, 'image/jpeg', quality);
            
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
        
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Validate file type and size
export function validatePhotoFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'Please select a valid image file (JPG, PNG, etc.)' };
  }
  
  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 50MB' };
  }
  
  return { valid: true };
}

// Handle paste events
export function handlePasteEvent(event: ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      return item.getAsFile();
    }
  }
  
  return null;
}

// Handle drag and drop events
export function handleDropEvent(event: DragEvent): File | null {
  event.preventDefault();
  
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return null;
  
  const file = files[0];
  const validation = validatePhotoFile(file);
  
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  return file;
}

// Handle drag over events
export function handleDragOverEvent(event: DragEvent): void {
  event.preventDefault();
  event.dataTransfer!.dropEffect = 'copy';
}
