import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

interface Photo {
  id: string;
  originalUrl: string;
  width?: number;
  height?: number;
  createdAt: string;
}

interface PhotoSelectionModalProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  onSelectPhoto: (photoId: string) => void;
}

export function PhotoSelectionModal({ open, onClose, jobId, onSelectPhoto }: PhotoSelectionModalProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && jobId) {
      loadPhotos();
    } else {
      setPhotos([]);
      setError(null);
    }
  }, [open, jobId]);

  const loadPhotos = async () => {
    setLoading(true);
    setError(null);
    try {
      const jobPhotos = await apiClient.getJobPhotos(jobId);
      setPhotos(jobPhotos);
    } catch (err: any) {
      console.error('Failed to load photos:', err);
      setError(err.message || 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = (photoId: string) => {
    onSelectPhoto(photoId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select a Photo</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-slate-600">Loading photos...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={loadPhotos} variant="outline">
                Try Again
              </Button>
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ImageIcon className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-slate-600 mb-2">No photos found in this job</p>
              <p className="text-sm text-slate-500">Upload a photo first to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => handlePhotoSelect(photo.id)}
                  className="group relative aspect-square rounded-lg overflow-hidden border-2 border-slate-200 hover:border-primary transition-all hover:shadow-lg bg-slate-50"
                >
                  <img
                    src={photo.originalUrl}
                    alt={`Photo ${photo.id.slice(0, 8)}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => {
                      // Show placeholder on error
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent && !parent.querySelector('.error-placeholder')) {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'error-placeholder absolute inset-0 flex items-center justify-center bg-slate-200';
                        placeholder.innerHTML = '<svg class="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  {photo.width && photo.height && (
                    <div className="absolute bottom-2 left-2 right-2 text-xs text-white bg-black/60 rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.width} × {photo.height}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

