import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Eye, Edit, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { useEditorStore } from "@/new_editor/store";

interface PhotoCardProps {
  photo: any;
  photos: any[];
  jobId: string | undefined;
  navigate: (path: string) => void;
  setPreviewPhoto: (photo: any) => void;
  setShowDeletePhotoConfirm: (photoId: string) => void;
  deletePhotoMutation: any;
}

export function PhotoCard({
  photo,
  photos,
  jobId,
  navigate,
  setPreviewPhoto,
  setShowDeletePhotoConfirm,
  deletePhotoMutation,
}: PhotoCardProps) {
  return (
    <div 
      key={photo.id}
      className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-video bg-slate-100 relative">
        {photo.originalUrl ? (
          <img 
            src={photo.originalUrl} 
            alt={`Photo ${photo.id.slice(-8)}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera className="w-8 h-8 text-slate-400" />
          </div>
        )}
        
        {/* Image Hover Overlay - Preview Only */}
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center group">
          <Button
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            onClick={async () => {
              try {
                // Try to get composite/edited version for preview display
                const composite = await apiClient.getComposite(photo.id);
                if (composite?.afterUrl) {
                  setPreviewPhoto({
                    ...photo,
                    // Keep originalUrl as the original photo URL (for editing)
                    // Store composite URL separately for preview display
                    compositeUrl: composite.afterUrl,
                    photoIndex: photos.indexOf(photo) // Store original index
                  });
                } else {
                  // No composite available, use original
                  setPreviewPhoto({
                    ...photo,
                    photoIndex: photos.indexOf(photo) // Store original index
                  });
                }
              } catch (error) {
                console.warn('Failed to get composite, using original:', error);
                setPreviewPhoto({
                  ...photo,
                  photoIndex: photos.indexOf(photo) // Store original index
                });
              }
            }}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
        </div>
      </div>
      
      <div className="p-3">
        <h4 className="font-medium text-slate-900 truncate">
          Photo {photos.indexOf(photo) + 1}
        </h4>
        <p className="text-sm text-slate-500">
          {formatDistanceToNow(new Date(photo.createdAt), { addSuffix: true })}
        </p>
        
        {/* Photo Status Indicators */}
        <div className="flex items-center gap-2 mt-2">
          {photo.canvasState && (
            <Badge variant="secondary" className="text-xs">
              Has Canvas Work
            </Badge>
          )}
        </div>
        
        {/* Photo Actions */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const { dispatch } = useEditorStore.getState();
              
              // Store job and photo context for the editor FIRST
              if (jobId) {
                dispatch({
                  type: 'SET_JOB_CONTEXT',
                  payload: {
                    jobId: jobId,
                    photoId: photo.id
                  }
                });
              }
              
              // Clear previous state to prevent contamination (but preserve job context)
              dispatch({ type: 'RESET' });
              
              // Load image to get actual dimensions
              const img = new Image();
              img.onload = () => {
                dispatch({
                  type: 'SET_IMAGE',
                  payload: {
                    url: photo.originalUrl,
                    width: img.naturalWidth,
                    height: img.naturalHeight
                  }
                });
                
                // Navigate to editor
                navigate('/new-editor');
              };
              img.onerror = () => {
                // Fallback with default dimensions
                dispatch({
                  type: 'SET_IMAGE',
                  payload: {
                    url: photo.originalUrl,
                    width: 1920,
                    height: 1080
                  }
                });
                navigate('/new-editor');
              };
              img.src = photo.originalUrl;
            }}
            className="flex-1"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowDeletePhotoConfirm(photo.id)}
            disabled={deletePhotoMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

