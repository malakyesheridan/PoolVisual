import { ReportSection } from './ReportSection';

interface ReportImageGalleryProps {
  images: string[];
  title?: string;
}

export function ReportImageGallery({ images, title = 'Property Images' }: ReportImageGalleryProps) {
  if (images.length === 0) return null;

  return (
    <ReportSection title={title}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((url, index) => (
          <div
            key={index}
            className="aspect-video rounded-lg overflow-hidden border border-gray-200"
          >
            <img
              src={url}
              alt={`Property image ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

