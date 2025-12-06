import { ReportSection } from './ReportSection';

interface ReportImageGalleryProps {
  images: string[];
  title?: string;
}

export function ReportImageGallery({ images, title = 'Property Images' }: ReportImageGalleryProps) {
  if (images.length === 0) return null;

  return (
    <ReportSection title={title}>
      <div className="grid grid-cols-2 gap-4">
        {images.map((url, index) => (
          <div key={index}>
            <div className="rounded-lg overflow-hidden h-[200px]">
              <img
                src={url}
                alt={`Property image ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-sm text-gray-500 mt-1">Caption</div>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}

