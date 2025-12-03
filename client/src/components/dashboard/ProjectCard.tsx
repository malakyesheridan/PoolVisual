/**
 * Minimal Project Card Component
 * Clean, simple project card with essential information only
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Eye, Palette, Home, Image as ImageIcon } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useIsRealEstate } from '../../hooks/useIsRealEstate';

interface ProjectCardProps {
  job: any;
  onView: (id: string) => void;
}

export function ProjectCard({ job, onView }: ProjectCardProps) {
  const isRealEstate = useIsRealEstate();
  const [firstPhoto, setFirstPhoto] = useState<any>(null);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [photoError, setPhotoError] = useState(false);

  // Fetch the first photo for this job
  useEffect(() => {
    // If job already has photos array, use it
    if (job.photos && job.photos.length > 0) {
      setFirstPhoto(job.photos[0]);
      setPhotoLoading(false);
      return;
    }

    // Otherwise, fetch photos from API
    const fetchPhotos = async () => {
      try {
        setPhotoLoading(true);
        setPhotoError(false);
        const photos = await apiClient.getJobPhotos(job.id);
        if (photos && photos.length > 0) {
          // Sort by createdAt to get the first uploaded photo
          const sortedPhotos = [...photos].sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            return dateA - dateB;
          });
          setFirstPhoto(sortedPhotos[0]);
        }
      } catch (error) {
        console.error('Failed to fetch photos for job:', job.id, error);
        setPhotoError(true);
      } finally {
        setPhotoLoading(false);
      }
    };

    fetchPhotos();
  }, [job.id, job.photos]);

  const PlaceholderIcon = isRealEstate ? Home : Palette;

  return (
    <Card className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-150 overflow-hidden">
      <CardContent className="p-0">
        {/* Photo thumbnail */}
        <div className="w-full h-48 bg-gray-100 flex items-center justify-center overflow-hidden relative">
          {photoLoading ? (
            <div className="text-center text-gray-400">
              <div className="animate-pulse">
                <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">Loading...</p>
              </div>
            </div>
          ) : firstPhoto ? (
            <img 
              src={
                firstPhoto.originalUrl?.startsWith('/uploads/')
                  ? `/api/photos/${firstPhoto.id}/image`
                  : firstPhoto.originalUrl || firstPhoto.url
              }
              alt={job.clientName || 'Property preview'} 
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to placeholder if image fails to load
                setPhotoError(true);
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <div className="text-center text-gray-400">
              <PlaceholderIcon className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">No photo</p>
            </div>
          )}
          {photoError && !photoLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-gray-400 bg-gray-100">
              <div>
                <PlaceholderIcon className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">No photo</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Card content */}
        <div className="p-5 space-y-3">
          {/* Client name */}
          <div>
            <h3 className="font-semibold text-lg text-gray-900 truncate">
              {job.clientName || 'Unnamed Project'}
            </h3>
          </div>
          
          {/* View button */}
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-white rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            onClick={() => onView(job.id)}
          >
            <Eye className="w-4 h-4 mr-2" />
            View Project
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

